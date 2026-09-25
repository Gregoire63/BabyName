<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { tester, type VerdictNom } from '~/composables/useNomComplet'

/**
 * Tout ce qui se regle : la liste d'abord, le compte ensuite. C'etait
 * l'onglet « Liste », qui melangeait les deux sans le dire.
 */
const props = defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

// La recherche d'un prénom est partie sous la loupe du tri (FeuilleRecherche) :
// c'est là qu'on est quand on y pense.

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

/**
 * Un membre de plus n'est pas un spectateur de plus.
 *
 * « Commun » veut dire que TOUT LE MONDE a juge le prenom et que personne n'a
 * dit non (voir la vue v_matchs : `having count(*) = nombre de membres` et
 * `min(valeur) > 0`). Inviter une troisieme personne vide donc les accords
 * jusqu'a ce qu'elle ait rattrape les memes prenoms, et lui donne un droit de
 * veto de fait sur chacun.
 *
 * Ce n'est pas un defaut a cacher : c'est la regle du jeu, et elle est bonne
 * a deux. Il faut juste la dire AVANT le partage, pas la laisser decouvrir
 * par la disparition des accords.
 */
/**
 * Un observateur n'est pas un decideur.
 *
 * Toute la mecanique des accords (quorum, veto, mise en attente) ne parle que
 * des decideurs. Compter les grands-parents dedans afficherait l'avertissement
 * « vos accords passent en attente » alors que justement, non.
 */
const estObs = (m: any) => m?.role === 'observateur'
const decideurs = computed(() =>
  (g.etat.value?.avancement ?? []).filter((m: any) => !estObs(m)))
const observateurs = computed(() =>
  (g.etat.value?.avancement ?? []).filter((m: any) => estObs(m)))
// `moi` vient de la garde du serveur : il porte deja le role, inutile de le
// rechercher dans l'avancement.
const jObserve = computed(() => estObs(g.etat.value?.moi))

const nbMembres = computed(() => decideurs.value.length || 1)
const nbCommuns = computed(() => g.communs.value?.length ?? 0)
const retardataire = computed(() => {
  const av = decideurs.value
  if (av.length < 2) return null
  const tri = [...av].sort((a: any, b: any) => a.votes - b.votes)
  const dernier: any = tri[0]; const premier: any = tri[tri.length - 1]
  return premier.votes - dernier.votes >= 25 ? dernier : null
})

/**
 * « Ca donne quoi avec notre nom ? »
 *
 * La question se pose a voix haute chez tout le monde et ne se teste nulle
 * part. On a la cle de prononciation : on peut repondre. C'est le premier
 * usage payant, et il est ici plutot que sur la fiche parce qu'on renseigne
 * son nom une fois, pas a chaque prenom.
 */
const paye = computed(() => !!(g.etat.value?.groupe as any)?.paye)
const nomFamille = ref('')
const enregistre = ref(false)

watch(() => (g.etat.value?.groupe as any)?.nom_famille, (v) => {
  if (typeof v === 'string' && v !== nomFamille.value) nomFamille.value = v
}, { immediate: true })

const nomChangeF = computed(() => {
  const a = (nomFamille.value ?? '').trim()
  const b = ((g.etat.value?.groupe as any)?.nom_famille ?? '').trim()
  return a !== b
})

async function enregistrerNomFamille() {
  const gid = g.etat.value?.groupe?.id
  if (!gid) return
  try {
    await $fetch(`/api/groupes/${gid}/nom-famille`, {
      method: 'PUT', body: { nom: nomFamille.value.trim() }
    })
    enregistre.value = true
    setTimeout(() => { enregistre.value = false }, 1400)
    await g.recharger()
  } catch (err: any) {
    if (err?.data?.data?.code === 'liste_non_debloquee') g.ouvrirDebloquer()
  }
}

/**
 * On teste les accords, pas le catalogue : c'est la liste courte qui compte,
 * et 12 lignes tiennent a l'ecran sans faire defiler une page de verdicts.
 */
const essaisNom = computed<{ prenom: string; v: VerdictNom }[]>(() => {
  const nf = nomFamille.value.trim()
  if (!paye.value || nf.length < 2) return []
  const out: { prenom: string; v: VerdictNom }[] = []
  for (const c of (g.communs.value ?? []).slice(0, 12)) {
    const nom = (c as any).prenom ?? (c as any).l
    if (!nom) continue
    const v = tester(nom, nf)
    if (v) out.push({ prenom: nom, v })
  }
  // Ce qui accroche en premier : c'est la seule chose qu'on vient verifier.
  return out.sort((a, b) => Number(b.v.accroche) - Number(a.v.accroche))
})

/**
 * Le code des observateurs.
 *
 * Genere a la demande, et une seule fois : les liens deja envoyes doivent
 * continuer de marcher.
 */
const codeObs = computed(() => (g.etat.value?.groupe as any)?.code_observateur ?? null)
const demandeObs = ref(false)
const copieObs = ref(false)

async function creerCodeObs() {
  if (demandeObs.value) return
  demandeObs.value = true
  try {
    await $fetch(`/api/groupes/${g.gid}/observateurs`, { method: 'POST' })
    await g.recharger()
  } catch (err: any) {
    if (err?.statusMessage === 'liste_non_debloquee') g.ouvrirDebloquer()
  } finally { demandeObs.value = false }
}

async function partagerObs() {
  if (!codeObs.value) return
  const url = `${location.origin}/?code=${codeObs.value}`
  const texte = `Viens donner ton avis sur nos prénoms (tu ne bloques rien) : ${url}`
  try {
    if (navigator.share) await navigator.share({ text: texte, url })
    else { await navigator.clipboard.writeText(url); copieObs.value = true
           setTimeout(() => { copieObs.value = false }, 1600) }
  } catch { /* partage annule : rien a dire */ }
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
          <input v-model="nouveauNom" class="champ" style="flex:1" aria-label="Nom de la liste"
                 @keyup.enter="renommer">
          <button class="btn mini" :disabled="!nomChange" @click="renommer">
            {{ renomme ? 'Fait' : 'Renommer' }}
          </button>
        </div>
      </section>

      <section v-if="!jObserve" class="carte degrade invit">
        <p class="mini" style="margin:0;opacity:.85">
          {{ nbMembres < 2 ? 'Code d’invitation' : 'Inviter quelqu’un de plus' }}
        </p>
        <strong class="code">{{ g.etat.value.groupe.code_invitation }}</strong>
        <button class="btn" @click="partager">
          {{ copie ? 'Lien copié' : 'Partager le lien' }}
        </button>
        <p v-if="nbMembres < 2" class="mini" style="margin:0;opacity:.85;text-align:center">
          La personne que vous invitez jugera les mêmes prénoms de son côté,
          sans voir vos réponses.
        </p>
      </section>

      <!-- Dit avant le partage, pas découvert après. -->
      <section v-if="nbMembres >= 2 && !jObserve" class="carte pile avert">
        <h2>Avant d’inviter une troisième personne</h2>
        <p class="mini" style="margin:0">
          Un prénom n’est « en commun » que si <strong>tout le monde</strong>
          l’a jugé et que <strong>personne</strong> n’a dit non.
        </p>
        <p class="mini" style="margin:0">
          En ajouter une troisième remet donc vos
          <strong>{{ nbCommuns }} accord{{ nbCommuns > 1 ? 's' : '' }}</strong>
          en attente jusqu’à ce qu’elle ait jugé les mêmes prénoms — et lui
          donne un droit de veto sur chacun.
        </p>
        <p class="mini doux" style="margin:0">
          Pour un avis extérieur sans conséquence, montrez-lui plutôt vos
          accords : ils ne bougeront pas.
        </p>
      </section>

      <!-- La sortie de l'avertissement ci-dessus : montrer sans donner de veto. -->
      <section v-if="!jObserve" class="carte pile">
        <h2>Les observateurs</h2>

        <template v-if="paye">
          <p class="mini doux" style="margin:0">
            Un observateur juge les prénoms et vous voyez son avis. Il ne
            compte pas dans vos accords et ne peut pas poser de veto : vos
            {{ nbCommuns }} accord{{ nbCommuns > 1 ? 's' : '' }} ne bougent pas.
          </p>

          <template v-if="codeObs">
            <div class="ligne">
              <strong class="code petit" style="flex:1">{{ codeObs }}</strong>
              <button class="btn mini" @click="partagerObs">
                {{ copieObs ? 'Lien copié' : 'Partager' }}
              </button>
            </div>
            <p v-if="observateurs.length" class="mini doux" style="margin:0">
              {{ observateurs.map((o: any) => o.pseudo).join(', ') }}
              {{ observateurs.length > 1 ? 'observent' : 'observe' }} cette liste.
            </p>
          </template>

          <button v-else class="btn" :disabled="demandeObs" @click="creerCodeObs">
            {{ demandeObs ? 'Un instant…' : 'Créer un lien d’observateur' }}
          </button>
        </template>

        <template v-else>
          <p class="mini doux" style="margin:0">
            Montrer votre liste à vos parents sans qu'ils puissent rien
            bloquer : ils jugent, vous voyez leur avis, vos accords restent
            les vôtres.
          </p>
          <button class="btn btn-1" @click="g.ouvrirDebloquer()">
            Voir ce que ça ouvre
          </button>
        </template>
      </section>

      <section class="carte pile">
        <h2>Avec votre nom de famille</h2>

        <template v-if="paye">
          <p class="mini doux" style="margin:0">
            On lit le prénom et le nom comme on les <em>dit</em>, pas comme on
            les écrit : les voyelles qui se collent, les consonnes qui se
            mangent, les initiales qu'on n'avait pas vues.
          </p>
          <div class="ligne">
            <input v-model="nomFamille" class="champ" style="flex:1" aria-label="Nom de famille"
                   placeholder="Votre nom" autocapitalize="words"
                   autocorrect="off" spellcheck="false"
                   @keyup.enter="enregistrerNomFamille">
            <button class="btn mini" :disabled="!nomChangeF"
                    @click="enregistrerNomFamille">
              {{ enregistre ? 'Fait' : 'Tester' }}
            </button>
          </div>

          <p v-if="nomFamille.trim().length >= 2 && !essaisNom.length"
             class="mini doux" style="margin:0">
            Rien à tester tant que vous n'avez pas d'accord : le test tourne
            sur vos prénoms en commun.
          </p>

          <div v-for="e in essaisNom" :key="e.prenom" class="essai">
            <button class="nom" @click="g.ouvrirFiche(e.prenom)">
              {{ e.prenom }} {{ nomFamille.trim() }}
            </button>
            <span class="mini doux">{{ e.v.syllabes }} syll. · {{ e.v.initiales }}</span>
            <p v-for="(r, i) in e.v.remarques" :key="i" class="mini" :class="r.gravite">
              {{ r.texte }}
            </p>
            <p v-if="!e.v.remarques.length" class="mini bien">Rien à signaler.</p>
          </div>
        </template>

        <template v-else>
          <p class="mini doux" style="margin:0">
            « Ça donne quoi avec notre nom ? » — la question que tout le monde
            pose à voix haute. On sait y répondre : on a la prononciation de
            chaque prénom, donc les accroches qui ne se voient pas à l'écrit.
          </p>
          <p class="mini" style="margin:0">
            <span class="exemple">Léa Arnaud</span> accroche,
            <span class="exemple">Léa Bernard</span> coule. Rien dans
            l'orthographe ne le montre.
          </p>
          <button class="btn btn-1" @click="g.ouvrirDebloquer()">
            Voir ce que ça ouvre
          </button>
        </template>
      </section>

      <section class="carte pile">
        <h2>Qui en est</h2>
        <div v-for="m in g.etat.value.avancement" :key="m.user_id" class="ligne">
          <span style="flex:1">{{ m.pseudo }}</span>
          <span v-if="m.role === 'observateur'" class="puce">observe</span>
          <span class="mini doux">{{ m.votes }} jugés</span>
        </div>
        <p v-if="retardataire" class="mini doux" style="margin:0">
          Les accords attendent {{ retardataire.pseudo }} : un prénom
          n’apparaît qu’une fois jugé par tout le monde.
        </p>
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
          recherche, sous la loupe du swipe, les trouve.
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
.essai { display: flex; flex-direction: column; gap: 3px;
  padding: 9px 0; border-top: 1px solid var(--trait); }
.essai .nom { background: none; border: 0; padding: 0; text-align: left;
  font: inherit; font-weight: 650; color: var(--encre); cursor: pointer; }
.essai .mini { margin: 0; }
.essai .accroche { color: var(--non); }
.essai .attention { opacity: .78; }
.essai .bien { opacity: .55; }
.exemple { font-weight: 650; }
.invit { display: flex; flex-direction: column; align-items: center; gap: 10px;
  color: var(--encre); }
.code { font-size: 1.7rem; letter-spacing: .16em; font-weight: 700; }
.code.petit { font-size: 1.1rem; letter-spacing: .12em; }
.invit .btn { background: rgba(255,255,255,.72); border-color: transparent; }
.avert { border-color: color-mix(in srgb, var(--peche) 55%, var(--trait)); }
.avert h2 { color: var(--encre); }
</style>
