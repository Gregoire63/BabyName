<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { sansAccent, type Prenom } from '~/composables/useCatalogue'
import { useVerdicts, MOT } from '~/composables/useVerdicts'

/**
 * Chercher un prénom précis, depuis le tri — et l'amener en haut de la pile.
 *
 * Un résultat n'a qu'une action : le toucher le met en PREMIÈRE CARTE, et la
 * feuille se ferme. On le juge alors comme les autres, d'un geste, avec toute
 * sa carte sous les yeux. Les votes et le blocage en petit, ligne par ligne,
 * faisaient doublon avec la carte et se lisaient mal.
 *
 * Dans TOUT le catalogue, filtres de la liste ignorés, et c'est voulu : on
 * cherche le prénom d'une cousine pour savoir ce qu'on en a déjà dit, pas pour
 * s'entendre répondre qu'il ne passe pas le filtre « 2 à 3 syllabes ». Déjà
 * jugé, il revient quand même : le rejuger remplace l'ancien vote.
 */
const emit = defineEmits<{ fermer: []; choisir: [nom: string] }>()
const g = useGroupeCourant()
const { parPrenom } = useVerdicts()

const recherche = ref('')
const champ = ref<HTMLInputElement>()

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

/** Retiré du jeu : « Déjà pris » se dit (c'est tout son principe), un
 *  blocage secret ne dit que « Bloqué », jamais par qui. */
const retire = (nom: string) => g.parDejaPris.value.has(nom) ? 'Déjà pris'
  : g.vetos.value.has(nom) ? 'Bloqué' : null

const etat = (nom: string) => {
  const r = retire(nom)
  if (r) return { t: r, c: 'veto' }
  const v = parPrenom.value.get(nom)?.mien
  if (v === undefined || v === null) return null
  return { t: MOT[v], c: `v${v}` }
}

/** Un prénom retiré du jeu n'y revient pas : la ligne le dit, sans bouton. */
function choisir(p: Prenom, fermer: () => void) {
  if (g.vetos.value.has(p.l)) return
  emit('choisir', p.l)
  fermer()
}
</script>

<template>
  <Feuille titre="Chercher un prénom" @fermer="emit('fermer')">
    <template #default="{ fermer }">
      <input ref="champ" v-model="recherche" class="champ chercher" type="search"
             placeholder="Louise, Gabriel…" aria-label="Chercher un prénom dans le catalogue"
             aria-describedby="recherche-aide" enterkeyhint="search"
             autocapitalize="off" autocorrect="off" spellcheck="false"
             @keyup.enter="trouves[0] && choisir(trouves[0], fermer)">
      <p id="recherche-aide" class="mini doux" style="margin:0">
        Dans tout le catalogue, filtres ignorés. Touchez un prénom : il passe
        en première carte.
      </p>

      <p v-if="recherche.trim().length >= 2 && !trouves.length" class="mini doux" role="status"
         style="margin:0">
        Aucun prénom ne correspond.
      </p>

      <ul v-if="trouves.length" class="resultats" aria-label="Résultats">
        <li v-for="p in trouves" :key="p.l">
          <button v-if="!g.vetos.value.has(p.l)" type="button" class="trouve"
                  :aria-label="`${p.l}${p.q ? ', rare' : ''} : mettre en première carte${etat(p.l) ? ` (déjà jugé : ${etat(p.l)!.t.toLowerCase()})` : ''}`"
                  @click="choisir(p, fermer)">
            <span class="nom">
              {{ p.l }}
              <Etincelles v-if="g.favoris.value.has(p.l)" :taille="12" couleur="var(--peche)" une />
            </span>
            <span v-if="p.q" class="puce rare" :title="`${p.n} naissances en trois ans`">rare</span>
            <span v-if="etat(p.l)" class="puce" :class="etat(p.l)!.c">{{ etat(p.l)!.t }}</span>
            <svg class="fleche" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </button>
          <div v-else class="trouve bloque">
            <span class="nom">{{ p.l }}</span>
            <span class="puce veto">{{ retire(p.l) }}</span>
          </div>
        </li>
      </ul>
    </template>
  </Feuille>
</template>

<style scoped>
.chercher { -webkit-appearance: none; appearance: none; }
.resultats { list-style: none; margin: 0; padding: 0; }
.resultats li { border-top: 1px solid var(--trait); }
.trouve { width: 100%; display: flex; align-items: center; gap: 8px; padding: 12px 2px;
  border: 0; background: none; font: inherit; color: var(--texte); text-align: left;
  cursor: pointer; border-radius: 10px; }
.trouve:active { background: var(--fond); }
.trouve .nom { flex: 1; min-width: 0; font-weight: 650; font-size: 1.02rem;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: flex; align-items: center; gap: 5px; }
.trouve .puce { font-size: .66rem; flex: none; }
.trouve .v0, .trouve .veto { background: color-mix(in srgb, var(--non) 22%, transparent); }
.trouve .v2 { background: color-mix(in srgb, var(--oui) 22%, transparent); }
/* Un prénom trouvé par la recherche mais absent du tri : sans ce marqueur on
   croit à un bug de la pile. */
.trouve .rare { background: none; border: 1px dashed var(--trait); color: var(--doux); }
.fleche { width: 16px; height: 16px; flex: none; fill: none; stroke: var(--doux);
  stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.bloque { cursor: default; opacity: .7; }
</style>
