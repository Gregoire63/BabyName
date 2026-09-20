<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { useVerdicts, MOT } from '~/composables/useVerdicts'

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

const GROUPES = [
  { v: 2 as const, t: 'Oui', d: 'Ceux que vous gardez.' },
  { v: 1 as const, t: 'Neutre', d: 'Ni oui ni non — ils restent en jeu.' },
  { v: 0 as const, t: 'Non', d: 'Écartés. Un autre avis peut les faire revenir.' }
]
const listes = { 2: miens(2), 1: miens(1), 0: miens(0) } as const

const ouvert = ref<number | null>(2)
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
  await $fetch(`/api/groupes/${g.gid}/vote`,
    { method: 'DELETE', body: { prenoms } }).catch(() => null)
  const s = new Set(g.dejaVotes.value)
  for (const p of prenoms) s.delete(p)
  g.dejaVotes.value = s
  remise.value = ''
  await Promise.all([g.rechargerVotes(), chargerFamilles()])
}
</script>

<template>
  <div class="pile">
    <section v-for="grp in GROUPES" :key="grp.v" class="carte pile groupe">
      <button class="entete" @click="bascule(grp.v)">
        <span class="pastille" :class="`v${grp.v}`" />
        <strong style="flex:1;text-align:left">{{ grp.t }}</strong>
        <span class="puce">{{ listes[grp.v].value.length }}</span>
        <span class="doux">{{ ouvert === grp.v ? '−' : '+' }}</span>
      </button>

      <template v-if="ouvert === grp.v">
        <p class="mini doux" style="margin:0">{{ grp.d }}</p>

        <p v-if="!listes[grp.v].value.length" class="mini doux" style="margin:0">
          Rien ici pour l’instant.
        </p>

        <div v-for="p in visible(grp.v)" :key="p.prenom" class="rangee">
          <button class="nom" @click="g.ouvrirFiche(p.prenom)">
            {{ p.prenom }}
            <Etincelles v-if="g.favoris.value.has(p.prenom)" :taille="12"
                        couleur="var(--peche)" une />
          </button>
          <span v-for="a in p.autres" :key="a.pseudo" class="puce" :class="`a${a.valeur}`">
            {{ a.pseudo }} · {{ MOT[a.valeur] }}
          </span>
          <BoutonsVerdict :valeur="p.mien" :occupe="occupe === p.prenom"
                          @choisir="changer(p.prenom, $event)" />
        </div>

        <button v-if="!tout.has(grp.v) && listes[grp.v].value.length > PALIER"
                class="btn btn-0 mini doux" style="align-self:flex-start"
                @click="montrerTout(grp.v)">
          Voir les {{ listes[grp.v].value.length }}
        </button>

        <template v-if="grp.v === 0 && familles.length">
          <p class="etiquette">Familles écartées d’un geste</p>
          <div v-for="f in familles" :key="f.racine" class="famille">
            <div class="ligne" style="flex-wrap:wrap;gap:6px;flex:1">
              <span v-for="n in f.prenoms" :key="n" class="puce">{{ n }}</span>
            </div>
            <button class="btn btn-0 mini" :disabled="remise === f.prenoms[0]"
                    @click="remettre(f.prenoms)">
              {{ remise === f.prenoms[0] ? '…' : `Remettre les ${f.prenoms.length}` }}
            </button>
          </div>
        </template>
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
