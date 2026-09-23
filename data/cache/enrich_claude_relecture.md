# Relecture critique — échantillon de 110 entrées d'onomastique

Relecture adversariale, hors ligne. Chaque section = une faute. La gravité est jugée
du point de vue d'un parent qui lirait la fiche et la croirait.

Remarque liminaire, à mettre au crédit du jeu : **aucune étymologie n'a été fabriquée
pour un prénom de pure invention**. Cattaleya, Aerith, Léïa et Elvis sont correctement
traités (`signification: null`, confiance basse, `moderne-inventé` ou `origines: []`).
C'est la faute la plus grave possible, et elle est absente. Les fautes ci-dessous sont
d'un autre ordre : sens faux ou tronqués, chaînes d'origines mal ordonnées, confiance
trop haute sur des étymologies en réalité disputées.

---

## GRAVE

### 1. Odessa — signification fondée sur une identification historique fausse
- **Écrit** : `origines: ["grec"]`, signification « de la ville d'Odessa, ancienne Odessos grecque », confiance `moyenne`.
- **Le problème** : l'Odessos antique, colonie grecque, se trouvait sur le site de l'actuelle
  **Varna (Bulgarie)**, pas sur celui d'Odessa. La ville ukrainienne a été fondée **en 1794**
  par Catherine II, qui lui a donné ce nom sur la base d'une identification erronée (ou
  d'un hellénisme délibéré) avec une colonie supposée voisine. Le mot « ancienne » fait
  croire à une continuité qui n'existe pas. De plus, le nom *Odessos* lui-même est
  probablement **thrace**, non grec : l'origine `grec` est doublement fragile.
- **Ce qui serait juste** : `origines: []` ou `["slave"]` (toponyme russe de 1794) ;
  signification « de la ville d'Odessa » sans la caution antique ; confiance `basse`.
- **Accessoirement** : `objet_marque: true` avec pour seule justification « grande ville
  portuaire d'Ukraine ». Une ville n'est ni un objet, ni un animal, ni une marque, ni un
  personnage — ce n'est pas une catégorie prévue par la consigne. Incohérent d'ailleurs
  avec **Lucca** (l. 50), ville toscane, qui reçoit `objet_marque: false`.
- **Gravité : grave.**

### 2. Atlas — confiance « haute » sur une étymologie en réalité inconnue
- **Écrit** : `origines: ["grec"]`, signification « Titan portant la voûte céleste », confiance `haute`.
- **Le problème** : double faute. (a) Ce n'est **pas une étymologie** mais la description
  d'un personnage mythologique ; la consigne demande « le sens étymologique ». (b) Le sens
  étymologique d'Ἄτλας est **disputé** : la dérivation traditionnelle par ἀ- + τλάω
  (« celui qui porte, qui endure ») est une étymologie antique que les hellénistes modernes
  tiennent largement pour populaire, le nom étant vraisemblablement **pré-grec** ; pour la
  chaîne montagneuse, une source berbère (cf. *adrar*, « montagne ») est régulièrement
  avancée. `haute` est indéfendable.
- **Ce qui serait juste** : signification « celui qui porte, qui supporte ; étymologie
  débattue » ou `null` ; confiance `basse`. `objet_marque: true` (recueil de cartes) est
  en revanche correct.
- **Gravité : grave.**

### 3. Foucauld — le composé germanique est lu à l'envers
- **Écrit** : `origines: ["germanique"]`, signification « peuple qui gouverne », confiance `moyenne`.
- **Le problème** : Foucauld/Foucaud remonte au germanique *Folcwald* / *Fulcoald* :
  **folk** « peuple » + **wald** « gouverner ». Dans un nom germanique à deux thèmes de ce
  type, le second élément est le prédicat : le sens est « **qui gouverne le peuple** »,
  c'est-à-dire le chef. « Peuple qui gouverne » inverse le rapport et se lit comme un
  peuple souverain — ce n'est pas le même sens, et ce n'est pas un nom de personne.
- **Preuve interne** : la même structure est correctement rendue à la ligne 1,
  **Harold** = « chef d'armée » (et non « armée qui commande »). Incohérence dans le jeu.
- **Ce qui serait juste** : « qui gouverne le peuple » ou « chef du peuple ».
- **Gravité : grave** (le sens livré au parent est faux).

### 4. Sahra — un seul rameau retenu là où deux sont vivants
- **Écrit** : `origines: ["hébraïque"]`, signification « variante de Sarah : princesse », confiance `moyenne`.
- **Le problème** : *Sahra* est bien une graphie de Sarah, mais c'est aussi et surtout, en
  turc et en kurde, un prénom courant issu de l'arabe **ṣaḥrāʾ** صحراء, « **désert,
  steppe** » (turc *sahra*). Le prénom est donc un homonyme à deux sources, et l'entrée en
  choisit une sans le dire. Un parent turcophone se verrait attribuer un sens qui n'est
  pas celui de son prénom. C'est exactement le cas de figure « confusion avec un homonyme »
  que la consigne demande d'éviter, et la règle « en cas de doute, baisse la confiance »
  n'a pas été appliquée.
- **Ce qui serait juste** : deux lectures mentionnées, ou signification `null` avec
  confiance `basse` ; a minima `origines: ["arabe", "hébraïque"]` et le doute signalé.
- **Gravité : grave.**

---

## MOYENNE

### 5. Angélique — chaîne d'origines à l'envers
- **Écrit** : `origines: ["grec", "latin"]`.
- **Le problème** : la consigne impose « de la plus directe à la plus lointaine ».
  Angélique vient du latin *angelicus*, lui-même du grec ἄγγελος. L'ordre juste est donc
  **`["latin", "grec"]`** (voire `["français", "latin", "grec"]`). Ici c'est l'ordre
  inverse : le plus lointain d'abord. Violation frontale d'une règle explicite — et
  l'entrée est isolée dans le jeu, qui respecte ailleurs l'ordre (Joanna `["latin","hébraïque"]`,
  Madalena `["portugais","hébraïque"]`, Mirza `["persan","arabe"]`, Saphir `["français","grec","hébraïque"]`).
- **À noter au passage** : `objet_marque: true` pour la plante confite est un bon relevé,
  et les diminutifs réels (« Angie », « Angé ») manquent.
- **Gravité : moyenne.**

### 6. Claudie — « boiteux » donné pour acquis
- **Écrit** : « féminin de Claude, du latin *claudus* : boiteux », confiance `haute`.
- **Le problème** : Claude vient du gentilice romain *Claudius*, porté par une **gens
  d'origine sabine** qui faisait remonter son nom à l'ancêtre *Attius Clausus*. Le
  rapprochement avec l'adjectif *claudus* « boiteux » est l'étymologie traditionnelle des
  dictionnaires de prénoms, mais elle n'est **pas assurée** : le gentilice précède
  probablement l'association. Donner cela en `haute` à des parents — en leur annonçant que
  le prénom signifie « boiteux » — est à la fois trop sûr et socialement lourd.
- **Ce qui serait juste** : confiance `moyenne`, et « du gentilice Claudius, rattaché
  traditionnellement à *claudus* ».
- **Gravité : moyenne.**

### 7. Jenny — la branche la plus ancienne est passée sous silence
- **Écrit** : `origines: ["celtique"]`, « blanche et douce, diminutif de Jennifer ».
- **Le problème** : *Jenny* est attesté depuis le Moyen Âge anglais comme hypocoristique de
  **Jane / Janet** (donc de Jean, hébreu *Yohanan*, « Dieu fait grâce ») — bien avant que
  Jennifer ne devienne un prénom répandu (XXe siècle). Les deux filiations sont réelles ;
  n'en donner qu'une, et avec elle une origine `celtique` exclusive, tranche un débat
  ouvert. La glose « blanche et douce » pour Jennifer (< Gwenhwyfar) est en revanche correcte.
- **Ce qui serait juste** : `origines: ["anglo-saxon", "hébraïque"]` **ou** `["celtique"]`
  selon la filiation, avec les deux lectures signalées ; `charge_epellation` à 1 plutôt
  que 0 (Jenny/Jennie/Jeny).
- **Gravité : moyenne.**

### 8 et 9. Maelia et Maélie — créations françaises récentes données pour « celtiques »
- **Écrit** : `origines: ["celtique"]`, « dérivé de Maël : prince, chef ».
- **Le problème** : *Maël* est bien breton (*mael*, « prince, chef ») et cette partie est
  juste. Mais **Maelia** et **Maélie** sont des dérivés **français des années 1990-2000**,
  formés en France sur Maël ; ce ne sont pas des prénoms celtiques attestés. L'origine la
  plus directe — celle que la consigne demande en premier — est `français`, le celtique
  n'étant que la couche lointaine.
- **Ce qui serait juste** : `["français", "celtique"]` pour les deux.
- **Gravité : moyenne** (× 2 entrées).

### 10. Lounna — `["latin"]` affirmé sur un prénom dont la source est contestée
- **Écrit** : `origines: ["latin"]`, « variante de Luna : lune ».
- **Le problème** : *Louna* est une création française récente dont l'explication varie
  selon les sources : rapprochement avec le latin *luna*, mais aussi agglutination
  Lou + Anna, et forme berbère/kabyle. Choisir la seule filiation latine, sans mentionner
  l'étape française ni le doute, donne au parent une certitude qui n'existe pas. La graphie
  redoublée *Lounna* est par ailleurs une fantaisie graphique pure.
- **Ce qui serait juste** : `["français", "latin"]` avec le doute mentionné, ou
  `["moderne-inventé"]` et `signification: null`.
- **Gravité : moyenne.**

### 11. Zendaya — création personnelle présentée comme un prénom africain traditionnel
- **Écrit** : `origines: ["africain"]`, « rendre grâce, dire merci », confiance `moyenne`.
- **Le problème** : *Zendaya* n'est pas un prénom africain traditionnel : c'est une
  **création de ses parents**, formée à partir du shona **Tendai** (« rendre grâce »).
  Le sens donné est celui de *Tendai*, pas de *Zendaya*, qui n'a par lui-même aucune
  étymologie. C'est précisément le cas visé par la consigne (« null si le prénom est une
  création moderne sans sens »).
- **Ce qui serait juste** : `origines: ["moderne-inventé"]` (ou `["africain"]` avec la
  mention explicite de la création), `signification: null` ou « formé sur le shona Tendai,
  rendre grâce », confiance `basse`.
- **Gravité : moyenne** (frôle le grave : sens attribué à un nom qui n'en a pas en propre).

### 12. Eddie — « richesse » ne rend que la moitié du nom
- **Écrit** : `origines: ["anglo-saxon"]`, « richesse ; diminutif d'Edward ».
- **Le problème** : *Edward* < vieil-anglais **Ēadweard** = *ēad* « richesse, prospérité »
  + *weard* « **gardien** », soit « gardien de la prospérité ». Amputer le second thème
  donne un sens faux par troncature — la même faute que le jeu évite correctement pour
  Harold (« chef d'armée ») ou Stanley (« clairière pierreuse »). Par ailleurs *Eddie*
  abrège aussi Edwin, Edmund et Edgar, ce que l'entrée ne dit pas.
- **Ce qui serait juste** : « gardien de la richesse » ; mention des autres bases.
- **Gravité : moyenne.**

### 13. Scarlett — l'étape anglaise sautée
- **Écrit** : `origines: ["français"]`, « de l'ancien français *escarlate* : étoffe écarlate ».
- **Le problème** : l'étymon est juste, mais *Scarlett* est un **nom de famille anglais**
  (métier de teinturier/drapier) devenu prénom en anglais ; l'ancien français n'est que la
  couche lointaine. L'origine la plus directe manque. En outre, *escarlate* est lui-même un
  emprunt (latin médiéval *scarlata*, d'une source orientale, persan/arabe) : la chaîne
  s'arrête tôt dans les deux sens.
- **Ce qui serait juste** : `["anglo-saxon", "français"]`.
- **Gravité : moyenne.**

### 14. Béryl — chaîne arrêtée au grec, qui n'est pourtant qu'un relais
- **Écrit** : `origines: ["grec"]`, « nom d'une pierre précieuse », confiance `moyenne`.
- **Le problème** : le grec βήρυλλος est lui-même un **emprunt indien** (prakrit
  *veruliya*, sanskrit *vaiḍūrya*), arrivé par voie orientale. La consigne autorisant
  jusqu'à trois origines, s'arrêter au grec masque la couche la plus lointaine.
  Accessoirement, *Beryl* comme prénom est une création anglaise du XIXe siècle (vague des
  prénoms-gemmes), ce qui ferait de `anglo-saxon` l'origine la plus directe.
- **Ce qui serait juste** : `["anglo-saxon", "grec", "indien"]` ou au moins `["grec", "indien"]`.
- **Gravité : moyenne.**

### 15. Ginny — la note contredit l'étymologie donnée
- **Écrit** : « diminutif anglais de Virginia : vierge » + `objet_marque_note` « Ginny
  Weasley, personnage de Harry Potter ».
- **Le problème** : incohérence interne. Ginny Weasley s'appelle **Ginevra** — c'est-à-dire
  Guenièvre, de la même souche celtique que Jennifer, **pas** Virginia. L'entrée justifie
  donc son `objet_marque` par un personnage dont le prénom relève d'une autre étymologie
  que celle qu'elle vient d'énoncer. Deuxièmement, *Virginia* vient du gentilice
  *Verginius/Virginius*, d'origine incertaine ; le sens « vierge » est un rattachement
  secondaire à *virgo* — heureusement la confiance est ici `basse`. Troisièmement,
  Ginny Weasley est un personnage secondaire : dire qu'elle « écrase » le prénom est
  discutable.
- **Gravité : moyenne.**

### 16. Enzio — une seule branche d'une étymologie franchement disputée
- **Écrit** : `["italien", "germanique"]`, « variante d'Enzo, du germanique Heinz ».
- **Le problème** : l'origine d'*Enzo* est un cas d'école de désaccord. Deux thèses
  coexistent : (a) altération italienne de **Heinz** (Heinrich), par Enzio de Sardaigne,
  fils de Frédéric II ; (b) hypocoristique de prénoms en **-enzo** (Vincenzo, Lorenzo),
  donc latin. L'entrée présente (a) comme la filiation, sans mentionner (b). La confiance
  `moyenne` amortit, mais la consigne demandait de ne pas trancher.
- **Ce qui serait juste** : mentionner l'alternative, ou `signification: null`.
- **Gravité : moyenne.**

---

## VÉTILLES

### 17. Chaînes d'origines amputées de la langue véhiculaire (8 entrées)
`origines` ne retient que la source hébraïque ultime, en sautant la langue par laquelle
le prénom est réellement arrivé — alors que le jeu sait faire (Joanna `["latin","hébraïque"]`,
Madalena `["portugais","hébraïque"]`, Yahia `["arabe","hébraïque"]`). Incohérence interne :
- **Josépha** `["hébraïque"]` → `["français", "hébraïque"]` ou `["espagnol", "hébraïque"]`
- **Mattias** `["hébraïque"]` → `["scandinave", "hébraïque"]`
- **Jayne** `["hébraïque"]` → `["anglo-saxon", "hébraïque"]`
- **Judie** `["hébraïque"]` → `["anglo-saxon", "hébraïque"]`
- **Gabryel** `["hébraïque"]` → `["français", "hébraïque"]`
- **Samuella** `["hébraïque"]` → `["italien"/"français", "hébraïque"]`
- **John** `["anglo-saxon", "hébraïque"]` : le relais latin/grec (Iohannes, Ioannes) manque,
  et John est entré en anglais par le français normand, pas par le vieil-anglais.
- **Léopaul** `["latin"]` : composé **français** moderne de deux éléments latins ; l'étape
  française manque.
*Gravité : vétille (× 8).*

### 18. `signification` qui décrit une dérivation au lieu de donner un sens (4 entrées)
La consigne demande « le sens étymologique ». Ces entrées renvoient à un autre prénom sans
jamais livrer le sens, laissant le parent sans réponse :
- **Tomy** : « graphie de Tommy, diminutif de Thomas » — le sens (« **jumeau** », araméen
  *tĕʾōmā*) n'apparaît nulle part, alors que `origines` mentionne bien l'araméen.
- **Lizon** : « graphie de Lison, diminutif d'Élisabeth » — le sens d'Élisabeth
  (« mon Dieu est serment / plénitude ») manque.
- **Judie** : « graphie de Judy, diminutif de Judith » — « femme de Judée / juive » manque.
- **Ilda** : « élément *hild* : combat » — note métalinguistique plutôt que sens ;
  il fallait « combat ».
*Gravité : vétille (× 4, Judie déjà comptée ci-dessus → 3 entrées nouvelles).*

### 19. Formule d'introduction métalinguistique (2 entrées)
La consigne interdit l'article introductif et demande le sens nu (modèle « force de Dieu ») :
- **Flavio** : « du latin *flavus*, blond, doré » → « blond, doré ».
- **Olivio** : « du latin *oliva* : olivier, olive » → « olivier ». À noter que
  l'étymologie d'Olivier est elle-même disputée (latin *oliva* vs. norrois *Áleifr*
  latinisé en *Olivarius*) et que l'entrée n'en dit rien.
*Gravité : vétille.*

### 20. Attributions plausibles mais non établies, confiance à peine amortie (3 entrées)
- **Maïda** — « table servie » (arabe *al-māʾida*, sourate V) est une hypothèse répandue,
  mais le prénom circule aussi par des voies bosniaque et italienne (Maida, Calabre).
  Rien n'est signalé.
- **Klea** — donné pour grec (*kleos*, « gloire »). En pratique, *Klea* est surtout un
  prénom albanais récent, souvent analysé comme abrègement de Kleopatra, voire comme
  création moderne. Le lien direct à *kleos* est une reconstruction.
- **Rares** — « rare, peu commun » : la base roumaine *rar* (< latin *rarus*) est juste,
  mais *Rareș* est à l'origine un **sobriquet** (cheveux/barbe clairsemés) porté par Petru
  Rareș, pas un adjectif de valeur. La couche roumaine n'est de toute façon pas
  représentable dans le vocabulaire imposé — limite de la consigne plus que de l'entrée.
*Gravité : vétille.*

### 21. Glose extrapolée — Cosma
« ordre, univers, harmonie » : κόσμος signifie « ordre, arrangement, parure », et par
extension « monde ». « Harmonie » est une extrapolation moderne. Par ailleurs *Cosma* est
une forme italienne/corse/roumaine de Cosmas : `origines: ["grec"]` saute le relais.
*Gravité : vétille.*

### 22. Glose unique là où trois lectures se disputent — Samuella
« son nom est Dieu » est une lecture défendable (*shem* + *El*), mais deux autres sont au
moins aussi citées : « Dieu a entendu » (*shamaʿ* + *El*) et « demandé à Dieu » (étymologie
populaire de 1 Samuel 1,20). Le choix n'est pas signalé. La confiance `moyenne` amortit.
*Gravité : vétille (entrée déjà comptée en §17).*

### 23. `objet_marque` discutables (2 entrées)
- **Marina** — « une marina désigne un port de plaisance » : le mot existe en français mais
  reste un emprunt peu employé ; le critère « en français courant » est tendu.
- **Jackson** — « renvoie immédiatement à Michael Jackson » : la célébrité porte sur un
  **nom de famille**, pas sur le prénom Jackson. Le critère de la consigne (« un personnage
  si célèbre qu'il écrase le prénom », modèle Elvis) n'est pas rempli de la même façon.
*Gravité : vétille.* (Voir aussi **Odessa**, §1, où le problème est réel.)

### 24. Diminutifs inversé ou manquants (3 entrées)
- **Lolita** : `diminutifs: ["Lola"]` — la filiation est inverse. Lola est l'hypocoristique
  de **Dolores**, et *Lolita* est le diminutif **de Lola**, pas le contraire.
- **Massimo** : « Max » est d'usage courant, absent.
- **Julianne** : « Julie », « Juju » sont d'usage courant, absents.
(La même lacune touche **Angélique** → « Angie », comptée en §5.)
*Gravité : vétille.*

### 25. `charge_epellation` sous-évaluée (4 entrées)
- **Zéphyr** (2) et **Zéphir** (2) : le jeu contient lui-même les deux graphies
  concurrentes — c'est la définition du niveau **3**.
- **Hédi** (1) : Hédi / Hedi / Hadi, plus l'accent à dicter → **2**.
- **Harold** (0) : prénom rare en France, confondu à l'oral avec Arnold/Harald → **1**.
*Gravité : vétille.*

### 26. Origine `germanique` là où `anglo-saxon` serait plus direct — Alvine
« ami des elfes, ou noble ami » est un bon traitement (les deux étymons, *Ælfwine* et
*Æthelwine*, sont donnés, avec le doute). Mais l'origine la plus directe est
**anglo-saxonne** (et française pour la forme féminine *Alvine*), le germanique n'étant que
la couche lointaine.
*Gravité : vétille.*

---

## Ce qui tient

Pour situer les fautes ci-dessus : le bloc arabe (Wahid, Moulay, Aymane, Ayah, Safaa,
Ibtissam, Hayet, Hussain, Mounira, Qasim, Shakur, Ihssan, Jamila, Kheira, Nazra, Ranim,
Madani, Abdou, Sidi, Warda) est **exact de bout en bout**, y compris sur des points fins
(Husayn diminutif de Hasan, Shakūr intensif de shākir, *ayah* « signe/verset »).
Plusieurs entrées sont même remarquablement bien tenues :
- **Tonie** — « de la gens Antonia, sens incertain », `["latin", "étrusque"]` : le doute
  est nommé au lieu d'être comblé.
- **Doron** — `["hébraïque", "grec"]` : l'emprunt du grec δῶρον par l'hébreu mishnique est
  correctement restitué, dans le bon ordre.
- **Mirza** — `["persan", "arabe"]`, « fils de prince » : la composition *amīr* + *-zāda*
  est exacte et bien ordonnée.
- **Yseult** — « d'Essylt ; étymologie débattue », confiance `basse`.
- **Haroon** — forme arabe d'Aaron, sans sens inventé (l'étymologie d'Aaron est obscure).
- **Cattaleya, Aerith, Léïa, Elvis** — `signification: null`, confiance `basse`.

---

## Compte

| Gravité | Entrées | Détail |
|---|---|---|
| **Grave** | **4** | Odessa, Atlas, Foucauld, Sahra |
| **Moyenne** | **12** | Angélique, Claudie, Jenny, Maelia, Maélie, Lounna, Zendaya, Eddie, Scarlett, Béryl, Ginny, Enzio |
| **Vétille** | **27** | Josépha, Mattias, Jayne, Judie, Gabryel, Samuella, John, Léopaul, Tomy, Lizon, Ilda, Flavio, Olivio, Maïda, Klea, Rares, Cosma, Marina, Jackson, Lolita, Massimo, Julianne, Zéphyr, Zéphir, Hédi, Harold, Alvine |
| **Total douteux** | **43 / 110** | |
| **Non contestées** | **67 / 110** | |

**Lecture d'ensemble.** Aucune étymologie n'est purement inventée, et les prénoms de
création moderne sont correctement laissés vides : la faute la plus grave que redoutait la
consigne est évitée. Les quatre fautes graves sont de nature différente — trois sens
factuellement faux ou insoutenables (Odessa, Foucauld, Sahra) et une confiance `haute`
posée sur une étymologie en réalité inconnue (Atlas). Le défaut le plus systématique, et de
loin, n'est pas l'invention mais **l'ordre et la longueur des chaînes d'origines** : la
règle « de la plus directe à la plus lointaine » est appliquée correctement dans la majorité
des cas mais sautée ou inversée dans une quinzaine d'entrées, presque toujours en supprimant
la langue véhiculaire au profit de la source ultime. Second défaut systématique : la
confiance est globalement **trop généreuse** — 52 entrées sur 110 portent `haute`, dont
plusieurs sur des gentilices romains d'origine reconnue incertaine, alors que la consigne
disait « sois sévère ».
