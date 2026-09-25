<script setup lang="ts">
import { filtrer, filtresParDefaut, ordonner, trouverPrenom, sansAccent, type Prenom }
  from '~/composables/useCatalogue'
import { useGroupeCourant } from '~/composables/etatGroupe'

const props = defineProps<{ actif: boolean }>()
const g = useGroupeCourant()
const route = useRoute()

/**
 * Deux quotas, et ils ne disent pas la meme chose.
 *
 * Celui du SERVEUR separe le gratuit du payant : il est en base, il compte les
 * gestes, et on ne le contourne pas en vidant son cache. Voir
 * server/utils/quota.ts.
 *
 * Celui d'ICI est de l'hygiene : apres quarante prenoms d'affilee on juge mal.
 * Il ne s'applique donc qu'aux listes debloquees — pour les autres, le mur du
 * serveur fait deja le travail, et deux murs valent moins qu'un.
 */
// L'etat du groupe donne le quota au chargement ; chaque vote en renvoie la
// version a jour. On garde donc l'objet ENTIER et vivant : n'en recopier que
// le reste laissait l'ecran de blocage lire un reste_jour perime et annoncer
// « c'est tout pour ce mois-ci » a quelqu'un qui avait juste fini sa journee.
const quotaVif = ref<any>(null)
watch(() => g.etat.value?.quota, (q) => { if (q) quotaVif.value = q }, { immediate: true })
const quotaServeur = computed<any>(() => quotaVif.value)
const paye = computed(() => !!quotaServeur.value?.paye)
const reste = computed<number | null>(() =>
  !quotaVif.value || quotaVif.value.paye ? null : quotaVif.value.reste)
// L'hygiene est une constante du produit, pas un reglage de liste : la
// colonne quota_swipe_jour ne dit plus que la limite de la version gratuite,
// et elle ne veut rien dire sur une liste debloquee. Les confondre faisait
// tomber le mur d'hygiene au 20e swipe sur une liste payee.
const HYGIENE = 40
/**
 * Le squelette n'apparait qu'au bout d'un court delai. Mesure : a la deuxieme
 * ouverture d'une liste le catalogue est deja en memoire et la premiere carte
 * arrive en ~136 ms — le squelette ne s'affichait que 50 ms, le temps de
 * clignoter. Un squelette qui clignote est pire que pas de squelette.
 */
const attente = ref(false)
let minuteur: any = null
watch(() => g.pret.value, (pret) => {
  clearTimeout(minuteur)
  if (pret) { attente.value = false; return }
  minuteur = setTimeout(() => { attente.value = true }, 140)
}, { immediate: true })
onUnmounted(() => clearTimeout(minuteur))

// Le bonus vivait dans un ref nu : il repartait a zero a chaque rechargement
// et le quota se refermait aussitot. Il est du meme jour que le compteur, il
// se garde au meme endroit.
const PAS_BONUS = 40
const bonus = ref(0)
const faits = ref(0)
const match = ref<{ prenom: string; avec: string[] } | null>(null)
const retour = ref<{ prenom: string; qui: string[] } | null>(null)
const familleAEcarter = ref<Prenom[] | null>(null)
const rechercheOuverte = ref(false)
/** Des filtres differents de ceux d'origine ? (La recherche n'en est plus un.) */
const filtresActifs = computed(() => {
  const { recherche: _r, ...f } = g.filtres.value
  const { recherche: _d, ...d } = filtresParDefaut()
  return JSON.stringify(f) !== JSON.stringify(d)
})
const boiteFamille = ref<HTMLElement>()
useDialogue(boiteFamille, () => { familleAEcarter.value = null })
const cleJour = `pr_${g.gid}_${new Date().toISOString().slice(0, 10)}`

/** Tout ce qui reste a juger, graphie par graphie. Sert au balayage de
 *  famille, qui doit voir les graphies une a une. */
const dispoBrut = computed(() => {
  if (!g.pret.value) return []
  return filtrer(g.catalogue.value, g.filtres.value)
    .filter(p => !g.dejaVotes.value.has(p.l) && !g.vetos.value.has(p.l))
})

/**
 * Une carte par PRONONCIATION.
 *
 * Nelya, Nélya, Nélia, Nelia, Nëlya : cinq cartes pour une seule decision.
 * Le catalogue est trie par frequence, donc le premier survivant d'un groupe
 * est la graphie la plus repandue encore a juger — c'est elle qui porte la
 * carte, et les autres sont annoncees dessus. On collapse APRES le filtrage :
 * si une graphie a deja ete jugee seule, c'est la suivante qui prend la carte.
 */
const dispo = computed(() => {
  const chef = new Map<number, Prenom>()
  const suite = new Map<number, string[]>()
  for (const p of dispoBrut.value) {
    if (chef.has(p.gp)) suite.get(p.gp)!.push(p.l)
    else { chef.set(p.gp, p); suite.set(p.gp, []) }
  }
  const out: Prenom[] = []
  for (const p of chef.values()) {
    // On ECRASE toujours `variantes` : le catalogue y met toutes les graphies
    // du groupe, or un vote ne doit porter que sur celles que les filtres ont
    // laissees passer et qui restent a juger. Sans cet ecrasement, dire non a
    // Elyo repondrait pour un Hélio que la liste avait exclu.
    out.push({ ...p, variantes: suite.get(p.gp)! })
  }
  return out
})

/** L'ordre courant. Il change a chaque « oui » : ordonner() remonte ce qui
 *  ressemble aux prenoms aimes, et au 3e oui il bascule carrement du tri par
 *  frequence au tri par affinite. */
const suite = computed(() => ordonner(dispo.value, g.aimes.value))

/**
 * LA TETE DE PILE EST FIGEE.
 *
 * `suite` est recalculee a chaque vote. Sans ce verrou, le prenom qu'on
 * apercevait derriere la carte n'etait pas celui qui arrivait ensuite : il
 * etait remplace par un autre au moment meme du vote, ce qui se voyait comme
 * un rechargement. Promettre une carte et en donner une autre, c'est le seul
 * endroit de l'app ou l'interface ment.
 *
 * Les deux cartes visibles sont donc retenues telles quelles ; tout
 * reordonnancement, tout ajout ne s'applique qu'A PARTIR DE LA TROISIEME. Une
 * carte retenue qui cesse d'etre valable (votee, veto, sortie par un filtre)
 * est lachee — c'est le seul cas ou la tete bouge toute seule.
 *
 * Cout : l'affinite ne prend effet qu'une carte plus tard. Cela ne se voit pas.
 */
const TETE = 2
const tete = ref<Prenom[]>([])

watch(suite, (liste) => {
  const valides = new Map(liste.map(p => [p.l, p]))
  const garde: Prenom[] = []
  const vus = new Set<string>()
  for (const p of tete.value) {
    const frais = valides.get(p.l)          // on reprend l'objet a jour
    if (frais && !vus.has(p.l)) { garde.push(frais); vus.add(p.l) }
  }
  for (const p of liste) {
    if (garde.length >= TETE) break
    if (!vus.has(p.l)) { garde.push(p); vus.add(p.l) }
  }
  tete.value = garde
}, { immediate: true })

/**
 * UN PRÉNOM DEMANDÉ PAR L'ADRESSE PASSE DEVANT TOUT.
 *
 * Le bouton d'une fiche publique (scripts/seo.mjs) mène ici avec
 * `?prenom=louise`, au besoin à travers la connexion et la création de la
 * liste. La connexion a promis « votre liste commencera par Louise » : c'est
 * donc la première carte, même si les filtres l'écartent — on est venu pour
 * elle. Comme toute carte, elle emporte les autres graphies du même son encore
 * à juger ; c'est simplement celle qu'on a demandée qui fait face.
 *
 * L'épingle se pose AU-DESSUS de la tête figée, sans la toucher : dès qu'elle
 * est jugée (ou reçoit un veto), elle se lâche, et la carte qu'on voyait
 * derrière est bien celle qui arrive.
 */
const epingle = ref<Prenom | null>(null)
/** Epingle depuis la recherche un prenom DEJA juge : on le rejuge. Le vote
 *  existant ne doit donc pas la lacher tout de suite (voir le watch). */
let epingleDejaJuge = false
const couverts = computed(() => new Set(epingle.value
  ? [epingle.value.l, ...(epingle.value.variantes ?? [])] : []))

const carte = computed(() => epingle.value ?? tete.value[0] ?? null)
const suivante = computed(() => epingle.value
  ? tete.value.find(p => !couverts.value.has(p.l)) ?? null
  : tete.value[1] ?? null)

/**
 * L'épingle survit à un rechargement et au mur du jour : quelqu'un qui arrive
 * d'une fiche avec ses prénoms du jour déjà jugés retrouve Louise demain, en
 * premier, comme promis. Elle se lâche au jugement, pas avant.
 */
const cleEpingle = `pr_epingle_${g.gid}`
function retenirEpingle(nom: string | null) {
  try {
    if (nom) localStorage.setItem(cleEpingle, nom)
    else localStorage.removeItem(cleEpingle)
  } catch { /* navigation privee : l'epingle vit le temps de la page */ }
}

watch([() => g.dejaVotes.value, () => g.vetos.value], ([votes, vetos]) => {
  const e = epingle.value
  if (e && (vetos.has(e.l) || (!epingleDejaJuge && votes.has(e.l)))) {
    epingle.value = null
    retenirEpingle(null)
  }
})

/**
 * Choisi dans la recherche : il passe devant, meme deja juge — le rejuger
 * remplace l'ancien vote. Bloque, il ne revient pas (la recherche ne le
 * propose d'ailleurs pas).
 */
function epinglerChoisi(nom: string) {
  const p = g.parNom.value.get(nom)
  if (!p || g.vetos.value.has(p.l)) return
  const groupe = dispo.value.find(c => c.gp === p.gp)
  const autres = groupe ? [groupe.l, ...(groupe.variantes ?? [])].filter(l => l !== p.l) : []
  epingleDejaJuge = g.dejaVotes.value.has(p.l)
  epingle.value = { ...p, variantes: autres }
  retenirEpingle(p.l)
  // Le mur du jour cache la pile : on montre au moins sa fiche, et il attend
  // son tour en tete.
  if (quotaAtteint.value) {
    g.ouvrirFiche(p.l)
    dire(`${p.l} passera en premier dès que vous pourrez trier à nouveau.`)
  }
}

/** Ce que j'en avais dit, pour la carte d'un prenom rejuge. */
const dejaDit = computed<number | null>(() => {
  const e = epingle.value
  if (!e || !epingleDejaJuge || carte.value?.l !== e.l) return null
  const moi = g.etat.value?.moi?.user_id
  const v = g.votes.value.find((x: any) => x.user_id === moi && x.prenom === e.l)?.valeur
  return v === 0 || v === 1 || v === 2 ? v : null
})

/** Un message court, qui passe par-dessus sans rien bloquer. */
const info = ref('')
let minuteurInfo: any = null
function dire(texte: string) {
  info.value = texte
  clearTimeout(minuteurInfo)
  minuteurInfo = setTimeout(() => { info.value = '' }, 5000)
}
onUnmounted(() => clearTimeout(minuteurInfo))

const DEJA_DIT = ['dit non à', 'voté neutre pour', 'dit oui à'] as const

/**
 * Déjà jugé, déjà en accord, sous veto : on ne le remet pas en jeu — on le
 * dit. Un veto se dit sans son auteur, comme partout ailleurs dans l'app.
 */
function epingler(demande: string, depuisAdresse: boolean) {
  const p = trouverPrenom(g.catalogue.value, demande)
  const jugeOuVeto = !!p && (g.dejaVotes.value.has(p.l) || g.vetos.value.has(p.l))
  if (!p || jugeOuVeto) retenirEpingle(null)
  if (!p) return
  if (jugeOuVeto) {
    // Retrouvée après un rechargement, elle a pu être jugée entre-temps
    // (« La liste », un autre appareil) : on la lâche sans rien dire.
    if (!depuisAdresse) return
    const moi = g.etat.value?.moi?.user_id
    const v = g.votes.value.find((x: any) => x.user_id === moi && x.prenom === p.l)?.valeur
    dire(g.communs.value.some((c: any) => c.prenom === p.l)
      ? `${p.l} est déjà dans vos accords.`
      : g.vetos.value.has(p.l)
        ? `${p.l} : prénom bloqué dans cette liste.`
        : v === 0 || v === 1 || v === 2
          ? `Vous avez déjà ${DEJA_DIT[v]} ${p.l} dans cette liste.`
          : `Vous avez déjà jugé ${p.l} dans cette liste.`)
    return
  }
  const groupe = dispo.value.find(c => c.gp === p.gp)
  const autres = groupe
    ? [groupe.l, ...(groupe.variantes ?? [])].filter(l => l !== p.l)
    : []
  epingleDejaJuge = false
  epingle.value = { ...p, variantes: autres }
  retenirEpingle(p.l)
}

/**
 * Lue une fois, quand la liste est prête : la demande de l'adresse d'abord,
 * sinon celle qu'on avait retenue.
 */
let demandeLue = false
watch(() => g.pret.value, (pret) => {
  if (!pret || demandeLue) return
  demandeLue = true
  const d = route.query.prenom
  if (typeof d === 'string' && d.trim()) {
    epingler(d.slice(0, 60), true)
    // L'adresse redevient celle de la liste : recharger ne rejoue pas le message.
    const u = new URL(location.href)
    u.searchParams.delete('prenom')
    u.searchParams.delete('ref')
    history.replaceState(history.state, '', u.pathname + u.search + u.hash)
    return
  }
  let retenue: string | null = null
  try { retenue = localStorage.getItem(cleEpingle) } catch { /* stockage bloque */ }
  if (retenue) epingler(retenue, false)
}, { immediate: true })

/** La pile entiere : la tete figee, puis le reste dans l'ordre courant.
 *  Sert au decompte affiche et a « ecarter la famille ». */
const pioche = computed(() => {
  const vus = new Set(tete.value.map(p => p.l))
  return [...tete.value, ...suite.value.filter(p => !vus.has(p.l))]
})
const plafond = computed(() => HYGIENE + bonus.value)

/** Le mur vient-il du depart de la LISTE (nouveau membre sur une liste deja
 *  bien entamee) plutot que du sien ? On ne dit pas la meme chose. */
const departListeEpuise = computed(() => {
  const d = quotaServeur.value?.depart
  return !!d && d.fait < d.limite && d.liste_fait >= d.liste_limite
})
const nbAccords = computed(() => g.communs.value.length)

/**
 * Le passage du depart au filet se dit une fois, au moment ou il arrive.
 * Sans ca, le compteur « 165 restants » tombait a 15 sans explication, et
 * le mur arrivait comme une punition.
 */
const bascule = ref(false)
watch(() => quotaVif.value?.phase, (phase, avant) => {
  if (avant === 'depart' && phase === 'jour' && (quotaVif.value?.reste_jour ?? 0) > 0) {
    bascule.value = true
    setTimeout(() => { bascule.value = false }, 5000)
  }
})
const quotaAtteint = computed(() =>
  paye.value ? faits.value >= plafond.value : (reste.value !== null && reste.value <= 0))

/**
 * Vrai le temps qu'un vote remplace la carte de devant.
 *
 * Dans ce cas precis, la carte qui arrive est celle qu'on regardait deja
 * derriere, montee a sa taille reelle pendant le vol. La reanimer d'un
 * `scale(.94) opacity(.25)` la faisait re-apparaitre alors qu'elle etait
 * deja la — et laissait la place, une demi-seconde, a la carte d'encore
 * derriere. L'animation d'arrivee garde tout son sens quand la pile change
 * pour une autre raison : un filtre, un prenom remis en jeu.
 */
const echange = ref(false)

// --- veto ----------------------------------------------------------------
// Definitif et limite : ca ne se pose pas d'un geste, d'ou la confirmation.
const vetoPour = ref<Prenom | null>(null)
const motifVeto = ref('')
const erreurVeto = ref('')
const envoiVeto = ref(false)

const vetosMax = computed(() => g.etat.value?.groupe?.nb_vetos_max ?? 3)
const vetosRestants = computed(() => Math.max(0, vetosMax.value - g.mesVetos.value.length))

function demanderVeto() {
  if (!carte.value) return
  motifVeto.value = ''
  erreurVeto.value = ''
  vetoPour.value = carte.value
}

async function confirmerVeto(fermer: () => void) {
  const p = vetoPour.value
  if (!p || envoiVeto.value) return
  envoiVeto.value = true
  erreurVeto.value = ''
  try {
    await g.poserVeto(p.l, motifVeto.value.trim() || undefined)
    fermer()
  } catch (e: any) {
    erreurVeto.value = e?.data?.statusMessage === 'quota_veto_atteint'
      ? `Vos ${vetosMax.value} blocages sont utilisés : retirez-en un dans Classement › Mes choix pour en poser un autre.`
      : e?.data?.statusMessage === 'deja_veto'
        ? 'Ce prénom est déjà bloqué.'
        : 'Le blocage n’a pas pu être posé.'
  } finally { envoiVeto.value = false }
}

/** La ligne de contexte sous le nom de la liste : ou j'en suis, ce qui reste. */
const contexte = computed(() => g.pret.value
  ? (paye.value
      ? `${faits.value}/${plafond.value} jugés · ${pioche.value.length.toLocaleString('fr-FR')} possibles`
      : `${reste.value ?? '…'} swipes restants · ${pioche.value.length.toLocaleString('fr-FR')} possibles`)
  : '…')

onMounted(() => {
  faits.value = Number(localStorage.getItem(cleJour) ?? 0)
  bonus.value = Number(localStorage.getItem(`${cleJour}_bonus`) ?? 0)
})

/** « Encore 40 » doit tenir jusqu'a demain, pas jusqu'au prochain F5. */
function encore() {
  bonus.value += PAS_BONUS
  localStorage.setItem(`${cleJour}_bonus`, String(bonus.value))
}

// --- geste ----------------------------------------------------------------
const dx = ref(0), dy = ref(0), glisse = ref(false)
const envol = ref(false)
let x0 = 0, y0 = 0, axe: 'x' | 'y' | null = null
let tDebut = 0
/** Au-dela, un appui n'est plus un toucher : on tient la carte, on hesite. */
const TOUCHER_MS = 400
// UN SEUL seuil, et c'est voulu : le bandeau « Oui » est une promesse, pas un
// avertissement. Tant qu'il n'apparaissait qu'a la moitie du seuil de
// validation, il fallait pousser deux fois plus loin que ce que l'ecran
// annoncait. Il s'affiche desormais exactement quand relacher suffit.
const SEUIL = 52
// Un geste vif vaut un geste long : au-dela de cette vitesse on valide meme
// sans atteindre le seuil, sinon un « flick » ne fait rien. Le seuil est haut
// exprES : a 0,55 px/ms un glisse pose de 28 px passait pour un flick et
// votait tout seul. Un vrai flick depasse le millier de pixels par seconde.
const VITESSE = 1.1    // px/ms

// Vitesse du doigt : on garde les positions des ~110 dernieres ms et on
// mesure dessus. Une moyenne glissante exponentielle partait de zero et
// n'avait pas le temps de monter sur un flick de deux trames — elle plafonnait
// a 0,45 px/ms la ou le doigt allait a 2. Une fenetre dit la verite tout de
// suite.
const FENETRE = 110
let trace: { x: number, t: number }[] = []
function debut(e: PointerEvent) {
  if (quotaAtteint.value) return
  // Un geste qui commence sur un bouton appartient au bouton. Sans ce
  // garde-fou, setPointerCapture detourne la suite des evenements vers la
  // carte et le clic n'arrive JAMAIS : « Favoris », « Plus d'informations » et
  // « Écarter la famille » etaient inertes.
  if ((e.target as HTMLElement)?.closest?.('button')) return
  glisse.value = true; axe = null; x0 = e.clientX; y0 = e.clientY
  tDebut = performance.now()
  trace = [{ x: e.clientX, t: tDebut }]
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function bouge(e: PointerEvent) {
  if (!glisse.value) return
  const ax = e.clientX - x0, ay = e.clientY - y0
  if (!axe && Math.hypot(ax, ay) > 8) axe = Math.abs(ax) > Math.abs(ay) ? 'x' : 'y'
  dx.value = axe === 'y' ? 0 : ax
  dy.value = axe === 'x' ? 0 : Math.min(0, ay)
  const t = performance.now()
  trace.push({ x: e.clientX, t })
  while (trace.length > 2 && t - trace[0]!.t > FENETRE) trace.shift()
}
/**
 * TOUCHER LA CARTE OUVRE LA FICHE.
 *
 * Un toucher, c'est un appui bref qui n'a pas bouge (l'axe ne s'est jamais
 * decide : moins de 8 px). Tout le reste est un glissement. Un pointercancel
 * — le navigateur reprend la main — n'ouvre jamais rien.
 */
function fin(e?: PointerEvent) {
  if (!glisse.value) return
  const touche = e?.type === 'pointerup' && axe === null
    && performance.now() - tDebut < TOUCHER_MS
  glisse.value = false; axe = null
  if (touche) {
    dx.value = 0; dy.value = 0
    if (carte.value) g.ouvrirFiche(carte.value.l)
    return
  }
  const a = trace[0], b = trace[trace.length - 1]
  const vx = a && b && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0
  // Un doigt qui s'arrete avant de se lever n'a pas « lance » la carte : sans
  // ce garde-fou, la derniere vitesse connue resterait vraie indefiniment,
  // puisque plus aucun pointermove n'arrive.
  const arrete = !b || performance.now() - b.t > 90
  const vif = !arrete && Math.abs(vx) > VITESSE && Math.abs(dx.value) > SEUIL / 2
  if (dy.value < -SEUIL && Math.abs(dx.value) < SEUIL) voter(1)
  else if (dx.value > SEUIL || (vif && vx > 0)) voter(2)
  else if (dx.value < -SEUIL || (vif && vx < 0)) voter(0)
  else { dx.value = 0; dy.value = 0 }
}

const intention = computed(() => {
  if (dy.value < -SEUIL && Math.abs(dx.value) < SEUIL) return 'neutre'
  if (dx.value > SEUIL) return 'oui'
  if (dx.value < -SEUIL) return 'non'
  return null
})
const style = computed(() => glisse.value || dx.value || dy.value
  ? {
      transform: `translate(${dx.value}px, ${dy.value}px) rotate(${dx.value / 24}deg)`,
      opacity: envol.value ? 0 : 1,
      transition: glisse.value
        ? 'none'
        : envol.value
          ? 'transform .34s cubic-bezier(.32,0,.4,1), opacity .34s ease-in'
          : 'transform .2s'
    }
  : {})

/** Envoie la carte hors de l'ecran dans la direction du vote. */
function envoler(valeur: 0 | 1 | 2) {
  const L = window.innerWidth || 400
  if (valeur === 2)      { dx.value = L * 1.15;  dy.value = -70 }
  else if (valeur === 0) { dx.value = -L * 1.15; dy.value = -70 }
  else                   { dx.value = 0;         dy.value = -(window.innerHeight || 800) }
  envol.value = true
}

// --- clavier et lecteur d'ecran -------------------------------------------
/**
 * Trier sans le doigt (WCAG 2.1.1, RGAA 7.3).
 *
 * Le glissement n'est qu'un raccourci : les trois boutons font la meme chose,
 * et au clavier les fleches aussi — gauche non, droite oui, bas neutre, dans
 * le sens ou la carte part. Rien quand on ecrit dans un champ, quand un
 * dialogue est ouvert ou quand cet onglet n'est pas celui qu'on regarde.
 */
function auClavier(e: KeyboardEvent) {
  if (!props.actif || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return
  if (document.querySelector('[aria-modal="true"]')) return
  const cible = e.target as HTMLElement | null
  if (cible?.closest('input, textarea, select, [contenteditable="true"]')) return
  const v = e.key === 'ArrowLeft' ? 0 : e.key === 'ArrowRight' ? 2 : e.key === 'ArrowDown' ? 1 : null
  if (v === null) return
  e.preventDefault()
  voter(v)
}
onMounted(() => window.addEventListener('keydown', auClavier))
onUnmounted(() => window.removeEventListener('keydown', auClavier))

/**
 * Ce qu'un lecteur d'ecran doit entendre quand la carte change. Le focus
 * reste sur le bouton qu'on vient d'utiliser : sans cette annonce, on vote
 * « oui » et rien ne dit quel prenom vient d'arriver.
 */
const annonce = ref('')
watch(carte, (c, avant) => {
  if (!c) { annonce.value = ''; return }
  if (avant && avant.l === c.l) return
  const n = c.variantes?.length ?? 0
  annonce.value = n
    ? `${c.l}, et ${n} autre${n > 1 ? 's' : ''} graphie${n > 1 ? 's' : ''}`
    : c.l
})

// --- actions --------------------------------------------------------------
/**
 * Ranger ce que le serveur vient de répondre dans les votes connus.
 *
 * Le tri ne rechargeait rien : après un geste, la loupe ne disait pas « Oui »
 * sur le prénom qu'on venait d'aimer, et « À revoir » restait sur l'état
 * d'avant jusqu'au prochain rechargement. La réponse du vote contient déjà
 * tout ce qu'il faut : les votes sur CE prénom, le mien compris, visibles
 * maintenant que j'ai jugé (vote aveugle). Ils remplacent ceux qu'on avait.
 *
 * Les autres graphies : le serveur n'écrit mon vote dessus que s'il n'y en
 * avait pas un porté à la main. On n'ajoute donc que celles qui manquent.
 */
function rangerVotes(prenom: string, variantes: string[], valeur: number, revenus: any[] = []) {
  const moi = g.etat.value?.moi
  if (!moi) return
  const pseudo = (g.etat.value?.avancement ?? []).find((m: any) => m.user_id === moi.user_id)?.pseudo ?? ''
  const miens = new Set(g.votes.value.filter((v: any) => v.user_id === moi.user_id).map((v: any) => v.prenom))
  const suite = g.votes.value.filter((v: any) => v.prenom !== prenom)
  const surCeluiCi = revenus.filter((v: any) => v?.prenom === prenom && typeof v.valeur === 'number')
  if (!surCeluiCi.some((v: any) => v.user_id === moi.user_id)) {
    surCeluiCi.push({ prenom, user_id: moi.user_id, pseudo, valeur })
  }
  for (const nom of variantes) {
    if (!miens.has(nom)) suite.push({ prenom: nom, user_id: moi.user_id, pseudo, valeur })
  }
  g.votes.value = [...suite, ...surCeluiCi]
}

async function voter(valeur: 0 | 1 | 2) {
  const p = carte.value
  if (!p || quotaAtteint.value || envol.value) return
  const etaitEpingle = epingle.value === p
  // Un prenom rejuge depuis la recherche : il etait deja dans mes votes.
  const rejuge = etaitEpingle && epingleDejaJuge

  // On laisse la carte partir AVANT de toucher a la pile : si on retire le
  // prenom tout de suite, le noeud est remplace et il n'y a plus rien a
  // animer — c'est ce qui donnait l'impression que la carte « saute ».
  envoler(valeur)
  await new Promise(r => setTimeout(r, 330))

  echange.value = true
  // Les autres graphies du meme son quittent la pile avec la carte : sans ca
  // elles reviendraient une par une, ce qui est exactement ce qu'on evite.
  const variantes = p.variantes ?? []
  if (etaitEpingle) { epingle.value = null; epingleDejaJuge = false; retenirEpingle(null) }
  g.dejaVotes.value = new Set([...g.dejaVotes.value, p.l, ...variantes])
  if (valeur === 2) g.aimes.value = [...g.aimes.value, p]
  faits.value++
  localStorage.setItem(cleJour, String(faits.value))
  dx.value = 0; dy.value = 0; envol.value = false
  // apres que l'arrivee sans animation a ete mise en place
  setTimeout(() => { echange.value = false }, 60)
  const r = await $fetch<any>(`/api/groupes/${g.gid}/vote`,
    { method: 'POST', body: { prenom: p.l, valeur, variantes } })
    .catch((err: any) => {
      // 402 : le serveur a dit non. On remet le prenom dans la pile plutot que
      // de laisser croire qu'il a ete juge.
      if (err?.statusCode === 402 || err?.response?.status === 402) {
        const d = err?.data?.data?.quota ?? err?.data?.quota
        if (d) quotaVif.value = d
        const s = new Set(g.dejaVotes.value)
        // Rejuge, il l'etait deja avant : son ancien vote tient toujours.
        if (!rejuge) { s.delete(p.l); for (const v of variantes) s.delete(v) }
        g.dejaVotes.value = s
        if (valeur === 2) g.aimes.value = g.aimes.value.filter(x => x.l !== p.l)
        faits.value = Math.max(0, faits.value - 1)
        // Le prénom demandé n'a pas été jugé : il reprend sa place devant.
        if (etaitEpingle) { epingleDejaJuge = rejuge; epingle.value = p; retenirEpingle(p.l) }
      }
      return null
    })
  if (r?.quota) quotaVif.value = r.quota
  // Un vote change : la loupe, « Mes choix » et « À revoir » doivent le voir
  // tout de suite, sans recharger toute la liste à chaque geste.
  if (r) rangerVotes(p.l, variantes, valeur, r.votes)
  // Un prénom rejugé peut faire ou défaire un accord.
  if (r && rejuge) g.rechargerCommuns()

  // Le serveur ne renvoie les votes des autres QUE parce qu'on vient de voter
  // (regle du vote aveugle, cf. server/utils/votes.ts).
  //
  // Les observateurs ne comptent pas ici, des deux cotes : ni dans le nombre
  // de voix qu'on attend, ni parmi celles qui doivent dire oui. Sans ce
  // filtre, inviter sa mere supprimait purement et simplement l'ecran du
  // match — elle n'avait pas juge, donc l'accord n'etait jamais « complet ».
  const decideurs = (g.etat.value?.avancement ?? [])
    .filter((m: any) => m.role !== 'observateur')
  const estDecideur = new Set(decideurs.map((m: any) => m.user_id))
  const moiId = g.etat.value?.moi?.user_id
  const visibles = (r?.votes ?? []).filter((v: any) =>
    v.valeur !== undefined && v.pseudo && v.user_id !== moiId)
  const tous = (r?.votes ?? []).filter((v: any) =>
    v.valeur !== undefined && v.pseudo && estDecideur.has(v.user_id))
  const autres = tous.filter((v: any) => v.user_id !== moiId)
  if (!visibles.length) return

  // Accord total : j'ai dit oui, et tous ceux qui ont vote ont dit oui aussi.
  const nbMembres = decideurs.length || 2
  const accord = valeur === 2 && autres.every((v: any) => v.valeur === 2)
                 && tous.length >= nbMembres
  if (accord) {
    match.value = { prenom: p.l, avec: autres.map((v: any) => v.pseudo) }
    // La pastille des accords doit le compter sans attendre qu'on recharge.
    g.rechargerCommuns()
    return
  }
  // ON NE DIT JAMAIS QU'ON VOUS A REFUSE UN PRENOM.
  //
  // Le bandeau annoncait « Audrey : non » juste apres votre oui. C'est une
  // mauvaise nouvelle servie au pire moment, sur un prenom que vous veniez
  // d'aimer, et ca punit celui qui swipe le plus. Au bout de trois, on trie
  // en se demandant ce que l'autre va en penser — c'est exactement ce que le
  // vote aveugle est cense empecher.
  //
  // L'accord se dit, le refus ne se dit pas. Le desaccord a deja son endroit,
  // choisi et calme : le volet « A revoir » du classement, ou on y va quand on
  // veut, pas quand l'app le decide.
  //
  // Le bandeau, lui, compte les observateurs : « Mamie aussi », c'est
  // exactement ce qu'on est venu chercher en l'invitant. Ils n'ont pas voix
  // au chapitre, ils ont voix.
  const daccord = visibles.filter((v: any) => v.valeur === 2)
  if (!daccord.length) return
  retour.value = { prenom: p.l, qui: daccord.map((v: any) => v.pseudo) }
  setTimeout(() => { if (retour.value?.prenom === p.l) retour.value = null }, 2600)
}

async function basculerFavori() {
  // un seul chemin pour les gardes : celui de VueGroupe, partage avec
  // « Mes choix » et la recherche
  if (carte.value) await g.basculerFavori(carte.value.l)
}

/** Racine commune d'une famille : 70 % du début du slug, 4 lettres minimum. */
function racineDe(p: Prenom): string {
  return p.slug.slice(0, Math.max(4, Math.floor(p.slug.length * 0.7)))
}

/** Ce que « écarter la famille » va réellement balayer. */
function familleDe(p: Prenom): Prenom[] {
  const racine = racineDe(p)
  return dispoBrut.value.filter(x => x.slug.startsWith(racine)).slice(0, 25)
}

/** Le debut de prenom tel qu'il s'ecrit : « Maël » plutot que « mael ». */
function prefixeAffiche(p: Prenom, racine: string): string {
  let n = 0, i = 0
  for (; i < p.l.length && n < racine.length; i++) {
    if (/[a-z]/.test(sansAccent(p.l[i]!))) n++
  }
  return p.l.slice(0, i)
}

/**
 * Ce que la carte annonce sur son bouton « Non aux Maël… » : le debut de
 * prenom, et combien il en balaierait. Rien (null) quand il n'y a rien de plus
 * que ce prenom et ses graphies : un simple non suffit, le bouton disparait.
 */
function familleInfo(p: Prenom | null) {
  if (!p) return null
  const f = familleDe(p)
  const meme = new Set([p.l, ...(p.variantes ?? [])])
  if (!f.some(x => !meme.has(x.l))) return null
  const n = f.some(x => x.l === p.l) ? f.length : Math.min(25, f.length + 1)
  return { prefixe: prefixeAffiche(p, racineDe(p)), n }
}
const familleCarte = computed(() => familleInfo(carte.value))
const familleSuivante = computed(() => familleInfo(suivante.value))
const prefixeBalayage = ref('')

function demanderFamille() {
  const p = carte.value; if (!p) return
  racineBalayage = racineDe(p)
  prefixeBalayage.value = prefixeAffiche(p, racineBalayage)
  const famille = familleDe(p)
  // Un prénom épinglé hors des filtres n'est pas dans la pile : sans cet ajout,
  // on écartait toute sa famille sauf lui, et il restait affiché.
  familleAEcarter.value = famille.some(x => x.l === p.l) ? famille : [p, ...famille].slice(0, 25)
}
let racineBalayage = ''

// Un non sur vingt-cinq prénoms d'un coup, sans retour possible : ça se
// confirme, et en voyant la liste. Sinon on découvre trop tard ce qu'on a
// balayé.
async function confirmerFamille() {
  const cibles = familleAEcarter.value
  familleAEcarter.value = null
  if (!cibles?.length) return
  const s = new Set(g.dejaVotes.value)
  for (const c of cibles) s.add(c.l)
  g.dejaVotes.value = s
  // La racine part avec chaque vote : c'est elle qui permettra de remettre
  // exactement ce groupe-là, et pas un ensemble recalculé plus tard.
  await Promise.all(cibles.map(c =>
    $fetch(`/api/groupes/${g.gid}/vote`,
      { method: 'POST', body: { prenom: c.l, valeur: 0, balayage: racineBalayage } })
      .catch(() => null)))
}
</script>

<template>
  <div class="ecran">
    <div class="haut">
      <TeteListe class="titre" onglet="Swipe" compact :info="contexte" />
      <!-- Une icone, comme la loupe : un entonnoir (les curseurs sont deja
           l'onglet « La liste »). Le point dit que des filtres sont actifs. -->
      <button type="button" class="loupe" :aria-label="filtresActifs ? 'Filtres (actifs)' : 'Filtres'"
              aria-haspopup="dialog" @click="g.ouvrirFiltres()">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.5h16l-6.3 7.3v5.7l-3.4 1.9v-7.6Z" />
        </svg>
        <i v-if="filtresActifs" class="point" aria-hidden="true" />
      </button>
      <!-- La recherche vit ici, sous la loupe : c'est pendant le tri qu'on
           pense au prénom entendu la veille, pas dans les réglages. -->
      <button type="button" class="loupe" aria-label="Chercher un prénom"
              aria-haspopup="dialog" @click="rechercheOuverte = true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.2" /><path d="m15.2 15.2 4.8 4.8" />
        </svg>
      </button>
    </div>

    <!-- La forme de l'ecran est connue d'avance : on la dessine tout de suite
         plutot que d'ecrire « Chargement… » au milieu du vide. Rien ne saute
         quand la premiere carte arrive. -->
    <div v-if="!g.pret.value && attente" class="zone" aria-busy="true">
      <div class="cartes">
        <article class="carte fiche fantome">
          <div class="ligne" style="justify-content:space-between">
            <Squelette l="62px" :h="24" :r="999" />
            <Squelette l="104px" :h="28" :r="999" :retard="0.06" />
          </div>
          <Squelette l="58%" :h="40" :r="12" :retard="0.1" />
          <Squelette l="44%" :h="14" :retard="0.14" />
          <div class="ligne" style="gap:6px">
            <Squelette l="88px" :h="24" :r="999" :retard="0.18" />
            <Squelette l="70px" :h="24" :r="999" :retard="0.22" />
          </div>
          <div class="ligne" style="gap:16px">
            <Squelette l="74px" :h="14" :retard="0.26" />
            <Squelette l="62px" :h="14" :retard="0.3" />
            <Squelette l="54px" :h="14" :retard="0.34" />
          </div>
          <div class="graphe">
            <Squelette l="100%" :h="78" :r="12" :retard="0.38" />
          </div>
        </article>
      </div>
      <div class="boutons">
        <Squelette v-for="i in 3" :key="i" l="62px" :h="62" :r="999" :retard="i * 0.08" />
      </div>
    </div>

    <div v-else-if="!g.pret.value" class="zone" />

    <template v-else>
      <div v-if="quotaAtteint && paye" class="vide">
        <Etincelles :taille="34" couleur="var(--peche)" />
        <h2>C’est assez pour aujourd’hui</h2>
        <p>{{ plafond }} prénoms jugés. Trier à la chaîne abîme le jugement :
           les vingt derniers ne valent pas les vingt premiers.</p>
        <button class="btn" @click="encore">Encore {{ PAS_BONUS }} quand même</button>
      </div>

      <!-- Le mur de la version gratuite. Il tombe apres le depart, donc
           quand il y a deja quelque chose a montrer : on le montre. Et on dit
           que demain ca repart — un mur definitif se quitte, il ne s'achete
           pas. -->
      <div v-else-if="quotaAtteint" class="vide">
        <Etincelles :taille="34" couleur="var(--peche)" />
        <h2>C’est tout pour aujourd’hui</h2>
        <p v-if="departListeEpuise">
          Cette liste a déjà utilisé ses {{ quotaServeur?.depart?.liste_limite }} prénoms
          de départ, et vos {{ quotaServeur?.limite_jour }} du jour sont jugés.
        </p>
        <p v-else>
          Vos {{ quotaServeur?.depart?.limite }} prénoms de départ sont jugés, et les
          {{ quotaServeur?.limite_jour }} du jour aussi.
        </p>
        <p style="margin:0">
          {{ quotaServeur?.limite_jour }} de plus demain matin : la version gratuite ne
          s’arrête jamais.
        </p>
        <p v-if="nbAccords" class="bilan">
          <strong>{{ nbAccords }}</strong> accord{{ nbAccords > 1 ? 's' : '' }} déjà dans
          cette liste.
        </p>
        <p class="mini doux" style="margin:0">
          Débloquer la liste la débloque pour tout le monde dedans : plus aucune
          limite, et tout ce qui aide à choisir parmi vos accords.
        </p>
        <button class="btn btn-1" @click="g.ouvrirDebloquer()">Voir ce que ça ouvre</button>
      </div>

      <div v-else-if="!carte" class="vide">
        <h2>Plus rien à trier</h2>
        <p>Vos filtres ne laissent passer aucun prénom non jugé.</p>
        <button class="btn" @click="g.ouvrirFiltres()">Élargir les filtres</button>
      </div>

      <div v-else class="zone">
        <div class="cartes">
        <!-- La carte du fond est REMPLACEE, jamais renommee sur place : c'est
             la cle qui s'en charge. Le mode out-in a ete retire : mesure image
             par image, il creait un trou de ~90 ms sans aucune carte derriere,
             suivi d'un fondu de 340 ms. On voyait une carte se materialiser la
             ou elle aurait du etre deja posee. -->
        <Transition name="fond">
          <article v-if="suivante" :key="suivante.l" class="carte fiche derriere"
                   :class="{ monte: envol, sec: echange }">
            <ContenuCarte :p="suivante" :interactif="false" :famille="familleSuivante" />
          </article>
        </Transition>

        <Transition :name="echange ? 'reprise' : 'neuve'">
        <article :key="carte.l" class="carte fiche" :style="style"
                 @pointerdown="debut" @pointermove="bouge"
                 @pointerup="fin" @pointercancel="fin">
          <div v-if="intention" class="verdict" :class="intention">
            <Etincelles v-if="intention === 'oui'" :taille="16" />
            {{ intention === 'oui' ? 'Oui' : intention === 'non' ? 'Non' : 'Neutre' }}
          </div>

          <ContenuCarte :p="carte" :famille="familleCarte" :deja-dit="dejaDit"
                        @fiche="g.ouvrirFiche(carte.l)"
                        @favori="basculerFavori" @famille="demanderFamille"
                        @veto="demanderVeto" />
        </article>
        </Transition>
        </div>

        <p class="sr-only" aria-live="polite" aria-atomic="true">{{ annonce }}</p>
        <div class="boutons">
          <button type="button" class="rond non" :aria-label="`Non à ${carte.l}`"
                  aria-keyshortcuts="ArrowLeft" @click="voter(0)">
            <span aria-hidden="true">✕</span>
          </button>
          <button type="button" class="rond neutre" :aria-label="`Neutre pour ${carte.l}`"
                  aria-keyshortcuts="ArrowDown" @click="voter(1)">
            <span aria-hidden="true">~</span>
          </button>
          <button type="button" class="rond oui" :aria-label="`Oui à ${carte.l}`"
                  aria-keyshortcuts="ArrowRight" @click="voter(2)">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 21.2s-8.4-5-8.4-11A5 5 0 0 1 12 7.1a5 5 0 0 1 8.4 3.1c0 6-8.4 11-8.4 11Z" />
            </svg>
          </button>
        </div>
      </div>
    </template>

    <Transition name="fondu">
      <div v-if="bascule" class="retour carte" role="status">
        <span class="mini">
          Départ terminé : {{ quotaServeur?.limite_jour }} prénoms par jour désormais,
          ou sans limite en débloquant la liste.
        </span>
      </div>
    </Transition>

    <Transition name="fondu">
      <div v-if="info" class="retour carte" role="status">
        <span class="mini">{{ info }}</span>
      </div>
    </Transition>

    <Transition name="fondu">
      <div v-if="retour" class="retour carte" role="status">
        <Etincelles :taille="16" couleur="var(--peche)" une />
        <strong>{{ retour.prenom }}</strong>
        <span class="mini doux">
          {{ retour.qui.join(', ') }} aussi
        </span>
      </div>
    </Transition>

    <!-- « Veto » ne se comprenait pas : on BLOQUE un prénom. Le mot technique
         reste dans le code et l'API (vetos, poserVeto) ; l'écran dit ce qui
         arrive. -->
    <Feuille v-if="vetoPour" titre="Bloquer ce prénom" @fermer="vetoPour = null">
      <p style="margin:0 0 4px">
        <strong style="font-size:1.35rem">{{ vetoPour.l }}</strong>
      </p>
      <p class="mini doux" style="margin:0 0 12px">
        Un prénom bloqué ne sera <strong>jamais</strong> dans vos accords, quoi que
        votent les autres. Personne d’autre ne saura que c’est vous, et vous seul
        pourrez retirer ce blocage (Classement › Mes choix).
      </p>
      <input v-model="motifVeto" class="champ" maxlength="200"
             aria-label="Pourquoi le bloquer ? (facultatif, visible de vous seul)"
             placeholder="Pourquoi ? (pour vous, facultatif)">
      <p class="mini doux" style="margin:10px 0 0">
        Il vous reste <strong>{{ vetosRestants }}</strong>
        blocage{{ vetosRestants > 1 ? 's' : '' }} sur {{ vetosMax }}.
      </p>
      <p v-if="erreurVeto" class="mini" role="alert" style="color:var(--non);margin:8px 0 0">
        {{ erreurVeto }}
      </p>

      <template #pied="{ fermer }">
        <button class="btn btn-1 rouge-plein" :disabled="envoiVeto || !vetosRestants"
                @click="confirmerVeto(fermer)">
          {{ envoiVeto ? 'Un instant…' : `Bloquer ${vetoPour.l}` }}
        </button>
      </template>
    </Feuille>

    <FeuilleRecherche v-if="rechercheOuverte" @fermer="rechercheOuverte = false"
                      @choisir="epinglerChoisi" />

    <EffetMatch v-if="match" :prenom="match.prenom" :avec="match.avec"
                @fermer="match = null"
                @communs="match = null; g.allerA('communs')" />


    <Transition name="confirme">
    <div v-if="familleAEcarter" class="voile-confirme" @click.self="familleAEcarter = null">
      <div ref="boiteFamille" class="carte pile confirme" role="alertdialog" aria-modal="true"
           aria-labelledby="titre-famille" aria-describedby="texte-famille" tabindex="-1">
        <h2 id="titre-famille">Non à tous les « {{ prefixeBalayage }}… » ?</h2>
        <p id="texte-famille" class="mini doux" style="margin:0">
          Les {{ familleAEcarter.length }} prénoms qui commencent par
          « {{ prefixeBalayage }} » passent en « non » d’un coup : vous ne les verrez
          plus défiler un par un. Vous pourrez les remettre en jeu dans
          Classement › Mes choix.
        </p>
        <div class="ligne noms">
          <span v-for="f in familleAEcarter" :key="f.l" class="puce">{{ f.l }}</span>
        </div>
        <div class="ligne" style="gap:8px">
          <button class="btn btn-1" style="flex:1" @click="confirmerFamille">
            Non aux {{ familleAEcarter.length }}
          </button>
          <button class="btn btn-0 doux" @click="familleAEcarter = null">Annuler</button>
        </div>
      </div>
    </div>
    </Transition>
  </div>
</template>

<style scoped>
.confirme:focus { outline: none; }
.bilan { margin: 0; padding: 8px 14px; border-radius: var(--pastille);
  background: color-mix(in srgb, var(--menthe) 45%, var(--carte)); color: var(--texte); }
.ecran { display: flex; flex-direction: column; gap: 12px; height: 100%; min-height: 340px; }
.haut { display: flex; align-items: center; gap: 8px; }
.haut .titre { flex: 1; min-width: 0; }

.zone { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.cartes { position: relative; display: flex; flex: 1; min-height: 0; }

/* Les cartes se superposent TOUJOURS.
   La carte active etait en `position: relative`. Pendant le remplacement, la
   sortante et l'entrante sont toutes les deux dans le DOM : deux elements en
   flux dans une ligne flex, donc chacun la moitie de la largeur. On voyait
   l'ecran se couper en deux avec deux prenoms differents.
   `.neuve-leave-active` essayait bien de passer la sortante en absolu, mais
   `.cartes > .fiche:not(.derriere)` est plus specifique et gagnait. Plutot
   que de surencherir en specificite, on sort les deux du flux. */
.cartes > .fiche { position: absolute; inset: 0; }
.cartes > .fiche:not(.derriere) { z-index: 1; }

/* La carte suivante arrive : elle grandit depuis l'etat de la pile, elle ne
   surgit pas de nulle part. La sortante s'efface — apres un vote elle est
   deja partie au loin, mais pas quand la pile change pour une autre raison. */
/* « reprise » n'a volontairement aucune regle : la carte etait deja affichee
   en grand derriere, elle prend simplement sa place, sans re-arriver. */
.neuve-enter-active { transition: transform .3s cubic-bezier(.2,.9,.3,1), opacity .26s ease-out; }
.neuve-enter-from { transform: scale(.94) translateY(16px); opacity: .25; }
.neuve-leave-active { z-index: 2; transition: opacity .2s ease-in; }
.neuve-leave-to { opacity: 0; }
.fiche { touch-action: none; user-select: none; position: relative; flex: 1;
  display: flex; flex-direction: column; gap: 11px; min-height: 300px; }
.fiche.derriere { position: absolute; inset: 0; z-index: 0;
  transform: scale(.94) translateY(16px); opacity: .4; pointer-events: none;
  transition: transform .34s cubic-bezier(.2,.9,.3,1), opacity .34s; }
.fiche.derriere.monte { transform: scale(1) translateY(0); opacity: 1; }
/* la nouvelle carte de fond monte depuis rien ; l'ancienne s'efface d'un coup,
   la carte de devant occupe deja exactement sa place */
.fiche.derriere.fond-enter-from { opacity: 0; }
.fiche.derriere.fond-leave-active { opacity: 0; transition: none; }
/* Au moment d'un vote, la carte promue prend la place de devant et la suivante
   etait DEJA dans la pile : elle ne se materialise pas, elle est la. Un fondu
   ici se lit comme un chargement. Il garde tout son sens quand la pile change
   pour une autre raison : un filtre, un prenom remis en jeu. */
.fiche.derriere.sec { transition: none; }
.fiche.derriere.sec.fond-enter-from { opacity: .4; }


.verdict { position: absolute; top: 14px; left: 50%; translate: -50% 0; padding: 7px 20px;
  border-radius: var(--pastille); font-weight: 800; letter-spacing: .02em; z-index: 2;
  color: #fff; display: flex; align-items: center; gap: 7px; }
.verdict.oui { background: var(--oui); }
.verdict.non { background: var(--non); }
.verdict.neutre { background: var(--neutre); }

.boutons { display: flex; justify-content: center; gap: 20px; margin: 18px 0 4px; flex: none; }
.fantome { display: flex; flex-direction: column; gap: 12px; touch-action: auto; }
.rond { width: 62px; height: 62px; border-radius: 50%; font-size: 1.4rem; display: grid;
  place-items: center; border: 1px solid var(--trait); background: var(--carte);
  box-shadow: var(--ombre); cursor: pointer; transition: transform .08s; }
.rond:active { transform: scale(.93); }
.rond.non { color: var(--non); } .rond.oui { color: var(--oui); } .rond.neutre { color: var(--neutre); }
.rond svg { width: 30px; height: 30px; }

/* Un bandeau d'information ne doit jamais bloquer le tri : il passe
   par-dessus les boutons de vote, donc il laisse passer le doigt. */
.retour { position: fixed; left: 16px; right: 16px; bottom: 86px; max-width: 528px;
  margin: 0 auto; display: flex; gap: 12px; align-items: center; padding: 10px 14px;
  z-index: 30; flex-wrap: wrap; pointer-events: none; }
.fondu-enter-active, .fondu-leave-active { transition: opacity .25s, translate .25s; }
.fondu-enter-from, .fondu-leave-to { opacity: 0; translate: 0 8px; }

/* var(--fond) et pas du blanc : en sombre, le rouge s'eclaircit et le blanc
   dessus tombait sous 3:1. */
.rouge-plein { background: var(--non); border-color: var(--non); color: var(--fond); }
.rouge-plein:disabled { opacity: .5; }

.voile-confirme { position: fixed; inset: 0; z-index: 65; background-color: rgba(26,35,78,.42);
  backdrop-filter: blur(3px); display: flex; align-items: flex-end;
  justify-content: center; padding: 16px; }
.confirme { width: 100%; max-width: 520px; margin-bottom: calc(8px + env(safe-area-inset-bottom)); }
/* Elle arrive et repart : sans transition de sortie, elle disparaissait d'un
   coup a « Annuler », comme un plantage. */
.confirme-enter-active, .confirme-leave-active { transition: background-color .22s ease, backdrop-filter .22s ease; }
.confirme-enter-from, .confirme-leave-to { background-color: transparent; backdrop-filter: blur(0); }
.confirme-enter-active .confirme { transition: transform .22s cubic-bezier(.2,.8,.3,1), opacity .22s ease; }
.confirme-leave-active .confirme { transition: transform .2s cubic-bezier(.5,0,.9,.55), opacity .2s ease; }
.confirme-enter-from .confirme, .confirme-leave-to .confirme { transform: translateY(24px); opacity: 0; }
.loupe { flex: none; width: 38px; height: 38px; margin-right: -6px; border: 0; border-radius: 50%;
  background: none; color: var(--texte); display: grid; place-items: center; cursor: pointer; }
.loupe:active { background: var(--carte); }
.loupe svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 2.4;
  stroke-linecap: round; stroke-linejoin: round; }
.loupe { position: relative; }
.loupe .point { position: absolute; top: 7px; right: 6px; width: 8px; height: 8px; border-radius: 50%;
  background: var(--peche); box-shadow: 0 0 0 2px var(--fond); }
.noms { flex-wrap: wrap; gap: 6px; max-height: 148px; overflow-y: auto; }
</style>
