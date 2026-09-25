/**
 * Ce que débloque l'achat d'une liste — une seule source pour les deux écrans
 * qui le disent (la feuille « Débloquer cette liste » et la carte des
 * réglages). Deux copies finiraient par ne plus dire la même chose, et c'est
 * précisément ce qu'on ne peut pas se permettre sur ce qui est vendu.
 *
 * `court` : le titre seul, pour la carte des réglages.
 */
export const INCLUS_DEBLOCAGE = [
  {
    titre: 'Le tri sans limite',
    texte: 'Ni limite de départ, ni quota du jour, pour vous deux. Le rappel d’hygiène reste — juger deux cents prénoms d’affilée donne de moins bonnes décisions — mais il se passe.'
  },
  {
    titre: 'L’essai avec votre nom de famille',
    texte: 'Chaque prénom confronté au vôtre : les voyelles qui se télescopent, les consonnes qui butent, les rimes, la longueur, les initiales involontaires. Ça se calcule sur la prononciation, pas sur l’orthographe.'
  },
  {
    titre: 'Combien dans sa classe',
    texte: 'Le nombre d’enfants qui porteront ce prénom dans une classe de 25, aujourd’hui et projeté à l’entrée en maternelle.'
  },
  {
    titre: 'Ce que vos oui disent de vous',
    texte: 'Les origines qui reviennent, la longueur que vous préférez, le degré de rareté — pour chacun de vous, et là où vous divergez.'
  },
  {
    titre: 'Pourquoi vous n’êtes pas d’accord',
    texte: 'Sur chaque désaccord, ce qui le cause vraiment : « ce n’est peut-être pas Marius, c’est la longueur ». Calculé sur vos votes, et tu par honnêteté quand il n’y a pas encore de quoi le dire.'
  },
  {
    titre: 'Les invités en lecture seule',
    texte: 'Inviter les grands-parents pour qu’ils voient et commentent, sans qu’ils puissent bloquer un prénom ni retarder vos accords.'
  }
] as const
