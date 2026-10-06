<script setup lang="ts">
import { chargerCatalogue, frequenceLisible, pourcentAn, trouverPrenom, type Prenom, type Filtres }
  from '~/composables/useCatalogue'
import { listeCourante } from '~/composables/useListeCourante'

/**
 * L'accueil, hors de toute liste. C'est le seul ecran sans barre du bas :
 * cette barre n'apparait que dans une liste, et c'est precisement ce qui dit
 * qu'on y est. Ce qui touche au compte vit ici, pas dans les reglages d'une
 * liste — un nom et des facons de se connecter n'appartiennent a aucune liste.
 */
useHead({ title: 'Accueil' })

const compteOuvert = ref(false)
const rejoindreOuvert = ref(false)
const offrirOuvert = ref(false)
/** Le code cadeau qu'on regarde (feuille « Un cadeau pour vous »). */
const cadeauOuvert = ref('')

/**
 * Dans une app des stores : pas d'« Offrir », pas de bouton « Installer »
 * (c'est fait), pas de lien vers les pages publiques, qui vendent. Et un code
 * cadeau ne s'y utilise pas : un code qui débloque est, pour Apple, une clé
 * de licence. On dit seulement où il s'utilise — la liste débloquée sur le
 * site l'est aussi ici (useVente, server/utils/vente.ts).
 */
const coquille = useCoquille()
const vente = useVente()
const cadeauSurLeSite = ref(false)
function voirCadeau(code: string) {
  rejoindreOuvert.value = false
  if (vente.ouverte) cadeauOuvert.value = code
  else cadeauSurLeSite.value = true
}
/** Le code cadeau qui créera la liste en cours de création (AssistantFiltres). */
const cadeauPourNouvelle = ref('')

const moi = useMoi()
const groupes = ref<any[]>([])
const chargement = ref(true)
const assistant = ref(false)
const catalogue = ref<Prenom[]>([])
const annee = ref(2025)

/**
 * Une erreur serveur n'est PAS une deconnexion.
 *
 * L'ancienne version renvoyait vers /connexion des que cet appel echouait,
 * quelle qu'en soit la raison. Comme /connexion renvoie vers l'accueil quand
 * la session est valide, une simple 500 suffisait a faire clignoter l'app
 * entre les deux ecrans, indefiniment. Seul un 401 doit ramener a la
 * connexion ; le reste s'affiche.
 */
const panne = ref('')
async function charger() {
  panne.value = ''
  try {
    groupes.value = await $fetch('/api/groupes')
  } catch (e: any) {
    const code = e?.statusCode ?? e?.response?.status
    if (code === 401) return navigateTo('/connexion')
    panne.value = code === 403
      ? 'Accès refusé.'
      : `Le serveur n’a pas répondu correctement${code ? ` (erreur ${code})` : ''}.`
  } finally { chargement.value = false }
}

/**
 * Un prénom demandé par l'adresse : `/?prenom=louise`, le bouton des fiches
 * publiques (scripts/seo.mjs). Il sera la première carte de la liste où l'on
 * entre — celle en cours, ou celle qu'on va créer (SectionTrier le lit).
 */
const premier = ref('')
const premierNom = computed(() =>
  premier.value ? trouverPrenom(catalogue.value, premier.value)?.l ?? '' : '')

async function creer(filtres: Filtres) {
  const query: Record<string, string> = premier.value ? { prenom: premier.value } : {}
  // Une liste neuve offerte : le cadeau la crée, débloquée d'emblée. S'il ne
  // peut plus servir (utilisé entre-temps sur un autre appareil…), la
  // feuille du cadeau se rouvre et dit pourquoi.
  if (cadeauPourNouvelle.value) {
    const code = cadeauPourNouvelle.value
    cadeauPourNouvelle.value = ''
    try {
      const r = await $fetch<any>('/api/cadeaux/utiliser',
        { method: 'POST', body: { code, nouvelle: true, filtres } })
      oublierCadeauEnAttente()
      premier.value = ''
      return navigateTo({ path: `/g/${r.groupe}/swipe`, query: { ...query, offerte: '1' } })
    } catch {
      assistant.value = false
      cadeauOuvert.value = code
      return
    }
  }
  const g = await $fetch<any>('/api/groupes', { method: 'POST', body: { filtres } })
  premier.value = ''
  await navigateTo({ path: `/g/${g.id}/swipe`, query: Object.keys(query).length ? query : undefined })
}

/** « Créer une nouvelle liste » depuis la feuille du cadeau : les questions
 *  habituelles d'abord, le cadeau ensuite (creer). */
function nouvelleOfferte(code: string) {
  cadeauOuvert.value = ''
  cadeauPourNouvelle.value = code
  assistant.value = true
}

function fermerCadeau() {
  cadeauOuvert.value = ''
  oublierCadeauEnAttente()
}

/**
 * Les liens qui arrivent de dehors : invitation (`?code=`) et prénom
 * (`?prenom=`).
 *
 * Tous deux traversent la connexion. C'est justement quelqu'un qui n'a pas
 * encore de compte qui les suit : le code se perdait en route, et la personne
 * invitée arrivait sur un accueil vide, sans la liste qu'on venait de lui
 * partager.
 *
 * Les redirections REMPLACENT l'entrée d'historique : avec un simple ajout, le
 * bouton retour ramenait sur `/?code=…`, qui renvoyait aussitôt dans la
 * liste — on ne pouvait plus en sortir.
 */
onMounted(async () => {
  const q = useRoute().query
  const code = normaliserCodeInvitation(q.code)
  const prenom = typeof q.prenom === 'string' ? q.prenom.trim().slice(0, 60) : ''
  const avecPrenom = prenom ? { prenom } : {}
  // Un code cadeau (`/?cadeau=…`, le lien que l'acheteur a transmis) : gardé
  // sur l'appareil le temps de la connexion (voir utils/cadeauEnAttente).
  const cadeauLien = normaliserCodeCadeau(q.cadeau)
  // Dans une app des stores, le cadeau ne se garde ni ne s'ouvre : il
  // s'utilise sur le site (voirCadeau).
  if (cadeauLien && vente.ouverte) retenirCadeauEnAttente(cadeauLien)

  if (!(await rafraichirMoi())) {
    return navigateTo({ path: '/connexion', query: {
      ...(code ? { code } : {}), ...avecPrenom, ...(cadeauLien ? { cadeau: cadeauLien } : {}) } },
      { replace: true })
  }
  const cadeau = cadeauLien || (vente.ouverte ? lireCadeauEnAttente() : '')
  if (cadeau) {
    // L'adresse redevient celle de l'accueil : recharger ne rouvre pas la feuille
    // d'un cadeau déjà utilisé.
    if (cadeauLien) history.replaceState(history.state, '', '/')
    voirCadeau(cadeau)
  }
  // Lien d'invitation : on entre directement, sans faire retaper le code.
  if (code) {
    const g = await $fetch<any>('/api/groupes/rejoindre', { method: 'POST', body: { code } })
      .catch(() => null)
    if (g) return navigateTo({ path: `/g/${g.id}/swipe`, query: avecPrenom }, { replace: true })
  }
  if (prenom) {
    // L'adresse redevient celle de l'accueil : recharger ne rejoue pas la demande.
    history.replaceState(history.state, '', '/')
    await charger()
    if (principale.value) {
      return navigateTo({ path: `/g/${principale.value.id}/swipe`, query: avecPrenom },
        { replace: true })
    }
    // Pas encore de liste : on la crée, et le prénom l'attend dedans.
    if (!panne.value) { premier.value = prenom; assistant.value = true }
  }
  await demarrer(!prenom)
})

async function demarrer(listes = true) {
  if (listes) charger()
  const cat = await chargerCatalogue()
  catalogue.value = cat!.liste
  annee.value = cat!.annees[1]
}

// --- la liste en cours en grand, les autres en dessous ---------------------
// Ce n'est pas la premiere creee qui va en haut, c'est celle qu'on trie en ce
// moment : sinon la liste qu'on vient de quitter reapparait sous « Mes autres
// listes », ce qui est exactement le contraire de ce qu'on cherche.
const courante = ref<string | null>(null)
onMounted(() => { courante.value = listeCourante() })
const principale = computed(() =>
  groupes.value.find(g => g.id === courante.value) ?? groupes.value[0] ?? null)
const autres = computed(() =>
  groupes.value.filter(g => g.id !== principale.value?.id))

/**
 * Retour dans la liste en cours par le bord droit.
 *
 * L'accueil est une sortie, pas une destination : on y passe pour changer de
 * liste ou regarder les chiffres de l'annee, et on veut revenir la ou on
 * triait. La tirette dit qu'il y a quelque chose a droite ; on peut la tirer
 * ou simplement la toucher, parce qu'un geste que personne ne devine n'existe
 * pas.
 */
const BORD = 32          // largeur de la zone sensible, en px
const SEUIL_BORD = 56    // de combien il faut tirer
let bx = 0, by = 0, auBord = false
const tire = ref(0)

function entrerListe() {
  if (principale.value) navigateTo(`/g/${principale.value.id}/swipe`)
}
function bordDebut(e: PointerEvent) {
  auBord = !!principale.value && e.clientX > window.innerWidth - BORD
  if (!auBord) return
  bx = e.clientX; by = e.clientY; tire.value = 0
  // Sans capture, des que le doigt quitte la tirette (c'est-a-dire tout de
  // suite, puisqu'on tire vers la gauche) les pointermove et le pointerup
  // partent ailleurs : le geste ne se terminait jamais.
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function bordBouge(e: PointerEvent) {
  if (!auBord) return
  const ax = bx - e.clientX
  tire.value = Math.max(0, Math.min(SEUIL_BORD, ax))
}
function bordFin(e: PointerEvent) {
  if (!auBord) return
  auBord = false
  const el = e.currentTarget as HTMLElement
  if (el?.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
  const ax = bx - e.clientX
  const dy = Math.abs(e.clientY - by)
  tire.value = 0
  if (ax > SEUIL_BORD && dy < ax) entrerListe()
}

const quandDernier = (d: string | null) => {
  if (!d) return 'pas encore commencée'
  const j = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  return j === 0 ? 'aujourd’hui' : j === 1 ? 'hier' : `il y a ${j} jours`
}

// --- statistiques de l'année ----------------------------------------------
/**
 * « Les plus donnes » se classait sur `n`, le nombre de naissances sur TROIS
 * ans, sous un titre qui annoncait une annee. Les deux ne donnent pas le meme
 * palmares : sur 2025 seul, Noah repasse devant Leo et Alma entre chez les
 * filles. On classe donc sur le dernier point de la serie annuelle, qui est
 * bien l'annee affichee. Repli sur `f` pour les prenoms sans serie (les plus
 * rares — jamais dans un top 3).
 */
const derniereAnnee = (p: Prenom) => p.sr?.length ? p.sr[p.sr.length - 1]! : p.f

const stats = computed(() => {
  const l = catalogue.value
  if (!l.length) return null
  const solide = l.filter(p => p.n >= 250)
  const top = (s: 'f' | 'm') => l.filter(p => p.sexe === s)
    .sort((a, b) => derniereAnnee(b) - derniereAnnee(a)).slice(0, 3)
  const monte = [...solide].sort((a, b) => b.t - a.t).slice(0, 3)
  const tombe = [...solide].sort((a, b) => a.t - b.t).slice(0, 3)
  const guetter = [...l].filter(p => p.n >= 150).sort((a, b) => b.r - a.r).slice(0, 3)
  const revivals = l.filter(p => p.rv && p.n >= 120).sort((a, b) => b.t - a.t).slice(0, 3)
  return { topF: top('f'), topM: top('m'), monte, tombe, guetter, revivals, total: l.length }
})

// Repere de version : « suis-je bien sur la derniere ? » doit se repondre
// d'un coup d'oeil, et un appui long donne la sortie de secours.
const version = computed(() => String(useRuntimeConfig().app.buildId ?? '').slice(0, 7))
const purge = ref(false)
async function vider() {
  purge.value = true
  try {
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k)
    if ('serviceWorker' in navigator) {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
    }
  } catch { /* rien a vider */ }
  location.reload()
}

const fiche = ref<Prenom | null>(null)
const parNom = computed(() => new Map(catalogue.value.map(p => [p.l, p])))
const ouvrir = (n: string) => { fiche.value = parNom.value.get(n) ?? null }
</script>

<template>
  <div class="ecran page">
    <Ambiance />
    <main id="contenu" class="defile page" tabindex="-1">
      <header class="tete">
        <img src="/logo.png" alt="" width="34" height="34">
        <h1 style="flex:1">babyNamed</h1>
        <!-- Le nom visible est dans le nom accessible (WCAG 2.5.3) : « Mon
             compte : Paul » se dit et se commande a la voix par « Paul ». -->
        <button type="button" class="qui" :aria-label="`Mon compte : ${moi?.pseudo ?? ''}`"
                @click="compteOuvert = true">
          <span>{{ moi?.pseudo ?? '…' }}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8.6" r="3.4" /><path d="M5 19.4a7 7 0 0 1 14 0" />
          </svg>
        </button>
      </header>

      <!-- Un compte sans passkey ni e-mail n'existe que sur cet appareil :
           perdu avec lui. On le dit ici, une ligne, jusqu'a ce que ce soit
           regle — pas une fenetre qui bloque le tri. -->
      <button v-if="moi && moi.moyens === 0" type="button" class="carte proteger"
              @click="compteOuvert = true">
        <strong>Ce compte n’existe que sur cet appareil</strong>
        <span class="mini">Ajoutez une passkey ou votre e-mail pour le retrouver ailleurs.</span>
      </button>

      <div v-if="chargement" class="bento" aria-busy="true">
        <div class="carte grande fantome">
          <Squelette l="96px" :h="12" />
          <Squelette l="62%" :h="30" :r="10" :retard="0.06" />
          <div class="ligne" style="gap:16px;margin-top:4px">
            <Squelette l="66px" :h="34" :r="10" :retard="0.1" />
            <Squelette l="66px" :h="34" :r="10" :retard="0.14" />
            <Squelette l="66px" :h="34" :r="10" :retard="0.18" />
          </div>
        </div>
        <div class="carte tuile colonne fantome" style="min-height:118px">
          <Squelette l="34px" :h="34" :r="999" :retard="0.2" />
          <Squelette l="78%" :h="15" :retard="0.24" />
        </div>
        <div class="carte tuile colonne fantome" style="min-height:118px">
          <Squelette l="34px" :h="34" :r="999" :retard="0.26" />
          <Squelette l="78%" :h="15" :retard="0.3" />
        </div>
        <div v-for="b in 2" :key="b" class="carte large colonne fantome">
          <Squelette l="130px" :h="11" :retard="0.32 + b * 0.04" />
          <Squelette v-for="i in 3" :key="i" :l="`${74 - i * 9}%`" :h="17"
                     :retard="0.34 + b * 0.04 + i * 0.05" />
        </div>
      </div>

      <div v-else-if="panne" class="carte pile panne">
        <h2>Ça coince côté serveur</h2>
        <p class="mini" style="margin:0">{{ panne }}</p>
        <p class="mini doux" style="margin:0">
          Votre session est intacte : c’est la liste qui n’a pas pu être lue.
        </p>
        <button class="btn btn-1" @click="chargement = true; charger()">Réessayer</button>
        <button class="btn btn-0 doux" @click="compteOuvert = true">Mon compte</button>
      </div>

      <div v-else class="bento">
        <!-- liste en cours -->
        <NuxtLink v-if="principale" :to="`/g/${principale.id}/swipe`"
                  class="carte degrade grande">
          <Etincelles class="deco" :taille="30" />
          <p class="etiquette">Liste en cours</p>
          <h2 class="titre">{{ principale.nom }}</h2>
          <div class="ligne chiffres">
            <span><strong>{{ principale.mes_votes }}</strong> {{ pluriel(principale.mes_votes, 'jugé', 'jugés') }} par vous</span>
            <span><strong>{{ principale.nb_communs }}</strong> en commun</span>
            <span><strong>{{ principale.nb_membres }}</strong> {{ principale.nb_membres > 1 ? 'membres' : 'membre' }}</span>
          </div>
          <p class="mini" style="margin:0;opacity:.85">
            Dernier vote {{ quandDernier(principale.derniere_activite) }}
          </p>
        </NuxtLink>

        <div v-else class="carte degrade grande accueil">
          <Etincelles class="deco" :taille="30" />
          <h2 class="titre">Commencez ici</h2>
          <p class="mini" style="margin:0;opacity:.85">
            Chacun trie de son côté, sans voir le vote de l’autre.
          </p>
        </div>

        <!-- actions -->
        <button class="carte tuile colonne creer" @click="assistant = true">
          <span class="rond">＋</span>
          <strong>{{ groupes.length ? 'Une autre liste' : 'Créer ma liste' }}</strong>
          <span class="mini doux">Quelques questions, puis on trie</span>
        </button>

        <button class="carte tuile colonne creer" @click="rejoindreOuvert = true">
          <span class="rond">→</span>
          <strong>Rejoindre une liste</strong>
          <span class="mini doux">Avec le code de quelqu’un</span>
        </button>

        <BoutonInstaller v-if="!coquille.dansApp" class="large" />

        <p v-if="cadeauSurLeSite" class="carte large mini" role="status" style="margin:0">
          Un code cadeau s’utilise sur le site babynamed.fr, pas dans l’app.
          La liste y sera débloquée, et ici aussi.
        </p>

        <!-- Offrir : les futurs parents autour de soi sont le meilleur endroit
             où trouver les suivants. Une feuille, ici même (FeuilleOffrir). -->
        <button v-if="vente.ouverte" type="button" class="carte large offrir" @click="offrirOuvert = true">
          <Etincelles :taille="18" couleur="var(--peche)" une />
          <span style="flex:1;min-width:0">
            <strong>Offrir babyNamed</strong>
            <span class="mini doux" style="display:block">À des futurs parents : une liste débloquée</span>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true" class="fleche"><path d="m9 5 7 7-7 7" /></svg>
        </button>

        <!-- statistiques -->
        <template v-if="stats">
          <p class="section">Les naissances de {{ annee }}</p>

          <div class="carte tuile colonne large">
            <p class="etiquette">Les plus donnés · filles</p>
            <button v-for="(p, i) in stats.topF" :key="p.l" class="rang" @click="ouvrir(p.l)">
              <span class="n">{{ i + 1 }}</span><span class="q">{{ p.l }}</span>
              <em>{{ frequenceLisible(derniereAnnee(p)) }}</em>
            </button>
          </div>

          <div class="carte tuile colonne large">
            <p class="etiquette">Les plus donnés · garçons</p>
            <button v-for="(p, i) in stats.topM" :key="p.l" class="rang" @click="ouvrir(p.l)">
              <span class="n">{{ i + 1 }}</span><span class="q">{{ p.l }}</span>
              <em>{{ frequenceLisible(derniereAnnee(p)) }}</em>
            </button>
          </div>

          <div class="carte large colonne">
            <p class="etiquette">À surveiller</p>
            <p class="mini doux" style="margin:0 0 4px">
              Rares aujourd’hui, en forte hausse.
            </p>
            <div class="ligne" style="flex-wrap:wrap;gap:7px">
              <button v-for="p in stats.guetter" :key="p.l" class="puce"
                      style="border:0;cursor:pointer" @click="ouvrir(p.l)">
                {{ p.l }} · {{ p.r.toFixed(0) }}/100
              </button>
            </div>
          </div>

          <div class="carte tuile colonne large">
            <p class="etiquette">Ça monte</p>
            <button v-for="p in stats.monte" :key="p.l" class="rang" @click="ouvrir(p.l)">
              <span class="q">{{ p.l }}</span><em :style="{ color: Math.round(p.t) ? 'var(--non)' : 'var(--doux)' }">{{ pourcentAn(p.t) }}</em>
            </button>
          </div>

          <div class="carte tuile colonne large">
            <p class="etiquette">Ça retombe</p>
            <button v-for="p in stats.tombe" :key="p.l" class="rang" @click="ouvrir(p.l)">
              <span class="q">{{ p.l }}</span><em :style="{ color: Math.round(p.t) ? 'var(--oui)' : 'var(--doux)' }">{{ pourcentAn(p.t) }}</em>
            </button>
          </div>

          <div v-if="stats.revivals.length" class="carte large colonne">
            <p class="etiquette">Ils reviennent d’avant 1970</p>
            <div class="ligne" style="flex-wrap:wrap;gap:7px">
              <button v-for="p in stats.revivals" :key="p.l" class="puce"
                      style="border:0;cursor:pointer" @click="ouvrir(p.l)">{{ p.l }}</button>
            </div>
          </div>
        </template>

        <!-- listes passées -->
        <template v-if="autres.length">
          <p class="section">Mes autres listes</p>
          <NuxtLink v-for="g in autres" :key="g.id" :to="`/g/${g.id}/swipe`"
                    class="carte large passee">
            <div style="flex:1;min-width:0">
              <strong>{{ g.nom }}</strong>
              <p class="mini doux" style="margin:2px 0 0">
                {{ g.mes_votes }} {{ pluriel(g.mes_votes, 'jugé', 'jugés') }} · {{ g.nb_communs }} en commun ·
                {{ quandDernier(g.derniere_activite) }}
              </p>
            </div>
            <span v-if="g.code_invitation" class="puce">{{ codeLisible(g.code_invitation) }}</span>
          </NuxtLink>
        </template>

        <p class="mini doux credit">
          {{ stats?.total.toLocaleString('fr-FR') ?? '…' }} prénoms · fichier INSEE des prénoms,
          millésime 2025<template v-if="!coquille.dansApp"> · <a href="/prenoms/" class="lien">toutes les fiches prénoms</a></template><br>
          <button type="button" class="version" @click="vider">
            version {{ version }}{{ purge ? ' · rechargement…' : ' · toucher pour recharger à neuf' }}
          </button>
        </p>
        <PiedLegal class="credit" />
      </div>
    </main>

    <button v-if="principale" class="tirette" :style="{ transform: `translateX(${-tire}px)` }"
            :aria-label="`Revenir dans ${principale.nom}`"
            @pointerdown="bordDebut" @pointermove="bordBouge"
            @pointerup="bordFin" @pointercancel="bordFin" @click="entrerListe">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
      <span>{{ principale.nom }}</span>
    </button>

    <AssistantFiltres v-if="assistant" :premier="premierNom"
                      @fermer="assistant = false; cadeauPourNouvelle = ''" @valider="creer" />
    <FeuilleRejoindre v-if="rejoindreOuvert" @fermer="rejoindreOuvert = false"
                      @cadeau="voirCadeau" />
    <FeuilleCadeau v-if="cadeauOuvert" :code="cadeauOuvert"
                   @fermer="fermerCadeau" @nouvelle="nouvelleOfferte" />
    <FeuilleCompte v-if="compteOuvert" @fermer="compteOuvert = false" />
    <FeuilleOffrir v-if="offrirOuvert" @fermer="offrirOuvert = false" />
    <FichePrenom v-if="fiche" :p="fiche" @fermer="fiche = null" />
  </div>
</template>

<style scoped>
.offrir { display: flex; align-items: center; gap: 12px; padding: 14px 16px; color: var(--texte);
  text-decoration: none; width: 100%; text-align: left; font: inherit; cursor: pointer; }
.offrir .fleche { width: 18px; height: 18px; flex: none; fill: none; stroke: var(--doux);
  stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.proteger { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; width: 100%;
  text-align: left; font: inherit; color: var(--texte); cursor: pointer; padding: 13px 16px;
  margin: 0 0 12px; border-color: color-mix(in srgb, var(--peche) 70%, var(--trait));
  background: color-mix(in srgb, var(--peche) 28%, var(--carte)); }
.proteger strong { font-size: .92rem; }
.ecran.page { height: 100%; }
/* La tirette du bord droit : assez visible pour qu'on la trouve, assez
   discrete pour ne pas manger l'ecran. Elle se tire ou se touche. */
.tirette { position: fixed; right: 0; top: 50%; translate: 0 -50%; z-index: 30;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 14px 7px 14px 6px; border: 1px solid var(--trait); border-right: 0;
  border-radius: 14px 0 0 14px; background: var(--carte); color: var(--doux);
  font: inherit; font-size: .68rem; font-weight: 700; cursor: pointer;
  box-shadow: -4px 0 14px rgba(26,35,78,.07); touch-action: pan-y;
  transition: transform .18s cubic-bezier(.32,.72,0,1); }
.tirette svg { width: 15px; height: 15px; fill: none; stroke: currentColor;
  stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round; }
.tirette span { writing-mode: vertical-rl; max-height: 128px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; letter-spacing: .02em; }
.defile.page:focus { outline: none; }
.defile.page { height: 100%; overflow-y: auto; overscroll-behavior-y: contain;
  padding: max(16px, env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom)); }
.tete { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.tete img { border-radius: 9px; }
.tete h1 { font-size: 1.25rem; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; }
.qui { flex: none; max-width: 46%; display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--trait); border-radius: var(--pastille); background: var(--carte);
  padding: 6px 12px 6px 13px; font: inherit; font-size: .78rem; font-weight: 700;
  color: var(--doux); cursor: pointer; }
.qui span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qui svg { width: 15px; height: 15px; flex: none; stroke: currentColor; fill: none;
  stroke-width: 2.2; stroke-linecap: round; }
.qui:active { background: var(--fond); }

.bento { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.bento > * { min-width: 0; }
.grande, .large, .section, .credit { grid-column: 1 / -1; }

.grande { display: flex; flex-direction: column; gap: 7px; color: var(--encre); padding: 20px;
  position: relative; overflow: hidden; text-align: left; font: inherit;
  border: 0; width: 100%; cursor: pointer; }
.deco { position: absolute; top: 14px; right: 16px; opacity: .3; }
.titre { font-size: 1.5rem; letter-spacing: -.03em; }
.etiquette { font-size: .68rem; text-transform: uppercase; letter-spacing: .07em;
  font-weight: 700; color: var(--doux); margin: 0; }
.grande .etiquette { color: inherit; opacity: .8; }
.chiffres { gap: 16px; font-size: .78rem; flex-wrap: wrap; }
.chiffres strong { font-size: 1.15rem; font-variant-numeric: tabular-nums; display: block; }
.accueil { gap: 9px; }

.tuile { display: flex; align-items: center; gap: 11px; padding: 15px 16px; text-align: left;
  cursor: pointer; }
.tuile.colonne { flex-direction: column; align-items: stretch; gap: 7px; cursor: default; }
.rond { width: 34px; height: 34px; border-radius: 50%; background: var(--fond);
  display: grid; place-items: center; font-size: 1.15rem; color: var(--doux); flex: none; }

.rang { display: flex; align-items: baseline; gap: 7px; background: none; border: 0;
  padding: 3px 0; cursor: pointer; text-align: left; font-weight: 560; width: 100%; }
.rang .q { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; font-size: 1.02rem; }
.rang em { font-style: normal; font-size: .72rem; color: var(--doux); white-space: nowrap;
  font-variant-numeric: tabular-nums; flex: none; }
.rang .n { color: var(--doux); font-size: .74rem; width: 11px; flex: none; }
.creer { align-items: center; justify-content: center; text-align: center; gap: 6px; }

.section { margin: 10px 0 -2px; font-size: .72rem; text-transform: uppercase;
  letter-spacing: .07em; font-weight: 700; color: var(--doux); }
.large.colonne { display: flex; flex-direction: column; gap: 7px; padding: 15px 16px; }
.passee { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
.credit { text-align: center; margin: 14px 0 0; }
.panne { border-color: var(--non); }
.fantome { display: flex; flex-direction: column; gap: 9px; justify-content: center; }
.grande.fantome { background: var(--carte); }
.version { background: none; border: 0; color: inherit; font: inherit;
  padding: 7px 4px; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
</style>
