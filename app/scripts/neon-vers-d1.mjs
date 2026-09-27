#!/usr/bin/env node
/**
 * Sauvegarder toute la base Neon, et préparer sa copie vers D1.
 *
 * Une commande, au passage sur Cloudflare. Rien n'est envoyé nulle part : le
 * script LIT Neon et ÉCRIT deux fichiers dans .data/ (ignoré par git) :
 *
 *   neon-sauvegarde-AAAA-MM-JJ-HHMM.json
 *     TOUTES les tables, toutes les lignes, telles quelles, avec leurs
 *     colonnes, leurs index et les compteurs d'identifiants. C'est le filet :
 *     ce que D1 ne reprend pas (jetons de connexion, colonnes abandonnées,
 *     adresses jamais vérifiées) y est aussi. Écrite, puis relue, AVANT la
 *     conversion : si celle-ci échoue, la sauvegarde existe déjà.
 *   neon-vers-d1.sql
 *     les données au format de D1, à importer dans une base NEUVE (une garde,
 *     en tête du fichier, arrête l'import si la base a déjà des comptes).
 *
 * Les deux viennent de la même photo : une transaction en lecture seule
 * (repeatable read), cohérente même si l'ancienne app écrit pendant ce temps.
 *
 *   1. L'URL de la base, SANS pooling : Vercel → Storage → la base Neon →
 *      .env.local → DATABASE_URL_UNPOOLED (ou console Neon → Connect,
 *      « Connection pooling » décoché).
 *   2. Dans app/, après npm install :
 *        PowerShell : $env:NEON_URL="postgresql://…"; npm run base:copier-neon
 *        bash :       NEON_URL="postgresql://…" npm run base:copier-neon
 *   3. Import : npx wrangler d1 execute DB --remote --config wrangler.jsonc --file .data/neon-vers-d1.sql
 *   4. Effacer .data/neon-vers-d1.sql. La sauvegarde : à garder à l'abri,
 *      hors du dépôt (elle contient des adresses e-mail), puis à effacer une
 *      fois D1 vérifié.
 *
 * Ce qui passe dans D1 : comptes, listes, membres, votes, vetos (chacun avec
 * ses graphies, prises dans le catalogue, comme un veto posé aujourd'hui),
 * favoris, commentaires, passkeys (et les tables mortes duels, Elo,
 * classement manuel, si elles ont des lignes). Les votes arrivent en
 * BULLETINS, un par membre et par liste (migration 0005), avec le dernier
 * compteur du filet quotidien ; les compteurs de départ de Neon
 * (gestes_depart) deviennent les archives que la migration décrit. Ce qui n'y
 * passe pas, et reste dans la sauvegarde : les liens et jetons de connexion
 * (quinze minutes de vie), les compteurs de limites, les adresses e-mail
 * jamais prouvées. Le script les nomme en finissant.
 *
 * Les identifiants sont gardés tels quels (comptes, listes) : les clés
 * d'accès restent valables (une empreinte SHA-256, sans secret), les codes
 * d'invitation aussi. Les sessions et les passkeys, elles, sont liées au
 * domaine où elles ont été créées : on se reconnecte une fois.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL_NEON = process.env.NEON_URL || process.env.DATABASE_URL_UNPOOLED
  || process.env.POSTGRES_URL_NON_POOLING || process.argv[2]
if (!URL_NEON) {
  console.error('Donnez l’URL de la base Neon : NEON_URL="postgresql://…" npm run base:copier-neon')
  process.exit(1)
}
if (/-pooler\./.test(URL_NEON)) {
  console.warn('Note : adresse « pooler ». Ça marche (tout se lit dans une transaction), '
    + 'mais Neon conseille l’adresse directe, DATABASE_URL_UNPOOLED.')
}
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOSSIER = resolve(RACINE, '.data')
const SORTIE = resolve(DOSSIER, 'neon-vers-d1.sql')
// L'heure de Paris dans le nom : deux sauvegardes du même jour ne s'écrasent pas.
const horodatage = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Paris' })
  .slice(0, 16).replace(' ', '-').replace(':', '')
const SAUVEGARDE = resolve(DOSSIER, `neon-sauvegarde-${horodatage}.json`)

/**
 * Le chiffrement, c'est nous qui le réglons : un « sslmode=require » laissé
 * dans l'URL remplacerait nos réglages (et pg afficherait un avertissement
 * alarmant pour rien). NEON_TLS=0 : une base locale d'essai, sans TLS.
 */
function adresseSansSsl(url) {
  try {
    const u = new URL(url)
    for (const p of ['sslmode', 'channel_binding', 'sslrootcert', 'sslcert', 'sslkey']) u.searchParams.delete(p)
    return u.toString()
  } catch { return url }
}
const pg = (await import('pg')).default
const client = new pg.Client({
  connectionString: adresseSansSsl(URL_NEON),
  ssl: process.env.NEON_TLS === '0' ? false : { rejectUnauthorized: true }
})
await client.connect()
// Une seule photo pour tout, en UTC : les dates de la sauvegarde ne dépendent
// pas du fuseau de l'ordinateur qui la fait.
await client.query('begin isolation level repeatable read read only')
await client.query(`set local time zone 'UTC'`)

// =================== 1. LA SAUVEGARDE BRUTE ===============================

/** Dates et heures : le texte de Postgres, sans passer par un Date JavaScript
 *  (un `date` y deviendrait minuit dans le fuseau de l'ordinateur). */
const TEL_QUEL = new Set([1082, 1083, 1114, 1184, 1186, 1266])
const typesTelsQuels = {
  getTypeParser: (oid, format) => TEL_QUEL.has(oid) ? v => v : pg.types.getTypeParser(oid, format)
}
const ident = s => `"${String(s).replace(/"/g, '""')}"`
/** Une valeur en JSON ; un bytea (Buffer) devient du base64. */
const J = v => JSON.stringify(v, (k, x) =>
  x && x.type === 'Buffer' && Array.isArray(x.data) ? { base64: Buffer.from(x.data).toString('base64') } : x)

/**
 * Toutes les tables de tous les schémas (pas seulement public), une ligne de
 * JSON par ligne de table : lisible, et un fichier qu'un autre outil relit
 * sans rien savoir de l'app. Renvoie le nombre de lignes par table.
 */
async function sauvegardeBrute() {
  const { rows: [info] } = await client.query(
    `select current_database() as base, version() as version, now() as photo`)
  const { rows: tables } = await client.query(`
    select table_schema as schema, table_name as nom from information_schema.tables
     where table_type = 'BASE TABLE'
       and table_schema not in ('pg_catalog', 'information_schema') and table_schema not like 'pg\\_%'
     order by table_schema <> 'public', table_schema, table_name`)
  const comptes = {}
  const json = ['{"format": "neon-sauvegarde/1", "genere_par": "scripts/neon-vers-d1.mjs",',
    `"base": ${J(info)},`, '"tables": {']
  for (let i = 0; i < tables.length; i++) {
    const { schema, nom } = tables[i]
    const cle = schema === 'public' ? nom : `${schema}.${nom}`
    const { rows: colonnes } = await client.query(`
      select column_name as nom, data_type as type, is_nullable = 'YES' as nul_permis, column_default as defaut
        from information_schema.columns where table_schema = $1 and table_name = $2
       order by ordinal_position`, [schema, nom])
    const { rows } = await client.query({ text: `select * from ${ident(schema)}.${ident(nom)}`, types: typesTelsQuels })
    comptes[cle] = rows.length
    json.push(`${J(cle)}: {"colonnes": ${J(colonnes)}, "lignes": [`)
    rows.forEach((r, k) => json.push(J(r) + (k < rows.length - 1 ? ',' : '')))
    json.push(`]}${i < tables.length - 1 ? ',' : ''}`)
  }
  // De quoi tout reconstruire ailleurs : index (clés primaires et uniques
  // comprises) et compteurs d'identifiants. Le schéma complet, lui, est dans
  // l'historique git (db/neon_schema.sql).
  const { rows: index } = await client.query(`
    select schemaname as schema, tablename as table, indexname as nom, indexdef as definition
      from pg_indexes where schemaname not in ('pg_catalog', 'information_schema') order by 1, 2, 3`)
  const { rows: sequences } = await client.query(`
    select schemaname as schema, sequencename as nom, last_value as valeur
      from pg_sequences where schemaname not in ('pg_catalog', 'information_schema') order by 1, 2`)
  json.push('},', `"index": ${J(index)},`, `"sequences": ${J(sequences)}`, '}')
  mkdirSync(DOSSIER, { recursive: true })
  writeFileSync(SAUVEGARDE, json.join('\n') + '\n')
  // Relue avant d'aller plus loin : une sauvegarde jamais relue n'en est pas une.
  const relue = JSON.parse(readFileSync(SAUVEGARDE, 'utf8'))
  for (const [t, n] of Object.entries(comptes)) {
    if (relue.tables[t]?.lignes?.length !== n) throw new Error(`Sauvegarde incomplète : ${t}`)
  }
  return { comptes, photo: info.photo }
}

const { comptes, photo } = await sauvegardeBrute()
const total = Object.values(comptes).reduce((a, b) => a + b, 0)
const ko = Math.ceil(statSync(SAUVEGARDE).size / 1024)
console.log(`Sauvegarde : ${Object.keys(comptes).length} tables, ${total} lignes, ${ko} Ko, relue`
  + `\n  ${relative(RACINE, SAUVEGARDE)}\n`)

// =================== 2. LA COPIE POUR D1 ==================================

/** Une valeur Postgres → un littéral SQLite. */
function litteral(v, type) {
  if (v === null || v === undefined) return 'null'
  if (type === 'bool') return v ? '1' : '0'
  // Les blocages secrets sont passés de 2 à 5 (migration 0002, qui relève les
  // listes déjà en base — mais celles-ci arrivent APRÈS elle).
  if (type === 'blocages') return String(Math.max(Number(v) || 0, 5))
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
  ['groupes', { id: 'int', nom: '', code_invitation: '', cree_par: '', cree_le: '', nb_vetos_max: 'blocages',
    favoris_visibles: 'bool', quota_swipe_jour: 'int', filtres: 'json', paye_le: '', paye_par: '',
    offert: 'bool', paiement_ref: '', nom_famille: '', code_observateur: '', quota_depart: 'int',
    quota_depart_liste: 'int', quota_par_jour: 'int', gestes_depart: 'int' }],
  ['membres', { groupe_id: 'int', user_id: '', role: '', poids: '', rejoint_le: '' }],
  // les votes et le compteur du jour, en bulletins : voir `bulletins()` plus bas
  ['bulletins', null],
  ['vetos', { groupe_id: 'int', user_id: '', prenom: '', motif: '', pose_le: '' }],
  ['favoris', { groupe_id: 'int', user_id: '', prenom: '' }],
  ['duels', { id: 'int', groupe_id: 'int', user_id: '', prenom_a: '', prenom_b: '', gagnant: '', joue_le: '' }],
  ['elo', { groupe_id: 'int', user_id: '', prenom: '', score: '', n_duels: 'int' }],
  ['classement_manuel', { groupe_id: 'int', user_id: '', prenom: '', position: 'int' }],
  ['commentaires', { id: 'int', groupe_id: 'int', user_id: '', prenom: '', texte: '', ecrit_le: '' }],
  ['passkeys', { id: '', user_id: '', cle_publique: '', compteur: 'int', transports: 'json', nom: '',
    synchronisee: 'bool', cree_le: '', utilisee_le: '' }]
]
/** Les tables de Neon que la copie lit : `votes` et `quota_jour` deviennent les bulletins. */
const LUES = new Set([...TABLES.map(([t]) => t).filter(t => t !== 'bulletins'), 'votes', 'quota_jour'])

const colonnesDe = async t => (await client.query(
  `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
  [t])).rows.map(r => r.column_name)
const existe = async t => (await client.query(`select to_regclass($1) as t`, [`public.${t}`])).rows[0].t

/**
 * Les votes de Neon, une ligne par vote, rangés en bulletins : une ligne par
 * membre et par liste, `positifs` (oui, neutres) et `negatifs` (non), chaque
 * entrée [valeur, instant en secondes, balayage ?] — le format de la
 * migration 0005. Plus le dernier jour du filet (quota_jour) : le quota ne
 * lit que le jour même.
 */
async function bulletins() {
  const parMembre = new Map()
  const bulletin = (gid, uid) => {
    const cle = `${gid}|${uid}`
    if (!parMembre.has(cle)) parMembre.set(cle, { gid, uid, positifs: {}, negatifs: {}, nb: 0, maj: null, jour: null, n: 0 })
    return parMembre.get(cle)
  }
  let votes = 0
  if (await existe('votes')) {
    const avecBalayage = (await colonnesDe('votes')).includes('balayage')
    const { rows } = await client.query(
      `select groupe_id, user_id, prenom, valeur, vote_le${avecBalayage ? ', balayage' : ''}
         from votes order by groupe_id, user_id, vote_le`)
    for (const v of rows) {
      const b = bulletin(Number(v.groupe_id), v.user_id)
      const instant = Math.floor(new Date(v.vote_le).getTime() / 1000)
      const entree = v.balayage ? [Number(v.valeur), instant, v.balayage] : [Number(v.valeur), instant]
      // nb : les prénoms jugés pour eux-mêmes, pas les graphies (migration 0006)
      if (!Object.hasOwn(b.positifs, v.prenom) && !Object.hasOwn(b.negatifs, v.prenom)
          && !String(v.balayage ?? '').startsWith('ph:')) b.nb++
      ;(Number(v.valeur) > 0 ? b.positifs : b.negatifs)[v.prenom] = entree
      const le = new Date(v.vote_le).toISOString()
      if (!b.maj || le > b.maj) b.maj = le
      votes++
    }
  }
  let compteurs = 0
  if (await existe('quota_jour')) {
    // Le jour du quota est une date sans heure : on la lit en texte, sans fuseau.
    const { rows } = await client.query(
      `select distinct on (groupe_id, user_id) groupe_id, user_id, to_char(jour, 'YYYY-MM-DD') as jour, n
         from quota_jour order by groupe_id, user_id, jour desc`)
    for (const r of rows) { const b = bulletin(Number(r.groupe_id), r.user_id); b.jour = r.jour; b.n = Number(r.n); compteurs++ }
  }
  // Une instruction D1 ne dépasse pas 100 Ko : un gros bulletin arrive en
  // plusieurs morceaux, recollés par json_patch.
  const morceaux = (objet) => {
    const out = []; let courant = {}; let taille = 2
    for (const [k, v] of Object.entries(objet)) {
      const t = JSON.stringify(k).length + JSON.stringify(v).length + 2
      if (taille + t > 30_000 && Object.keys(courant).length) { out.push(courant); courant = {}; taille = 2 }
      courant[k] = v; taille += t
    }
    out.push(courant)
    return out
  }
  for (const b of parMembre.values()) {
    const pos = morceaux(b.positifs), neg = morceaux(b.negatifs)
    const cle = `groupe_id = ${litteral(b.gid, 'int')} and user_id = ${litteral(b.uid)}`
    lignes.push(`insert into bulletins (groupe_id, user_id, nb, jour, n_jour, maj_le, positifs, negatifs) values (`
      + [litteral(b.gid, 'int'), litteral(b.uid), b.nb, litteral(b.jour), b.n, litteral(b.maj ?? new Date().toISOString()),
         litteral(pos[0], 'json'), litteral(neg[0], 'json')].join(', ') + ');')
    for (const m of pos.slice(1)) lignes.push(`update bulletins set positifs = json_patch(positifs, ${litteral(m, 'json')}) where ${cle};`)
    for (const m of neg.slice(1)) lignes.push(`update bulletins set negatifs = json_patch(negatifs, ${litteral(m, 'json')}) where ${cle};`)
  }
  bilan.push(`bulletins: ${parMembre.size}  (votes : ${votes}, compteurs du jour : ${compteurs})`)
}

// Les graphies (même prononciation), depuis le catalogue embarqué : un veto
// copié emporte les siennes, comme un veto posé aujourd'hui (migration 0002).
// Sans elles, bloquer Chloé laissait passer Cloé.
const cat = JSON.parse(readFileSync(resolve(RACINE, 'public/data/catalogue.json'), 'utf8'))
const parSon = new Map()
const sonDe = new Map()
for (let k = 0; k < cat.n; k++) {
  const son = cat.cols.gp ? cat.cols.gp[k] : k
  sonDe.set(cat.cols.l[k], son)
  if (!parSon.has(son)) parSon.set(son, [])
  parSon.get(son).push(cat.cols.l[k])
}
const graphiesDe = nom => (parSon.get(sonDe.get(nom)) ?? []).filter(x => x !== nom)

const lignes = [
  `-- Copie de Neon vers D1, photo du ${new Date(photo).toISOString()} (scripts/neon-vers-d1.mjs). A effacer apres import.`,
  '-- Garde : sur une base qui a deja des comptes (import en double, ou apres l ouverture),',
  '-- l import s arrete ici, sur une erreur « malformed JSON ». Rien n est ecrit.',
  `select json(case when exists (select 1 from utilisateurs) then 'base_deja_remplie' else '{}' end);`
]
const bilan = []
const laissees = []
for (const [table, colonnes] of TABLES) {
  if (table === 'bulletins') { await bulletins(); continue }
  if (!(await existe(table))) { bilan.push(`${table}: absente`); continue }
  const noms = Object.keys(colonnes)
  // Seulement les colonnes qui existent côté Neon (une base ancienne peut en manquer).
  const presentes = await colonnesDe(table)
  const cols = noms.filter(n => presentes.includes(n))
  for (const c of presentes) if (!noms.includes(c)) laissees.push(`${table}.${c}`)
  const { rows } = await client.query(`select ${cols.join(', ')} from ${table}`)
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
  if (table === 'vetos' && rows.length) {
    // Chaque veto devient la tête de ses graphies. Une graphie déjà bloquée
    // par ailleurs est ignorée, comme dans l'app.
    lignes.push(`update vetos set tete = prenom where tete is null;`)
    const graphies = rows.flatMap(r => graphiesDe(r.prenom).map(g =>
      `(${litteral(r.groupe_id, 'int')}, ${litteral(r.user_id)}, ${litteral(g)}, ${litteral(r.prenom)})`))
    for (let i = 0; i < graphies.length; i += 200) {
      lignes.push(`insert or ignore into vetos (groupe_id, user_id, prenom, tete) values\n${graphies.slice(i, i + 200).join(',\n')};`)
    }
    if (graphies.length) bilan.push(`  (graphies bloquées avec eux : ${graphies.length})`)
  }
}
await client.query('commit')
await client.end()

mkdirSync(DOSSIER, { recursive: true })
writeFileSync(SORTIE, lignes.join('\n') + '\n')
console.log('Pour D1 :')
console.log(bilan.map(l => `  ${l}`).join('\n'))
// Rien ne disparaît sans être nommé : ce que D1 ne reprend pas reste dans la sauvegarde.
const horsCopie = Object.entries(comptes).filter(([t]) => !LUES.has(t))
if (horsCopie.length || laissees.length) {
  console.log('\nPas repris dans D1 (mais dans la sauvegarde) :')
  if (horsCopie.length) console.log(`  tables : ${horsCopie.map(([t, n]) => `${t} (${n})`).join(', ')}`)
  if (laissees.length) console.log(`  colonnes : ${laissees.join(', ')}`)
}
console.log(`\nÉcrit : ${relative(RACINE, SORTIE)}`
  + '\nImport : npx wrangler d1 execute DB --remote --config wrangler.jsonc --file .data/neon-vers-d1.sql'
  + '\nPuis effacez ce fichier ; la sauvegarde, gardez-la à l’abri le temps de vérifier D1.')
