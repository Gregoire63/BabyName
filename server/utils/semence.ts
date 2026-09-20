import { hacherCle, normaliserCle } from './acces'
import type { Connexion } from './db'

/**
 * Jeu d'essai du developpement.
 *
 * Une base vide ne montre rien : pas de liste, pas de communs, pas de duels,
 * pas de classement. On seme donc deux comptes et une liste deja bien
 * entamee, pour que chaque ecran ait quelque chose a afficher des le premier
 * `npm run dev`.
 *
 * Les cles sont fixes exprès : elles sont ecrites en clair ci-dessous et
 * affichees au demarrage. Ce n'est pas un secret qui fuite — elles n'ouvrent
 * qu'une base locale, jetable, qui n'existe pas en production (ce fichier
 * n'est appele que depuis la branche `import.meta.dev` de db.ts).
 */
export const CLES_DEV = { greg: 'DEVG-REGX-2345', audrey: 'DEVA-DREY-2345' }

// Deux gouts differents, avec un recouvrement volontaire : sans desaccord on
// ne verrait jamais l'ecran « rien en commun », sans accord jamais les duels.
const GOUTS_GREG = {
  oui: ['Louise', 'Jeanne', 'Alma', 'Nine', 'Iris', 'Suzanne', 'Colette', 'Hector',
        'Basile', 'Marius', 'Anouk', 'Lucien'],
  neutre: ['Camille', 'Sacha', 'Noé', 'Léon', 'Rose', 'Victor'],
  non: ['Kevin', 'Jason', 'Brandon', 'Dylan', 'Kelly', 'Océane', 'Enzo']
}
const GOUTS_AUDREY = {
  oui: ['Louise', 'Jeanne', 'Iris', 'Adèle', 'Margot', 'Gaspard', 'Basile', 'Anouk'],
  neutre: ['Alma', 'Nine', 'Colette', 'Victor', 'Suzanne'],
  non: ['Kevin', 'Marius', 'Hector', 'Brandon', 'Dylan', 'Jayden']
}
// Ecartes « d'un geste » : c'est ce qui remplit le bloc des familles dans
// Parametres, et ce qui permet de verifier qu'un non individuel y survit.
const BALAYAGE = { racine: 'kevi', prenoms: ['Kevin', 'Kevyn', 'Kevan'] }

export async function semerSiVide(c: Connexion) {
  const dejaLa = await c.query(`select count(*)::int as n from utilisateurs`)
  if ((dejaLa.rows[0]?.n ?? 0) > 0) return

  const [greg, audrey] = await Promise.all([
    creerCompte(c, 'Greg', CLES_DEV.greg),
    creerCompte(c, 'Audrey', CLES_DEV.audrey)
  ])

  const g = await c.query(
    `insert into groupes (nom, code_invitation, cree_par, quota_swipe_jour, nb_vetos_max)
     values ('Notre liste', 'dec0de00', $1, 40, 3) returning id`, [greg])
  const gid = g.rows[0].id

  for (const [uid, role] of [[greg, 'parent'], [audrey, 'parent']] as const) {
    await c.query(
      `insert into membres (groupe_id, user_id, role) values ($1, $2, $3)`, [gid, uid, role])
  }

  await voter(c, gid, greg, GOUTS_GREG)
  await voter(c, gid, audrey, GOUTS_AUDREY)

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

  await c.query(
    `insert into vetos (groupe_id, user_id, prenom, motif) values ($1,$2,'Jayden','mon ex')
     on conflict do nothing`, [gid, audrey]).catch(() => null)

  // Quelques duels : sans eux le classement general reste vide. Le declencheur
  // trg_elo fait le reste — au passage, ca verifie que le plpgsql tourne bien
  // sur la base embarquee comme sur Neon.
  const DUELS = [
    ['Louise', 'Jeanne', 'Louise'], ['Jeanne', 'Iris', 'Jeanne'],
    ['Louise', 'Iris', 'Louise'], ['Basile', 'Anouk', 'Anouk'],
    ['Alma', 'Nine', 'Alma'], ['Suzanne', 'Colette', 'Colette']
  ] as const
  for (const uid of [greg, audrey]) {
    for (const [a, b, gagnant] of DUELS) {
      await c.query(
        `insert into duels (groupe_id, user_id, prenom_a, prenom_b, gagnant)
         values ($1,$2,$3,$4,$5)`, [gid, uid, a, b, gagnant]).catch(() => null)
    }
  }

  await c.query(
    `insert into commentaires (groupe_id, user_id, prenom, texte)
     values ($1, $2, 'Louise', 'Un peu partout en ce moment, non ?')`,
    [gid, audrey]).catch(() => null)

  console.log(
    '\n  Base de developpement semee (Postgres embarque, dossier .data/).\n' +
    `  Liste « Notre liste », code d'invitation dec0de00.\n` +
    `  Cle de Greg   : ${CLES_DEV.greg}\n` +
    `  Cle d'Audrey  : ${CLES_DEV.audrey}\n` +
    '  Ouvrez-en une dans une fenetre privee pour voir le vote aveugle a deux.\n' +
    '  Pour repartir de zero : supprimez le dossier .data/\n')
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
