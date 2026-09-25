import { hacherCle, normaliserCle } from './acces'
import type { Connexion, Requeteur } from './db'

/**
 * Jeu d'essai du developpement.
 *
 * Une base vide ne montre rien : pas de liste, pas de communs, pas de
 * desaccords, rien a revoir. On seme donc deux comptes et une liste deja
 * bien entamee, pour que chaque ecran ait quelque chose a afficher des le
 * premier `npm run dev`.
 *
 * Les cles sont fixes exprès : elles sont ecrites en clair ci-dessous et
 * affichees au demarrage. Ce n'est pas un secret qui fuite — elles n'ouvrent
 * qu'une base locale, jetable, qui n'existe pas en production (ce fichier
 * n'est appele que depuis la branche `import.meta.dev` de db.ts).
 */
export const CLES_DEV = {
  greg: 'DEVG-REGX-2345', audrey: 'DEVA-DREY-2345', mamie: 'DEVM-AMIE-2345'
}

/**
 * La version du jeu d'essai. A monter a CHAQUE changement de ce fichier.
 *
 * On ne seme qu'une base vide : une base semee avant un changement garde
 * l'ancien jeu, sans rien dire, et on cherche en vain la liste « Essai
 * gratuit » qu'un essai decrit. La version est gravee a la semaille ; le
 * demarrage et les outils de developpement disent quand elle est depassee.
 */
export const VERSION_SEMENCE = 1

/** Les comptes du jeu d'essai, tels que les outils de dev les montrent. */
export const COMPTES_DEV = [
  { pseudo: 'Greg', cle: CLES_DEV.greg, role: 'parent, sur toutes les listes' },
  { pseudo: 'Audrey', cle: CLES_DEV.audrey, role: 'parent, sur « Notre liste »' },
  { pseudo: 'Mamie', cle: CLES_DEV.mamie, role: 'observatrice de « Notre liste »' }
]

async function marqueur(c: Requeteur) {
  await c.query(`create table if not exists _semence (
    version integer not null, semee_le timestamptz not null default now())`)
}

/** Version et date de la semaille. Version 0 : semee avant qu'on les grave. */
export async function etatSemence(c: Requeteur): Promise<{ version: number; semee_le: string | null; a_jour: boolean }> {
  await marqueur(c)
  const r = await c.query(`select version, semee_le from _semence order by semee_le desc limit 1`)
  const version = Number(r.rows[0]?.version ?? 0)
  return { version, semee_le: r.rows[0]?.semee_le ?? null, a_jour: version >= VERSION_SEMENCE }
}

/** Au demarrage, une base deja semee ne disait rien : pas de cle, pas d'etat. */
export async function annoncerBaseLocale(c: Requeteur) {
  const e = await etatSemence(c)
  const date = e.semee_le ? new Date(e.semee_le).toLocaleDateString('fr-FR') : 'date inconnue'
  console.log(
    `\n  Base locale : .data/dev (Postgres embarque) — jeu d'essai v${e.version}, seme le ${date}.\n` +
    `  Cles : ${COMPTES_DEV.map(x => `${x.pseudo} ${x.cle}`).join(' · ')}\n` +
    (e.a_jour
      ? `  Outils : Mon compte -> Outils de developpement (base neuve, nouvelle journee, quotas, deblocage).\n`
      : `  /!\\ Jeu d'essai PERIME (v${e.version}, actuel v${VERSION_SEMENCE}) : des listes et des comptes d'essai manquent.\n` +
        `      Mon compte -> Outils de developpement -> Base neuve, ou arretez le serveur et lancez npm run dev:neuf.\n`))
}

// Deux gouts differents, avec un recouvrement volontaire ET des desaccords
// francs (Greg dit oui a Marius et Hector, Audrey dit non) : sans eux, le
// volet « A revoir » serait vide et on ne verrait jamais s'il marche.
const GOUTS_GREG = {
  oui: ['Louise', 'Jeanne', 'Alma', 'Nine', 'Iris', 'Suzanne', 'Colette', 'Hector',
        'Basile', 'Marius', 'Anouk', 'Lucien'],
  neutre: ['Camille', 'Sacha', 'Noé', 'Léon', 'Rose', 'Victor'],
  non: ['Kevin', 'Jason', 'Brandon', 'Dylan', 'Kelly', 'Océane', 'Enzo']
}
const GOUTS_AUDREY = {
  oui: ['Louise', 'Jeanne', 'Iris', 'Adèle', 'Margot', 'Gaspard', 'Basile', 'Anouk'],
  neutre: ['Alma', 'Nine', 'Colette', 'Victor', 'Suzanne'],
  // Ferdinand : refuse par Audrey et JAMAIS juge par Greg. C'est le seul cas
  // qui permet de verifier que l'app ne dit pas « Audrey : non » quand Greg
  // vient de dire oui — tous les autres refus d'Audrey portent sur des
  // prenoms que Greg a deja tranches.
  non: ['Kevin', 'Marius', 'Hector', 'Brandon', 'Dylan', 'Jayden', 'Ferdinand']
}
/**
 * Mamie observe.
 *
 * Elle dit NON a Louise, sur laquelle Greg et Audrey sont d'accord. C'est le
 * seul cas qui prouve qu'un observateur ne casse rien : si Louise disparaissait
 * des communs, le role ne servirait a rien et l'argument de vente serait faux.
 */
const GOUTS_MAMIE = {
  oui: ['Jeanne', 'Suzanne', 'Colette'],
  neutre: ['Iris'],
  non: ['Louise', 'Anouk']
}

// Ecartes « d'un geste » : c'est ce qui remplit le bloc des familles dans
// Parametres, et ce qui permet de verifier qu'un non individuel y survit.
const BALAYAGE = { racine: 'kevi', prenoms: ['Kevin', 'Kevyn', 'Kevan'] }

/** Seme une base vide. Renvoie vrai si elle l'etait. */
export async function semerSiVide(c: Connexion): Promise<boolean> {
  const dejaLa = await c.query(`select count(*)::int as n from utilisateurs`)
  if ((dejaLa.rows[0]?.n ?? 0) > 0) return false

  const [greg, audrey, mamie] = await Promise.all([
    creerCompte(c, 'Greg', CLES_DEV.greg),
    creerCompte(c, 'Audrey', CLES_DEV.audrey),
    creerCompte(c, 'Mamie', CLES_DEV.mamie)
  ])

  // « Notre liste » est marquee payee : c'est elle que tous les essais
  // utilisent, et on ne veut pas qu'ils butent sur le quota au 21e swipe.
  const g = await c.query(
    `insert into groupes (nom, code_invitation, cree_par, quota_swipe_jour,
                          quota_swipe_mois, nb_vetos_max, paye_le, paye_par)
     values ('Notre liste', 'dec0de00', $1, 20, 600, 3, now(), $1) returning id`, [greg])
  const gid = g.rows[0].id

  // Une seconde liste, gratuite et au quota minuscule, pour pouvoir taper
  // dans le mur en quelques swipes plutot qu'en cent soixante-cinq : 3 de
  // depart, puis 2 par jour. Son depart de LISTE est de 4 : apres les 3 de
  // Greg, un nouveau membre n'en trouve plus qu'un — c'est ce qui prouve
  // qu'un compte jetable ne rapporte pas un depart entier.
  const g2 = await c.query(
    `insert into groupes (nom, code_invitation, cree_par, quota_swipe_jour,
                          quota_swipe_mois, nb_vetos_max,
                          quota_depart, quota_depart_liste, quota_par_jour)
     values ('Essai gratuit', 'dec0de01', $1, 3, 8, 2, 3, 4, 2) returning id`, [greg])
  // Une troisieme, gratuite elle aussi : elle sert a verifier qu'on ne gagne
  // pas un depart de plus en creant une liste de plus.
  const g3 = await c.query(
    `insert into groupes (nom, code_invitation, cree_par, quota_swipe_jour,
                          quota_swipe_mois, nb_vetos_max,
                          quota_depart, quota_depart_liste, quota_par_jour)
     values ('Autre essai', 'dec0de02', $1, 3, 8, 2, 3, 4, 2) returning id`, [greg])
  await c.query(`insert into membres (groupe_id, user_id, role) values ($1, $2, 'parent')`,
    [g3.rows[0].id, greg])
  await c.query(`insert into membres (groupe_id, user_id, role) values ($1, $2, 'parent')`,
    [g2.rows[0].id, greg])

  for (const [uid, role] of [[greg, 'parent'], [audrey, 'parent']] as const) {
    await c.query(
      `insert into membres (groupe_id, user_id, role) values ($1, $2, $3)`, [gid, uid, role])
  }

  // Le code des observateurs existe des le depart : sinon aucun ecran ne le
  // montre avant qu'on ait clique dessus, et on ne verrait pas qu'il marche.
  await c.query(`update groupes set code_observateur = 'ob5e0bad' where id = $1`, [gid])
  await c.query(
    `insert into membres (groupe_id, user_id, role) values ($1, $2, 'observateur')`,
    [gid, mamie])

  await voter(c, gid, greg, GOUTS_GREG)
  await voter(c, gid, audrey, GOUTS_AUDREY)
  await voter(c, gid, mamie, GOUTS_MAMIE)

  // Un balayage de famille cote Greg, en plus de ses non individuels.
  for (const p of BALAYAGE.prenoms) {
    await c.query(
      `insert into votes (groupe_id, user_id, prenom, valeur, balayage)
       values ($1, $2, $3, 0, $4)
       on conflict (groupe_id, user_id, prenom) do nothing`,
      [gid, greg, p, BALAYAGE.racine])
  }

  await c.query(
    `insert into favoris (groupe_id, user_id, prenom) values ($1,$2,'Alma'), ($1,$2,'Nine')
     on conflict do nothing`, [gid, greg]).catch(() => null)

  // Un veto de chaque cote : celui de Greg doit apparaitre dans SES choix,
  // celui d'Audrey ne doit apparaitre nulle part pour lui.
  await c.query(
    `insert into vetos (groupe_id, user_id, prenom, motif) values ($1,$2,'Jayden','mon ex')
     on conflict do nothing`, [gid, audrey]).catch(() => null)
  await c.query(
    `insert into vetos (groupe_id, user_id, prenom, motif) values ($1,$2,'Brandon','non')
     on conflict do nothing`, [gid, greg]).catch(() => null)

  await c.query(
    `insert into commentaires (groupe_id, user_id, prenom, texte)
     values ($1, $2, 'Louise', 'Un peu partout en ce moment, non ?')`,
    [gid, audrey]).catch(() => null)

  // Un compte oublie depuis plus de deux ans : c'est ce que la purge RGPD doit
  // effacer (essai-rgpd.mjs), avec sa liste ou il etait seul. Il porte aussi
  // un reste du temps du lien magique (e-mail, jeton) que la purge nettoie.
  const fantome = await creerCompte(c, 'Fantome', 'DEVF-ANTM-2345')
  await c.query(
    `update utilisateurs set cree_le = now() - interval '26 months',
            vu_le = now() - interval '25 months', email = 'fantome@exemple.invalid'
      where id = $1`, [fantome])
  const gf = await c.query(
    `insert into groupes (nom, code_invitation, cree_par, cree_le)
     values ('Liste oubliee', 'dec0de0f', $1, now() - interval '26 months') returning id`, [fantome])
  await c.query(`insert into membres (groupe_id, user_id, role) values ($1, $2, 'parent')`,
    [gf.rows[0].id, fantome])
  await c.query(`insert into votes (groupe_id, user_id, prenom, valeur) values ($1, $2, 'Louise', 2)`,
    [gf.rows[0].id, fantome])
  await c.query(
    `insert into jetons_magiques (jeton, email, expire_le)
     values ('jeton-du-temps-du-lien-magique', 'fantome@exemple.invalid', now() - interval '2 years')`)
  // Un compteur de gestes de plus de deux mois cote Greg : la purge le retire,
  // et le quota du mois en cours ne le voit pas.
  await c.query(
    `insert into quota_jour (groupe_id, user_id, jour, n) values ($1, $2, current_date - 70, 3)`,
    [g3.rows[0].id, greg])

  console.log(
    '\n  Base de developpement semee (Postgres embarque, dossier .data/).\n' +
    `  Liste « Notre liste », code d'invitation dec0de00.\n` +
    `  Cle de Greg   : ${CLES_DEV.greg}\n` +
    `  Cle d'Audrey  : ${CLES_DEV.audrey}\n` +
    `  Cle de Mamie  : ${CLES_DEV.mamie} (observatrice, code ob5e0bad)\n` +
    '  Ouvrez-en une dans une fenetre privee pour voir le vote aveugle a deux.\n' +
    '  Pour repartir de zero : Mon compte -> Outils de developpement -> Base neuve.\n')

  await marqueur(c)
  await c.query(`delete from _semence`)
  await c.query(`insert into _semence (version) values ($1)`, [VERSION_SEMENCE])
  return true
}

async function creerCompte(c: Connexion, pseudo: string, cle: string): Promise<string> {
  const r = await c.query(
    `insert into utilisateurs (pseudo, cle_acces_hash) values ($1, $2) returning id`,
    [pseudo, hacherCle(normaliserCle(cle))])
  return r.rows[0].id
}

async function voter(c: Connexion, gid: number, uid: string,
                     gouts: { oui: string[]; neutre: string[]; non: string[] }) {
  const lots: [string[], number][] = [[gouts.oui, 2], [gouts.neutre, 1], [gouts.non, 0]]
  for (const [noms, valeur] of lots) {
    for (const p of noms) {
      await c.query(
        `insert into votes (groupe_id, user_id, prenom, valeur) values ($1,$2,$3,$4)
         on conflict (groupe_id, user_id, prenom) do nothing`, [gid, uid, p, valeur])
    }
  }
}
