/**
 * La feuille des textes légaux, une pour toute l'app (posée dans app.vue).
 *
 *   const { ouvrir } = useFeuilleLegale()
 *   <a href="/conditions" @click.prevent="ouvrir('/conditions')">conditions</a>
 *
 * Le lien garde son adresse : sans JavaScript, ou ouvert dans un nouvel
 * onglet, il mène à la page.
 */
export function useFeuilleLegale() {
  const ouverte = useState<string | null>('feuille-legale', () => null)
  return {
    ouverte,
    ouvrir: (chemin: string) => { ouverte.value = docLegal(chemin).chemin },
    oublier: () => { ouverte.value = null }
  }
}
