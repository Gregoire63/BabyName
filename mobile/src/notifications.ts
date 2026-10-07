import * as Device from 'expo-device'
import type { NotificationResponse } from 'expo-notifications'
import { Platform } from 'react-native'

import { EXPO_GO, PROJET_EAS } from './site'

/**
 * Les notifications : « Nouvel accord », « Alice a rejoint votre liste ».
 *
 * Le natif ne décide de rien. La page demande où en est le téléphone
 * (`push.etat`) ou pose la question du téléphone sur un geste de la personne
 * (`push.demander`) ; on lui rend la permission et, si elle est donnée, le
 * jeton — l'adresse d'acheminement qu'elle confie au serveur du site, qui
 * envoie par le service d'Expo (app/server/utils/push.ts).
 */

/** Le canal Android. Le même nom que dans app.json et que côté serveur. */
const CANAL = 'accords'

/**
 * Le module des notifications, ou rien dans Expo Go. Il ne s'importe pas en
 * tête de fichier, exprès : dans Expo Go sur Android, le seul fait de le
 * charger arrête l'app avant son premier écran (« Runtime not ready » — les
 * notifications à distance en ont été retirées). On le charge donc à la
 * main, et jamais là-bas : dans Expo Go, l'app marche sans prévenir.
 */
const Notifications: typeof import('expo-notifications') | null =
  EXPO_GO ? null : require('expo-notifications')

// L'app ouverte : la bannière s'affiche quand même. La page ne se met pas à
// jour toute seule quand l'autre vote ; sans elle, on n'en saurait rien.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false
  })
})

export type EtatPush =
  | { ok: false }
  | { ok: true; permission: 'accordee' | 'refusee' | 'indeterminee'; jeton?: string }

/**
 * `demander` : pose la question du téléphone si elle peut encore l'être.
 * `ok: false` : ce téléphone ne peut pas (un simulateur, Expo Go, un projet
 * Expo pas encore relié) — la page ne montre alors rien.
 */
export async function etatPush(demander: boolean): Promise<EtatPush> {
  try {
    if (!Notifications || !Device.isDevice || !PROJET_EAS) return { ok: false }
    // Android 13 et après ne pose sa question que s'il existe un canal.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL, {
        name: 'Accords et invitations',
        importance: Notifications.AndroidImportance.HIGH
      })
    }
    let p = await Notifications.getPermissionsAsync()
    if (demander && !p.granted && p.canAskAgain) {
      p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })
    }
    // Refusé pour de bon : seuls les réglages du téléphone y peuvent quelque chose.
    if (!p.granted) return { ok: true, permission: p.canAskAgain ? 'indeterminee' : 'refusee' }
    const jeton = (await Notifications.getExpoPushTokenAsync({ projectId: PROJET_EAS })).data
    return { ok: true, permission: 'accordee', jeton }
  } catch {
    // Pas de réseau, service de notification absent (Android sans Firebase
    // réglé) : rien à prévenir pour l'instant, et rien de cassé.
    return { ok: false }
  }
}

/** Le chemin de l'app porté par une notification touchée (« /g/12/communs »). */
const cheminDe = (r: NotificationResponse): unknown =>
  r.notification.request.content.data?.chemin

/**
 * Une notification touchée : `suite` reçoit son chemin. Rend de quoi arrêter.
 * Celle qui a OUVERT l'app arrive aussi par ici sur certains téléphones : on
 * ne la remet qu'une fois (voir `ouverture`).
 */
let dejaRemise = ''
export function auToucher(suite: (chemin: unknown) => void): () => void {
  if (!Notifications) return () => {}
  const abonnement = Notifications.addNotificationResponseReceivedListener((r) => {
    const id = r.notification.request.identifier
    if (id === dejaRemise) return
    dejaRemise = id
    suite(cheminDe(r))
  })
  return () => abonnement.remove()
}

/** La notification qui a ouvert l'app, s'il y en a une : son chemin, une fois. */
export function ouverture(): unknown {
  if (!Notifications) return null
  try {
    const r = Notifications.getLastNotificationResponse()
    if (!r) return null
    dejaRemise = r.notification.request.identifier
    Notifications.clearLastNotificationResponse()
    return cheminDe(r)
  } catch { return null }
}
