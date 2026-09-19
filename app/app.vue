<script setup lang="ts">
onMounted(() => { rafraichirMoi() })
</script>

<template>
  <NuxtPage />
</template>

<style>
/* ---------------------------------------------------------------------------
   Palette tirée du logo : encre bleu nuit, dégradé menthe → pêche.
   Une seule couleur d'encre, deux pastels. Rien d'autre.
--------------------------------------------------------------------------- */
:root {
  --encre:   #1a234e;
  --menthe:  #cae1d9;
  --peche:   #ecbbb6;
  --sable:   #dfd2cc;

  --fond:    #fbfaf9;
  --carte:   #ffffff;
  --trait:   #ece7e3;
  --texte:   #1a234e;
  --doux:    #767b93;

  --oui:     #2e8b6b;
  --non:     #c4564f;
  --neutre:  #9a9aa8;

  --r:       18px;
  --ombre:   0 1px 2px rgba(26,35,78,.05), 0 10px 30px -12px rgba(26,35,78,.16);
  --degrade: linear-gradient(135deg, var(--menthe) 0%, var(--sable) 52%, var(--peche) 100%);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fond: #101321; --carte: #191d2e; --trait: #2a2f45;
    --texte: #eef0f7; --doux: #9298b2; --encre: #eef0f7;
    --menthe: #2c4a44; --peche: #4d3330; --sable: #33313c;
    --oui: #4fc095; --non: #e2726b;
    --ombre: 0 1px 2px rgba(0,0,0,.35), 0 10px 30px -12px rgba(0,0,0,.6);
  }
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body, #__nuxt { height: 100%; }
body {
  margin: 0; background: var(--fond); color: var(--texte);
  font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  /* le glissement des cartes ne doit JAMAIS faire défiler la page */
  overflow: hidden; overscroll-behavior: none;
}
h1, h2, h3 { margin: 0; line-height: 1.2; font-weight: 640; letter-spacing: -.02em; }
h1 { font-size: 1.45rem; } h2 { font-size: 1.05rem; } h3 { font-size: .92rem; }
a { color: inherit; text-decoration: none; }
button { font: inherit; color: inherit; }

/* --------------------------------------------------------------- briques */
.carte { background: var(--carte); border: 1px solid var(--trait);
  border-radius: var(--r); padding: 18px; box-shadow: var(--ombre); }

.btn { appearance: none; border: 1px solid var(--trait); background: var(--carte);
  border-radius: 13px; padding: 12px 18px; font-weight: 560; cursor: pointer;
  transition: transform .07s ease, opacity .15s; }
.btn:active { transform: scale(.97); }
.btn:disabled { opacity: .4; cursor: default; }
.btn-1 { background: var(--encre); border-color: var(--encre); color: var(--fond); }
.btn-0 { background: transparent; border-color: transparent; }

.champ { width: 100%; padding: 13px 15px; border: 1px solid var(--trait);
  border-radius: 13px; background: var(--carte); color: var(--texte); font: inherit; }
.champ:focus { outline: 2px solid var(--encre); outline-offset: -1px; }

.doux { color: var(--doux); }
.mini { font-size: .8rem; }
.pile { display: flex; flex-direction: column; gap: 14px; }
.ligne { display: flex; align-items: center; gap: 10px; }
.puce { display: inline-flex; align-items: center; padding: 4px 11px; border-radius: 999px;
  background: color-mix(in srgb, var(--menthe) 60%, transparent);
  font-size: .74rem; font-weight: 600; letter-spacing: .01em; }
.vide { text-align: center; color: var(--doux); padding: 54px 20px; }
.degrade { background: var(--degrade); }

/* ------------------------------------------------------------- navigation */
.onglets { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
  display: flex; background: color-mix(in srgb, var(--fond) 92%, transparent);
  backdrop-filter: blur(14px); border-top: 1px solid var(--trait);
  padding-bottom: env(safe-area-inset-bottom); }
.onglets button { flex: 1; background: none; border: 0; padding: 10px 2px 12px;
  color: var(--doux); font-size: .68rem; font-weight: 600; cursor: pointer;
  display: grid; justify-items: center; gap: 3px; transition: color .15s; }
.onglets button.on { color: var(--encre); }
.onglets svg { width: 21px; height: 21px; stroke: currentColor; fill: none;
  stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

/* ------------------------------------------------------------------ pager */
.pager { display: flex; height: 100%; overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory; scrollbar-width: none; }
.pager::-webkit-scrollbar { display: none; }
.pager > section { flex: 0 0 100%; scroll-snap-align: start; overflow-y: auto;
  overscroll-behavior-y: contain; padding: max(18px, env(safe-area-inset-top)) 16px 84px; }
</style>
