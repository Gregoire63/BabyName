<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { sansAccent, type Prenom } from '~/composables/useCatalogue'
import { useVerdicts, MOT } from '~/composables/useVerdicts'

/**
 * Tout ce qui se regle : la liste d'abord, le compte ensuite. C'etait
 * l'onglet « Liste », qui melangeait les deux sans le dire.
 */
const props = defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

/**
 * Chercher un prenom precis dans TOUT le catalogue.
 *
 * Les filtres de la liste ne s'appliquent pas ici, et c'est voulu : quand on
 * cherche le prenom d'une cousine ou celui qu'on vient d'entendre a la radio,
 * on veut savoir ce qu'on en a deja dit — pas se faire repondre qu'il ne
 * passe pas le filtre « 2 a 3 syllabes ».
 */
const recherche = ref('')
const { parPrenom } = useVerdicts()
const occupe = ref('')

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
  // Les plus donnes d'abord : c'est presque toujours celui qu'on cherche.
  const parFrequence = (a: Prenom, b: Prenom) => b.n - a.n
  return [...debut.sort(parFrequence), ...dedans.sort(parFrequence)].slice(0, 25)
})

const etat = (nom: string) => {
  if (g.vetos.value.has(nom)) return { t: 'Veto', c: 'veto' }
  const v = parPrenom.value.get(nom)?.mien
  if (v === undefined || v === null) return null
  return { t: MOT[v], c: `v${v}` }
}

async function choisir(nom: string, valeur: 0 | 1 | 2) {
  occupe.value = nom
  try { await g.voter(nom, valeur) } finally { occupe.value = '' }
}

const copie = ref(false)
const renomme = ref(false)
const nouveauNom = ref('')

watch(g.etat, e => { if (e && !nouveauNom.value) nouveauNom.value = e.groupe.nom },
  { immediate: true })

const lien = computed(() => g.etat.value
  ? `${location.origin}/?code=${g.etat.value.groupe.code_invitation}` : '')

const nomChange = computed(() =>
  !!nouveauNom.value.trim() && nouveauNom.value !== g.etat.value?.groupe?.nom)

async function renommer() {
  if (!nomChange.value) return
  await $fetch(`/api/groupes/${g.gid}/nom`, { method: 'PUT', body: { nom: nouveauNom.value } })
  renomme.value = true
  setTimeout(() => renomme.value = false, 1600)
  await g.recharger()
}

async function partager() {
  const donnees = { title: 'babyNames', text: 'Aide-moi à choisir un prénom', url: lien.value }
  if (navigator.share) { try { await navigator.share(donnees); return } catch { /* annulé */ } }
  await navigator.clipboard.writeText(lien.value)
  copie.value = true; setTimeout(() => copie.value = false, 1800)
}

const filtresActifs = computed(() => {
  const f = g.filtres.value
  const out: string[] = []
  if (f.sexe.length < 3) out.push(f.sexe.map(s => s === 'f' ? 'fille' : s === 'm' ? 'garçon' : 'mixte').join(' + '))
  if (f.origines_in.length) out.push('origines : ' + f.origines_in.join(', '))
  if (f.origines_out.length) out.push('sans ' + f.origines_out.join(', '))
  if (f.compose === false) out.push('pas de composés')
  if (f.syllabes[0] > 1 || f.syllabes[1] < 6) out.push(`${f.syllabes[0]}–${f.syllabes[1]} syllabes`)
  if (f.car[0] > 2 || f.car[1] < 14) out.push(`${f.car[0]}–${f.car[1]} lettres`)
  if (f.originalite[0] > 0) out.push(`originalité ≥ ${f.originalite[0]}`)
  if (f.risque_max < 100) out.push(`risque ≤ ${f.risque_max}`)
  if (f.sens_requis) out.push('sens connu')
  if (f.exclure_objet) out.push('sans homonyme objet')
  if (f.revival_seulement) out.push('revivals seulement')
  if (f.inclure_rares) out.push('prénoms très rares inclus')
  return out
})
</script>

<template>
  <div class="pile">
    <template v-if="!g.etat.value">
      <Squelette l="62%" :h="28" :r="9" />
      <Squelette l="38%" :h="13" :retard="0.05" />
      <section v-for="b in 3" :key="b" class="carte pile" aria-busy="true">
        <Squelette l="112px" :h="18" :r="8" :retard="b * 0.07" />
        <Squelette :l="`${88 - b * 10}%`" :h="13" :retard="0.05 + b * 0.07" />
        <Squelette :l="`${64 - b * 8}%`" :h="13" :retard="0.1 + b * 0.07" />
      </section>
    </template>

    <template v-else>
      <TeteListe onglet="Réglages de cette liste" />

      <section class="carte pile">
        <h2>Nom</h2>
        <div class="ligne">
          <input v-model="nouveauNom" class="champ" style="flex:1" @keyup.enter="renommer">
          <button class="btn mini" :disabled="!nomChange" @click="renommer">
            {{ renomme ? 'Fait' : 'Renommer' }}
          </button>
        </div>
      </section>

      <section class="carte degrade invit">
        <p class="mini" style="margin:0;opacity:.72">Code d’invitation</p>
        <strong class="code">{{ g.etat.value.groupe.code_invitation }}</strong>
        <button class="btn" @click="partager">
          {{ copie ? 'Lien copié' : 'Partager le lien' }}
        </button>
      </section>

      <section class="carte pile">
        <h2>Chercher un prénom</h2>
        <p class="mini doux" style="margin:0">
          Dans tout le catalogue, filtres de la liste ignorés. On vous dit ce
          que vous en avez déjà dit, et vous pouvez le changer ici.
        </p>
        <input v-model="recherche" class="champ chercher" placeholder="Louise, Gabriel…"
               autocapitalize="off" autocorrect="off" spellcheck="false">

        <p v-if="recherche.trim().length >= 2 && !trouves.length" class="mini doux"
           style="margin:0">
          Aucun prénom ne correspond.
        </p>
        <div v-for="p in trouves" :key="p.l" class="trouve">
          <button class="nom" @click="g.ouvrirFiche(p.l)">
            {{ p.l }}
            <Etincelles v-if="g.favoris.value.has(p.l)" :taille="12"
                        couleur="var(--peche)" une />
          </button>
          <span v-if="p.q" class="puce rare" :title="`${p.n} naissances en trois ans`">rare</span>
          <span v-if="etat(p.l)" class="puce" :class="etat(p.l)!.c">{{ etat(p.l)!.t }}</span>
          <BoutonsVerdict :valeur="parPrenom.get(p.l)?.mien ?? null"
                          :occupe="occupe === p.l" @choisir="choisir(p.l, $event)" />
        </div>
      </section>

      <section class="carte pile">
        <h2>Qui en est</h2>
        <div v-for="m in g.etat.value.avancement" :key="m.user_id" class="ligne">
          <span style="flex:1">{{ m.pseudo }}</span>
          <span class="mini doux">{{ m.votes }} jugés</span>
        </div>
      </section>

      <section class="carte pile">
        <div class="ligne">
          <h2 style="flex:1">Filtres</h2>
          <button class="btn btn-0 mini" @click="g.ouvrirFiltres()">Modifier</button>
        </div>
        <div v-if="filtresActifs.length" class="ligne" style="flex-wrap:wrap;gap:6px">
          <span v-for="f in filtresActifs" :key="f" class="puce">{{ f }}</span>
        </div>
        <p v-else class="mini doux" style="margin:0">
          Aucun filtre. Le swipe laisse de côté les prénoms très rares — la
          recherche ci-dessus, elle, les trouve.
        </p>
      </section>

      <p class="mini doux" style="text-align:center;margin:6px 0 0">
        Vos choix, vos gardés, vos écartés et vos vetos sont dans
        Classement · Mes choix. Votre nom et votre clé d’accès sont sur
        l’accueil, sous votre nom.
      </p>
    </template>
  </div>
</template>

<style scoped>
.invit { display: flex; flex-direction: column; align-items: center; gap: 10px;
  color: var(--encre); }
.code { font-size: 1.7rem; letter-spacing: .16em; font-weight: 700; }
.invit .btn { background: rgba(255,255,255,.72); border-color: transparent; }
.trouve { display: flex; align-items: center; gap: 8px; padding: 7px 0;
  border-top: 1px solid var(--trait); }
.trouve .nom { flex: 1; min-width: 0; text-align: left; border: 0; background: none;
  font: inherit; font-weight: 600; color: var(--texte); cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: flex; align-items: center; gap: 5px; }
.trouve .puce { font-size: .66rem; flex: none; }
.trouve .v0, .trouve .veto { background: color-mix(in srgb, var(--non) 22%, transparent); }
.trouve .v2 { background: color-mix(in srgb, var(--oui) 22%, transparent); }
/* Un prenom trouve par la recherche mais absent du swipe : sans ce marqueur
   on croit a un bug de la pile. */
.trouve .rare { background: none; border: 1px dashed var(--trait); color: var(--doux); }
</style>
