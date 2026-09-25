/**
 * Droit d'acces et droit a la portabilite (RGPD, art. 15 et 20).
 *
 * Tout ce que la base sait de la personne connectee, dans un fichier JSON
 * lisible par une machine ET par un humain — les valeurs sont nommees, pas
 * codees : « oui », pas 2.
 *
 * Ce qui n'y est PAS, et pourquoi (le fichier le dit aussi) :
 *  - les votes, commentaires et pseudos des AUTRES membres : ce sont leurs
 *    donnees, pas les siennes ;
 *  - l'empreinte de la cle d'acces : elle ne sert qu'a verifier la cle, et un
 *    export qui traine dans un dossier de telechargements n'a pas a la porter ;
 *  - le paiement : l'app ne connait que la date. Carte, e-mail et facture
 *    sont chez Stripe, qui repond de ses propres traitements.
 */
const VALEUR = ['non', 'neutre', 'oui'] as const

export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)

  const [compte, passkeys, listes, votes, vetos, favoris, duels, elo, classement, commentaires, quotas] =
    await Promise.all([
      q1(`select id, pseudo, email, email_verifie_le as email_verifie_le, cree_le, vu_le as derniere_activite,
                 cle_acces_hash is not null as cle_acces_active,
                 gestes_depart as prenoms_juges_du_lot_de_depart
            from utilisateurs where id = ?1`, [uid]),
      // Les passkeys : leur nom et leurs dates. Pas la cle publique — elle ne
      // dit rien de vous, et ne sert qu'a verifier une signature.
      q(`select nom, synchronisee as rangee_dans_un_trousseau, cree_le, utilisee_le
           from passkeys where user_id = ?1 order by cree_le`, [uid]),
      q(`select cast(g.id as text) as id, g.nom, g.nom_famille, g.filtres, g.cree_le,
                m.role, m.rejoint_le,
                coalesce(g.cree_par = ?1, 0) as creee_par_moi,
                (g.paye_le is not null)    as debloquee,
                g.paye_le                  as debloquee_le,
                g.offert,
                coalesce(g.paye_par = ?1, 0) as debloquee_par_moi,
                (select count(*) from membres x where x.groupe_id = g.id) as nb_membres
           from membres m join groupes g on g.id = m.groupe_id
          where m.user_id = ?1 order by g.id`, [uid]),
      // Par liste : chaque requete ci-dessous part des listes de la personne
      // (ses cles primaires commencent par la liste), pas de toute la table.
      q(`select v.groupe_id, v.prenom, v.valeur, v.vote_le, v.balayage
           from membres m join votes v on v.groupe_id = m.groupe_id and v.user_id = m.user_id
          where m.user_id = ?1 order by v.groupe_id, v.vote_le`, [uid]),
      q(`select t.groupe_id, t.prenom, t.motif, t.pose_le
           from membres m join vetos t on t.groupe_id = m.groupe_id and t.user_id = m.user_id
          where m.user_id = ?1 order by t.groupe_id, t.pose_le`, [uid]),
      q(`select f.groupe_id, f.prenom
           from membres m join favoris f on f.groupe_id = m.groupe_id and f.user_id = m.user_id
          where m.user_id = ?1 order by f.groupe_id, f.prenom`, [uid]),
      q(`select d.groupe_id, d.prenom_a, d.prenom_b, d.gagnant, d.joue_le
           from membres m join duels d on d.groupe_id = m.groupe_id and d.user_id = m.user_id
          where m.user_id = ?1 order by d.groupe_id, d.joue_le`, [uid]),
      q(`select e.groupe_id, e.prenom, round(e.score, 1) as score, e.n_duels
           from membres m join elo e on e.groupe_id = m.groupe_id and e.user_id = m.user_id
          where m.user_id = ?1 order by e.groupe_id, e.score desc`, [uid]),
      q(`select c.groupe_id, c.prenom, c.position
           from membres m join classement_manuel c on c.groupe_id = m.groupe_id and c.user_id = m.user_id
          where m.user_id = ?1 order by c.groupe_id, c.position`, [uid]),
      q(`select c.groupe_id, c.prenom, c.texte, c.ecrit_le
           from membres m join commentaires c on c.groupe_id = m.groupe_id and c.user_id = m.user_id
          where m.user_id = ?1 order by c.groupe_id, c.ecrit_le`, [uid]),
      q(`select groupe_id, jour, n as gestes from quota_jour
          where user_id = ?1 order by jour, groupe_id`, [uid])
    ])

  const jour = new Date().toISOString().slice(0, 10)
  setHeader(e, 'content-type', 'application/json; charset=utf-8')
  setHeader(e, 'content-disposition', `attachment; filename="babynamed-mes-donnees-${jour}.json"`)
  setHeader(e, 'cache-control', 'no-store')

  return {
    format: 'babynamed-export/1',
    genere_le: new Date().toISOString(),
    a_savoir: {
      contenu: 'Toutes les données que babyNamed conserve sur votre compte, liste par liste.',
      absent: [
        'Les votes, commentaires et pseudos des autres membres de vos listes : ce sont leurs données.',
        'L’empreinte de votre ancienne clé d’accès, s’il y en a une : elle ne sert qu’à la vérifier.',
        'La clé publique de vos passkeys : elle ne sert qu’à vérifier une signature, et ne dit rien de vous. Rien de biométrique n’a jamais quitté votre appareil.',
        'Vos données de paiement : babyNamed ne connaît que la date du déblocage. Le reste (carte, e-mail, facture) est chez Stripe.'
      ],
      valeurs_de_vote: 'non, neutre ou oui — « balayage » indique un « non » donné à toute une famille de prénoms d’un seul geste.',
      quotas: 'Nombre de prénoms jugés par jour sur les listes gratuites, une fois le lot de départ épuisé. Effacé automatiquement au bout de 62 jours.'
    },
    compte,
    passkeys,
    listes,
    votes: votes.map((v: any) => ({ ...v, valeur: VALEUR[v.valeur] ?? v.valeur })),
    vetos,
    favoris,
    duels,
    elo,
    classement_manuel: classement,
    commentaires,
    quotas
  }
})
