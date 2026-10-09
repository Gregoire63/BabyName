<script setup lang="ts">
import { paysDe } from '~/composables/usePays'
import { useGroupeCourant } from '~/composables/etatGroupe'
import { useEnregistrementDiffere, type OptionsEnvoi } from '~/composables/useEnregistrementDiffere'

/**
 * Les réglages DE LA LISTE, et rien d'autre : son nom, son déblocage, qui en
 * est, ses filtres, la quitter. Ce qui ne dépend d'aucune liste — le compte,
 * les passkeys, l'apparence, les notifications du téléphone — vit dans la
 * feuille du compte, qu'on ouvre depuis l'accueil (FeuilleCompte) : ici, on
 * les prenait pour des réglages de cette liste-ci.
 */
const props = defineProps<{ actif: boolean }>()
const g = useGroupeCourant()
const quota = computed(() => g.etat.value?.quota)

// La recherche d'un prénom est partie sous la loupe du tri (FeuilleRecherche) :
// c'est là qu'on est quand on y pense.

const copie = ref(false)
const offrirOuvert = ref(false)

const renomme = ref(false)
const nouveauNom = ref('')
const champNom = ref<HTMLInputElement | null>(null)

// Le nom du serveur remplit le champ, jamais pendant qu'on y tape.
watch(g.etat, e => {
  if (e && !nouveauNom.value && document.activeElement !== champNom.value) nouveauNom.value = e.groupe.nom
}, { immediate: true })

// /rejoindre/<code> : l'adresse que l'app des stores ouvre elle-même quand
// elle est installée (pages/rejoindre/[code].vue) ; sinon, le navigateur.
const lien = computed(() => g.etat.value
  ? `${location.origin}/rejoindre/${g.etat.value.groupe.code_invitation}` : '')

/**
 * Les noms s'enregistrent seuls, sans bouton : pendant la frappe, en quittant
 * le champ et en quittant l'écran — le blur seul laissait repartir un nom
 * quand on sortait par le bouton retour (useEnregistrementDiffere).
 */
let nomEnvoye = ''
async function renommer(o: OptionsEnvoi = {}) {
  const nom = nouveauNom.value.trim()
  if (!nom || nom === g.etat.value?.groupe?.nom || nom === nomEnvoye) return
  nomEnvoye = nom
  try {
    await $fetch(`/api/groupes/${g.gid}/nom`, { method: 'PUT', body: { nom }, keepalive: o.keepalive })
  } catch { nomEnvoye = ''; return }
  if (o.keepalive) return
  renomme.value = true
  setTimeout(() => renomme.value = false, 1600)
  await g.recharger()
}
const nomListe = useEnregistrementDiffere(renommer)
const quitter = (e: KeyboardEvent) => (e.target as HTMLInputElement).blur()

async function partager() {
  // La feuille de partage du téléphone — dans l'app des stores, c'est le
  // natif qui l'ouvre (partagerLien, useCoquille) ; à défaut, le lien copié.
  const r = await partagerLien({ titre: 'babyNamed', texte: 'Aide-moi à choisir un prénom', url: lien.value })
  if (!r.copie) return
  copie.value = true; setTimeout(() => copie.value = false, 1800)
}

/**
 * Un membre de plus n'est pas un spectateur de plus.
 *
 * « Commun » veut dire que TOUT LE MONDE a juge le prenom et que personne n'a
 * dit non (voir `accords`, dans server/utils/votes.ts : chaque decideur a une
 * entree positive). Inviter une troisieme personne vide donc les accords
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
 * Là où rien ne se vend (useVente : l'app Android, l'app iOS sans l'achat
 * de l'App Store), une liste gratuite ne montre ni l'offre, ni ce qu'elle
 * ouvrirait — le lien en lecture seule, l'essai avec le nom de famille.
 * Débloquée, où que ce soit, elle a tout.
 */
const vente = useVente()
const montrerPayant = computed(() => paye.value || vente.ouverte)

/**
 * La carte « Débloquer cette liste ».
 *
 * L'offre ne se voyait qu'en butant sur une limite. Ici, elle se lit au calme,
 * et surtout sa PORTÉE : six euros pour cette liste-ci et ses membres, pas pour
 * l'application entière. Débloquée, la carte dit depuis quand, et que les
 * autres listes restent gratuites.
 */
// Le prix du site, ou celui qu'annonce l'App Store dans l'app iOS (useVente).
const prix = computed(() => vente.prix)
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
const champFamille = ref<HTMLInputElement | null>(null)

watch(() => (g.etat.value?.groupe as any)?.nom_famille, (v) => {
  if (typeof v === 'string' && v !== nomFamille.value && document.activeElement !== champFamille.value) nomFamille.value = v
}, { immediate: true })

const nomChangeF = computed(() => {
  const a = (nomFamille.value ?? '').trim()
  const b = ((g.etat.value?.groupe as any)?.nom_famille ?? '').trim()
  return a !== b
})

let familleEnvoyee: string | null = null
async function enregistrerNomFamille(o: OptionsEnvoi = {}) {
  const gid = g.etat.value?.groupe?.id
  const nom = nomFamille.value.trim()
  if (!gid || !nomChangeF.value || nom === familleEnvoyee) return
  familleEnvoyee = nom
  try {
    await $fetch(`/api/groupes/${gid}/nom-famille`, { method: 'PUT', body: { nom }, keepalive: o.keepalive })
  } catch (err: any) {
    familleEnvoyee = null
    if (!o.keepalive && err?.data?.data?.code === 'liste_non_debloquee') g.ouvrirDebloquer()
    return
  }
  if (o.keepalive) return
  enregistre.value = true
  setTimeout(() => { enregistre.value = false }, 1400)
  await g.recharger()
}
const nomFamilleAuto = useEnregistrementDiffere(enregistrerNomFamille)

/**
 * UNE invitation, deux facons.
 *
 * « Inviter quelqu'un » et « Les observateurs » etaient deux blocs ; c'est
 * pourtant le meme geste — envoyer un lien — avec un seul choix a faire :
 * la personne decide-t-elle avec vous, ou regarde-t-elle en lecture seule
 * (elle donne son avis, qui ne compte pas dans les accords, sans veto) ?
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
  const url = `${location.origin}/rejoindre/${codeObs.value}`
  const texte = `Viens donner ton avis sur nos prénoms, et mettre un cœur sur ceux qu’on a en commun (tu n’as pas de veto) : ${url}`
  const r = await partagerLien({ texte, url })
  if (!r.copie) return
  copieObs.value = true
  setTimeout(() => { copieObs.value = false }, 1600)
}

const filtresActifs = computed(() => {
  const f = g.filtres.value
  const out: string[] = []
  if (f.sexe.length < 3) out.push(f.sexe.map(s => s === 'f' ? 'fille' : s === 'm' ? 'garçon' : 'mixte').join(' + '))
  if (f.origines_in.length) out.push('origines : ' + f.origines_in.join(', '))
  if (f.origines_out.length) out.push('sans ' + f.origines_out.join(', '))
  if (f.compose === false) out.push('pas de composés')
  if (f.syllabes[0] > 1 || f.syllabes[1] < 6) out.push(`${f.syllabes[0]} à ${f.syllabes[1]} syllabes`)
  if (f.car[0] > 2 || f.car[1] < 14) out.push(`${f.car[0]} à ${f.car[1]} lettres`)
  if (f.originalite[0] > 0) out.push(`originalité ≥ ${f.originalite[0]}`)
  if (f.risque_max < 100) out.push(`risque ≤ ${f.risque_max}`)
  if (f.sens_requis) out.push('sens connu')
  if (f.exclure_objet) out.push('sans homonyme objet')
  if (f.revival_seulement) out.push('revivals seulement')
  if (f.inclure_rares) out.push('prénoms très rares inclus')
  if (f.pays?.length && f.pays.join() !== 'fr') out.push(`pays : ${f.pays.map(c => paysDe(c)?.nom ?? c).join(', ')}`)
  return out
})

/**
 * Supprimer la liste, pour tout le monde — son propriétaire seulement.
 *
 * Même garde-fou que pour le compte (FeuilleCompte) : un mot à taper, pas un
 * « Êtes-vous sûr ? » qu'on valide par réflexe. Ici plus encore, parce que ce
 * sont aussi les votes des AUTRES qui partent : l'écran les nomme, et dit que
 * le déblocage ne se reporte pas. Le serveur le vérifie aussi
 * (groupes/[id]/supprimer.post.ts, server/utils/proprietaire.ts).
 */
const demandeSuppression = ref(false)
const confirmation = ref('')
const suppressionEnCours = ref(false)
const erreurSuppression = ref('')
const confirme = computed(() => confirmation.value.trim().toUpperCase() === 'SUPPRIMER')
const autresMembres = computed(() => {
  const noms = (g.etat.value?.membres ?? [])
    .filter((m: any) => m.user_id !== g.etat.value?.moi?.user_id)
    .map((m: any) => m.pseudo as string)
  return noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}` : (noms[0] ?? '')
})

function annulerSuppression() {
  demandeSuppression.value = false
  confirmation.value = ''
  erreurSuppression.value = ''
}

async function supprimerListe() {
  if (!confirme.value || suppressionEnCours.value) return
  suppressionEnCours.value = true
  erreurSuppression.value = ''
  try {
    await $fetch(`/api/groupes/${g.gid}/supprimer`, { method: 'POST', body: { confirmation: 'SUPPRIMER' } })
    oublierListe(String(g.gid))
    await navigateTo('/')
  } catch (err: any) {
    erreurSuppression.value = err?.statusMessage === 'reserve_au_proprietaire'
      ? 'Seul le propriétaire de la liste peut la supprimer.'
      : 'La suppression n’a pas abouti. Rien n’a été effacé ; réessayez dans un instant.'
    suppressionEnCours.value = false
    await g.recharger().catch(() => null)
  }
}

/**
 * Le propriétaire : celui qui a créé la liste ; s'il la quitte, le plus
 * ancien de ceux qui décident (server/utils/proprietaire.ts). Lui seul la
 * supprime pour tous ; chacun peut la quitter.
 */
const moiId = computed(() => g.etat.value?.moi?.user_id ?? '')
const proprietaireId = computed(() => (g.etat.value as any)?.proprietaire ?? null)
const jeSuisProprietaire = computed(() => !!moiId.value && proprietaireId.value === moiId.value)
/** Qui reprendrait la liste si le propriétaire partait : le plus ancien des autres qui décident. */
const successeur = computed(() => (g.etat.value?.membres ?? [])
  .find((m: any) => m.role !== 'observateur' && m.user_id !== moiId.value)?.pseudo as string | undefined)
/** Partir laisse-t-il quelqu'un pour décider ? Sinon, quitter reviendrait à supprimer. */
const peutQuitter = computed(() => !jeSuisProprietaire.value || !!successeur.value)

/**
 * Quitter la liste : ses votes partent, la liste reste aux autres.
 *
 * Moins grave que supprimer (les autres ne perdent rien), mais irréversible
 * pour soi : deux gestes, et l'écran dit ce qui part. Pas de mot à taper.
 */
const demandeQuitter = ref(false)
const quitterEnCours = ref(false)
const erreurQuitter = ref('')
const mesDejaPris = computed(() => (g.etat.value as any)?.deja_pris?.some((d: any) => d.mien) ?? false)

async function quitterListe() {
  if (quitterEnCours.value) return
  quitterEnCours.value = true
  erreurQuitter.value = ''
  try {
    await $fetch(`/api/groupes/${g.gid}/quitter`, { method: 'POST', body: { confirmation: 'QUITTER' } })
    oublierListe(String(g.gid))
    await navigateTo('/')
  } catch {
    erreurQuitter.value = 'Ça n’a pas marché : vous êtes toujours dans la liste. Réessayez dans un instant.'
    quitterEnCours.value = false
  }
}
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
        <input v-if="!jObserve" ref="champNom" v-model="nouveauNom" class="champ" aria-label="Nom de la liste"
               maxlength="60" @input="nomListe.planifier" @blur="nomListe.maintenant()" @keyup.enter="quitter">
        <p v-else style="margin:0;font-weight:700">{{ g.etat.value.groupe.nom }}</p>
      </section>

      <section v-if="montrerPayant" class="carte pile achat" :class="{ debloquee: paye }" aria-labelledby="titre-achat">
        <template v-if="!paye">
          <div class="ligne" style="align-items:baseline">
            <h2 id="titre-achat" style="flex:1">Débloquer cette liste</h2>
            <strong class="prix">{{ prix }}</strong>
          </div>
          <p class="mini" style="margin:0">
            <strong>Débloque cette liste pour la vie</strong>, pour tous ses
            membres.
          </p>
          <p class="quota-compare">
            <span>Gratuit : {{ quota?.limite_jour ?? 15 }} swipes par jour</span>
            <strong>Débloquée : illimité</strong>
          </p>
          <ul class="inclus-court">
            <li v-for="i in INCLUS" :key="i.titre">{{ i.titre }}</li>
          </ul>
          <button v-if="!jObserve" class="btn btn-1" @click="g.ouvrirDebloquer()">
            Voir le détail ({{ prix }})
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
          <button v-if="vente.cadeaux" type="button" class="lien mini lien-bouton" style="align-self:flex-start"
                  @click="offrirOuvert = true">
            Offrir babyNamed à d’autres futurs parents
          </button>
        </template>
      </section>

      <section v-if="!jObserve" class="carte pile invit" aria-labelledby="titre-invit">
        <h2 id="titre-invit">Inviter quelqu’un</h2>
        <div v-if="montrerPayant" class="deux-facons" role="group" aria-label="Type d’invitation">
          <button type="button" class="facon" :aria-pressed="typeInvit === 'membre'"
                  @click="typeInvit = 'membre'">
            <strong>Pour choisir avec vous</strong>
            <span>juge les prénoms, compte dans les accords</span>
          </button>
          <button type="button" class="facon" :aria-pressed="typeInvit === 'lecture'"
                  @click="typeInvit = 'lecture'">
            <strong>En lecture seule</strong>
            <span>donne son avis, met des cœurs ; ne compte pas dans vos accords, n’a pas de veto</span>
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
              son avis, et un « non » de sa part suffirait à défaire chacun d’eux.
            </p>
            <button v-if="montrerPayant" type="button" class="btn btn-0 mini" style="align-self:flex-start;padding-left:0"
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

      <section v-if="montrerPayant" class="carte pile">
        <h2>Avec votre nom de famille</h2>

        <template v-if="paye">
          <input id="champ-nom-famille" ref="champFamille" v-model="nomFamille" class="champ" aria-label="Nom de famille"
                 placeholder="Votre nom" autocapitalize="words" maxlength="60"
                 autocorrect="off" spellcheck="false"
                 @input="nomFamilleAuto.planifier" @blur="nomFamilleAuto.maintenant()" @keyup.enter="quitter">
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
          <span v-if="m.user_id === proprietaireId" class="puce">propriétaire</span>
          <span v-if="m.role === 'observateur'" class="puce">observe</span>
          <span class="mini doux">{{ m.votes }} {{ pluriel(m.votes, 'jugé', 'jugés') }}</span>
        </div>
        <p v-if="retardataire" class="mini doux" style="margin:0">
          Les accords attendent {{ retardataire.pseudo }}.
        </p>
      </section>

      <section class="carte pile">
        <div class="ligne">
          <h2 style="flex:1">Filtres</h2>
          <button v-if="!jObserve" class="btn btn-0 mini" @click="g.ouvrirFiltres()">Modifier</button>
        </div>
        <div v-if="filtresActifs.length" class="ligne" style="flex-wrap:wrap;gap:6px">
          <span v-for="f in filtresActifs" :key="f" class="puce">{{ f }}</span>
        </div>
        <p v-else class="mini doux" style="margin:0">Aucun filtre.</p>
      </section>

      <section class="carte pile" aria-label="Quitter ou supprimer cette liste">
        <template v-if="peutQuitter">
          <button v-if="!demandeQuitter" type="button" class="btn btn-0 mini danger"
                  style="align-self:flex-start" @click="demandeQuitter = true; demandeSuppression = false">
            Quitter cette liste
          </button>
          <div v-else class="pile suppression" role="group" aria-labelledby="titre-quitter-liste">
            <p id="titre-quitter-liste" class="mini" style="margin:0">
              <strong>Vous quittez « {{ g.etat.value.groupe.nom }} »</strong> : ce que vous y avez donné
              (votes, vetos, favoris, commentaires) est effacé. Les autres membres gardent la liste<template
                v-if="jeSuisProprietaire && successeur">, et {{ successeur }} en devient propriétaire</template>.
              <template v-if="mesDejaPris">Les prénoms « déjà pris » que vous avez ajoutés y restent, sans votre nom.</template>
            </p>
            <p v-if="erreurQuitter" class="mini" role="alert" style="color:var(--non);margin:0">
              {{ erreurQuitter }}
            </p>
            <div class="ligne">
              <button type="button" class="btn mini btn-danger" :disabled="quitterEnCours" @click="quitterListe">
                {{ quitterEnCours ? 'Un instant…' : 'Quitter la liste' }}
              </button>
              <button type="button" class="btn btn-0 mini doux"
                      @click="demandeQuitter = false; erreurQuitter = ''">Annuler</button>
            </div>
          </div>
        </template>

        <template v-if="jeSuisProprietaire">
        <button v-if="!demandeSuppression" type="button" class="btn btn-0 mini danger"
                style="align-self:flex-start" @click="demandeSuppression = true; demandeQuitter = false">
          Supprimer cette liste
        </button>

        <div v-else class="pile suppression" role="group" aria-labelledby="titre-suppression-liste">
          <p id="titre-suppression-liste" class="mini" style="margin:0">
            <strong>Suppression définitive et immédiate</strong> de « {{ g.etat.value.groupe.nom }} »,
            pour tous ses membres<template v-if="autresMembres">, {{ autresMembres }} compris</template> :
            tous les votes, vetos, favoris et commentaires, et les prénoms « déjà pris ».
            <template v-if="paye">Son déblocage part avec elle : il ne se reporte sur aucune autre liste.</template>
          </p>
          <label for="liste-confirmation" class="mini">
            Pour confirmer, tapez <strong>SUPPRIMER</strong>
          </label>
          <!-- Pas de v-model : le bouton se dégrise dès le mot écrit (utils/frappe.ts). -->
          <input id="liste-confirmation" :value="confirmation" class="champ" autocomplete="off"
                 autocapitalize="characters" spellcheck="false"
                 @input="confirmation = frappe($event)" @keyup.enter="supprimerListe">
          <p v-if="erreurSuppression" class="mini" role="alert" style="color:var(--non);margin:0">
            {{ erreurSuppression }}
          </p>
          <div class="ligne">
            <button type="button" class="btn mini btn-danger" :disabled="!confirme || suppressionEnCours"
                    @click="supprimerListe">
              {{ suppressionEnCours ? 'Suppression…' : 'Supprimer définitivement' }}
            </button>
            <button type="button" class="btn btn-0 mini doux" @click="annulerSuppression">Annuler</button>
          </div>
        </div>
        </template>
      </section>
    </template>
    <FeuilleOffrir v-if="offrirOuvert" @fermer="offrirOuvert = false" />
  </div>
</template>

<style scoped>
.exemple { font-weight: 650; }
.lien-bouton { border: 0; background: none; padding: 0; font: inherit; cursor: pointer; }
.achat { background: linear-gradient(160deg, color-mix(in srgb, var(--menthe) 38%, var(--carte)) 0%, var(--carte) 70%); }
.achat.debloquee { background: color-mix(in srgb, var(--menthe) 26%, var(--carte)); }
.prix { font-size: 1.25rem; font-weight: 800; }
.quota-compare { margin: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline;
  font-size: .85rem; }
.quota-compare span { color: var(--doux); text-decoration: line-through; }
.quota-compare strong { color: var(--encre); }
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
/* Les mêmes que la suppression du compte (FeuilleCompte). */
.danger { color: var(--non); padding-left: 0; }
.suppression { padding: 12px 14px; border-radius: var(--r-s);
  border: 1px solid color-mix(in srgb, var(--non) 45%, var(--trait)); gap: 10px; }
.btn-danger { background: var(--non); border-color: var(--non); color: var(--fond); }
</style>
