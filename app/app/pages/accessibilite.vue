<script setup lang="ts">
/**
 * Declaration d'accessibilite.
 *
 * babyNames n'y est pas oblige : l'obligation de l'article 47 de la loi du
 * 11 fevrier 2005 vise les organismes publics et les grandes entreprises, et
 * l'Acte europeen sur l'accessibilite exempte les microentreprises de
 * services. On la publie quand meme, au format du RGAA, parce qu'elle dit ce
 * qui marche, ce qui ne marche pas encore, et a qui ecrire — et qu'une
 * declaration honnete vaut mieux qu'une conformite supposee.
 *
 * Ce qu'elle affirme doit rester vrai : l'essai essais/essai-accessibilite.mjs
 * rejoue l'audit automatique sur chaque ecran. Un ecran qui echoue la,
 * c'est une ligne a ajouter ici.
 */
const e = EDITEUR
const auditLe = computed(() => new Date(`${VERSIONS_TEXTES.accessibilite}T12:00:00`)
  .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))
</script>

<template>
  <PageLegale titre="Déclaration d’accessibilité" :version="VERSIONS_TEXTES.accessibilite">
    <p>
      {{ e.nom }} s’engage à rendre babyNames accessible à tous, conformément au référentiel général
      d’amélioration de l’accessibilité (RGAA, version 4.1.2), qui reprend les critères de niveau AA des
      règles internationales WCAG 2.1. Cette déclaration s’applique à l’application babyNames.
      Elle est volontaire : l’éditeur, microentreprise, n’est pas soumis à l’obligation légale.
    </p>

    <h2>État de conformité</h2>
    <p>
      babyNames est <strong>partiellement conforme</strong> au RGAA 4.1.2. Aucun audit complet n’a été
      mené par un organisme externe : ce statut repose sur un audit interne, décrit plus bas.
    </p>

    <h2>Ce qui a été fait</h2>
    <ul>
      <li>Contrastes des textes et des commandes relevés au niveau AA, en thème clair comme en thème sombre.</li>
      <li>Toute l’app se parcourt au clavier, avec un focus visible ; le tri se fait aussi aux flèches (← non, → oui, ↓ neutre) ou avec les trois boutons, sans jamais avoir besoin du geste de glissement.</li>
      <li>Les fenêtres (fiches, filtres, achat, compte) se comportent comme des dialogues : le focus y entre, reste à l’intérieur, revient où il était à la fermeture, et Échap les ferme.</li>
      <li>Chaque prénom qui arrive dans le tri est annoncé aux lecteurs d’écran ; chaque écran a un titre, annoncé à chaque changement.</li>
      <li>Les courbes de naissances ont une description textuelle ; tous les champs de saisie ont une étiquette.</li>
      <li>Les animations s’arrêtent quand le système demande de réduire les mouvements ; l’app fonctionne à l’horizontale comme à la verticale, et le zoom n’est jamais bloqué.</li>
    </ul>

    <h2>Contenus non accessibles</h2>
    <h3>Non-conformités connues</h3>
    <ul>
      <li>Les prénoms d’origine étrangère ne sont pas balisés dans leur langue : une synthèse vocale les lit à la française (critère 8.7).</li>
      <li>Les courbes de naissances sont résumées en une phrase (tendance, année du pic) ; les valeurs année par année ne sont pas proposées sous forme de tableau (critère 1.3).</li>
    </ul>
    <h3>Dérogations</h3>
    <p>Aucune.</p>

    <h2>Établissement de cette déclaration</h2>
    <p>Déclaration établie le {{ auditLe }}.</p>
    <ul>
      <li><strong>Technologies</strong> : HTML, CSS, JavaScript (Vue et Nuxt), WAI-ARIA.</li>
      <li><strong>Méthode</strong> : tests automatiques axe-core (règles WCAG 2.0, 2.1 niveaux A et AA) sur chaque écran de l’application, en thème clair et en thème sombre, rejoués à chaque évolution ; vérifications manuelles au clavier.</li>
      <li><strong>Environnement de test</strong> : Chromium, sur ordinateur et en affichage mobile.</li>
      <li><strong>Pages vérifiées</strong> : connexion, accueil, tri, recherche d’un prénom, classement (communs, à revoir, mes choix, portrait), réglages de la liste, fiche d’un prénom, filtres, création de liste, achat, compte et pages d’information.</li>
    </ul>

    <h2>Retour d’information et contact</h2>
    <p>
      Un contenu ou une fonction vous est inaccessible ? Écrivez à
      <a :href="`mailto:${e.email}`">{{ e.email }}</a> en décrivant ce qui bloque : nous vous
      apporterons une réponse ou une alternative, et corrigerons ce qui peut l’être.
    </p>

    <h2>Voies de recours</h2>
    <p>
      Si vous nous avez signalé un défaut d’accessibilité sans obtenir de réponse satisfaisante, vous
      pouvez saisir le Défenseur des droits :
    </p>
    <ul>
      <li>par le <a href="https://formulaire.defenseurdesdroits.fr/" rel="noopener">formulaire en ligne</a> ;</li>
      <li>en contactant <a href="https://www.defenseurdesdroits.fr/carte-des-delegues" rel="noopener">le délégué de votre région</a> ;</li>
      <li>par courrier, gratuit et sans affranchissement : Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.</li>
    </ul>
  </PageLegale>
</template>
