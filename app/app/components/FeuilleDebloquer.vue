<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { StatutPaiement } from '~/composables/etatGroupe'
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
 */
const g = useGroupeCourant()
const emit = defineEmits<{ fermer: [] }>()
const { ouvrir: ouvrirLegal } = useFeuilleLegale()

const config = useRuntimeConfig()
const prix = (config.public.prixListe as string) || '6 €'

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
const tva = mentionTva()

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
const nomListe = computed(() => g.etat.value?.groupe?.nom ?? 'cette liste')
// Les chiffres du gratuit viennent de la liste elle-meme : une liste offerte
// plus large ne doit pas afficher les limites par defaut.
const quota = computed(() => g.etat.value?.quota)
const GRATUIT = computed(() => [
  `${quota.value?.depart?.limite ?? 150} swipes pour commencer, puis ${quota.value?.limite_jour ?? 15} swipes par jour`,
  'Les 19 608 prénoms et la recherche complète',
  'Les accords et le classement',
  'L’origine, la signification et la courbe sur chaque fiche',
  'Le veto sur un prénom',
  'Le deuxième parent'
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
  if (!code) { erreurCadeau.value = 'Douze caractères, comme K7QM-X3PD-9RTA.'; return }
  if (envoiCadeau.value) return
  envoiCadeau.value = true; erreurCadeau.value = ''
  try {
    await $fetch('/api/cadeaux/utiliser', { method: 'POST', body: { code, groupe: Number(g.gid) } })
    await g.recharger()
    const de = g.etat.value?.groupe?.cadeau_de
    merciCadeau.value = de ? `C’est débloqué, un cadeau de ${de}.` : 'C’est débloqué, un beau cadeau.'
    setTimeout(fermer, 1600)
  } catch (e: any) {
    const m = e?.data?.statusMessage
    erreurCadeau.value = m === 'cadeau_utilise' ? 'Ce code cadeau a déjà servi.'
      : m === 'cadeau_annule' ? 'Ce code cadeau a été annulé (l’achat a été remboursé).'
      : m === 'cadeau_expire' ? 'Ce code cadeau a expiré.'
      : m === 'cadeau_inconnu' ? 'Code inconnu. Vérifiez-le : douze caractères, sans I, L, O, U, 0 ni 1.'
      : m === 'liste_deja_debloquee' ? 'Cette liste est déjà débloquée : le code n’a pas été utilisé.'
      : m === 'trop_d_essais' ? 'Trop d’essais d’un coup : réessayez dans un moment.'
      : 'Le code n’a pas pu être utilisé. Réessayez dans un instant.'
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
const heure = (iso: string | null | undefined) => iso
  ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
async function relireStatut() {
  const s = await g.verifierPaiement()
  if (!s) return
  statut.value = s
  if (s.paye && !payeeParAutre.value) {
    payeeParAutre.value = true
    setTimeout(() => emit('fermer'), 2200)
  }
}
let sondage: any = null
onMounted(() => { relireStatut(); sondage = setInterval(relireStatut, 4000) })
onUnmounted(() => clearInterval(sondage))

async function payer() {
  if (envoi.value) return
  if (!accord.value) {
    accordManque.value = true
    await nextTick()
    caseAccord.value?.focus()
    try { navigator.vibrate?.(25) } catch { /* pas de vibreur : le contour suffit */ }
    return
  }
  envoi.value = true; erreur.value = ''
  try {
    const r = await $fetch<any>(`/api/groupes/${g.gid}/paiement`,
      { method: 'POST', body: { consentement: true } })
    if (r?.deja) { await relireStatut(); return }
    if (r?.url) { window.location.href = r.url; return }
    erreur.value = 'Le paiement n’a pas pu s’ouvrir.'
  } catch (e: any) {
    const code = e?.statusMessage ?? e?.data?.statusMessage
    if (code === 'paiement_en_cours') { await relireStatut(); return }
    erreur.value = code === 'paiement_non_configure' || code === 'vente_fermee'
      ? 'Le paiement n’est pas encore ouvert. Il le sera très bientôt.'
      : code === 'consentement_requis'
        ? 'Cochez la case d’accord pour continuer.'
        : 'Le paiement est momentanément indisponible. Réessayez dans un instant.'
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <Feuille titre="Débloquer cette liste" @fermer="emit('fermer')">
    <p style="margin:0 0 4px">
      <strong style="font-size:1.3rem">{{ prix }} TTC</strong>
      <span class="doux"> : débloque cette liste pour la vie</span>
    </p>
    <p class="mini doux" style="margin:0 0 6px">{{ tva }}.</p>
    <!-- Ce qu'on achète, sans ambiguïté : UNE liste, pas l'app. Quelqu'un qui
         croit tout débloquer, puis crée une seconde liste, se sent floué. -->
    <p class="portee mini" style="margin:0 0 16px">
      Ça débloque <strong>« {{ nomListe }} »</strong>, pour
      {{ membres > 1 ? `ses ${membres} membres` : 'vous et la personne que vous inviterez' }}.
      Pas toute l’application : <strong>chaque liste se débloque à part</strong>,
      et vos autres listes restent gratuites.
    </p>
    <h3 class="titre-bloc">Ce que ça débloque</h3>
    <ul class="inclus">
      <li v-for="i in INCLUS" :key="i.titre" class="item">
        <Etincelles :taille="15" couleur="var(--peche)" une aria-hidden="true" />
        <div>
          <strong>{{ i.titre }}</strong>
          <p class="mini doux" style="margin:2px 0 0">{{ i.texte }}</p>
        </div>
      </li>
    </ul>

    <h3 class="titre-bloc">Ce qui reste gratuit, avec ou sans</h3>
    <ul class="gratuit">
      <li v-for="t in GRATUIT" :key="t" class="mini doux">{{ t }}</li>
    </ul>

    <h3 class="titre-bloc">Comment ça se passe</h3>
    <p class="mini doux" style="margin:0">
      Paiement sur la page sécurisée de Stripe : babyNamed ne voit jamais votre carte.
      La liste se débloque aussitôt, et la facture arrive par e-mail. Le reste est dans les
      <a href="/conditions" class="lien" aria-haspopup="dialog" @click.prevent="ouvrirLegal('/conditions')">conditions de vente</a>.
    </p>

    <template #pied="{ fermer }">
      <p v-if="payeeParAutre" class="annonce ok" role="status">
        {{ statut?.par ?? 'Quelqu’un' }} vient de débloquer la liste : swipes illimités pour vous
        aussi. Rien à payer.
      </p>
      <p v-else-if="autreEnCours" class="annonce" role="status">
        <strong>{{ autreEnCours.par ?? 'Un membre de la liste' }} est en train de payer cette
        liste.</strong> Inutile de payer deux fois : elle se débloquera ici toute seule.
        En cas d’abandon, vous pourrez payer à partir de {{ heure(autreEnCours.jusqu) }}.
      </p>

      <!-- La case juste au-dessus du bouton, toujours sous les yeux : c'est
           elle qu'on doit cocher pour payer (voir accordManque). -->
      <!-- Repliée quand on tape un code cadeau (rien à payer, et le clavier
           mange la place) ; elle revient si l'on touche quand même le bouton. -->
      <label v-if="!autreEnCours && !payeeParAutre && (!cadeauOuvert || accord || accordManque)"
             class="accord" :class="{ manque: accordManque }">
        <input ref="caseAccord" v-model="accord" type="checkbox"
               :aria-invalid="accordManque || undefined"
               :aria-describedby="accordManque ? 'accord-detail accord-requis' : 'accord-detail'">
        <span>
          J’accepte les
          <a href="/conditions" class="lien" aria-haspopup="dialog" @click.prevent="ouvrirLegal('/conditions')">conditions générales de vente</a>
          et je demande l’accès immédiat à la liste débloquée.
          <span id="accord-detail" class="doux">
            Je renonce ainsi à mon droit de rétractation de 14 jours
            (art. L221-28 13° du Code de la consommation).
          </span>
        </span>
      </label>
      <p v-if="accordManque" id="accord-requis" class="mini" role="alert" style="color:var(--non);margin:0">
        Cochez cette case pour payer.
      </p>
      <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>

      <button type="button" class="btn btn-1" style="width:100%"
              :disabled="envoi || !!autreEnCours || payeeParAutre" @click="payer">
        {{ envoi ? 'Ouverture…' : `Débloquer cette liste (${prix})` }}
      </button>
      <!-- Côte à côte : la case est montée dans le pied, il doit rester de la
           place au texte sur un petit écran. -->
      <div v-if="!cadeauOuvert" class="liens">
        <button type="button" class="btn btn-0 mini" @click="ouvrirCadeau">
          Vous avez un code cadeau ?
        </button>
        <button type="button" class="btn btn-0 mini doux" @click="fermer">
          Plus tard
        </button>
      </div>
      <div v-else class="cadeau">
        <p v-if="merciCadeau" class="mini merci" role="status">{{ merciCadeau }}</p>
        <template v-else>
          <div class="ligne">
            <input ref="champCadeau" v-model="codeCadeau" class="champ" style="flex:1"
                   aria-label="Code cadeau" placeholder="K7QM-X3PD-9RTA"
                   autocapitalize="characters" autocorrect="off" spellcheck="false"
                   @keyup.enter="utiliserCadeau(fermer)">
            <button type="button" class="btn mini" :disabled="envoiCadeau" @click="utiliserCadeau(fermer)">
              {{ envoiCadeau ? '…' : 'Utiliser' }}
            </button>
          </div>
          <p v-if="erreurCadeau" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreurCadeau }}</p>
        </template>
      </div>
      <button v-if="cadeauOuvert" type="button" class="btn btn-0 mini doux" style="width:100%" @click="fermer">
        Plus tard
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
