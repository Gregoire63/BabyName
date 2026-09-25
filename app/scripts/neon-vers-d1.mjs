#!/usr/bin/env node
/**
 * Copier les données de l'ancienne base (Postgres, Neon) vers D1.
 *
 * Une seule fois, au passage sur Cloudflare. Rien n'est envoyé nulle part :
 * le script LIT Neon et ÉCRIT un fichier SQL, que wrangler importe ensuite.
 *
 *   1. NEON_URL="postgres://…" npm run base:copier-neon
 *        (l'URL : Vercel → Storage → la base Neon → .env.local, la ligne
 *         DATABASE_URL_UNPOOLED ; sous Windows PowerShell :
 *         $env:NEON_URL="postgres://…"; npm run base:copier-neon)
 *   2. npm run base:migrer        (le schéma dans D1, si ce n'est pas fait)
 *   3. npx wrangler d1 execute DB --remote --config wrangler.jsonc --file .data/neon-vers-d1.sql
 *   4. Effacer .data/neon-vers-d1.sql : il contient des adresses e-mail.
 *
 * Ce qui est copié : comptes, listes, membres, votes, vetos, favoris,
 * commentaires, compteurs du jour, passkeys (et les tables mortes duels, Elo,
 * classement manuel, si elles ont des lignes). Ce qui ne l'est pas : les liens
 * de connexion en cours (quinze minutes de vie) et les compteurs de limites —
 * rien qui manque à personne.
 *
 * Les identifiants sont gardés tels quels (comptes, listes) : les sessions
 * ouvertes restent valables si NUXT_SESSION_SECRET ne change pas, et les
 * passkeys suivent… à condition que le domaine soit le même (elles sont liées
 * à babyname-five.vercel.app tant qu'elles ont été créées là).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL_NEON = process.env.NEON_URL || process.argv[2]
if (!URL_NEON) {
  console.error('Donnez l’URL de la base Neon : NEON_URL="postgres://…" npm run base:copier-neon')
  process.exit(1)
}
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SORTIE = resolve(RACINE, '.data/neon-vers-d1.sql')

const pg = (await import('pg')).default
// Neon exige TLS, avec un certificat valide. NEON_TLS=0 : une base locale d'essai.
const client = new pg.Client({
  connectionString: URL_NEON,
  ssl: process.env.NEON_TLS === '0' ? false : { rejectUnauthorized: true }
})
await client.connect()

/** Une valeur Postgres → un littéral SQLite. */
function litteral(v, type) {
  if (v === null || v === undefined) return 'null'
  if (type === 'bool') return v ? '1' : '0'
  if (type === 'json') return texte(JSON.stringify(v))
  if (v instanceof Date) return texte(v.toISOString())
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null'
  if (type === 'int') return String(Number(v))
  return texte(String(v))
}
const texte = (s) => `'${s.replace(/'/g, "''")}'`

/**
 * Les tables, dans l'ordre des clés étrangères. Pour chaque colonne : son
 * type côté SQLite quand il faut convertir (bool, json, int), sinon texte ou
 * nombre tel quel. Les dates sortent en ISO 8601 UTC, comme partout dans D1.
 */
const TABLES = [
  ['utilisateurs', { id: '', email: '', email_verifie_le: '', pseudo: '', cree_le: '', vu_le: '',
    cle_acces_hash: '', gestes_depart: 'int', session_gen: 'int', webauthn_id: '' }],
  ['groupes', { id: 'int', nom: '', code_invitation: '', cree_par: '', cree_le: '', nb_vetos_max: 'int',
    favoris_visibles: 'bool', quota_swipe_jour: 'int', filtres: 'json', paye_le: '', paye_par: '',
    offert: 'bool', paiement_ref: '', nom_famille: '', code_observateur: '', quota_depart: 'int',
    quota_depart_liste: 'int', quota_par_jour: 'int', gestes_depart: 'int' }],
  ['membres', { groupe_id: 'int', user_id: '', role: '', poids: '', rejoint_le: '' }],
  ['votes', { groupe_id: 'int', user_id: '', prenom: '', valeur: 'int', vote_le: '', balayage: '' }],
  ['vetos', { groupe_id: 'int', user_id: '', prenom: '', motif: '', pose_le: '' }],
  ['favoris', { groupe_id: 'int', user_id: '', prenom: '' }],
  ['duels', { id: 'int', groupe_id: 'int', user_id: '', prenom_a: '', prenom_b: '', gagnant: '', joue_le: '' }],
  ['elo', { groupe_id: 'int', user_id: '', prenom: '', score: '', n_duels: 'int' }],
  ['classement_manuel', { groupe_id: 'int', user_id: '', prenom: '', position: 'int' }],
  ['commentaires', { id: 'int', groupe_id: 'int', user_id: '', prenom: '', texte: '', ecrit_le: '' }],
  ['quota_jour', { groupe_id: 'int', user_id: '', jour: '', n: 'int' }],
  ['passkeys', { id: '', user_id: '', cle_publique: '', compteur: 'int', transports: 'json', nom: '',
    synchronisee: 'bool', cree_le: '', utilisee_le: '' }]
]

// Le jour du quota est une date sans heure : on la lit en texte, sans fuseau.
const LECTURE = { quota_jour: `select groupe_id, user_id, to_char(jour, 'YYYY-MM-DD') as jour, n from quota_jour` }

const lignes = ['-- Copie de Neon vers D1 — genere par scripts/neon-vers-d1.mjs. A effacer apres import.']
const bilan = []
for (const [table, colonnes] of TABLES) {
  const existe = await client.query(`select to_regclass($1) as t`, [`public.${table}`])
  if (!existe.rows[0].t) { bilan.push(`${table}: absente`); continue }
  const noms = Object.keys(colonnes)
  // Seulement les colonnes qui existent côté Neon (une base ancienne peut en manquer).
  const presentes = (await client.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
    [table])).rows.map(r => r.column_name)
  const cols = noms.filter(n => presentes.includes(n))
  const { rows } = await client.query(LECTURE[table] ?? `select ${cols.join(', ')} from ${table}`)
  // Une adresse jamais prouvée (celles du tout premier lien magique, que plus
  // rien ne lit) ne passe pas : minimisation, et elle bloquerait l'adresse
  // le jour où son titulaire voudrait la vérifier (unicité).
  if (table === 'utilisateurs') {
    let retirees = 0
    for (const r of rows) if (r.email && !r.email_verifie_le) { r.email = null; retirees++ }
    if (retirees) bilan.push(`  (adresses jamais vérifiées, non copiées : ${retirees})`)
  }
  bilan.push(`${table}: ${rows.length}`)
  // Par paquets : une instruction D1 ne dépasse pas 100 Ko.
  for (let i = 0; i < rows.length; i += 200) {
    const paquet = rows.slice(i, i + 200)
      .map(r => `(${cols.map(c => litteral(r[c], colonnes[c])).join(', ')})`)
    lignes.push(`insert into ${table} (${cols.join(', ')}) values\n${paquet.join(',\n')};`)
  }
}
await client.end()

mkdirSync(dirname(SORTIE), { recursive: true })
writeFileSync(SORTIE, lignes.join('\n') + '\n')
console.log(bilan.join('\n'))
console.log(`\nÉcrit : ${SORTIE}\nImport : npx wrangler d1 execute DB --remote --config wrangler.jsonc --file .data/neon-vers-d1.sql`)
console.log('Puis effacez ce fichier : il contient des adresses e-mail.')
