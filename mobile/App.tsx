import { SafeAreaProvider } from 'react-native-safe-area-context'

import { Coquille } from './src/Coquille'

/**
 * babyNamed, l'app des stores : le site, dans une coquille.
 *
 * Pas d'écran à elle. L'app affiche https://babynamed.fr dans une vue web et
 * lui prête ce qu'un navigateur n'a pas (src/pont.ts). Tout le reste — les
 * écrans, les textes, les règles — vit dans le site (dossier app/ du dépôt) :
 * une mise en ligne là-bas vaut pour le web et pour les deux apps, sans
 * repasser par les stores.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <Coquille />
    </SafeAreaProvider>
  )
}
