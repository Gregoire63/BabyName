/**
 * L'achat dans l'app iOS : l'achat intégré de l'App Store.
 *
 * Trois acteurs, et aucun ne croit l'autre sur parole :
 *  - le SERVEUR tire un jeton pour la liste (préparer), puis relit lui-même
 *    chez Apple la transaction qu'on lui présente (server/utils/apple.ts) ;
 *  - le NATIF (mobile/src/achats.ts) ouvre la feuille d'achat d'Apple avec ce
 *    jeton, et garde la transaction « en suspens » tant qu'on ne lui a pas
 *    dit qu'elle est traitée ;
 *  - cette PAGE ne fait que passer les plats : elle ne décide ni du prix, ni
 *    de la liste, ni de ce qui est payé.
 *
 * LE CAS QUI COMPTE : l'app fermée entre le paiement et le déblocage (plus de
 * réseau, plus de batterie, un appel). L'argent est parti, rien n'est
 * débloqué. C'est pour lui que le natif ne « finit » une transaction qu'après
 * la réponse du serveur : StoreKit la représente à chaque lancement, et
 * `reprendreAchatsApple` la porte au serveur — qui sait encore, par le jeton,
 * pour quelle liste elle était.
 */
const { demander, app } = useCoquille()
const surIphone = app?.plateforme === 'ios'

const CLE_OFFRE = 'bn-offre-apple'
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))
const codeDe = (e: any): string => e?.data?.statusMessage ?? e?.statusMessage ?? ''

/**
 * L'app iOS peut-elle vendre ? Deux conditions, demandées au démarrage : le
 * serveur sait vérifier un achat chez Apple, et le téléphone connaît le
 * produit et son prix. La dernière réponse est gardée sur l'appareil pour que
 * l'offre soit là dès l'ouverture suivante, sans clignoter ; elle est
 * redemandée à chaque fois, et la vérité l'emporte.
 */
let ouverture: Promise<void> | null = null
let demandeLe = 0
export function ouvrirVenteApple(): Promise<void> {
  if (!surIphone) return Promise.resolve()
  // Prête et redemandée il y a peu : inutile d'y revenir à chaque retour dans l'app.
  if (offreApple.prete && Date.now() - demandeLe < 600000) return Promise.resolve()
  if (!offreApple.prete) {
    try {
      const garde = JSON.parse(localStorage.getItem(CLE_OFFRE) ?? 'null')
      if (garde?.produit && garde?.prix) Object.assign(offreApple, { prete: true, produit: garde.produit, prix: garde.prix })
    } catch { /* rien de gardé */ }
  }
  ouverture ??= (async () => {
    try {
      const e = await $fetch<{ ouvert: boolean; produit: string | null }>('/api/achats-apple/etat')
      demandeLe = Date.now()
      const p = e.ouvert && e.produit ? await demander('achat.produit', { produit: e.produit }, 20000) : null
      // Pas de réponse du natif (une app d'avant l'achat intégré) ou produit
      // inconnu d'Apple : pas d'offre.
      if (p?.ok && typeof p.prix === 'string' && p.prix) {
        Object.assign(offreApple, { prete: true, produit: e.produit, prix: p.prix })
        try { localStorage.setItem(CLE_OFFRE, JSON.stringify({ produit: e.produit, prix: p.prix })) } catch { /* plein */ }
      } else if (p || !e.ouvert) {
        Object.assign(offreApple, { prete: false, produit: '', prix: '' })
        try { localStorage.removeItem(CLE_OFFRE) } catch { /* rien */ }
      }
      // (Le natif muet : on garde ce qu'on savait, et l'on redemandera.)
    } catch { /* pas de réseau : on redemandera au retour au premier plan */ }
    finally { ouverture = null }
  })()
  return ouverture
}

export type IssueAchat =
  /** La liste est débloquée (par cet achat, ou par un déblocage payé d'avance). */
  | { etat: 'debloquee'; avance?: boolean }
  /** Payé, mais la liste venait d'être débloquée par quelqu'un d'autre : l'achat reste d'avance. */
  | { etat: 'avance' }
  /** La feuille d'Apple refermée. */
  | { etat: 'annule' }
  /** Achat à valider par un tiers (« Demander à acheter », la banque). */
  | { etat: 'attente' }
  /** L'autre parent est en train de payer. */
  | { etat: 'en_cours'; par: string | null }
  /** Payé chez Apple, pas encore confirmé par le serveur : se fera au prochain lancement. */
  | { etat: 'lent' }
  /** Un achat PRÉCÉDENT, payé, attend encore sa confirmation : on n'en lance pas un second par-dessus. */
  | { etat: 'en_suspens' }
  | { etat: 'erreur'; code: string }

/** Les transactions que le serveur n'a pas reconnues, pour cette ouverture de l'app. */
const etrangeres = new Set<string>()

/**
 * Porte une transaction au serveur, qui la relit chez Apple, puis dit au
 * natif qu'elle est traitée. On insiste un peu : Apple met parfois une
 * seconde à connaître une transaction que le téléphone vient de recevoir.
 * Null : on n'a pas pu savoir — la transaction reste en suspens, on la
 * retrouvera. `inconnue` : Apple dit ne pas la connaître, même en insistant.
 */
async function presenter(transaction: string, insister = true): Promise<{ etat: string; groupe: number | null } | null> {
  let inconnue = false
  for (const attente of insister ? [0, 1500, 4000] : [0]) {
    if (attente) await pause(attente)
    try {
      const r = await $fetch<{ etat: string; groupe: number | null }>('/api/achats-apple',
        { method: 'POST', body: { transaction } })
      // « etrangere » : payée, mais pas pour ce que le serveur vend aujourd'hui
      // (le produit a changé de nom entre-temps). On ne la clôt PAS : close,
      // elle serait perdue pour de bon ; gardée, elle servira quand le serveur
      // la reconnaîtra. On ne la représente simplement plus avant le prochain
      // lancement.
      if (r.etat === 'etrangere') { etrangeres.add(transaction); return r }
      await demander('achat.finir', { transaction }, 8000)
      return r
    } catch (e) {
      // Refusée pour de bon (mal formée, session perdue) : inutile d'insister.
      const code = codeDe(e)
      inconnue = code === 'transaction_inconnue'
      if (code && code !== 'transaction_inconnue' && code !== 'achat_indisponible') return null
    }
  }
  return inconnue ? { etat: 'inconnue', groupe: null } : null
}

/**
 * Passé ce délai, une transaction qu'Apple dit ne pas connaître ne sera jamais
 * confirmée (un achat d'essai d'une autre installation, par exemple). Elle ne
 * doit ni être rejouée à chaque retour dans l'app, ni — surtout — interdire
 * pour toujours d'acheter sur ce téléphone.
 */
const VIEILLE = 3_600_000

/**
 * Les transactions restées en suspens sur ce téléphone : au lancement, au
 * retour au premier plan, et avant tout nouvel achat (sinon on paierait deux
 * fois ce qu'on a déjà payé). Rend les listes qu'elles viennent de débloquer.
 * Une seule reprise à la fois.
 */
let reprise: Promise<number[]> | null = null
/** La feuille d'Apple est ouverte, ou son achat en train d'être porté au serveur. */
let achatEnVol = false
/** À la dernière reprise : les transactions payées, récentes, que le serveur n'a pas pu confirmer. */
let enSouffrance = 0
export function reprendreAchatsApple(): Promise<number[]> {
  // Pendant un achat, rien : la feuille d'Apple qui se referme ramène l'app au
  // premier plan, et la reprise trouverait « en suspens » la transaction même
  // que l'achat est en train de porter au serveur.
  if (!surIphone || !offreApple.prete || achatEnVol) return Promise.resolve([])
  reprise ??= (async () => {
    const debloquees: number[] = []
    let ratees = 0
    try {
      const r = await demander('achat.attente', {}, 15000)
      const suspens = Array.isArray(r?.transactions) ? r.transactions as { id?: unknown; le?: unknown }[] : []
      for (const t of suspens) {
        if (typeof t?.id !== 'string' || etrangeres.has(t.id)) continue
        // `le` : la date de l'achat, si le téléphone la donne. Sans elle, on la tient pour récente.
        const ancienne = typeof t.le === 'number' && Date.now() - t.le > VIEILLE
        const v = await presenter(t.id, !ancienne)
        if (v?.etat === 'inconnue' && ancienne) etrangeres.add(t.id)
        else if (!v || v.etat === 'inconnue') ratees++
        if (v?.etat === 'applique' && v.groupe) debloquees.push(v.groupe)
      }
    } finally { reprise = null; enSouffrance = ratees }
    // Les écrans ouverts se mettent à jour d'eux-mêmes (VueGroupe).
    for (const groupe of debloquees) window.dispatchEvent(new CustomEvent('babynamed:debloquee', { detail: { groupe } }))
    return debloquees
  })()
  return reprise
}

/**
 * Payé, et pas encore confirmé : on y revient de soi-même, sans attendre que
 * l'app soit rouverte. Apple met parfois plus que quelques secondes à
 * connaître, côté serveur, une transaction que le téléphone tient déjà —
 * surtout dans son bac à sable, celui de TestFlight et de sa validation — et
 * la personne, elle, regarde l'écran. Trois fois, de plus en plus tard ;
 * ensuite, c'est le prochain retour dans l'app qui reprend.
 */
const RAPPELS = [8000, 20000, 60000]
let rappel: ReturnType<typeof setTimeout> | null = null
function rappeler(delais = RAPPELS) {
  if (rappel || !delais.length) return
  rappel = setTimeout(() => {
    rappel = null
    reprendreAchatsApple().catch(() => null).then(() => { if (enSouffrance) rappeler(delais.slice(1)) })
  }, delais[0])
}

/** Débloquer cette liste par l'App Store. Ne lève jamais : l'issue dit tout. */
export async function acheterAvecApple(gid: number | string): Promise<IssueAchat> {
  const liste = Number(gid)
  // Un achat déjà payé et pas encore porté au serveur passe d'abord.
  if ((await reprendreAchatsApple().catch(() => [] as number[])).includes(liste)) return { etat: 'debloquee' }
  // … et s'il n'a pas pu l'être (le serveur ne répond pas, ou ne peut pas le
  // vérifier), on s'arrête là : rouvrir la feuille d'Apple, ce serait faire
  // payer une seconde fois quelqu'un qui attend déjà son déblocage.
  if (enSouffrance) return { etat: 'en_suspens' }

  let p: { deja?: boolean; avance?: boolean; jeton?: string; produit?: string }
  try {
    p = await $fetch(`/api/groupes/${liste}/achat-apple`, { method: 'POST' })
  } catch (e: any) {
    const code = codeDe(e)
    if (code === 'paiement_en_cours') return { etat: 'en_cours', par: e?.data?.data?.par ?? null }
    return { etat: 'erreur', code: code || 'reseau' }
  }
  if (p.deja) return { etat: 'debloquee', avance: !!p.avance }
  if (!p.jeton || !p.produit) return { etat: 'erreur', code: 'reponse' }

  // La feuille d'Apple. Dix minutes : on peut y ajouter une carte, y taper
  // un mot de passe. Au-delà, on rend la main — et si l'achat aboutit quand
  // même, il reste en suspens et sera repris.
  achatEnVol = true
  let r: Awaited<ReturnType<typeof demander>> = null
  try {
    r = await demander('achat.acheter', { produit: p.produit, jeton: p.jeton }, 600000)
    if (r?.ok && r.etat === 'achete' && typeof r.transaction === 'string') {
      const v = await presenter(r.transaction)
      // Pas confirmée — ou pas reconnue : dans les deux cas l'argent est
      // parti et la transaction reste en suspens. On ne dit pas « échec »,
      // et l'on y reviendra tout seul (sauf pour une transaction que le
      // serveur ne reconnaît pas : insister n'y changerait rien).
      if (!v || v.etat === 'inconnue') rappeler()
      if (!v || v.etat === 'etrangere' || v.etat === 'inconnue') return { etat: 'lent' }
      if (v.etat === 'applique') return { etat: 'debloquee' }
      if (v.etat === 'avance') return { etat: 'avance' }
      return { etat: 'erreur', code: v.etat }
    }
  } finally { achatEnVol = false }
  // Refermée, refusée, en attente d'un accord : on rend la place à l'autre parent.
  $fetch(`/api/groupes/${liste}/annuler-paiement`, { method: 'POST' }).catch(() => null)
  if (r?.etat === 'annule') return { etat: 'annule' }
  if (r?.etat === 'attente') return { etat: 'attente' }
  return { etat: 'erreur', code: r ? 'achat_refuse' : 'sans_reponse' }
}
