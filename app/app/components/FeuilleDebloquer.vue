<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
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

const membres = computed(() => g.etat.value?.avancement?.length ?? 1)

const INCLUS = INCLUS_DEBLOCAGE
const nomListe = computed(() => g.etat.value?.groupe?.nom ?? 'cette liste')
// Les chiffres du gratuit viennent de la liste elle-meme : une liste offerte
// plus large ne doit pas afficher les limites par defaut.
const quota = computed(() => g.etat.value?.quota)
const GRATUIT = computed(() => [
  `${quota.value?.depart?.limite ?? 150} prénoms pour commencer, puis ${quota.value?.limite_jour ?? 15} par jour, sans jamais être bloqué`,
  'Les 19 608 prénoms et la recherche complète',
  'Les accords et le classement',
  'L’origine, la signification et la courbe sur chaque fiche',
  'Bloquer un prénom',
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

async function payer() {
  if (envoi.value || !accord.value) return
  envoi.value = true; erreur.value = ''
  try {
    const r = await $fetch<any>(`/api/groupes/${g.gid}/paiement`,
      { method: 'POST', body: { consentement: true } })
    if (r?.deja) { await g.recharger(); emit('fermer'); return }
    if (r?.url) { window.location.href = r.url; return }
    erreur.value = 'Le paiement n’a pas pu s’ouvrir.'
  } catch (e: any) {
    const code = e?.statusMessage ?? e?.data?.statusMessage
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
      La liste se débloque aussitôt, et la facture arrive par e-mail.
    </p>

    <label class="accord">
      <input v-model="accord" type="checkbox" aria-describedby="accord-detail">
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

    <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:12px 0 0">{{ erreur }}</p>

    <template #pied="{ fermer }">
      <button type="button" class="btn btn-1" style="width:100%" :disabled="envoi || !accord"
              :aria-describedby="accord ? undefined : 'accord-requis'" @click="payer">
        {{ envoi ? 'Ouverture…' : `Débloquer cette liste (${prix})` }}
      </button>
      <p v-if="!accord" id="accord-requis" class="mini doux" style="margin:0;text-align:center">
        Cochez la case d’accord pour continuer.
      </p>
      <button v-if="!cadeauOuvert" type="button" class="btn btn-0 mini" style="width:100%"
              @click="ouvrirCadeau">
        Vous avez un code cadeau ?
      </button>
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
      <button type="button" class="btn btn-0 mini doux" style="width:100%" @click="fermer">
        Plus tard
      </button>
      <component :is="OutilsDev" v-if="OutilsDev" :gid="Number(g.gid)"
                 @fait="g.recharger().then(fermer)" />
    </template>
  </Feuille>
</template>

<style scoped>
.inclus { list-style: none; margin: 0; padding: 0; }
.portee { padding: 10px 12px; border-radius: var(--r-s); line-height: 1.45;
  background: color-mix(in srgb, var(--menthe) 30%, transparent); }
.item { display: flex; gap: 10px; align-items: flex-start; padding: 11px 0;
  border-top: 1px solid var(--trait); }
.accord { display: flex; gap: 10px; align-items: flex-start; margin: 16px 0 0;
  padding: 12px 14px; border-radius: var(--r-s); border: 1px solid var(--trait);
  background: var(--fond); font-size: .84rem; line-height: 1.45; cursor: pointer; }
.accord input { width: 20px; height: 20px; flex: none; margin: 1px 0 0; accent-color: var(--encre); }
.item strong { font-size: .94rem; }
.titre-bloc { margin: 18px 0 6px; font-size: .72rem; text-transform: uppercase;
  letter-spacing: .05em; color: var(--doux); font-weight: 700; }
.gratuit { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
.cadeau { display: flex; flex-direction: column; gap: 6px; }
.merci { margin: 0; padding: 10px 12px; border-radius: var(--r-s); text-align: center;
  background: color-mix(in srgb, var(--menthe) 45%, var(--carte)); }
</style>
