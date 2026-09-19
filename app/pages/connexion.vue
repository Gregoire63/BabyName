<script setup lang="ts">
const email = ref('')
const pseudo = ref('')
const etat = ref<'saisie' | 'envoi' | 'envoye'>('saisie')
const erreur = ref('')
const lienDebug = ref('')
const route = useRoute()

if (route.query.erreur === 'lien_expire') erreur.value = 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.'

async function envoyer() {
  erreur.value = ''; etat.value = 'envoi'
  try {
    const r = await $fetch<{ ok: boolean; lien_debug?: string }>('/api/auth/demander', {
      method: 'POST', body: { email: email.value, pseudo: pseudo.value }
    })
    lienDebug.value = r.lien_debug ?? ''
    etat.value = 'envoye'
  } catch (e: any) {
    etat.value = 'saisie'
    erreur.value = e?.data?.statusMessage === 'trop_de_demandes'
      ? 'Trop de demandes. Réessayez dans un quart d’heure.'
      : 'Adresse invalide.'
  }
}
</script>

<template>
  <main class="page">
    <h1 style="margin-bottom:6px">Prénoms</h1>
    <p class="doux" style="margin-top:0">Choisir à plusieurs, sans s’influencer.</p>

    <div class="carte pile" style="margin-top:24px">
      <template v-if="etat !== 'envoye'">
        <label class="pile" style="gap:6px">
          <span class="mini doux">Votre adresse e-mail</span>
          <input v-model="email" class="champ" type="email" inputmode="email"
                 autocomplete="email" placeholder="vous@exemple.fr" @keyup.enter="envoyer">
        </label>
        <label class="pile" style="gap:6px">
          <span class="mini doux">Votre prénom, pour que les autres vous reconnaissent</span>
          <input v-model="pseudo" class="champ" placeholder="Greg" @keyup.enter="envoyer">
        </label>
        <button class="btn btn-principal" :disabled="etat === 'envoi'" @click="envoyer">
          {{ etat === 'envoi' ? 'Envoi…' : 'Recevoir mon lien' }}
        </button>
        <p v-if="erreur" class="mini" style="color:var(--non);margin:0">{{ erreur }}</p>
        <p class="mini doux" style="margin:0">
          Pas de mot de passe : vous recevez un lien valable 20 minutes.
        </p>
      </template>

      <template v-else>
        <h2>Regardez vos e-mails</h2>
        <p class="doux" style="margin:0">
          Un lien de connexion part vers <strong>{{ email }}</strong>. Il expire dans 20 minutes.
        </p>
        <p v-if="lienDebug" class="mini" style="margin:0">
          <em>Mode développement</em> — <a :href="lienDebug">ouvrir le lien directement</a>
        </p>
        <button class="btn btn-fantome" @click="etat = 'saisie'">Changer d’adresse</button>
      </template>
    </div>
  </main>
</template>
