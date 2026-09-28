/**
 * Provenance (voir composables/useProvenance.ts) : notée avant que la page
 * ne nettoie son adresse (SectionTrier retire ?ref), envoyée dès qu'un
 * compte est connecté. Le serveur ne la garde que pour un compte de moins de
 * 24 heures : un envoi tardif ne réécrit rien.
 */
export default defineNuxtPlugin(() => {
  noterProvenance()
  const moi = useMoi()
  watch(moi, (m) => { if (m) envoyerProvenance() }, { immediate: true })
})
