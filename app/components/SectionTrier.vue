<script setup lang="ts">
import { filtrer, ordonner, type Prenom } from '~/composables/useCatalogue'
import { useGroupeCourant } from '~/composables/etatGroupe'

defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

const quota = computed(() => g.etat.value?.groupe?.quota_swipe_jour ?? 40)
const bonus = ref(0)
const faits = ref(0)
const match = ref<{ prenom: string; avec: string[] } | null>(null)
const retour = ref<{ prenom: string; votes: any[] } | null>(null)
const familleAEcarter = ref<Prenom[] | null>(null)
const cleJour = `pr_${g.gid}_${new Date().toISOString().slice(0, 10)}`

const pioche = computed(() => {
  if (!g.pret.value) return []
  const dispo = filtrer(g.catalogue.value, g.filtres.value)
    .filter(p => !g.dejaVotes.value.has(p.l) && !g.vetos.value.has(p.l))
  return ordonner(dispo, g.aimes.value)
})
const carte = computed(() => pioche.value[0] ?? null)
const suivante = computed(() => pioche.value[1] ?? null)
const plafond = computed(() => quota.value + bonus.value)
const quotaAtteint = computed(() => faits.value >= plafond.value)

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
  ? `${faits.value}/${plafond.value} jugés · ${pioche.value.length.toLocaleString('fr-FR')} possibles`
  : '…')

onMounted(() => { faits.value = Number(localStorage.getItem(cleJour) ?? 0) })

// --- geste ----------------------------------------------------------------
const dx = ref(0), dy = ref(0), glisse = ref(false)
const envol = ref(false)
let x0 = 0, y0 = 0, axe: 'x' | 'y' | null = null
const SEUIL = 88

function debut(e: PointerEvent) {
  if (quotaAtteint.value) return
  // Un geste qui commence sur un bouton appartient au bouton. Sans ce
  // garde-fou, setPointerCapture detourne la suite des evenements vers la
  // carte et le clic n'arrive JAMAIS : « Favoris », « Plus d'informations » et
  // « Écarter la famille » etaient inertes.
  if ((e.target as HTMLElement)?.closest?.('button')) return
  glisse.value = true; axe = null; x0 = e.clientX; y0 = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function bouge(e: PointerEvent) {
  if (!glisse.value) return
  const ax = e.clientX - x0, ay = e.clientY - y0
  if (!axe && Math.hypot(ax, ay) > 8) axe = Math.abs(ax) > Math.abs(ay) ? 'x' : 'y'
  dx.value = axe === 'y' ? 0 : ax
  dy.value = axe === 'x' ? 0 : Math.min(0, ay)
}
function fin() {
  if (!glisse.value) return
  glisse.value = false; axe = null
  if (dy.value < -SEUIL && Math.abs(dx.value) < SEUIL) voter(1)
  else if (dx.value > SEUIL) voter(2)
  else if (dx.value < -SEUIL) voter(0)
  else { dx.value = 0; dy.value = 0 }
}

const intention = computed(() => {
  if (dy.value < -SEUIL / 2 && Math.abs(dx.value) < SEUIL) return 'neutre'
  if (dx.value > SEUIL / 2) return 'oui'
  if (dx.value < -SEUIL / 2) return 'non'
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
  g.dejaVotes.value = new Set([...g.dejaVotes.value, p.l])
  if (valeur === 2) g.aimes.value = [...g.aimes.value, p]
  faits.value++
  localStorage.setItem(cleJour, String(faits.value))
  dx.value = 0; dy.value = 0; envol.value = false
  // apres que l'arrivee sans animation a ete mise en place
  setTimeout(() => { echange.value = false }, 60)
  const r = await $fetch<any>(`/api/groupes/${g.gid}/vote`,
    { method: 'POST', body: { prenom: p.l, valeur } }).catch(() => null)

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
  // Le reste : on dit ce qui s'est dit, sans en faire un evenement.
  retour.value = { prenom: p.l, votes: autres }
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
  return pioche.value.filter(x => x.slug.startsWith(racine)).slice(0, 25)
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
    <div v-if="!g.pret.value" class="zone" aria-busy="true">
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

    <template v-else>
      <div v-if="quotaAtteint" class="vide">
        <Etincelles :taille="34" couleur="var(--peche)" />
        <h2>C’est assez pour aujourd’hui</h2>
        <p>{{ plafond }} prénoms jugés. Trier à la chaîne abîme le jugement :
           les vingt derniers ne valent pas les vingt premiers.</p>
        <button class="btn" @click="bonus += 20">Encore 20 quand même</button>
      </div>

      <div v-else-if="!carte" class="vide">
        <h2>Plus rien à trier</h2>
        <p>Vos filtres ne laissent passer aucun prénom non jugé.</p>
        <button class="btn" @click="g.ouvrirFiltres()">Élargir les filtres</button>
      </div>

      <div v-else class="zone">
        <div class="cartes">
        <!-- mode out-in : la carte du fond est REMPLACEE, jamais renommee sur
             place. Pendant le vol elle est montee a taille reelle ; y changer
             le texte affichait le prenom d'encore derriere, en grand, a la
             place de celui qu'on regardait. -->
        <Transition name="fond" mode="out-in">
          <article v-if="suivante" :key="suivante.l" class="carte fiche derriere"
                   :class="{ monte: envol }">
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
        <strong>{{ retour.prenom }}</strong>
        <span v-for="v in retour.votes" :key="v.user_id" class="mini doux">
          {{ v.pseudo }} : {{ v.valeur === 2 ? 'oui' : v.valeur === 1 ? 'neutre' : 'non' }}
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
                @fermer="match = null" />

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
