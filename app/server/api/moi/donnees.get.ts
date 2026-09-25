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

  const [compte, listes, votes, vetos, favoris, duels, elo, classement, commentaires, quotas] =
    await Promise.all([
      q1(`select id, pseudo, cree_le, vu_le as derniere_activite,
                 cle_acces_hash is not null as cle_acces_active
            from utilisateurs where id = $1`, [uid]),
      q(`select g.id, g.nom, g.nom_famille, g.filtres, g.cree_le,
                m.role, m.rejoint_le,
                coalesce(g.cree_par = $1, false) as creee_par_moi,
                (g.paye_le is not null)    as debloquee,
                g.paye_le                  as debloquee_le,
                g.offert,
                coalesce(g.paye_par = $1, false) as debloquee_par_moi,
                (select count(*)::int from membres x where x.groupe_id = g.id) as nb_membres
           from membres m join groupes g on g.id = m.groupe_id
          where m.user_id = $1 order by g.id`, [uid]),
      q(`select groupe_id, prenom, valeur, vote_le, balayage
           from votes where user_id = $1 order by groupe_id, vote_le`, [uid]),
      q(`select groupe_id, prenom, motif, pose_le from vetos
          where user_id = $1 order by groupe_id, pose_le`, [uid]),
      q(`select groupe_id, prenom from favoris where user_id = $1 order by groupe_id, prenom`, [uid]),
      q(`select groupe_id, prenom_a, prenom_b, gagnant, joue_le from duels
          where user_id = $1 order by groupe_id, joue_le`, [uid]),
      q(`select groupe_id, prenom, round(score::numeric, 1) as score, n_duels from elo
          where user_id = $1 order by groupe_id, score desc`, [uid]),
      q(`select groupe_id, prenom, position from classement_manuel
          where user_id = $1 order by groupe_id, position`, [uid]),
      q(`select groupe_id, prenom, texte, ecrit_le from commentaires
          where user_id = $1 order by groupe_id, ecrit_le`, [uid]),
      q(`select groupe_id, jour, n as gestes from quota_jour
          where user_id = $1 order by jour, groupe_id`, [uid])
    ])

  const jour = new Date().toISOString().slice(0, 10)
  setHeader(e, 'content-type', 'application/json; charset=utf-8')
  setHeader(e, 'content-disposition', `attachment; filename="babynames-mes-donnees-${jour}.json"`)
  setHeader(e, 'cache-control', 'no-store')

  return {
    format: 'babynames-export/1',
    genere_le: new Date().toISOString(),
    a_savoir: {
      contenu: 'Toutes les données que babyNames conserve sur votre compte, liste par liste.',
      absent: [
        'Les votes, commentaires et pseudos des autres membres de vos listes : ce sont leurs données.',
        'L’empreinte de votre clé d’accès : elle ne sert qu’à la vérifier.',
        'Vos données de paiement : babyNames ne connaît que la date du déblocage. Le reste (carte, e-mail, facture) est chez Stripe.'
      ],
      valeurs_de_vote: 'non, neutre ou oui — « balayage » indique un « non » donné à toute une famille de prénoms d’un seul geste.',
      quotas: 'Nombre de prénoms jugés par jour sur les listes gratuites. Effacé automatiquement au bout de 62 jours.'
    },
    compte,
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
