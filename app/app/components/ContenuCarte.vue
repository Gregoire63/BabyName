<script setup lang="ts">
import { anneesBarres, bebesParAn, frequenceLisible, pourcentAn, tendanceFiable, type Prenom } from '~/composables/useCatalogue'
import { useGroupeCourant } from '~/composables/etatGroupe'
import { tester } from '~/composables/useNomComplet'

/**
 * Le contenu d'une carte de tri.
 *
 * Extrait pour etre rendu DEUX fois : la carte de devant, et celle qu'on
 * apercoit derriere. La carte du fond montre exactement la meme chose ; il
 * n'y a qu'un seul gabarit a tenir a jour.
 *
 * `interactif: false` pose `inert` : la carte du fond garde ses boutons pour
 * ne pas changer de hauteur, mais ni le doigt ni le clavier ne les atteignent.
 *
 * La carte occupe toute sa hauteur : c'est la courbe qui prend la place
 * restante. Calee en bas a hauteur fixe, elle laissait un grand vide au
 * milieu des grands ecrans.
 */
const props = withDefaults(defineProps<{
  p: Prenom
  interactif?: boolean
  /** Ce que « Non aux Loui… » balaierait : null quand il n'y a rien de plus
   *  que ce prenom et ses graphies (un simple non suffit). */
  famille?: { prefixe: string; n: number } | null
  /** Ce qu'on en avait dit, quand la recherche l'a ramene pour le rejuger. */
  dejaDit?: number | null
}>(), { interactif: true, famille: null, dejaDit: null })
const emit = defineEmits<{ fiche: []; favori: []; famille: []; veto: []; graphies: [] }>()
const g = useGroupeCourant()

// Un observateur juge, il ne bloque pas : les boutons qui bloquent ou
// ecartent n'existent pas pour lui. Le serveur le refuse aussi.
const peutBloquer = computed(() => g.etat.value?.moi?.role !== 'observateur')

const pic = computed(() => {
  const s = props.p.sr
  if (!s?.length) return null
  return 1986 + s.indexOf(Math.max(...s))
})
// Couleur de la tendance : un prenom qui monte vite va devenir courant (rouge),
// un prenom qui baisse le sera moins (vert). C'est l'inverse d'une bourse.
const tendance = computed(() => props.p.t > 8 ? 'monte' : props.p.t < -5 ? 'baisse' : '')
// Sous une vingtaine de bebes par an, la pente n'est que l'arrondi de l'INSEE :
// la tuile donne alors le nombre de bebes, et les barres les montrent.
const fiable = computed(() => tendanceFiable(props.p))
const barres = anneesBarres()

const DIT = ['Vous aviez dit non', 'Vous aviez dit neutre', 'Vous aviez dit oui'] as const

/**
 * « Ça donne quoi avec notre nom ? », sur chaque carte.
 *
 * Le nom se saisit une fois dans les reglages de la liste ; la reponse vient
 * ici, prenom par prenom, au moment ou l'on juge — c'est la qu'elle sert. Liste
 * debloquee seulement (le serveur refuse le nom sinon).
 */
const nomFamille = computed(() => {
  const gr = g.etat.value?.groupe as any
  return gr?.paye && typeof gr?.nom_famille === 'string' ? gr.nom_famille.trim() : ''
})
const essai = computed(() => nomFamille.value ? tester(props.p.l, nomFamille.value) : null)
const niveau = computed(() => !essai.value ? ''
  : essai.value.accroche ? 'accroche'
  : essai.value.remarques.some(r => r.gravite === 'attention') ? 'attention' : 'bien')
</script>

<template>
  <div class="contenu" :inert="!props.interactif ? true : undefined">
    <div class="ligne" style="justify-content:space-between">
      <span class="ligne" style="gap:6px;min-width:0">
        <span class="puce">
          {{ p.sexe === 'fm' ? 'mixte' : p.sexe === 'f' ? 'fille' : 'garçon' }}
        </span>
        <span v-if="dejaDit !== null" class="puce deja" :class="`d${dejaDit}`">{{ DIT[dejaDit] }}</span>
      </span>
      <button type="button" class="etoile" :class="{ on: g.favoris.value.has(p.l) }"
              :aria-pressed="g.favoris.value.has(p.l)" @click.stop="emit('favori')">
        <Etincelles :taille="20" aria-hidden="true" />
        <span>{{ g.favoris.value.has(p.l) ? 'Dans les favoris' : 'Favoris' }}</span>
      </button>
    </div>

    <!-- Le milieu se tasse, la barre du bas jamais : sur un petit ecran, c'est
         la courbe qui cede la place, pas les boutons (ils debordaient sur
         ceux du vote). -->
    <div class="milieu">
    <div class="identite">
      <h2 class="nom">{{ p.l }}</h2>
      <!-- Les graphies qui se disent pareil tiennent sur une carte : les juger
           une par une, c'est cinq swipes pour une seule decision. Une ligne
           courte les nomme ; la toucher (ou « Voir plus ») ouvre leurs
           chiffres, une graphie par onglet — et dit que le vote les emporte
           toutes. -->
      <button v-if="p.variantes?.length" type="button" class="graphies"
              :aria-label="`Aussi écrit ${p.variantes.join(', ')} : voir les chiffres de chaque graphie`"
              @click.stop="emit('graphies')">
        <span class="lesquelles">aussi écrit {{ p.variantes.slice(0, 3).join(', ')
          }}<template v-if="p.variantes.length > 3"> +{{ p.variantes.length - 3 }}</template></span>
        <span class="voir">Voir plus</span>
      </button>
      <p v-if="p.m" class="sens">« {{ p.m }} »<span v-if="p.cf !== null && p.cf < 2" class="doute"> · sens probable</span></p>
      <p v-else-if="p.me" class="sens doux">« {{ p.me }} »</p>
    </div>

    <div v-if="essai" class="essai-nom" :class="niveau">
      <p class="complet"><strong>{{ p.l }} {{ nomFamille }}</strong><span>{{ essai.initiales }}</span></p>
      <p class="remarques">{{ essai.remarques.map(r => r.court).join(' · ') }}</p>
    </div>

    <div v-if="p.g.length" class="ligne" style="flex-wrap:wrap;gap:6px">
      <span v-for="o in p.g" :key="o" class="puce">{{ o }}</span>
    </div>

    <!-- Deux chiffres, chacun avec ce qu'il mesure : « 1 sur 194 » seul ne
         disait pas de quoi. Pas les syllabes : chacun les compte en lisant
         le prénom, et une machine qui compte de travers (Léandre) agace plus
         qu'elle n'aide. -->
    <dl class="resume">
      <div><dt>des naissances</dt><dd>{{ frequenceLisible(p.f) }}</dd></div>
      <div v-if="fiable"><dt>par an</dt><dd :class="tendance">{{ pourcentAn(p.t) }}</dd></div>
      <div v-else><dt>bébé{{ bebesParAn(p) > 1 ? 's' : '' }} par an</dt><dd>≈ {{ bebesParAn(p) }}</dd></div>
    </dl>

    <p v-if="p.r > 30" class="alerte">
      Rare et en forte hausse : il peut être partout dans cinq ans.
    </p>
    <p v-else-if="p.rv" class="alerte">
      Prénom d’avant 1970 qui remonte.
    </p>
    <p v-else-if="p.ob" class="alerte">
      Aussi : {{ p.obn || 'un nom commun' }}.
    </p>

    <div v-if="p.sr" class="graphe">
      <p class="graphe-tete" aria-hidden="true">
        <span>Naissances depuis 1986</span>
        <span v-if="pic">au plus haut en {{ pic }}</span>
      </p>
      <div class="graphe-corps"><CourbePrenom :serie="p.sr" remplir /></div>
      <p class="graphe-axe" aria-hidden="true"><span>1986</span><span>2025</span></p>
    </div>
    <div v-else-if="p.nb" class="graphe">
      <p class="graphe-tete" aria-hidden="true"><span>Naissances par an</span></p>
      <div class="graphe-corps"><BarresPrenom :valeurs="p.nb" :an0="barres[0]" remplir /></div>
    </div>
    </div>

    <!-- Trois gestes, dessinés ET nommés : « Veto » et « Écarter la famille »
         ne se comprenaient pas sans explication. Toucher la carte ouvre aussi
         la fiche (voir SectionTrier) ; le bouton reste pour le clavier et pour
         qui ne le devine pas. -->
    <div class="bas">
      <button type="button" class="btn outil" :aria-label="`Infos sur ${p.l}`"
              @click.stop="emit('fiche')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.4" /><circle cx="12" cy="7.7" r=".5" />
        </svg>
        <span>Infos</span>
      </button>
      <!-- Sa place est toujours tenue, meme vide : « Veto » reste au meme
           endroit d'une carte a l'autre, le pouce n'a pas a le chercher. -->
      <button v-if="peutBloquer" type="button" class="btn outil" :class="{ vide: !famille }"
              :aria-label="famille ? `Non aux ${famille.prefixe}… : ${famille.n} prénoms qui commencent par ${famille.prefixe}` : undefined"
              :tabindex="famille ? undefined : -1"
              @click.stop="famille && emit('famille')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="7.5" y="3.5" width="12" height="15" rx="2.5" />
          <path d="M4.5 7.5v10a3 3 0 0 0 3 3h8" /><path d="m11 8.5 5 5M16 8.5l-5 5" />
        </svg>
        <span class="deborde">Non aux {{ famille?.prefixe }}…</span>
      </button>
      <button v-if="peutBloquer" type="button" class="btn outil rouge"
              :aria-label="`Veto sur ${p.l}`" @click.stop="emit('veto')">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.6" /><path d="m6 6 12 12" />
        </svg>
        <span>Veto</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* La carte est la boite ; ce composant en est le contenu et doit en occuper
   toute la hauteur, sinon la courbe ne peut pas prendre la place restante. */
.contenu { display: flex; flex-direction: column; gap: 11px; flex: 1; min-height: 0; }
.milieu { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 11px; }

.identite { display: flex; flex-direction: column; gap: 6px; }
.nom { font-size: clamp(2.4rem, 10.5vw, 3.1rem); letter-spacing: -.035em; margin: 2px 0 0;
  line-height: 1.02; overflow-wrap: anywhere; }
.sens { margin: 0; font-size: 1.05rem; font-style: italic; }
.graphies { margin: -2px 0 0; padding: 2px 0; border: 0; background: none; font: inherit;
  font-size: .78rem; color: var(--texte); line-height: 1.35; text-align: left; cursor: pointer;
  display: flex; align-items: baseline; gap: 8px; min-width: 0; align-self: stretch; }
.graphies .lesquelles { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.graphies .voir { flex: none; font-weight: 800; text-decoration: underline;
  text-underline-offset: 3px; text-decoration-thickness: 1px; }
/* Une etymologie discutee ne doit pas se lire comme un fait. */
.doute { font-style: normal; font-size: .74rem; color: var(--doux); }

.resume { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.resume > div { background: var(--fond); border: 1px solid var(--trait); border-radius: 13px;
  padding: 7px 9px; display: flex; flex-direction: column-reverse; gap: 1px; min-width: 0; }
.resume dt { font-size: .68rem; color: var(--doux); font-weight: 600; }
.resume dd { margin: 0; font-size: clamp(.86rem, 3.9vw, 1.02rem); font-weight: 750;
  font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.resume dd.monte { color: var(--non); }
.resume dd.baisse { color: var(--oui); }

.deja { font-size: .68rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.deja.d0 { background: color-mix(in srgb, var(--non) 22%, transparent); }
.deja.d2 { background: color-mix(in srgb, var(--oui) 22%, transparent); }

/* Le nom complet et ce qui s'entend : vert si ca coule, peche si ca merite
   attention, rouge si ca accroche. */
.essai-nom { border-radius: 13px; padding: 8px 11px; display: flex; flex-direction: column; gap: 1px;
  border: 1px solid var(--trait); background: var(--fond); }
.essai-nom p { margin: 0; }
.essai-nom .complet { display: flex; justify-content: space-between; gap: 8px; font-size: .92rem; }
.essai-nom .complet strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.essai-nom .complet span { font-size: .74rem; color: var(--doux); font-weight: 700; flex: none; }
.essai-nom .remarques { font-size: .78rem; line-height: 1.35; }
.essai-nom.bien { border-color: color-mix(in srgb, var(--oui) 40%, var(--trait)); }
.essai-nom.bien .remarques { color: var(--oui); }
.essai-nom.attention { background: color-mix(in srgb, var(--peche) 30%, var(--fond)); }
.essai-nom.accroche { border-color: color-mix(in srgb, var(--non) 50%, var(--trait));
  background: color-mix(in srgb, var(--non) 10%, var(--fond)); }
.essai-nom.accroche .remarques { color: var(--non); font-weight: 650; }

.alerte { margin: 0; font-size: .84rem; padding: 9px 11px; border-radius: 11px;
  background: color-mix(in srgb, var(--peche) 45%, transparent); }

/* La courbe prend toute la place qui reste ; faute de place, c'est elle qui
   cede (jusqu'a disparaitre), pas le reste de la carte. */
.graphe { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 4px; }
.graphe-tete, .graphe-axe { margin: 0; display: flex; justify-content: space-between;
  font-size: .68rem; color: var(--doux); font-weight: 600; }
.graphe-corps { flex: 1; min-height: 30px; position: relative; }
.graphe-corps :deep(svg) { position: absolute; inset: 0; }

.bas { flex: none; display: flex; justify-content: space-around; align-items: stretch; gap: 6px;
  padding-top: 2px; border-top: 1px solid var(--trait); }
.outil { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px;
  background: none; border: 0; padding: 8px 4px 2px; font-size: .74rem; font-weight: 700;
  color: var(--texte); border-radius: 12px; }
.outil svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2;
  stroke-linecap: round; stroke-linejoin: round; }
.outil:active { background: var(--fond); }
.outil .deborde { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rouge { color: var(--non); }
.outil.vide { visibility: hidden; }

/* Ecran court : on resserre, et la courbe perd sa legende avant de perdre
   sa place. */
@media (max-height: 700px) {
  .contenu, .milieu { gap: 8px; }
  .nom { font-size: 2.15rem; }
  .graphe-tete { display: none; }
  .outil { padding-top: 5px; }
}

/* police heritee : le bouton est un <button>, il ne la prend pas tout seul */
.etoile { font: inherit; }
.etoile { border: 1px solid var(--trait); background: var(--carte); cursor: pointer;
  padding: 6px 13px 6px 10px; border-radius: var(--pastille); display: flex;
  align-items: center; gap: 6px; font-size: .76rem; font-weight: 700;
  transition: transform .12s, background .15s, border-color .15s; }
.etoile span { line-height: 1; }
.etoile.on { color: var(--encre); border-color: transparent;
  background: color-mix(in srgb, var(--peche) 55%, transparent); }
.etoile:not(.on) { color: var(--doux); }
.etoile:active { transform: scale(.88); }
</style>
