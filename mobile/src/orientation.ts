import * as Device from 'expo-device'
import * as ScreenOrientation from 'expo-screen-orientation'
import { Platform } from 'react-native'

/**
 * Le portrait, sur un téléphone Android seulement.
 *
 * Android 16 ignore le verrou d'orientation du manifeste sur les grands écrans
 * (tablettes, pliables), et Play le signale (29/10/2026). Le manifeste ne
 * verrouille donc plus rien sur Android (app.config.js) : une tablette tourne
 * comme elle veut, et le site a sa mise en page large (≥ 760 px).
 *
 * Un téléphone, lui, reste en portrait : couché, il n'a plus que 390 px de
 * haut, et la carte du tri n'y tient pas. Le verrou se pose ici, à
 * l'exécution, ce que Play ne compte pas comme une restriction.
 *
 * Sur iPhone, rien : app.json garde « portrait » et l'app ne va pas sur iPad
 * (supportsTablet: false).
 */
export async function portraitSurTelephone() {
  if (Platform.OS !== 'android') return
  try {
    const type = await Device.getDeviceTypeAsync()
    if (type === Device.DeviceType.PHONE) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
    }
  } catch { /* un verrou manqué ne doit pas empêcher l'app de s'ouvrir */ }
}
