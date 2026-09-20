<script setup lang="ts">
import { chargerCatalogue, frequenceLisible, type Prenom, type Filtres }
  from '~/composables/useCatalogue'
import { CLE_GROUPE } from '~/composables/etatGroupe'

// L'accueil sert a deux endroits : la page /, et le premier onglet du pager
// d'une liste. Meme contenu, seule l'enveloppe de defilement change — le
// pager fournit deja sa propre section scrollable et son rembourrage.
const props = defineProps<{ dansPager?: boolean; actif?: boolean }>()

// Dans le pager, l'accueil sait dans quelle liste il se trouve : la liste
// ouverte passe en tete et n'est plus un lien — la toucher glisse vers le tri
// au lieu de recharger la page sur elle-meme.
const g = inject(CLE_GROUPE, null)
const gidCourant = computed(() => (props.dansPager && g) ? String(g.gid) : null)

const moi = useMoi()
const groupes = ref<any[]>([])
const chargement = ref(true)
const code = ref('')
const erreur = ref('')
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

async function creer(filtres: Filtres) {
  const g = await $fetch<any>('/api/groupes', { method: 'POST', body: { filtres } })
  await navigateTo(`/g/${g.id}/swipe`)
}

async function rejoindre() {
  erreur.value = ''
  try {
    const g = await $fetch<any>('/api/groupes/rejoindre',
      { method: 'POST', body: { code: code.value.trim() } })
    await navigateTo(`/g/${g.id}/swipe`)
  } catch { erreur.value = 'Code inconnu.' }
}

async function sortir() {
  await $fetch('/api/auth/sortir', { method: 'POST' })
  await navigateTo('/connexion')
}

onMounted(async () => {
  if (props.dansPager) { await demarrer(); return }
  if (!(await rafraichirMoi())) return navigateTo('/connexion')
  // Lien d'invitation : on entre directement, sans faire retaper le code.
  const c = useRoute().query.code
  if (typeof c === 'string' && c.trim().length === 8) {
    code.value = c.trim()
    await rejoindre()
  }
  await demarrer()
})

async function demarrer() {
  charger()
  const cat = await chargerCatalogue()
  catalogue.value = cat!.liste
  annee.value = cat!.annees[1]
}

// Dans le pager, on recharge la liste des listes a chaque retour sur l'onglet :
// le nombre de communs et la date du dernier vote bougent pendant la session.
watch(() => props.actif, a => { if (a && props.dansPager) charger() })

// --- la liste principale, les autres en dessous ----------------------------
const principale = computed(() => {
  const l = groupes.value
  if (!l.length) return null
  return l.find(x => String(x.id) === gidCourant.value) ?? l[0]
})
const autres = computed(() =>
  groupes.value.filter(x => x !== principale.value))
/** La carte du haut designe-t-elle la liste dans laquelle on est deja ? */
const ici = computed(() =>
  !!principale.value && String(principale.value.id) === gidCourant.value)

const quandDernier = (d: string | null) => {
  if (!d) return 'pas encore commencée'
  const j = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  return j === 0 ? 'aujourd’hui' : j === 1 ? 'hier' : `il y a ${j} jours`
}

// --- statistiques de l'année ----------------------------------------------
const stats = computed(() => {
  const l = catalogue.value
  if (!l.length) return null
  const solide = l.filter(p => p.n >= 250)
  const top = (s: 'f' | 'm') => l.filter(p => p.sexe === s)
    .sort((a, b) => b.n - a.n).slice(0, 3)
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
  <div class="ecran" :class="{ page: !dansPager }">
    <div class="defile" :class="{ page: !dansPager }">
      <header class="tete">
        <img src="/logo.png" alt="" width="34" height="34">
        <h1 style="flex:1">babyNames</h1>
        <span class="mini doux qui">{{ moi?.pseudo ?? '' }}</span>
      </header>

      <p v-if="chargement" class="doux">Chargement…</p>

      <div v-else-if="panne" class="carte pile panne">
        <h2>Ça coince côté serveur</h2>
        <p class="mini" style="margin:0">{{ panne }}</p>
        <p class="mini doux" style="margin:0">
          Votre session est intacte — c’est la liste qui n’a pas pu être lue.
        </p>
        <button class="btn btn-1" @click="chargement = true; charger()">Réessayer</button>
        <button class="btn btn-0 doux" @click="sortir">Se déconnecter</button>
      </div>

      <div v-else class="bento">
        <!-- liste en cours -->
        <component :is="ici ? 'button' : 'NuxtLink'" v-if="principale"
                   v-bind="ici ? {} : { to: `/g/${principale.id}/swipe` }"
                   class="carte degrade grande"
                   @click="ici && g!.allerA('swipe')">
          <Etincelles class="deco" :taille="30" />
          <p class="etiquette">{{ ici ? 'Vous êtes dans cette liste' : 'Liste en cours' }}</p>
          <h2 class="titre">{{ principale.nom }}</h2>
          <div class="ligne chiffres">
            <span><strong>{{ principale.mes_votes }}</strong> jugés par vous</span>
            <span><strong>{{ principale.nb_communs }}</strong> en commun</span>
            <span><strong>{{ principale.nb_membres }}</strong> {{ principale.nb_membres > 1 ? 'membres' : 'membre' }}</span>
          </div>
          <p class="mini" style="margin:0;opacity:.66">
            Dernier vote {{ quandDernier(principale.derniere_activite) }}<template v-if="ici">
              · toucher pour trier</template>
          </p>
        </component>

        <div v-else class="carte degrade grande accueil">
          <Etincelles class="deco" :taille="30" />
          <h2 class="titre">Commencez ici</h2>
          <p class="mini" style="margin:0;opacity:.75">
            Quelques questions, et vous triez des prénoms à deux sans jamais voir
            le vote de l’autre avant d’avoir donné le vôtre.
          </p>
        </div>

        <!-- actions -->
        <button class="carte tuile colonne creer" @click="assistant = true">
          <span class="rond">＋</span>
          <strong>{{ groupes.length ? 'Une autre liste' : 'Créer ma liste' }}</strong>
          <span class="mini doux">Quelques questions, puis on trie</span>
        </button>

        <div class="carte tuile colonne">
          <strong>Rejoindre</strong>
          <input v-model="code" class="champ mini" placeholder="8 caractères"
                 maxlength="8" autocapitalize="off" @keyup.enter="rejoindre">
          <button class="btn mini" :disabled="code.trim().length !== 8" @click="rejoindre">
            Entrer
          </button>
          <p v-if="erreur" class="mini" style="color:var(--non);margin:0">{{ erreur }}</p>
        </div>

        <BoutonInstaller class="large" />

        <!-- statistiques -->
        <template v-if="stats">
          <p class="section">La France en {{ annee }}</p>

          <div class="carte tuile colonne large">
            <p class="etiquette">Les plus donnés · filles</p>
            <button v-for="(p, i) in stats.topF" :key="p.l" class="rang" @click="ouvrir(p.l)">
              <span class="n">{{ i + 1 }}</span><span class="q">{{ p.l }}</span>
              <em>{{ frequenceLisible(p.f) }}</em>
            </button>
          </div>

          <div class="carte tuile colonne large">
            <p class="etiquette">Les plus donnés · garçons</p>
            <button v-for="(p, i) in stats.topM" :key="p.l" class="rang" @click="ouvrir(p.l)">
              <span class="n">{{ i + 1 }}</span><span class="q">{{ p.l }}</span>
              <em>{{ frequenceLisible(p.f) }}</em>
            </button>
          </div>

          <div class="carte large colonne">
            <p class="etiquette">À surveiller</p>
            <p class="mini doux" style="margin:0 0 4px">
              Rares aujourd’hui, en forte hausse : le profil du prénom qu’on croit
              unique et qu’on retrouve en triple à la maternelle.
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
              <span class="q">{{ p.l }}</span><em style="color:var(--non)">+{{ p.t.toFixed(0) }} %</em>
            </button>
          </div>

          <div class="carte tuile colonne large">
            <p class="etiquette">Ça retombe</p>
            <button v-for="p in stats.tombe" :key="p.l" class="rang" @click="ouvrir(p.l)">
              <span class="q">{{ p.l }}</span><em style="color:var(--oui)">{{ p.t.toFixed(0) }} %</em>
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
                {{ g.mes_votes }} jugés · {{ g.nb_communs }} en commun ·
                {{ quandDernier(g.derniere_activite) }}
              </p>
            </div>
            <span class="puce">{{ g.code_invitation }}</span>
          </NuxtLink>
        </template>

        <p class="mini doux credit">
          {{ stats?.total.toLocaleString('fr-FR') ?? '—' }} prénoms · fichier INSEE des prénoms,
          millésime 2025<br>
          <button class="version" @click="vider">
            version {{ version }}{{ purge ? ' — rechargement…' : ' · toucher pour recharger à neuf' }}
          </button><br>
          <button class="version" @click="sortir">Se déconnecter</button>
        </p>
      </div>
    </div>

    <AssistantFiltres v-if="assistant" @fermer="assistant = false" @valider="creer" />
    <FichePrenom v-if="fiche" :p="fiche" @fermer="fiche = null" />
  </div>
</template>

<style scoped>
.ecran.page { height: 100%; }
.defile.page { height: 100%; overflow-y: auto; overscroll-behavior-y: contain;
  padding: max(16px, env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom)); }
.tete { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.tete img { border-radius: 9px; }
.tete h1 { font-size: 1.25rem; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; }
.qui { flex: none; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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
.grande .etiquette { color: inherit; opacity: .6; }
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
.version { background: none; border: 0; color: inherit; font: inherit; opacity: .65;
  padding: 7px 4px; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
</style>
