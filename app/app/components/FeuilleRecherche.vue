<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { sansAccent, type Prenom } from '~/composables/useCatalogue'
import { useVerdicts, MOT } from '~/composables/useVerdicts'

/**
 * Chercher un prénom précis, depuis le tri.
 *
 * Elle vivait au fond des réglages de la liste : on ne pense pas à aller y
 * chercher le prénom qu'on vient d'entendre à la radio. Elle est désormais
 * sous la loupe du tri, là où l'on est quand l'envie arrive.
 *
 * Dans TOUT le catalogue, filtres de la liste ignorés, et c'est voulu : on
 * cherche le prénom d'une cousine pour savoir ce qu'on en a déjà dit, pas pour
 * s'entendre répondre qu'il ne passe pas le filtre « 2 à 3 syllabes ».
 *
 * On y juge, on y change d'avis, et on y pose un veto — confirmé sur place,
 * parce qu'un veto ne se pose pas d'un geste.
 */
const emit = defineEmits<{ fermer: [] }>()
const g = useGroupeCourant()
const { parPrenom } = useVerdicts()

const recherche = ref('')
const champ = ref<HTMLInputElement>()
const occupe = ref('')
const erreur = ref('')

// Le clavier sort tout de suite : toucher la loupe, c'est vouloir écrire. On
// attend la fin de la montée, sinon le focus fait sauter la feuille.
onMounted(() => setTimeout(() => champ.value?.focus({ preventScroll: true }), 320))

const trouves = computed<Prenom[]>(() => {
  const r = sansAccent(recherche.value.trim())
  if (r.length < 2) return []
  const debut: Prenom[] = []
  const dedans: Prenom[] = []
  for (const p of g.catalogue.value) {
    if (p.slug.startsWith(r)) debut.push(p)
    else if (p.slug.includes(r)) dedans.push(p)
    if (debut.length >= 40) break
  }
  // Les plus donnés d'abord : c'est presque toujours celui qu'on cherche.
  const parFrequence = (a: Prenom, b: Prenom) => b.n - a.n
  return [...debut.sort(parFrequence), ...dedans.sort(parFrequence)].slice(0, 25)
})

const mesVetos = computed(() => new Set(g.mesVetos.value.map(v => v.prenom)))
const observe = computed(() => g.etat.value?.moi?.role === 'observateur')
const vetosMax = computed(() => g.etat.value?.groupe?.nb_vetos_max ?? 3)
const vetosRestants = computed(() => Math.max(0, vetosMax.value - g.mesVetos.value.length))

const etat = (nom: string) => {
  if (g.vetos.value.has(nom)) return { t: 'Veto', c: 'veto' }
  const v = parPrenom.value.get(nom)?.mien
  if (v === undefined || v === null) return null
  return { t: MOT[v], c: `v${v}` }
}

/** Le quota vaut ici comme sur la carte : le serveur compte le geste. */
async function choisir(nom: string, valeur: 0 | 1 | 2) {
  erreur.value = ''
  occupe.value = nom
  try {
    await g.voter(nom, valeur)
  } catch (e: any) {
    const statut = e?.statusCode ?? e?.response?.status
    erreur.value = statut === 402
      ? 'Vos prénoms du jour sont jugés : la suite demain, ou sans limite en débloquant la liste.'
      : 'Ce vote n’a pas pu être enregistré.'
  } finally { occupe.value = '' }
}

// --- veto -----------------------------------------------------------------
const vetoPour = ref<string | null>(null)
const motif = ref('')
const erreurVeto = ref('')
const envoiVeto = ref(false)

function demanderVeto(nom: string) {
  vetoPour.value = vetoPour.value === nom ? null : nom
  motif.value = ''
  erreurVeto.value = ''
}

async function poserVeto() {
  const nom = vetoPour.value
  if (!nom || envoiVeto.value) return
  envoiVeto.value = true
  erreurVeto.value = ''
  try {
    await g.poserVeto(nom, motif.value.trim() || undefined)
    vetoPour.value = null
  } catch (e: any) {
    const m = e?.data?.statusMessage
    erreurVeto.value = m === 'quota_veto_atteint'
      ? 'Vos vetos sont épuisés. Un veto, ça se dépense.'
      : m === 'deja_veto' ? 'Ce prénom a déjà un veto.' : 'Le veto n’a pas pu être posé.'
  } finally { envoiVeto.value = false }
}

async function leverVeto(nom: string) {
  occupe.value = nom
  try { await g.retirerVeto(nom) } catch { erreur.value = 'Le veto n’a pas pu être levé.' }
  finally { occupe.value = '' }
}
</script>

<template>
  <Feuille titre="Chercher un prénom" @fermer="emit('fermer')">
    <input ref="champ" v-model="recherche" class="champ chercher" type="search"
           placeholder="Louise, Gabriel…" aria-label="Chercher un prénom dans le catalogue"
           aria-describedby="recherche-aide" enterkeyhint="search"
           autocapitalize="off" autocorrect="off" spellcheck="false">
    <p id="recherche-aide" class="mini doux" style="margin:0">
      Dans tout le catalogue, filtres ignorés. On vous dit ce que vous en avez
      déjà dit, et vous pouvez le changer ici.
    </p>

    <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
    <p v-if="recherche.trim().length >= 2 && !trouves.length" class="mini doux" role="status"
       style="margin:0">
      Aucun prénom ne correspond.
    </p>

    <ul v-if="trouves.length" class="resultats" aria-label="Résultats">
      <li v-for="p in trouves" :key="p.l" class="trouve-bloc">
        <div class="trouve">
          <button type="button" class="nom" @click="g.ouvrirFiche(p.l)">
            {{ p.l }}
            <Etincelles v-if="g.favoris.value.has(p.l)" :taille="12" couleur="var(--peche)" une />
          </button>
          <span v-if="p.q" class="puce rare" :title="`${p.n} naissances en trois ans`">rare</span>
          <span v-if="etat(p.l)" class="puce" :class="etat(p.l)!.c">{{ etat(p.l)!.t }}</span>
          <BoutonsVerdict :valeur="parPrenom.get(p.l)?.mien ?? null" :nom="p.l"
                          :occupe="occupe === p.l" @choisir="choisir(p.l, $event)" />
          <template v-if="!observe">
            <button v-if="mesVetos.has(p.l)" type="button" class="btn btn-0 mini lever"
                    :disabled="occupe === p.l" :aria-label="`Lever mon veto sur ${p.l}`"
                    @click="leverVeto(p.l)">
              Lever
            </button>
            <button v-else-if="!g.vetos.value.has(p.l)" type="button" class="veto"
                    :class="{ on: vetoPour === p.l }" :aria-expanded="vetoPour === p.l"
                    :aria-label="`Veto sur ${p.l}`" @click="demanderVeto(p.l)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8.2" /><path d="m6.4 6.4 11.2 11.2" />
              </svg>
            </button>
          </template>
        </div>

        <!-- La confirmation se déplie sous la ligne : pas de seconde feuille
             par-dessus celle-ci, qu'on ne saurait plus fermer au doigt. -->
        <div v-if="vetoPour === p.l" class="confirme-veto" role="group"
             :aria-label="`Poser un veto sur ${p.l}`">
          <p class="mini" style="margin:0">
            Un veto est <strong>définitif</strong> : {{ p.l }} ne pourra plus jamais être
            dans vos accords, quoi que votent les autres. Personne ne verra que c’est vous.
          </p>
          <input v-model="motif" class="champ" maxlength="200"
                 aria-label="Motif du veto (facultatif, visible de vous seul)"
                 placeholder="Pourquoi ? (pour vous, facultatif)" @keyup.enter="poserVeto">
          <p class="mini doux" style="margin:0">
            Il vous en reste <strong>{{ vetosRestants }}</strong> sur {{ vetosMax }}.
          </p>
          <p v-if="erreurVeto" class="mini" role="alert" style="color:var(--non);margin:0">
            {{ erreurVeto }}
          </p>
          <div class="ligne" style="gap:8px">
            <button type="button" class="btn mini rouge-plein" :disabled="envoiVeto || !vetosRestants"
                    @click="poserVeto">
              {{ envoiVeto ? 'Un instant…' : `Poser mon veto sur ${p.l}` }}
            </button>
            <button type="button" class="btn btn-0 mini doux" @click="vetoPour = null">Annuler</button>
          </div>
        </div>
      </li>
    </ul>
  </Feuille>
</template>

<style scoped>
.chercher { -webkit-appearance: none; appearance: none; }
.resultats { list-style: none; margin: 0; padding: 0; }
.trouve-bloc { border-top: 1px solid var(--trait); }
.trouve { display: flex; align-items: center; gap: 8px; padding: 7px 0; }
.trouve .nom { flex: 1; min-width: 0; text-align: left; border: 0; background: none;
  font: inherit; font-weight: 600; color: var(--texte); cursor: pointer; padding: 6px 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: flex; align-items: center; gap: 5px; }
.trouve .puce { font-size: .66rem; flex: none; }
.trouve .v0, .trouve .veto.puce { background: color-mix(in srgb, var(--non) 22%, transparent); }
.trouve .v2 { background: color-mix(in srgb, var(--oui) 22%, transparent); }
/* Un prénom trouvé par la recherche mais absent du tri : sans ce marqueur on
   croit à un bug de la pile. */
.trouve .rare { background: none; border: 1px dashed var(--trait); color: var(--doux); }
.veto:not(.puce) { width: 30px; height: 30px; flex: none; border-radius: 50%; padding: 0;
  border: 1px solid var(--trait); background: var(--fond); color: var(--non);
  display: grid; place-items: center; cursor: pointer; }
.veto svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.3;
  stroke-linecap: round; }
.veto.on { background: var(--non); border-color: var(--non); color: var(--fond); }
.lever { flex: none; padding: 6px 8px; color: var(--non); }
.confirme-veto { display: flex; flex-direction: column; gap: 9px; margin: 0 0 10px;
  padding: 12px 14px; border-radius: var(--r-s);
  border: 1px solid color-mix(in srgb, var(--non) 45%, var(--trait));
  animation: deplie .2s cubic-bezier(.2,.8,.3,1); }
@keyframes deplie { from { opacity: 0; transform: translateY(-4px) } }
/* var(--fond) et pas du blanc : en sombre, le rouge s'eclaircit et le blanc
   dessus tombait sous 3:1. */
.rouge-plein { background: var(--non); border-color: var(--non); color: var(--fond); }
.rouge-plein:disabled { opacity: .5; }
</style>
