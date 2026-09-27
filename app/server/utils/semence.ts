import { hacherCle, normaliserCle } from './acces'
import type { Outils, Instruction } from './db'

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
 *
 * La base locale est une base D1 simulee par wrangler, dans .data/wrangler.
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
export const VERSION_SEMENCE = 4

/** Les comptes du jeu d'essai, tels que les outils de dev les montrent. */
export const COMPTES_DEV = [
  { pseudo: 'Greg', cle: CLES_DEV.greg, role: 'parent, sur toutes les listes' },
  { pseudo: 'Audrey', cle: CLES_DEV.audrey, role: 'parent, sur « Notre liste » — e-mail audrey@exemple.test (lien de connexion)' },
  { pseudo: 'Mamie', cle: CLES_DEV.mamie, role: 'observatrice de « Notre liste »' }
]

export const MARQUEUR = `create table if not exists _semence (
    version integer not null, semee_le text not null default (${MAINTENANT}))`

/** Version et date de la semaille. Version 0 : semee avant qu'on les grave. */
export async function etatSemence(b: Outils): Promise<{ version: number; semee_le: string | null; a_jour: boolean }> {
  await b.ecrire(MARQUEUR)
  const r = await b.q1(`select version, semee_le from _semence order by semee_le desc limit 1`)
  const version = Number(r?.version ?? 0)
  return { version, semee_le: r?.semee_le ?? null, a_jour: version >= VERSION_SEMENCE }
}

/** Au demarrage, une base deja semee ne disait rien : pas de cle, pas d'etat. */
export async function annoncerBaseLocale(b: Outils) {
  const e = await etatSemence(b)
  const date = e.semee_le ? new Date(e.semee_le).toLocaleDateString('fr-FR') : 'date inconnue'
  console.log(
    `\n  Base locale : .data/wrangler (D1 simulee par wrangler) — jeu d'essai v${e.version}, seme le ${date}.\n` +
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
/** Les autres graphies de Jayden dans le catalogue (même prononciation). */
const GRAPHIES_JAYDEN = ['Jaïden', 'Jaydenn', 'Jahyden', 'Jaiden', 'Jhayden', 'Jaydhen', 'Jaïdenn', 'Jaÿden']

/** Seme une base vide. Renvoie vrai si elle l'etait. */
export async function semerSiVide(b: Outils): Promise<boolean> {
  const dejaLa = await b.q1<{ n: number }>(`select count(*) as n from utilisateurs`)
  if ((dejaLa?.n ?? 0) > 0) return false

  const greg = await creerCompte(b, 'Greg', CLES_DEV.greg)
  const audrey = await creerCompte(b, 'Audrey', CLES_DEV.audrey)
  const mamie = await creerCompte(b, 'Mamie', CLES_DEV.mamie)

  // « Notre liste » est marquee payee : c'est elle que tous les essais
  // utilisent, et on ne veut pas qu'ils butent sur le quota au 21e swipe.
  // Elle est creee la PREMIERE : les essais comptent sur son id, 1.
  const gid = await creerListe(b,
    `insert into groupes (nom, code_invitation, cree_par, quota_swipe_jour, nb_vetos_max, paye_le, paye_par)
     values ('Notre liste', 'dec0de00', ?1, 20, ?2, ${MAINTENANT}, ?1) returning id`, [greg, BLOCAGES_SECRETS])

  // Une seconde liste, gratuite et au quota minuscule, pour pouvoir taper
  // dans le mur en quelques swipes plutot qu'en cent soixante-cinq : 3 de
  // depart, puis 2 par jour. Son depart de LISTE est de 4 : apres les 3 de
  // Greg, un nouveau membre n'en trouve plus qu'un — c'est ce qui prouve
  // qu'un compte jetable ne rapporte pas un depart entier.
  const g2 = await creerListe(b,
    `insert into groupes (nom, code_invitation, cree_par, quota_swipe_jour, nb_vetos_max,
                          quota_depart, quota_depart_liste, quota_par_jour)
     values ('Essai gratuit', 'dec0de01', ?1, 3, ?2, 3, 4, 2) returning id`, [greg, BLOCAGES_SECRETS])
  // Une troisieme, gratuite elle aussi : elle sert a verifier qu'on ne gagne
  // pas un depart de plus en creant une liste de plus.
  const g3 = await creerListe(b,
    `insert into groupes (nom, code_invitation, cree_par, quota_swipe_jour, nb_vetos_max,
                          quota_depart, quota_depart_liste, quota_par_jour)
     values ('Autre essai', 'dec0de02', ?1, 3, ?2, 3, 4, 2) returning id`, [greg, BLOCAGES_SECRETS])

  const l: Instruction[] = [
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'parent')`, [g3, greg]],
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'parent')`, [g2, greg]],
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'parent')`, [gid, greg]],
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'parent')`, [gid, audrey]],
    // Le code des observateurs existe des le depart : sinon aucun ecran ne le
    // montre avant qu'on ait clique dessus, et on ne verrait pas qu'il marche.
    [`update groupes set code_observateur = 'ob5e0bad' where id = ?1`, [gid]],
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'observateur')`, [gid, mamie]],
    voter(gid, greg, GOUTS_GREG),
    voter(gid, audrey, GOUTS_AUDREY),
    voter(gid, mamie, GOUTS_MAMIE),
    // Un balayage de famille cote Greg, en plus de ses non individuels.
    [`insert into votes (groupe_id, user_id, prenom, valeur, balayage)
      select ?1, ?2, value, 0, ?3 from json_each(?4) where true
      on conflict (groupe_id, user_id, prenom) do nothing`,
      [gid, greg, BALAYAGE.racine, BALAYAGE.prenoms]],
    [`insert into favoris (groupe_id, user_id, prenom) values (?1, ?2, 'Alma'), (?1, ?2, 'Nine')
      on conflict do nothing`, [gid, greg]],
    // Un veto de chaque cote : celui de Greg doit apparaitre dans SES choix,
    // celui d'Audrey ne doit apparaitre nulle part pour lui. Celui d'Audrey
    // emporte ses graphies (Jaïden, Jaiden… : ce que fait l'app depuis la
    // migration 0002, la liste vient du catalogue) ; celui de Greg est un
    // veto d'avant, sans tete — il doit continuer de marcher.
    [`insert into vetos (groupe_id, user_id, prenom, motif, tete) values (?1, ?2, 'Jayden', 'mon ex', 'Jayden')
      on conflict do nothing`, [gid, audrey]],
    [`insert or ignore into vetos (groupe_id, user_id, prenom, tete)
      select ?1, ?2, value, 'Jayden' from json_each(?3)`, [gid, audrey, JSON.stringify(GRAPHIES_JAYDEN)]],
    [`insert into vetos (groupe_id, user_id, prenom, motif) values (?1, ?2, 'Brandon', 'non')
      on conflict do nothing`, [gid, greg]],
    // Un prenom « deja pris », pose par Audrey avec sa note : Greg doit le
    // voir, avec qui et pourquoi, et pouvoir l'en retirer ; Mamie le voit
    // sans pouvoir y toucher.
    [`insert into deja_pris (groupe_id, prenom, tete, user_id, motif)
      values (?1, 'Mathilde', 'Mathilde', ?2, 'ma sœur')`, [gid, audrey]],
    [`insert or ignore into deja_pris (groupe_id, prenom, tete, user_id)
      select ?1, value, 'Mathilde', ?2 from json_each(?3)`, [gid, audrey, JSON.stringify(['Matilde', 'Mathylde'])]],
    [`insert into commentaires (groupe_id, user_id, prenom, texte)
      values (?1, ?2, 'Louise', 'Un peu partout en ce moment, non ?')`, [gid, audrey]],
    // Audrey a une adresse verifiee : de quoi essayer le lien de connexion en
    // local (la boite de developpement recoit l'e-mail, voir « Mon compte »).
    [`update utilisateurs set email = 'audrey@exemple.test', email_verifie_le = ${MAINTENANT}
       where id = ?1`, [audrey]]
  ]
  await b.lot(l)

  // Un compte oublie depuis plus de deux ans : c'est ce que la purge RGPD doit
  // effacer (essai-rgpd.mjs), avec sa liste ou il etait seul. Il porte aussi
  // un lien de connexion expire, que la purge nettoie.
  const fantome = await creerCompte(b, 'Fantome', 'DEVF-ANTM-2345')
  const gf = await creerListe(b,
    `insert into groupes (nom, code_invitation, cree_par, cree_le)
     values ('Liste oubliee', 'dec0de0f', ?1, ${decale('-26 months')}) returning id`, [fantome])
  await b.lot([
    [`update utilisateurs set cree_le = ${decale('-26 months')},
             vu_le = ${decale('-25 months')}, email = 'fantome@exemple.invalid'
       where id = ?1`, [fantome]],
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'parent')`, [gf, fantome]],
    [`insert into votes (groupe_id, user_id, prenom, valeur) values (?1, ?2, 'Louise', 2)`, [gf, fantome]],
    [`insert into liens_connexion (id, email, user_id, but, code_hash, expire_le, cree_le)
      values ('lien-expire-de-fantome', 'fantome@exemple.invalid', ?1, 'connexion', 'x',
              ${decale('-3 days')}, ${decale('-3 days')})`, [fantome]],
    // Un lien expire d'un compte ACTIF : c'est lui que la purge des liens doit
    // retirer (celui de Fantome part avec son compte, par cascade).
    [`insert into liens_connexion (id, email, user_id, but, code_hash, expire_le, cree_le)
      values ('lien-expire-d-audrey', 'audrey@exemple.test', ?1, 'connexion', 'x',
              ${decale('-3 days')}, ${decale('-3 days')})`, [audrey]],
    // Un compteur de gestes de plus de deux mois cote Greg : la purge le retire,
    // et le quota du jour ne le voit pas.
    [`insert into quota_jour (groupe_id, user_id, jour, n) values (?1, ?2, date('now', '-70 days'), 3)`,
      [g3, greg]],
    [MARQUEUR],
    [`delete from _semence`],
    [`insert into _semence (version) values (?1)`, [VERSION_SEMENCE]]
  ])

  console.log(
    '\n  Base de developpement semee (D1 simulee par wrangler, dossier .data/wrangler).\n' +
    `  Liste « Notre liste », code d'invitation dec0de00.\n` +
    `  Cle de Greg   : ${CLES_DEV.greg}\n` +
    `  Cle d'Audrey  : ${CLES_DEV.audrey}\n` +
    `  Cle de Mamie  : ${CLES_DEV.mamie} (observatrice, code ob5e0bad)\n` +
    '  Ouvrez-en une dans une fenetre privee pour voir le vote aveugle a deux.\n' +
    '  Pour repartir de zero : Mon compte -> Outils de developpement -> Base neuve.\n')
  return true
}

async function creerCompte(b: Outils, pseudo: string, cle: string): Promise<string> {
  const r = await b.q1<{ id: string }>(
    `insert into utilisateurs (pseudo, cle_acces_hash) values (?1, ?2) returning id`,
    [pseudo, hacherCle(normaliserCle(cle))])
  return r!.id
}

async function creerListe(b: Outils, sql: string, params: any[]): Promise<number> {
  return Number((await b.q1<{ id: number }>(sql, params))!.id)
}

/** Les votes d'un membre, en une instruction : oui, neutre, non. */
function voter(gid: number, uid: string, gouts: { oui: string[]; neutre: string[]; non: string[] }): Instruction {
  const lignes = [...gouts.oui.map(p => [p, 2]), ...gouts.neutre.map(p => [p, 1]), ...gouts.non.map(p => [p, 0])]
  return [`insert into votes (groupe_id, user_id, prenom, valeur)
           select ?1, ?2, json_extract(value, '$[0]'), json_extract(value, '$[1]') from json_each(?3) where true
           on conflict (groupe_id, user_id, prenom) do nothing`, [gid, uid, lignes]]
}
