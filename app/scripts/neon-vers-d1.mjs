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
 * Ce qui est copié : comptes, listes, membres, votes, vetos (chacun avec ses
 * graphies, prises dans le catalogue, comme un veto posé aujourd'hui), favoris,
 * commentaires, passkeys (et les tables mortes duels, Elo, classement manuel,
 * si elles ont des lignes). Les votes arrivent en BULLETINS, un par membre et
 * par liste (migration 0005), avec le dernier compteur du filet quotidien ;
 * les compteurs de départ de Neon (gestes_depart) deviennent les archives que
 * la migration décrit. Ce qui ne l'est pas : les liens de connexion en cours
 * (quinze minutes de vie) et les compteurs de limites — rien qui manque à
 * personne.
 *
 * Les identifiants sont gardés tels quels (comptes, listes) : les sessions
 * ouvertes restent valables si NUXT_SESSION_SECRET ne change pas, et les
 * passkeys suivent… à condition que le domaine soit le même (elles sont liées
 * à babyname-five.vercel.app tant qu'elles ont été créées là).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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

/**
 * Les votes de Neon, une ligne par vote, rangés en bulletins : une ligne par
 * membre et par liste, `positifs` (oui, neutres) et `negatifs` (non), chaque
 * entrée [valeur, instant en secondes, balayage ?] — le format de la
 * migration 0005. Plus le dernier jour du filet (quota_jour) : le quota ne
 * lit que le jour même.
 */
async function bulletins() {
  const existe = async t => (await client.query(`select to_regclass($1) as t`, [`public.${t}`])).rows[0].t
  const colonnes = async t => (await client.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
    [t])).rows.map(r => r.column_name)
  const parMembre = new Map()
  const bulletin = (gid, uid) => {
    const cle = `${gid}|${uid}`
    if (!parMembre.has(cle)) parMembre.set(cle, { gid, uid, positifs: {}, negatifs: {}, nb: 0, maj: null, jour: null, n: 0 })
    return parMembre.get(cle)
  }
  let votes = 0
  if (await existe('votes')) {
    const avecBalayage = (await colonnes('votes')).includes('balayage')
    const { rows } = await client.query(
      `select groupe_id, user_id, prenom, valeur, vote_le${avecBalayage ? ', balayage' : ''}
         from votes order by groupe_id, user_id, vote_le`)
    for (const v of rows) {
      const b = bulletin(Number(v.groupe_id), v.user_id)
      const instant = Math.floor(new Date(v.vote_le).getTime() / 1000)
      const entree = v.balayage ? [Number(v.valeur), instant, v.balayage] : [Number(v.valeur), instant]
      if (!Object.hasOwn(b.positifs, v.prenom) && !Object.hasOwn(b.negatifs, v.prenom)) b.nb++
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

const lignes = ['-- Copie de Neon vers D1 — genere par scripts/neon-vers-d1.mjs. A effacer apres import.']
const bilan = []
for (const [table, colonnes] of TABLES) {
  if (table === 'bulletins') { await bulletins(); continue }
  const existe = await client.query(`select to_regclass($1) as t`, [`public.${table}`])
  if (!existe.rows[0].t) { bilan.push(`${table}: absente`); continue }
  const noms = Object.keys(colonnes)
  // Seulement les colonnes qui existent côté Neon (une base ancienne peut en manquer).
  const presentes = (await client.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
    [table])).rows.map(r => r.column_name)
  const cols = noms.filter(n => presentes.includes(n))
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
await client.end()

mkdirSync(dirname(SORTIE), { recursive: true })
writeFileSync(SORTIE, lignes.join('\n') + '\n')
console.log(bilan.join('\n'))
console.log(`\nÉcrit : ${SORTIE}\nImport : npx wrangler d1 execute DB --remote --config wrangler.jsonc --file .data/neon-vers-d1.sql`)
console.log('Puis effacez ce fichier : il contient des adresses e-mail.')
