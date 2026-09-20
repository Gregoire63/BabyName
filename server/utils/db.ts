import pg from 'pg'

/**
 * Résolution de l'URL de connexion.
 *
 * Les intégrations Vercel préfixent leurs variables par le nom du store :
 * un store « neon-database » produit NEON_DATABASE_DATABASE_URL,
 * NEON_DATABASE_POSTGRES_URL, NEON_DATABASE_DATABASE_URL_UNPOOLED… Une liste
 * en dur est donc condamnée à être fausse. On détecte par motif :
 *   1. NUXT_DATABASE_URL, si on veut forcer une valeur
 *   2. toute variable se terminant par DATABASE_URL ou POSTGRES_URL, en
 *      écartant les variantes non poolées
 *   3. les non poolées en dernier recours
 *
 * Le pooling n'est pas un détail : en serverless, chaque instance ouvre ses
 * propres connexions. Sans le pooler de Neon, quelques minutes d'usage
 * épuisent le quota et la base refuse tout le monde.
 */
const NON_POOLE = /UNPOOLED|NON_POOLING|NO_SSL/
const CANDIDATE = /(^|_)(DATABASE_URL|POSTGRES_URL)$/

export function urlBase(): { url: string; source: string | null } {
  const force = String(useRuntimeConfig().databaseUrl || '')
  if (force) return { url: force, source: 'NUXT_DATABASE_URL' }

  const cles = Object.keys(process.env).filter(k => CANDIDATE.test(k) && process.env[k])
  const poolees = cles.filter(k => !NON_POOLE.test(k))
  // à défaut de pooler, on prend quand même : mieux vaut une app lente qu'une app morte
  const choix = poolees.sort()[0] ?? cles.filter(k => NON_POOLE.test(k)).sort()[0]
  return choix ? { url: process.env[choix]!, source: choix } : { url: '', source: null }
}

/** Le strict minimum qu'une route attend d'une base. Postgres distant et
 *  Postgres embarqué implémentent la même chose — aucune route ne sait
 *  laquelle des deux elle a sous les pieds. */
export interface Requeteur {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>
}
export interface Connexion extends Requeteur {
  /** Une transaction. Tout ou rien, quel que soit le moteur. */
  transaction<T>(fn: (c: Requeteur) => Promise<T>): Promise<T>
  /** Plusieurs instructions d'un coup — un fichier de schéma, typiquement. */
  executer(sql: string): Promise<void>
  moteur: 'postgres' | 'embarque'
}

let connexion: Promise<Connexion> | null = null

/** Postgres distant : Neon en production. */
function distant(url: string): Connexion {
  const pool = new pg.Pool({
    connectionString: url,
    max: 3,                       // fonctions serverless : peu de connexions par instance
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false }
  })
  return {
    moteur: 'postgres',
    query: (sql, params) => pool.query(sql, params),
    executer: async (sql) => { await pool.query(sql) },
    async transaction(fn) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const r = await fn(client)
        await client.query('commit')
        return r
      } catch (err) {
        await client.query('rollback').catch(() => null)
        throw err
      } finally {
        client.release()
      }
    }
  }
}

/**
 * Postgres embarqué, en développement uniquement.
 *
 * Pourquoi : sans base, on ne peut meme pas se connecter a l'app en local —
 * il n'y a rien a regarder. Neon n'est joignable ni depuis la machine de dev
 * ni depuis un connecteur, et un faux serveur d'API qui repond des donnees
 * inventees ment sur le SQL : c'est exactement comme ca qu'une colonne mal
 * nommee est partie en production sans que rien ne la rattrape.
 *
 * PGlite, c'est le vrai Postgres compile en WebAssembly. Memes types, memes
 * vues, memes erreurs. Rien a installer, rien a lancer a cote, et le fichier
 * vit dans .data/ qui n'est pas versionne.
 *
 * Ce chemin est mort en production : `import.meta.dev` vaut false a la
 * compilation, la branche disparait du bundle.
 */
async function embarque(): Promise<Connexion> {
  const { PGlite } = await import('@electric-sql/pglite')
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto')
  const { mkdirSync } = await import('node:fs')
  const dossier = '.data/dev'
  mkdirSync(dossier, { recursive: true })   // PGlite ne cree pas les parents
  const pgl = await PGlite.create({ dataDir: dossier, extensions: { pgcrypto } })

  const c: Connexion = {
    moteur: 'embarque',
    query: (sql, params) => pgl.query(sql, params) as any,
    executer: (sql) => pgl.exec(sql).then(() => undefined),
    transaction: (fn) => pgl.transaction(tx => fn(tx as any)) as any
  }

  // Schema idempotent : on le rejoue a chaque demarrage. Il ne coute rien, et
  // une migration ecrite dans la journee est prise en compte sans rien faire.
  const schema = await useStorage('assets:server').getItem<string>('schema.sql')
  if (!schema) throw new Error('server/assets/schema.sql introuvable')
  await c.executer(schema)

  const { semerSiVide } = await import('./semence')
  await semerSiVide(c)
  return c
}

export function base(): Promise<Connexion> {
  return (connexion ??= (async () => {
    const { url } = urlBase()
    if (url) return distant(url)
    if (import.meta.dev) return embarque()
    throw createError({ statusCode: 500, statusMessage: 'aucune_url_de_base' })
  })())
}

export async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const r = await (await base()).query(sql, params)
  return r.rows as T[]
}

export async function q1<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params)
  return rows[0] ?? null
}

/** Tout ou rien. Remplace l'ancien `db().connect()` + begin/commit à la main. */
export async function transaction<T>(fn: (c: Requeteur) => Promise<T>): Promise<T> {
  return (await base()).transaction(fn)
}
