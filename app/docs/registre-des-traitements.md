# Registre des activités de traitement — babyNames

Article 30 du RGPD. L'exemption des structures de moins de 250 personnes ne
joue pas ici : elle ne vaut que pour des traitements **occasionnels**, et ceux
d'une application en ligne sont permanents. Ce registre se présente à la CNIL
sur simple demande ; il se tient à jour à chaque nouveau traitement, nouveau
prestataire ou nouvelle durée.

Tenu par : Grégoire Raturat, entrepreneur individuel, éditeur de babyNames
— gregoireraturatpro@gmail.com. Pas de délégué à la protection des données
(non obligatoire : ni organisme public, ni suivi à grande échelle, ni données
sensibles à grande échelle).

Dernière mise à jour : 25 septembre 2026.

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
| **Données** | Nom affiché (libre, souvent un prénom) ; empreinte SHA-256 de la clé d'accès ; dates de création et de dernière activité. Pas d'e-mail, pas de mot de passe, pas de téléphone. |
| **Destinataires** | Éditeur (maintenance). Sous-traitants : Vercel (hébergement), Neon (base). Les autres membres des listes voient le nom affiché. |
| **Transferts hors UE** | Vercel Inc. et Neon, LLC (États-Unis) : Data Privacy Framework + clauses contractuelles types. |
| **Conservation** | Jusqu'à la suppression par l'utilisateur (immédiate) ; sinon effacement automatique après 24 mois sans activité. Sauvegardes Neon : historique de restauration de quelques jours. |
| **Sécurité** | HTTPS ; clé stockée en empreinte seulement ; cookie de session signé (HMAC), `HttpOnly`, `Secure`, `SameSite=Lax`, 120 jours ; secrets côté serveur uniquement. |

## 2. Listes de prénoms

| | |
|---|---|
| **Finalité** | Le service : trier des prénoms à plusieurs, vote à l'aveugle, accords, classement, commentaires, observateurs. |
| **Base légale** | Exécution du contrat — art. 6.1.b. |
| **Personnes** | Utilisateurs membres d'une liste. |
| **Données** | Nom de la liste ; nom de famille de l'enfant (facultatif) ; filtres ; votes, vetos (et leur motif, visible de son seul auteur), favoris, duels, classements, commentaires ; appartenance et rôle dans chaque liste. |
| **Destinataires** | Membres de la même liste, selon la règle du vote à l'aveugle (un vote n'est visible qu'à qui a voté sur le même prénom ; un veto n'est jamais attribué). Éditeur, sous-traitants comme ci-dessus. |
| **Transferts hors UE** | Comme ci-dessus. |
| **Conservation** | Liée au compte (effacée avec lui). Une liste sans membre est effacée. |
| **Sécurité** | Aucune lecture des votes d'autrui hors de `server/utils/votes.ts` ; contrôle d'appartenance sur chaque route (`exigerMembre`). |

## 3. Limite d'usage de la version gratuite

| | |
|---|---|
| **Finalité** | Appliquer les limites des listes gratuites : un lot de départ, puis un nombre par jour. |
| **Base légale** | Exécution du contrat — art. 6.1.b. |
| **Données** | Par personne et par liste : le nombre de gestes du lot de départ (un total). Par liste, par personne et par jour : un nombre de gestes. |
| **Conservation** | Totaux : avec le compte ou la liste. Détail par jour : 62 jours (le quota ne lit que le jour en cours). |

## 4. Vente : déblocage d'une liste

| | |
|---|---|
| **Finalité** | Vendre le déblocage, facturer, prouver l'accord à l'exécution immédiate, traiter remboursements et contestations. |
| **Base légale** | Exécution du contrat (6.1.b) ; obligations comptables et fiscales (6.1.c). |
| **Personnes** | Acheteurs. |
| **Données** | Dans l'app : date de déblocage, compte acheteur, référence du paiement Stripe (`pi_…`), liste offerte ou vendue. Chez Stripe : e-mail, moyen de paiement, pays, données antifraude, facture ; métadonnées d'accord (version des conditions, horodatage, renonciation à la rétractation). |
| **Destinataires** | Stripe Payments Europe, Ltd. (Irlande) — sous-traitant pour le paiement, responsable de ses propres traitements (fraude, obligations financières). Éditeur (comptabilité). |
| **Transferts hors UE** | Stripe, Inc. (États-Unis) pour certains traitements : Data Privacy Framework + clauses contractuelles types. |
| **Conservation** | Pièces comptables : 10 ans (art. L123-22 du Code de commerce), chez Stripe et dans la comptabilité. Dans l'app : tant que la liste existe ; l'effacement de l'acheteur met la référence du compte à NULL, la liste reste débloquée pour ses autres membres. |
| **Sécurité** | Aucune donnée de carte ne transite par l'app (page de paiement hébergée par Stripe, PCI-DSS) ; webhook signé (HMAC, 5 min, comparaison en temps constant) ; clé restreinte à *Checkout Sessions*. |

## 5. Journaux techniques et sécurité

| | |
|---|---|
| **Finalité** | Faire fonctionner et sécuriser le service, diagnostiquer les pannes. |
| **Base légale** | Intérêt légitime (sécurité du service) — art. 6.1.f. |
| **Données** | Adresse IP, date, URL demandée, navigateur (journaux de Vercel). Les journaux applicatifs ne contiennent ni identifiant ni contenu (la purge ne journalise que des nombres). |
| **Destinataires** | Vercel (sous-traitant). |
| **Conservation** | Durée de rétention des journaux Vercel (courte, quelques jours au plus selon l'offre). |

## 6. Demandes d'exercice des droits et assistance

| | |
|---|---|
| **Finalité** | Répondre aux demandes d'accès, d'effacement, d'opposition, et aux questions. |
| **Base légale** | Obligation légale (art. 12 à 22 du RGPD) — 6.1.c ; assistance : exécution du contrat. |
| **Données** | E-mail de la personne, contenu de sa demande, éléments de vérification (jamais la clé d'accès). |
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
- **Minimisation déjà faite** : e-mails de l'époque du lien magique effacés
  (colonne remise à NULL, table des jetons vidée) ; police de caractères
  servie par l'app (plus de transfert d'IP à Google).

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
| Vercel Inc. | Hébergement | DPA intégré aux conditions Vercel (vercel.com/legal/dpa) |
| Neon, LLC (Databricks) | Base de données | DPA Neon (neon.com/dpa) |
| Stripe Payments Europe, Ltd. | Paiement | Stripe Data Processing Agreement (stripe.com/legal/dpa) |
| Google (Gmail) | Messagerie de contact | **À régulariser** : une adresse Gmail grand public n'a pas de contrat de sous-traitance. Une adresse Google Workspace (ou tout hébergeur de messagerie professionnel avec DPA) règle le point. |
