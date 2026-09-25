<script setup lang="ts">
import { chargerCatalogue, trouverPrenom } from '~/composables/useCatalogue'

const route = useRoute()
const pseudo = ref('')
const cle = ref('')
const mode = ref<'choix' | 'cle'>('choix')
const envoi = ref(false)
const erreur = ref('')

// Clé fraîchement créée : on la montre une fois, puis on entre.
const cleNeuve = ref('')
const copie = ref(false)

useHead({ title: 'Connexion' })

// Retour d'une suppression de compte : on le dit, plutot que de laisser
// croire a une simple deconnexion.
const compteSupprime = computed(() => route.query.compte === 'supprime')

const invitation = computed(() => {
  const c = typeof route.query.code === 'string' ? route.query.code.trim().toLowerCase() : ''
  return /^[0-9a-f]{8}$/.test(c) ? c : ''
})

/**
 * Le prénom venu d'une fiche publique (`?prenom=louise`). On le nomme ici,
 * avec ses accents — c'est la promesse que le bouton de la fiche a faite, et
 * elle se tient : il sera la première carte (voir SectionTrier).
 */
const prenomDemande = computed(() => {
  const p = route.query.prenom
  return typeof p === 'string' ? p.trim().slice(0, 60) : ''
})
const prenomVu = ref('')

/** Invitation et prénom suivent jusqu'à l'accueil, qui en fait l'entrée. */
function suite() {
  const query: Record<string, string> = {}
  if (invitation.value) query.code = invitation.value
  if (prenomDemande.value) query.prenom = prenomDemande.value
  return navigateTo({ path: '/', query }, { replace: true })
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

onMounted(async () => {
  if (await rafraichirMoi()) return suite()
  if (!prenomDemande.value) return
  // Le catalogue servira de toute facon juste apres : autant le charger ici.
  const cat = await chargerCatalogue().catch(() => null)
  prenomVu.value = cat ? trouverPrenom(cat.liste, prenomDemande.value)?.l ?? '' : ''
})
</script>

<template>
  <main id="contenu" class="accueil" tabindex="-1">
    <p v-if="compteSupprime && !cleNeuve" class="carte mini supprime" role="status">
      Votre compte et vos données ont été supprimés.
    </p>

    <!-- 1. la clé vient d'être créée : elle ne sera plus jamais affichée -->
    <template v-if="cleNeuve">
      <div class="haut">
        <img src="/logo.png" alt="" width="58" height="58">
        <h1>Bonjour {{ pseudo.trim() }}</h1>
      </div>

      <div class="carte pile">
        <div class="ligne">
          <Etincelles :taille="22" couleur="var(--peche)" />
          <h2>Votre clé d’accès</h2>
        </div>
        <p class="mini doux" style="margin:0">
          Elle remplace le mot de passe. Notez-la maintenant : elle ne s’affiche
          qu’une fois, et elle seule permet de retrouver votre compte sur un
          autre téléphone.
        </p>
        <button type="button" class="cle" @click="copier">
          <span class="sr-only">Votre clé d’accès, touchez pour la copier : </span>{{ cleNeuve }}
        </button>
        <p class="mini" :class="copie ? '' : 'doux'" aria-live="polite" style="margin:0;text-align:center">
          {{ copie ? 'Copiée' : 'Touchez pour copier' }}
        </p>
        <button type="button" class="btn btn-1" @click="suite">C’est noté, on y va</button>
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
               aria-label="Votre clé d’accès, 12 caractères"
               autocapitalize="characters" autocomplete="off" spellcheck="false"
               @keyup.enter="reprendre">
        <button type="button" class="btn btn-1" :disabled="envoi" @click="reprendre">
          {{ envoi ? 'Vérification…' : 'Entrer' }}
        </button>
        <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
        <button type="button" class="btn btn-0 doux" @click="mode = 'choix'; erreur = ''">Retour</button>
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
        <p v-if="prenomVu" class="attend">
          Votre liste commencera par <strong>{{ prenomVu }}</strong>.
        </p>
        <p v-if="invitation" class="attend">
          Une liste vous a été partagée : vous y entrez juste après.
        </p>
        <label class="pile" style="gap:6px">
          <span class="mini doux">Votre prénom, pour que l’autre vous reconnaisse</span>
          <input v-model="pseudo" class="champ" placeholder="Greg" autocomplete="nickname"
                 @keyup.enter="creer">
        </label>
        <button type="button" class="btn btn-1" :disabled="envoi" @click="creer">
          {{ envoi ? 'Création…' : 'Commencer' }}
        </button>
        <p v-if="erreur" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
        <p class="mini doux" style="margin:0">
          Pas d’adresse e-mail, pas de mot de passe. On vous donne une clé à noter,
          utile seulement si vous changez de téléphone.
        </p>
        <!-- L'information au moment de la collecte (RGPD, art. 13) : courte
             ici, complete derriere le lien. -->
        <p class="mini doux" style="margin:0">
          En commençant, vous acceptez les
          <NuxtLink to="/conditions" class="lien">conditions d’utilisation</NuxtLink>.
          Seul ce prénom est demandé ; vos listes et vos votes servent à faire marcher
          l’app, jamais à de la publicité —
          <NuxtLink to="/confidentialite" class="lien">ce qu’on garde et pourquoi</NuxtLink>.
        </p>
      </div>

      <button type="button" class="btn btn-0 doux" @click="mode = 'cle'; erreur = ''">
        J’ai déjà une clé
      </button>
    </template>

    <PiedLegal compact />
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
.cle { display: block; width: 100%; border: 1px dashed var(--trait); border-radius: var(--r-s);
  background: var(--fond); padding: 18px 10px; cursor: pointer;
  font: inherit; font-size: 1.35rem; font-weight: 700; letter-spacing: .08em;
  text-align: center; color: var(--texte); }
.cle:active { transform: scale(.99); }
.accueil:focus { outline: none; }
.supprime { margin: 0; padding: 12px 16px; text-align: center; }
.attend { margin: 0; padding: 10px 14px; border-radius: var(--r-s); font-size: .92rem;
  background: color-mix(in srgb, var(--menthe) 45%, var(--carte)); color: var(--texte); }
</style>
