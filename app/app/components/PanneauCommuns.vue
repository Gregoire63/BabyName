<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

// La liste des communs est chargee avec le reste de la liste : l'onglet en a
// besoin pour sa pastille avant meme d'etre ouvert. On la lit, on ne la refait pas.
const communs = computed(() => g.communs.value)

const ouvert = ref<string | null>(null)
const commentaires = ref<any[]>([])
const brouillon = ref('')

async function ouvrir(prenom: string) {
  if (ouvert.value === prenom) { ouvert.value = null; return }
  ouvert.value = prenom
  commentaires.value = await $fetch(
    `/api/groupes/${g.gid}/commentaires?prenom=${encodeURIComponent(prenom)}`)
}

async function commenter() {
  if (!brouillon.value.trim() || !ouvert.value) return
  const p = ouvert.value
  await $fetch(`/api/groupes/${g.gid}/commentaires`,
    { method: 'POST', body: { prenom: p, texte: brouillon.value } })
  brouillon.value = ''
  commentaires.value = await $fetch(
    `/api/groupes/${g.gid}/commentaires?prenom=${encodeURIComponent(p)}`)
  // Le compte de la carte repliée suit, sans recharger toute la liste.
  const c = communs.value.find((x: any) => x.prenom === p)
  if (c) c.nb_commentaires = commentaires.value.length
}

/** « 1 commentaire », « 3 commentaires » : de quoi savoir qu'il faut déplier. */
const motsLisibles = (n: number) => `${n} commentaire${n > 1 ? 's' : ''}`

/** Un accord qu'on retire après coup — le bébé de la cousine est né entre-
 *  temps. La même feuille que sur la carte : déjà pris, ou en secret. */
const ecarterPour = ref<string | null>(null)
/** Un observateur n'a pas de veto : il n'a pas le bouton. */
const jObserve = computed(() => g.etat.value?.moi?.role === 'observateur')

/**
 * Le cœur des grands-parents.
 *
 * Un observateur ne décide pas, mais la courte liste du couple est le moment
 * où il a envie de dire « celui-là ». Son cœur, c'est son « oui » sur le
 * prénom (le même vote qu'au tri, qui ne compte toujours pas dans les
 * accords) ; le retirer le repasse en « neutre » plutôt que de l'effacer —
 * sinon le prénom reviendrait dans sa pile de tri.
 */
const coeurEnCours = ref('')
async function basculerCoeur(c: any) {
  if (coeurEnCours.value) return
  coeurEnCours.value = c.prenom
  try { await g.voter(c.prenom, c.j_aime ? 1 : 2) }
  catch { /* rien de changé : le cœur reste tel qu'il était */ }
  finally { coeurEnCours.value = '' }
}

/** « Mamie », « vous et Papi », « Mamie, Papi et Tata Rose ». */
function coeursLisibles(c: any): string {
  const noms = [...(c.coeurs ?? [])].sort((a: any, b: any) => Number(b.moi) - Number(a.moi))
    .map((x: any) => x.moi ? 'vous' : x.pseudo)
  if (noms.length <= 1) return noms.join('')
  return `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}`
}

/** Qui traîne : un commun ne sort que si tout le monde a voté dessus. */
const enRetard = computed(() => {
  // Les décideurs seulement : un observateur (Mamie) n'est pas attendu par
  // les accords — dire « la liste reste incomplète tant qu'elle n'a pas
  // rattrapé » était faux, et culpabilisait la personne qui n'y peut rien.
  const a = (g.etat.value?.avancement ?? []).filter((x: any) => x.role !== 'observateur')
  if (a.length < 2) return null
  const max = Math.max(...a.map((x: any) => x.votes))
  const lent = a.find((x: any) => x.votes < max * 0.6)
  return lent ? { pseudo: lent.pseudo, manque: max - lent.votes } : null
})
</script>

<template>
  <div class="pile">
    <p v-if="enRetard" class="rappel mini">
      {{ enRetard.manque }} votes manquent à {{ enRetard.pseudo }} : la liste reste incomplète
      tant que {{ enRetard.pseudo }} n’a pas rattrapé.
    </p>

    <div v-if="!communs.length" class="vide">
      <Etincelles :taille="34" couleur="var(--menthe)" />
      <h2>Rien en commun pour l’instant</h2>
      <p>Les prénoms que vous aimez tous arriveront ici.</p>
      <button class="btn" @click="g.allerA('swipe')">Aller trier</button>
    </div>

    <article v-for="c in communs" :key="c.prenom" class="carte" style="padding:14px 16px">
      <!-- Le bouton porte le prenom et s'etend sur tout l'en-tete (::after) :
           au doigt rien ne change, au clavier l'en-tete devient atteignable. -->
      <div class="ligne entete">
        <div style="flex:1;min-width:0">
          <h2>
            <button type="button" class="deplier" :aria-expanded="ouvert === c.prenom"
                    @click="ouvrir(c.prenom)">{{ c.prenom }}</button>
          </h2>
          <p class="mini doux" style="margin:3px 0 0">
            {{ c.nb_oui }} oui<span v-if="c.nb_neutres"> · {{ c.nb_neutres }} neutre</span>
            <span v-if="c.nb_commentaires" class="mots"> · {{ motsLisibles(c.nb_commentaires) }}</span>
            <template v-if="g.parNom.value.get(c.prenom)?.m">
              · « {{ g.parNom.value.get(c.prenom)!.m }} »</template>
          </p>
          <p v-if="c.coeurs?.length" class="mini coeurs" style="margin:4px 0 0">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.6 13a4.7 4.7 0 0 1 6.6-6.7l.8.8.8-.8a4.7 4.7 0 0 1 6.6 6.7Z" /></svg>
            <span>Aimé par {{ coeursLisibles(c) }}</span>
          </p>
        </div>
        <!-- Au-dessus de l'en-tête dépliable (::after) : le cœur se touche sans
             ouvrir la carte. -->
        <button v-if="jObserve" type="button" class="coeur" :aria-pressed="!!c.j_aime"
                :disabled="coeurEnCours === c.prenom"
                :aria-label="c.j_aime ? `Retirer mon cœur à ${c.prenom}` : `J’aime ${c.prenom}`"
                @click="basculerCoeur(c)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.6 13a4.7 4.7 0 0 1 6.6-6.7l.8.8.8-.8a4.7 4.7 0 0 1 6.6 6.7Z" /></svg>
        </button>
      </div>

      <div v-if="ouvert === c.prenom" class="pile" style="margin-top:14px;gap:10px">
        <div v-for="m in commentaires" :key="m.id" class="mini">
          <strong>{{ m.pseudo }}</strong> : {{ m.texte }}
        </div>
        <p v-if="!commentaires.length" class="mini doux" style="margin:0">Aucun commentaire.</p>
        <div class="ligne">
          <input v-model="brouillon" class="champ mini" placeholder="Votre avis…"
                 :aria-label="`Votre avis sur ${c.prenom}`"
                 @keyup.enter="commenter">
          <button class="btn mini" @click="commenter">Dire</button>
        </div>
        <div class="ligne" style="justify-content:space-between">
          <button class="btn btn-0 mini" @click="g.ouvrirFiche(c.prenom)">Plus d’informations</button>
          <button v-if="!jObserve" class="btn btn-0 mini" style="color:var(--non)"
                  :aria-label="`Veto sur ${c.prenom}`" @click="ecarterPour = c.prenom">
            Veto
          </button>
        </div>
      </div>
    </article>
    <FeuilleEcarter v-if="ecarterPour" :prenom="ecarterPour" @fermer="ecarterPour = null" />
  </div>
</template>

<style scoped>
.entete { position: relative; }
.deplier { all: unset; cursor: pointer; }
.deplier::after { content: ''; position: absolute; inset: 0; }
.deplier:focus-visible { outline: none; }
.entete:has(.deplier:focus-visible) { outline: 3px solid var(--focus); outline-offset: 4px; border-radius: 10px; }
.coeurs { display: flex; align-items: center; gap: 5px; color: var(--texte); }
/* Un mot à lire : il se remarque dans la ligne grise, sans crier. */
.mots { color: var(--texte); font-weight: 700; }
.coeurs svg { width: 13px; height: 13px; flex: none; fill: var(--oui); }
/* Au-dessus du calque cliquable de l'en-tête. */
.coeur { position: relative; z-index: 1; flex: none; width: 44px; height: 44px; border-radius: 999px;
  border: 1px solid var(--trait); background: var(--carte); display: grid; place-items: center;
  cursor: pointer; }
.coeur svg { width: 21px; height: 21px; fill: none; stroke: var(--oui); stroke-width: 2;
  stroke-linejoin: round; }
.coeur[aria-pressed="true"] { border-color: color-mix(in srgb, var(--oui) 55%, var(--trait));
  background: color-mix(in srgb, var(--oui) 16%, var(--carte)); }
.coeur[aria-pressed="true"] svg { fill: var(--oui); }
.coeur:disabled { opacity: .6; }
.rappel { margin: 0; padding: 10px 13px; border-radius: 12px;
  background: color-mix(in srgb, var(--peche) 42%, transparent); }
</style>
