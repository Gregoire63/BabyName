-- ============================================================================
--  babyNamed — schéma de la base (Cloudflare D1, c'est-à-dire SQLite)
--
--  Migration n° 1 : l'état complet au passage de Postgres (Neon) à D1. La
--  suivante s'écrira dans 0002_quelque_chose.sql, jamais ici : ce fichier est
--  déjà appliqué partout où l'app tourne (table d1_migrations).
--
--  Appliquée par la première requête (server/utils/db.ts) ou à la main :
--    npx wrangler d1 migrations apply DB --remote
--
--  Conventions (voir server/utils/db.ts) :
--   * dates : texte ISO 8601 en UTC, au format de Date.toISOString() ;
--   * booléens : 0/1 ; JSON : texte validé par json_valid ;
--   * identifiants de compte : UUID v4 en texte, tirés par la base.
--
--  LE VOTE AVEUGLE n'est pas garanti ici mais par l'API : toute lecture des
--  votes d'autrui passe par server/utils/votes.ts. Le catalogue des prénoms
--  n'est pas en base : il est embarqué dans l'app (public/data/catalogue.json).
--
--  Pas de « -- » dans une chaîne, pas de « ; » dans une chaîne : le découpage
--  des instructions en dépend (decouper, dans db.ts).
-- ============================================================================

-- ---------------------------------------------------------------- comptes
create table if not exists utilisateurs (
  id               text primary key default (lower(
                     hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
                     substr(hex(randomblob(2)), 2) || '-' ||
                     substr('89ab', 1 + (abs(random()) % 4), 1) ||
                     substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  -- facultative, en minuscules, enregistrée seulement une fois prouvée
  email            text unique,
  email_verifie_le text,
  pseudo           text not null,
  cree_le          text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- fait courir le délai de conservation (24 mois sans activité : effacé)
  vu_le            text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- l'ANCIENNE clé d'accès, pour les comptes d'avant les passkeys : son
  -- empreinte SHA-256 seulement
  cle_acces_hash   text,
  -- prénoms jugés sur le lot de départ gratuit, toutes listes confondues
  gestes_depart    integer not null default 0,
  -- génération des sessions : « Déconnecter mes autres appareils » l'incrémente
  session_gen      integer not null default 0,
  -- identifiant WebAuthn (« user handle ») : 32 octets au hasard, jamais l'id
  webauthn_id      text
);
create unique index if not exists idx_utilisateurs_cle
  on utilisateurs (cle_acces_hash) where cle_acces_hash is not null;
create unique index if not exists idx_utilisateurs_webauthn
  on utilisateurs (webauthn_id) where webauthn_id is not null;
-- la purge quotidienne cherche les comptes inactifs depuis 24 mois
create index if not exists idx_utilisateurs_vu_le on utilisateurs (vu_le);

-- ---------------------------------------------------------------- listes
-- Ce qui est vendu, c'est la LISTE : elle se débloque d'un coup, pour tous ses
-- membres (paye_le). offert : débloquée sans paiement (code à 100 %, cadeau).
-- paiement_ref : le paiement Stripe (pi_…), pour re-verrouiller sur
-- remboursement total ou litige perdu.
create table if not exists groupes (
  id                 integer primary key autoincrement,
  nom                text    not null,
  code_invitation    text    not null unique,
  -- effacer le compte du créateur ne doit pas effacer la liste des autres
  cree_par           text    references utilisateurs(id) on delete set null,
  cree_le            text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  nb_vetos_max       integer not null default 2,
  favoris_visibles   integer not null default 0 check (favoris_visibles in (0, 1)),
  quota_swipe_jour   integer not null default 20,
  filtres            text    not null default '{}' check (json_valid(filtres)),
  paye_le            text,
  paye_par           text    references utilisateurs(id) on delete set null,
  offert             integer not null default 0 check (offert in (0, 1)),
  paiement_ref       text,
  -- le nom de famille de l'enfant : il appartient à la liste
  nom_famille        text,
  -- le second code, qui fait entrer comme observateur
  code_observateur   text    unique,
  -- le quota de la version gratuite : un départ, puis un filet quotidien
  quota_depart       integer not null default 150,
  quota_depart_liste integer not null default 300,
  quota_par_jour     integer not null default 15,
  gestes_depart      integer not null default 0
);
create index if not exists idx_groupes_paiement_ref
  on groupes (paiement_ref) where paiement_ref is not null;

-- Un observateur juge et son avis se lit, mais il ne compte ni dans les
-- accords, ni dans les vetos. Le rôle vient du code d'invitation.
create table if not exists membres (
  groupe_id  integer not null references groupes(id) on delete cascade,
  user_id    text    not null references utilisateurs(id) on delete cascade,
  role       text    not null default 'parent' check (role in ('parent', 'invite', 'observateur')),
  poids      real    not null default 1.0,
  rejoint_le text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (groupe_id, user_id)
) without rowid;
create index if not exists idx_membres_user on membres (user_id);

-- ---------------------------------------------------------------- votes
-- 0 = non, 1 = neutre, 2 = oui. prenom = le prénom du catalogue embarqué.
-- balayage : la racine commune pour un non donné à toute une famille d'un
-- geste (pour pouvoir la remettre en bloc), NULL pour un vote un par un.
create table if not exists votes (
  groupe_id integer not null,
  user_id   text    not null,
  prenom    text    not null,
  valeur    integer not null check (valeur in (0, 1, 2)),
  vote_le   text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  balayage  text,
  primary key (groupe_id, user_id, prenom),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
) without rowid;
create index if not exists idx_votes_prenom on votes (groupe_id, prenom);
create index if not exists idx_votes_balayage
  on votes (groupe_id, user_id, balayage) where balayage is not null;
-- la dernière activité d'une liste : une lecture au lieu de tous ses votes
create index if not exists idx_votes_date on votes (groupe_id, vote_le);

-- ---------------------------------------------------------------- vetos
create table if not exists vetos (
  groupe_id integer not null,
  user_id   text    not null,
  prenom    text    not null,
  motif     text,
  pose_le   text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (groupe_id, prenom),          -- un seul veto suffit à tuer le prénom
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
) without rowid;

create trigger if not exists trg_quota_veto before insert on vetos
begin
  select raise(abort, 'quota_veto_atteint')
   where (select count(*) from vetos where groupe_id = new.groupe_id and user_id = new.user_id)
         >= (select nb_vetos_max from groupes where id = new.groupe_id);
end;

-- ---------------------------------------------------------------- favoris
create table if not exists favoris (
  groupe_id integer not null,
  user_id   text    not null,
  prenom    text    not null,
  primary key (groupe_id, user_id, prenom),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
) without rowid;

-- ------------------------------------- duels, Elo, classement manuel
-- Plus rien ne les écrit ; ils restent pour l'export et l'effacement des
-- données des comptes qui en ont.
create table if not exists duels (
  id        integer primary key autoincrement,
  groupe_id integer not null,
  user_id   text    not null,
  prenom_a  text    not null,
  prenom_b  text    not null,
  gagnant   text,
  joue_le   text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade,
  check (prenom_a <> prenom_b)
);
create index if not exists idx_duels_membre on duels (groupe_id, user_id);

create table if not exists elo (
  groupe_id integer not null,
  user_id   text    not null,
  prenom    text    not null,
  score     real    not null default 1500,
  n_duels   integer not null default 0,
  primary key (groupe_id, user_id, prenom),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
) without rowid;

create table if not exists classement_manuel (
  groupe_id integer not null,
  user_id   text    not null,
  prenom    text    not null,
  position  integer not null check (position between 1 and 20),
  primary key (groupe_id, user_id, prenom),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
) without rowid;

-- ---------------------------------------------------------------- commentaires
create table if not exists commentaires (
  id        integer primary key autoincrement,
  groupe_id integer not null,
  user_id   text    not null,
  prenom    text    not null,
  texte     text    not null check (length(texte) between 1 and 500),
  ecrit_le  text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
);
create index if not exists idx_comm on commentaires (groupe_id, prenom);
create index if not exists idx_comm_membre on commentaires (groupe_id, user_id);

-- ---------------------------------------------------------------- quota
-- Le filet quotidien, par liste, par membre, par jour DE PARIS (AAAA-MM-JJ,
-- calculé par l'app). On compte des gestes, pas des lignes de votes : un
-- swipe en écrit jusqu'à seize (les graphies du même prénom).
create table if not exists quota_jour (
  groupe_id integer not null,
  user_id   text    not null,
  jour      text    not null,
  n         integer not null default 0,
  primary key (groupe_id, user_id, jour),
  foreign key (groupe_id, user_id) references membres(groupe_id, user_id) on delete cascade
) without rowid;
create index if not exists idx_quota_user_jour on quota_jour (user_id, jour);

-- ---------------------------------------------------------------- connexion
-- Une passkey : sa clé PUBLIQUE seulement. Rien de biométrique ne quitte
-- l'appareil, et une clé publique volée n'ouvre rien.
create table if not exists passkeys (
  id           text    primary key,                     -- base64url
  user_id      text    not null references utilisateurs(id) on delete cascade,
  cle_publique text    not null,                        -- COSE, base64url
  compteur     integer not null default 0,
  transports   text    not null default '[]' check (json_valid(transports)),
  nom          text    not null default 'Passkey',
  synchronisee integer not null default 0 check (synchronisee in (0, 1)),
  cree_le      text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  utilisee_le  text
);
create index if not exists idx_passkeys_user on passkeys (user_id);

-- Un lien reçu par e-mail et son code : des EMPREINTES seulement (SHA-256 du
-- jeton, HMAC du code). Quinze minutes, un seul usage, cinq essais de code.
create table if not exists liens_connexion (
  id         text    primary key,
  email      text    not null,
  user_id    text    not null references utilisateurs(id) on delete cascade,
  but        text    not null check (but in ('connexion', 'verification')),
  code_hash  text    not null,
  essais     integer not null default 0,
  expire_le  text    not null,
  utilise_le text,
  cree_le    text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index if not exists idx_liens_email on liens_connexion (email, but, cree_le);
create index if not exists idx_liens_user on liens_connexion (user_id);

-- Limiter les essais : une ligne par action et par EMPREINTE (d'IP, de compte,
-- d'e-mail), jamais la valeur en clair. Purgée au bout de deux jours.
create table if not exists limites (
  cle   text    primary key,
  debut text    not null,
  n     integer not null
) without rowid;

-- ============================================================================
--  Onglet « communs » : tous les décideurs ont voté, personne n'a dit non,
--  au moins un oui. Les observateurs ne comptent ni dans les votes ni dans le
--  quorum ; un veto retire le prénom.
-- ============================================================================
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
   and m.role <> 'observateur'
 group by v.groupe_id, v.prenom
having count(*) = (select count(*) from membres mm
                    where mm.groupe_id = v.groupe_id and mm.role <> 'observateur')
   and min(v.valeur) > 0
   and count(*) filter (where v.valeur = 2) >= 1;
