import { Pressable, StyleSheet, Text, View } from 'react-native'

/**
 * Le seul écran que l'app dessine elle-même : quand le site n'a pas pu
 * s'afficher (pas de réseau à l'ouverture, serveur en panne). Sans lui, une
 * page blanche. Les couleurs sont celles du site, clair ou sombre.
 */
export function Panne({ sombre, fond, reessayer }: { sombre: boolean; fond: string; reessayer: () => void }) {
  const encre = sombre ? '#eef0f7' : '#1a234e'
  const doux = sombre ? '#9298b2' : '#5f6480'
  return (
    <View style={[styles.plein, { backgroundColor: fond }]} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <Text style={[styles.titre, { color: encre }]} accessibilityRole="header">Pas de connexion</Text>
      <Text style={[styles.texte, { color: doux }]}>
        babyNamed n’a pas pu s’ouvrir. Vérifiez votre connexion, puis réessayez.
      </Text>
      <Pressable accessibilityRole="button" onPress={reessayer}
                 style={({ pressed }) => [styles.bouton, { backgroundColor: encre, opacity: pressed ? 0.8 : 1 }]}>
        <Text style={[styles.libelle, { color: fond }]}>Réessayer</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  plein: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  titre: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  texte: { fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 320 },
  bouton: { marginTop: 12, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, minWidth: 180, alignItems: 'center' },
  libelle: { fontSize: 16, fontWeight: '800' }
})
