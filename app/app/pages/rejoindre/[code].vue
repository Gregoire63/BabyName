<script setup lang="ts">
/**
 * Le lien d'invitation : /rejoindre/<code>.
 *
 * Une adresse à elle, et non plus `/?code=…` : c'est l'une des deux seules
 * que l'app des stores ouvre elle-même quand elle est installée (l'autre est
 * le lien de connexion demandé depuis l'app — server/routes/.well-known). Tout
 * le reste du site s'ouvre dans le navigateur, app installée ou non : c'est là
 * que se lisent les pages publiques et que s'achète le déblocage.
 *
 * Rien à afficher : on repart aussitôt vers l'accueil, qui sait quoi faire
 * d'un code (SectionAccueil) — entrer dans la liste, ou passer par la
 * connexion en le gardant. Les anciens liens `/?code=…` marchent toujours.
 */
definePageMeta({
  middleware: [
    function (vers) {
      const code = normaliserCodeInvitation(vers.params.code)
      return navigateTo(code ? { path: '/', query: { code } } : { path: '/' }, { replace: true })
    }
  ]
})
</script>

<template>
  <div />
</template>
