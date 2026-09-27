-- ============================================================================
--  L'inscription se valide par e-mail
--
--  Un compte ne naît plus d'un prénom seul : il faut prouver une boîte mail,
--  par le lien ou le code reçus, comme pour la connexion. Tant que ce n'est
--  pas fait, il n'y a PAS de compte, seulement la demande, rangée ici avec
--  les liens de connexion : l'adresse, le prénom choisi, l'empreinte du jeton
--  et celle du code, quinze minutes. Une adresse jamais confirmée ne laisse
--  aucun compte vide derrière elle ; la purge quotidienne efface la demande
--  le lendemain de son expiration, comme un lien.
--
--  SQLite ne sait ni changer une contrainte CHECK ni rendre une colonne
--  facultative : la table est reconstruite, lignes comprises. Aucune autre
--  table ne la référence.
-- ============================================================================
create table liens_connexion_v2 (
  id         text    primary key,
  email      text    not null,
  -- le compte visé ; aucun pour une inscription, il n'existe pas encore
  user_id    text    references utilisateurs(id) on delete cascade,
  -- le prénom choisi à l'inscription, et seulement là
  pseudo     text,
  but        text    not null check (but in ('connexion', 'verification', 'inscription')),
  code_hash  text    not null,
  essais     integer not null default 0,
  expire_le  text    not null,
  utilise_le text,
  cree_le    text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check ((but = 'inscription') = (user_id is null)),
  check ((but = 'inscription') = (pseudo is not null))
);
insert into liens_connexion_v2 (id, email, user_id, but, code_hash, essais, expire_le, utilise_le, cree_le)
  select id, email, user_id, but, code_hash, essais, expire_le, utilise_le, cree_le from liens_connexion;
drop table liens_connexion;
alter table liens_connexion_v2 rename to liens_connexion;
create index if not exists idx_liens_email on liens_connexion (email, but, cree_le);
create index if not exists idx_liens_user on liens_connexion (user_id);
