<script setup lang="ts">
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

const membres = computed(() => g.etat.value?.avancement?.length ?? 1)

const INCLUS = [
  {
    titre: 'Le tri sans limite',
    texte: 'Plus de plafond quotidien, pour vous deux. Le rappel d’hygiène reste — juger deux cents prénoms d’affilée donne de moins bonnes décisions — mais il se passe.'
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
    titre: 'Les observateurs',
    texte: 'Inviter les grands-parents pour qu’ils voient et commentent, sans qu’ils bloquent vos accords ni posent de veto.'
  }
]

const GRATUIT = [
  'Les 19 608 prénoms et la recherche complète',
  'Les accords et le classement',
  'L’origine, la signification et la courbe sur chaque fiche',
  'Les vetos',
  'Le deuxième parent'
]

async function payer() {
  if (envoi.value) return
  envoi.value = true; erreur.value = ''
  try {
    const r = await $fetch<any>(`/api/groupes/${g.gid}/paiement`, { method: 'POST' })
    if (r?.deja) { await g.recharger(); emit('fermer'); return }
    if (r?.url) { window.location.href = r.url; return }
    erreur.value = 'Le paiement n’a pas pu s’ouvrir.'
  } catch (e: any) {
    erreur.value = e?.statusMessage === 'paiement_non_configure'
      ? 'Le paiement n’est pas encore ouvert sur cette instance.'
      : 'Le paiement est momentanément indisponible. Réessayez dans un instant.'
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <Feuille titre="Débloquer cette liste" @fermer="emit('fermer')">
    <p style="margin:0 0 4px">
      <strong style="font-size:1.3rem">{{ prix }}</strong>
      <span class="doux"> une fois, pas d’abonnement</span>
    </p>
    <p class="mini doux" style="margin:0 0 16px">
      C’est la <strong>liste</strong> qui se débloque, pas votre compte :
      {{ membres > 1 ? 'vous êtes ' + membres + ' dessus, tout le monde en profite'
                     : 'la personne que vous inviterez en profitera aussi' }}.
    </p>

    <div v-for="i in INCLUS" :key="i.titre" class="item">
      <Etincelles :taille="15" couleur="var(--peche)" une />
      <div>
        <strong>{{ i.titre }}</strong>
        <p class="mini doux" style="margin:2px 0 0">{{ i.texte }}</p>
      </div>
    </div>

    <p class="titre-bloc">Ce qui reste gratuit, avec ou sans</p>
    <ul class="gratuit">
      <li v-for="t in GRATUIT" :key="t" class="mini doux">{{ t }}</li>
    </ul>

    <p v-if="erreur" class="mini" style="color:var(--non);margin:12px 0 0">{{ erreur }}</p>

    <template #pied="{ fermer }">
      <button class="btn btn-1" style="width:100%" :disabled="envoi" @click="payer">
        {{ envoi ? 'Ouverture…' : `Débloquer pour ${prix}` }}
      </button>
      <button class="btn btn-0 mini doux" style="width:100%;margin-top:8px" @click="fermer">
        Plus tard
      </button>
    </template>
  </Feuille>
</template>

<style scoped>
.item { display: flex; gap: 10px; align-items: flex-start; padding: 11px 0;
  border-top: 1px solid var(--trait); }
.item strong { font-size: .94rem; }
.titre-bloc { margin: 18px 0 6px; font-size: .72rem; text-transform: uppercase;
  letter-spacing: .05em; color: var(--doux); font-weight: 650; }
.gratuit { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
</style>
