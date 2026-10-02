# D'où vient ce skill

`/brag` : une vidéo de lancement de 15 à 25 secondes, faite à partir du
projet. Copié tel quel depuis <https://github.com/latent-spaces/brag>
(dossier `skills/brag/`), commit `cb89b9f` du 1er octobre 2026. Seuls
ajouts : ce fichier et `LICENSE`.

## Mis de côté (2 octobre 2026)

Rangé ici, et pas dans `.claude/skills/` : aucun agent ne le charge tout
seul, rien dans l'app n'en dépend. Pour s'en servir sans l'activer, il
suffit de demander à l'agent de suivre `skills/brag/SKILL.md`.

Pour l'activer dans Claude Code, le copier soi-même, depuis la racine du
dépôt (une session distante ne peut pas écrire dans `.claude`, qui règle le
comportement de Claude Code sur la machine) :

```powershell
Copy-Item -Recurse skills\brag .claude\skills\brag
```

## Licences

| Quoi | Licence | Auteur |
|---|---|---|
| Le skill (`SKILL.md`, `slim.md`, `references/`, `scripts/`) | MIT, voir `LICENSE` | Shunit Haviv Hakimi |
| La musique (`assets/music/*.mp3`) | CC BY 4.0 | Sascha Ende, ende.app |
| Les bruitages (`assets/sfx/`) | CC0 | Kenney (kenney.nl) ; touches de clavier : unicae_games (OpenGameArt) |

La musique : usage commercial permis, crédit apprécié (« Music by Sascha
Ende at ende.app »). Deux interdits : l'inscrire dans un système de type
Content ID, la publier telle quelle comme son propre morceau.
<https://ende.app/en/standard-license>, lu le 2 octobre 2026.

## Mettre à jour

Recopier `skills/brag/` du dépôt d'origine par-dessus ce dossier, puis
remettre ces deux fichiers. Pas `npx skills add` : il pose des liens
symboliques, qui passent mal sous Windows.

## Ce qu'il lui faut

Node 22 et ffmpeg. Sur Claude Opus 5.5, `/brag` passe de lui-même à
`slim.md` (une page, sans Hyperframes ni la musique fournie) ;
`/brag --full` garde le parcours Hyperframes (`npx hyperframes`).
