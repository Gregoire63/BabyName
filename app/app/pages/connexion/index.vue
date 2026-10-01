<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { chargerCatalogue, trouverPrenom } from '~/composables/useCatalogue'
import { passkeysPossibles, connecterPasskey, abandonnerPasskey } from '~/composables/usePasskey'

/**
 * Entrer : deux onglets, Inscription et Connexion — rien d'autre à comprendre.
 *
 *  - Inscription : un prénom et une adresse e-mail ; le compte naît du code
 *    (ou du lien) reçu à cette adresse. Une adresse qui a déjà un compte
 *    reçoit de quoi y entrer, et l'écran n'en dit rien (inscription.post.ts).
 *  - Connexion : l'e-mail (un lien, doublé d'un code pour l'app installée —
 *    le champ propose aussi les passkeys du téléphone), ou la passkey d'un geste.
 *
 * On arrive sur Connexion après une déconnexion (`?mode=connexion`) : c'est
 * là qu'on veut revenir, pas sur un second compte créé par erreur.
 */
const route = useRoute()
const { ouvrir: ouvrirLegal } = useFeuilleLegale()
const pseudo = ref('')
/** Entré par e-mail : la passkey est proposée avant de continuer (ProposerPasskey). */
const proposerPasskey = ref(false)
const ONGLETS = ['inscription', 'connexion'] as const
const onglet = ref<'inscription' | 'connexion'>(route.query.mode === 'connexion' ? 'connexion' : 'inscription')
const idOnglets = useId()
const envoi = ref(false)
const passkeyPossible = ref(false)
const courrielPossible = useCourrielPossible()
const erreurPasskey = ref('')

// L'entrée de l'app est aussi ce que les moteurs voient à la racine (/ y mène
// qui n'est pas connecté) : un titre qui dit ce que fait l'app, pas « Connexion ».
useHead({ title: 'babyNamed : choisir le prénom de bébé à deux' })

// Retour d'une suppression de compte : on le dit, plutot que de laisser
// croire a une simple deconnexion.
const compteSupprime = computed(() => route.query.compte === 'supprime')

const invitation = computed(() => normaliserCodeInvitation(route.query.code))
/** Un code cadeau venu d'un lien : il attend de l'autre côté de la connexion. */
const cadeau = computed(() => normaliserCodeCadeau(route.query.cadeau))
const cadeauDe = ref('')

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

/**
 * Un chemin de retour vers les pages publiques. L'entrée de l'app remplace
 * l'adresse (navigateTo … replace) et, installée, l'app n'a pas de bouton
 * « Retour » : sans ce lien, qui arrivait d'une fiche prénom ne pouvait plus
 * y revenir. Calculé au montage (document.referrer n'existe que côté client).
 */
const referrer = ref('')
const retour = computed(() => retourPublic(referrer.value, prenomDemande.value, prenomVu.value))

/** Invitation et prénom suivent jusqu'à l'accueil, qui en fait l'entrée. */
function suite() {
  oublierEntree()
  abandonnerPasskey()
  const query: Record<string, string> = {}
  if (invitation.value) query.code = invitation.value
  if (prenomDemande.value) query.prenom = prenomDemande.value
  if (cadeau.value) query.cadeau = cadeau.value
  return navigateTo({ path: '/', query }, { replace: true })
}

/**
 * Entré par e-mail (inscription ou connexion) : à la première connexion d'un
 * compte sans passkey, on la propose avant de continuer.
 */
async function entreParEmail() {
  await rafraichirMoi()
  if (fautProposerPasskey()) { proposerPasskey.value = true; return }
  await suite()
}

/** Un e-mail est parti : si son lien s'ouvre dans un autre onglet, il saura
 *  où mener (utils/entreeEnAttente). */
function emailParti() {
  retenirEntree({ code: invitation.value, prenom: prenomDemande.value })
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

/**
 * L'onglet Connexion : le champ de l'adresse propose aussi les passkeys du
 * téléphone (clavier) — qui a une passkey et ne s'en souvient pas la retrouve là.
 */
function choisirOnglet(o: 'inscription' | 'connexion', focus = false) {
  if (onglet.value !== o) {
    onglet.value = o
    erreurPasskey.value = ''
  }
  if (o === 'connexion') {
    // L'autofill échoue en silence (rien n'a été demandé à personne), sauf
    // quand la passkey choisie au clavier a été retirée du compte : ça, on le dit.
    nextTick(() => {
      if (passkeyPossible.value) {
        connecterPasskey(true).then(r => {
          if (r.ok) suite()
          else if (r.inconnue) erreurPasskey.value = r.message
        })
      }
    })
  } else {
    abandonnerPasskey()
  }
  if (focus) nextTick(() => document.getElementById(`${idOnglets}-${o}`)?.focus())
}
/** Motif ARIA des onglets : les flèches passent de l'un à l'autre. */
function auClavier(e: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
  e.preventDefault()
  const o = e.key === 'Home' ? 'inscription' : e.key === 'End' ? 'connexion'
    : onglet.value === 'inscription' ? 'connexion' : 'inscription'
  choisirOnglet(o, true)
}

/**
 * En developpement : entrer d'un geste avec un compte du jeu d'essai
 * (outils-dev/OutilsConnexion.vue). Importe seulement si `import.meta.dev` :
 * au build, l'import disparait avec tout ce qu'il contient.
 */
const OutilsDev = import.meta.dev
  ? defineAsyncComponent(() => import('~/outils-dev/OutilsConnexion.vue')) : null
async function entreEnDev() {
  await rafraichirMoi()
  await suite()
}

onMounted(async () => {
  referrer.value = document.referrer
  if (await rafraichirMoi()) return suite()
  passkeyPossible.value = passkeysPossibles()
  if (onglet.value === 'connexion') choisirOnglet('connexion')
  if (cadeau.value) {
    // Le lien de connexion par e-mail s'ouvre ailleurs, sans ce paramètre :
    // l'appareil le garde (utils/cadeauEnAttente).
    retenirCadeauEnAttente(cadeau.value)
    $fetch<any>(`/api/cadeaux/verifier?code=${cadeau.value}`)
      .then(v => { if (v?.valide && v.de_la_part) cadeauDe.value = v.de_la_part })
      .catch(() => null)
  }
  if (!prenomDemande.value) return
  // Le catalogue servira de toute facon juste apres : autant le charger ici.
  const cat = await chargerCatalogue().catch(() => null)
  prenomVu.value = cat ? trouverPrenom(cat.liste, prenomDemande.value)?.l ?? '' : ''
})
onBeforeUnmount(() => abandonnerPasskey())
</script>

<template>
  <main id="contenu" class="accueil" tabindex="-1">
    <Ambiance />
    <p v-if="compteSupprime" class="carte mini supprime" role="status">
      Votre compte et vos données ont été supprimés.
    </p>

    <!-- entré par e-mail : la passkey, proposée une fois -->
    <template v-if="proposerPasskey">
      <div class="haut">
        <img src="/logo.png" alt="" width="58" height="58">
        <h1>babyNamed</h1>
      </div>
      <div class="carte">
        <ProposerPasskey @fini="suite" />
      </div>
    </template>

    <!-- inscription ou connexion -->
    <template v-else>
      <!-- vers les pages publiques : un vrai lien, ce ne sont pas des pages de l'app -->
      <a :href="retour.href" class="retour">
        <span aria-hidden="true">←</span> {{ retour.texte }}
      </a>
      <div class="haut">
        <img src="/logo.png" alt="" width="66" height="66">
        <h1>babyNamed</h1>
        <p class="doux">Choisir un prénom à deux, sans s’influencer.</p>
      </div>

      <p v-if="prenomVu" class="attend">
        Votre liste commencera par <strong>{{ prenomVu }}</strong>.
      </p>
      <p v-if="invitation" class="attend">
        Une liste vous a été partagée : vous y entrez juste après.
      </p>
      <p v-if="cadeau" class="attend">
        <strong>{{ cadeauDe ? `${cadeauDe} vous offre babyNamed` : 'Un cadeau vous attend' }}</strong> :
        une liste débloquée.
      </p>

      <div class="carte pile">
        <div class="segment-entree" role="tablist" aria-label="Inscription ou connexion" @keydown="auClavier">
          <button v-for="o in ONGLETS" :id="`${idOnglets}-${o}`" :key="o"
                  type="button" role="tab" :aria-selected="onglet === o"
                  :aria-controls="`${idOnglets}-panneau`" :tabindex="onglet === o ? 0 : -1"
                  @click="choisirOnglet(o)">
            {{ o === 'inscription' ? 'Inscription' : 'Connexion' }}
          </button>
        </div>

        <div :id="`${idOnglets}-panneau`" role="tabpanel" :aria-labelledby="`${idOnglets}-${onglet}`"
             class="pile" style="gap:12px">
          <template v-if="onglet === 'inscription'">
            <FormulaireEmail v-if="courrielPossible !== false" but="inscription" :pseudo="pseudo"
                             @envoye="emailParti" @fait="entreParEmail">
              <template #avant>
                <label :for="`${idOnglets}-prenom`" class="mini doux">Votre prénom</label>
                <input :id="`${idOnglets}-prenom`" v-model="pseudo" class="champ" placeholder="Camille"
                       autocomplete="given-name" maxlength="40">
              </template>
              <!-- L'information au moment de la collecte (RGPD, art. 13) : une
                   ligne ici, le détail derrière le lien. -->
              <template #apres>
                <p class="mini doux" style="margin:0">
                  En créant un compte, vous acceptez les
                  <a href="/conditions" class="lien" aria-haspopup="dialog" @click.prevent="ouvrirLegal('/conditions')">conditions</a>.
                  <a href="/confidentialite" class="lien" aria-haspopup="dialog" @click.prevent="ouvrirLegal('/confidentialite')">Vos données</a> ne servent
                  qu’à faire marcher l’app.
                </p>
              </template>
            </FormulaireEmail>
            <p v-else class="mini doux" style="margin:0">
              Les inscriptions ne sont pas encore ouvertes.
            </p>
          </template>

          <template v-else>
            <FormulaireEmail v-if="courrielPossible !== false" but="connexion" @envoye="emailParti" @fait="entreParEmail" />
            <button v-if="passkeyPossible" type="button" class="btn" :disabled="envoi" @click="avecPasskey">
              Se connecter avec une passkey
            </button>
            <p v-if="erreurPasskey" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreurPasskey }}</p>
            <p v-if="courrielPossible === false && !passkeyPossible" class="mini doux" style="margin:0">
              Ce navigateur ne sait pas se servir d’une passkey. Ouvrez babyNamed sur le
              téléphone où vous l’avez créée.
            </p>
          </template>
        </div>
      </div>

      <component :is="OutilsDev" v-if="OutilsDev" :occupe="envoi" @entre="entreEnDev" />
    </template>

    <PiedLegal compact />
  </main>
</template>

<style scoped>
.accueil { height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 18px;
  /* toute la largeur défile (la barre au bord de la fenêtre, pas au milieu
     de l'écran) ; la colonne, elle, garde 460 px */
  /* haut : juste de quoi respirer (avant : jusqu'à 9vh, soit ~70 px sur un
     téléphone — un défilement pour rien, le formulaire passait sous le pli) */
  padding: max(clamp(12px, 2.5vh, 28px), env(safe-area-inset-top)) max(18px, calc(50% - 230px))
    calc(28px + env(safe-area-inset-bottom)); }
/* Ancré en HAUT, pas centré : centré, tout sautait dès qu'un bloc arrivait
   après coup (la bannière d'un prénom, les outils de dev) — en revenant des
   conditions, le formulaire « arrivait par le bas ». Et sur un téléphone, le
   clavier couvre le bas de l'écran : un formulaire en haut reste visible.
   Le pied de page, lui, reste en bas. */
.accueil > :last-child { margin-top: auto; }
/* Écran bas (la plupart des téléphones) : le formulaire d'inscription entier
   doit tenir sans défiler — logo et espacements se resserrent. */
@media (max-height: 860px) {
  .accueil { gap: 12px; }
  .haut { gap: 4px; }
  .haut img { width: 52px; height: 52px; border-radius: 14px; }
  .haut h1 { font-size: 1.45rem; }
}
@media (max-height: 700px) {
  .haut img { width: 44px; height: 44px; border-radius: 12px; }
  .haut h1 { font-size: 1.3rem; }
}
.retour { align-self: flex-start; margin: -8px 0 -6px; padding: 8px 2px; font-weight: 700;
  font-size: .95rem; color: var(--doux); text-decoration: none; }
.retour:hover { color: var(--texte); }
.retour:focus-visible { outline: 2px solid var(--encre); outline-offset: 2px; border-radius: 6px; }
.haut { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.haut img { border-radius: 17px; }
.haut h1 { font-size: 1.7rem; }
.haut p { margin: 0; }
/* Deux onglets en segment : Inscription | Connexion. (Pas « .onglets » : c'est
   la barre du bas de l'app, en style global.) */
.segment-entree { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px;
  border-radius: 14px; background: var(--fond); border: 1px solid var(--trait); }
.segment-entree button { border: 0; border-radius: 10px; padding: 9px 8px; font: inherit; font-weight: 700;
  font-size: .95rem; background: none; color: var(--doux); cursor: pointer;
  transition: background .16s, color .16s; }
.segment-entree button[aria-selected="true"] { background: var(--encre); color: var(--fond); }
.segment-entree button:focus-visible { outline: 2px solid var(--encre); outline-offset: 2px; }
.accueil:focus { outline: none; }
.supprime { margin: 0; padding: 12px 16px; text-align: center; }
.attend { margin: 0; padding: 10px 14px; border-radius: var(--r-s); font-size: .92rem;
  background: color-mix(in srgb, var(--menthe) 45%, var(--carte)); color: var(--texte); }
</style>
