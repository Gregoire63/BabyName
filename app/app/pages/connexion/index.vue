<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { chargerCatalogue, trouverPrenom } from '~/composables/useCatalogue'
import { passkeysPossibles, connecterPasskey, abandonnerPasskey } from '~/composables/usePasskey'

/**
 * Entrer : sans mot de passe, et sans rien à recopier.
 *
 *  - Nouveau : un prénom suffit. Juste après, on propose de quoi retrouver
 *    le compte ailleurs (SecuriserCompte) — passkey, e-mail, ou plus tard.
 *  - Déjà un compte : la passkey (Face ID, empreinte, code du téléphone), ou
 *    un lien reçu par e-mail, doublé d'un code pour l'app installée.
 *  - Les comptes d'avant gardent leur clé d'accès, en petit en bas.
 */
const route = useRoute()
const pseudo = ref('')
const cle = ref('')
const mode = ref<'choix' | 'email' | 'cle'>('choix')
const envoi = ref(false)
const erreur = ref('')
/** Le compte vient d'être créé : l'étape « pour retrouver votre compte ». */
const nouveau = ref(false)
const passkeyPossible = ref(false)
const courrielPossible = useCourrielPossible()
const erreurPasskey = ref('')

useHead({ title: 'Connexion' })

// Retour d'une suppression de compte : on le dit, plutot que de laisser
// croire a une simple deconnexion.
const compteSupprime = computed(() => route.query.compte === 'supprime')

const invitation = computed(() => normaliserCodeInvitation(route.query.code))

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

function messageErreur(e: any, defaut: string) {
  return e?.data?.statusMessage === 'trop_d_essais'
    ? 'Trop d’essais d’un coup depuis cette connexion. Réessayez dans un moment.'
    : defaut
}

async function creer() {
  erreur.value = ''
  if (pseudo.value.trim().length < 2) { erreur.value = 'Il faut au moins deux lettres.'; return }
  envoi.value = true
  try {
    await $fetch<any>('/api/auth/entrer', { method: 'POST', body: { pseudo: pseudo.value } })
    await rafraichirMoi()
    abandonnerPasskey()
    nouveau.value = true
  } catch (e: any) {
    erreur.value = messageErreur(e, 'Création impossible. Réessayez dans un instant.')
  } finally { envoi.value = false }
}

async function avecPasskey() {
  if (envoi.value) return
  erreurPasskey.value = ''
  envoi.value = true
  const r = await connecterPasskey()
  envoi.value = false
  if (r.ok) return suite()
  erreurPasskey.value = r.message
}

function versEmail() {
  mode.value = 'email'; erreur.value = ''
  // Le champ de l'adresse propose aussi les passkeys du téléphone (clavier) :
  // qui a une passkey et ne s'en souvient pas la retrouve là.
  nextTick(() => { if (passkeyPossible.value) connecterPasskey(true).then(r => { if (r.ok) suite() }) })
}
function versChoix() { abandonnerPasskey(); mode.value = 'choix'; erreur.value = '' }

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
      : messageErreur(e, 'Clé incomplète.')
  } finally { envoi.value = false }
}

/**
 * En developpement : entrer d'un geste avec un compte du jeu d'essai
 * (outils-dev/OutilsConnexion.vue). Importe seulement si `import.meta.dev` :
 * au build, l'import disparait avec tout ce qu'il contient.
 */
const OutilsDev = import.meta.dev
  ? defineAsyncComponent(() => import('~/outils-dev/OutilsConnexion.vue')) : null
async function entrerComme(c: string) {
  cle.value = c
  await reprendre()
}

onMounted(async () => {
  if (await rafraichirMoi()) return suite()
  passkeyPossible.value = passkeysPossibles()
  if (!prenomDemande.value) return
  // Le catalogue servira de toute facon juste apres : autant le charger ici.
  const cat = await chargerCatalogue().catch(() => null)
  prenomVu.value = cat ? trouverPrenom(cat.liste, prenomDemande.value)?.l ?? '' : ''
})
onBeforeUnmount(() => abandonnerPasskey())
</script>

<template>
  <main id="contenu" class="accueil" tabindex="-1">
    <p v-if="compteSupprime && !nouveau" class="carte mini supprime" role="status">
      Votre compte et vos données ont été supprimés.
    </p>

    <!-- 1. le compte vient d'être créé : comment le retrouver ailleurs -->
    <template v-if="nouveau">
      <div class="haut">
        <img src="/logo.png" alt="" width="58" height="58">
        <h1>Bonjour {{ pseudo.trim() }}</h1>
      </div>
      <SecuriserCompte @suite="suite" />
    </template>

    <!-- 2. un lien par e-mail -->
    <template v-else-if="mode === 'email'">
      <div class="haut">
        <img src="/logo.png" alt="" width="58" height="58">
        <h1>Recevoir un lien</h1>
      </div>
      <div class="carte pile">
        <FormulaireEmail but="connexion" @fait="suite" />
        <button type="button" class="btn btn-0 doux" @click="versChoix">Retour</button>
      </div>
    </template>

    <!-- 3. l'ancienne clé d'accès -->
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
        <p class="mini doux" style="margin:0">
          Pour les comptes créés avant les passkeys. Une fois entré, ajoutez une
          passkey ou votre e-mail dans « Mon compte » : la clé ne sera plus utile.
        </p>
        <button type="button" class="btn btn-0 doux" @click="versChoix">Retour</button>
      </div>
    </template>

    <!-- 4. première venue, ou retour -->
    <template v-else>
      <div class="haut">
        <img src="/logo.png" alt="" width="66" height="66">
        <h1>babyNamed</h1>
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
        <p v-if="erreur && mode === 'choix'" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreur }}</p>
        <p class="mini doux" style="margin:0">
          Pas de mot de passe. Juste après, vous choisirez comment retrouver votre
          compte sur un autre appareil : une passkey, ou un lien par e-mail.
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

      <div v-if="passkeyPossible || courrielPossible" class="carte pile">
        <h2 class="deja">Vous avez déjà un compte ?</h2>
        <button v-if="passkeyPossible" type="button" class="btn" :disabled="envoi" @click="avecPasskey">
          Se connecter avec une passkey
        </button>
        <button v-if="courrielPossible" type="button" class="btn" @click="versEmail">
          Recevoir un lien par e-mail
        </button>
        <p v-if="erreurPasskey" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreurPasskey }}</p>
      </div>

      <button type="button" class="btn btn-0 doux mini" @click="mode = 'cle'; erreur = ''">
        J’ai déjà une clé
      </button>

      <component :is="OutilsDev" v-if="OutilsDev" :occupe="envoi" @entrer="entrerComme" />
    </template>

    <PiedLegal compact />
  </main>
</template>

<style scoped>
.accueil { height: 100%; overflow-y: auto; display: flex; flex-direction: column;
  gap: 18px; max-width: 460px; margin: 0 auto;
  padding: max(24px, env(safe-area-inset-top)) 18px calc(28px + env(safe-area-inset-bottom)); }
/* Centré quand ça tient, et qui défile depuis le HAUT quand ça ne tient pas :
   `justify-content: center` coupait le logo sur un petit écran, sans qu'on
   puisse remonter jusqu'à lui. */
.accueil > :first-child { margin-top: auto; }
.accueil > :last-child { margin-bottom: auto; }
.haut { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.haut img { border-radius: 17px; }
.haut h1 { font-size: 1.7rem; }
.haut p { margin: 0; }
.deja { font-size: .98rem; }
.champ.grand { text-align: center; font-size: 1.25rem; letter-spacing: .1em;
  font-variant-numeric: tabular-nums; padding: 16px 12px; }
.accueil:focus { outline: none; }
.supprime { margin: 0; padding: 12px 16px; text-align: center; }
.attend { margin: 0; padding: 10px 14px; border-radius: var(--r-s); font-size: .92rem;
  background: color-mix(in srgb, var(--menthe) 45%, var(--carte)); color: var(--texte); }
</style>
