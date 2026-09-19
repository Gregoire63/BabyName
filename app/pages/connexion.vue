<script setup lang="ts">
const route = useRoute()
const pseudo = ref('')
const cle = ref('')
const mode = ref<'choix' | 'cle'>('choix')
const envoi = ref(false)
const erreur = ref('')

// Clé fraîchement créée : on la montre une fois, puis on entre.
const cleNeuve = ref('')
const copie = ref(false)

const invitation = computed(() => {
  const c = route.query.code
  return typeof c === 'string' && c.trim().length === 8 ? c.trim() : ''
})

function suite() {
  return navigateTo(invitation.value ? `/?code=${invitation.value}` : '/')
}

async function creer() {
  erreur.value = ''
  if (pseudo.value.trim().length < 2) { erreur.value = 'Il faut au moins deux lettres.'; return }
  envoi.value = true
  try {
    const r = await $fetch<any>('/api/auth/entrer', {
      method: 'POST', body: { pseudo: pseudo.value }
    })
    await rafraichirMoi()
    cleNeuve.value = r.cle
  } catch {
    erreur.value = 'Création impossible. Réessayez dans un instant.'
  } finally { envoi.value = false }
}

async function reprendre() {
  erreur.value = ''
  envoi.value = true
  try {
    await $fetch('/api/auth/reprendre', { method: 'POST', body: { cle: cle.value } })
    await rafraichirMoi()
    await suite()
  } catch (e: any) {
    erreur.value = e?.data?.statusMessage === 'cle_inconnue'
      ? 'Cette clé ne correspond à aucun compte.'
      : 'Clé incomplète.'
  } finally { envoi.value = false }
}

async function copier() {
  try { await navigator.clipboard.writeText(cleNeuve.value) } catch { /* selection manuelle */ }
  copie.value = true
  setTimeout(() => copie.value = false, 1800)
}

onMounted(async () => { if (await rafraichirMoi()) await suite() })
</script>

<template>
  <main class="accueil">
    <!-- 1. la clé vient d'être créée : elle ne sera plus jamais affichée -->
    <template v-if="cleNeuve">
      <div class="haut">
        <img src="/logo.png" alt="" width="58" height="58">
        <h1>Bonjour {{ pseudo.trim() }}</h1>
      </div>

      <div class="carte pile">
        <h2>Votre clé d’accès</h2>
        <p class="mini doux" style="margin:0">
          Elle remplace le mot de passe. Notez-la maintenant : elle ne s’affiche
          qu’une fois, et elle seule permet de retrouver votre compte sur un
          autre téléphone.
        </p>
        <button class="cle" @click="copier">{{ cleNeuve }}</button>
        <p class="mini" :class="copie ? '' : 'doux'" style="margin:0;text-align:center">
          {{ copie ? 'Copiée' : 'Touchez pour copier' }}
        </p>
        <button class="btn btn-1" @click="suite">C’est noté, on y va</button>
        <p class="mini doux" style="margin:0">
          Vous restez connecté sur cet appareil pendant plusieurs mois. La clé
          ne sert qu’en cas de changement de téléphone.
        </p>
      </div>
    </template>

    <!-- 2. reprise d'un compte existant -->
    <template v-else-if="mode === 'cle'">
      <div class="haut">
        <img src="/logo.png" alt="" width="58" height="58">
        <h1>Votre clé</h1>
      </div>
      <div class="carte pile">
        <input v-model="cle" class="champ grand" placeholder="XXXX-XXXX-XXXX"
               autocapitalize="characters" autocomplete="off" spellcheck="false"
               @keyup.enter="reprendre">
        <button class="btn btn-1" :disabled="envoi" @click="reprendre">
          {{ envoi ? 'Vérification…' : 'Entrer' }}
        </button>
        <p v-if="erreur" class="mini" style="color:var(--non);margin:0">{{ erreur }}</p>
        <button class="btn btn-0 doux" @click="mode = 'choix'; erreur = ''">Retour</button>
      </div>
    </template>

    <!-- 3. première venue -->
    <template v-else>
      <div class="haut">
        <img src="/logo.png" alt="" width="66" height="66">
        <h1>babyNames</h1>
        <p class="doux">Choisir un prénom à deux, sans s’influencer.</p>
      </div>

      <div class="carte pile">
        <label class="pile" style="gap:6px">
          <span class="mini doux">Votre prénom, pour que l’autre vous reconnaisse</span>
          <input v-model="pseudo" class="champ" placeholder="Greg" autocomplete="nickname"
                 @keyup.enter="creer">
        </label>
        <button class="btn btn-1" :disabled="envoi" @click="creer">
          {{ envoi ? 'Création…' : 'Commencer' }}
        </button>
        <p v-if="erreur" class="mini" style="color:var(--non);margin:0">{{ erreur }}</p>
        <p class="mini doux" style="margin:0">
          Pas d’adresse e-mail, pas de mot de passe. On vous donne une clé à noter,
          utile seulement si vous changez de téléphone.
        </p>
      </div>

      <button class="btn btn-0 doux" @click="mode = 'cle'; erreur = ''">
        J’ai déjà une clé
      </button>
    </template>
  </main>
</template>

<style scoped>
.accueil { height: 100%; overflow-y: auto; display: flex; flex-direction: column;
  justify-content: center; gap: 20px; max-width: 460px; margin: 0 auto;
  padding: max(24px, env(safe-area-inset-top)) 18px calc(28px + env(safe-area-inset-bottom)); }
.haut { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.haut img { border-radius: 17px; }
.haut h1 { font-size: 1.7rem; }
.haut p { margin: 0; }
.champ.grand { text-align: center; font-size: 1.25rem; letter-spacing: .1em;
  font-variant-numeric: tabular-nums; padding: 16px 12px; }
.cle { display: block; width: 100%; border: 1px dashed var(--trait); border-radius: 14px;
  background: var(--fond); padding: 18px 10px; cursor: pointer;
  font: inherit; font-size: 1.35rem; font-weight: 700; letter-spacing: .08em;
  text-align: center; color: var(--texte); }
.cle:active { transform: scale(.99); }
</style>
