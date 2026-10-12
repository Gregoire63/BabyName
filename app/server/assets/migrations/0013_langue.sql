-- ============================================================================
--  La langue du compte (app/composables/useLangue.ts : français, anglais,
--  et les langues des pays dont l'app montre les chiffres)
--
--  langue        : celle que l'app affiche à ce compte, la dernière connue.
--                  C'est elle qu'emploient les e-mails et les notifications.
--  langue_choix  : celle qu'il a choisie dans son compte ; vide, c'est
--                  « Automatique » — la langue du téléphone ou du navigateur
--                  (app/composables/useLangue.ts). Suit sur les autres
--                  appareils.
--
--  Pas de « -- » ni de « ; » dans une chaîne (voir decouper, db.ts).
-- ============================================================================
alter table utilisateurs add column langue text not null default 'fr' check (langue in ('fr', 'en', 'de', 'nl', 'sv', 'nb', 'pl', 'lv'));
alter table utilisateurs add column langue_choix text check (langue_choix in ('fr', 'en', 'de', 'nl', 'sv', 'nb', 'pl', 'lv'));
