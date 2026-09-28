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
      // Un appel qui échoue (hors ligne, robot d'indexation à qui /api/ est
      // fermé) ne dit rien de l'e-mail : on reste « inconnu », le formulaire
      // s'affiche, et l'envoi dira lui-même s'il échoue. Répondre « fermé »
      // affichait « Les inscriptions ne sont pas encore ouvertes » à Bing.
      .catch(() => { possible.value = null })
  }
  return possible
}
