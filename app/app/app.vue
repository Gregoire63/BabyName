<script setup lang="ts">
onMounted(() => { rafraichirMoi() })

// Chaque page donne son titre ; le nom de l'app suit (RGAA 8.6).
useHead({
  titleTemplate: (t?: string) => (t && t !== 'babyNames' ? `${t} · babyNames` : 'babyNames')
})

/**
 * Lien d'evitement (RGAA 12.7). Un <a href="#contenu"> ordinaire changerait
 * le hash, donc la route : le routeur rejouerait la transition de page. On
 * deplace simplement le focus sur le contenu principal de la page affichee.
 */
function allerAuContenu() {
  const el = document.getElementById('contenu')
  if (!el) return
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus()
}
</script>

<template>
  <a href="#contenu" class="evitement" @click.prevent="allerAuContenu">Aller au contenu</a>
  <!-- Annonce le titre de chaque nouvelle page aux lecteurs d'ecran : dans
       une application d'une seule page, rien d'autre ne leur dit qu'on a
       change d'ecran. -->
  <NuxtRouteAnnouncer />
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

/* Nunito, servie par l'app elle-meme. Elle venait de Google Fonts : chaque
   ouverture envoyait l'adresse IP du visiteur a Google, un transfert que rien
   ne justifiait (CNIL ; LG Munchen, 2022). Deux sous-ensembles par graisse,
   charges seulement si un caractere de la page en a besoin (unicode-range). */
@font-face { font-family: 'Nunito'; font-style: normal; font-weight: 500; font-display: swap;
  src: url('~/assets/fonts/nunito-latin-500-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
@font-face { font-family: 'Nunito'; font-style: normal; font-weight: 600; font-display: swap;
  src: url('~/assets/fonts/nunito-latin-600-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
@font-face { font-family: 'Nunito'; font-style: normal; font-weight: 700; font-display: swap;
  src: url('~/assets/fonts/nunito-latin-700-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
@font-face { font-family: 'Nunito'; font-style: normal; font-weight: 800; font-display: swap;
  src: url('~/assets/fonts/nunito-latin-800-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
@font-face { font-family: 'Nunito'; font-style: normal; font-weight: 500; font-display: swap;
  src: url('~/assets/fonts/nunito-latin-ext-500-normal.woff2') format('woff2');
  unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
@font-face { font-family: 'Nunito'; font-style: normal; font-weight: 600; font-display: swap;
  src: url('~/assets/fonts/nunito-latin-ext-600-normal.woff2') format('woff2');
  unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
@font-face { font-family: 'Nunito'; font-style: normal; font-weight: 700; font-display: swap;
  src: url('~/assets/fonts/nunito-latin-ext-700-normal.woff2') format('woff2');
  unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }
@font-face { font-family: 'Nunito'; font-style: normal; font-weight: 800; font-display: swap;
  src: url('~/assets/fonts/nunito-latin-ext-800-normal.woff2') format('woff2');
  unicode-range: U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF; }

:root {
  --encre:   #1a234e;
  --menthe:  #cae1d9;
  --peche:   #ecbbb6;
  --sable:   #dfd2cc;

  --fond:    #fbfaf9;
  --carte:   #ffffff;
  --trait:   #ece7e3;
  --texte:   #1a234e;
  /* Contraste AA (4,5:1) sur la carte ET sur le fond (RGAA 3.2) : l'ancien
     gris-bleu tombait a 4,0:1, le vert et le rouge a 4,2 et 4,4. La teinte
     reste la meme, seule la valeur descend. */
  --doux:    #5f6480;

  --oui:     #237458;
  --non:     #a8443e;
  --neutre:  #6e6e82;
  /* L'anneau de focus : visible sur tout ce qui peut le porter (3:1 mini). */
  --focus:   #1a234e;

  /* Le logo arrondit son carre a ~23 % du cote : on en garde l'esprit. */
  --r:       22px;   /* cartes */
  --r-s:     15px;   /* champs, petits blocs */
  --pastille: 999px; /* boutons */

  --ombre:   0 1px 2px rgba(26,35,78,.05), 0 12px 32px -14px rgba(26,35,78,.18);
  /* lueur qui balaie les squelettes de chargement */
  --lueur:   rgba(255,255,255,.75);
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
    --oui: #4fc095; --non: #e2726b; --neutre: #a4a4b6; --focus: #eef0f7;
    --ombre: 0 1px 2px rgba(0,0,0,.35), 0 12px 32px -14px rgba(0,0,0,.65);
    --lueur: rgba(255,255,255,.075);
    --lavis: radial-gradient(120% 55% at 12% -8%, rgba(44,74,68,.55) 0%, transparent 62%),
             radial-gradient(110% 50% at 95% -4%, rgba(77,51,48,.5) 0%, transparent 58%);
  }
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

/* ------------------------------------------------------- accessibilite */
/* Le focus se voit, partout, des qu'on navigue au clavier (RGAA 10.7). Pas au
   doigt ni a la souris : :focus-visible fait le tri. */
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.btn:focus-visible, .puce:focus-visible { outline-offset: 3px; }

/* Lu par les lecteurs d'ecran, invisible a l'ecran. */
.sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }

/* Lien d'evitement : hors champ, il apparait au premier Tab. */
.evitement { position: absolute; left: 12px; top: -80px; z-index: 200; padding: 10px 18px;
  border-radius: var(--pastille); background: var(--encre); color: var(--fond);
  font-weight: 800; text-decoration: none; }
.evitement:focus { top: max(12px, env(safe-area-inset-top)); }

/* Un lien dans un texte se distingue autrement que par la couleur (RGAA 10.6). */
.lien { color: inherit; text-decoration: underline; text-underline-offset: 3px;
  text-decoration-thickness: 1px; }

/* Mouvement reduit : on coupe tout, pas seulement les transitions de page.
   L'envol d'une carte, la pluie d'etincelles, les squelettes qui respirent
   sont des decors — personne ne doit en avoir la nausee (WCAG 2.3.3). */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important;
  }
}
html, body, #__nuxt { height: 100%; }
/* les deux pages se superposent pendant le glissement */
#__nuxt { position: relative; overflow: hidden; }
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
/* quatre cibles, plus six : les libelles peuvent enfin se lire */
.onglets button, .onglets a { flex: 1; min-width: 0; background: none; border: 0;
  padding: 9px 2px 11px; color: var(--doux); font-size: .69rem; font-weight: 700;
  cursor: pointer; text-decoration: none;
  display: grid; justify-items: center; gap: 3px; transition: color .15s;
  white-space: nowrap; letter-spacing: -.01em; }
.onglets button.on { color: var(--encre); }
/* la sortie n'est pas un onglet : elle quitte la liste, elle ne s'allume
   jamais, et le filet la detache des trois onglets de la liste */
.onglets .sortie { position: relative; }
.onglets .sortie::after { content: ''; position: absolute; right: 0; top: 22%; bottom: 22%;
  width: 1px; background: var(--trait); }
/* trait epais a bouts ronds, comme le monogramme : a 21 px, un trait de 2
   restait maigre a cote du reste de l'interface */
.onglets svg { width: 21px; height: 21px; stroke: currentColor; fill: none;
  stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }

/* ------------------------------------------------- glissement entre pages */
/* Les deux pages sont dans le DOM en meme temps : sans position absolue elles
   se partageraient la hauteur. La barre du bas etant dans la page de la
   liste, elle glisse avec — on entre dans la liste, on n'echange pas un
   ecran contre un autre. */
.page-enter-active, .page-leave-active {
  position: absolute; inset: 0;
  /* Opaques pendant le glissement : le fond etait sur <body> seulement, et
     la page qui arrivait laissait voir celle qui partait au travers — les
     pages legales comme la liste. Le meme fond que body, donc rien ne change
     une fois arrive. */
  background: var(--lavis), var(--fond);
  transition: transform .34s cubic-bezier(.32,.72,0,1), opacity .34s ease;
}
/* Celle qui bouge passe dessus : la page qui arrive quand on avance, celle
   qui s'en va quand on recule. L'ombre dit son bord. */
[data-sens="avant"] .page-enter-active, [data-sens="arriere"] .page-leave-active {
  z-index: 1; box-shadow: -14px 0 32px -20px rgba(26,35,78,.4);
}
/* on entre : la liste vient de la droite, l'accueil recule derriere elle */
[data-sens="avant"] .page-enter-from { transform: translateX(100%); }
[data-sens="avant"] .page-leave-to   { transform: translateX(-22%); opacity: .55; }
/* on ressort : la liste repart a droite, l'accueil revient de la gauche */
[data-sens="arriere"] .page-enter-from { transform: translateX(-22%); opacity: .55; }
[data-sens="arriere"] .page-leave-to   { transform: translateX(100%); }

@media (prefers-reduced-motion: reduce) {
  .page-enter-active, .page-leave-active { transition-duration: .01ms; }
  [data-sens] .page-enter-from, [data-sens] .page-leave-to { transform: none; }
}

/* ------------------------------------------------------------------ pager */
.pager { display: flex; height: 100%; overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory; scrollbar-width: none; }
.pager::-webkit-scrollbar { display: none; }
.pager > section { flex: 0 0 100%; scroll-snap-align: start; overflow-y: auto;
  overscroll-behavior-y: contain; padding: max(18px, env(safe-area-inset-top)) 16px 84px; }
</style>
