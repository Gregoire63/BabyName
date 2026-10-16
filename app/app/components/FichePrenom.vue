<script setup lang="ts">
import { sensDe, citer } from '~/composables/useSens'
import { anneesBarres, bebesParAn, frequenceLisible, meilleurAilleurs, pourcentAn, tendanceFiable, type Prenom } from '~/composables/useCatalogue'
import { useGroupeSiPresent } from '~/composables/etatGroupe'
import { projeter, ecart, CLASSE } from '~/composables/useProjectionClasse'
import { memeEcriture } from '~/utils/tempetes'
import { meilleurPays } from '~/composables/usePays'
import { t, langue, nombre, locale } from '~/composables/useLangue'
import { nomPays } from '~/utils/nomPays'
import { donneesAjout, anneesDe } from '~/composables/useAjouts'
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

const sexeTexte = computed(() => t(`Sexe.${props.p.sexe}`))
/** Un sens, dans la langue de l'app (useSens, `sensDe`) : jamais deux, jamais l'anglais en français. */
const leSens = computed(() => sensDe(props.p))

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

/**
 * LA FICHE D'UN PRÉNOM AJOUTÉ PAR LA LISTE (useAjouts) : qui l'a ajouté et
 * quand, son mot, puis ce qu'on en sait vraiment — son historique à l'INSEE,
 * le prénom qui se dit pareil (avec SA courbe, sous SON nom), ceux qui
 * s'écrivent presque pareil. Ni classe, ni tendance, ni originalité : ce
 * seraient les zéros d'un prénom que le catalogue n'a pas.
 *
 * Son auteur peut le retirer tant que personne d'autre ne l'a jugé
 * (ajouts.delete.ts) : une faute de frappe se rattrape ; une proposition que
 * la liste a déjà jugée lui appartient.
 */
const ajout = computed(() => props.p.ajout ?? null)
const donnees = computed(() => ajout.value && g ? donneesAjout(props.p, g.catalogue.value) : undefined)
const hist = computed(() => {
  const h = donnees.value?.hist
  return h && h !== 'absent' ? h : null
})
const jumeau = computed(() => donnees.value?.jumeau ?? null)
/** Comme sur la carte : la fréquence s'il est assez donné, sinon les bébés par an. */
const combienDe = (x: Prenom) => tendanceFiable(x) ? frequenceLisible(x.f)
  : t('FichePrenom.environBebesAn', { n: bebesParAn(x) })
const sousTitreAjout = computed(() => {
  const a = ajout.value
  if (!a) return ''
  const x = donnees.value?.sexe
  const sexe = x ? `${t(`Sexe.${x}`)} · ` : ''
  const qui = a.mien ? t('FichePrenom.ajouteParVous') : a.par ? t('FichePrenom.ajoutePar', { nom: a.par }) : t('FichePrenom.ajouteALaListe')
  const le = new Date(a.le)
  return `${sexe}${qui}${isNaN(+le) ? '' : t('FichePrenom.ajouteLe', { date: le.toLocaleDateString(locale.value, { day: 'numeric', month: 'long' }) })}`
})
const lectureHist = computed(() => {
  const h = hist.value
  if (!h) return ''
  return t('FichePrenom.lectureHist', { total: nombre(h.total), premiere: h.premiere, annees: anneesDe(h.pic), derniere: h.derniere })
})

const retrait = ref<'' | 'en-cours' | 'refuse' | 'echec'>('')
// « La fiche de Jérôme » remplace celle-ci dans la même feuille.
watch(() => props.p.l, () => { retrait.value = '' })
async function retirer() {
  if (!g || retrait.value === 'en-cours') return
  retrait.value = 'en-cours'
  try {
    await g.retirerAjout(props.p.l)
    retrait.value = ''
    fermer()
  } catch (err: any) {
    const code = err?.data?.statusMessage ?? err?.statusMessage
    retrait.value = code === 'deja_juge' ? 'refuse' : 'echec'
  }
}

/** Une phrase, pas un tableau : ce que le chiffre veut dire concretement. */
const lecture = computed(() => {
  const p = props.p
  // Donné ailleurs, pas ici : c'est la nouvelle, pas un défaut.
  if (p.hf) {
    const m = meilleurPays(p)
    const a = m ? null : meilleurAilleurs(p)
    // « en Belgique », « au Québec » : le français garde ses prépositions.
    const dans = (code: string, nom: string, fr: string) =>
      langue.value === 'fr' ? fr : t('Pays.dans', { pays: nomPays(code, nom), code })
    return t('FichePrenom.horsFrance', m ? { dans: dans(m.pays.code, m.pays.nom, m.en), sur: m.sur }
      : a ? { dans: dans(a.source.id, a.pays, `${a.source.id === 'qc' ? 'au' : 'en'} ${a.pays}`), sur: a.sur } : {})
  }
  const base = t('FichePrenom.base', { freq: frequenceLisible(p.f) })
  // Quelques bebes par an : on le dit, sans pente qui ne serait que du bruit.
  if (!fiable.value) {
    return t('FichePrenom.tropPeuTendance', { freq: frequenceLisible(p.f), n: bebesParAn(p) })
  }
  const pct = pourcentAn(p.t)
  if (p.t > 15) return t('FichePrenom.monteVite', { base, pct })
  if (p.t > 5) return t('FichePrenom.monte', { base })
  if (p.t < -10) return t('FichePrenom.recule', { base, pct })
  if (p.t < -3) return t('FichePrenom.sEfface', { base })
  return t('FichePrenom.stable', { base })
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
              <template v-if="ajout">{{ sousTitreAjout }}</template>
              <template v-else>{{ sexeTexte }}<template v-if="p.hf"> · <span class="ailleurs">{{ $t('FichePrenom.ailleurs') }}</span></template></template>
            </p>
          </div>
          <button type="button" class="btn btn-0 rond" :aria-label="$t('FichePrenom.fermer')" @click="fermer">
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <template v-if="ajout">
          <p v-if="ajout.mot" class="sens">{{ citer(ajout.mot) }}</p>
          <div v-if="donnees === undefined" class="bloc" aria-hidden="true">
            <Squelette l="100%" :h="110" :r="12" />
          </div>
          <template v-if="hist">
            <section class="bloc">
              <h3>{{ $t('FichePrenom.depuisParDecennie', { an: hist.premiere }) }}</h3>
              <BarresPrenom :valeurs="hist.parDecennie" :an0="hist.decennies[0]!" :pas="10" :hauteur="110" />
            </section>
            <p class="lecture">{{ lectureHist }}</p>
          </template>
          <p v-else-if="donnees?.hist === 'absent'" class="lecture">
            {{ $t('FichePrenom.aucuneNaissance') }}
          </p>
          <section v-if="jumeau" class="bloc">
            <h3>{{ $t('FichePrenom.seDitComme', { nom: jumeau.l }) }}</h3>
            <template v-if="jumeau.p">
              <CourbePrenom v-if="jumeau.p.sr" :serie="jumeau.p.sr" :hauteur="88" pic />
              <BarresPrenom v-else-if="jumeau.p.nb" :valeurs="jumeau.p.nb" :an0="barres[0]" :hauteur="110" />
              <p class="mini doux" style="margin:0">
                {{ $t('FichePrenom.jumeauAujourdhui', { nom: jumeau.l, freq: frequenceLisible(jumeau.p.f) }) }}
              </p>
              <button type="button" class="btn btn-0 mini" style="align-self:flex-start"
                      @click="g?.ouvrirFiche(jumeau.l)">
                {{ $t('FichePrenom.laFicheDe', { nom: jumeau.l }) }}
              </button>
            </template>
            <template v-else-if="jumeau.h">
              <BarresPrenom :valeurs="jumeau.h.parDecennie" :an0="jumeau.h.decennies[0]!" :pas="10" :hauteur="110" />
              <p class="mini doux" style="margin:0">
                {{ $t('FichePrenom.jumeauHist', { nom: jumeau.l, total: nombre(jumeau.h.total), premiere: jumeau.h.premiere, annees: anneesDe(jumeau.h.pic) }) }}
              </p>
            </template>
          </section>
          <section v-if="donnees?.proches.length" class="bloc">
            <h3>{{ $t('FichePrenom.prochesTitre') }}</h3>
            <ul class="proches">
              <li v-for="x in donnees.proches" :key="x.l">
                <button type="button" class="proche" :aria-label="$t('FichePrenom.prochesAria', { nom: x.l, combien: combienDe(x) })"
                        @click="g?.ouvrirFiche(x.l)">
                  <span class="qui">{{ x.l }}</span>
                  <span class="combien">{{ combienDe(x) }}</span>
                  <span class="allure" aria-hidden="true"><CourbePrenom v-if="x.sr" :serie="x.sr" :hauteur="24" /></span>
                </button>
              </li>
            </ul>
          </section>
          <p class="note doux">{{ $t('FichePrenom.sansEtymologie') }}</p>
          <div v-if="ajout.mien" class="pile retrait">
            <button type="button" class="btn btn-0 mini danger" style="align-self:flex-start"
                    :disabled="retrait === 'en-cours'" @click="retirer">
              {{ $t('FichePrenom.retirer') }}
            </button>
            <p v-if="retrait === 'refuse'" class="mini" role="alert" style="margin:0">
              {{ $t('FichePrenom.retraitRefuse') }}
            </p>
            <p v-else-if="retrait === 'echec'" class="mini" role="alert" style="color:var(--non);margin:0">
              {{ $t('FichePrenom.retraitEchec') }}
            </p>
          </div>
        </template>

        <template v-else>
        <p v-if="leSens" class="sens" :class="{ doux: leSens.anglais }">
          {{ citer(leSens.texte) }}
          <span v-if="leSens.anglais" class="mini">{{ $t('FichePrenom.sourceAnglaise') }}</span>
        </p>
        <p v-if="p.m && p.cf !== null && p.cf < 2" class="note doux">
          {{ p.cf === 0 ? $t('FichePrenom.douteuse') : $t('FichePrenom.probable') }}
        </p>

        <div v-if="p.g.length" class="ligne" style="flex-wrap:wrap;gap:6px">
          <span v-for="o in p.g" :key="o" class="puce">{{ $t(`Origines.${o}`) }}</span>
        </div>

        <section v-if="tempetes.length" class="tempetes" :aria-labelledby="idTempetes">
          <h3 :id="idTempetes">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7.5 17H7a4 4 0 0 1-.9-7.9 5.6 5.6 0 0 1 10.8-1.4A4.2 4.2 0 0 1 17.6 17h-1.1" />
              <path d="m12.6 11.6-2.6 4.6h3.6L11 20.8" />
            </svg>
            {{ commeTempete ? $t('FichePrenom.commeTempete') : tempetes.length > 1 ? $t('FichePrenom.nomTempetes') : $t('FichePrenom.nomTempete') }}
          </h3>
          <DetailTempete v-for="t in tempetes" :key="`${t.nom}-${t.an}`" :t="t" :prenom="p.l" />
        </section>

        <section v-if="sommet" class="bloc">
          <h3>{{ $t('FichePrenom.depuis', { an: AN0 }) }}</h3>
          <CourbePrenom :serie="p.sr" :hauteur="88" pic />
          <div class="ligne mini doux" style="justify-content:space-between">
            <span>{{ AN0 }}</span>
            <span>{{ $t('FichePrenom.sommet', { an: sommet.an, freq: frequenceLisible(sommet.v) }) }}</span>
            <span>{{ AN1 }}</span>
          </div>
        </section>
        <section v-else-if="p.nb" class="bloc">
          <h3>{{ $t('FichePrenom.naissancesParAn') }}</h3>
          <BarresPrenom :valeurs="p.nb" :an0="barres[0]" :hauteur="110" />
        </section>

        <p class="lecture">{{ lecture }}</p>

        <section v-if="classe" class="classe" :class="{ vendu: paye }">
          <h3>{{ $t('FichePrenom.dansClasse', { n: CLASSE }) }}</h3>
          <p class="verdict">{{ classe.phrase }}</p>

          <template v-if="paye">
            <p class="mini doux" style="margin:0">
              {{ $t('FichePrenom.anneeNaissance') }}<template v-if="p.ngp > 1">{{ $t('FichePrenom.toutesGraphies') }}</template>.
            </p>
          </template>

          <template v-else-if="manque">
            <p class="mini" style="margin:0">
              {{ $t('FichePrenom.uneGraphie') }}
              <template v-if="manque.evolution">{{ manque.evolution }}</template>
              <template v-if="manque.evolution && manque.graphies">{{ $t('FichePrenom.et') }}</template>
              <template v-if="manque.graphies">{{ manque.graphies }}</template>.
            </p>
            <button v-if="dansListe && vente.ouverte" class="btn btn-1 mini" @click="g!.ouvrirDebloquer()">
              {{ $t('FichePrenom.voirVrai') }}
            </button>
          </template>
          <p v-else class="mini doux" style="margin:0">
            {{ $t('FichePrenom.rienNeChange') }}
          </p>
        </section>

        <dl v-if="!p.hf" class="chiffres">
          <div><dt>{{ $t('FichePrenom.frequence') }}</dt><dd>{{ frequenceLisible(p.f) }}</dd></div>
          <div v-if="fiable"><dt>{{ $t('FichePrenom.tendance') }}</dt>
            <dd :style="{ color: p.t > 8 ? 'var(--non)' : p.t < -5 ? 'var(--oui)' : 'inherit' }">
              {{ $t('FichePrenom.parAn', { pct: pourcentAn(p.t) }) }}</dd></div>
          <div v-else><dt>{{ $t('FichePrenom.tendance') }}</dt><dd class="doux">{{ $t('FichePrenom.tropPeu') }}</dd></div>
          <div><dt>{{ $t('FichePrenom.originalite') }}</dt><dd>{{ p.o.toFixed(0) }}/100</dd></div>
          <div><dt>{{ $t('FichePrenom.pic') }}</dt><dd>{{ p.p || $t('FichePrenom.inconnu') }}<span v-if="p.p && p.p < 1986" class="mini doux">{{ $t('FichePrenom.avant1986') }}</span></dd></div>
          <div><dt>{{ $t('FichePrenom.naissances3') }}</dt><dd>{{ nombre(p.n) }}</dd></div>
          <div><dt>{{ $t('FichePrenom.risque') }}</dt>
            <dd :style="{ color: p.r > 40 ? 'var(--non)' : 'inherit' }">{{ p.r.toFixed(0) }}/100</dd></div>
        </dl>

        <DansLeMonde :p="p" />

        <p v-if="p.u > 0.12 && p.u < 0.88" class="note">
          {{ $t('FichePrenom.deuxSexes', { pct: (p.u * 100).toFixed(0) }) }}
        </p>
        <p v-if="p.rv" class="note">
          {{ $t('FichePrenom.revival') }}
        </p>
        <p v-if="p.r > 30" class="note alerte">
          {{ $t('FichePrenom.explosion') }}
        </p>
        <p v-if="p.ob" class="note alerte">
          {{ $t('FichePrenom.homonyme', { quoi: p.obn || $t('FichePrenom.homonymeDefaut') }) }}
        </p>
        <p v-if="p.dm?.length" class="note">
          {{ $t('FichePrenom.diminutifs', { liste: p.dm.join(', ') }) }}
        </p>
        <p v-if="!leSens" class="note doux">
          {{ $t('FichePrenom.sansEtymologie') }}
        </p>
        </template>
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
.proches { list-style: none; margin: 0; padding: 0; }
.proches li + li { border-top: 1px solid var(--trait); }
.proche { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto 80px; align-items: center;
  gap: 12px; padding: 9px 2px; border: 0; background: none; font: inherit; color: var(--texte);
  text-align: left; cursor: pointer; border-radius: 10px; }
.proche:active { background: var(--fond); }
.proche .qui { font-weight: 700; }
.proche .combien { font-size: .8rem; color: var(--doux); font-variant-numeric: tabular-nums; }
.proche .allure { height: 24px; }
.retrait { gap: 8px; padding-top: 12px; border-top: 1px solid var(--trait); }
.danger { color: var(--non); padding-left: 0; }
</style>
