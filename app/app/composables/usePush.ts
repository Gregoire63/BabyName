/**
 * Être prévenu sur son téléphone — dans l'app des stores seulement.
 *
 * « Vous avez un nouvel accord » arrive quand l'autre trie de son côté : la
 * seule chose que le site ne sait pas faire. Le téléphone demande la
 * permission UNE fois (iOS ne la redemande jamais) : on ne la demande donc
 * que sur un geste — le bouton des réglages, ou celui de la fête d'un accord —
 * jamais à l'ouverture.
 *
 * ET RIEN NE S'ENREGISTRE SANS CE GESTE. Certains téléphones (Android avant
 * la version 13) permettent les notifications d'office, sans rien demander à
 * personne : une permission déjà là ne suffit donc pas. On retient, sur le
 * téléphone, POUR QUI le geste a été fait (`CLE_PUSH_POUR`) ; le serveur ne
 * reçoit le jeton que pour ce compte-là.
 *
 * Cinq états, lus par les écrans :
 *  - absent     : pas dans l'app, ou ce téléphone ne peut pas (pas de réponse
 *                 du natif, pas de service de notification) : rien à montrer ;
 *  - a-demander : jamais demandé par ce compte — le bouton ;
 *  - actif      : voulu, permis, et ce téléphone est enregistré pour ce compte ;
 *  - coupe      : coupé ici, d'un geste — le bouton pour y revenir, mais on ne
 *                 le repropose plus à chaque accord ;
 *  - refuse     : refusé dans le téléphone — seuls ses réglages y peuvent
 *                 quelque chose, on y mène.
 *
 * Le jeton (une adresse d'acheminement) est donné par le natif, gardé par le
 * serveur (api/appareils) : il part à la déconnexion, quand on coupe, et avec
 * le compte.
 */
export type EtatPush = 'absent' | 'a-demander' | 'actif' | 'coupe' | 'refuse'

const etat = ref<EtatPush>('absent')
let jeton = ''

/**
 * Deux réglages du TÉLÉPHONE, gardés à la déconnexion (utils/stockageLocal) :
 * pour qui les notifications ont été voulues ici, et si on les y a coupées.
 * Se reconnecter ne doit ni les rallumer contre son gré, ni obliger à les
 * redemander ; et le suivant sur ce téléphone n'hérite de rien — ce n'est pas
 * lui qui a fait le geste.
 */
export const CLE_PUSH_POUR = 'bn-push-pour'
export const CLE_PUSH_COUPE = 'bn-push-coupe'
/** Effacé à la déconnexion : « déjà donné au serveur aujourd'hui ». */
const CLE_ENVOYE = 'bn-push-envoye'
const lire = (cle: string) => { try { return localStorage.getItem(cle) } catch { return null } }
const poser = (cle: string, v: string | null) => {
  try { v === null ? localStorage.removeItem(cle) : localStorage.setItem(cle, v) } catch { /* mode privé */ }
}

/**
 * Donne ce téléphone au serveur — une fois par jour, par jeton et par compte :
 * pas un appel à chaque ouverture, mais de quoi se réenregistrer seul si le
 * serveur l'a oublié entre-temps (appareils déconnectés).
 */
async function enregistrer(): Promise<boolean> {
  const { app } = useCoquille()
  const moi = useMoi().value
  if (!app || !moi || !jeton) return false
  const marque = `${moi.id}:${jeton}:${new Date().toISOString().slice(0, 10)}`
  if (lire(CLE_ENVOYE) === marque) return true
  const r = await $fetch<{ ok: boolean }>('/api/appareils',
    { method: 'POST', body: { jeton, plateforme: app.plateforme } }).catch(() => null)
  if (r?.ok) poser(CLE_ENVOYE, marque)
  return !!r?.ok
}

/** Ce que répond le natif à `push.etat` et à `push.demander`. */
async function appliquer(r: any) {
  if (!r?.ok) { etat.value = 'absent'; return }
  if (r.permission === 'refusee') { etat.value = 'refuse'; return }
  if (lire(CLE_PUSH_COUPE)) { etat.value = 'coupe'; return }
  // Permis par le téléphone ne veut pas dire voulu par la personne (en-tête).
  const moi = useMoi().value
  const voulu = !!moi && lire(CLE_PUSH_POUR) === moi.id
  if (r.permission !== 'accordee' || !voulu) { etat.value = 'a-demander'; return }
  jeton = typeof r.jeton === 'string' ? r.jeton : ''
  if (!jeton) { etat.value = 'absent'; return }
  etat.value = (await enregistrer()) ? 'actif' : 'a-demander'
}

/** À l'ouverture, une fois connecté : où en est ce téléphone ? Ne demande rien. */
export async function synchroniserPush() {
  const { dansApp, demander } = useCoquille()
  if (!dansApp || !useMoi().value) return
  await appliquer(await demander('push.etat'))
}

export function usePush() {
  const { demander, dire } = useCoquille()

  /** Le geste : la permission du téléphone (la première fois), puis l'enregistrement. */
  async function activer() {
    const moi = useMoi().value
    if (!moi) return
    // Le geste est fait, quoi que réponde le téléphone : autorisé plus tard
    // dans ses réglages, il sera enregistré au retour dans l'app.
    poser(CLE_PUSH_POUR, moi.id)
    poser(CLE_PUSH_COUPE, null)
    if (etat.value === 'refuse') { dire({ type: 'reglages' }); return }
    // Une minute : la question du téléphone attend qu'on y réponde.
    await appliquer(await demander('push.demander', {}, 60000))
  }

  /** Couper ici, sans toucher aux réglages du téléphone. */
  async function couper() {
    poser(CLE_PUSH_COUPE, '1')
    poser(CLE_PUSH_POUR, null)
    await oublierPush()
    if (etat.value === 'actif') etat.value = 'coupe'
  }

  return { etat: readonly(etat), activer, couper }
}

/**
 * « Déconnecter mes autres appareils » fait oublier au serveur TOUS les
 * téléphones du compte : celui qu'on garde en main se redonne aussitôt.
 */
export async function redonnerPush() {
  poser(CLE_ENVOYE, null)
  await synchroniserPush()
}

/**
 * Ce téléphone ne doit plus être prévenu pour ce compte : avant de se
 * déconnecter (un appareil déconnecté qui reçoit « nouvel accord » dit ce
 * qu'il ne devrait plus dire), et quand on coupe.
 */
export async function oublierPush() {
  if (!jeton) return
  poser(CLE_ENVOYE, null)
  await $fetch('/api/appareils', { method: 'DELETE', body: { jeton } }).catch(() => null)
  jeton = ''
}
