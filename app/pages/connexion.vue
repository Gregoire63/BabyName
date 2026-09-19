<script setup lang="ts">
const email = ref('')
const pseudo = ref('')
const etat = ref<'saisie' | 'envoi' | 'envoye'>('saisie')
const erreur = ref('')
const lienDebug = ref('')
const route = useRoute()

if (route.query.erreur === 'lien_expire')
  erreur.value = 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.'

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
    if (e?.data?.statusMessage === 'trop_de_demandes') {
      const min = e?.data?.data?.attente_minutes ?? 15
      erreur.value = `Trop de liens demandés pour cette adresse. Réessayez dans ${min} minute${min > 1 ? 's' : ''}, ou utilisez une autre adresse.`
    } else {
      erreur.value = 'Adresse invalide.'
    }
  }
}
</script>

<template>
  <main class="accueil">
    <div class="haut">
      <img src="/logo.png" alt="" width="66" height="66">
      <h1>babyNames</h1>
      <p class="doux">Choisir un prénom à deux, sans s’influencer.</p>
    </div>

    <div class="carte pile">
      <template v-if="etat !== 'envoye'">
        <label class="pile" style="gap:6px">
          <span class="mini doux">Votre adresse e-mail</span>
          <input v-model="email" class="champ" type="email" inputmode="email"
                 autocomplete="email" placeholder="vous@exemple.fr" @keyup.enter="envoyer">
        </label>
        <label class="pile" style="gap:6px">
          <span class="mini doux">Votre prénom, pour que l’autre vous reconnaisse</span>
          <input v-model="pseudo" class="champ" placeholder="Greg" @keyup.enter="envoyer">
        </label>
        <button class="btn btn-1" :disabled="etat === 'envoi'" @click="envoyer">
          {{ etat === 'envoi' ? 'Envoi…' : 'Recevoir mon lien' }}
        </button>
        <p v-if="erreur" class="mini" style="color:var(--non);margin:0">{{ erreur }}</p>
        <p class="mini doux" style="margin:0">
          Pas de mot de passe : vous recevez un lien valable 20 minutes.
        </p>
      </template>

      <template v-else>
        <h2>{{ lienDebug ? 'Votre lien est prêt' : 'Regardez vos e-mails' }}</h2>
        <p v-if="!lienDebug" class="doux" style="margin:0">
          Un lien de connexion part vers <strong>{{ email }}</strong>. Il expire dans 20 minutes.
        </p>
        <div v-if="lienDebug" class="sans-mail">
          <p style="margin:0 0 8px">
            <strong>L’envoi d’e-mail n’est pas configuré</strong> sur ce déploiement :
            aucun message ne partira. Votre lien est ci-dessous.
          </p>
          <a class="btn btn-1" :href="lienDebug" style="display:block;text-align:center">
            Se connecter maintenant
          </a>
          <p class="mini" style="margin:9px 0 0">
            Tant que ce mode est actif, quiconque connaît une adresse peut se connecter
            à sa place. À désactiver avant un usage réel.
          </p>
        </div>
        <button class="btn btn-0 doux" @click="etat = 'saisie'">Changer d’adresse</button>
      </template>
    </div>
  </main>
</template>

<style scoped>
.accueil { height: 100%; overflow-y: auto; display: flex; flex-direction: column;
  justify-content: center; gap: 22px; max-width: 460px; margin: 0 auto;
  padding: max(24px, env(safe-area-inset-top)) 18px calc(28px + env(safe-area-inset-bottom)); }
.haut { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.haut img { border-radius: 17px; }
.haut h1 { font-size: 1.7rem; }
.haut p { margin: 0; }
.sans-mail { border-radius: 13px; padding: 14px 15px;
  background: color-mix(in srgb, var(--peche) 40%, transparent); }
</style>
