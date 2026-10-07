-- ============================================================================
--  L'achat dans l'app iOS (App Store)
--
--  Sur iPhone, une liste se débloque par l'achat intégré d'Apple : c'est lui
--  qui encaisse, l'app ne reçoit qu'une transaction. Cette table en garde
--  deux moments (server/utils/apple.ts) :
--
--   1. L'INTENTION. Avant d'ouvrir la feuille d'achat d'Apple, le serveur
--      tire un jeton (un UUID) et note pour QUI et pour QUELLE liste. Apple
--      rend ce jeton dans la transaction qu'il signe : c'est par lui, et non
--      par ce que dit l'app, que l'on sait quelle liste débloquer — même si
--      l'app a été fermée entre le paiement et le déblocage.
--   2. L'ACHAT. La transaction relue chez Apple complète la ligne. Un numéro
--      de transaction ne sert qu'une fois (unique) : rejouer la même requête
--      ne débloque pas une seconde liste.
--
--  Un achat qui n'a pas pu s'appliquer (la liste venait d'être débloquée par
--  l'autre parent, ou n'existe plus) reste « d'avance » : payé, pas appliqué
--  (applique_le vide). Il servira à la prochaine liste que son acheteur
--  voudra débloquer. Apple ne laisse pas rembourser depuis un serveur : on ne
--  perd donc jamais l'argent de quelqu'un, on le lui garde.
--
--  Ni carte, ni adresse, ni compte Apple : rien de tout cela n'arrive ici.
--  Le compte efface, la ligne reste sans acheteur (trace d'une vente) ; la
--  liste effacee, sans liste.
--
--  Pas de « -- » ni de « ; » dans une chaîne (voir decouper, db.ts).
-- ============================================================================
create table if not exists achats_apple (
  id             integer primary key autoincrement,
  jeton          text unique,
  user_id        text references utilisateurs(id) on delete set null,
  groupe_id      integer references groupes(id) on delete set null,
  transaction_id text unique,
  environnement  text check (environnement is null or environnement in ('Production', 'Sandbox')),
  produit        text,
  cree_le        text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  achete_le      text,
  applique_le    text,
  rembourse_le   text
);
create index if not exists idx_achats_apple_avance
  on achats_apple (user_id) where transaction_id is not null and applique_le is null;
