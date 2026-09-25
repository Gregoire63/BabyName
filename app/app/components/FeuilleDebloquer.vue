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

const INCLUS = [
  {
    titre: 'Le tri sans limite',
    texte: 'Ni limite de départ, ni quota du jour, pour vous deux. Le rappel d’hygiène reste — juger deux cents prénoms d’affilée donne de moins bonnes décisions — mais il se passe.'
  },
  {
    titre: 'L’essai avec votre nom de famille',
    texte: 'Chaque prénom confronté au vôtre : les voyelles qui se télescopent, les consonnes qui butent, les rimes, la longueur, les initiales involontaires. Ça se calcule sur la prononciation, pas sur l’orthographe.'
  },
  {
    titre: 'Combien dans sa classe',
    texte: 'Le nombre d’enfants qui porteront ce prénom dans une classe de 25, aujourd’hui et projeté à l’entrée en maternelle.'
  },
  {
    titre: 'Ce que vos oui disent de vous',
    texte: 'Les origines qui reviennent, la longueur que vous préférez, le degré de rareté — pour chacun de vous, et là où vous divergez.'
  },
  {
    titre: 'Pourquoi vous n’êtes pas d’accord',
    texte: 'Sur chaque désaccord, ce qui le cause vraiment : « ce n’est peut-être pas Marius, c’est la longueur ». Calculé sur vos votes, et tu par honnêteté quand il n’y a pas encore de quoi le dire.'
  },
  {
    titre: 'Les observateurs',
    texte: 'Inviter les grands-parents pour qu’ils voient et commentent, sans qu’ils bloquent vos accords ni posent de veto.'
  }
]

// Les chiffres du gratuit viennent de la liste elle-meme : une liste offerte
// plus large ne doit pas afficher les limites par defaut.
const quota = computed(() => g.etat.value?.quota)
const GRATUIT = computed(() => [
  `${quota.value?.depart?.limite ?? 150} prénoms pour commencer, puis ${quota.value?.limite_jour ?? 15} par jour — sans jamais être bloqué`,
  'Les 19 608 prénoms et la recherche complète',
  'Les accords et le classement',
  'L’origine, la signification et la courbe sur chaque fiche',
  'Les vetos',
  'Le deuxième parent'
])

/**
 * En developpement, Stripe n'est pas branche : un raccourci debloque la liste
 * locale (outils-dev/OutilsDebloquer.vue). Importe seulement si
 * `import.meta.dev` : absent du build de production.
 */
const OutilsDev = import.meta.dev
  ? defineAsyncComponent(() => import('~/outils-dev/OutilsDebloquer.vue')) : null

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
      <span class="doux"> une fois, pas d’abonnement</span>
    </p>
    <p class="mini doux" style="margin:0 0 6px">{{ tva }}.</p>
    <p class="mini doux" style="margin:0 0 16px">
      C’est la <strong>liste</strong> qui se débloque, pas votre compte :
      {{ membres > 1 ? 'vous êtes ' + membres + ' dessus, tout le monde en profite'
                     : 'la personne que vous inviterez en profitera aussi' }}.
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
      Paiement sur la page sécurisée de Stripe : babyNames ne voit jamais votre carte.
      La liste se débloque aussitôt, et la facture arrive par e-mail.
    </p>

    <label class="accord">
      <input v-model="accord" type="checkbox" aria-describedby="accord-detail">
      <span>
        J’accepte les
        <a href="/conditions" target="_blank" rel="noopener" class="lien">conditions générales de vente</a>
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
        {{ envoi ? 'Ouverture…' : `Débloquer pour ${prix}` }}
      </button>
      <p v-if="!accord" id="accord-requis" class="mini doux" style="margin:0;text-align:center">
        Cochez la case d’accord pour continuer.
      </p>
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
</style>
