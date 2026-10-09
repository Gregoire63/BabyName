<script setup lang="ts">
import { anneesBarres, bebesParAn, frequenceLisible, meilleurAilleurs, pourcentAn, tendanceFiable, type Prenom } from '~/composables/useCatalogue'
import { useGroupeSiPresent } from '~/composables/etatGroupe'
import { projeter, ecart, CLASSE } from '~/composables/useProjectionClasse'
import { memeEcriture } from '~/utils/tempetes'
import { meilleurPays } from '~/composables/usePays'
const props = defineProps<{ p: Prenom }>()
const emit = defineEmits<{ fermer: [] }>()
const g = useGroupeSiPresent()

/**
 * Elle monte et elle redescend. La fermeture coupait net : le parent retirait
 * la fiche des qu'on touchait la croix. Comme Feuille, elle garde donc la
 * main — elle joue sa sortie, puis previent le parent.
 */
const visible = ref(false)
onMounted(() => requestAnimationFrame(() => { visible.value = true }))
function fermer() { visible.value = false }

const dedans = ref<HTMLElement>()
const f = useFeuille(fermer, dedans)
const boite = ref<HTMLElement>()
const idNom = useId()
useDialogue(boite, fermer)

const AN0 = 1986, AN1 = 2025

/** Sommet de la fenetre 1986-2025 (a ne pas confondre avec le pic historique). */
const sommet = computed(() => {
  const s = props.p.sr
  if (!s || s.length < 4) return null
  const max = Math.max(...s)
  if (max <= 0) return null
  return { an: AN0 + s.indexOf(max), v: max }
})

/**
 * « Combien dans sa classe ? »
 *
 * Gratuit : le calcul brut, une graphie au taux d'aujourd'hui — ce que
 * n'importe quel palmares donne deja. Debloque : tout le groupe de
 * prononciation, projete a l'annee de naissance. On montre le brut aux deux :
 * un chiffre cache ne convainc personne, et c'est l'ECART qui se vend.
 */
// Hors liste (depuis l'accueil), il n'y a rien a debloquer : version brute,
// sans bouton, plutot qu'une offre qui ne saurait pas quoi debloquer.
const dansListe = computed(() => !!g)
const paye = computed(() => !!(g?.etat.value?.groupe as any)?.paye)
// Là où rien ne se vend (useVente) : l'écart se dit, le bouton qui mène à
// l'offre n'y est pas.
const vente = useVente()
const classe = computed(() => projeter(props.p, paye.value))
const manque = computed(() => paye.value ? null : ecart(props.p))

const sexeTexte = computed(() =>
  props.p.sexe === 'fm' ? 'mixte' : props.p.sexe === 'f' ? 'fille' : 'garçon')

const fiable = computed(() => tendanceFiable(props.p))
const barres = anneesBarres()

/**
 * Les tempêtes de ce prénom (utils/tempetes), tout en haut, sans avoir à
 * défiler : le même détail que la feuille de l'icône de la carte. « Se dit
 * comme » quand l'orthographe diffère (Eléanore, la tempête Eleanor).
 */
const tempetes = computed(() => props.p.tp ?? [])
const commeTempete = computed(() => tempetes.value.length > 0
  && !tempetes.value.some(t => memeEcriture(props.p.l, t)))
const idTempetes = useId()

/** Une phrase, pas un tableau : ce que le chiffre veut dire concretement. */
const lecture = computed(() => {
  const p = props.p
  // Donné ailleurs, pas ici : c'est la nouvelle, pas un défaut.
  if (p.hf) {
    const m = meilleurPays(p)
    const a = m ? null : meilleurAilleurs(p)
    return `Aucun bébé ne l’a reçu en France de 2023 à 2025 (INSEE)`
      + (m ? ` ; ${m.en}, ${m.sur} le porte.`
        : a ? ` ; ${a.source.id === 'qc' ? 'au' : 'en'} ${a.pays}, ${a.sur} le porte.` : '.')
  }
  const base = `${frequenceLisible(p.f)} le reçoit aujourd’hui.`
  // Quelques bebes par an : on le dit, sans pente qui ne serait que du bruit.
  if (!fiable.value) {
    const n = bebesParAn(p)
    return `${frequenceLisible(p.f)} le reçoit aujourd’hui : environ ${n} bébé${n > 1 ? 's' : ''} par an, `
      + 'trop peu pour chiffrer une tendance.'
  }
  if (p.t > 15) return `${base} Il grimpe vite (${pourcentAn(p.t)}/an).`
  if (p.t > 5) return `${base} Il monte doucement.`
  if (p.t < -10) return `${base} Il recule nettement (${pourcentAn(p.t)}/an).`
  if (p.t < -3) return `${base} Il s’efface lentement.`
  return `${base} Sa cote est stable.`
})
</script>

<template>
  <Transition name="fiche" @after-leave="emit('fermer')">
  <div v-if="visible" class="voile" @click.self="fermer">
    <div ref="boite" class="feuille" :style="f.style.value"
         role="dialog" aria-modal="true" :aria-labelledby="idNom" tabindex="-1"
         @pointerdown="f.debut" @pointermove="f.bouge"
         @pointerup="f.fin" @pointercancel="f.fin">
      <div class="poignee" />
      <div ref="dedans" class="dedans">
        <header class="tete">
          <div>
            <h2 :id="idNom" class="nom">{{ p.l }}</h2>
            <p class="mini doux" style="margin:4px 0 0">
              {{ sexeTexte }}<template v-if="p.hf"> · <span class="ailleurs">prénom d’ailleurs</span></template>
            </p>
          </div>
          <button type="button" class="btn btn-0 rond" aria-label="Fermer la fiche" @click="fermer">
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <p v-if="p.m" class="sens">« {{ p.m }} »</p>
        <p v-if="p.m && p.cf !== null && p.cf < 2" class="note doux">
          {{ p.cf === 0 ? 'Étymologie douteuse ou débattue : à prendre comme une piste, pas comme un fait.'
                        : 'Étymologie probable : les sources ne sont pas unanimes.' }}
        </p>
        <p v-else-if="p.me" class="sens doux">« {{ p.me }} » <span class="mini">(source anglaise)</span></p>

        <div v-if="p.g.length" class="ligne" style="flex-wrap:wrap;gap:6px">
          <span v-for="o in p.g" :key="o" class="puce">{{ o }}</span>
        </div>

        <section v-if="tempetes.length" class="tempetes" :aria-labelledby="idTempetes">
          <h3 :id="idTempetes">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7.5 17H7a4 4 0 0 1-.9-7.9 5.6 5.6 0 0 1 10.8-1.4A4.2 4.2 0 0 1 17.6 17h-1.1" />
              <path d="m12.6 11.6-2.6 4.6h3.6L11 20.8" />
            </svg>
            {{ commeTempete ? 'Se dit comme une tempête' : tempetes.length > 1 ? 'Nom de tempêtes' : 'Nom de tempête' }}
          </h3>
          <DetailTempete v-for="t in tempetes" :key="`${t.nom}-${t.an}`" :t="t" :prenom="p.l" />
        </section>

        <section v-if="sommet" class="bloc">
          <h3>Depuis {{ AN0 }}</h3>
          <CourbePrenom :serie="p.sr" :hauteur="88" pic />
          <div class="ligne mini doux" style="justify-content:space-between">
            <span>{{ AN0 }}</span>
            <span>Sommet {{ sommet.an }} · {{ frequenceLisible(sommet.v) }}</span>
            <span>{{ AN1 }}</span>
          </div>
        </section>
        <section v-else-if="p.nb" class="bloc">
          <h3>Naissances par an</h3>
          <BarresPrenom :valeurs="p.nb" :an0="barres[0]" :hauteur="110" />
        </section>

        <p class="lecture">{{ lecture }}</p>

        <section v-if="classe" class="classe" :class="{ vendu: paye }">
          <h3>Dans une classe de {{ CLASSE }}</h3>
          <p class="verdict">{{ classe.phrase }}</p>

          <template v-if="paye">
            <p class="mini doux" style="margin:0">
              L’année de sa naissance<template v-if="p.ngp > 1">, toutes graphies confondues</template>.
            </p>
          </template>

          <template v-else-if="manque">
            <p class="mini" style="margin:0">
              Ce chiffre ne compte qu'une graphie, l'année dernière : pour ce
              prénom il tombe à côté :
              <template v-if="manque.evolution">{{ manque.evolution }}</template>
              <template v-if="manque.evolution && manque.graphies"> et </template>
              <template v-if="manque.graphies">{{ manque.graphies }}</template>.
            </p>
            <button v-if="dansListe && vente.ouverte" class="btn btn-1 mini" @click="g!.ouvrirDebloquer()">
              Voir le vrai chiffre
            </button>
          </template>
          <p v-else class="mini doux" style="margin:0">
            Ni la mode ni l'orthographe ne changent la réponse pour celui-ci.
          </p>
        </section>

        <dl v-if="!p.hf" class="chiffres">
          <div><dt>Fréquence</dt><dd>{{ frequenceLisible(p.f) }}</dd></div>
          <div v-if="fiable"><dt>Tendance</dt>
            <dd :style="{ color: p.t > 8 ? 'var(--non)' : p.t < -5 ? 'var(--oui)' : 'inherit' }">
              {{ pourcentAn(p.t) }}/an</dd></div>
          <div v-else><dt>Tendance</dt><dd class="doux">trop peu de bébés</dd></div>
          <div><dt>Originalité</dt><dd>{{ p.o.toFixed(0) }}/100</dd></div>
          <div><dt>Pic historique</dt><dd>{{ p.p || 'inconnu' }}<span v-if="p.p && p.p < 1986" class="mini doux"> (avant 1986)</span></dd></div>
          <div><dt>Naissances 3 ans</dt><dd>{{ p.n.toLocaleString('fr-FR') }}</dd></div>
          <div><dt>Risque d’explosion</dt>
            <dd :style="{ color: p.r > 40 ? 'var(--non)' : 'inherit' }">{{ p.r.toFixed(0) }}/100</dd></div>
        </dl>

        <DansLeMonde :p="p" />

        <p v-if="p.u > 0.12 && p.u < 0.88" class="note">
          Porté par les deux sexes ({{ (p.u * 100).toFixed(0) }} % de filles).
        </p>
        <p v-if="p.rv" class="note">
          Prénom d’avant 1970 qui remonte : il sonnera « ancien » à vos parents, neuf à ses camarades.
        </p>
        <p v-if="p.r > 30" class="note alerte">
          Il grimpe et reste rare : il peut être partout dans cinq ans.
        </p>
        <p v-if="p.ob" class="note alerte">
          Homonyme repéré : {{ p.obn || 'un nom commun ou une marque' }}.
        </p>
        <p v-if="p.dm?.length" class="note">
          Diminutifs probables : {{ p.dm.join(', ') }}.
        </p>
        <p v-if="!p.m && !p.me" class="note doux">
          Aucune étymologie fiable trouvée pour ce prénom.
        </p>
      </div>
    </div>
  </div>
  </Transition>
</template>

<style scoped>
.feuille:focus { outline: none; }
.voile { position: fixed; inset: 0; z-index: 60; background-color: rgba(26,35,78,.42);
  backdrop-filter: blur(3px); display: flex; align-items: flex-end; justify-content: center; }
.feuille { width: 100%; max-width: 560px; max-height: 92%; background: var(--carte);
  border-radius: 22px 22px 0 0; display: flex; flex-direction: column; }
/* Memes regles que Feuille : le voile ne fond que sa couleur (la fiche est
   dedans), et il dure au moins autant que la descente. */
.fiche-enter-active { transition: background-color .3s ease, backdrop-filter .3s ease; }
.fiche-leave-active { transition: background-color .28s ease, backdrop-filter .28s ease; }
.fiche-enter-from, .fiche-leave-to { background-color: transparent; backdrop-filter: blur(0); }
.fiche-enter-active .feuille { transition: transform .3s cubic-bezier(.2,.86,.3,1); }
.fiche-leave-active .feuille { transition: transform .26s cubic-bezier(.5,0,.9,.55); }
.fiche-enter-from .feuille, .fiche-leave-to .feuille { transform: translateY(100%); }
@media (prefers-reduced-motion: reduce) {
  .fiche-enter-active, .fiche-leave-active,
  .fiche-enter-active .feuille, .fiche-leave-active .feuille { transition-duration: .01ms; }
}
.feuille { touch-action: none; }
.poignee { width: 42px; height: 5px; border-radius: 999px; background: var(--trait);
  margin: 10px auto 2px; flex: none; }
.dedans { touch-action: pan-y; }
.dedans { overflow-y: auto; overscroll-behavior: contain; padding: 10px 20px 28px;
  display: flex; flex-direction: column; gap: 14px; }
.tete { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.nom { font-size: 2rem; letter-spacing: -.03em; }
.rond { width: 34px; height: 34px; border-radius: 50%; padding: 0; flex: none;
  background: var(--fond); color: var(--doux); }
.sens { margin: 0; font-size: 1.05rem; font-style: italic; }
.bloc { display: flex; flex-direction: column; gap: 6px; }
.bloc h3 { color: var(--doux); text-transform: uppercase; font-size: .7rem; letter-spacing: .06em; }
.lecture { margin: 0; padding: 12px 14px; border-radius: 13px; background: var(--fond);
  border: 1px solid var(--trait); font-size: .92rem; }
/* Encre, comme l'icône de la carte. Le détail de chaque tempête est celui de
   la feuille de l'icône (DetailTempete). */
.tempetes { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px;
  border-radius: 13px; border: 1px solid var(--trait);
  background: color-mix(in srgb, var(--encre) 6%, var(--carte)); }
.tempetes h3 { display: flex; align-items: center; gap: 6px; color: var(--doux);
  text-transform: uppercase; font-size: .7rem; letter-spacing: .06em; }
.tempetes h3 svg { width: 17px; height: 17px; flex: none; fill: none; stroke: var(--encre);
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.tempetes > .tempete + .tempete { padding-top: 10px; border-top: 1px solid var(--trait); }
.classe { display: flex; flex-direction: column; gap: 8px; align-items: flex-start;
  padding: 14px; border-radius: 15px; border: 1px solid var(--trait);
  background: color-mix(in srgb, var(--menthe) 22%, var(--carte)); }
.classe.vendu { background: color-mix(in srgb, var(--menthe) 34%, var(--carte)); }
.classe h3 { color: var(--doux); text-transform: uppercase; font-size: .7rem;
  letter-spacing: .06em; }
.classe .verdict { margin: 0; font-size: 1.05rem; font-weight: 620; line-height: 1.32; }
.classe .btn { align-self: stretch; }
.chiffres { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; margin: 0; }
.chiffres dt { font-size: .7rem; color: var(--doux); text-transform: uppercase; letter-spacing: .04em; }
.chiffres dd { margin: 2px 0 0; font-weight: 640; font-variant-numeric: tabular-nums; }
.note { margin: 0; font-size: .86rem; color: var(--doux); }
.ailleurs { color: var(--encre); font-weight: 650; padding: 1px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--menthe) 45%, var(--carte)); }
.note.alerte { color: var(--texte); background: color-mix(in srgb, var(--peche) 40%, transparent);
  padding: 10px 12px; border-radius: 11px; }
</style>
