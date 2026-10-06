<script setup lang="ts">
/**
 * Après le paiement d'un cadeau : le code, à transmettre.
 *
 * Le serveur relit la session chez Stripe (rien ne se fie à l'adresse) et
 * rend le code. L'identifiant de session reste dans l'adresse, exprès :
 * recharger la page doit redonner le code, et c'est l'onglet de l'acheteur.
 *
 * Deux façons de le donner : le LIEN (un toucher, et la feuille du cadeau
 * s'ouvre chez le destinataire) et le CODE (pour une carte écrite à la main).
 */
useHead({ title: 'Votre cadeau' })
const route = useRoute()
const sessionId = typeof route.query.session_id === 'string' ? route.query.session_id : ''

const charge = ref(false)
const erreur = ref('')
const c = ref<{ statut: 'pret' | 'en_attente' | 'utilise' | 'annule'; code: string;
                de_la_part: string | null; message: string | null; expire_le: string | null } | null>(null)
const copie = ref('')

const nu = computed(() => c.value ? normaliserCodeCadeau(c.value.code) : '')
const lien = computed(() => nu.value ? `${location.origin}/?cadeau=${nu.value}` : '')
const jusquau = computed(() => c.value?.expire_le
  ? new Date(c.value.expire_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  : '')
const texte = computed(() => {
  const qui = c.value?.de_la_part ? `${c.value.de_la_part} vous offre` : 'Je vous offre'
  const mot = c.value?.message ? `« ${c.value.message} »\n` : ''
  return `${mot}${qui} babyNamed : une liste débloquée pour choisir le prénom de votre bébé à deux, ` +
    `sans vous influencer. Ouvrez le lien, ou tapez le code ${c.value?.code} sur babynamed.fr.`
})

onMounted(async () => {
  if (!sessionId) { erreur.value = 'sans_session'; charge.value = true; return }
  // Un prélèvement peut ne pas être encaissé à l'instant du retour : on
  // redemande quelques fois avant de dire « en cours ».
  for (const pause of [0, 1200, 2500]) {
    if (pause) await new Promise(r => setTimeout(r, pause))
    try {
      c.value = await $fetch<any>(`/api/cadeaux/session?session_id=${encodeURIComponent(sessionId)}`)
      erreur.value = ''
      if (c.value?.statut !== 'en_attente') break
    } catch (e: any) {
      erreur.value = e?.data?.statusMessage ?? 'indisponible'
    }
  }
  charge.value = true
})

async function partager() {
  if (navigator.share) {
    try { await navigator.share({ title: 'Un cadeau babyNamed', text: texte.value, url: lien.value }); return }
    catch { /* partage annulé : on n'insiste pas */ }
    return
  }
  await copier('lien')
}

async function copier(quoi: 'lien' | 'code') {
  try {
    await navigator.clipboard.writeText(quoi === 'lien' ? `${texte.value}\n${lien.value}` : c.value!.code)
    copie.value = quoi
    setTimeout(() => { copie.value = '' }, 1800)
  } catch { /* presse-papiers refusé : le code reste lisible à l'écran */ }
}
</script>

<template>
  <main id="contenu" class="accueil" tabindex="-1">
    <Ambiance />
    <div class="haut">
      <NuxtLink to="/" aria-label="babyNamed, accueil">
        <img src="/logo.png" alt="" width="66" height="66">
      </NuxtLink>
      <h1>Votre cadeau</h1>
    </div>

    <div v-if="!charge" class="carte pile" aria-busy="true">
      <Squelette l="60%" :h="22" :r="8" />
      <Squelette l="90%" :h="44" :r="12" :retard="0.06" />
    </div>

    <div v-else-if="erreur || !c" class="carte pile" role="alert">
      <p style="margin:0">
        {{ erreur === 'sans_session' || erreur === 'session_introuvable'
          ? 'Cette page ne correspond à aucun achat de cadeau.'
          : 'Le cadeau n’a pas pu être relu. Rechargez la page dans un instant : rien n’est perdu, le code figure aussi sur la facture envoyée par e-mail.' }}
      </p>
      <NuxtLink to="/offrir" class="btn">Offrir babyNamed</NuxtLink>
    </div>

    <template v-else>
      <section class="carte pile code-carte" aria-labelledby="titre-code">
        <Etincelles class="deco" :taille="28" couleur="var(--peche)" />
        <h2 id="titre-code" class="mini doux" style="margin:0">
          {{ c.statut === 'pret' ? 'Merci ! Le code à transmettre'
            : c.statut === 'en_attente' ? 'Paiement en cours d’encaissement'
            : c.statut === 'utilise' ? 'Ce cadeau a déjà été ouvert'
            : 'Ce cadeau a été annulé' }}
        </h2>
        <p class="code" aria-label="Code cadeau">{{ c.code }}</p>
        <p v-if="c.statut === 'en_attente'" class="mini" style="margin:0">
          Le code vaudra dès que le paiement sera encaissé (un prélèvement prend
          quelques jours). Il figure déjà sur la facture envoyée par e-mail.
        </p>
        <p v-else-if="c.statut === 'pret'" class="mini" style="margin:0">
          Valable jusqu’au {{ jusquau }}. Il figure aussi sur la facture.
        </p>
        <p v-if="c.de_la_part || c.message" class="mini doux" style="margin:0">
          Ils liront : <strong>{{ c.de_la_part ?? 'Quelqu’un' }}</strong> vous offre
          babyNamed<template v-if="c.message"> : « {{ c.message }} »</template>
        </p>
      </section>

      <div v-if="c.statut === 'pret' || c.statut === 'en_attente'" class="pile" style="gap:10px">
        <button type="button" class="btn btn-1" @click="partager">Envoyer le lien</button>
        <button type="button" class="btn" @click="copier('lien')">
          {{ copie === 'lien' ? 'Copié' : 'Copier le message et le lien' }}
        </button>
        <button type="button" class="btn btn-0" @click="copier('code')">
          {{ copie === 'code' ? 'Copié' : 'Copier le code seul' }}
        </button>
        <p class="mini doux" style="margin:0">
          Le code seul se tape sur babynamed.fr, sous « Rejoindre une liste ».
        </p>
      </div>

      <NuxtLink to="/offrir" class="lien mini" style="align-self:center">Offrir un autre cadeau</NuxtLink>
    </template>

    <PiedLegal compact />
  </main>
</template>

<style scoped>
.accueil { height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 18px;
  /* toute la largeur défile (la barre au bord de la fenêtre, pas au milieu
     de l'écran) ; la colonne, elle, garde 460 px */
  padding: max(24px, env(safe-area-inset-top)) max(18px, calc(50% - 230px))
    calc(28px + env(safe-area-inset-bottom)); }
.accueil:focus { outline: none; }
.haut { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.haut img { border-radius: 17px; display: block; }
.haut h1 { font-size: 1.7rem; }
.code-carte { position: relative; text-align: center; align-items: center;
  background: linear-gradient(160deg, color-mix(in srgb, var(--menthe) 40%, var(--carte)) 0%,
    color-mix(in srgb, var(--peche) 30%, var(--carte)) 100%); }
.code-carte .deco { position: absolute; top: 12px; right: 14px; }
.code { margin: 4px 0; font-size: clamp(1.4rem, 7.2vw, 1.9rem); font-weight: 800; letter-spacing: .08em;
  font-variant-numeric: tabular-nums; user-select: all; }
</style>
