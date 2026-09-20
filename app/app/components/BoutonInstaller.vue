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
  <div v-if="visible" class="tuile carte degrade" @click="installer">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />
    </svg>
    <div>
      <strong>Installer l’application</strong>
      <p class="mini" style="margin:2px 0 0;opacity:.72">
        {{ ios ? 'Sur l’écran d’accueil, comme une vraie app' : 'Plein écran, hors ligne, sans navigateur' }}
      </p>
      <p v-if="aide" class="mini aide">
        Touchez <strong>Partager</strong> en bas de Safari, puis
        <strong>Sur l’écran d’accueil</strong>.
      </p>
    </div>
  </div>
</template>

<style scoped>
.tuile { display: flex; align-items: center; gap: 13px; cursor: pointer; color: var(--encre);
  padding: 16px 18px; position: relative; overflow: hidden; }
.tuile:active { transform: scale(.99); }
svg { width: 26px; height: 26px; flex: none; stroke: currentColor; fill: none;
  stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.aide { margin-top: 7px; opacity: 1; line-height: 1.45; }
</style>
