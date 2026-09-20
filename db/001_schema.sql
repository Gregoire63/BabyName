-- ============================================================================
--  Choix de prenom  --  schema Supabase
--  Principes :
--   1. Le vote aveugle est garanti par RLS, pas par l'UI.
--   2. Le catalogue INSEE est global et en lecture seule.
--   3. Le classement general combine duels (Elo) et top-N manuel.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- catalogue
create table public.prenoms (
  id                 bigserial primary key,
  label              text not null,
  slug               text not null unique,
  sexe               text not null check (sexe in ('f','m','fm')),
  unisexe_ratio      real not null default 0,

  births_recent      integer not null,
  births_total       integer not null,
  freq_recent_p10k   real    not null,
  trend_pct_an       real,
  peak_year          smallint,
  peak_freq_p10k     real,
  is_revival         boolean not null default false,
  originalite        real,             -- 0 = ultra courant, 100 = ultra rare
  risque_surprise    real,             -- 0..100 : proba d'explosion a court terme

  nb_car             smallint not null,
  nb_syllabes        smallint not null,
  compose            boolean  not null default false,
  initiale           char(1),
  finale             char(1),

  -- enrichissement
  -- Wikidata P407 = langue(s) D'USAGE du prenom, PAS son etymologie.
  -- (Gabriel y ressort "germanique|slave|latin..." : inutilisable comme origine.)
  langues_usage      text[]  not null default '{}',
  wikidata_connu     boolean not null default false,
  -- origine etymologique reelle : Wiktionnaire ANGLAIS (categories
  -- "given names from X" = origine ultime) + couche manuelle prioritaire.
  origines           text[]  not null default '{}',
  src_origines       text,              -- manuel | wiktionnaire-en | wiktionnaire-fr | composé
  signification      text,              -- en francais
  signification_en   text,              -- glose anglaise, quand aucune FR n'existe
  a_signification    boolean generated always as (signification is not null) stored,
  objet_marque       boolean not null default false,
  objet_marque_note  text,
  diminutifs         text[]  not null default '{}',
  charge_epellation  smallint,          -- 0 = evident, 3 = a epeler a vie
  source_enrich      text
);

create index on public.prenoms (sexe);
create index on public.prenoms (freq_recent_p10k desc);
create index on public.prenoms using gin (origines);
create index on public.prenoms using gin (langues_usage);
alter table public.prenoms enable row level security;
create policy "catalogue lisible par tous" on public.prenoms for select to authenticated using (true);

-- ---------------------------------------------------------------- groupes
create table public.groupes (
  id                bigserial primary key,
  nom               text not null,
  code_invitation   text not null unique default encode(gen_random_bytes(4),'hex'),
  cree_par          uuid not null references auth.users(id) on delete cascade,
  cree_le           timestamptz not null default now(),
  -- parametres produit
  nb_vetos_max      smallint not null default 2,
  favoris_visibles  boolean  not null default false,
  quota_swipe_jour  smallint not null default 40,
  filtres           jsonb    not null default '{}'::jsonb
);

create table public.membres (
  groupe_id  bigint not null references public.groupes(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  pseudo     text   not null,
  role       text   not null default 'parent' check (role in ('parent','invite')),
  poids      real   not null default 1.0,   -- 1.0 parent, <1 pour la belle-famille
  rejoint_le timestamptz not null default now(),
  primary key (groupe_id, user_id)
);
create index on public.membres (user_id);

create or replace function public.est_membre(g bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membres m where m.groupe_id = g and m.user_id = auth.uid());
$$;

alter table public.groupes enable row level security;
alter table public.membres enable row level security;
create policy "groupe visible aux membres" on public.groupes for select to authenticated using (public.est_membre(id));
create policy "groupe modifiable par le createur" on public.groupes for update to authenticated using (cree_par = auth.uid());
create policy "creer un groupe" on public.groupes for insert to authenticated with check (cree_par = auth.uid());
create policy "membres visibles entre eux" on public.membres for select to authenticated using (public.est_membre(groupe_id));
create policy "se joindre soi-meme" on public.membres for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------- votes
-- 0 = non, 1 = neutre, 2 = oui
create table public.votes (
  groupe_id  bigint   not null,
  user_id    uuid     not null references auth.users(id) on delete cascade,
  prenom_id  bigint   not null references public.prenoms(id) on delete cascade,
  valeur     smallint not null check (valeur in (0,1,2)),
  vote_le    timestamptz not null default now(),
  primary key (groupe_id, user_id, prenom_id),
  foreign key (groupe_id, user_id) references public.membres(groupe_id, user_id) on delete cascade
);
create index on public.votes (groupe_id, prenom_id);

alter table public.votes enable row level security;

-- LE point cle : on ne voit le vote d'un autre QUE si on a deja vote soi-meme.
create policy "vote aveugle" on public.votes for select to authenticated
using (
  public.est_membre(groupe_id)
  and (
    user_id = auth.uid()
    or exists (select 1 from public.votes v
               where v.groupe_id = votes.groupe_id
                 and v.prenom_id = votes.prenom_id
                 and v.user_id   = auth.uid())
  )
);
create policy "voter pour soi" on public.votes for insert to authenticated
  with check (user_id = auth.uid() and public.est_membre(groupe_id));
create policy "corriger son vote" on public.votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- vetos
create table public.vetos (
  groupe_id bigint not null,
  user_id   uuid   not null references auth.users(id) on delete cascade,
  prenom_id bigint not null references public.prenoms(id) on delete cascade,
  motif     text,
  pose_le   timestamptz not null default now(),
  primary key (groupe_id, prenom_id),        -- un veto suffit a tuer le prenom
  foreign key (groupe_id, user_id) references public.membres(groupe_id, user_id) on delete cascade
);

create or replace function public.check_quota_veto() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; maxi int;
begin
  select count(*) into n from public.vetos
   where groupe_id = new.groupe_id and user_id = new.user_id;
  select nb_vetos_max into maxi from public.groupes where id = new.groupe_id;
  if n >= maxi then
    raise exception 'Quota de vetos atteint (%). Un veto, ca se depense.', maxi;
  end if;
  return new;
end $$;
create trigger trg_quota_veto before insert on public.vetos
  for each row execute function public.check_quota_veto();

alter table public.vetos enable row level security;
create policy "vetos visibles au groupe" on public.vetos for select to authenticated using (public.est_membre(groupe_id));
create policy "poser son veto" on public.vetos for insert to authenticated
  with check (user_id = auth.uid() and public.est_membre(groupe_id));
create policy "retirer son veto" on public.vetos for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- favoris
create table public.favoris (
  groupe_id bigint not null,
  user_id   uuid   not null references auth.users(id) on delete cascade,
  prenom_id bigint not null references public.prenoms(id) on delete cascade,
  primary key (groupe_id, user_id, prenom_id),
  foreign key (groupe_id, user_id) references public.membres(groupe_id, user_id) on delete cascade
);
alter table public.favoris enable row level security;
create policy "favoris selon parametre du groupe" on public.favoris for select to authenticated
using (
  user_id = auth.uid()
  or (public.est_membre(groupe_id)
      and exists (select 1 from public.groupes g where g.id = groupe_id and g.favoris_visibles))
);
create policy "gerer ses favoris" on public.favoris for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- duels / Elo
create table public.duels (
  id        bigserial primary key,
  groupe_id bigint not null,
  user_id   uuid   not null references auth.users(id) on delete cascade,
  prenom_a  bigint not null references public.prenoms(id),
  prenom_b  bigint not null references public.prenoms(id),
  gagnant   bigint references public.prenoms(id),   -- null = egalite
  joue_le   timestamptz not null default now(),
  foreign key (groupe_id, user_id) references public.membres(groupe_id, user_id) on delete cascade,
  check (prenom_a <> prenom_b)
);
create index on public.duels (groupe_id, user_id);

create table public.elo (
  groupe_id bigint not null,
  user_id   uuid   not null references auth.users(id) on delete cascade,
  prenom_id bigint not null references public.prenoms(id) on delete cascade,
  score     real   not null default 1500,
  n_duels   integer not null default 0,
  primary key (groupe_id, user_id, prenom_id),
  foreign key (groupe_id, user_id) references public.membres(groupe_id, user_id) on delete cascade
);

create or replace function public.appliquer_elo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ra real; rb real; ea real; sa real; k real := 32;
begin
  insert into public.elo(groupe_id,user_id,prenom_id) values (new.groupe_id,new.user_id,new.prenom_a)
    on conflict do nothing;
  insert into public.elo(groupe_id,user_id,prenom_id) values (new.groupe_id,new.user_id,new.prenom_b)
    on conflict do nothing;

  select score into ra from public.elo where groupe_id=new.groupe_id and user_id=new.user_id and prenom_id=new.prenom_a;
  select score into rb from public.elo where groupe_id=new.groupe_id and user_id=new.user_id and prenom_id=new.prenom_b;

  ea := 1.0 / (1.0 + power(10.0, (rb - ra) / 400.0));
  sa := case when new.gagnant is null then 0.5
             when new.gagnant = new.prenom_a then 1.0 else 0.0 end;

  update public.elo set score = ra + k * (sa - ea), n_duels = n_duels + 1
   where groupe_id=new.groupe_id and user_id=new.user_id and prenom_id=new.prenom_a;
  update public.elo set score = rb + k * ((1-sa) - (1-ea)), n_duels = n_duels + 1
   where groupe_id=new.groupe_id and user_id=new.user_id and prenom_id=new.prenom_b;
  return new;
end $$;
create trigger trg_elo after insert on public.duels
  for each row execute function public.appliquer_elo();

alter table public.duels enable row level security;
alter table public.elo enable row level security;
create policy "ses duels" on public.duels for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.est_membre(groupe_id));
create policy "elo visible au groupe" on public.elo for select to authenticated using (public.est_membre(groupe_id));

-- ---------------------------- top-N manuel (glisser-deposer sur la shortlist)
create table public.classement_manuel (
  groupe_id bigint   not null,
  user_id   uuid     not null references auth.users(id) on delete cascade,
  prenom_id bigint   not null references public.prenoms(id) on delete cascade,
  position  smallint not null check (position between 1 and 20),
  primary key (groupe_id, user_id, prenom_id),
  unique (groupe_id, user_id, position) deferrable initially deferred,
  foreign key (groupe_id, user_id) references public.membres(groupe_id, user_id) on delete cascade
);
alter table public.classement_manuel enable row level security;
create policy "classement visible au groupe" on public.classement_manuel for select to authenticated using (public.est_membre(groupe_id));
create policy "gerer son classement" on public.classement_manuel for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- commentaires
create table public.commentaires (
  id        bigserial primary key,
  groupe_id bigint not null,
  user_id   uuid   not null references auth.users(id) on delete cascade,
  prenom_id bigint not null references public.prenoms(id) on delete cascade,
  texte     text   not null check (length(texte) between 1 and 500),
  ecrit_le  timestamptz not null default now(),
  foreign key (groupe_id, user_id) references public.membres(groupe_id, user_id) on delete cascade
);
create index on public.commentaires (groupe_id, prenom_id);
alter table public.commentaires enable row level security;
-- un commentaire reste cache tant que le lecteur n'a pas vote : meme logique que le vote aveugle
create policy "commentaires apres vote" on public.commentaires for select to authenticated
using (
  public.est_membre(groupe_id)
  and (user_id = auth.uid()
       or exists (select 1 from public.votes v
                  where v.groupe_id = commentaires.groupe_id
                    and v.prenom_id = commentaires.prenom_id
                    and v.user_id   = auth.uid()))
);
create policy "ecrire son commentaire" on public.commentaires for insert to authenticated
  with check (user_id = auth.uid() and public.est_membre(groupe_id));

-- ============================================================================
--  Vues
-- ============================================================================

-- Onglet "communs" : tout le monde a vote, personne n'a dit non, au moins un oui.
create or replace view public.v_matchs with (security_invoker = true) as
select
  v.groupe_id,
  v.prenom_id,
  count(*)                          as nb_votes,
  sum(v.valeur * m.poids)           as score,
  min(v.valeur)                     as pire_vote,
  count(*) filter (where v.valeur = 2) as nb_oui,
  count(*) filter (where v.valeur = 1) as nb_neutres
from public.votes v
join public.membres m on m.groupe_id = v.groupe_id and m.user_id = v.user_id
where not exists (select 1 from public.vetos t
                  where t.groupe_id = v.groupe_id and t.prenom_id = v.prenom_id)
group by v.groupe_id, v.prenom_id
having count(*) = (select count(*) from public.membres mm where mm.groupe_id = v.groupe_id)
   and min(v.valeur) > 0
   and count(*) filter (where v.valeur = 2) >= 1;

-- Rang personnel : le top-N manuel prime, l'Elo classe le reste.
create or replace view public.v_rang_personnel with (security_invoker = true) as
with base as (
  select e.groupe_id, e.user_id, e.prenom_id,
         cm.position as pos_manuelle,
         row_number() over (partition by e.groupe_id, e.user_id order by e.score desc) as rang_elo
  from public.elo e
  left join public.classement_manuel cm
    on cm.groupe_id = e.groupe_id and cm.user_id = e.user_id and cm.prenom_id = e.prenom_id
)
select groupe_id, user_id, prenom_id,
       coalesce(pos_manuelle,
                20 + row_number() over (partition by groupe_id, user_id, (pos_manuelle is null)
                                        order by rang_elo)) as rang
from base;

-- Classement general : moyenne ponderee des rangs normalises + indice de consensus.
create or replace view public.v_classement_general with (security_invoker = true) as
with n as (
  select r.groupe_id, r.prenom_id, r.user_id, m.poids,
         1.0 - (r.rang::real - 1) / nullif(max(r.rang) over (partition by r.groupe_id, r.user_id) - 1, 0) as note
  from public.v_rang_personnel r
  join public.membres m on m.groupe_id = r.groupe_id and m.user_id = r.user_id
)
select groupe_id, prenom_id,
       round((sum(note * poids) / nullif(sum(poids),0))::numeric, 4) as note_generale,
       round((1 - coalesce(stddev_pop(note),0))::numeric, 4)         as consensus,
       count(*) as nb_classeurs
from n
group by groupe_id, prenom_id
order by note_generale desc;
