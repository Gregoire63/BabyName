# Registre des activités de traitement — babyNamed

Article 30 du RGPD. L'exemption des structures de moins de 250 personnes ne
joue pas ici : elle ne vaut que pour des traitements **occasionnels**, et ceux
d'une application en ligne sont permanents. Ce registre se présente à la CNIL
sur simple demande ; il se tient à jour à chaque nouveau traitement, nouveau
prestataire ou nouvelle durée.

Tenu par : Grégoire Raturat, entrepreneur individuel, éditeur de babyNamed
— gregoireraturatpro@gmail.com. Pas de délégué à la protection des données
(non obligatoire : ni organisme public, ni suivi à grande échelle, ni données
sensibles à grande échelle).

Dernière mise à jour : 7 octobre 2026.

Les durées ci-dessous sont celles de `shared/utils/editeur.ts` (`CONSERVATION`),
appliquées chaque nuit par `server/utils/conservation.ts`. Si l'une change,
elle change ici, dans le code, et dans la politique de confidentialité — qui
lit la même constante.

---

## 1. Comptes utilisateurs

| | |
|---|---|
| **Finalité** | Identifier chaque utilisateur et lui permettre de retrouver son compte sur un autre appareil. |
| **Base légale** | Exécution du contrat (conditions d'utilisation) — art. 6.1.b. |
| **Personnes** | Utilisateurs de l'app. |
| **Données** | Nom affiché (libre, souvent un prénom) ; adresse e-mail, enregistrée seulement une fois prouvée (lien ou code reçu) ; passkeys : clé publique, nom, dates de création et d'utilisation (rien de biométrique) ; liens et codes de connexion, en empreintes ; dates de création et de dernière activité. Pas de mot de passe, pas de téléphone. |
| **Destinataires** | Éditeur (maintenance). Sous-traitants : Cloudflare (hébergement de l'app et base de données D1) ; OVH (envoi des e-mails d'inscription, de connexion et d'alerte ; sauvegardes chiffrées) ; GitHub (sauvegarde nocturne, le temps de chiffrer). Les autres membres des listes voient le nom affiché. |
| **Transferts hors UE** | Cloudflare, Inc. (États-Unis) : Data Privacy Framework + clauses contractuelles types. La base D1 est créée avec la juridiction « eu » : ses données restent dans l'Union européenne ; le serveur (Worker) s'exécute au plus près du visiteur. GitHub, Inc. (États-Unis) : Data Privacy Framework + clauses contractuelles types. |
| **Conservation** | Jusqu'à la suppression par l'utilisateur (immédiate) ; sinon effacement automatique après 24 mois sans activité. Liens et codes de connexion : 15 minutes, un seul usage, puis effacés par la purge nocturne. Sauvegardes : retour arrière D1 (*Time Travel*) de 7 jours ; copies chiffrées chez OVH, les 30 dernières nuits puis une par mois pendant 12 mois. |
| **Sécurité** | HTTPS ; liens en empreintes (SHA-256), codes signés (HMAC), essais limités ; passkeys : clé publique seulement ; cookie de session signé (HMAC), `HttpOnly`, `Secure`, `SameSite=Lax`, 120 jours, révocable (« Déconnecter mes autres appareils ») ; secrets côté serveur uniquement. |

## 2. Listes de prénoms

| | |
|---|---|
| **Finalité** | Le service : trier des prénoms à plusieurs, vote à l'aveugle, accords, classement, commentaires, observateurs. |
| **Base légale** | Exécution du contrat — art. 6.1.b. |
| **Personnes** | Utilisateurs membres d'une liste. |
| **Données** | Nom de la liste ; nom de famille de l'enfant (facultatif) ; filtres ; votes, vetos (et leur motif, visible de son seul auteur), prénoms « déjà pris » (et leur note, visibles de toute la liste avec le nom de leur auteur), favoris, duels, classements, commentaires ; l'ordre des accords, commun à la liste (sans auteur) ; appartenance et rôle dans chaque liste. |
| **Destinataires** | Membres de la même liste, selon la règle du vote à l'aveugle (un vote n'est visible qu'à qui a voté sur le même prénom ; un veto n'est jamais attribué ; un prénom « déjà pris » l'est, c'est son principe). Éditeur, sous-traitants comme ci-dessus. |
| **Transferts hors UE** | Comme ci-dessus. |
| **Conservation** | Liée au compte (effacée avec lui). Exception : un prénom « déjà pris » appartient à la liste — il y reste, sans son auteur ni sa note (clé étrangère `set null` + trigger, migration 0002). Une liste est effacée quand son propriétaire la supprime (pour tous), ou quand il n'y reste plus personne pour décider. Quitter une liste efface ce qu'on y a donné ; ses « déjà pris » y restent, sans auteur ni note. |
| **Sécurité** | Aucune lecture des votes d'autrui hors de `server/utils/votes.ts` ; contrôle d'appartenance sur chaque route (`exigerMembre`). |

## 3. Limite d'usage de la version gratuite

| | |
|---|---|
| **Finalité** | Appliquer les limites des listes gratuites : un lot de départ, puis un nombre par jour. |
| **Base légale** | Exécution du contrat — art. 6.1.b. |
| **Données** | Par personne et par liste : le nombre de gestes du lot de départ (un total), et celui du dernier jour de tri (un jour, un nombre). |
| **Conservation** | Totaux : avec le compte ou la liste. Compteur du jour : un seul par liste et par personne, remplacé au jour de tri suivant, effacé au bout de 62 jours (le quota ne lit que le jour en cours). |

## 3 bis. Notifications de l'app (iOS, Android)

| | |
|---|---|
| **Finalité** | Prévenir l'utilisateur, sur son téléphone, d'un nouvel accord dans une de ses listes ou de l'arrivée d'une personne. |
| **Base légale** | Consentement — art. 6.1.a : un geste dans l'app (« Me prévenir »), puis l'autorisation du téléphone. Rien n'est enregistré sans ce geste, même sur un téléphone qui autorise les notifications d'office. Retirable à tout moment : « Ne plus me prévenir », ou les réglages du téléphone. |
| **Personnes** | Utilisateurs de l'app iOS ou Android qui activent les notifications. Le site (navigateur) n'est pas concerné. |
| **Données** | Table `appareils` (migration 0011) : jeton de notification (une adresse d'acheminement), système (iOS ou Android), dates d'enregistrement et de dernière ouverture, compte. Contenu des messages : « Nouvel accord » — **jamais le prénom** ; ou le nom affiché de la personne arrivée et le nom de la liste. |
| **Destinataires** | Expo (650 Industries, Inc.) : acheminement. Apple (iOS) ou Google (Android, Firebase Cloud Messaging) : remise au téléphone. |
| **Transferts hors UE** | Expo : États-Unis — Data Privacy Framework + clauses contractuelles types. Apple Distribution International et Google Ireland : Irlande, traitements possibles aux États-Unis (clauses contractuelles types ; Data Privacy Framework pour Google). |
| **Conservation** | Tant que les notifications sont actives sur ce téléphone. Effacé quand on les coupe, à la déconnexion, par « Déconnecter mes autres appareils », avec le compte, et dès que le service le dit périmé (app désinstallée). Expo dit ne pas conserver le contenu des messages. |
| **Sécurité** | Le jeton ne sort pas du serveur (l'export de l'utilisateur ne donne que le système et les dates) ; un jeton, un compte : le dernier connecté le reprend ; le message ne porte jamais le prénom, qui s'afficherait sur un écran verrouillé. |

## 4. Vente : déblocage d'une liste

| | |
|---|---|
| **Finalité** | Vendre le déblocage, facturer, prouver l'accord à l'exécution immédiate, traiter remboursements et contestations. |
| **Base légale** | Exécution du contrat (6.1.b) ; obligations comptables et fiscales (6.1.c). |
| **Personnes** | Acheteurs. |
| **Données** | **Sur le site (Stripe).** Dans l'app : date de déblocage, compte acheteur, référence du paiement Stripe (`pi_…`), liste offerte ou vendue. Chez Stripe : e-mail, moyen de paiement, pays, données antifraude, facture ; métadonnées d'accord (version des conditions, horodatage, renonciation à la rétractation). **Dans l'app iPhone (achat intégré de l'App Store).** Dans l'app (table `achats_apple`, et `groupes.paiement_ref = apple:<numéro>`) : jeton tiré au hasard avant l'achat, compte et liste visés, numéro de transaction de l'App Store, environnement (production ou bac à sable), produit, dates d'achat, d'application et de remboursement. Chez Apple : compte Apple, moyen de paiement, reçu. Apple ne transmet ni nom, ni e-mail, ni moyen de paiement ; la transaction relue chez Apple contient aussi le pays de la boutique et le prix, qui ne sont pas enregistrés. |
| **Destinataires** | Stripe Payments Europe, Ltd. (Irlande) — sous-traitant pour le paiement, responsable de ses propres traitements (fraude, obligations financières). Apple Distribution International Ltd. (Irlande) — encaisse en son nom les achats de l'app iPhone (commissionnaire), responsable de ses propres traitements. Éditeur (comptabilité). |
| **Transferts hors UE** | Stripe, Inc. (États-Unis) pour certains traitements : Data Privacy Framework + clauses contractuelles types. Apple Inc. (États-Unis) pour certains traitements : clauses contractuelles types. |
| **Conservation** | Pièces comptables : 10 ans (art. L123-22 du Code de commerce), chez Stripe ou Apple (relevés de ventes d'App Store Connect) et dans la comptabilité. Dans l'app : tant que la liste existe ; l'effacement de l'acheteur met la référence du compte à NULL, la liste reste débloquée pour ses autres membres. Achat Apple : la ligne part quand il ne reste ni l'acheteur ni la liste ; une intention sans achat, après `CONSERVATION.intentionAchatMois` (3 mois), par la purge nocturne. |
| **Sécurité** | Aucune donnée de carte ne transite par l'app (page de paiement hébergée par Stripe, PCI-DSS ; feuille d'achat d'Apple) ; webhook Stripe signé (HMAC, 5 min, comparaison en temps constant) ; clé restreinte à *Checkout Sessions*. Achat Apple : rien de ce que dit l'app n'est cru, chaque transaction est relue chez Apple (App Store Server API) avec une clé privée tenue dans les secrets du Worker ; les notifications d'Apple ne servent que de signal, l'état est relu chez Apple. |

## 4 bis. Cadeaux : codes qui débloquent une liste

| | |
|---|---|
| **Finalité** | Vendre un code cadeau sans compte, le remettre à qui le détient, montrer au destinataire de qui il vient, traiter rétractation (14 jours tant qu'il n'a pas servi), remboursement et contestation. |
| **Base légale** | Exécution du contrat (6.1.b) ; obligations comptables et fiscales (6.1.c). |
| **Personnes** | Acheteurs (souvent sans compte) ; destinataires (comptes). |
| **Données** | Dans l'app (table `cadeaux`) : empreinte SHA-256 du code (jamais le code), nom et mot facultatifs de l'offrant, dates d'achat, d'échéance, d'utilisation et d'annulation, compte et liste de l'utilisation, références Stripe (`cs_…`, `pi_…`). Chez Stripe : e-mail et moyen de paiement de l'acheteur, code en clair (métadonnées, facture), nom et mot. |
| **Destinataires** | Le destinataire du code (nom et mot de l'offrant) ; les membres de la liste débloquée (« un cadeau de… ») ; Stripe comme au 4. |
| **Transferts hors UE** | Comme au 4. |
| **Conservation** | Code inutilisé : jusqu'à son échéance (`CONSERVATION.cadeauMois`, 24 mois), puis effacé par la purge nocturne ; annulé : un mois ; utilisé : tant que la liste existe. Pièces comptables : comme au 4. |
| **Sécurité** | Code de 12 caractères (30^12) ; seule l'empreinte est en base ; vérification et utilisation limitées par adresse et par compte ; consommation atomique (un code ne sert qu'une fois, même à deux au même instant). |

## 5. Journaux techniques et sécurité

| | |
|---|---|
| **Finalité** | Faire fonctionner et sécuriser le service, diagnostiquer les pannes. |
| **Base légale** | Intérêt légitime (sécurité du service) — art. 6.1.f. |
| **Données** | Requête (date, méthode, URL, métadonnées techniques dont l'adresse IP) dans les journaux de Cloudflare (Workers Logs). Les journaux applicatifs ne contiennent ni identifiant ni contenu (la purge ne journalise que des nombres). |
| **Destinataires** | Cloudflare (sous-traitant). |
| **Conservation** | 3 jours (Workers Logs, plan gratuit ; 7 jours en plan payant). |

## 6. Demandes d'exercice des droits et assistance

| | |
|---|---|
| **Finalité** | Répondre aux demandes d'accès, d'effacement, d'opposition, et aux questions. |
| **Base légale** | Obligation légale (art. 12 à 22 du RGPD) — 6.1.c ; assistance : exécution du contrat. |
| **Données** | E-mail de la personne, contenu de sa demande, éléments de vérification (jamais un code de connexion). |
| **Destinataires** | Éditeur ; Google (messagerie Gmail). |
| **Conservation** | Le temps de traiter la demande, puis 5 ans pour la preuve de la réponse (prescription civile), messagerie comprise. |

---

## Analyse de risques

- **Pas d'analyse d'impact (AIPD)** : aucun des critères de la CNIL n'est réuni
  (pas de données sensibles collectées, pas de profilage à effet juridique, pas
  de surveillance, pas de grande échelle, pas de croisement de fichiers).
- **Point d'attention** : utiliser l'app peut laisser deviner un projet
  d'enfant. Aucune donnée de santé n'est demandée (ni date de terme, ni
  grossesse), et c'est une raison de plus pour ne jamais ajouter de
  publicité, de mesure d'audience tierce ou de partage commercial : toute
  évolution dans ce sens appellerait une nouvelle analyse, et sans doute le
  consentement.
- **Notifications** (apps iOS et Android) : elles s'affichent sur un écran
  verrouillé, au nom de l'app. Elles sont facultatives (un geste), se coupent
  d'un geste, et ne portent jamais le prénom.
- **Minimisation déjà faite** : e-mails de l'époque du lien magique effacés
  (colonne remise à NULL, table des jetons vidée) ; police de caractères
  servie par l'app (plus de transfert d'IP à Google) ; clé d'accès des
  premiers comptes supprimée, empreintes et colonne comprises (septembre 2026).

## Violations de données (art. 33.5)

Toute violation se consigne ici, même non notifiée : date, nature, données et
personnes touchées, conséquences, mesures prises. Notification à la CNIL sous
72 h si risque pour les personnes (notifications.cnil.fr) ; aux personnes si
risque élevé.

| Date | Nature | Données / personnes | Conséquences | Mesures | Notifiée ? |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## Sous-traitants : contrats

| Prestataire | Rôle | Contrat de sous-traitance (art. 28) |
|---|---|---|
| Cloudflare, Inc. | Hébergement (Workers) et base de données (D1) | DPA intégré aux conditions de Cloudflare (cloudflare.com/cloudflare-customer-dpa) |
| OVH SAS | Messagerie de babynamed.fr (e-mails d'inscription, de connexion, d'alerte) ; hébergement des sauvegardes chiffrées | Annexe sur la protection des données des conditions de service OVHcloud, acceptée avec le contrat. **À joindre** au registre. |
| GitHub, Inc. | Sauvegarde nocturne (GitHub Actions) : la base y passe le temps d'être exportée et chiffrée | **À vérifier** : le GitHub Data Protection Agreement couvre-t-il un compte gratuit ? Sinon, faire tourner la sauvegarde ailleurs. |
| Stripe Payments Europe, Ltd. | Paiement | Stripe Data Processing Agreement (stripe.com/legal/dpa) |
| Expo (650 Industries, Inc.) | Acheminement des notifications des apps iOS et Android | **À vérifier** : conditions et politique d'Expo (expo.dev/terms, expo.dev/privacy ; sous-traitants : expo.dev/privacy/subprocessors). Demander l'accord de sous-traitance s'il n'est pas intégré aux conditions. |
| Apple Distribution International Ltd. | Remise des notifications sur iOS (APNs) ; encaissement des achats intégrés de l'app iPhone (commissionnaire, responsable de ses propres traitements) | Apple Developer Program License Agreement, et son annexe 2 (applications payantes) pour les achats |
| Google Ireland Ltd. | Remise des notifications sur Android (Firebase Cloud Messaging) | Firebase Data Processing and Security Terms (firebase.google.com/terms/data-processing-terms) |
| Google (Gmail) | Messagerie de contact | **À régulariser** : une adresse Gmail grand public n'a pas de contrat de sous-traitance. Une adresse Google Workspace (ou tout hébergeur de messagerie professionnel avec DPA) règle le point. |
