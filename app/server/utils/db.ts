/**
 * La base : Cloudflare D1 — du SQLite, dans le compte Cloudflare qui sert
 * l'app. En production comme en développement : `nuxt dev` passe par wrangler
 * (getPlatformProxy), qui fait tourner le MÊME moteur en local, dans
 * .data/wrangler. Ce qui passe en local passe en ligne.
 *
 * Pourquoi D1 plutôt qu'un Postgres : rien à réveiller (Neon s'endormait après
 * cinq minutes sans requête), aucune connexion à ouvrir puis fermer à chaque
 * requête, une sauvegarde de sept jours incluse (Time Travel), et un seul
 * prestataire pour l'app et ses données.
 *
 * Trois différences avec Postgres commandent le reste du code :
 *  - pas de transaction « ouverte » : on envoie un LOT d'instructions
 *    (`lot()`), exécuté d'un bloc, tout ou rien — c'est aussi un seul
 *    aller-retour ;
 *  - les dates sont du texte ISO 8601 en UTC, au format de
 *    `Date.toISOString()` (« 2026-09-25T21:05:04.563Z ») : elles se trient
 *    comme du texte et se lisent avec `new Date()` (voir MAINTENANT) ;
 *  - ni booléens ni JSON natifs : 0/1 et du texte. Remis en forme ici, en
 *    sortie (BOOLEENS, JSONS), pour que l'API réponde exactement comme avant.
 *
 * Paramètres numérotés `?1`, `?2`… (un même numéro peut servir deux fois).
 */

// --- ce que l'on utilise de l'API D1 (types minimaux, sans dépendance) -------
interface D1Meta { changes?: number; rows_read?: number; rows_written?: number; last_row_id?: number }
interface D1Resultat { results?: any[]; meta?: D1Meta }
interface D1Instruction {
  bind(...valeurs: unknown[]): D1Instruction
  all(): Promise<D1Resultat>
  run(): Promise<D1Resultat>
  first(): Promise<any>
}
export interface D1 {
  prepare(sql: string): D1Instruction
  batch(instructions: D1Instruction[]): Promise<D1Resultat[]>
}

export type Valeur = string | number | boolean | null | undefined | Date | object
export type Instruction = [sql: string, params?: Valeur[]]
export interface Resultat<T = any> { rows: T[]; changes: number; lues: number; ecrites: number }

/** Maintenant, au format des dates de la base. */
export const MAINTENANT = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`

/** Un instant décalé de maintenant, au même format : `decale('-1 day')`. Le
 *  modificateur peut aussi être un paramètre : `decale('?2')`. */
export const decale = (modificateur: string) =>
  `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ${modificateur.startsWith('?') ? modificateur : `'${modificateur}'`})`

/** Le jour de Paris (AAAA-MM-JJ) : un filet qui revient à deux heures du
 *  matin passe pour un bug. SQLite ne connaît pas les fuseaux ; JS, si. */
export function jourParis(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d)
}

/** Une liste en paramètre : `prenom in (select value from json_each(?3))`. */
export const DANS = (n: number) => `(select value from json_each(?${n}))`

/** Une contrainte d'unicité a refusé l'écriture (l'ancien code 23505). */
export function estDoublon(err: unknown): boolean {
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT_(UNIQUE|PRIMARYKEY)/i.test(String((err as any)?.message ?? err))
}

// Colonnes à remettre en forme en sortie. Un nom ici vaut pour toutes les
// requêtes : on nomme ses colonnes en conséquence.
const BOOLEENS = new Set([
  'favoris_visibles', 'offert', 'synchronisee', 'paye', 'a_une_cle', 'observateur',
  'creee_par_moi', 'debloquee', 'debloquee_par_moi', 'cle_acces_active',
  'rangee_dans_un_trousseau'
])
const JSONS = new Set(['filtres', 'transports'])

function ligne(r: any) {
  for (const k in r) {
    const v = r[k]
    if (v === null) continue
    if (BOOLEENS.has(k)) r[k] = !!v
    else if (JSONS.has(k) && typeof v === 'string') {
      try { r[k] = JSON.parse(v) } catch { /* laisse le texte */ }
    }
  }
  return r
}

/** Ce que D1 sait lier : ni `undefined`, ni booléen, ni date, ni tableau. */
function valeur(v: Valeur): string | number | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') return JSON.stringify(v)
  return v as string | number
}

function preparer(db: D1, sql: string, params: Valeur[] = []) {
  const p = db.prepare(sql)
  return params.length ? p.bind(...params.map(valeur)) : p
}

function resultat<T>(r: D1Resultat): Resultat<T> {
  return {
    rows: (r.results ?? []).map(ligne) as T[],
    changes: r.meta?.changes ?? 0,
    lues: r.meta?.rows_read ?? 0,
    ecrites: r.meta?.rows_written ?? 0
  }
}

/** Les requêtes, liées à une base donnée — sans attendre qu'elle soit prête. */
export function outils(db: D1) {
  const q = async <T = any>(sql: string, params: Valeur[] = []): Promise<T[]> =>
    resultat<T>(await preparer(db, sql, params).all()).rows
  return {
    db,
    q,
    q1: async <T = any>(sql: string, params: Valeur[] = []): Promise<T | null> =>
      (await q<T>(sql, params))[0] ?? null,
    /** Une écriture : combien de lignes elle a touchées. */
    ecrire: async (sql: string, params: Valeur[] = []) => resultat(await preparer(db, sql, params).run()),
    /** Un lot : exécuté d'un bloc, dans l'ordre, tout ou rien. */
    lot: async (instructions: Instruction[]): Promise<Resultat[]> => {
      if (!instructions.length) return []
      const r = await db.batch(instructions.map(([sql, params]) => preparer(db, sql, params)))
      return r.map(x => resultat(x))
    }
  }
}
export type Outils = ReturnType<typeof outils>

function liaison(): D1 {
  const db = (globalThis as any).__env__?.DB as D1 | undefined
  if (!db) throw createError({ statusCode: 500, statusMessage: 'base_absente' })
  return db
}

// --- migrations ----------------------------------------------------------------

/**
 * Découpe un fichier de migration en instructions : D1 prépare une instruction
 * à la fois. Un déclencheur (`create trigger … begin … ; … end`) reste entier.
 * Les commentaires `--` partent avant : pas de `--` dans une chaîne, donc.
 */
export function decouper(sql: string): string[] {
  const morceaux = sql.replace(/--[^\n]*/g, '').split(';')
  const out: string[] = []
  let enCours = ''
  for (const m of morceaux) {
    enCours = enCours ? `${enCours};${m}` : m
    const t = enCours.trim()
    if (!t) { enCours = ''; continue }
    if (/^create\s+trigger/i.test(t) && !/\bend$/i.test(t)) continue
    out.push(t)
    enCours = ''
  }
  if (enCours.trim()) out.push(enCours.trim())
  return out
}

/**
 * Applique les migrations manquantes (server/assets/migrations/*.sql).
 *
 * La même table que `wrangler d1 migrations apply` (d1_migrations) : on peut
 * appliquer à la main avant un déploiement, ou laisser la première requête le
 * faire. Chaque fichier passe en UN lot avec sa ligne de suivi : à moitié
 * appliqué, il ne l'est pas du tout. Deux instances qui démarrent ensemble :
 * la seconde bute sur la ligne de suivi, relit, et constate que c'est fait.
 */
export async function appliquerMigrations(db: D1): Promise<string[]> {
  const stockage = useStorage('assets:server')
  const cles = (await stockage.getKeys('migrations')).filter(k => k.endsWith('.sql')).sort()
  await db.prepare(`create table if not exists d1_migrations (
      id integer primary key autoincrement, name text unique,
      applied_at timestamp default current_timestamp not null)`).run()
  const faites = new Set(((await db.prepare('select name from d1_migrations').all()).results ?? [])
    .map((r: any) => r.name as string))
  const appliquees: string[] = []
  for (const cle of cles) {
    const nom = cle.split(':').pop()!
    if (faites.has(nom)) continue
    const sql = String(await stockage.getItem(cle) ?? '')
    try {
      await db.batch([
        ...decouper(sql).map(s => db.prepare(s)),
        db.prepare('insert into d1_migrations (name) values (?1)').bind(nom)
      ])
      appliquees.push(nom)
    } catch (err) {
      const deja = await db.prepare('select 1 as ok from d1_migrations where name = ?1').bind(nom).first()
      if (!deja) throw err
    }
  }
  return appliquees
}

// --- la base, prête -----------------------------------------------------------------

let prete: Promise<void> | null = null

/** La base, migrations appliquées (et, en développement, jeu d'essai semé). */
export async function base(): Promise<Outils> {
  const db = liaison()
  prete ??= (async () => {
    const appliquees = await appliquerMigrations(db)
    if (appliquees.length) console.info('[base] migrations appliquées :', appliquees.join(', '))
    if (import.meta.dev) {
      const { semerSiVide, annoncerBaseLocale } = await import('./semence')
      if (!(await semerSiVide(outils(db)))) await annoncerBaseLocale(outils(db)).catch(() => null)
    }
  })().catch((err) => { prete = null; throw err })
  await prete
  return outils(db)
}

export async function q<T = any>(sql: string, params: Valeur[] = []): Promise<T[]> {
  return (await base()).q<T>(sql, params)
}

export async function q1<T = any>(sql: string, params: Valeur[] = []): Promise<T | null> {
  return (await base()).q1<T>(sql, params)
}

export async function ecrire(sql: string, params: Valeur[] = []): Promise<Resultat> {
  return (await base()).ecrire(sql, params)
}

export async function lot(instructions: Instruction[]): Promise<Resultat[]> {
  return (await base()).lot(instructions)
}
