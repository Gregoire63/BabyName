<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { useVerdicts } from '~/composables/useVerdicts'

/**
 * Tout ce que j'ai juge, range par verdict, et modifiable sur place.
 *
 * C'etait eparpille : les oui dans le Top, les non dans les reglages de la
 * liste, les neutres nulle part. Un seul endroit, et le meme geste qu'au tri
 * pour changer d'avis.
 */
const props = defineProps<{ actif: boolean }>()
const g = useGroupeCourant()
const { miens } = useVerdicts()

// Titre et description : app/textes/PanneauMesChoix (titre<v>, desc<v>).
const GROUPES = [{ v: 2 as const }, { v: 1 as const }, { v: 0 as const }]

// Les favoris et les vetos ne sont pas des verdicts : ils se superposent aux
// oui / neutre / non. Ils meritent donc leurs propres blocs, sans quoi on ne
// les voyait nulle part — sauf une etincelle discrete sur les lignes.
// (« Gardés » ne disait pas ce que c'etait : ce sont les « Favoris » de la
// carte de tri, et ils portent le meme nom ici.)
const mesFavoris = computed(() => [...g.favoris.value])
const vetos = computed(() => g.mesVetos.value)
const retrait = ref('')
const vetosMax = computed(() => g.etat.value?.groupe?.nb_vetos_max ?? BLOCAGES_SECRETS)
const vetosRestants = computed(() => Math.max(0, vetosMax.value - vetos.value.length))
const nbDejaPris = computed(() => g.dejaPris.value.length)

async function retirerVeto(prenom: string) {
  retrait.value = prenom
  try { await g.retirerVeto(prenom) } finally { retrait.value = '' }
}
const listes = { 2: miens(2), 1: miens(1), 0: miens(0) } as const

const ouvert = ref<number | null>(2)   // -1 favoris, -2 vetos
const tout = ref<Set<number>>(new Set())
const PALIER = 24
const occupe = ref('')

function bascule(v: number) { ouvert.value = ouvert.value === v ? null : v }
function montrerTout(v: number) { tout.value = new Set([...tout.value, v]) }
const visible = (v: 0 | 1 | 2) =>
  tout.value.has(v) ? listes[v].value : listes[v].value.slice(0, PALIER)

async function changer(prenom: string, valeur: 0 | 1 | 2) {
  occupe.value = prenom
  try { await g.voter(prenom, valeur) } finally { occupe.value = '' }
}

// --- familles ecartees d'un geste -----------------------------------------
// Le regroupement vient du serveur : il lit la racine enregistree au moment du
// balayage (votes.balayage), il ne la recalcule pas.
const familles = ref<{ racine: string; prenoms: string[] }[]>([])
const remise = ref('')

async function chargerFamilles() {
  const r = await $fetch<any>(`/api/groupes/${g.gid}/ecartes`).catch(() => null)
  familles.value = (r?.familles ?? []).filter((f: any) => f.prenoms.length > 1)
}
watch(() => props.actif, a => { if (a) chargerFamilles() }, { immediate: true })

async function remettre(prenoms: string[]) {
  remise.value = prenoms[0] ?? ''
  // AVANT d'attendre le serveur. Ce volet ne suit plus la liste dès qu'on le
  // quitte (EnVeille) : relus après la réponse, les prénoms déjà jugés
  // pourraient dater d'avant un swipe fait entre-temps, et le réécrire
  // l'effacerait. Ici, on lit et on écrit dans le même geste.
  const s = new Set(g.dejaVotes.value)
  for (const p of prenoms) s.delete(p)
  g.dejaVotes.value = s
  await $fetch(`/api/groupes/${g.gid}/remettre`,
    { method: 'POST', body: { prenoms } }).catch(() => null)
  remise.value = ''
  await Promise.all([g.rechargerVotes(), chargerFamilles()])
}
</script>

<template>
  <div class="pile">
    <section v-for="grp in GROUPES" :key="grp.v" class="carte pile groupe">
      <button class="entete" @click="bascule(grp.v)">
        <span class="pastille" :class="`v${grp.v}`" />
        <strong style="flex:1;text-align:left">{{ $t(`PanneauMesChoix.titre${grp.v}`) }}</strong>
        <span class="puce">{{ listes[grp.v].value.length }}</span>
        <span class="doux">{{ ouvert === grp.v ? '−' : '+' }}</span>
      </button>

      <template v-if="ouvert === grp.v">
        <p class="mini doux" style="margin:0">{{ $t(`PanneauMesChoix.desc${grp.v}`) }}</p>

        <p v-if="!listes[grp.v].value.length" class="mini doux" style="margin:0">
          {{ $t('PanneauMesChoix.rienIci') }}
        </p>

        <div v-for="p in visible(grp.v)" :key="p.prenom" class="rangee">
          <button class="nom" @click="g.ouvrirFiche(p.prenom)">
            {{ p.prenom }}
            <Etincelles v-if="g.favoris.value.has(p.prenom)" :taille="12"
                        couleur="var(--peche)" une />
          </button>
          <!-- Un oui qui n'aboutira pas : sans ce mot, on cherchait pourquoi
               il avait quitté les accords. -->
          <span v-if="g.parDejaPris.value.has(p.prenom)" class="puce pris"
                :title="g.parDejaPris.value.get(p.prenom)?.motif ?? undefined">{{ $t('PanneauMesChoix.dejaPris') }}</span>
          <span v-for="a in p.autres" :key="a.pseudo" class="puce" :class="`a${a.valeur}`">
            {{ a.pseudo }} · {{ $t(`PanneauMesChoix.verdict${a.valeur}`) }}
          </span>
          <BoutonsVerdict :valeur="p.mien" :occupe="occupe === p.prenom"
                          @choisir="changer(p.prenom, $event)" />
        </div>

        <button v-if="!tout.has(grp.v) && listes[grp.v].value.length > PALIER"
                class="btn btn-0 mini doux" style="align-self:flex-start"
                @click="montrerTout(grp.v)">
          {{ $t('PanneauMesChoix.voirTout', { n: listes[grp.v].value.length }) }}
        </button>

        <template v-if="grp.v === 0 && familles.length">
          <p class="etiquette">{{ $t('PanneauMesChoix.ecartesGroupe') }}</p>
          <div v-for="f in familles" :key="f.racine" class="famille">
            <div class="ligne" style="flex-wrap:wrap;gap:6px;flex:1">
              <span v-for="n in f.prenoms" :key="n" class="puce">{{ n }}</span>
            </div>
            <button class="btn btn-0 mini" :disabled="remise === f.prenoms[0]"
                    @click="remettre(f.prenoms)">
              {{ remise === f.prenoms[0] ? '…' : $t('PanneauMesChoix.remettre', { n: f.prenoms.length }) }}
            </button>
          </div>
        </template>
      </template>
    </section>

    <section class="carte pile groupe">
      <button class="entete" @click="bascule(-1)">
        <Etincelles :taille="14" couleur="var(--peche)" une />
        <strong style="flex:1;text-align:left">{{ $t('PanneauMesChoix.favoris') }}</strong>
        <span class="puce">{{ mesFavoris.length }}</span>
        <span class="doux">{{ ouvert === -1 ? '−' : '+' }}</span>
      </button>
      <template v-if="ouvert === -1">
        <p class="mini doux" style="margin:0">
          {{ $t('PanneauMesChoix.favorisAide') }}
        </p>
        <p v-if="!mesFavoris.length" class="mini doux" style="margin:0">
          {{ $t('PanneauMesChoix.aucun') }}
        </p>
        <div v-for="p in mesFavoris" :key="p" class="rangee">
          <button class="nom" @click="g.ouvrirFiche(p)">{{ p }}</button>
          <button class="btn btn-0 mini doux" @click="g.basculerFavori(p)">{{ $t('PanneauMesChoix.retirer') }}</button>
        </div>
      </template>
    </section>

    <section class="carte pile groupe">
      <button class="entete" @click="bascule(-2)">
        <span class="pastille veto" />
        <strong style="flex:1;text-align:left">{{ $t('PanneauMesChoix.veto') }}</strong>
        <span class="puce">{{ vetos.length }}</span>
        <span class="doux">{{ ouvert === -2 ? '−' : '+' }}</span>
      </button>
      <template v-if="ouvert === -2">
        <p class="mini doux" style="margin:0">
          {{ $t('PanneauMesChoix.reste', { n: vetosRestants, max: vetosMax }) }}
        </p>
        <p v-if="!vetos.length" class="mini doux" style="margin:0">
          {{ $t('PanneauMesChoix.aucun') }}
        </p>
        <div v-for="v in vetos" :key="v.prenom" class="rangee">
          <button class="nom" @click="g.ouvrirFiche(v.prenom)">
            {{ v.prenom }}
            <span v-if="v.variantes?.length" class="graphies"
                  :title="v.variantes.join(', ')">{{ $t('PanneauMesChoix.graphies', { n: v.variantes.length }) }}</span>
            <em v-if="v.motif" class="motif">{{ v.motif }}</em>
          </button>
          <button class="btn btn-0 mini doux" :disabled="retrait === v.prenom"
                  @click="retirerVeto(v.prenom)">
            {{ retrait === v.prenom ? '…' : $t('PanneauMesChoix.retirer') }}
          </button>
        </div>
        <!-- L'autre façon de retirer un prénom, celle qu'on dit : elle vit
             dans les réglages de la liste, puisqu'elle est à tout le monde. -->
        <button class="btn btn-0 mini vers-pris" @click="g.allerA('reglages')">
          {{ $t('PanneauMesChoix.versPris', { n: nbDejaPris }) }}
        </button>
      </template>
    </section>
  </div>
</template>

<style scoped>
.groupe { gap: 10px; }
.entete { display: flex; align-items: center; gap: 9px; border: 0; background: none;
  padding: 0; font: inherit; cursor: pointer; color: var(--texte); }
.entete strong { font-size: 1.02rem; }
.pastille { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.pastille.v2 { background: var(--oui); }
.pastille.v1 { background: var(--encre); }
.pastille.v0 { background: var(--non); }
.puce.pris { background: color-mix(in srgb, var(--non) 18%, transparent); }
.graphies { font-size: .7rem; font-weight: 500; color: var(--doux); margin-left: 4px; }
.vers-pris { align-self: flex-start; text-align: left; }
.pastille.veto { background: var(--non); box-shadow: 0 0 0 3px color-mix(in srgb, var(--non) 25%, transparent); }
.motif { font-style: normal; font-size: .72rem; color: var(--doux); font-weight: 500; }

.rangee { display: flex; align-items: center; gap: 8px; padding: 6px 0;
  border-top: 1px solid var(--trait); }
.rangee .nom { flex: 1; min-width: 0; text-align: left; border: 0; background: none;
  font: inherit; font-weight: 600; color: var(--texte); cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: flex; align-items: center; gap: 5px; }
.rangee .puce { font-size: .66rem; flex: none; }
.rangee .a0 { background: color-mix(in srgb, var(--non) 22%, transparent); }
.rangee .a2 { background: color-mix(in srgb, var(--oui) 22%, transparent); }

.etiquette { margin: 8px 0 0; font-size: .68rem; text-transform: uppercase;
  letter-spacing: .07em; font-weight: 800; color: var(--doux); }
.famille { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0;
  border-top: 1px solid var(--trait); }
.famille .btn { flex: none; white-space: nowrap; }
</style>
