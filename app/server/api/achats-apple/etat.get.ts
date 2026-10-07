/**
 * L'app iOS peut-elle vendre ? Et quel produit de l'App Store ?
 *
 * La page le demande une fois, au démarrage dans l'app iOS, avant de montrer
 * la moindre offre : si le serveur ne peut pas vérifier un achat chez Apple
 * (la clé n'est pas posée, ou Apple la refuse) ou si la vente est fermée,
 * l'app ne propose rien — mieux vaut pas d'offre qu'une offre qui encaisse
 * sans débloquer. C'est aussi la route à ouvrir dans un navigateur pour
 * savoir si les réglages d'Apple sont bons : `"ouvert": true` — y compris
 * avant la sortie de l'app, quand seul le bac à sable d'Apple accepte la clé
 * (server/utils/apple.ts).
 * Le nom du produit vient d'ici et non de l'app installée : en changer ne
 * demande pas de repasser par l'App Store.
 */
export default defineEventHandler(async (e) => {
  setHeader(e, 'cache-control', 'no-store')
  // `appleRepond` : une vraie demande à Apple (gardée en mémoire). Une clé
  // posée mais refusée ne suffit pas à ouvrir la vente.
  const ouvert = applePret() && venteOuverte() && await appleRepond()
  return { ouvert, produit: ouvert ? produitApple().produit : null }
})
