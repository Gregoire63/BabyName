import pg from 'pg'

let pool: pg.Pool | null = null

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

/** Pool partagé. Sur Vercel, préférer l'URL « pooled » de Neon (…-pooler…). */
export function db(): pg.Pool {
  if (pool) return pool
  const { url } = urlBase()
  if (!url) throw createError({ statusCode: 500, statusMessage: 'aucune_url_de_base' })
  pool = new pg.Pool({
    connectionString: url,
    max: 3,                       // fonctions serverless : peu de connexions par instance
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false }
  })
  return pool
}

export async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const r = await db().query(sql, params)
  return r.rows as T[]
}

export async function q1<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params)
  return rows[0] ?? null
}
