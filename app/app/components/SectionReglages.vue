<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { passkeysPossibles, creerPasskey } from '~/composables/usePasskey'

/**
 * Tout ce qui se regle : la liste d'abord, le compte ensuite. C'etait
 * l'onglet « Liste », qui melangeait les deux sans le dire.
 */
const props = defineProps<{ actif: boolean }>()
const g = useGroupeCourant()

// La recherche d'un prénom est partie sous la loupe du tri (FeuilleRecherche) :
// c'est là qu'on est quand on y pense.

const copie = ref(false)
const offrirOuvert = ref(false)

/**
 * Mon compte, depuis les réglages : la passkey d'abord (se connecter d'un
 * geste), le reste dans la feuille du compte — la même que sur l'accueil,
 * parce que le compte ne dépend d'aucune liste.
 */
const moi = useMoi()
const compteOuvert = ref(false)
const passkeyPossible = ref(false)
onMounted(() => { passkeyPossible.value = passkeysPossibles() })
const passkeyEnCours = ref(false)
const passkeyMessage = ref('')
async function creerPasskeyIci() {
  if (passkeyEnCours.value) return
  passkeyEnCours.value = true
  passkeyMessage.value = ''
  const r = await creerPasskey()
  passkeyEnCours.value = false
  passkeyMessage.value = r.ok ? 'Passkey créée : vous entrerez d’un geste.' : r.message
}
const renomme = ref(false)
const nouveauNom = ref('')

watch(g.etat, e => { if (e && !nouveauNom.value) nouveauNom.value = e.groupe.nom },
  { immediate: true })

const lien = computed(() => g.etat.value
  ? `${location.origin}/?code=${g.etat.value.groupe.code_invitation}` : '')

const nomChange = computed(() =>
  !!nouveauNom.value.trim() && nouveauNom.value !== g.etat.value?.groupe?.nom)

/** Les noms s'enregistrent en quittant le champ (ou par Entrée) : pas de bouton. */
async function renommer() {
  if (!nomChange.value) return
  await $fetch(`/api/groupes/${g.gid}/nom`, { method: 'PUT', body: { nom: nouveauNom.value.trim() } })
  renomme.value = true
  setTimeout(() => renomme.value = false, 1600)
  await g.recharger()
}
const quitter = (e: KeyboardEvent) => (e.target as HTMLInputElement).blur()

async function partager() {
  const donnees = { title: 'babyNamed', text: 'Aide-moi à choisir un prénom', url: lien.value }
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
 * Ici, on ne fait que SAISIR le nom, une fois pour la liste. La reponse est
 * sur chaque carte du tri (ContenuCarte), au moment ou l'on juge le prenom :
 * une liste de verdicts ici faisait doublon, et arrivait apres coup.
 */
const paye = computed(() => !!(g.etat.value?.groupe as any)?.paye)

/**
 * La carte « Débloquer cette liste ».
 *
 * L'offre ne se voyait qu'en butant sur une limite. Ici, elle se lit au calme,
 * et surtout sa PORTÉE : six euros pour cette liste-ci et ses membres, pas pour
 * l'application entière. Débloquée, la carte dit depuis quand, et que les
 * autres listes restent gratuites.
 */
const prix = (useRuntimeConfig().public.prixListe as string) || '6 €'
const INCLUS = INCLUS_DEBLOCAGE
const offerte = computed(() => !!(g.etat.value?.groupe as any)?.offert)
const cadeau = computed(() => !!(g.etat.value?.groupe as any)?.cadeau)
const cadeauDe = computed(() => (g.etat.value?.groupe as any)?.cadeau_de as string | null)
const debloqueeLe = computed(() => {
  const d = (g.etat.value?.groupe as any)?.paye_le
  return d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
})
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
  if (!gid || !nomChangeF.value) return
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
 * UNE invitation, deux facons.
 *
 * « Inviter quelqu'un » et « Les observateurs » etaient deux blocs ; c'est
 * pourtant le meme geste — envoyer un lien — avec un seul choix a faire :
 * la personne decide-t-elle avec vous, ou regarde-t-elle en lecture seule
 * (elle donne son avis, qui ne compte pas dans les accords et ne bloque rien) ?
 *
 * Le code des observateurs se genere a la demande, et une seule fois : les
 * liens deja envoyes doivent continuer de marcher.
 */
const typeInvit = ref<'membre' | 'lecture'>('membre')
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
  const texte = `Viens donner ton avis sur nos prénoms, et mettre un cœur sur ceux qu’on a en commun (tu ne bloques rien) : ${url}`
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
        <div class="ligne">
          <h2 style="flex:1">Nom</h2>
          <span class="mini doux" role="status">{{ renomme ? 'Enregistré' : '' }}</span>
        </div>
        <input v-model="nouveauNom" class="champ" aria-label="Nom de la liste" maxlength="60"
               @blur="renommer" @keyup.enter="quitter">
      </section>

      <section class="carte pile achat" :class="{ debloquee: paye }" aria-labelledby="titre-achat">
        <template v-if="!paye">
          <div class="ligne" style="align-items:baseline">
            <h2 id="titre-achat" style="flex:1">Débloquer cette liste</h2>
            <strong class="prix">{{ prix }}</strong>
          </div>
          <p class="mini" style="margin:0">
            <strong>Pour cette liste seulement</strong>, et tous ses membres. Une
            fois, sans abonnement.
          </p>
          <ul class="inclus-court">
            <li v-for="i in INCLUS" :key="i.titre">{{ i.titre }}</li>
          </ul>
          <button v-if="!jObserve" class="btn btn-1" @click="g.ouvrirDebloquer()">
            Voir le détail — {{ prix }}
          </button>
          <p v-else class="mini doux" style="margin:0">
            Un membre de la liste peut la débloquer.
          </p>
        </template>
        <template v-else>
          <h2 id="titre-achat">Liste débloquée</h2>
          <p v-if="cadeau" class="mini" style="margin:0">
            <strong>{{ cadeauDe ? `Un cadeau de ${cadeauDe}` : 'Un cadeau' }}.</strong>
          </p>
          <p class="mini doux" style="margin:0">
            {{ offerte || cadeau ? 'Offerte' : 'Débloquée' }}<template v-if="debloqueeLe"> le {{ debloqueeLe }}</template>,
            pour tous ses membres.
          </p>
          <!-- Le moment où l'on est content de ce qu'on a payé est celui où
               l'on pense aux amis qui attendent un bébé. -->
          <button type="button" class="lien mini lien-bouton" style="align-self:flex-start"
                  @click="offrirOuvert = true">
            Offrir babyNamed à d’autres futurs parents
          </button>
        </template>
      </section>

      <section v-if="!jObserve" class="carte pile invit" aria-labelledby="titre-invit">
        <h2 id="titre-invit">Inviter quelqu’un</h2>
        <div class="deux-facons" role="group" aria-label="Type d’invitation">
          <button type="button" class="facon" :aria-pressed="typeInvit === 'membre'"
                  @click="typeInvit = 'membre'">
            <strong>Pour choisir avec vous</strong>
            <span>juge les prénoms, compte dans les accords</span>
          </button>
          <button type="button" class="facon" :aria-pressed="typeInvit === 'lecture'"
                  @click="typeInvit = 'lecture'">
            <strong>En lecture seule</strong>
            <span>donne son avis, met des cœurs ; ne compte pas dans vos accords, ne bloque rien</span>
          </button>
        </div>

        <!-- Pour choisir avec vous : le code de la liste. -->
        <template v-if="typeInvit === 'membre'">
          <div class="lien-invit degrade">
            <strong class="code">{{ codeLisible(g.etat.value.groupe.code_invitation) }}</strong>
            <button class="btn" @click="partager">
              {{ copie ? 'Lien copié' : 'Partager le lien' }}
            </button>
          </div>
          <!-- Dit avant le partage, pas découvert après. -->
          <div v-if="nbMembres >= 2" class="avert pile">
            <p class="mini" style="margin:0">
              <strong>Une troisième personne compterait dans les accords</strong> :
              vos {{ nbCommuns }} accord{{ nbCommuns > 1 ? 's' : '' }} attendraient
              son avis, et elle pourrait bloquer chacun d’eux.
            </p>
            <button type="button" class="btn btn-0 mini" style="align-self:flex-start;padding-left:0"
                    @click="typeInvit = 'lecture'">
              Pour un simple avis : l’inviter en lecture seule
            </button>
          </div>
        </template>

        <!-- En lecture seule : le code des observateurs (liste débloquée). -->
        <template v-else>
          <template v-if="paye">
            <template v-if="codeObs">
              <div class="lien-invit degrade">
                <strong class="code">{{ codeLisible(codeObs) }}</strong>
                <button class="btn" @click="partagerObs">
                  {{ copieObs ? 'Lien copié' : 'Partager le lien' }}
                </button>
              </div>
            </template>
            <button v-else class="btn" :disabled="demandeObs" @click="creerCodeObs">
              {{ demandeObs ? 'Un instant…' : 'Créer le lien en lecture seule' }}
            </button>
          </template>
          <template v-else>
            <p class="mini doux" style="margin:0">Compris dans le déblocage de la liste.</p>
            <button class="btn btn-1" @click="g.ouvrirDebloquer()">
              Voir ce que ça ouvre
            </button>
          </template>
        </template>

        <p v-if="observateurs.length" class="mini doux" style="margin:0">
          En lecture seule : {{ observateurs.map((o: any) => o.pseudo).join(', ') }}
          {{ observateurs.length > 1 ? 'observent' : 'observe' }} cette liste.
        </p>
      </section>

      <CarteDejaPris />

      <section class="carte pile">
        <h2>Avec votre nom de famille</h2>

        <template v-if="paye">
          <input id="champ-nom-famille" v-model="nomFamille" class="champ" aria-label="Nom de famille"
                 placeholder="Votre nom" autocapitalize="words" maxlength="60"
                 autocorrect="off" spellcheck="false"
                 @blur="enregistrerNomFamille" @keyup.enter="quitter">
          <p class="mini doux" style="margin:0" role="status">
            {{ enregistre ? 'Enregistré : chaque carte le montre avec le prénom.' : 'Chaque carte montre le prénom avec votre nom.' }}
          </p>
        </template>

        <template v-else>
          <p class="mini" style="margin:0">
            <span class="exemple">Léa Arnaud</span> accroche,
            <span class="exemple">Léa Bernard</span> coule : chaque prénom, essayé
            avec votre nom.
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
          Les accords attendent {{ retardataire.pseudo }}.
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
        <p v-else class="mini doux" style="margin:0">Aucun filtre.</p>
      </section>

      <section class="carte pile" aria-labelledby="titre-compte">
        <h2 id="titre-compte">Mon compte</h2>
        <p class="mini doux" style="margin:0">
          {{ moi?.pseudo }}<template v-if="moi?.email"> · {{ moi.email }}</template>
          · {{ moi?.passkeys ? `${moi.passkeys} passkey${moi.passkeys > 1 ? 's' : ''}` : 'aucune passkey' }}
        </p>
        <button v-if="passkeyPossible && !moi?.passkeys" type="button" class="btn btn-1"
                :disabled="passkeyEnCours" @click="creerPasskeyIci">
          {{ passkeyEnCours ? 'Un instant…' : 'Créer une passkey' }}
        </button>
        <p v-if="passkeyMessage" class="mini" role="status" style="margin:0">{{ passkeyMessage }}</p>
        <button type="button" class="btn" @click="compteOuvert = true">
          Passkeys, e-mail, mes données
        </button>
      </section>

      <section class="carte pile" aria-labelledby="titre-theme">
        <h2 id="titre-theme">Apparence</h2>
        <ChoixTheme />
      </section>
    </template>
    <FeuilleOffrir v-if="offrirOuvert" @fermer="offrirOuvert = false" />
    <FeuilleCompte v-if="compteOuvert" @fermer="compteOuvert = false" />
  </div>
</template>

<style scoped>
.exemple { font-weight: 650; }
.lien-bouton { border: 0; background: none; padding: 0; font: inherit; cursor: pointer; }
.achat { background: linear-gradient(160deg, color-mix(in srgb, var(--menthe) 38%, var(--carte)) 0%, var(--carte) 70%); }
.achat.debloquee { background: color-mix(in srgb, var(--menthe) 26%, var(--carte)); }
.prix { font-size: 1.25rem; font-weight: 800; }
.inclus-court { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px;
  font-size: .82rem; }
.deux-facons { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.facon { display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 11px 12px;
  border: 1px solid var(--trait); border-radius: var(--r-s); background: var(--fond);
  font: inherit; color: var(--texte); cursor: pointer; }
.facon strong { font-size: .88rem; }
.facon span { font-size: .72rem; color: var(--doux); line-height: 1.3; }
.facon[aria-pressed="true"] { border-color: var(--encre); box-shadow: inset 0 0 0 1px var(--encre); }
.lien-invit { display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 16px; border-radius: var(--r-s); color: var(--encre); }
.code { font-size: clamp(1.25rem, 6.4vw, 1.7rem); letter-spacing: .12em; font-weight: 700;
  white-space: nowrap; }
.lien-invit .btn { background: rgba(255,255,255,.72); border-color: transparent; }
.avert { gap: 6px; padding: 11px 13px; border-radius: var(--r-s);
  border: 1px solid color-mix(in srgb, var(--peche) 55%, var(--trait)); }
</style>
