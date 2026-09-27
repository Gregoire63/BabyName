-- ============================================================================
--  Retirer un prénom du jeu : « déjà pris » (partagé) ou en secret (compté)
--
--  Deux raisons, deux gestes :
--
--  - vetos (existant) : SECRET et COMPTÉ (nb_vetos_max par personne). Pour ce
--    qu'on ne veut pas expliquer : un ex, quelqu'un qu'on préfère ne pas nommer.
--  - deja_pris (nouveau) : PARTAGÉ et sans quota. Le prénom de la cousine, du
--    fils des amis, du collègue qu'on ne supporte pas : toute la liste le voit,
--    avec qui l'a ajouté et sa note, et chaque décideur peut l'en retirer.
--
--  Dans les deux cas, un prénom emporte ses GRAPHIES (même prononciation :
--  Chloé, Cloé, Chloe, Khloé…). Sans elles, bloquer Chloé faisait arriver Cloé
--  à la carte suivante, et chaque graphie coûtait un blocage de plus. Une
--  ligne par graphie ; `tete` nomme celle qu'on a choisie : c'est elle qu'on
--  compte, qu'on affiche et qu'on retire.
-- ============================================================================

-- Les vetos déjà posés n'ont pas de tête : chacun est la sienne.
alter table vetos add column tete text;

-- Le quota compte des TÊTES, pas des lignes : Chloé et ses six graphies,
-- c'est un blocage. Seule la tête est vérifiée : ses graphies suivent.
drop trigger if exists trg_quota_veto;
create trigger if not exists trg_quota_veto before insert on vetos
when new.tete is null or new.tete = new.prenom
BEGIN
  select raise(abort, 'quota_veto_atteint')
   where (select count(distinct coalesce(tete, prenom)) from vetos
           where groupe_id = new.groupe_id and user_id = new.user_id
             and coalesce(tete, prenom) <> coalesce(new.tete, new.prenom))
         >= (select nb_vetos_max from groupes where id = new.groupe_id);
END;

-- Deux blocages secrets ne suffisaient pas : faute d'autre moyen, ils
-- servaient aussi pour la famille. « Déjà pris » s'en charge désormais ; le
-- secret ne garde que ce qui ne s'explique pas, et passe à cinq. La valeur
-- par défaut de la colonne (migration 0001) n'est plus lue : la création
-- d'une liste pose la valeur explicitement (BLOCAGES_SECRETS).
update groupes set nb_vetos_max = 5 where nb_vetos_max < 5;

create table if not exists deja_pris (
  groupe_id integer not null references groupes(id) on delete cascade,
  prenom    text    not null,
  tete      text    not null,
  -- Qui l'a ajouté. La ligne appartient à la LISTE, pas à son auteur : son
  -- compte effacé, elle reste, sans auteur ni note (trigger ci-dessous). Le
  -- neveu s'appelle toujours Mathéo.
  user_id   text    references utilisateurs(id) on delete set null,
  motif     text,
  pose_le   text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (groupe_id, prenom)
) without rowid;
create index if not exists idx_deja_pris_tete on deja_pris (groupe_id, tete);
-- l'effacement d'un compte cherche ses lignes par auteur
create index if not exists idx_deja_pris_user on deja_pris (user_id);

-- La note est le texte de son auteur : elle part avec lui.
create trigger if not exists trg_deja_pris_sans_auteur after update of user_id on deja_pris
when new.user_id is null
BEGIN
  update deja_pris set motif = null
   where groupe_id = new.groupe_id and prenom = new.prenom and motif is not null;
END;

-- Sans quota ne veut pas dire sans borne : deux cents prénoms, c'est toute une
-- famille élargie et bien plus. La borne protège la base, pas l'usage. Seule
-- la tête est comptée : trente graphies ne relisent pas trente fois la liste.
create trigger if not exists trg_deja_pris_plein before insert on deja_pris
when new.tete = new.prenom
BEGIN
  select raise(abort, 'deja_pris_plein')
   where (select count(distinct tete) from deja_pris
           where groupe_id = new.groupe_id and tete <> new.tete) >= 200;
END;

-- ============================================================================
--  Onglet « communs » : tous les décideurs ont voté, personne n'a dit non,
--  au moins un oui. Un veto ou un « déjà pris » retire le prénom.
-- ============================================================================
drop view if exists v_matchs;
create view if not exists v_matchs as
select v.groupe_id, v.prenom,
       count(*)                              as nb_votes,
       sum(v.valeur * m.poids)               as score,
       min(v.valeur)                         as pire_vote,
       count(*) filter (where v.valeur = 2)  as nb_oui,
       count(*) filter (where v.valeur = 1)  as nb_neutres
  from votes v
  join membres m on m.groupe_id = v.groupe_id and m.user_id = v.user_id
 where not exists (select 1 from vetos t where t.groupe_id = v.groupe_id and t.prenom = v.prenom)
   and not exists (select 1 from deja_pris d where d.groupe_id = v.groupe_id and d.prenom = v.prenom)
   and m.role <> 'observateur'
 group by v.groupe_id, v.prenom
having count(*) = (select count(*) from membres mm
                    where mm.groupe_id = v.groupe_id and mm.role <> 'observateur')
   and min(v.valeur) > 0
   and count(*) filter (where v.valeur = 2) >= 1;
