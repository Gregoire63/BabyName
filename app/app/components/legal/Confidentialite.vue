<script setup lang="ts">
/**
 * Politique de confidentialite — RGPD art. 12 a 14, loi Informatique et
 * Libertes, art. 82 pour les traceurs.
 *
 * Les durees viennent de CONSERVATION et les prestataires de DESTINATAIRES
 * (shared/utils/editeur.ts) : ce sont les memes constantes que la purge
 * nocturne applique. Une duree promise ici et oubliee la-bas n'est pas
 * possible.
 */
const e = EDITEUR
const c = CONSERVATION
</script>

<template>
  <div class="encadre">
    <p><strong>L’essentiel.</strong></p>
    <ul>
      <li>On vous demande un prénom ou un pseudo, et une adresse e-mail pour valider le compte. Pas de mot de passe, pas de numéro.</li>
      <li>Aucune publicité, aucune mesure d’audience, aucun cookie tiers. Rien n’est vendu ni loué.</li>
      <li>Votre compte s’efface quand vous le décidez, en un geste depuis l’app, et tout seul après {{ c.inactiviteMois }} mois sans l’ouvrir.</li>
      <li>Vous pouvez télécharger toutes vos données à tout moment : <em>Mon compte → Télécharger mes données</em>.</li>
    </ul>
  </div>

  <h2>Qui est responsable</h2>
  <p>
    Le responsable du traitement est {{ e.nom }}, {{ e.forme.toLowerCase() }}, éditeur de
    babyNamed (coordonnées complètes dans les <NuxtLink to="/mentions-legales">mentions légales</NuxtLink>).
    Pour toute question sur vos données : <a :href="`mailto:${e.email}`">{{ e.email }}</a>.
  </p>

  <h2>Ce que nous traitons, pourquoi, et sur quelle base</h2>

  <h3>Votre compte</h3>
  <dl>
    <dt>Données</dt>
    <dd>
      Le nom affiché que vous choisissez ; les dates de création et de dernière ouverture de l’app.
      Pour vous reconnecter, selon ce que vous choisissez :
      <strong>vos passkeys</strong> : leur clé <em>publique</em>, leur nom (« Trousseau iCloud »), leurs dates
      de création et de dernière utilisation ; la clé privée, votre visage ou votre empreinte ne quittent
      jamais votre appareil ;
      <strong>votre adresse e-mail</strong>, confirmée à l’inscription (un compte créé avant cette étape peut ne pas en avoir).
    </dd>
    <dt>Pourquoi</dt>
    <dd>Vous reconnaître, et vous permettre de retrouver votre compte sur un autre appareil. L’adresse e-mail
      ne sert qu’à valider votre inscription, à vous envoyer les liens et codes de connexion que vous
      demandez et à vous prévenir d’un changement de sécurité sur le compte : aucune lettre
      d’information, aucune publicité.</dd>
    <dt>Base légale</dt>
    <dd>L’exécution du contrat que sont les <NuxtLink to="/conditions">conditions d’utilisation</NuxtLink> (art. 6.1.b du RGPD).</dd>
  </dl>

  <h3>Vos listes</h3>
  <dl>
    <dt>Données</dt>
    <dd>Le nom des listes et, si vous le saisissez, le nom de famille de l’enfant ; vos filtres de recherche ; vos votes (oui, neutre, non), vetos (prénoms écartés en secret) et leur motif, prénoms « déjà pris » que vous ajoutez et leur note, favoris, classements, duels et commentaires ; les membres et observateurs de chaque liste.</dd>
    <dt>Pourquoi</dt>
    <dd>C’est le service lui-même : trier des prénoms à plusieurs et trouver ceux sur lesquels vous êtes d’accord.</dd>
    <dt>Base légale</dt>
    <dd>L’exécution du contrat (art. 6.1.b).</dd>
  </dl>

  <h3>Les compteurs de la version gratuite</h3>
  <dl>
    <dt>Données</dt>
    <dd>Le nombre de prénoms jugés sur les listes gratuites : au total (pour le lot de départ), et le dernier jour de tri (pour le nombre par jour).</dd>
    <dt>Pourquoi</dt>
    <dd>Appliquer les limites de la version gratuite : le lot de départ, puis le nombre par jour.</dd>
    <dt>Base légale</dt>
    <dd>L’exécution du contrat (art. 6.1.b).</dd>
  </dl>

  <h3>Le déblocage d’une liste (achat)</h3>
  <dl>
    <dt>Données</dt>
    <dd>
      Chez babyNamed : la date du déblocage, le compte qui l’a payé, la référence du paiement chez
      Stripe, la version des conditions acceptées et l’heure de votre accord.
      Chez Stripe, qui encaisse : votre e-mail, votre moyen de paiement, votre pays et des informations
      techniques utiles à la lutte contre la fraude. <strong>babyNamed ne voit jamais votre carte.</strong>
    </dd>
    <dt>Pourquoi</dt>
    <dd>Vendre, facturer, prouver votre accord à l’exécution immédiate, traiter un remboursement ou une contestation.</dd>
    <dt>Base légale</dt>
    <dd>L’exécution du contrat (art. 6.1.b) et nos obligations comptables et fiscales (art. 6.1.c). Stripe traite aussi ces données pour son propre compte, notamment contre la fraude.</dd>
  </dl>

  <h3>Les cadeaux (code cadeau)</h3>
  <dl>
    <dt>Données</dt>
    <dd>
      Si vous offrez : le nom et le mot que vous choisissez d’écrire (facultatifs), l’empreinte du code
      (pas le code lui-même), sa date d’achat et la référence du paiement. Aucun compte n’est demandé ;
      votre e-mail et votre moyen de paiement sont chez Stripe, pas chez babyNamed. Si vous recevez : la
      date à laquelle vous avez utilisé le code, et la liste qu’il a débloquée.
    </dd>
    <dt>Pourquoi</dt>
    <dd>Remettre le cadeau à qui détient le code, montrer au destinataire de qui il vient, traiter une rétractation ou un remboursement.</dd>
    <dt>Base légale</dt>
    <dd>L’exécution du contrat (art. 6.1.b) et nos obligations comptables (art. 6.1.c).</dd>
  </dl>

  <h3>Les liens de connexion et les limites d’essais</h3>
  <dl>
    <dt>Données</dt>
    <dd>
      Pour un lien ou un code envoyé par e-mail : l’adresse, le compte (ou, pour une inscription pas encore
      confirmée, le prénom choisi), et une empreinte du lien et du code (jamais en clair), avec l’heure.
      Une inscription jamais confirmée ne crée aucun compte. Pour freiner ceux qui essaieraient de deviner un code ou de créer des
      comptes à la chaîne : des compteurs d’essais rattachés à une empreinte chiffrée de l’adresse IP, du
      compte ou de l’adresse e-mail, jamais à leur valeur en clair.
    </dd>
    <dt>Pourquoi</dt>
    <dd>Vous connecter sans mot de passe, et protéger les comptes et les listes contre les essais répétés.</dd>
    <dt>Base légale</dt>
    <dd>L’exécution du contrat (art. 6.1.b) pour les liens ; notre intérêt légitime à sécuriser le service
      (art. 6.1.f) pour les compteurs.</dd>
  </dl>

  <h3>Les journaux techniques</h3>
  <dl>
    <dt>Données</dt>
    <dd>Adresse IP, date, adresse de la page demandée et type de navigateur, enregistrés par notre hébergeur à chaque requête.</dd>
    <dt>Pourquoi</dt>
    <dd>Faire fonctionner et sécuriser le service, diagnostiquer une panne.</dd>
    <dt>Base légale</dt>
    <dd>Notre intérêt légitime à assurer la sécurité du service (art. 6.1.f).</dd>
  </dl>

  <p>
    Nous ne faisons <strong>aucun profilage publicitaire</strong> et aucune décision automatisée ne produit
    d’effet sur vous au sens de l’article 22 du RGPD. Le « portrait » de vos goûts n’est qu’un calcul sur vos
    propres votes, affiché à vous et aux membres de la liste.
  </p>

  <h2>Qui voit quoi</h2>
  <ul>
    <li>
      <strong>Les membres d’une liste</strong> voient votre nom affiché, vos commentaires, le nombre de prénoms
      que vous avez jugés et les accords auxquels vous avez pris part. Votre vote sur un prénom ne leur est
      montré qu’une fois qu’ils ont voté sur ce même prénom : c’est le vote à l’aveugle. Personne ne voit qui
      a mis un veto secret sur un prénom. Un prénom « déjà pris », lui, est fait pour être vu : il s’affiche à
      toute la liste, observateurs compris, avec votre nom et votre note.
    </li>
    <li><strong>L’éditeur</strong> a un accès technique à la base, pour la maintenance et l’assistance. Il ne le consulte pas en dehors de ces besoins.</li>
    <li><strong>Nos prestataires</strong>, uniquement pour ce qu’ils font pour nous :</li>
  </ul>
  <ul class="prestataires">
    <li v-for="d in DESTINATAIRES" :key="d.nom">
      <strong>{{ d.nom }}</strong> : {{ d.role }}. {{ d.pays }}. Garanties : {{ d.garantie }}.
      <a :href="d.lien" rel="noopener">Sa politique</a>.
    </li>
  </ul>

  <h2>Transferts hors de l’Union européenne</h2>
  <p>
    Cloudflare, qui héberge l’application, est une société américaine : vos données peuvent être traitées
    aux États-Unis<template v-if="e.regionDonnees">, mais la base elle-même est conservée dans
    {{ e.regionDonnees }}</template>.
    Ces transferts reposent sur la décision d’adéquation de la Commission européenne pour les entreprises
    certifiées Data Privacy Framework, et sur les clauses contractuelles types de la Commission.
    Stripe Payments Europe est établie en Irlande ; certaines données peuvent être traitées par Stripe, Inc.
    aux États-Unis, sous les mêmes garanties. La sauvegarde nocturne passe par GitHub, société américaine
    elle aussi : la base y est chiffrée le temps de la tâche, sous les mêmes garanties, et la copie
    chiffrée est conservée en France, chez OVH.
    <template v-if="COURRIEL.fournisseur === 'resend'">
      Resend, qui envoie les e-mails de connexion, est aussi une société américaine (clauses contractuelles
      types).
    </template>
    <template v-else-if="COURRIEL.fournisseur === 'brevo'">
      Les e-mails de connexion partent par Brevo, société française, depuis l’Union européenne.
    </template>
    <template v-else>
      Les e-mails de connexion partent de la messagerie de babynamed.fr, chez OVH, société française,
      depuis la France.
    </template>
  </p>

  <h2>Combien de temps</h2>
  <ul>
    <li><strong>Compte et listes</strong> : tant que vous vous en servez. Effacés immédiatement si vous supprimez votre compte ; effacés automatiquement après <strong>{{ c.inactiviteMois }} mois</strong> sans ouvrir l’app.</li>
    <li><strong>Une liste</strong> est effacée, qu’elle ait été débloquée ou non, dès que son propriétaire la supprime (depuis ses réglages, pour tous), ou quand il n’y reste plus personne pour décider.</li>
    <li><strong>Quitter une liste</strong> efface ce que vous y avez donné : votes, vetos, favoris, commentaires. Les prénoms « déjà pris » que vous y avez ajoutés restent à la liste, sans votre nom ni votre note.</li>
    <li><strong>Codes cadeaux</strong> : un code jamais utilisé est effacé {{ c.cadeauMois }} mois après l’achat, avec le nom et le mot de celui qui l’a offert ; un code annulé, un mois après ; un code utilisé reste attaché à la liste qu’il a débloquée (« un cadeau de… ») et disparaît avec elle.</li>
    <li><strong>Prénoms « déjà pris »</strong> : ils appartiennent à la liste. Si vous effacez votre compte, ceux que vous avez ajoutés y restent pour les autres membres, sans votre nom ni votre note.</li>
    <li><strong>Compteurs de la version gratuite</strong> : le total, avec le compte ; celui du jour, jusqu’au jour de tri suivant, et {{ c.quotaJours }} jours au plus.</li>
    <li><strong>Cookie de connexion</strong> : {{ c.sessionJours }} jours, renouvelés à chaque connexion. <em>Mon compte → Déconnecter mes autres appareils</em> les annule tous d’un coup, sauf celui de l’appareil en main.</li>
    <li><strong>Adresse e-mail et passkeys</strong> : tant que votre compte existe, ou jusqu’à ce que vous les retiriez dans <em>Mon compte</em>.</li>
    <li><strong>Liens et codes par e-mail</strong> (connexion, inscription) : valables {{ c.lienMinutes }} minutes, une seule fois ; effacés le lendemain de leur expiration, avec l’adresse et le prénom d’une inscription jamais confirmée.</li>
    <li><strong>Compteurs d’essais</strong> : deux jours au plus.</li>
    <li><strong>Pièces liées à un paiement</strong> (facture, paiement) : {{ c.comptabiliteAns }} ans, durée imposée par le Code de commerce (art. L123-22). Elles sont conservées par Stripe et dans notre comptabilité, pas dans l’app.</li>
    <li><strong>Journaux techniques</strong> : quelques jours au plus, chez l’hébergeur.</li>
    <li><strong>Sauvegardes</strong> : la base garde {{ c.historiqueJours }} jours d’historique de restauration. Chaque nuit, une copie chiffrée part aussi chez OVH, en France : on garde les {{ c.sauvegardeNuits }} dernières nuits, puis une copie par mois pendant {{ c.sauvegardeMois }} mois. Elles ne servent qu’à réparer une panne ou une erreur. Une donnée effacée disparaît ainsi de toutes les copies au plus tard {{ c.sauvegardeMois }} mois après.</li>
  </ul>

  <h2>Vos droits</h2>
  <p>Vous disposez des droits suivants sur vos données :</p>
  <ul>
    <li><strong>Accès et portabilité</strong> : <em>Mon compte → Télécharger mes données</em> vous donne tout, dans un fichier lisible et réutilisable (JSON).</li>
    <li><strong>Rectification</strong> : votre nom affiché se change dans <em>Mon compte</em> ; le reste (votes, commentaires, listes) se modifie dans l’app.</li>
    <li><strong>Effacement</strong> : <em>Mon compte → Supprimer mon compte</em>, immédiat et définitif. Les listes que vous partagez restent à leurs autres membres ; celles où vous étiez seul(e) sont effacées.</li>
    <li><strong>Limitation et opposition</strong> : pour les traitements fondés sur notre intérêt légitime (les journaux techniques), vous pouvez vous y opposer pour des raisons tenant à votre situation.</li>
    <li><strong>Directives après votre décès</strong> : vous pouvez nous indiquer ce que vous souhaitez voir faire de vos données (art. 85 de la loi Informatique et Libertés).</li>
  </ul>
  <p>
    Pour toute demande qui ne se fait pas depuis l’app, écrivez à
    <a :href="`mailto:${e.email}`">{{ e.email }}</a>. Nous répondons dans un délai d’un mois. Si aucune
    adresse n’est liée à votre compte, nous vous demanderons de quoi vérifier qu’il est bien le vôtre,
    jamais un code de connexion.
  </p>
  <p>
    Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL
    ({{ CNIL.adresse }}, <a :href="CNIL.plainte" rel="noopener">cnil.fr/plaintes</a>).
  </p>

  <h2>Cookies et stockage sur votre appareil</h2>
  <p>babyNamed ne dépose <strong>aucun cookie publicitaire ni de mesure d’audience</strong>. Ce qu’il garde sur votre appareil sert uniquement à faire marcher l’app, ce qui le dispense de votre consentement (art. 82 de la loi Informatique et Libertés) :</p>
  <ul>
    <li><strong>pr_session</strong> (cookie) : vous garde connecté(e) {{ c.sessionJours }} jours. Illisible par les scripts de la page, envoyé uniquement en HTTPS.</li>
    <li><strong>pr_defi</strong> (cookie) : le temps de créer ou d’utiliser une passkey, cinq minutes au plus ; il est effacé dès qu’il a servi.</li>
    <li><strong>Stockage local du navigateur</strong> : la liste sur laquelle vous triez, le nombre d’accords déjà vus, le rappel de pause du jour, le prénom choisi depuis une fiche tant qu’il n’est pas jugé, et un code cadeau reçu par lien le temps de vous connecter (un mois au plus). Ces informations restent sur votre appareil et sont effacées à la déconnexion, sauf le thème choisi (clair, sombre), réglage de l’appareil et non du compte.</li>
    <li><strong>Cache hors ligne</strong> : les fichiers de l’application et le catalogue des prénoms, pour que l’app s’ouvre vite. Aucune donnée personnelle.</li>
  </ul>
  <p>La police de caractères est servie par babyNamed lui-même : ouvrir l’app n’envoie rien à Google ni à aucun autre tiers.</p>

  <h2>Sécurité</h2>
  <p>
    Connexions chiffrées (HTTPS) ; aucun mot de passe : passkeys (seule la clé publique est gardée) ou lien
    et code par e-mail, à usage unique et gardés sous forme d’empreinte ; nombre d’essais limité ; cookie
    inaccessible aux scripts, et révocable depuis <em>Mon compte</em> ; politique de sécurité du contenu qui
    empêche l’exécution de scripts étrangers ; secrets et base de données accessibles au seul serveur ;
    paiement confié à Stripe, certifié PCI-DSS. En cas de violation de données présentant un risque pour vous, la CNIL et,
    si nécessaire, les personnes concernées seront prévenues dans les délais prévus par le RGPD.
  </p>

  <h2>Mineurs</h2>
  <p>babyNamed s’adresse aux personnes majeures qui choisissent un prénom pour leur enfant.</p>

  <h2>Modifications</h2>
  <p>
    Cette politique peut évoluer ; la date en tête de page indique sa version. En cas de changement important
    (nouvel usage, nouveau prestataire), nous vous prévenons dans l’app avant qu’il ne s’applique.
  </p>
</template>

<style scoped>
.prestataires { margin-top: -4px; }
</style>
