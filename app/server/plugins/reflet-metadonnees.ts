/**
 * Le polyfill `reflect-metadata`, posé AVANT qu'une route ne se charge.
 *
 * @simplewebauthn/server vérifie les chaînes de certificats avec
 * @peculiar/x509, qui s'appuie sur tsyringe — et tsyringe exige
 * `Reflect.getMetadata` dès son chargement. SimpleWebAuthn importe bien le
 * polyfill, mais dans deux de ses fichiers seulement : dans le bundle du
 * Worker, tsyringe était évalué avant eux, et la route qui enregistre une
 * passkey plantait à son premier chargement (« tsyringe requires a reflect
 * polyfill », erreur 500). En production seulement : sous `nuxt dev`
 * (Node), l'ordre de chargement tombait juste. Importé ici, dans le point
 * d'entrée du serveur, il est en place avant toute route.
 */
import 'reflect-metadata'

export default defineNitroPlugin(() => {})
