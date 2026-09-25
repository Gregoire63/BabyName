/**
 * Le lien par e-mail est-il proposé ? Seulement si l'envoi est configuré sur
 * le serveur (clé et expéditeur posés sur le Worker). Sinon, on ne montre pas
 * un bouton qui répondrait « pas encore en place » : la passkey suffit.
 * Demandé une fois par visite.
 */
export function useCourrielPossible() {
  const possible = useState<boolean | null>('courriel-possible', () => null)
  if (import.meta.client && possible.value === null) {
    $fetch<{ courriel: boolean }>('/api/auth/config')
      .then(c => { possible.value = !!c?.courriel })
      .catch(() => { possible.value = false })
  }
  return possible
}
