<script setup lang="ts">
/**
 * Le code de l'e-mail, copié d'un geste : /connexion/code#c=123456.
 *
 * Un e-mail ne sait rien faire quand on le touche — ni copier, ni le dire :
 * aucun script n'y tourne. Le code y est donc un LIEN qui mène ici, et c'est
 * cette page qui copie, puis le dit. On revient alors dans l'app, où le
 * clavier propose de coller.
 *
 * Elle ne valide rien, ne consomme rien et ne parle à aucun serveur. Le code
 * voyage après le « # » (envoyé ni à nous, ni à un tiers), il est retiré de
 * l'adresse dès la lecture, et il ne vaut rien sans l'adresse e-mail qui l'a
 * reçu. Six chiffres, sinon rien : la page ne copie pas ce qu'on lui tend.
 *
 * COPIER SANS GESTE n'est permis que par certains navigateurs (Chrome, tant
 * que la page a le focus) ; Safari et Firefox veulent un toucher. On essaie
 * donc à l'arrivée ; si le navigateur refuse, il reste un seul bouton,
 * « Copier le code ». Dans les deux cas l'écran DIT ce qui s'est passé
 * (role="status") — c'est la moitié de ce qu'on attend d'un bouton « copier ».
 */
useHead({ title: 'Votre code' })

const code = ref('')
const etat = ref<'lecture' | 'a-copier' | 'copie' | 'absent'>('lecture')
/** La copie demandée d'un geste a échoué : le code reste à sélectionner à la main. */
const rate = ref(false)

/** Écrit dans le presse-papiers. `geste` : on vient de toucher un bouton. */
async function ecrire(texte: string, geste: boolean): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte)
    return true
  } catch { /* refusé (ni geste, ni focus), ou pas de presse-papiers ici */ }
  if (!geste) return false
  // Le repli des vues web et des vieux navigateurs : une sélection, puis
  // « copier ». Il ne marche que dans la foulée d'un geste.
  const zone = document.createElement('textarea')
  zone.value = texte
  zone.setAttribute('readonly', '')
  zone.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0'
  document.body.appendChild(zone)
  zone.select()
  let fait = false
  try { fait = document.execCommand('copy') } catch { fait = false }
  zone.remove()
  return fait
}

async function copier() {
  rate.value = false
  if (await ecrire(code.value, true)) etat.value = 'copie'
  else rate.value = true
}

onMounted(async () => {
  const m = location.hash.match(/^#c=(\d{6})(?:&.*)?$/)
  history.replaceState(history.state, '', location.pathname)
  if (!m) { etat.value = 'absent'; return }
  code.value = m[1]!
  etat.value = (await ecrire(code.value, false)) ? 'copie' : 'a-copier'
})
</script>

<template>
  <div class="page-code">
  <Ambiance />
  <main id="contenu" class="code" tabindex="-1">
    <div class="haut">
      <img src="/logo.png" alt="" width="58" height="58">
      <h1>babyNamed</h1>
    </div>

    <div class="carte pile">
      <template v-if="etat === 'absent'">
        <h2>Code introuvable</h2>
        <p class="mini" style="margin:0" role="alert">
          L’adresse s’est coupée en route. Rouvrez l’e-mail et touchez le code,
          ou tapez-le dans l’app.
        </p>
        <NuxtLink to="/connexion" class="btn" style="text-align:center">Aller à la connexion</NuxtLink>
      </template>

      <template v-else>
        <h2>Votre code</h2>
        <!-- Le code lui-même se touche, comme dans l'e-mail. La copie a
             échoué : il devient un texte, qui se sélectionne d'un toucher. -->
        <p v-if="rate" class="chiffres a-la-main">{{ code }}</p>
        <button v-else type="button" class="chiffres" :aria-label="`Copier le code ${code}`"
                :disabled="etat === 'lecture'" @click="copier">{{ code }}</button>

        <!-- Toujours là, d'abord vide : un lecteur d'écran n'annonce que ce
             qui CHANGE dans une zone qu'il connaît déjà. -->
        <p class="fait" role="status">
          <template v-if="etat === 'copie'">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            Code copié
          </template>
        </p>

        <button v-if="etat === 'a-copier' && !rate" type="button" class="btn btn-1" @click="copier">
          Copier le code
        </button>
        <p v-if="rate" class="mini" style="margin:0" role="alert">
          La copie n’a pas marché ici. Sélectionnez le code, ou tapez-le dans l’app.
        </p>
        <p v-if="etat === 'copie'" class="mini doux" style="margin:0">
          Revenez dans babyNamed et collez-le.
        </p>
      </template>
    </div>

    <PiedLegal compact />
  </main>
  </div>
</template>

<style scoped>
.page-code { height: 100%; }
.code { height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 18px;
  padding: max(24px, env(safe-area-inset-top)) max(18px, calc(50% - 230px))
    calc(28px + env(safe-area-inset-bottom)); }
.haut { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.haut img { border-radius: 17px; }
.haut h1 { font-size: 1.5rem; }
.code:focus { outline: none; }
.code > :first-child { margin-top: auto; }
.code > :last-child { margin-bottom: auto; }
.carte { text-align: center; align-items: center; }
/* L'écart entre les chiffres est de la mise en forme : le texte, lui, tient
   d'un seul tenant — c'est lui qu'on copie, qu'on sélectionne, qu'on lit. */
.chiffres { margin: 0; padding: 10px 14px 10px calc(14px + .22em); border-radius: var(--r-s);
  border: 1px solid var(--trait); background: var(--fond); color: var(--encre);
  font: inherit; font-size: 2.1rem; font-weight: 800; letter-spacing: .22em;
  font-variant-numeric: tabular-nums; line-height: 1.2; min-height: 44px; }
button.chiffres { cursor: pointer; }
.chiffres.a-la-main { user-select: all; -webkit-user-select: all; }
.fait { margin: 0; min-height: 1.5em; display: inline-flex; align-items: center; gap: 6px;
  font-weight: 800; color: var(--oui); }
/* Vide, elle reste dans l'arbre (c'est ce qui la fera annoncer) sans tenir de place. */
.fait:empty { position: absolute; min-height: 0; }
.fait svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.6;
  stroke-linecap: round; stroke-linejoin: round; }
</style>
