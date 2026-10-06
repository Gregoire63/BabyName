-- ============================================================================
--  Les appareils à prévenir (apps des stores)
--
--  L'app iOS et l'app Android peuvent recevoir une notification : « Vous
--  avez un nouvel accord », « Alice a rejoint votre liste ». Le téléphone
--  donne pour cela un jeton d'adresse, que le service d'acheminement d'Expo
--  transmet à Apple ou à Google (server/utils/push.ts). Rien d'autre que ce
--  jeton : ni modèle, ni position, ni identifiant publicitaire.
--
--  Un jeton, un compte : le dernier qui s'y connecte le reprend (un téléphone
--  qu'on prête ne reçoit pas les accords de deux couples). Il part avec le
--  compte (cascade), à la déconnexion, quand on coupe les notifications dans
--  l'app, et dès qu'Apple ou Google le disent périmé.
--
--  Pas de « -- » ni de « ; » dans une chaîne (voir decouper, db.ts).
-- ============================================================================
create table if not exists appareils (
  jeton      text primary key,
  user_id    text not null references utilisateurs(id) on delete cascade,
  plateforme text not null check (plateforme in ('ios', 'android')),
  cree_le    text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  vu_le      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) without rowid;
create index if not exists idx_appareils_user on appareils (user_id);
