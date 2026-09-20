<script setup lang="ts">
onMounted(() => { rafraichirMoi() })
</script>

<template>
  <NuxtPage />
</template>

<style>
/* ---------------------------------------------------------------------------
   Identite tiree du logo, et pas seulement de ses couleurs.

   Ce que dit le dessin : un trait cursif d'epaisseur constante a bouts ronds,
   deux etincelles a quatre branches, un degrade pastel menthe -> peche en
   diagonale, et un carre tres arrondi (le rayon vaut pres d'un quart du cote).

   Ce qu'on en tire : une typographie arrondie, des rayons genereux, des
   boutons en pastille, des icones au trait epais et rond, un fond legerement
   degrade, et l'etincelle comme unique ornement — reservee aux moments ou il
   se passe quelque chose de bien.
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

  /* Le logo arrondit son carre a ~23 % du cote : on en garde l'esprit. */
  --r:       22px;   /* cartes */
  --r-s:     15px;   /* champs, petits blocs */
  --pastille: 999px; /* boutons */

  --ombre:   0 1px 2px rgba(26,35,78,.05), 0 12px 32px -14px rgba(26,35,78,.18);
  --degrade: linear-gradient(135deg, var(--menthe) 0%, var(--sable) 52%, var(--peche) 100%);
  /* Lavis d'ambiance : le degrade du logo, tres dilue, en haut de page. */
  --lavis: radial-gradient(120% 55% at 12% -8%, color-mix(in srgb, var(--menthe) 55%, transparent) 0%, transparent 62%),
           radial-gradient(110% 50% at 95% -4%, color-mix(in srgb, var(--peche) 48%, transparent) 0%, transparent 58%);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fond: #101321; --carte: #191d2e; --trait: #2a2f45;
    --texte: #eef0f7; --doux: #9298b2; --encre: #eef0f7;
    --menthe: #2c4a44; --peche: #4d3330; --sable: #33313c;
    --oui: #4fc095; --non: #e2726b;
    --ombre: 0 1px 2px rgba(0,0,0,.35), 0 12px 32px -14px rgba(0,0,0,.65);
    --lavis: radial-gradient(120% 55% at 12% -8%, rgba(44,74,68,.55) 0%, transparent 62%),
             radial-gradient(110% 50% at 95% -4%, rgba(77,51,48,.5) 0%, transparent 58%);
  }
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body, #__nuxt { height: 100%; }
body {
  margin: 0; color: var(--texte);
  background: var(--lavis), var(--fond);
  background-attachment: fixed;
  /* ui-rounded = SF Pro Rounded sur Apple, gratuit et deja installe.
     Nunito prend le relais ailleurs : c'est la fonte qui se rapproche le
     plus du trait cursif du monogramme. */
  font: 500 16px/1.5 ui-rounded, 'SF Pro Rounded', Nunito, system-ui,
        -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  /* le glissement des cartes ne doit JAMAIS faire defiler la page */
  overflow: hidden; overscroll-behavior: none;
}
h1, h2, h3 { margin: 0; line-height: 1.18; font-weight: 800; letter-spacing: -.015em; }
h1 { font-size: 1.45rem; } h2 { font-size: 1.05rem; } h3 { font-size: .92rem; }
strong, b { font-weight: 800; }
a { color: inherit; text-decoration: none; }
button { font: inherit; color: inherit; }

/* --------------------------------------------------------------- briques */
.carte { background: var(--carte); border: 1px solid var(--trait);
  border-radius: var(--r); padding: 18px; box-shadow: var(--ombre); }

.btn { appearance: none; border: 1px solid var(--trait); background: var(--carte);
  border-radius: var(--pastille); padding: 13px 22px; font-weight: 700; cursor: pointer;
  transition: transform .07s ease, opacity .15s; }
.btn:active { transform: scale(.97); }
.btn:disabled { opacity: .4; cursor: default; }
.btn-1 { background: var(--encre); border-color: var(--encre); color: var(--fond); }
.btn-0 { background: transparent; border-color: transparent; padding: 10px 14px; }

.champ { width: 100%; padding: 14px 17px; border: 1px solid var(--trait);
  border-radius: var(--r-s); background: var(--carte); color: var(--texte); font: inherit; }
.champ:focus { outline: 2px solid var(--encre); outline-offset: -1px; }

.doux { color: var(--doux); }
.mini { font-size: .8rem; }
.pile { display: flex; flex-direction: column; gap: 14px; }
.ligne { display: flex; align-items: center; gap: 10px; }
.puce { display: inline-flex; align-items: center; padding: 5px 12px; border-radius: var(--pastille);
  background: color-mix(in srgb, var(--menthe) 60%, transparent);
  font-size: .74rem; font-weight: 700; letter-spacing: .01em; }
.vide { text-align: center; color: var(--doux); padding: 46px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 12px; }
.vide h2 { color: var(--texte); }
.vide p { margin: 0; }
.degrade { background: var(--degrade); }

/* ------------------------------------------------------------- navigation */
.onglets { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
  display: flex; background: color-mix(in srgb, var(--fond) 88%, transparent);
  backdrop-filter: blur(16px); border-top: 1px solid var(--trait);
  padding-bottom: env(safe-area-inset-bottom); }
/* quatre onglets, plus six : les libelles peuvent enfin se lire */
.onglets button { flex: 1; min-width: 0; background: none; border: 0; padding: 9px 2px 11px;
  color: var(--doux); font-size: .69rem; font-weight: 700; cursor: pointer;
  display: grid; justify-items: center; gap: 3px; transition: color .15s;
  white-space: nowrap; letter-spacing: -.01em; }
.onglets button.on { color: var(--encre); }
/* trait epais a bouts ronds, comme le monogramme : a 21 px, un trait de 2
   restait maigre a cote du reste de l'interface */
.onglets svg { width: 21px; height: 21px; stroke: currentColor; fill: none;
  stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }

/* ------------------------------------------------------------------ pager */
.pager { display: flex; height: 100%; overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory; scrollbar-width: none; }
.pager::-webkit-scrollbar { display: none; }
.pager > section { flex: 0 0 100%; scroll-snap-align: start; overflow-y: auto;
  overscroll-behavior-y: contain; padding: max(18px, env(safe-area-inset-top)) 16px 84px; }
</style>
