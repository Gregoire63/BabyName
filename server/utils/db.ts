import pg from 'pg'

let pool: pg.Pool | null = null

/** Pool partagé. Sur Vercel, utiliser l'URL « pooled » de Neon (…-pooler…). */
export function db(): pg.Pool {
  if (pool) return pool
  const url = useRuntimeConfig().databaseUrl || process.env.DATABASE_URL || ''
  if (!url) throw createError({ statusCode: 500, statusMessage: 'DATABASE_URL absente' })
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
