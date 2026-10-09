-- ============================================================================
--  Les prénoms AJOUTÉS à une liste : ceux que le catalogue n'a pas
--
--  Le catalogue, c'est ce que l'INSEE publie pour les trois dernières années.
--  Le prénom d'une arrière-grand-mère, une graphie à soi, un prénom inventé
--  n'y sont pas, et c'est souvent celui-là qu'on veut proposer. Un décideur
--  l'ajoute depuis la recherche : il devient une carte du tri pour toute la
--  liste. Votes, vetos, favoris, « déjà pris » et commentaires n'ont rien à
--  apprendre : ils ne connaissent qu'un prénom écrit.
--
--  L'écriture est celle de shared/utils/ajouts.ts (ecrireAjout), la même dans
--  l'app et ici : « jeannine » et « JEANNINE » font une seule carte.
-- ============================================================================
create table if not exists prenoms_ajoutes (
  groupe_id integer not null references groupes(id) on delete cascade,
  prenom    text    not null,
  -- Qui l'a ajouté : toute la liste le voit, c'est une proposition, pas un
  -- vote. La carte appartient pourtant à la LISTE : son compte effacé ou la
  -- liste quittée, elle reste (les votes des autres portent dessus), sans
  -- auteur ni mot (trigger ci-dessous).
  user_id   text    references utilisateurs(id) on delete set null,
  -- Le mot de l'auteur (« le prénom de mon arrière-grand-mère »), 140
  -- caractères au plus : il tient sur la carte.
  mot       text,
  ajoute_le text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (groupe_id, prenom)
) without rowid;
-- l'effacement d'un compte et l'export de ses données cherchent par auteur
create index if not exists idx_prenoms_ajoutes_user on prenoms_ajoutes (user_id);

-- Le mot est le texte de son auteur : il part avec lui.
create trigger if not exists trg_prenoms_ajoutes_sans_auteur after update of user_id on prenoms_ajoutes
when new.user_id is null
BEGIN
  update prenoms_ajoutes set mot = null
   where groupe_id = new.groupe_id and prenom = new.prenom and mot is not null;
END;

-- Deux cents cartes ajoutées : bien plus qu'on n'en propose. La borne protège
-- la base, pas l'usage (AJOUTS_MAX, shared/utils/ajouts.ts).
create trigger if not exists trg_prenoms_ajoutes_plein before insert on prenoms_ajoutes
BEGIN
  select raise(abort, 'ajouts_plein')
   where (select count(*) from prenoms_ajoutes where groupe_id = new.groupe_id) >= 200;
END;
