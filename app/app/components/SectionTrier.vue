<script setup lang="ts">
import { filtrer, ordonner, type Prenom } from '~/composables/useCatalogue'
import { useGroupeCourant } from '~/composables/etatGroupe'

defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

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
    const v = suite.get(p.gp)!
    out.push(v.length ? { ...p, variantes: v } : p)
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

const carte = computed(() => tete.value[0] ?? null)
const suivante = computed(() => tete.value[1] ?? null)

/** La pile entiere : la tete figee, puis le reste dans l'ordre courant.
 *  Sert au decompte affiche et a « ecarter la famille ». */
const pioche = computed(() => {
  const vus = new Set(tete.value.map(p => p.l))
  return [...tete.value, ...suite.value.filter(p => !vus.has(p.l))]
})
const plafond = computed(() => HYGIENE + bonus.value)
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
      ? 'Vos vetos sont épuisés. Un veto, ça se dépense.'
      : e?.data?.statusMessage === 'deja_veto'
        ? 'Ce prénom a déjà un veto.'
        : 'Le veto n’a pas pu être posé.'
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
  trace = [{ x: e.clientX, t: performance.now() }]
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
function fin() {
  if (!glisse.value) return
  glisse.value = false; axe = null
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

// --- actions --------------------------------------------------------------
async function voter(valeur: 0 | 1 | 2) {
  const p = carte.value
  if (!p || quotaAtteint.value || envol.value) return

  // On laisse la carte partir AVANT de toucher a la pile : si on retire le
  // prenom tout de suite, le noeud est remplace et il n'y a plus rien a
  // animer — c'est ce qui donnait l'impression que la carte « saute ».
  envoler(valeur)
  await new Promise(r => setTimeout(r, 330))

  echange.value = true
  // Les autres graphies du meme son quittent la pile avec la carte : sans ca
  // elles reviendraient une par une, ce qui est exactement ce qu'on evite.
  const variantes = p.variantes ?? []
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
        s.delete(p.l); for (const v of variantes) s.delete(v)
        g.dejaVotes.value = s
        if (valeur === 2) g.aimes.value = g.aimes.value.filter(x => x.l !== p.l)
        faits.value = Math.max(0, faits.value - 1)
      }
      return null
    })
  if (r?.quota) quotaVif.value = r.quota

  // Le serveur ne renvoie les votes des autres QUE parce qu'on vient de voter
  // (regle du vote aveugle, cf. server/utils/votes.ts).
  const tous = (r?.votes ?? []).filter((v: any) => v.valeur !== undefined && v.pseudo)
  const moiId = g.etat.value?.moi?.user_id
  const autres = tous.filter((v: any) => v.user_id !== moiId)
  if (!autres.length) return

  // Accord total : j'ai dit oui, et tous ceux qui ont vote ont dit oui aussi.
  const nbMembres = g.etat.value?.avancement?.length ?? 2
  const accord = valeur === 2 && autres.every((v: any) => v.valeur === 2)
                 && tous.length >= nbMembres
  if (accord) {
    match.value = { prenom: p.l, avec: autres.map((v: any) => v.pseudo) }
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
  const daccord = autres.filter((v: any) => v.valeur === 2)
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

function demanderFamille() {
  const p = carte.value; if (!p) return
  racineBalayage = racineDe(p)
  familleAEcarter.value = familleDe(p)
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
      <button class="btn btn-0 mini" style="padding:6px 10px;flex:none"
              @click="g.ouvrirFiltres()">
        Filtres
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

      <div v-else-if="quotaAtteint" class="vide">
        <Etincelles :taille="34" couleur="var(--peche)" />
        <h2>{{ quotaServeur?.reste_jour === 0 ? 'C’est tout pour aujourd’hui'
                                              : 'C’est tout pour ce mois-ci' }}</h2>
        <p v-if="quotaServeur?.reste_jour === 0">
          {{ quotaServeur?.limite_jour }} prénoms par jour, {{ quotaServeur?.fait_mois }}
          sur {{ quotaServeur?.limite_mois }} ce mois-ci. Ça revient demain matin.
        </p>
        <p v-else>
          {{ quotaServeur?.limite_mois }} prénoms par mois dans la version
          gratuite, et vous y êtes.
        </p>
        <p class="mini doux" style="margin:0">
          Débloquer la liste la débloque pour tout le monde dedans — une liste
          de prénoms ne sert à rien si un seul des deux peut trier.
        </p>
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
            <ContenuCarte :p="suivante" :interactif="false" />
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

          <ContenuCarte :p="carte" @fiche="g.ouvrirFiche(carte.l)"
                        @favori="basculerFavori" @famille="demanderFamille"
                        @veto="demanderVeto" />
        </article>
        </Transition>
        </div>

        <div class="boutons">
          <button class="rond non" aria-label="Non" @click="voter(0)">✕</button>
          <button class="rond neutre" aria-label="Neutre" @click="voter(1)">~</button>
          <button class="rond oui" aria-label="Oui" @click="voter(2)">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 21.2s-8.4-5-8.4-11A5 5 0 0 1 12 7.1a5 5 0 0 1 8.4 3.1c0 6-8.4 11-8.4 11Z" />
            </svg>
          </button>
        </div>
      </div>
    </template>

    <Transition name="fondu">
      <div v-if="retour" class="retour carte">
        <Etincelles :taille="16" couleur="var(--peche)" une />
        <strong>{{ retour.prenom }}</strong>
        <span class="mini doux">
          {{ retour.qui.join(', ') }} aussi
        </span>
      </div>
    </Transition>

    <Feuille v-if="vetoPour" titre="Poser un veto" @fermer="vetoPour = null">
      <p style="margin:0 0 4px">
        <strong style="font-size:1.35rem">{{ vetoPour.l }}</strong>
      </p>
      <p class="mini doux" style="margin:0 0 12px">
        Un veto est <strong>définitif</strong> : ce prénom ne pourra plus jamais
        apparaître dans vos communs, quoi que vote l’autre. Personne d’autre ne
        verra que c’est vous qui l’avez posé.
      </p>
      <input v-model="motifVeto" class="champ" maxlength="200"
             placeholder="Pourquoi ? (pour vous, facultatif)">
      <p class="mini doux" style="margin:10px 0 0">
        Il vous en reste <strong>{{ vetosRestants }}</strong> sur {{ vetosMax }}.
      </p>
      <p v-if="erreurVeto" class="mini" style="color:var(--non);margin:8px 0 0">
        {{ erreurVeto }}
      </p>

      <template #pied="{ fermer }">
        <button class="btn btn-1 rouge-plein" :disabled="envoiVeto || !vetosRestants"
                @click="confirmerVeto(fermer)">
          {{ envoiVeto ? 'Un instant…' : `Poser mon veto sur ${vetoPour.l}` }}
        </button>
      </template>
    </Feuille>

    <EffetMatch v-if="match" :prenom="match.prenom" :avec="match.avec"
                @fermer="match = null"
                @communs="match = null; g.allerA('communs')" />

    <div v-if="familleAEcarter" class="voile-confirme" @click.self="familleAEcarter = null">
      <div class="carte pile confirme">
        <h2>Écarter toute la famille ?</h2>
        <p class="mini doux" style="margin:0">
          {{ familleAEcarter.length }} prénom{{ familleAEcarter.length > 1 ? 's' : '' }}
          {{ familleAEcarter.length > 1 ? 'passeront' : 'passera' }} en « non » d’un coup.
          C’est définitif : ils ne réapparaîtront plus dans votre tri.
        </p>
        <div class="ligne noms">
          <span v-for="f in familleAEcarter" :key="f.l" class="puce">{{ f.l }}</span>
        </div>
        <div class="ligne" style="gap:8px">
          <button class="btn btn-1" style="flex:1" @click="confirmerFamille">
            Écarter {{ familleAEcarter.length }}
          </button>
          <button class="btn btn-0 doux" @click="familleAEcarter = null">Annuler</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.retour { position: fixed; left: 16px; right: 16px; bottom: 86px; max-width: 528px;
  margin: 0 auto; display: flex; gap: 12px; align-items: center; padding: 10px 14px;
  z-index: 30; flex-wrap: wrap; }
.fondu-enter-active, .fondu-leave-active { transition: opacity .25s, translate .25s; }
.fondu-enter-from, .fondu-leave-to { opacity: 0; translate: 0 8px; }

.rouge-plein { background: var(--non); border-color: var(--non); color: #fff; }
.rouge-plein:disabled { opacity: .5; }

.voile-confirme { position: fixed; inset: 0; z-index: 65; background: rgba(26,35,78,.42);
  backdrop-filter: blur(3px); display: flex; align-items: flex-end;
  justify-content: center; padding: 16px; }
.confirme { width: 100%; max-width: 520px; margin-bottom: calc(8px + env(safe-area-inset-bottom));
  animation: monter .22s cubic-bezier(.2,.8,.3,1); }
@keyframes monter { from { transform: translateY(14px); opacity: .5 } }
.noms { flex-wrap: wrap; gap: 6px; max-height: 148px; overflow-y: auto; }
</style>
