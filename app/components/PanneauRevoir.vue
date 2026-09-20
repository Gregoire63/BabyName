<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { useVerdicts, MOT } from '~/composables/useVerdicts'

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

async function changer(prenom: string, valeur: 0 | 1 | 2, autres: { pseudo: string }[]) {
  occupe.value = prenom
  const avant = new Set(g.communs.value.map((c: any) => c.prenom))
  try {
    await g.voter(prenom, valeur)
    // Devenu commun a l'instant : c'est le moment qui merite la fete, et c'est
    // celui qui change d'avis qui la voit — l'autre l'a deja vue, ou la verra.
    const apres = new Set(g.communs.value.map((c: any) => c.prenom))
    if (!avant.has(prenom) && apres.has(prenom)) {
      match.value = { prenom, avec: autres.map(a => a.pseudo) }
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

      <article v-for="v in aRevoir" :key="v.prenom" class="carte desaccord">
        <div class="ligne" style="gap:10px">
          <button class="nom" @click="g.ouvrirFiche(v.prenom)">{{ v.prenom }}</button>
          <BoutonsVerdict :valeur="v.mien" :occupe="occupe === v.prenom"
                          @choisir="changer(v.prenom, $event, v.autres)" />
        </div>
        <div class="ligne avis">
          <span class="puce" :class="`a${v.mien}`">Vous · {{ MOT[v.mien ?? 1] }}</span>
          <span v-for="a in v.autres" :key="a.pseudo" class="puce" :class="`a${a.valeur}`">
            {{ a.pseudo }} · {{ MOT[a.valeur] }}
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
.avis { flex-wrap: wrap; gap: 6px; }
.avis .puce { font-size: .7rem; }
.avis .a0 { background: color-mix(in srgb, var(--non) 22%, transparent); }
.avis .a2 { background: color-mix(in srgb, var(--oui) 22%, transparent); }
</style>
