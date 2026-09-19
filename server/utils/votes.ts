/**
 * SEUL endroit du code autorisé à lire les votes d'autrui.
 *
 * Règle du vote aveugle : on ne voit le vote d'un autre membre sur un prénom
 * QUE si l'on a soi-même déjà voté sur ce prénom. Avec Supabase c'était une
 * policy RLS ; ici c'est cette fonction, et elle ne doit pas être contournée.
 * Toute nouvelle route qui a besoin des votes passe par ici.
 */
export interface VoteVisible {
  prenom: string
  user_id: string
  pseudo: string
  valeur: number
}

export async function votesVisibles(
  groupeId: number, moi: string, prenoms?: string[]
): Promise<VoteVisible[]> {
  const filtre = prenoms?.length ? 'and v.prenom = any($3)' : ''
  return q<VoteVisible>(
    `select v.prenom, v.user_id, u.pseudo, v.valeur
       from votes v
       join utilisateurs u on u.id = v.user_id
      where v.groupe_id = $1
        ${filtre}
        and (
          v.user_id = $2
          or exists (select 1 from votes mien
                      where mien.groupe_id = v.groupe_id
                        and mien.prenom    = v.prenom
                        and mien.user_id   = $2)
        )
      order by v.prenom`,
    prenoms?.length ? [groupeId, moi, prenoms] : [groupeId, moi]
  )
}

/** Combien de prénoms chaque membre a-t-il jugés ? Sert à l'indicateur
 *  « il manque 12 votes de Papy » sans rien révéler du contenu des votes. */
export async function avancement(groupeId: number) {
  return q(
    `select m.user_id, u.pseudo, count(v.prenom)::int as votes
       from membres m
       join utilisateurs u on u.id = m.user_id
       left join votes v on v.groupe_id = m.groupe_id and v.user_id = m.user_id
      where m.groupe_id = $1
      group by m.user_id, u.pseudo
      order by votes desc`,
    [groupeId]
  )
}
