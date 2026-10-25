<script setup lang="ts">
/**
 * Partager une liste depuis l'accueil, sans entrer dans ses réglages : le
 * bouton « Partager » de la carte de la liste en cours (SectionAccueil).
 *
 * Le contenu est celui de la carte « Inviter quelqu'un » des réglages
 * (InvitationListe) — le code, le lien à envoyer, la lecture seule, et
 * l'avertissement d'un membre de plus, dit avant l'envoi d'où qu'on partage.
 *
 * `liste` est une ligne de /api/groupes : le serveur n'y met le code que pour
 * un décideur, et l'accueil n'ouvre pas cette feuille sans lui.
 */
const props = defineProps<{ liste: any }>()
const emit = defineEmits<{ fermer: []; 'code-obs': [code: string] }>()

// Débloquer se fait dans la liste (la carte d'achat est en tête de ses réglages).
const debloquer = () => navigateTo(`/g/${props.liste.id}/reglages`)
</script>

<template>
  <Feuille :titre="$t('SectionAccueil.partagerListe', { nom: liste.nom })" @fermer="emit('fermer')">
    <div class="pile partage">
      <InvitationListe :gid="liste.id" :code="liste.code_invitation"
                       :code-obs="liste.code_observateur ?? null" :paye="!!liste.paye"
                       :nb-decideurs="Number(liste.nb_decideurs ?? 1)" :nb-communs="Number(liste.nb_communs ?? 0)"
                       @debloquer="debloquer" @code-obs="emit('code-obs', $event)" />
    </div>
  </Feuille>
</template>

<style scoped>
.partage { gap: 12px; }
</style>
