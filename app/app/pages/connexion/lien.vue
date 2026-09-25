<script setup lang="ts">
/**
 * Le lien reçu par e-mail arrive ici : /connexion/lien#t=<jeton>.
 *
 * Le jeton voyage après le « # » : il n'est envoyé à aucun serveur (ni le
 * nôtre, ni un tiers via l'en-tête Referer) et on l'efface de l'adresse dès
 * la lecture — il ne reste ni dans l'historique, ni dans une capture d'écran.
 *
 * Un BOUTON, pas une validation automatique. Certains filtres de messagerie
 * ouvrent les liens pour les inspecter ; ils consommeraient le lien à votre
 * place et vous tomberiez sur « lien déjà utilisé ». Un bouton, aucun robot
 * ne le touche. Le même pour les deux sortes de liens : on ne sait pas
 * laquelle c'est avant de demander au serveur, qui la consomme en répondant.
 */
useHead({ title: 'Connexion par lien' })

const jeton = ref('')
const etat = ref<'lecture' | 'pret' | 'envoi' | 'verifie' | 'invalide' | 'incomplet'>('lecture')
const email = ref('')

function lireJeton(): string {
  const m = location.hash.match(/[#&]t=([A-Za-z0-9_-]+)/)
  return m?.[1] ?? ''
}

async function valider() {
  if (!jeton.value || etat.value === 'envoi') return
  etat.value = 'envoi'
  try {
    const r = await $fetch<any>('/api/auth/lien/valider', { method: 'POST', body: { jeton: jeton.value } })
    jeton.value = ''
    if (r?.but === 'verification') {
      email.value = r.email
      etat.value = 'verifie'
      await rafraichirMoi()
      return
    }
    await rafraichirMoi()
    await navigateTo('/', { replace: true })
  } catch {
    etat.value = 'invalide'
  }
}

onMounted(async () => {
  jeton.value = lireJeton()
  history.replaceState(history.state, '', '/connexion/lien')
  etat.value = jeton.value ? 'pret' : 'incomplet'
})
</script>

<template>
  <main id="contenu" class="lien" tabindex="-1">
    <div class="haut">
      <img src="/logo.png" alt="" width="58" height="58">
      <h1>babyNames</h1>
    </div>

    <div class="carte pile">
      <template v-if="etat === 'pret' || etat === 'envoi' || etat === 'lecture'">
        <h2>Continuer sur cet appareil ?</h2>
        <p class="mini doux" style="margin:0">
          Le lien de votre e-mail est valable une seule fois.
        </p>
        <button type="button" class="btn btn-1" :disabled="etat !== 'pret'" @click="valider">
          {{ etat === 'envoi' ? 'Un instant…' : 'Continuer' }}
        </button>
      </template>

      <template v-else-if="etat === 'verifie'">
        <h2>Adresse confirmée</h2>
        <p class="mini" style="margin:0" role="status">
          <strong>{{ email }}</strong> est maintenant l’adresse de votre compte : un
          lien de connexion pourra y partir.
        </p>
        <NuxtLink to="/" class="btn btn-1" style="text-align:center">Ouvrir babyNames</NuxtLink>
      </template>

      <template v-else-if="etat === 'invalide'">
        <h2>Ce lien ne marche plus</h2>
        <p class="mini" style="margin:0" role="alert">
          Il a déjà servi, ou ses 15 minutes sont passées — ou un e-mail plus
          récent l’a remplacé. Demandez-en un nouveau.
        </p>
        <NuxtLink to="/connexion" class="btn btn-1" style="text-align:center">Recevoir un nouveau lien</NuxtLink>
      </template>

      <template v-else>
        <h2>Lien incomplet</h2>
        <p class="mini" style="margin:0" role="alert">
          L’adresse s’est coupée en route. Ouvrez le lien de l’e-mail en entier,
          ou tapez le code reçu dans l’app.
        </p>
        <NuxtLink to="/connexion" class="btn" style="text-align:center">Aller à la connexion</NuxtLink>
      </template>
    </div>

    <PiedLegal compact />
  </main>
</template>

<style scoped>
.lien { height: 100%; overflow-y: auto; display: flex; flex-direction: column;
  gap: 18px; max-width: 460px; margin: 0 auto;
  padding: max(24px, env(safe-area-inset-top)) 18px calc(28px + env(safe-area-inset-bottom)); }
.haut { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.haut img { border-radius: 17px; }
.haut h1 { font-size: 1.5rem; }
.lien:focus { outline: none; }
.lien > :first-child { margin-top: auto; }
.lien > :last-child { margin-bottom: auto; }
</style>
