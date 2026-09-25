<script setup lang="ts">
const invite = useState<any>('pwa_invite', () => null)
const installe = useState<boolean>('pwa_installe', () => false)
const aide = ref(false)

// iOS n'implemente pas beforeinstallprompt : la seule voie est « Partager →
// Sur l'ecran d'accueil ». On le dit, plutot que de cacher le bouton.
const ios = computed(() => typeof navigator !== 'undefined'
  && /iphone|ipad|ipod/i.test(navigator.userAgent))

const visible = computed(() => !installe.value && (invite.value || ios.value))

async function installer() {
  if (ios.value && !invite.value) { aide.value = !aide.value; return }
  const e = invite.value
  if (!e) return
  e.prompt()
  const { outcome } = await e.userChoice
  if (outcome === 'accepted') installe.value = true
  invite.value = null
}
</script>

<template>
  <!-- Un vrai bouton (et non une div cliquable) : atteignable au clavier et
       annonce comme tel. Contenu en <span> : un bouton n'accepte pas de <p>. -->
  <button v-if="visible" type="button" class="tuile carte degrade"
          :aria-expanded="ios && !invite ? aide : undefined" @click="installer">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />
    </svg>
    <span class="textes">
      <strong>Installer l’application</strong>
      <span class="mini ligne-2">
        {{ ios ? 'Sur l’écran d’accueil, comme une vraie app' : 'Plein écran, hors ligne, sans navigateur' }}
      </span>
      <span v-if="aide" class="mini aide">
        Touchez <strong>Partager</strong> en bas de Safari, puis
        <strong>Sur l’écran d’accueil</strong>.
      </span>
    </span>
  </button>
</template>

<style scoped>
.tuile { display: flex; align-items: center; gap: 13px; cursor: pointer; color: var(--encre);
  width: 100%; text-align: left; font: inherit; border: 0;
  padding: 16px 18px; position: relative; overflow: hidden; }
.tuile:active { transform: scale(.99); }
svg { width: 26px; height: 26px; flex: none; stroke: currentColor; fill: none;
  stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.textes { display: flex; flex-direction: column; }
.ligne-2 { margin: 2px 0 0; opacity: .85; }
.aide { display: block; margin-top: 7px; opacity: 1; line-height: 1.45; }
</style>
