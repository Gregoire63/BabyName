<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { StatutPaiement } from '~/composables/etatGroupe'
import { t, locale, aTexte } from '~/composables/useLangue'
import { prixLocal, mentionTvaLocale } from '~/utils/offre'
/**
 * Ce que l'achat apporte, dit en entier avant de payer.
 *
 * Deux règles pour cet écran. Il ne promet que ce qui existe — une fonction
 * annoncée et absente se paie en remboursements et en confiance perdue. Et il
 * dit ce qui reste gratuit : quelqu'un qui croit qu'on lui reprend ce qu'il
 * avait n'achète pas, il s'en va.
 *
 * Aucun numéro de carte ne passe par ici. On demande une page de paiement à
 * Stripe et on y envoie ; c'est lui qui encaisse.
 *
 * DANS L'APP iOS, c'est Apple qui encaisse (useVente, useAchatApple), et
 * l'écran change sur quatre points : le prix est celui qu'annonce l'App
 * Store ; la mention de TVA du vendeur disparaît (Apple facture la sienne) ;
 * pas de case d'accord (l'achat se fait aux conditions d'Apple, sur sa
 * feuille) ; pas de code cadeau (une clé de licence, pour Apple). Le site et
 * son prix n'y sont jamais nommés.
 *
 * UN DÉBLOCAGE D'AVANCE. Un achat fait dans l'app iPhone pour une liste que
 * quelqu'un d'autre venait de débloquer n'a servi à rien : il attend la
 * suivante (server/utils/apple.ts). Qui en a un le lit ici — le bouton ne
 * porte plus de prix, rien n'est demandé, et le serveur s'en sert avant toute
 * caisse, sur le site comme dans l'app.
 */
const g = useGroupeCourant()
const emit = defineEmits<{ fermer: [] }>()
const { ouvrir: ouvrirLegal } = useFeuilleLegale()

const vente = useVente()
const parApple = computed(() => vente.moyen === 'apple')
// Le prix du site à la manière de la langue ; celui d'Apple tel qu'Apple le formule.
const prix = computed(() => parApple.value ? vente.prix : prixLocal(vente.prix))

const envoi = ref(false)
const erreur = ref('')

/**
 * L'accord avant paiement.
 *
 * Un contenu numerique livre sur-le-champ ne se retracte pas — a condition
 * que l'acheteur l'ait demande expressement et ait reconnu perdre son droit de
 * retractation (art. L221-28 13°). Une case jamais pre-cochee, que le serveur
 * exige aussi (sinon un appel direct la contournerait), et que la facture
 * confirme ensuite par e-mail.
 */
const accord = ref(false)
const tva = computed(() => mentionTvaLocale())

/**
 * LE BOUTON DE PAIEMENT N'EST JAMAIS GRISÉ.
 *
 * Il l'était tant que la case n'était pas cochée — et la case vivait en bas du
 * texte, hors de l'écran : on voyait un bouton mort, sans savoir pourquoi. La
 * case est désormais juste au-dessus du bouton, et le bouton répond toujours :
 * sans la case, il la montre (contour rouge, phrase, focus) au lieu de payer.
 * La règle ne change pas — sans accord, rien ne part, et le serveur l'exige
 * aussi (consentement_requis).
 */
const accordManque = ref(false)
const caseAccord = ref<HTMLInputElement>()
watch(accord, (v) => { if (v) accordManque.value = false })

const membres = computed(() => g.etat.value?.avancement?.length ?? 1)

const INCLUS = INCLUS_DEBLOCAGE
const nomListe = computed(() => g.etat.value?.groupe?.nom ?? t('FeuilleDebloquer.cetteListe'))
// Les chiffres du gratuit viennent de la liste elle-meme : une liste offerte
// plus large ne doit pas afficher les limites par defaut.
const quota = computed(() => g.etat.value?.quota)
const GRATUIT = computed(() => [
  t('FeuilleDebloquer.gratuitSwipes', { depart: quota.value?.depart?.limite ?? 150, jour: quota.value?.limite_jour ?? 15 }),
  t('FeuilleDebloquer.gratuitPrenoms'),
  t('FeuilleDebloquer.gratuitAccords'),
  t('FeuilleDebloquer.gratuitFiche'),
  t('FeuilleDebloquer.gratuitVeto'),
  t('FeuilleDebloquer.gratuitParent')
])

/**
 * En developpement, Stripe n'est pas branche : un raccourci debloque la liste
 * locale (outils-dev/OutilsDebloquer.vue). Importe seulement si
 * `import.meta.dev` : absent du build de production.
 */
const OutilsDev = import.meta.dev
  ? defineAsyncComponent(() => import('~/outils-dev/OutilsDebloquer.vue')) : null

/**
 * Un code cadeau, pour CETTE liste. Replié : l'écran vend d'abord ; qui a
 * reçu un code le cherche, et le trouve sous le bouton.
 */
const cadeauOuvert = ref(false)
const codeCadeau = ref('')
const envoiCadeau = ref(false)
const erreurCadeau = ref('')
const merciCadeau = ref('')
const champCadeau = ref<HTMLInputElement>()
function ouvrirCadeau() {
  cadeauOuvert.value = true
  nextTick(() => champCadeau.value?.focus())
}
async function utiliserCadeau(fermer: () => void) {
  const code = normaliserCodeCadeau(codeCadeau.value)
  if (!code) { erreurCadeau.value = t('FeuilleDebloquer.cadeauFormat'); return }
  if (envoiCadeau.value) return
  envoiCadeau.value = true; erreurCadeau.value = ''
  try {
    await $fetch('/api/cadeaux/utiliser', { method: 'POST', body: { code, groupe: Number(g.gid) } })
    await g.recharger()
    const de = g.etat.value?.groupe?.cadeau_de
    merciCadeau.value = de ? t('FeuilleDebloquer.merciDe', { de }) : t('FeuilleDebloquer.merci')
    setTimeout(fermer, 1600)
  } catch (e: any) {
    const m = e?.data?.statusMessage
    erreurCadeau.value = m && aTexte(`FeuilleDebloquer.erreurCadeau_${m}`)
      ? t(`FeuilleDebloquer.erreurCadeau_${m}`)
      : t('FeuilleDebloquer.erreurCadeau')
  } finally { envoiCadeau.value = false }
}

/**
 * Deux parents, un seul achat. Tant que la feuille est ouverte, on relit
 * l'etat du paiement : l'autre a ouvert sa page de paiement → on le dit et on
 * ne laisse pas payer une seconde fois ; il a paye → la liste se debloque ici
 * aussi, toute seule, et la feuille se ferme.
 */
const statut = ref<StatutPaiement | null>(null)
const payeeParAutre = ref(false)
const autreEnCours = computed(() => statut.value?.en_cours && !statut.value.en_cours.moi
  ? statut.value.en_cours : null)
/** J'ai un déblocage déjà payé qui attend une liste : celle-ci le prendra. */
const avance = computed(() => !!statut.value?.avance && !payeeParAutre.value)
const heure = (iso: string | null | undefined) => iso
  ? new Date(iso).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' }) : ''
async function relireStatut() {
  const s = await g.verifierPaiement()
  if (!s) return
  statut.value = s
  if (s.paye && !payeeParAutre.value) {
    // Mon propre achat, confirmé pendant que la feuille était ouverte (payé
    // ailleurs, ou validé après coup) : le bandeau de la liste le dit déjà.
    if (s.par_moi) { emit('fermer'); return }
    payeeParAutre.value = true
    setTimeout(() => emit('fermer'), 2200)
  }
}
let sondage: any = null
// Pas pendant mon propre achat : la liste se débloque AVANT que la feuille
// d'Apple ait rendu la main, et l'on m'annoncerait un instant que « quelqu'un »
// (moi) vient de la débloquer. L'achat dira lui-même comment il a fini.
onMounted(() => { relireStatut(); sondage = setInterval(() => { if (!envoi.value) relireStatut() }, 4000) })
onUnmounted(() => clearInterval(sondage))

/**
 * Un achat resté en suspens — il attendait l'accord d'un tiers — vient d'être
 * confirmé pendant que la feuille est ouverte (useAchatApple) : la liste le
 * dit par son bandeau, la feuille n'a plus rien à vendre.
 */
function auDeblocage(e: Event) {
  if (Number((e as CustomEvent).detail?.groupe) === Number(g.gid)) emit('fermer')
}
onMounted(() => window.addEventListener('babynamed:debloquee', auDeblocage))
onUnmounted(() => window.removeEventListener('babynamed:debloquee', auDeblocage))

/** L'achat par l'App Store (app iOS) : la feuille d'Apple, puis le serveur. */
const attenteAccord = ref(false)
async function acheterDansLApp() {
  envoi.value = true; erreur.value = ''; attenteAccord.value = false
  try {
    const r = await acheterAvecApple(g.gid)
    if (r.etat === 'debloquee') {
      await g.recharger().catch(() => null)
      g.annoncerPaiement('ok'); emit('fermer')
    } else if (r.etat === 'avance') {
      const s = await g.verifierPaiement()
      await g.recharger().catch(() => null)
      g.annoncerPaiement('avance', s?.par ?? null); emit('fermer')
    } else if (r.etat === 'lent') {
      g.annoncerPaiement('lent-app'); emit('fermer')
    } else if (r.etat === 'en_cours') {
      await relireStatut()
    } else if (r.etat === 'en_suspens') {
      erreur.value = t('FeuilleDebloquer.enSuspens')
    } else if (r.etat === 'attente') {
      attenteAccord.value = true
    } else if (r.etat === 'erreur') {
      erreur.value = r.code === 'paiement_non_configure' || r.code === 'vente_fermee'
        ? t('FeuilleDebloquer.achatFerme')
        : r.code === 'achat_refuse'
          ? t('FeuilleDebloquer.achatRefuse')
          : t('FeuilleDebloquer.achatIndispo')
    }
    // (« annule » : la feuille d'Apple refermée — rien à dire.)
  } finally {
    envoi.value = false
  }
}

async function payer() {
  if (envoi.value) return
  if (parApple.value) return acheterDansLApp()
  // Un déblocage d'avance ne s'achète pas : pas d'accord à donner.
  if (!accord.value && !avance.value) {
    accordManque.value = true
    await nextTick()
    caseAccord.value?.focus()
    try { navigator.vibrate?.(25) } catch { /* pas de vibreur : le contour suffit */ }
    return
  }
  envoi.value = true; erreur.value = ''
  try {
    const r = await $fetch<any>(`/api/groupes/${g.gid}/paiement`,
      { method: 'POST', body: { consentement: accord.value } })
    if (r?.avance) {
      await g.recharger().catch(() => null)
      g.annoncerPaiement('ok'); emit('fermer'); return
    }
    if (r?.deja) { await relireStatut(); return }
    if (r?.url) { window.location.href = r.url; return }
    erreur.value = t('FeuilleDebloquer.paiementPasOuvert')
  } catch (e: any) {
    const code = e?.statusMessage ?? e?.data?.statusMessage
    if (code === 'paiement_en_cours') { await relireStatut(); return }
    // L'avance annoncée n'existait plus (Apple l'a remboursée entre-temps) :
    // l'état relu ne la montre plus, et la case d'accord revient.
    if (code === 'consentement_requis') await relireStatut()
    erreur.value = code === 'paiement_non_configure' || code === 'vente_fermee'
      ? t('FeuilleDebloquer.paiementFerme')
      : code === 'consentement_requis'
        ? t('FeuilleDebloquer.consentement')
        : t('FeuilleDebloquer.paiementIndispo')
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <Feuille :titre="$t('FeuilleDebloquer.titre')" @fermer="emit('fermer')">
    <!-- Le prix d'Apple se montre tel qu'Apple le formule : il sait, lui, si
         ce pays affiche ses prix taxes comprises. -->
    <p style="margin:0 0 4px">
      <strong style="font-size:1.3rem">{{ avance ? $t('FeuilleDebloquer.dejaPaye') : parApple ? prix : $t('FeuilleDebloquer.ttc', { prix }) }}</strong>
      <span class="doux">{{ $t('FeuilleDebloquer.pourLaVie') }}</span>
    </p>
    <p v-if="!parApple && !avance" class="mini doux" style="margin:0 0 6px">{{ tva }}.</p>
    <!-- Ce qu'on achète, sans ambiguïté : UNE liste, pas l'app. Quelqu'un qui
         croit tout débloquer, puis crée une seconde liste, se sent floué. -->
    <p class="portee mini" style="margin:0 0 16px">
      {{ $t('FeuilleDebloquer.porteeA') }} <strong>{{ $t('FeuilleDebloquer.porteeNom', { nom: nomListe }) }}</strong>{{ $t('FeuilleDebloquer.porteePour', { n: membres }) }}
      {{ $t('FeuilleDebloquer.porteeB') }} <strong>{{ $t('FeuilleDebloquer.porteeC') }}</strong>{{ $t('FeuilleDebloquer.porteeD') }}
    </p>
    <h3 class="titre-bloc">{{ $t('FeuilleDebloquer.titreInclus') }}</h3>
    <ul class="inclus">
      <li v-for="i in INCLUS" :key="i.id" class="item">
        <Etincelles :taille="15" couleur="var(--peche)" une aria-hidden="true" />
        <div>
          <strong>{{ i.titre }}</strong>
          <p class="mini doux" style="margin:2px 0 0">{{ i.texte }}</p>
        </div>
      </li>
    </ul>

    <h3 class="titre-bloc">{{ $t('FeuilleDebloquer.titreGratuit') }}</h3>
    <ul class="gratuit">
      <li v-for="t in GRATUIT" :key="t" class="mini doux">{{ t }}</li>
    </ul>

    <!-- Rien à payer avec un déblocage d'avance : rien à expliquer du paiement.
         Le lien vers les conditions reste — et avec lui de quoi faire défiler
         ce texte au clavier (une zone qui défile sans rien de focalisable est
         fermée à qui n'a pas de souris). -->
    <p v-if="avance" class="mini doux" style="margin:16px 0 0">
      <a href="/conditions" class="lien" aria-haspopup="dialog" @click.prevent="ouvrirLegal('/conditions')">{{ $t('FeuilleDebloquer.conditionsVente') }}</a>
    </p>
    <template v-else>
      <h3 class="titre-bloc">{{ $t('FeuilleDebloquer.titreComment') }}</h3>
      <p v-if="parApple" class="mini doux" style="margin:0">
        {{ $t('FeuilleDebloquer.commentApple') }}
        <a href="/conditions" class="lien" aria-haspopup="dialog" @click.prevent="ouvrirLegal('/conditions')">{{ $t('FeuilleDebloquer.lienConditions') }}</a>.
      </p>
      <p v-else class="mini doux" style="margin:0">
        {{ $t('FeuilleDebloquer.commentStripe') }}
        <a href="/conditions" class="lien" aria-haspopup="dialog" @click.prevent="ouvrirLegal('/conditions')">{{ $t('FeuilleDebloquer.lienConditions') }}</a>.
      </p>
    </template>

    <template #pied="{ fermer }">
      <p v-if="payeeParAutre" class="annonce ok" role="status">
        {{ $t('FeuilleDebloquer.payeeParAutre', { qui: statut?.par ?? $t('FeuilleDebloquer.quelquun') }) }}
      </p>
      <p v-else-if="autreEnCours" class="annonce" role="status">
        <strong>{{ $t('FeuilleDebloquer.autreEnCours', { qui: autreEnCours.par ?? $t('FeuilleDebloquer.unMembre') }) }}</strong>
        {{ $t('FeuilleDebloquer.autreEnCoursSuite', { heure: heure(autreEnCours.jusqu) }) }}
      </p>

      <!-- La case juste au-dessus du bouton, toujours sous les yeux : c'est
           elle qu'on doit cocher pour payer (voir accordManque). -->
      <!-- Repliée quand on tape un code cadeau (rien à payer, et le clavier
           mange la place) ; elle revient si l'on touche quand même le bouton. -->
      <p v-if="avance && !autreEnCours" class="annonce" role="status">
        {{ $t('FeuilleDebloquer.avance') }}
      </p>
      <label v-if="!parApple && !avance && !autreEnCours && !payeeParAutre && (!cadeauOuvert || accord || accordManque)"
             class="accord" :class="{ manque: accordManque }">
        <input ref="caseAccord" v-model="accord" type="checkbox"
               :aria-invalid="accordManque || undefined"
               :aria-describedby="accordManque ? 'accord-detail accord-requis' : 'accord-detail'">
        <span>
          {{ $t('FeuilleDebloquer.accordA') }}
          <a href="/conditions" class="lien" aria-haspopup="dialog" @click.prevent="ouvrirLegal('/conditions')">{{ $t('FeuilleDebloquer.cgv') }}</a>
          {{ $t('FeuilleDebloquer.accordB') }}
          <span id="accord-detail" class="doux">
            {{ $t('FeuilleDebloquer.accordDetail') }}
          </span>
        </span>
      </label>
      <p v-if="accordManque" id="accord-requis" class="mini" role="alert" style="color:var(--non);margin:0">
        {{ $t('FeuilleDebloquer.accordRequis') }}
      </p>
      <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
      <p v-if="attenteAccord" class="annonce" role="status">
        {{ $t('FeuilleDebloquer.attenteAccord') }}
      </p>

      <button type="button" class="btn btn-1" style="width:100%"
              :disabled="envoi || !!autreEnCours || payeeParAutre" @click="payer">
        {{ envoi ? (parApple || avance ? $t('FeuilleDebloquer.unInstant') : $t('FeuilleDebloquer.ouverture'))
          : avance ? $t('FeuilleDebloquer.titre') : $t('FeuilleDebloquer.debloquerPrix', { prix }) }}
      </button>
      <!-- Côte à côte : la case est montée dans le pied, il doit rester de la
           place au texte sur un petit écran. -->
      <div v-if="!cadeauOuvert" class="liens">
        <button v-if="vente.cadeaux" type="button" class="btn btn-0 mini" @click="ouvrirCadeau">
          {{ $t('FeuilleDebloquer.codeCadeauQ') }}
        </button>
        <button type="button" class="btn btn-0 mini doux" @click="fermer">
          {{ $t('FeuilleDebloquer.plusTard') }}
        </button>
      </div>
      <div v-else class="cadeau">
        <p v-if="merciCadeau" class="mini merci" role="status">{{ merciCadeau }}</p>
        <template v-else>
          <div class="ligne">
            <input ref="champCadeau" v-model="codeCadeau" class="champ" style="flex:1"
                   :aria-label="$t('FeuilleDebloquer.codeCadeau')" placeholder="K7QM-X3PD-9RTA"
                   autocapitalize="characters" autocorrect="off" spellcheck="false"
                   @keyup.enter="utiliserCadeau(fermer)">
            <button type="button" class="btn mini" :disabled="envoiCadeau" @click="utiliserCadeau(fermer)">
              {{ envoiCadeau ? '…' : $t('FeuilleDebloquer.utiliser') }}
            </button>
          </div>
          <p v-if="erreurCadeau" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreurCadeau }}</p>
        </template>
      </div>
      <button v-if="cadeauOuvert" type="button" class="btn btn-0 mini doux" style="width:100%" @click="fermer">
        {{ $t('FeuilleDebloquer.plusTard') }}
      </button>
      <component :is="OutilsDev" v-if="OutilsDev" :gid="Number(g.gid)"
                 @fait="g.recharger().then(fermer)" />
    </template>
  </Feuille>
</template>

<style scoped>
.annonce { margin: 0; padding: 11px 13px; border-radius: var(--r-s);
  border: 1px solid var(--trait); background: var(--fond); font-size: .85rem; }
.annonce.ok { border-color: var(--oui); color: var(--oui); }
.inclus { list-style: none; margin: 0; padding: 0; }
.portee { padding: 10px 12px; border-radius: var(--r-s); line-height: 1.45;
  background: color-mix(in srgb, var(--menthe) 30%, transparent); }
.item { display: flex; gap: 10px; align-items: flex-start; padding: 11px 0;
  border-top: 1px solid var(--trait); }
/* Dans le pied, à côté du bouton : plus serrée que dans le texte. */
.accord { display: flex; gap: 10px; align-items: flex-start; margin: 0;
  padding: 10px 12px; border-radius: var(--r-s); border: 1px solid var(--trait);
  background: var(--fond); font-size: .78rem; line-height: 1.4; cursor: pointer;
  transition: border-color .15s, background .15s; }
.accord input { width: 22px; height: 22px; flex: none; margin: 0; accent-color: var(--encre); }
.accord.manque { border-color: var(--non); background: color-mix(in srgb, var(--non) 9%, var(--fond));
  animation: secoue .32s ease-in-out; }
@keyframes secoue { 25% { transform: translateX(-5px) } 50% { transform: translateX(5px) } 75% { transform: translateX(-3px) } }
@media (prefers-reduced-motion: reduce) { .accord.manque { animation: none; } }
.item strong { font-size: .94rem; }
.titre-bloc { margin: 18px 0 6px; font-size: .72rem; text-transform: uppercase;
  letter-spacing: .05em; color: var(--doux); font-weight: 700; }
.gratuit { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
.cadeau { display: flex; flex-direction: column; gap: 6px; }
.liens { display: flex; justify-content: center; flex-wrap: wrap; gap: 0 6px; margin-top: -4px; }
.liens .btn { padding-left: 14px; padding-right: 14px; }
.merci { margin: 0; padding: 10px 12px; border-radius: var(--r-s); text-align: center;
  background: color-mix(in srgb, var(--menthe) 45%, var(--carte)); }
</style>
