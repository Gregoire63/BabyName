<script setup lang="ts">
/**
 * Conditions generales d'utilisation et de vente.
 *
 * Un seul texte pour les deux : le gratuit et le payant sont le meme service,
 * et un acheteur doit trouver au meme endroit ce qu'il paie, ce qu'il garde
 * et ce qu'il peut reclamer. La version (VERSIONS_TEXTES.conditions) est
 * gravee dans chaque paiement : changer ce texte, c'est changer la version.
 */
const e = EDITEUR
const config = useRuntimeConfig()
const prix = (config.public.prixListe as string) || '6 €'
</script>

<template>
  <PageLegale titre="Conditions générales d’utilisation et de vente" :version="VERSIONS_TEXTES.conditions">
    <h2>1. Objet</h2>
    <p>
      Ces conditions régissent l’utilisation de babyNames, application qui aide à choisir un prénom à
      plusieurs, et l’achat de son option payante. Elles sont conclues entre vous et l’éditeur,
      {{ e.nom }}, {{ e.forme.toLowerCase() }} (voir les <NuxtLink to="/mentions-legales">mentions légales</NuxtLink>).
      Créer un compte vaut acceptation des conditions d’utilisation ; un achat suppose en plus d’accepter
      les conditions de vente, en cochant la case prévue avant le paiement.
    </p>

    <h2>2. Le service</h2>
    <p>
      babyNames propose un catalogue de prénoms issu des statistiques de l’Insee, des listes partagées où
      chacun juge les prénoms sans voir l’avis des autres avant d’avoir donné le sien, et le relevé des
      prénoms sur lesquels tout le monde est d’accord.
    </p>
    <p>
      <strong>La version gratuite</strong> donne accès au catalogue complet, à la recherche, aux fiches,
      aux accords, au classement et aux vetos. Sur les listes non débloquées, le nombre de prénoms jugés
      est limité : un premier lot à juger librement, puis un nombre par jour. Ces limites sont affichées
      dans l’app ; elles n’interrompent jamais définitivement le tri.
    </p>

    <h2>3. Votre compte</h2>
    <p>
      Un compte se crée avec un nom affiché. L’app vous remet une clé d’accès personnelle : c’est le seul
      moyen de retrouver votre compte sur un autre appareil. Il n’y a ni e-mail ni mot de passe : une clé
      perdue ne peut pas être retrouvée par l’éditeur. Depuis un appareil encore connecté, vous pouvez en
      générer une nouvelle, ce qui annule l’ancienne. Gardez-la pour vous.
    </p>
    <p>
      Vous êtes responsable de ce que vous écrivez dans l’app (noms de listes, commentaires, motifs). Tout
      contenu illicite, injurieux ou portant atteinte aux droits d’autrui peut être supprimé et le compte
      suspendu. Vous pouvez supprimer votre compte à tout moment depuis <em>Mon compte</em>.
    </p>

    <h2>4. L’option payante : débloquer une liste</h2>
    <h3>Ce que vous achetez</h3>
    <p>
      Le déblocage d’<strong>une</strong> liste, pour <strong>tous ses membres</strong> : le tri sans limite
      quotidienne, l’essai des prénoms avec votre nom de famille, la projection du nombre d’enfants portant
      le prénom dans une classe, le portrait de vos goûts, l’explication des désaccords et l’invitation
      d’observateurs. Le détail est présenté dans l’app avant tout paiement.
    </p>
    <h3>Prix</h3>
    <p>
      <strong>{{ prix }} TTC</strong>, en une fois. Ce n’est pas un abonnement : rien n’est reconduit ni
      prélevé ensuite. {{ mentionTva() }}.
    </p>
    <h3>Commande et paiement</h3>
    <p>
      Depuis la liste, <em>Débloquer</em> présente l’offre et son prix. Vous cochez la case d’acceptation,
      puis réglez sur la page de paiement sécurisée de Stripe (carte bancaire, Apple Pay, Google Pay et
      autres moyens proposés). Le bouton de paiement vaut commande avec obligation de payer. Vos données de
      paiement sont saisies chez Stripe et ne sont jamais transmises à l’éditeur.
    </p>
    <h3>Livraison</h3>
    <p>
      Immédiate : la liste est débloquée dès la confirmation du paiement, pour toute sa durée d’existence.
      Une facture vous est adressée par e-mail. Si une liste est effacée — parce qu’il n’y reste plus aucun
      membre, ou après {{ CONSERVATION.inactiviteMois }} mois sans que personne ne l’ouvre —, son déblocage
      disparaît avec elle.
    </p>

    <h3>Droit de rétractation</h3>
    <div class="encadre">
      <p>
        Pour un achat en ligne, vous disposez en principe de quatorze jours pour vous rétracter
        (art. L221-18 du Code de la consommation). Ce droit ne s’applique pas à un contenu numérique fourni
        immédiatement, lorsque vous avez expressément demandé cette exécution immédiate et reconnu perdre
        votre droit de rétractation (art. L221-28, 13°).
      </p>
      <p>
        C’est l’objet de la case à cocher qui précède le paiement : sans elle, le paiement ne peut pas
        commencer. Cet accord, daté, figure sur la facture que vous recevez par e-mail.
      </p>
    </div>
    <p>
      Un remboursement accordé en tout ou partie reste possible à la discrétion de l’éditeur. Un
      remboursement total annule la vente : la liste revient alors à la version gratuite, sans perte de
      votes ni de données.
    </p>

    <h3>Garantie légale de conformité</h3>
    <p>
      Pendant toute la durée de fourniture, vous bénéficiez de la garantie légale de conformité des
      contenus et services numériques (art. L224-25-12 et suivants du Code de la consommation). En cas de
      défaut, vous pouvez obtenir la mise en conformité ; à défaut, dans les conditions prévues par la loi,
      une réduction du prix ou la résolution du contrat. Signalez tout défaut à
      <a :href="`mailto:${e.email}`">{{ e.email }}</a>.
    </p>

    <h2>5. Disponibilité et évolution</h2>
    <p>
      L’éditeur fait ses meilleurs efforts pour que l’app soit disponible, sans garantir une disponibilité
      permanente (maintenance, pannes des prestataires). Les fonctions peuvent évoluer. Si le service
      devait fermer définitivement, vous en seriez prévenu dans l’app au moins trois mois à l’avance, et
      l’export de vos données resterait disponible jusqu’à la fermeture.
    </p>

    <h2>6. Informations fournies</h2>
    <p>
      Statistiques, tendances, projections, significations et origines sont données à titre indicatif,
      à partir de sources publiques et de calculs qui peuvent comporter des erreurs. Le choix du prénom
      vous appartient ; son inscription à l’état civil relève de l’officier d’état civil (art. 57 du Code
      civil).
    </p>

    <h2>7. Données personnelles</h2>
    <p>
      Leur traitement est décrit dans la <NuxtLink to="/confidentialite">politique de confidentialité</NuxtLink>.
    </p>

    <h2>8. Modification des conditions</h2>
    <p>
      Ces conditions peuvent être modifiées ; la date en tête de page indique la version en vigueur. Un
      achat reste régi par la version acceptée au moment de l’achat. Pour la partie gratuite, un changement
      important vous est signalé dans l’app ; continuer à utiliser le service vaut acceptation, et vous
      pouvez à tout moment supprimer votre compte.
    </p>

    <h2>9. Réclamations et médiation</h2>
    <p>
      Pour toute réclamation, écrivez d’abord à <a :href="`mailto:${e.email}`">{{ e.email }}</a>.
      Si la réponse ne vous satisfait pas, ou en l’absence de réponse sous deux mois, vous pouvez recourir
      gratuitement au médiateur de la consommation (art. L612-1 du Code de la consommation) :
      <strong><ACompleter :v="e.mediateur.nom" quoi="nom du médiateur" /></strong>
      <template v-if="e.mediateur.adresse"> — {{ e.mediateur.adresse }}</template>
      <template v-if="e.mediateur.site"> — <a :href="e.mediateur.site" rel="noopener">{{ e.mediateur.site.replace(/^https?:\/\//, '') }}</a></template>
      <template v-else> — <ACompleter quoi="site du médiateur" /></template>.
    </p>

    <h2>10. Droit applicable</h2>
    <p>
      Ces conditions sont soumises au droit français. En cas de litige, et à défaut d’accord amiable, vous
      pouvez saisir, à votre choix, la juridiction du lieu où vous demeuriez au moment de la conclusion du
      contrat ou de la survenance du fait dommageable, ou toute autre juridiction compétente
      (art. R631-3 du Code de la consommation).
    </p>
  </PageLegale>
</template>
