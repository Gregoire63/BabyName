-- ============================================================================
--  D'où viennent les comptes et les cadeaux
--
--  Sans ça, impossible de savoir si une inscription ou une vente vient de
--  Google, de TikTok ou d'un lien cadeau : le paramètre `ref` des pages
--  publiques était lu puis jeté. On garde UN mot, choisi par le site ou
--  déduit du site d'où l'on arrive (seo, tiktok, google, cadeau…), jamais
--  l'adresse complète de la page d'origine.
--
--  utilisateurs.provenance : posée une seule fois, dans les 24 heures qui
--  suivent l'inscription (api/moi/provenance.post.ts).
--  provenance_cadeaux : la session de paiement d'un cadeau et sa
--  provenance, écrite à l'ouverture du paiement (le cadeau lui-même n'existe
--  qu'une fois payé, dans cadeaux, par la même session_ref).
--
--  Pas de « -- » ni de « ; » dans une chaîne (voir decouper, db.ts).
-- ============================================================================
alter table utilisateurs add column provenance text;
create table if not exists provenance_cadeaux (
  session_ref text primary key,
  provenance  text not null,
  cree_le     text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
