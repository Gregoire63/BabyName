-- ============================================================================
--  Les cadeaux : une liste débloquée, achetée pour quelqu'un d'autre
--
--  On achète un CODE (page /offrir, sans compte), on le transmet (lien ou
--  code), et celui qui le reçoit s'en sert pour débloquer une liste déjà
--  commencée ou en créer une, débloquée d'emblée.
--
--  Le code en clair n'est nulle part en base : l'acheteur l'a (page de
--  retour, facture Stripe), Stripe aussi (métadonnées de la session). Ici,
--  son empreinte seulement.
--
--  La ligne n'existe qu'une fois le paiement encaissé : une session
--  abandonnée ne laisse rien. Le webhook et le retour du navigateur y
--  arrivent tous deux ; `session_ref` unique rend le second passage muet.
-- ============================================================================
create table if not exists cadeaux (
  code_hash    text    primary key,
  session_ref  text    not null unique,
  -- pi_… : un remboursement total ou un litige perdu annule le cadeau et, s'il
  -- a servi, re-verrouille la liste (qui porte la même référence)
  paiement_ref text,
  -- « Mamie », un mot : facultatifs, montrés à qui utilise le code
  de_la_part   text,
  message      text,
  achete_le    text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expire_le    text    not null,
  utilise_le   text,
  utilise_par  text    references utilisateurs(id) on delete set null,
  groupe_id    integer references groupes(id) on delete set null,
  annule_le    text
) without rowid;
create index if not exists idx_cadeaux_paiement on cadeaux (paiement_ref);
create index if not exists idx_cadeaux_groupe on cadeaux (groupe_id);
create index if not exists idx_cadeaux_utilisateur on cadeaux (utilise_par);
