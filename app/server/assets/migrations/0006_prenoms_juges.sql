-- ============================================================================
--  « Prénoms jugés » : des prénoms, pas des graphies
--
--  `nb` comptait chaque entrée du bulletin : un swipe sur Louise en comptait
--  trois (Louise, Loïse, Louize), et l'écran annonçait « 3 jugés » pour un
--  seul prénom regardé. Il compte désormais les prénoms jugés pour
--  eux-mêmes : une graphie qui a suivi sa tête (balayage « ph:… ») n'en
--  ajoute pas. Un nom écarté avec toute sa famille, lui, compte : c'était une
--  carte de la pile.
--
--  Pas de « -- » ni de « ; » dans une chaîne (voir decouper, db.ts).
-- ============================================================================
update bulletins set nb =
    (select count(*) from json_each(bulletins.positifs) j
      where coalesce(json_extract(j.value, '$[2]'), '') not like 'ph:%')
  + (select count(*) from json_each(bulletins.negatifs) j
      where coalesce(json_extract(j.value, '$[2]'), '') not like 'ph:%');
