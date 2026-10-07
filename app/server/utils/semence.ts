import type { Outils, Instruction } from './db'

/**
 * Jeu d'essai du developpement.
 *
 * Une base vide ne montre rien : pas de liste, pas de communs, pas de
 * desaccords, rien a revoir. On seme donc deux comptes et une liste deja
 * bien entamee, pour que chaque ecran ait quelque chose a afficher des le
 * premier `npm run dev`.
 *
 * On y entre par son prenom, d'un geste : le bloc « Base locale » de la page
 * de connexion (/api/dev/entrer). Ce n'est pas une porte derobee — la route
 * repond 404 en production, et ce fichier n'est appele que depuis la
 * branche `import.meta.dev` de db.ts : il n'existe que sur une base locale,
 * jetable.
 *
 * La base locale est une base D1 simulee par wrangler, dans .data/wrangler.
 */

/** Le code cadeau du jeu d'essai (voir semerSiVide). */
export const CADEAU_DEV = 'BEBE2345CADE'

/**
 * La version du jeu d'essai. A monter a CHAQUE changement de ce fichier.
 *
 * On ne seme qu'une base vide : une base semee avant un changement garde
 * l'ancien jeu, sans rien dire, et on cherche en vain la liste « Essai
 * gratuit » qu'un essai decrit. La version est gravee a la semaille ; le
 * demarrage et les outils de developpement disent quand elle est depassee.
 */
export const VERSION_SEMENCE = 10

/** Les comptes du jeu d'essai, tels que les outils de dev les montrent. */
export const COMPTES_DEV = [
  { pseudo: 'Paul', role: 'parent, sur toutes les listes' },
  { pseudo: 'Alice', role: 'parent, sur « Notre liste », e-mail alice@exemple.test (lien de connexion)' },
  { pseudo: 'Mamie', role: 'observatrice de « Notre liste »' }
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

/** Au demarrage, une base deja semee ne disait rien : ni comptes, ni etat. */
export async function annoncerBaseLocale(b: Outils) {
  const e = await etatSemence(b)
  const date = e.semee_le ? new Date(e.semee_le).toLocaleDateString('fr-FR') : 'date inconnue'
  console.log(
    `\n  Base locale : .data/wrangler (D1 simulee par wrangler), jeu d'essai v${e.version}, seme le ${date}.\n` +
    `  Comptes : ${COMPTES_DEV.map(x => x.pseudo).join(', ')} — /connexion, bloc « Base locale ».\n` +
    (e.a_jour
      ? `  Outils : Mon compte -> Outils de developpement (base neuve, nouvelle journee, quotas, deblocage).\n`
      : `  /!\\ Jeu d'essai PERIME (v${e.version}, actuel v${VERSION_SEMENCE}) : des listes et des comptes d'essai manquent.\n` +
        `      Mon compte -> Outils de developpement -> Base neuve, ou arretez le serveur et lancez npm run dev:neuf.\n`))
}

// Deux gouts differents, avec un recouvrement volontaire ET des desaccords
// francs (Paul dit oui a Marius et Hector, Alice dit non) : sans eux, le
// volet « A revoir » serait vide et on ne verrait jamais s'il marche.
const GOUTS_PAUL = {
  oui: ['Louise', 'Jeanne', 'Alma', 'Nine', 'Iris', 'Suzanne', 'Colette', 'Hector',
        'Basile', 'Marius', 'Anouk', 'Lucien'],
  neutre: ['Camille', 'Sacha', 'Noé', 'Léon', 'Rose', 'Victor'],
  non: ['Kevin', 'Jason', 'Brandon', 'Dylan', 'Kelly', 'Océane', 'Enzo']
}
const GOUTS_ALICE = {
  oui: ['Louise', 'Jeanne', 'Iris', 'Adèle', 'Margot', 'Gaspard', 'Basile', 'Anouk'],
  neutre: ['Alma', 'Nine', 'Colette', 'Victor', 'Suzanne'],
  // Ferdinand : refuse par Alice et JAMAIS juge par Paul. C'est le seul cas
  // qui permet de verifier que l'app ne dit pas « Alice : non » quand Paul
  // vient de dire oui — tous les autres refus d'Alice portent sur des
  // prenoms que Paul a deja tranches.
  non: ['Kevin', 'Marius', 'Hector', 'Brandon', 'Dylan', 'Jayden', 'Ferdinand']
}
/**
 * Mamie observe.
 *
 * Elle dit NON a Louise, sur laquelle Paul et Alice sont d'accord. C'est le
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

  const paul = await creerCompte(b, 'Paul')
  const alice = await creerCompte(b, 'Alice')
  const mamie = await creerCompte(b, 'Mamie')

  // « Notre liste » est marquee payee : c'est elle que tous les essais
  // utilisent, et on ne veut pas qu'ils butent sur le quota au 21e swipe.
  // Elle est creee la PREMIERE : les essais comptent sur son id, 1.
  const gid = await creerListe(b,
    `insert into groupes (nom, code_invitation, cree_par, quota_swipe_jour, nb_vetos_max, paye_le, paye_par)
     values ('Notre liste', 'dec0de00', ?1, 20, ?2, ${MAINTENANT}, ?1) returning id`, [paul, BLOCAGES_SECRETS])

  // Une seconde liste, gratuite et au quota minuscule, pour pouvoir taper
  // dans le mur en quelques swipes plutot qu'en cent soixante-cinq : 3 de
  // depart, puis 2 par jour. Son depart de LISTE est de 4 : apres les 3 de
  // Paul, un nouveau membre n'en trouve plus qu'un — c'est ce qui prouve
  // qu'un compte jetable ne rapporte pas un depart entier.
  const g2 = await creerListe(b,
    `insert into groupes (nom, code_invitation, cree_par, quota_swipe_jour, nb_vetos_max,
                          quota_depart, quota_depart_liste, quota_par_jour)
     values ('Essai gratuit', 'dec0de01', ?1, 3, ?2, 3, 4, 2) returning id`, [paul, BLOCAGES_SECRETS])
  // Une troisieme, gratuite elle aussi : elle sert a verifier qu'on ne gagne
  // pas un depart de plus en creant une liste de plus.
  const g3 = await creerListe(b,
    `insert into groupes (nom, code_invitation, cree_par, quota_swipe_jour, nb_vetos_max,
                          quota_depart, quota_depart_liste, quota_par_jour)
     values ('Autre essai', 'dec0de02', ?1, 3, ?2, 3, 4, 2) returning id`, [paul, BLOCAGES_SECRETS])

  const l: Instruction[] = [
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'parent')`, [g3, paul]],
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'parent')`, [g2, paul]],
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'parent')`, [gid, paul]],
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'parent')`, [gid, alice]],
    // Le code des observateurs existe des le depart : sinon aucun ecran ne le
    // montre avant qu'on ait clique dessus, et on ne verrait pas qu'il marche.
    // Un code valable (8 caractères hexadécimaux, l'ancien format) : le
    // précédent, « ob5e0bad », contenait un o et n'ouvrait rien.
    [`update groupes set code_observateur = 'ab5e0bad' where id = ?1`, [gid]],
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'observateur')`, [gid, mamie]],
    // Un balayage de famille cote Paul, en plus de ses non individuels.
    bulletin(gid, paul, GOUTS_PAUL, BALAYAGE),
    bulletin(gid, alice, GOUTS_ALICE),
    bulletin(gid, mamie, GOUTS_MAMIE),
    [`insert into favoris (groupe_id, user_id, prenom) values (?1, ?2, 'Alma'), (?1, ?2, 'Nine')
      on conflict do nothing`, [gid, paul]],
    // Un veto de chaque cote : celui de Paul doit apparaitre dans SES choix,
    // celui d'Alice ne doit apparaitre nulle part pour lui. Celui d'Alice
    // emporte ses graphies (Jaïden, Jaiden… : ce que fait l'app depuis la
    // migration 0002, la liste vient du catalogue) ; celui de Paul est un
    // veto d'avant, sans tete — il doit continuer de marcher.
    [`insert into vetos (groupe_id, user_id, prenom, motif, tete) values (?1, ?2, 'Jayden', 'mon ex', 'Jayden')
      on conflict do nothing`, [gid, alice]],
    [`insert or ignore into vetos (groupe_id, user_id, prenom, tete)
      select ?1, ?2, value, 'Jayden' from json_each(?3)`, [gid, alice, JSON.stringify(GRAPHIES_JAYDEN)]],
    [`insert into vetos (groupe_id, user_id, prenom, motif) values (?1, ?2, 'Brandon', 'non')
      on conflict do nothing`, [gid, paul]],
    // Un prenom « deja pris », pose par Alice avec sa note : Paul doit le
    // voir, avec qui et pourquoi, et pouvoir l'en retirer ; Mamie le voit
    // sans pouvoir y toucher.
    [`insert into deja_pris (groupe_id, prenom, tete, user_id, motif)
      values (?1, 'Mathilde', 'Mathilde', ?2, 'ma sœur')`, [gid, alice]],
    [`insert or ignore into deja_pris (groupe_id, prenom, tete, user_id)
      select ?1, value, 'Mathilde', ?2 from json_each(?3)`, [gid, alice, JSON.stringify(['Matilde', 'Mathylde'])]],
    [`insert into commentaires (groupe_id, user_id, prenom, texte)
      values (?1, ?2, 'Louise', 'Un peu partout en ce moment, non ?')`, [gid, alice]],
    // Un code cadeau payé (pour de faux), pas encore utilisé : /?cadeau=…
    // s'essaie tout de suite. Le code est écrit ici en clair, exprès : il
    // n'existe que dans la base locale.
    [`insert into cadeaux (code_hash, session_ref, paiement_ref, de_la_part, message, expire_le)
      values (?1, 'cs_local_semence', null, 'Mamie', 'Pour choisir ensemble, sans vous fâcher.',
              ${decale('+24 months')})`, [empreinteCadeau(CADEAU_DEV)]],
    // Alice a une adresse verifiee : de quoi essayer le lien de connexion en
    // local (la boite de developpement recoit l'e-mail, voir « Mon compte »).
    [`update utilisateurs set email = 'alice@exemple.test', email_verifie_le = ${MAINTENANT}
       where id = ?1`, [alice]]
  ]
  await b.lot(l)

  // Un compte oublie depuis plus de deux ans : c'est ce que la purge RGPD doit
  // effacer (essai-rgpd.mjs), avec sa liste ou il etait seul. Il porte aussi
  // un lien de connexion expire, que la purge nettoie.
  const fantome = await creerCompte(b, 'Fantome')
  const gf = await creerListe(b,
    `insert into groupes (nom, code_invitation, cree_par, cree_le)
     values ('Liste oubliee', 'dec0de0f', ?1, ${decale('-26 months')}) returning id`, [fantome])
  await b.lot([
    [`update utilisateurs set cree_le = ${decale('-26 months')},
             vu_le = ${decale('-25 months')}, email = 'fantome@exemple.invalid'
       where id = ?1`, [fantome]],
    [`insert into membres (groupe_id, user_id, role) values (?1, ?2, 'parent')`, [gf, fantome]],
    bulletin(gf, fantome, { oui: ['Louise'], neutre: [], non: [] }),
    [`insert into liens_connexion (id, email, user_id, but, code_hash, expire_le, cree_le)
      values ('lien-expire-de-fantome', 'fantome@exemple.invalid', ?1, 'connexion', 'x',
              ${decale('-3 days')}, ${decale('-3 days')})`, [fantome]],
    // Un lien expire d'un compte ACTIF : c'est lui que la purge des liens doit
    // retirer (celui de Fantome part avec son compte, par cascade).
    [`insert into liens_connexion (id, email, user_id, but, code_hash, expire_le, cree_le)
      values ('lien-expire-d-alice', 'alice@exemple.test', ?1, 'connexion', 'x',
              ${decale('-3 days')}, ${decale('-3 days')})`, [alice]],
    // Un compteur du filet vieux de plus de deux mois cote Paul : la purge
    // l'efface, et le quota du jour ne le voit pas.
    [`insert into bulletins (groupe_id, user_id, jour, n_jour) values (?1, ?2, date('now', '-70 days'), 3)`,
      [g3, paul]],
    // Les achats de l'app iOS (migration 0012), pour la purge. Trois restes
    // qu'elle doit effacer : une feuille d'achat refermée il y a quatre mois ;
    // un achat dont il ne reste ni l'acheteur ni la liste ; celui de Fantome,
    // qui devient pareil quand son compte et sa liste partent. Et un qu'elle
    // doit garder : une feuille refermée le mois dernier (un achat « en
    // attente d'accord » peut encore arriver, et c'est son jeton qui dira
    // quelle liste débloquer), et un vieil achat d'Alice, remboursé depuis,
    // qui tient encore à elle et à sa liste — c'est son historique.
    [`insert into achats_apple (jeton, user_id, groupe_id, cree_le)
      values ('5e3e0000-0000-4000-8000-000000000001', ?1, ?2, ${decale('-4 months')}),
             ('5e3e0000-0000-4000-8000-000000000002', ?1, ?2, ${decale('-1 month')})`, [paul, g3]],
    [`insert into achats_apple (jeton, user_id, groupe_id, transaction_id, environnement, produit, cree_le, achete_le, applique_le)
      values ('5e3e0000-0000-4000-8000-000000000003', null, null, '2000000000000001', 'Production',
              'fr.babynamed.app.deblocage', ${decale('-5 months')}, ${decale('-5 months')}, ${decale('-5 months')}),
             ('5e3e0000-0000-4000-8000-000000000004', ?1, ?2, '2000000000000002', 'Production',
              'fr.babynamed.app.deblocage', ${decale('-25 months')}, ${decale('-25 months')}, ${decale('-25 months')})`,
      [fantome, gf]],
    [`insert into achats_apple (jeton, user_id, groupe_id, transaction_id, environnement, produit, cree_le, achete_le, rembourse_le)
      values ('5e3e0000-0000-4000-8000-000000000005', ?1, ?2, '2000000000000003', 'Production',
              'fr.babynamed.app.deblocage', ${decale('-6 months')}, ${decale('-6 months')}, ${decale('-6 months')})`,
      [alice, gid]],
    [MARQUEUR],
    [`delete from _semence`],
    [`insert into _semence (version) values (?1)`, [VERSION_SEMENCE]]
  ])

  console.log(
    '\n  Base de developpement semee (D1 simulee par wrangler, dossier .data/wrangler).\n' +
    `  Liste « Notre liste », code d'invitation dec0de00.\n` +
    `  Comptes : Paul, Alice, Mamie (observatrice, code ab5e0bad) — /connexion, bloc « Base locale ».\n` +
    `  Code cadeau : ${cadeauLisible(CADEAU_DEV)} (/?cadeau=${CADEAU_DEV})\n` +
    '  Ouvrez Alice dans une fenetre privee pour voir le vote aveugle a deux.\n' +
    '  Pour repartir de zero : Mon compte -> Outils de developpement -> Base neuve.\n')
  return true
}

/** Un compte d'un prenom, sans adresse ni passkey : il ne s'ouvre que par
 *  /api/dev/entrer. */
async function creerCompte(b: Outils, pseudo: string): Promise<string> {
  const r = await b.q1<{ id: string }>(
    `insert into utilisateurs (pseudo) values (?1) returning id`, [pseudo])
  return r!.id
}

async function creerListe(b: Outils, sql: string, params: any[]): Promise<number> {
  return Number((await b.q1<{ id: number }>(sql, params))!.id)
}

/**
 * Le bulletin d'un membre (migration 0005) : tous ses votes, en une ligne.
 * Le premier verdict donne a un prenom l'emporte — comme l'ancien
 * « on conflict do nothing » : le non individuel de Paul a Kevin survit au
 * balayage de la famille.
 */
function bulletin(gid: number, uid: string, gouts: { oui: string[]; neutre: string[]; non: string[] },
  balayage?: { racine: string; prenoms: string[] }): Instruction {
  const instant = Math.floor(Date.now() / 1000)
  const positifs: Record<string, (number | string)[]> = {}
  const negatifs: Record<string, (number | string)[]> = {}
  const poser = (p: string, v: number, racine?: string) => {
    if (Object.hasOwn(positifs, p) || Object.hasOwn(negatifs, p)) return
    ;(v > 0 ? positifs : negatifs)[p] = racine ? [v, instant, racine] : [v, instant]
  }
  for (const p of gouts.oui) poser(p, 2)
  for (const p of gouts.neutre) poser(p, 1)
  for (const p of gouts.non) poser(p, 0)
  for (const p of balayage?.prenoms ?? []) poser(p, 0, balayage!.racine)
  // nb : les prénoms jugés pour eux-mêmes, pas les graphies (migration 0006)
  const juges = [...Object.values(positifs), ...Object.values(negatifs)]
    .filter(e => !String(e[2] ?? '').startsWith('ph:')).length
  return [`insert into bulletins (groupe_id, user_id, nb, positifs, negatifs) values (?1, ?2, ?3, ?4, ?5)`,
    [gid, uid, juges, positifs, negatifs]]
}
