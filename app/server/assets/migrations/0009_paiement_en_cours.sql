-- ============================================================================
--  Un seul paiement à la fois par liste
--
--  Deux parents qui décident d'acheter le même soir ouvraient chacun leur page
--  de paiement, et payaient deux fois la même liste. Ouvrir le paiement pose
--  désormais une réservation : qui (paiement_en_cours_par), quelle session
--  Stripe (paiement_en_cours_session), jusqu'à quand (paiement_en_cours_jusqu,
--  l'échéance de la session Stripe elle-même). L'autre parent voit qu'un
--  paiement est en cours au lieu de payer une seconde fois.
--
--  Pas de « -- » ni de « ; » dans une chaîne (voir decouper, db.ts).
-- ============================================================================
alter table groupes add column paiement_en_cours_par text;
alter table groupes add column paiement_en_cours_session text;
alter table groupes add column paiement_en_cours_jusqu text;
