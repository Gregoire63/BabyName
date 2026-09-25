-- ============================================================================
--  Choix de prénom — schéma Postgres (Neon)
--
--  DIFFÉRENCE MAJEURE AVEC LA VERSION SUPABASE : il n'y a pas de RLS adossé
--  à un JWT. Le vote aveugle n'est donc PAS garanti par la base mais par
--  l'API (server/api/**). Le client n'a aucune connexion à Postgres : la
--  chaîne de connexion ne quitte jamais le serveur. Toute lecture de votes
--  passe par server/utils/votes.ts, seul endroit autorisé à les lire.
--
--  Le catalogue des 7 667 prénoms n'est PAS ici : il est embarqué dans
--  l'app (public/data/catalogue.json, 96 Ko gzip). Seul l'état social est
--  en base.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- comptes
create table if not exists utilisateurs (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,                  -- vestige : plus utilise
  pseudo     text not null,
  cree_le    timestamptz not null default now(),
  vu_le      timestamptz not null default now()
);

-- jetons de lien magique : usage unique, courte durée
create table if not exists jetons_magiques (
  jeton      text primary key,              -- aléatoire, 32 octets base64url
  email      text not null,
  expire_le  timestamptz not null,
  utilise_le timestamptz,
  cree_le    timestamptz not null default now()
);
create index if not exists idx_jetons_email on jetons_magiques (email);

-- ---------------------------------------------------------------- groupes
create table if not exists groupes (
  id                bigserial primary key,
  nom               text not null,
  code_invitation   text not null unique,
  cree_par          uuid not null references utilisateurs(id) on delete cascade,
  cree_le           timestamptz not null default now(),
  nb_vetos_max      smallint not null default 2,
  favoris_visibles  boolean  not null default false,
  quota_swipe_jour  smallint not null default 40,
  filtres           jsonb    not null default '{}'::jsonb
);

create table if not exists membres (
  groupe_id  bigint not null references groupes(id) on delete cascade,
  user_id    uuid   not null references utilisateurs(id) on delete cascade,
  role       text   not null default 'parent' check (role in ('parent','invite')),
  poids      real   not null default 1.0,
  rejoint_le timestamptz not null default now(),
  primary key (groupe_id, user_id)
);
create index if not exists idx_membres_user on membres (user_id);

-- ---------------------------------------------------------------- votes
-- 0 = non, 1 = neutre, 2 = oui.  prenom = slug du catalogue embarqué.
create table if not exists votes (
  groupe_id  bigint   not null,
  user_id    uuid     not null,
  prenom     text     not null,
  valeur     smallint not null check (valeur in (0,1,2)),
  vote_le    timestamptz not null default now(),
  primary key (groupe_id, user_id, prenom),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
);
create index if not exists idx_votes_prenom on votes (groupe_id, prenom);

-- ---------------------------------------------------------------- vetos
create table if not exists vetos (
  groupe_id bigint not null,
  user_id   uuid   not null,
  prenom    text   not null,
  motif     text,
  pose_le   timestamptz not null default now(),
  primary key (groupe_id, prenom),          -- un seul veto suffit à tuer le prénom
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
);

create or replace function verifier_quota_veto() returns trigger
language plpgsql as $$
declare n int; maxi int;
begin
  select count(*) into n from vetos where groupe_id = new.groupe_id and user_id = new.user_id;
  select nb_vetos_max into maxi from groupes where id = new.groupe_id;
  if n >= maxi then
    raise exception 'quota_veto_atteint:%', maxi using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists trg_quota_veto on vetos;
create trigger trg_quota_veto before insert on vetos
  for each row execute function verifier_quota_veto();

-- ---------------------------------------------------------------- favoris
create table if not exists favoris (
  groupe_id bigint not null,
  user_id   uuid   not null,
  prenom    text   not null,
  primary key (groupe_id, user_id, prenom),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
);

-- ---------------------------------------------------------------- duels / Elo
create table if not exists duels (
  id        bigserial primary key,
  groupe_id bigint not null,
  user_id   uuid   not null,
  prenom_a  text   not null,
  prenom_b  text   not null,
  gagnant   text,                            -- null = égalité
  joue_le   timestamptz not null default now(),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade,
  check (prenom_a <> prenom_b)
);

create table if not exists elo (
  groupe_id bigint not null,
  user_id   uuid   not null,
  prenom    text   not null,
  score     real   not null default 1500,
  n_duels   integer not null default 0,
  primary key (groupe_id, user_id, prenom),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
);

create or replace function appliquer_elo() returns trigger
language plpgsql as $$
declare ra real; rb real; ea real; sa real; k constant real := 32;
begin
  insert into elo(groupe_id,user_id,prenom) values (new.groupe_id,new.user_id,new.prenom_a) on conflict do nothing;
  insert into elo(groupe_id,user_id,prenom) values (new.groupe_id,new.user_id,new.prenom_b) on conflict do nothing;
  select score into ra from elo where groupe_id=new.groupe_id and user_id=new.user_id and prenom=new.prenom_a;
  select score into rb from elo where groupe_id=new.groupe_id and user_id=new.user_id and prenom=new.prenom_b;
  ea := 1.0 / (1.0 + power(10.0, (rb - ra) / 400.0));
  sa := case when new.gagnant is null then 0.5
             when new.gagnant = new.prenom_a then 1.0 else 0.0 end;
  update elo set score = ra + k * (sa - ea), n_duels = n_duels + 1
   where groupe_id=new.groupe_id and user_id=new.user_id and prenom=new.prenom_a;
  update elo set score = rb + k * ((1-sa) - (1-ea)), n_duels = n_duels + 1
   where groupe_id=new.groupe_id and user_id=new.user_id and prenom=new.prenom_b;
  return new;
end $$;
drop trigger if exists trg_elo on duels;
create trigger trg_elo after insert on duels
  for each row execute function appliquer_elo();

-- ------------------------ top-N manuel (glisser-déposer sur la shortlist)
create table if not exists classement_manuel (
  groupe_id bigint   not null,
  user_id   uuid     not null,
  prenom    text     not null,
  position  smallint not null check (position between 1 and 20),
  primary key (groupe_id, user_id, prenom),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
);

-- ---------------------------------------------------------------- commentaires
create table if not exists commentaires (
  id        bigserial primary key,
  groupe_id bigint not null,
  user_id   uuid   not null,
  prenom    text   not null,
  texte     text   not null check (length(texte) between 1 and 500),
  ecrit_le  timestamptz not null default now(),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
);
create index if not exists idx_comm on commentaires (groupe_id, prenom);

-- ============================================================================
--  Vues de lecture
-- ============================================================================

-- Onglet « communs » : tout le monde a voté, personne n'a dit non, au moins un oui.
create or replace view v_matchs as
select v.groupe_id, v.prenom,
       count(*)                              as nb_votes,
       sum(v.valeur * m.poids)               as score,
       min(v.valeur)                         as pire_vote,
       count(*) filter (where v.valeur = 2)  as nb_oui,
       count(*) filter (where v.valeur = 1)  as nb_neutres
from votes v
join membres m on m.groupe_id = v.groupe_id and m.user_id = v.user_id
where not exists (select 1 from vetos t where t.groupe_id = v.groupe_id and t.prenom = v.prenom)
group by v.groupe_id, v.prenom
having count(*) = (select count(*) from membres mm where mm.groupe_id = v.groupe_id)
   and min(v.valeur) > 0
   and count(*) filter (where v.valeur = 2) >= 1;

-- Rang personnel : le top manuel prime, l'Elo classe le reste.
-- L'Elo reprend juste APRES le dernier rang manuel (et non a 21 en dur) :
-- sinon, sans classement manuel, les rangs commencent a 21 et la
-- normalisation du classement general ecrase toute l'echelle.
create or replace view v_rang_personnel as
with sources as (
  -- La vue partait de `elo`, donc d'un duel joue. Sans duels, elle etait vide
  -- et le classement general avec elle, alors que le podium manuel existait.
  -- On part de l'union des deux sources : un podium seul suffit desormais.
  select groupe_id, user_id, prenom from classement_manuel
  union
  select groupe_id, user_id, prenom from elo
),
base as (
  select s.groupe_id, s.user_id, s.prenom,
         cm.position as pos_manuelle,
         row_number() over (partition by s.groupe_id, s.user_id
                            order by coalesce(e.score, 1500) desc, s.prenom) as rang_elo,
         coalesce(max(cm.position) over (partition by s.groupe_id, s.user_id), 0) as n_manuel
  from sources s
  left join classement_manuel cm
    on cm.groupe_id = s.groupe_id and cm.user_id = s.user_id and cm.prenom = s.prenom
  left join elo e
    on e.groupe_id = s.groupe_id and e.user_id = s.user_id and e.prenom = s.prenom
)
select groupe_id, user_id, prenom,
       coalesce(pos_manuelle,
                n_manuel + row_number() over (partition by groupe_id, user_id, (pos_manuelle is null)
                                              order by rang_elo)) as rang
from base;

-- Classement général : moyenne pondérée des rangs normalisés + indice de consensus.
create or replace view v_classement_general as
with n as (
  -- normalisation sur l'etendue reelle (min..max) et non sur 1..max :
  -- le mieux classe vaut 1, le moins bien 0, quel que soit le rang de depart
  select r.groupe_id, r.prenom, r.user_id, m.poids,
         1.0 - (r.rang::real - min(r.rang) over (partition by r.groupe_id, r.user_id))
               / nullif(max(r.rang) over (partition by r.groupe_id, r.user_id)
                        - min(r.rang) over (partition by r.groupe_id, r.user_id), 0) as note
  from v_rang_personnel r
  join membres m on m.groupe_id = r.groupe_id and m.user_id = r.user_id
)
select groupe_id, prenom,
       round((sum(note * poids) / nullif(sum(poids),0))::numeric, 4) as note_generale,
       round((1 - coalesce(stddev_pop(note),0))::numeric, 4)         as consensus,
       count(*) as nb_classeurs
from n
group by groupe_id, prenom;

-- ============================================================================
--  Fin de l'authentification par e-mail.
--
--  Le lien magique supposait un fournisseur d'envoi, un domaine verifie et
--  des enregistrements DNS, pour un service qui se resume a retrouver son
--  compte sur un autre appareil — le code d'invitation fait deja entrer dans
--  le bon groupe. On le remplace par une cle d'acces personnelle, dont seule
--  l'empreinte SHA-256 est conservee ici.
--
--  Ce bloc est rejouable : les comptes existants gardent leur e-mail dans la
--  colonne, qui n'est simplement plus lue nulle part.
-- ============================================================================
alter table utilisateurs alter column email drop not null;
alter table utilisateurs add column if not exists cle_acces_hash text;
create unique index if not exists idx_utilisateurs_cle
  on utilisateurs (cle_acces_hash) where cle_acces_hash is not null;

-- ============================================================================
--  Origine d'un vote « non ».
--
--  « Écarter la famille » passe jusqu'à vingt-cinq prénoms en non d'un seul
--  geste. Pour pouvoir les remettre en bloc, il faut savoir lesquels sont
--  partis ensemble — on ne peut pas le redeviner après coup : la racine
--  calculée dépend de la pile au moment du balayage, qui a changé depuis.
--
--  balayage vaut la racine commune (slug sans accents) pour un vote issu
--  d'un balayage, et NULL pour un vote donné prénom par prénom.
-- ============================================================================
alter table votes add column if not exists balayage text;
create index if not exists idx_votes_balayage
  on votes (groupe_id, user_id, balayage) where balayage is not null;

-- ============================================================================
--  Ce qui est vendu, c'est la LISTE, pas le compte.
--
--  Une liste de prénoms n'a de sens qu'à deux. Limiter un seul membre la rend
--  inutilisable pour les deux : personne n'achète, et le produit ne sert plus
--  à rien entre-temps. La liste se débloque donc d'un coup, pour tous ses
--  membres, payée par celui qui craque le premier.
--
--  paye_le est la date d'encaissement ; paye_par dit qui, pour pouvoir
--  répondre à un litige sans fouiller chez le prestataire de paiement.
-- ============================================================================
alter table groupes add column if not exists paye_le  timestamptz;
alter table groupes add column if not exists paye_par uuid references utilisateurs(id);
alter table groupes add column if not exists quota_swipe_mois integer not null default 600;

-- Le quota journalier change de metier : il etait de l'hygiene (on juge mal
-- apres quarante prenoms), il devient la limite de la version gratuite. 20 par
-- jour, et 600 par mois — c'est-a-dire trente jours pleins. Le mois ne sert
-- qu'a rattraper celui qui multiplierait les appareils : une limite mensuelle
-- qui mord vraiment enferme l'utilisateur assidu trois semaines sans rien a
-- faire, et un utilisateur bloque trois semaines ne paie pas, il part.
-- L'hygiene reste, cote client, pour les listes debloquees.
alter table groupes alter column quota_swipe_jour set default 20;

-- ============================================================================
--  Compteur de gestes, par liste, par membre, par jour.
--
--  On ne compte PAS les lignes de `votes` : depuis le regroupement par
--  prononciation, un seul swipe en écrit jusqu'à seize (Elio + ses quinze
--  graphies). Le quota porte sur les décisions, pas sur les lignes.
--
--  On ne compte pas non plus côté navigateur, où il vivait : un localStorage
--  se vide, et un quota qu'on contourne en vidant son cache n'est pas un
--  quota.
-- ============================================================================
create table if not exists quota_jour (
  groupe_id bigint  not null,
  user_id   uuid    not null,
  jour      date    not null default current_date,
  n         integer not null default 0,
  primary key (groupe_id, user_id, jour),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
);

-- ============================================================================
--  Le nom de famille de l'enfant.
--
--  Il appartient à la LISTE, pas à la personne : les deux parents testent le
--  même, et le saisir deux fois serait absurde. Facultatif — on ne le demande
--  jamais pour s'inscrire, seulement quand on veut l'essai de sonorité.
-- ============================================================================
alter table groupes add column if not exists nom_famille text;

-- ============================================================================
--  Les observateurs.
--
--  « Montre à ta mère » est la première chose que font les gens, et jusqu'ici
--  ça coûtait cher : un troisième membre remet TOUS les accords en attente et
--  lui donne un veto sur chacun. Beaucoup de couples ne partagent donc pas,
--  ou partagent et le regrettent.
--
--  Un observateur juge les prénoms et son avis se lit — mais il ne compte ni
--  dans le quorum des accords, ni dans les vetos. Le couple garde la main,
--  les grands-parents ont leur mot.
--
--  Le rôle est porté par un SECOND code d'invitation, pas par un paramètre
--  d'URL : sinon l'invité change le lien et s'élit parent.
-- ============================================================================
alter table membres drop constraint if exists membres_role_check;
alter table membres add constraint membres_role_check
  check (role in ('parent', 'invite', 'observateur'));

alter table groupes add column if not exists code_observateur text unique;

-- Un accord se compte entre décideurs. Les deux côtés de la vue changent :
-- les votes des observateurs n'entrent pas, et le quorum ne les attend pas.
create or replace view v_matchs as
select v.groupe_id, v.prenom,
       count(*)                              as nb_votes,
       sum(v.valeur * m.poids)               as score,
       min(v.valeur)                         as pire_vote,
       count(*) filter (where v.valeur = 2)  as nb_oui,
       count(*) filter (where v.valeur = 1)  as nb_neutres
from votes v
join membres m on m.groupe_id = v.groupe_id and m.user_id = v.user_id
where not exists (select 1 from vetos t where t.groupe_id = v.groupe_id and t.prenom = v.prenom)
  and m.role <> 'observateur'
group by v.groupe_id, v.prenom
having count(*) = (select count(*) from membres mm
                    where mm.groupe_id = v.groupe_id and mm.role <> 'observateur')
   and min(v.valeur) > 0
   and count(*) filter (where v.valeur = 2) >= 1;

-- ============================================================================
--  Une liste offerte n'est pas une liste vendue.
--
--  `paye_le` dit qu'une liste est debloquee ; il ne dit pas si quelqu'un a
--  paye. Sans cette colonne, « combien de listes vendues ? » compterait les
--  listes offertes aux amis et aux testeurs — et on piloterait sur un chiffre
--  faux. Stripe reste la source de verite pour l'argent ; ceci sert a ne pas
--  se mentir en lisant la base.
--
--  Offrir une liste, a la main, dans la console Neon :
--
--    update groupes set paye_le = now(), offert = true
--     where code_invitation = '<le code de la liste>' and paye_le is null
--    returning nom;
-- ============================================================================
alter table groupes add column if not exists offert boolean not null default false;
