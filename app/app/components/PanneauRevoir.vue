<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { useVerdicts, MOT } from '~/composables/useVerdicts'
import { expliquerDesaccord, quiPeutEtreExplique, MIN_OUI } from '~/composables/usePortrait'

/**
 * Les desaccords, et la possibilite d'en revenir.
 *
 * Le manque etait la : un « non » donne en trois secondes enterrait
 * definitivement un prenom que l'autre adorait, et rien ne le disait jamais.
 * Ici on voit qui a dit quoi, et on peut changer d'avis — « ah, toi tu aimes
 * bien ? bon, pourquoi pas finalement ».
 */
defineProps<{ actif: boolean }>()
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

const pourquoi = (prenom: string) => paye.value
  ? expliquerDesaccord(prenom, g.votes.value as any, g.parNom.value, moiId.value)
  : null

// Si on se tait, on dit une fois pourquoi — sinon la fonction a l'air cassee.
const silence = computed(() => {
  if (!paye.value || !aRevoir.value.length) return null
  if (aRevoir.value.some(v => pourquoi(v.prenom))) return null
  const gens = quiPeutEtreExplique(g.votes.value as any, moiId.value)
    .filter(x => x.oui < MIN_OUI)
  if (!gens.length) return null
  const q = gens[0]!
  return `On pourra dire ce qui vous sépare quand ${q.pseudo} aura gardé ${MIN_OUI} prénoms que vous avez jugés tous les deux (${q.oui} pour l'instant). En dessous, une moyenne ne veut rien dire.`
})

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
      <p>Les prénoms où l’un dit oui et l’autre non arrivent ici. Il n’y en a
         pas pour l’instant — ou vous n’avez pas encore jugé les mêmes.</p>
      <button class="btn" @click="g.allerA('swipe')">Aller trier</button>
    </div>

    <template v-else>
      <p class="mini doux" style="margin:0">
        Un oui d’un côté, un non de l’autre. Rien n’est figé : changez votre
        vote ici et le prénom rejoint les communs.
      </p>
      <p v-if="silence" class="mini doux" style="margin:0">{{ silence }}</p>
      <button v-if="!paye" class="btn btn-0 mini" style="align-self:flex-start"
              @click="g.ouvrirDebloquer()">
        Savoir ce qui vous sépare sur chacun
      </button>

      <article v-for="v in aRevoir" :key="v.prenom" class="carte desaccord">
        <div class="ligne" style="gap:10px">
          <button class="nom" @click="g.ouvrirFiche(v.prenom)">{{ v.prenom }}</button>
          <BoutonsVerdict :valeur="v.mien" :occupe="occupe === v.prenom"
                          @choisir="changer(v.prenom, $event, v.autres)" />
        </div>
        <p v-if="pourquoi(v.prenom)" class="pourquoi">{{ pourquoi(v.prenom)!.texte }}</p>
        <div class="ligne avis">
          <span class="puce" :class="`a${v.mien}`">Vous · {{ MOT[v.mien ?? 1] }}</span>
          <span v-for="a in v.autres" :key="a.pseudo" class="puce"
                :class="[`a${a.valeur}`, { obs: a.observateur }]">
            {{ a.pseudo }} · {{ MOT[a.valeur] }}<template v-if="a.observateur"> · avis</template>
          </span>
        </div>
      </article>
    </template>

    <EffetMatch v-if="match" :prenom="match.prenom" :avec="match.avec"
                @fermer="match = null" />
  </div>
</template>

<style scoped>
.desaccord { padding: 13px 15px; display: flex; flex-direction: column; gap: 9px; }
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
