<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { useVerdicts, MOT } from '~/composables/useVerdicts'
import { expliquerDesaccords, type Explication } from '~/composables/usePortrait'

/**
 * Les desaccords, et la possibilite d'en revenir.
 *
 * Le manque etait la : un « non » donne en trois secondes enterrait
 * definitivement un prenom que l'autre adorait, et rien ne le disait jamais.
 * Ici on voit qui a dit quoi, et on peut changer d'avis — « ah, toi tu aimes
 * bien ? bon, pourquoi pas finalement ».
 *
 * Aucun texte d'explication (28/09, à la demande de Greg) : les titres des
 * deux groupes, les pastilles et les boutons se lisent seuls. Les deux
 * groupes se replient (01/10, à sa demande aussi : voir basculer()).
 */
const g = useGroupeCourant()
const { aRevoir } = useVerdicts()

const occupe = ref('')
const match = ref<{ prenom: string; avec: string[] } | null>(null)

/**
 * « Ce n'est peut-etre pas Marius, c'est trois syllabes. »
 *
 * L'ecran disait qui avait dit quoi, jamais pourquoi. La reponse est dans les
 * votes deja visibles : rien de nouveau n'est revele ici, c'est la meme
 * matiere, lue autrement. Reserve aux listes debloquees.
 */
const paye = computed(() => !!(g.etat.value?.groupe as any)?.paye)
const moiId = computed(() => g.etat.value?.moi?.user_id ?? '')

// Toutes les explications d'un coup, et seulement quand les votes changent :
// calculées ligne par ligne dans le gabarit, elles relisaient tous les votes
// pour chaque désaccord (voir expliquerDesaccords).
const pourquoi = computed<Map<string, Explication>>(() => paye.value
  ? expliquerDesaccords(aRevoir.value.map(v => v.prenom), g.votes.value as any, g.parNom.value, moiId.value)
  : new Map())

/**
 * DEUX GROUPES : ce que j'ai refuse, ce que l'autre a refuse.
 *
 * Melanges, on ne savait pas d'un coup d'oeil sur quoi on pouvait ceder
 * soi-meme et sur quoi il fallait en parler. Avec plus de deux decideurs, le
 * second groupe devient « les autres ». Rien de nouveau n'est revele : ce sont
 * les memes votes, deja visibles ici, ranges autrement.
 */
const autresDecideurs = computed(() => (g.etat.value?.avancement ?? [])
  .filter((m: any) => m.role !== 'observateur' && m.user_id !== moiId.value)
  .map((m: any) => m.pseudo as string))
const eux = computed(() => autresDecideurs.value.length === 1 ? autresDecideurs.value[0]! : '')
/** « qu’Alice » mais « que Paul » ; « d’Alice », « de Paul ». */
const voyelle = (nom: string) => /^[aeiouyhàâäéèêëîïôöùûü]/i.test(nom)
const que = (nom: string) => voyelle(nom) ? `qu’${nom}` : `que ${nom}`

const groupes = computed(() => [
  { cle: 'moi', titre: 'Ceux que vous n’avez pas aimés',
    liste: aRevoir.value.filter(v => v.mien === 0) },
  { cle: 'eux', titre: eux.value ? `Ceux ${que(eux.value)} n’a pas aimés` : 'Ceux que les autres n’ont pas aimés',
    liste: aRevoir.value.filter(v => v.mien !== 0) }
].filter(gr => gr.liste.length))

/**
 * LES DEUX GROUPES SE REPLIENT (volets dépliables).
 *
 * Avec des dizaines de désaccords, on ne s'y retrouvait plus : pour atteindre
 * ceux d'Alice, il fallait faire défiler tous les siens. Chaque groupe se
 * replie d'un toucher sur son en-tête, qui garde le compte : replié, on sait
 * encore ce qu'il contient.
 *
 *  - L'en-tête reste collé en haut pendant qu'on fait défiler son groupe : on
 *    le replie de n'importe où, sans remonter le chercher. Replié depuis là,
 *    l'écran remonte d'abord au début du groupe, sinon on se retrouverait au
 *    milieu de l'autre sans savoir comment.
 *  - Ce qui est replié est retenu sur l'appareil, par liste (`pr_<liste>_…` :
 *    effacé avec la liste et à la déconnexion, voir stockageLocal).
 *  - Motif ARIA « accordéon » : un titre qui contient un bouton,
 *    aria-expanded, aria-controls ; replié, le groupe n'est plus dans la page
 *    (display: none), ni pour le clavier ni pour un lecteur d'écran.
 */
const cleReplies = `pr_${g.gid}_revoir_replies`
function lireReplies(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(cleReplies) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}
const replies = ref(new Set<string>(lireReplies()))

/** Le conteneur qui fait défiler la page (une section du pager). */
function defileur(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n
  }
  return null
}

function basculer(cle: string, e: MouseEvent) {
  const s = new Set(replies.value)
  if (s.has(cle)) s.delete(cle)
  else {
    s.add(cle)
    const section = (e.currentTarget as HTMLElement).closest('section')
    const d = section && defileur(section)
    if (section && d && section.getBoundingClientRect().top < d.getBoundingClientRect().top) {
      section.scrollIntoView({ block: 'start' })
    }
  }
  replies.value = s
  try { localStorage.setItem(cleReplies, JSON.stringify([...s])) } catch { /* navigation privée */ }
}

/**
 * Le volet s'ouvre et se ferme en hauteur (WAAPI), puis Vue pose ou retire
 * display: none. `overflow: hidden` le temps du geste seulement : ouvert, il
 * couperait l'ombre des cartes.
 */
const sansMouvement = () => matchMedia('(prefers-reduced-motion: reduce)').matches
function animer(el: Element, de: Keyframe, a: Keyframe, ms: number, courbe: string, fini: () => void) {
  const e = el as HTMLElement
  if (sansMouvement() || typeof e.animate !== 'function') return fini()
  e.style.overflow = 'hidden'
  const anim = e.animate([de, a], { duration: ms, easing: courbe })
  anim.onfinish = anim.oncancel = () => { e.style.overflow = ''; fini() }
}
function deplier(el: Element, fini: () => void) {
  const h = (el as HTMLElement).scrollHeight
  animer(el, { height: '0px', paddingTop: '0px', opacity: 0 }, { height: `${h}px`, paddingTop: '9px', opacity: 1 },
    240, 'cubic-bezier(.2,.8,.3,1)', fini)
}
function replier(el: Element, fini: () => void) {
  const h = (el as HTMLElement).offsetHeight
  animer(el, { height: `${h}px`, paddingTop: '9px', opacity: 1 }, { height: '0px', paddingTop: '0px', opacity: 0 },
    190, 'cubic-bezier(.5,0,.9,.55)', fini)
}

async function changer(prenom: string, valeur: 0 | 1 | 2,
                       autres: { pseudo: string; observateur: boolean }[]) {
  occupe.value = prenom
  const avant = new Set(g.communs.value.map((c: any) => c.prenom))
  try {
    await g.voter(prenom, valeur)
    // Devenu commun a l'instant : c'est le moment qui merite la fete, et c'est
    // celui qui change d'avis qui la voit — l'autre l'a deja vue, ou la verra.
    const apres = new Set(g.communs.value.map((c: any) => c.prenom))
    if (!avant.has(prenom) && apres.has(prenom)) {
      // « Vous etes d'accord avec… » ne nomme que ceux dont l'accord compte.
      match.value = { prenom, avec: autres.filter(a => !a.observateur).map(a => a.pseudo) }
    }
  } finally { occupe.value = '' }
}
</script>

<template>
  <div class="pile">
    <div v-if="!aRevoir.length" class="vide">
      <Etincelles :taille="34" couleur="var(--menthe)" />
      <h2>Aucun désaccord</h2>
      <button class="btn" @click="g.allerA('swipe')">Aller trier</button>
    </div>

    <template v-else>
      <button v-if="!paye" class="btn btn-0 mini" style="align-self:flex-start"
              @click="g.ouvrirDebloquer()">
        Savoir ce qui vous sépare sur chacun
      </button>

      <section v-for="gr in groupes" :key="gr.cle" class="groupe-revoir"
               :class="{ replie: replies.has(gr.cle) }" :aria-labelledby="`revoir-${gr.cle}`">
        <h3 class="titre-groupe">
          <button :id="`revoir-${gr.cle}`" type="button" class="bascule"
                  :aria-expanded="!replies.has(gr.cle)" :aria-controls="`liste-revoir-${gr.cle}`"
                  @click="basculer(gr.cle, $event)">
            <span class="libelle">{{ gr.titre }}</span>
            <span class="puce">{{ gr.liste.length }}<span class="sr-only"> prénom{{ gr.liste.length > 1 ? 's' : '' }}</span></span>
            <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </h3>
        <Transition :css="false" @enter="deplier" @leave="replier">
        <div v-show="!replies.has(gr.cle)" :id="`liste-revoir-${gr.cle}`" class="liste-revoir">
        <article v-for="v in gr.liste" :key="v.prenom" class="carte desaccord">
          <div class="ligne" style="gap:10px">
            <button class="nom" @click="g.ouvrirFiche(v.prenom)">{{ v.prenom }}</button>
            <BoutonsVerdict :valeur="v.mien" :nom="v.prenom" :occupe="occupe === v.prenom"
                            @choisir="changer(v.prenom, $event, v.autres)" />
          </div>
          <p v-if="pourquoi.has(v.prenom)" class="pourquoi">{{ pourquoi.get(v.prenom)!.texte }}</p>
          <div class="ligne avis">
            <span class="puce" :class="`a${v.mien}`">Vous · {{ MOT[v.mien ?? 1] }}</span>
            <span v-for="a in v.autres" :key="a.pseudo" class="puce"
                  :class="[`a${a.valeur}`, { obs: a.observateur }]">
              {{ a.pseudo }} · {{ MOT[a.valeur] }}<template v-if="a.observateur"> · avis</template>
            </span>
          </div>
        </article>
        </div>
        </Transition>
      </section>
    </template>

    <EffetMatch v-if="match" :prenom="match.prenom" :avec="match.avec" :revoir="false"
                @fermer="match = null" />
  </div>
</template>

<style scoped>
/* Des dizaines de désaccords : ceux qui sont hors de l'écran ne sont ni
   stylés, ni mis en page, ni peints tant qu'on n'y arrive pas. */
.desaccord { padding: 13px 15px; display: flex; flex-direction: column; gap: 9px;
  content-visibility: auto; contain-intrinsic-size: auto 118px; }
.groupe-revoir { display: flex; flex-direction: column; }
.groupe-revoir + .groupe-revoir { margin-top: 10px; }
/* Replié depuis le bas de son groupe, l'écran remonte à lui : sous la zone
   système, pas dessous. */
.groupe-revoir { scroll-margin-top: env(safe-area-inset-top, 0px); }
.liste-revoir { display: flex; flex-direction: column; gap: 9px; padding-top: 9px; }

/* L'en-tête d'un volet : il reste collé en haut tant qu'on est dans son
   groupe (sticky borné par la section), opaque pour que les cartes passent
   dessous proprement. `top: 0` le pose sous la marge haute de la page
   (VueGroupe : 18 px, ou la zone système si elle est plus haute) — il
   flotte, comme une pastille, au lieu de se coller au bord de l'écran. */
.titre-groupe { position: sticky; top: 0; z-index: 2; margin: 4px 0 0; }
.bascule { width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 10px 10px 14px;
  border: 1px solid var(--trait); border-radius: 15px; background: var(--carte);
  box-shadow: 0 1px 2px rgba(26,35,78,.06), 0 8px 20px -12px rgba(26,35,78,.28);
  font: inherit; font-size: .98rem; font-weight: 750;
  letter-spacing: -.01em; color: var(--texte); text-align: left; cursor: pointer;
  transition: background .15s; }
.bascule:active { background: var(--fond); }
@media (hover: hover) { .bascule:hover { background: color-mix(in srgb, var(--fond) 60%, var(--carte)); } }
.bascule .libelle { flex: 1; min-width: 0; }
.bascule .puce { font-size: .7rem; flex: none; }
.chevron { width: 20px; height: 20px; flex: none; fill: none; stroke: var(--doux); stroke-width: 2.2;
  stroke-linecap: round; stroke-linejoin: round; transition: transform .2s ease; }
.replie .chevron { transform: rotate(-90deg); }
@media (prefers-reduced-motion: reduce) { .chevron { transition: none; } }
.nom { flex: 1; min-width: 0; text-align: left; border: 0; background: none; font: inherit;
  font-size: 1.15rem; font-weight: 700; letter-spacing: -.02em; color: var(--texte);
  cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pourquoi { margin: 0; font-size: .86rem; line-height: 1.4; padding-left: 10px;
  border-left: 2px solid var(--peche); color: var(--texte); }
.avis { flex-wrap: wrap; gap: 6px; }
.avis .puce { font-size: .7rem; }
.avis .a0 { background: color-mix(in srgb, var(--non) 22%, transparent); }
/* Un observateur ne bloque rien : sa pastille ne doit pas avoir l'air d'un veto. */
.avis .obs { background: none; border: 1px dashed var(--trait); opacity: .75; }
.avis .a2 { background: color-mix(in srgb, var(--oui) 22%, transparent); }
</style>
