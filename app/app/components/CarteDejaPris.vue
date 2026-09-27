<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { sansAccent, type Prenom } from '~/composables/useCatalogue'

/**
 * « Déjà pris » : les prénoms que la liste retire du jeu, en le disant.
 *
 * La famille, les amis, quelqu'un qu'on connaît trop. On les connaît AVANT de
 * trier : attendre qu'ils passent en carte pour les bloquer un par un
 * n'avait pas de sens. Ici on les tape, une fois, et ils ne passent plus —
 * pour personne, graphies comprises.
 *
 * Visible de toute la liste (observateurs compris : ils ne les verront pas
 * passer, autant qu'ils sachent pourquoi), avec qui l'a ajouté et sa note.
 * Chaque décideur peut en remettre un en jeu ; celui d'un autre demande une
 * confirmation, parce que c'est SA cousine qu'on retire.
 */
const g = useGroupeCourant()
const jObserve = computed(() => g.etat.value?.moi?.role === 'observateur')

const saisie = ref('')
const choisi = ref<Prenom | null>(null)
const note = ref('')
const envoi = ref(false)
const erreur = ref('')
const statut = ref('')
const retrait = ref('')
const aConfirmer = ref('')
const champNom = ref<HTMLInputElement>()
const champNote = ref<HTMLInputElement>()

/** Ce qui ne passe déjà plus : pas la peine de le proposer. */
const retire = (nom: string) => g.parDejaPris.value.has(nom) ? 'déjà pris'
  : g.vetos.value.has(nom) ? 'bloqué' : null

/**
 * Six propositions au plus, UNE par prononciation : Mathéo, Mattéo et Matéo
 * partent ensemble de toute façon, les proposer trois fois ne faisait que
 * cacher Mathis et Mathilde. Chaque groupe est représenté par la graphie
 * tapée si elle existe telle quelle (la cousine s'écrit Matteo), sinon par
 * la plus donnée.
 */
const suggestions = computed<Prenom[]>(() => {
  if (choisi.value) return []
  const tape = saisie.value.trim().toLowerCase()
  const r = sansAccent(tape).replace(/[^a-z]/g, '')
  if (r.length < 2) return []
  const exacts: Prenom[] = []
  const debut: Prenom[] = []
  const dedans: Prenom[] = []
  for (const p of g.catalogue.value) {
    if (p.l.toLowerCase() === tape) exacts.push(p)
    else if (p.slug.startsWith(r)) debut.push(p)
    else if (p.slug.includes(r)) dedans.push(p)
  }
  // Les plus donnés d'abord : c'est presque toujours celui qu'on cherche.
  const parFrequence = (a: Prenom, b: Prenom) => b.n - a.n
  const vus = new Set<number>()
  const out: Prenom[] = []
  for (const p of [...exacts, ...debut.sort(parFrequence), ...dedans.sort(parFrequence)]) {
    if (vus.has(p.gp)) continue
    vus.add(p.gp)
    out.push(p)
    if (out.length === 6) break
  }
  return out
})

// Retaper le nom défait le choix : on ne garde pas « Louise » sous « Lou ».
watch(saisie, s => { if (choisi.value && s !== choisi.value.l) choisi.value = null })

function choisir(p: Prenom) {
  if (retire(p.l)) return
  choisi.value = p
  saisie.value = p.l
  erreur.value = ''
  nextTick(() => champNote.value?.focus())
}

/** Entrée dans le champ du nom : le prénom exact s'il existe, sinon le seul
 *  proposé. */
function entree() {
  const t = saisie.value.trim().toLowerCase()
  const exact = g.catalogue.value.find(p => p.l.toLowerCase() === t)
  const p = exact ?? (suggestions.value.length === 1 ? suggestions.value[0] : null)
  if (p) choisir(p)
}

const nbGraphies = (n: number) => `+ ${n} graphie${n > 1 ? 's' : ''}`

async function ajouter() {
  const p = choisi.value
  if (!p || envoi.value) return
  envoi.value = true
  erreur.value = ''
  try {
    await g.ajouterDejaPris(p.l, note.value.trim() || undefined)
    const n = g.graphiesDe(p.l).length
    statut.value = n ? `${p.l} et ${n > 1 ? `ses ${n} graphies` : 'sa graphie'} ne passeront plus.`
      : `${p.l} ne passera plus.`
    saisie.value = ''
    note.value = ''
    choisi.value = null
    nextTick(() => champNom.value?.focus())
  } catch (e: any) {
    const code = e?.data?.statusMessage
    erreur.value = code === 'deja_pris' ? `${p.l} est déjà retiré du jeu.`
      : code === 'deja_pris_plein' ? 'Cette liste a déjà deux cents prénoms « déjà pris ».'
      : code === 'trop_d_essais' ? 'Beaucoup de prénoms d’un coup : réessayez dans un moment.'
      : 'Rien n’a pu être enregistré. Réessayez.'
  } finally { envoi.value = false }
}

async function retirer(d: { prenom: string; mien: boolean }) {
  if (!d.mien && aConfirmer.value !== d.prenom) { aConfirmer.value = d.prenom; return }
  aConfirmer.value = ''
  retrait.value = d.prenom
  try {
    await g.retirerDejaPris(d.prenom)
    statut.value = `${d.prenom} revient dans le tri.`
  } catch { erreur.value = 'Rien n’a pu être enregistré. Réessayez.' }
  finally { retrait.value = '' }
}
</script>

<template>
  <section v-if="!jObserve || g.dejaPris.value.length" class="carte pile"
           aria-labelledby="titre-deja-pris">
    <h2 id="titre-deja-pris">Déjà pris</h2>
    <p v-if="!jObserve" class="mini doux" style="margin:0">
      Celui de la cousine, du fils des amis : il sort du tri pour toute la liste.
    </p>

    <div v-if="!jObserve" class="ajout">
      <input id="champ-deja-pris" ref="champNom" v-model="saisie" class="champ"
             aria-label="Ajouter un prénom déjà pris" placeholder="Ajouter un prénom : Louise, Mathéo…"
             autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false"
             enterkeyhint="next" @keydown.enter.prevent="entree">
      <ul v-if="suggestions.length" class="suggestions" aria-label="Prénoms qui correspondent">
        <li v-for="p in suggestions" :key="p.l">
          <button v-if="!retire(p.l)" type="button" class="suggestion" @click="choisir(p)">
            <span class="nom">{{ p.l }}</span>
            <span v-if="p.variantes?.length" class="graphies">{{ nbGraphies(p.variantes.length) }}</span>
          </button>
          <div v-else class="suggestion inerte">
            <span class="nom">{{ p.l }}</span>
            <span class="puce">{{ retire(p.l) }}</span>
          </div>
        </li>
      </ul>
      <p v-else-if="!choisi && saisie.trim().length >= 2" class="mini doux" style="margin:0">
        Aucun prénom du catalogue ne correspond : celui-là ne passera de toute façon pas.
      </p>
      <template v-if="choisi">
        <p v-if="choisi.variantes?.length" class="mini doux" style="margin:0">
          Avec {{ choisi.variantes.length > 1 ? 'ses graphies' : 'sa graphie' }} :
          {{ choisi.variantes.slice(0, 6).join(', ') }}{{ choisi.variantes.length > 6 ? '…' : '.' }}
        </p>
        <div class="ligne">
          <input ref="champNote" v-model="note" class="champ" style="flex:1" maxlength="200"
                 aria-label="Qui le porte ? (facultatif, visible de toute la liste)"
                 placeholder="Qui le porte ? (facultatif)" enterkeyhint="done"
                 @keyup.enter="ajouter">
          <button class="btn btn-1 mini" :disabled="envoi" @click="ajouter">
            {{ envoi ? '…' : 'Ajouter' }}
          </button>
        </div>
      </template>
    </div>

    <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
    <p class="mini doux statut" role="status">{{ statut }}</p>

    <ul v-if="g.dejaPris.value.length" class="pris" aria-label="Prénoms déjà pris">
      <li v-for="d in g.dejaPris.value" :key="d.prenom" class="rangee">
        <div class="quoi">
          <button type="button" class="nom" @click="g.ouvrirFiche(d.prenom)">{{ d.prenom }}</button>
          <span v-if="d.variantes.length" class="graphies" :title="d.variantes.join(', ')">
            {{ nbGraphies(d.variantes.length) }}</span>
          <span class="qui">
            <template v-if="d.motif">{{ d.motif }} · </template>{{ d.mien ? 'vous' : (d.auteur ?? 'un ancien membre') }}
          </span>
        </div>
        <button v-if="!jObserve" class="btn btn-0 mini" :class="{ doux: aConfirmer !== d.prenom }"
                :disabled="retrait === d.prenom"
                :aria-label="aConfirmer === d.prenom ? `Confirmer : remettre ${d.prenom} en jeu`
                  : `Remettre ${d.prenom} en jeu`"
                @click="retirer(d)">
          {{ retrait === d.prenom ? '…' : aConfirmer === d.prenom ? 'Confirmer' : 'Retirer' }}
        </button>
      </li>
    </ul>
    <p v-else-if="!jObserve" class="mini doux" style="margin:0">
      Aucun pour l’instant.
    </p>

  </section>
</template>

<style scoped>
.ajout { display: flex; flex-direction: column; gap: 8px; }
.suggestions { list-style: none; margin: 0; padding: 0; }
.suggestions li + li { border-top: 1px solid var(--trait); }
.suggestion { width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 2px;
  border: 0; background: none; font: inherit; color: var(--texte); text-align: left;
  cursor: pointer; border-radius: 10px; }
.suggestion:active { background: var(--fond); }
.suggestion .nom { flex: 1; font-weight: 650; }
.suggestion.inerte { cursor: default; opacity: .7; }
.suggestion .puce { font-size: .66rem; background: color-mix(in srgb, var(--non) 22%, transparent); }
.graphies { font-size: .7rem; color: var(--doux); white-space: nowrap; }
.statut { margin: 0; }
/* Vide, elle ne doit pas creuser d'espace — mais rester une région vivante :
   masquée à l'œil, pas au lecteur d'écran. */
.statut:empty { position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); }
.pris { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.rangee { display: flex; align-items: center; gap: 8px; padding: 8px 0; }
.rangee + .rangee { border-top: 1px solid var(--trait); }
.quoi { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 6px; }
.quoi .nom { border: 0; background: none; padding: 0; font: inherit; font-weight: 650;
  color: var(--texte); cursor: pointer; text-align: left; }
.qui { flex-basis: 100%; font-size: .74rem; color: var(--doux); }
</style>
