-- ============================================================================
--  Les votes : un bulletin par personne et par liste
--
--  Une ligne par vote coûtait cher sur D1, qui compte les lignes. Un swipe en
--  écrivait trois (la table et deux index), plus quatre par graphie du même
--  prénom, plus deux ou trois pour le quota : onze en moyenne, une vingtaine
--  sur un prénom courant — sur 100 000 lignes écrites par jour pour l'offre
--  gratuite. Et la page des accords relisait les votes de la liste pour
--  chaque accord : près d'un million de lignes lues par appel sur une liste
--  bien remplie, sur 5 millions par jour.
--
--  Désormais, UNE ligne par membre et par liste, ses votes en JSON, rangés en
--  deux objets : `positifs` (oui et neutres — les seuls qui font un accord,
--  lus sans les non) et `negatifs` (non). Une entrée :
--
--    "Chloé": [valeur, instant]  ou  [valeur, instant, balayage]
--
--  valeur 0 (non), 1 (neutre), 2 (oui) ; instant en secondes Unix ; balayage
--  la racine d'un non donné à toute une famille d'un geste, ou « ph:Tête »
--  pour une graphie qui a suivi le prénom jugé. Un swipe : UNE ligne écrite.
--
--  Le quota vit dans la même ligne : `depart` (gestes du lot de départ dans
--  cette liste), `jour` et `n_jour` (le filet du jour de Paris). Plus rien à
--  écrire dans utilisateurs, groupes ni quota_jour à chaque geste. Les
--  colonnes gestes_depart d'utilisateurs et de groupes deviennent des
--  ARCHIVES : ce qu'avaient consommé les bulletins disparus (le déclencheur
--  ci-dessous). Consommé = archive + somme des bulletins.
--
--  Les index de votes partent avec elle : le bulletin se lit par sa clé.
--
--  Pas de « -- » ni de « ; » dans une chaîne (voir decouper, db.ts).
-- ============================================================================
create table if not exists bulletins (
  groupe_id integer not null,
  user_id   text    not null,
  -- nombre de prénoms jugés : clés de positifs et de negatifs
  nb        integer not null default 0,
  -- gestes du lot de départ gratuit, sur cette liste
  depart    integer not null default 0,
  -- le filet quotidien : le jour de Paris (AAAA-MM-JJ) du dernier geste
  -- compté, et combien ce jour-là. Le jour suivant le remplace.
  jour      text,
  n_jour    integer not null default 0,
  maj_le    text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- en dernier : les petites colonnes se lisent sans parcourir le JSON
  positifs  text    not null default '{}',
  negatifs  text    not null default '{}',
  primary key (groupe_id, user_id),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
) without rowid;

-- Les votes, par membre, dans l'ordre où ils ont été donnés.
insert into bulletins (groupe_id, user_id, nb, maj_le, positifs, negatifs)
select groupe_id, user_id, count(*), max(vote_le),
       json_group_object(prenom, json(entree)) filter (where valeur > 0),
       json_group_object(prenom, json(entree)) filter (where valeur = 0)
  from (select groupe_id, user_id, prenom, valeur, vote_le,
               case when balayage is null
                    then json_array(valeur, cast(strftime('%s', vote_le) as integer))
                    else json_array(valeur, cast(strftime('%s', vote_le) as integer), balayage)
               end as entree
          from votes order by groupe_id, user_id, vote_le)
 group by groupe_id, user_id;

-- Le filet : seul le dernier jour compte (le quota ne lit que le jour même).
insert or ignore into bulletins (groupe_id, user_id)
select groupe_id, user_id from quota_jour group by groupe_id, user_id;
update bulletins
   set jour = (select q.jour from quota_jour q
                where q.groupe_id = bulletins.groupe_id and q.user_id = bulletins.user_id
                order by q.jour desc limit 1),
       n_jour = (select q.n from quota_jour q
                  where q.groupe_id = bulletins.groupe_id and q.user_id = bulletins.user_id
                  order by q.jour desc limit 1)
 where exists (select 1 from quota_jour q
                where q.groupe_id = bulletins.groupe_id and q.user_id = bulletins.user_id);

-- Un bulletin qui part (compte effacé, liste effacée) laisse son départ
-- consommé aux archives : un compte jetable effacé ne rend pas son départ à
-- la liste, et une liste effacée ne rend pas le sien à la personne.
create trigger if not exists trg_bulletins_depart after delete on bulletins
when old.depart > 0
BEGIN
  update utilisateurs set gestes_depart = gestes_depart + old.depart where id = old.user_id;
  update groupes set gestes_depart = gestes_depart + old.depart where id = old.groupe_id;
END;

drop view if exists v_matchs;
drop table if exists votes;
drop table if exists quota_jour;
