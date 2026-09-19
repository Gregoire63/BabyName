<script setup lang="ts">
onMounted(() => { rafraichirMoi() })
</script>

<template>
  <NuxtPage />
</template>

<style>
:root {
  --fond: #fbf9f7;
  --carte: #ffffff;
  --trait: #e6e0d9;
  --texte: #1f1c19;
  --doux: #6d655c;
  --accent: #b4543a;
  --accent-doux: #f6e8e3;
  --oui: #2f7d5c;
  --non: #b03a3a;
  --neutre: #8a8178;
  --rayon: 14px;
  --ombre: 0 1px 2px rgba(31,28,25,.06), 0 8px 24px rgba(31,28,25,.06);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fond: #16151a;
    --carte: #1f1e24;
    --trait: #33313a;
    --texte: #f0ece8;
    --doux: #a49d95;
    --accent: #e08268;
    --accent-doux: #33231e;
    --oui: #5cc394;
    --non: #e3706e;
    --neutre: #8e867d;
    --ombre: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.3);
  }
}
:root[data-theme="dark"] {
  --fond: #16151a; --carte: #1f1e24; --trait: #33313a; --texte: #f0ece8;
  --doux: #a49d95; --accent: #e08268; --accent-doux: #33231e;
  --oui: #5cc394; --non: #e3706e; --neutre: #8e867d;
}

* { box-sizing: border-box; }
html, body, #__nuxt { height: 100%; }
body {
  margin: 0; background: var(--fond); color: var(--texte);
  font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior-y: contain;
}
h1, h2, h3 { line-height: 1.25; margin: 0; font-weight: 650; letter-spacing: -.015em; }
h1 { font-size: 1.5rem; }
h2 { font-size: 1.1rem; }
a { color: inherit; }

.page { max-width: 560px; margin: 0 auto; padding: 16px 16px 96px; }
.entete { display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--fond) 88%, transparent);
  backdrop-filter: blur(10px); border-bottom: 1px solid var(--trait); }
.entete h1 { font-size: 1.05rem; flex: 1; }

.carte { background: var(--carte); border: 1px solid var(--trait);
  border-radius: var(--rayon); padding: 16px; box-shadow: var(--ombre); }

.btn { appearance: none; border: 1px solid var(--trait); background: var(--carte);
  color: var(--texte); border-radius: 10px; padding: 11px 16px; font: inherit;
  font-weight: 550; cursor: pointer; transition: transform .06s, background .15s; }
.btn:active { transform: scale(.97); }
.btn-principal { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-fantome { background: transparent; }
.btn:disabled { opacity: .45; cursor: default; }

.champ { width: 100%; padding: 11px 13px; border: 1px solid var(--trait);
  border-radius: 10px; background: var(--carte); color: var(--texte); font: inherit; }
.champ:focus { outline: 2px solid var(--accent); outline-offset: -1px; }

.doux { color: var(--doux); }
.mini { font-size: .82rem; }
.pile { display: flex; flex-direction: column; gap: 12px; }
.ligne { display: flex; align-items: center; gap: 10px; }
.etiq { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px;
  border-radius: 999px; background: var(--accent-doux); color: var(--accent);
  font-size: .76rem; font-weight: 600; }
.vide { text-align: center; color: var(--doux); padding: 48px 16px; }

.onglets { position: fixed; left: 0; right: 0; bottom: 0; display: flex;
  background: color-mix(in srgb, var(--fond) 94%, transparent); backdrop-filter: blur(10px);
  border-top: 1px solid var(--trait); padding-bottom: env(safe-area-inset-bottom); z-index: 20; }
.onglets a { flex: 1; text-align: center; padding: 11px 4px 13px; text-decoration: none;
  color: var(--doux); font-size: .72rem; font-weight: 600; }
.onglets a.actif { color: var(--accent); }
.onglets .pastille { display: block; font-size: 1.15rem; line-height: 1.3; }
</style>
