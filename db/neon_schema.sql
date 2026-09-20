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
