# Fiches App Store et Google Play — mode d’emploi

Un fichier par langue (`fr.md`, `en.md`, `de.md`, `nl.md`, `sv.md`, `nb.md`, `pl.md`, `lv.md`). Chaque champ est sous un titre `## <store> — <champ> (<limite>)`, son texte seul dans un bloc de code : copier le contenu du bloc, rien d’autre. Toutes les longueurs ont été vérifiées (mots-clés : ≤ 100 aussi en octets UTF-8, par prudence).

Règles tenues partout : pas de prix chiffré ; App Store = gratuit + achat intégré facultatif ; Google Play = « l’app Android ne vend rien » ; pas de mention d’Android/Google dans l’App Store ni d’iPhone/Apple dans Google Play ; hors français, la fiche dit en tête que le catalogue vient des naissances en France (INSEE), que les significations sont en français, et liste les pays chiffrés (pas l’Allemagne, pas les Pays-Bas, pas l’Australie : les fiches de et nl le disent).

## App Store Connect

Apps → babyNamed → **Distribution** → la version (1.1) dans la colonne de gauche.

1. En haut à droite de la page de version, menu de langue → **Ajouter une localisation** (ou le « + »), choisir la langue.
2. Dans la page de la version, pour cette langue : **Texte promotionnel**, **Description**, **Mots-clés**, **Nouveautés de cette version** (le champ « Nouveautés » n’existe que si une version précédente est publiée).
3. **Nom** et **Sous-titre** : Distribution → **Informations sur l’app** (sous « Général »), même menu de langue en haut à droite.
4. Une localisation à la fois, enregistrer à chaque fois. Les captures d’écran peuvent rester celles de la langue principale.

## Play Console

babyNamed → **Développer sa visibilité / Présence sur le Store** → **Fiche Play Store principale** → **Gérer les traductions** → **Ajouter ses propres traductions** → cocher les langues → pour chacune : **Nom de l’application**, **Description courte**, **Description complète**.

**Notes de version** : elles ne sont pas dans la fiche, mais dans la release : Tester/Production → Créer une release → « Notes de version », une balise par langue :

```
<fr-FR>…</fr-FR>
<en-GB>…</en-GB>
```

## Correspondance des langues

| Fichier | App Store Connect | Play Console |
|---|---|---|
| fr.md | Français — fr-FR | Français — fr-FR |
| en.md | Anglais (R.-U.) — en-GB, puis copier dans en-US, en-AU, en-CA | Anglais — en-GB, puis en-US, en-AU, en-CA |
| de.md | Allemand — de-DE | Allemand — de-DE |
| nl.md | Néerlandais — nl-NL | Néerlandais — nl-NL |
| sv.md | Suédois — sv | Suédois — sv-SE |
| nb.md | Norvégien — no | Norvégien — no-NO |
| pl.md | Polonais — pl | Polonais — pl-PL |
| lv.md | **pas de letton dans l’App Store** (liste Apple au 12/10/2026) : l’App Store letton montre en principe la fiche en-GB | Letton — lv |

Rappel : le français de Belgique et de Suisse prend la fiche fr ; le Canada a aussi fr-CA dans les deux stores (copier fr.md si on veut une fiche dédiée, sinon la fiche par défaut s’applique).
