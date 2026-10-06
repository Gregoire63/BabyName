/**
 * Dans l'app des stores : ce que la page y change, et le pont vers le natif.
 *
 * L'app iOS et l'app Android (dossier `mobile/`) affichent ce site dans une
 * vue web, sans écran à elles : c'est la page qui décide de tout, et qui
 * demande au natif ce qu'un navigateur ne sait pas faire — les notifications,
 * la feuille de partage du téléphone, ouvrir un lien dans le navigateur.
 *
 * LE PONT. Des messages JSON, dans les deux sens :
 *  - la page parle par `window.ReactNativeWebView.postMessage(texte)` ;
 *  - le natif répond en appelant `window.__babyNamedNatif(message)`.
 * Une question porte un `id`, la réponse le reprend (`demander`). Le natif
 * envoie aussi des événements sans qu'on lui demande rien (`ecouter`) : un
 * lien ouvert pendant que l'app tourne, une notification touchée.
 *
 * Le natif ne sait RIEN du produit, et c'est voulu : une mise à jour des
 * stores prend des jours, une mise en ligne du site une minute. Tout ce qui
 * peut vivre ici vit ici ; le natif garde quelques verbes (`mobile/src/pont.ts`
 * en tient la liste, à garder identique à celle-ci) :
 *
 *   la page dit      pret, theme   { sombre, fond, bords? }   (plugins/coquille)
 *                    partager      { titre, texte, url }  → { ok }
 *                    fichier       { nom, mime, texte }   → { ok }   à enregistrer, à envoyer
 *                    push.etat, push.demander  → { ok, permission, jeton? }
 *                    reglages      ouvre les réglages du téléphone
 *                    vibrer        { genre: 'succes' | 'leger' }
 *                    quitter       sortir de l'app (Android, réponse à `retour`)
 *   le natif dit     lien          { url }   un lien ouvert, une notification touchée
 *                    actif         l'app revient au premier plan
 *                    retour        le bouton « Retour » d'Android
 *
 * Un verbe que l'autre côté ne connaît pas est ignoré, des deux côtés : on
 * peut en ajouter sans casser les apps déjà installées.
 *
 * Hors de l'app (un navigateur, la PWA) : `dansApp` est faux, rien ne part,
 * et `demander` répond null tout de suite.
 */
export interface MessagePont { type: string; id?: string; [cle: string]: unknown }

// `coquilleDepuis` : shared/utils/coquille.ts, lu aussi par le serveur.
const coquille = typeof navigator === 'undefined' ? null : coquilleDepuis(navigator.userAgent)

const attentes = new Map<string, (m: MessagePont | null) => void>()
const ecouteurs = new Map<string, Set<(m: MessagePont) => void>>()
let numero = 0

/** Envoie au natif. Faux si le pont n'est pas là (pas dans l'app). */
function dire(m: MessagePont): boolean {
  const pont = (globalThis as any).ReactNativeWebView
  if (!coquille || typeof pont?.postMessage !== 'function') return false
  try { pont.postMessage(JSON.stringify({ v: 1, ...m })); return true } catch { return false }
}

/**
 * Pose une question au natif et attend sa réponse — ou null : pas dans l'app,
 * ou pas de réponse dans le délai (une vieille version de l'app qui ne
 * connaît pas ce verbe ne répond rien : la page ne doit jamais rester bloquée
 * dessus).
 */
function demander(type: string, charge: Record<string, unknown> = {}, delai = 6000): Promise<MessagePont | null> {
  return new Promise((resoudre) => {
    const id = `q${++numero}`
    const fin = (m: MessagePont | null) => { clearTimeout(minuteur); attentes.delete(id); resoudre(m) }
    const minuteur = setTimeout(() => fin(null), delai)
    attentes.set(id, fin)
    if (!dire({ ...charge, type, id })) fin(null)
  })
}

/** Écoute un événement du natif. Rend de quoi arrêter. */
function ecouter(type: string, f: (m: MessagePont) => void): () => void {
  if (!ecouteurs.has(type)) ecouteurs.set(type, new Set())
  ecouteurs.get(type)!.add(f)
  return () => { ecouteurs.get(type)?.delete(f) }
}

/** Ce que le natif nous dit : la réponse à une question, ou un événement. */
function recevoir(brut: unknown) {
  let m: any = brut
  if (typeof brut === 'string') { try { m = JSON.parse(brut) } catch { return } }
  if (!m || typeof m !== 'object' || typeof m.type !== 'string') return
  if (typeof m.id === 'string' && attentes.has(m.id)) { attentes.get(m.id)!(m); return }
  for (const f of ecouteurs.get(m.type) ?? []) {
    try { f(m) } catch (err) { console.warn('[coquille]', m.type, err) }
  }
}
if (coquille && typeof window !== 'undefined') (window as any).__babyNamedNatif = recevoir

export function useCoquille() {
  return {
    /** La coquille (plateforme, version), ou null dans un navigateur. */
    app: coquille,
    dansApp: !!coquille,
    dire, demander, ecouter
  }
}

/**
 * VENDRE, OU NON.
 *
 * Sur le web : oui. Dans une app des stores : jamais, et rien n'y mène — ni
 * l'offre, ni les fonctions montrées « à débloquer », ni « Offrir », ni un
 * code cadeau à saisir. Apple et Google prennent une commission sur tout
 * achat fait dans l'app OU vers lequel l'app envoie, ventes à déclarer une
 * par une ; ne rien y vendre est la seule façon de n'avoir rien à déclarer.
 * Une liste débloquée sur le site l'est aussi dans l'app : c'est la même.
 *
 * Deux plateformes, une nuance. Apple interdit jusqu'à la mention d'un achat
 * ailleurs. Google permet, à une app où rien ne s'achète, de DIRE où cela
 * s'achète — une phrase, sans lien (`mention`).
 *
 * Le serveur refuse de son côté tout achat et tout code cadeau venus d'une
 * app (server/utils/vente.ts) : un bouton oublié ici ne vendrait rien.
 */
export function useVente() {
  return {
    ouverte: !coquille,
    /** Android seulement : on peut écrire où la liste se débloque, sans lien. */
    mention: coquille?.plateforme === 'android'
  }
}

/**
 * Après s'être connecté : l'accueil, avec ce qu'on suivait (une invitation,
 * un prénom). Dans l'app Android, par un VRAI chargement de page et non par
 * le routeur : la vue web n'écrit le cookie de session sur le disque qu'à la
 * fin d'un chargement, ou une demi-minute plus tard. Sans cela, l'app fermée
 * d'un geste juste après la connexion l'avait oubliée à la réouverture.
 */
export function entrerApresConnexion(query: Record<string, string> = {}) {
  if (coquille?.plateforme === 'android') {
    const suite = new URLSearchParams(query).toString()
    location.replace(suite ? `/?${suite}` : '/')
    return Promise.resolve()
  }
  return navigateTo({ path: '/', query }, { replace: true })
}

/**
 * Un retour sous le doigt. Dans l'app, le natif s'en charge : une page web
 * n'a pas de vibreur sur iPhone, et celui d'Android demande une permission
 * que seule l'app peut avoir. Ailleurs, le vibreur du navigateur, s'il existe.
 */
export function vibrer(genre: 'succes' | 'leger' = 'leger') {
  if (coquille && dire({ type: 'vibrer', genre })) return
  try { navigator.vibrate?.(genre === 'succes' ? [18, 60, 26] : 25) } catch { /* pas de vibreur */ }
}

/**
 * Partager : la feuille du téléphone. Dans l'app Android, `navigator.share`
 * n'existe pas ; dans les deux apps, le natif fait mieux (le lien arrive
 * comme un lien, pas comme du texte). Ailleurs, le navigateur ; à défaut, le
 * presse-papiers — vrai si le lien y a été copié, pour que l'écran le dise.
 */
export async function partagerLien(o: { titre?: string; texte?: string; url: string }): Promise<{ copie: boolean }> {
  if (coquille) {
    const r = await demander('partager', { titre: o.titre ?? '', texte: o.texte ?? '', url: o.url }, 60000)
    if (r?.ok) return { copie: false }
  } else if (typeof navigator.share === 'function') {
    try { await navigator.share({ title: o.titre, text: o.texte, url: o.url }); return { copie: false } }
    catch (err: any) { if (err?.name === 'AbortError') return { copie: false } }
  }
  try { await navigator.clipboard.writeText(o.url); return { copie: true } } catch { return { copie: false } }
}
