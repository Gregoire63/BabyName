import {
  startRegistration, startAuthentication, browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill, sendSignal, WebAuthnAbortService
} from '@simplewebauthn/browser'

/**
 * Les passkeys, côté app : créer, se connecter, prévenir le trousseau.
 *
 * Le navigateur fait tout le travail délicat (Face ID, empreinte, code du
 * téléphone ; la clé privée ne quitte jamais l'appareil). Ici, on fait passer
 * les options du serveur au navigateur et la réponse du navigateur au
 * serveur, et on traduit les échecs en phrases.
 */

/** Le navigateur sait-il faire ? (Tous les navigateurs récents : oui.) */
export function passkeysPossibles(): boolean {
  return import.meta.client && browserSupportsWebAuthn()
}

/** Une phrase pour chaque façon d'échouer qu'une personne peut rencontrer. */
function expliquer(err: any): string {
  const nom = err?.name ?? err?.cause?.name
  const code = err?.data?.statusMessage ?? err?.statusMessage
  if (nom === 'NotAllowedError' || err?.code === 'ERROR_CEREMONY_ABORTED') return ''   // annulé : rien à dire
  if (nom === 'InvalidStateError' || err?.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
    return 'Cet appareil a déjà une passkey pour ce compte.'
  }
  if (nom === 'SecurityError' || err?.code === 'ERROR_INVALID_DOMAIN' || err?.code === 'ERROR_INVALID_RP_ID') {
    return 'Les passkeys ne marchent pas à cette adresse.'
  }
  if (code === 'passkey_inconnue') return 'Cette passkey n’est plus liée à aucun compte (elle a été retirée).'
  if (code === 'defi_expire') return 'Trop de temps a passé. Réessayez.'
  if (code === 'trop_d_essais') return 'Trop d’essais d’un coup. Réessayez dans quelques minutes.'
  return 'La passkey n’a pas pu servir. Réessayez, ou recevez un lien par e-mail.'
}

export type Resultat = { ok: true } | { ok: false; message: string }

/** Créer une passkey pour le compte connecté. */
export async function creerPasskey(): Promise<Resultat & { nom?: string }> {
  try {
    const optionsJSON = await $fetch<any>('/api/auth/passkey/inscription/options', { method: 'POST' })
    const reponse = await startRegistration({ optionsJSON })
    const r = await $fetch<any>('/api/auth/passkey/inscription', { method: 'POST', body: { reponse } })
    await rafraichirMoi()
    return { ok: true, nom: r?.passkey?.nom }
  } catch (err: any) {
    return { ok: false, message: expliquer(err) }
  }
}

/**
 * Se connecter avec une passkey.
 *
 * `autofill` : la demande reste en attente, et le clavier propose la passkey
 * quand on touche le champ marqué `autocomplete="… webauthn"` (connexion
 * sans rien taper). Un bouton qui lance une demande normale l'annule d'office.
 */
export async function connecterPasskey(autofill = false): Promise<Resultat> {
  try {
    if (autofill && !(await browserSupportsWebAuthnAutofill())) return { ok: false, message: '' }
    const optionsJSON = await $fetch<any>('/api/auth/passkey/connexion/options', { method: 'POST' })
    const reponse = await startAuthentication({ optionsJSON, useBrowserAutofill: autofill })
    await $fetch('/api/auth/passkey/connexion', { method: 'POST', body: { reponse } })
    await rafraichirMoi()
    return { ok: true }
  } catch (err: any) {
    // Passkey retirée du compte : on demande au trousseau de cesser de la
    // proposer, sinon elle reviendrait à chaque connexion.
    const d = err?.data?.data
    if (err?.data?.statusMessage === 'passkey_inconnue' && d?.rpID && d?.credentialID) {
      sendSignal({ signalName: 'unknownCredential', rpID: d.rpID, credentialID: d.credentialID }).catch(() => {})
    }
    return { ok: false, message: expliquer(err) }
  }
}

/** Arrêter une demande en attente (celle de l'autofill, en quittant la page). */
export function abandonnerPasskey() {
  try { WebAuthnAbortService.cancelCeremony() } catch { /* rien en cours */ }
}

/** Le nom a changé : le trousseau affichera le nouveau à la prochaine
 *  connexion, au lieu de celui du jour de la création. */
export async function signalerNom() {
  const r = await $fetch<any>('/api/auth/passkeys').catch(() => null)
  const moi = useMoi().value
  if (!r?.userID || !r.passkeys?.length || !moi) return
  sendSignal({ signalName: 'currentUserDetails', rpID: r.rpID, userID: r.userID,
               userName: moi.email || moi.pseudo, userDisplayName: moi.pseudo }).catch(() => {})
}

/** Après un retrait : le trousseau peut oublier les passkeys que le serveur
 *  ne reconnaît plus. Au mieux, sans garantie — c'est au navigateur de voir. */
export function signalerPasskeysRestantes(o: { rpID: string; userID: string | null; restantes: string[] }) {
  if (!o.userID) return
  sendSignal({ signalName: 'allAcceptedCredentials', rpID: o.rpID, userID: o.userID,
               allAcceptedCredentialIDs: o.restantes }).catch(() => {})
}
