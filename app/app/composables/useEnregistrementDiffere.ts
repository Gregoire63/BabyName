/**
 * Un champ qui s'enregistre seul.
 *
 * Les noms (de la liste, de famille, affiché) s'enregistraient « en quittant
 * le champ ». Or on ne quitte pas toujours un champ : le bouton retour du
 * téléphone démonte la page sans rendre le focus, une app passée en
 * arrière-plan non plus, et le nouveau nom repartait sans bruit (vu en
 * production le 28/09). On enregistre donc après une courte pause dans la
 * frappe, en quittant le champ (`maintenant`), en quittant l'écran, et quand
 * l'app passe en arrière-plan — ces deux-là avec `keepalive`, pour que la
 * requête survive à la page.
 *
 * `enregistrer` est appelé à chaque occasion, pas seulement après une
 * frappe : il doit ne rien faire quand rien n'a changé.
 */
export type OptionsEnvoi = { keepalive?: boolean }

export function useEnregistrementDiffere(enregistrer: (o: OptionsEnvoi) => unknown, delai = 600) {
  let minuteur: ReturnType<typeof setTimeout> | undefined

  function planifier() {
    clearTimeout(minuteur)
    minuteur = setTimeout(() => enregistrer({}), delai)
  }
  function maintenant(o: OptionsEnvoi = {}) {
    clearTimeout(minuteur)
    return enregistrer(o)
  }
  const siCachee = () => { if (document.visibilityState === 'hidden') maintenant({ keepalive: true }) }

  onMounted(() => document.addEventListener('visibilitychange', siCachee))
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', siCachee)
    maintenant({ keepalive: true })
  })
  return { planifier, maintenant }
}
