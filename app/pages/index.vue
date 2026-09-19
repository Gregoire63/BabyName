<script setup lang="ts">
const moi = useMoi()
const groupes = ref<any[]>([])
const chargement = ref(true)
const nom = ref('')
const code = ref('')
const erreur = ref('')

async function charger() {
  chargement.value = true
  try { groupes.value = await $fetch('/api/groupes') }
  catch { await navigateTo('/connexion') }
  finally { chargement.value = false }
}

async function creer() {
  if (!nom.value.trim()) return
  const g = await $fetch<any>('/api/groupes', { method: 'POST', body: { nom: nom.value } })
  nom.value = ''
  await navigateTo(`/g/${g.id}/swipe`)
}

async function rejoindre() {
  erreur.value = ''
  try {
    const g = await $fetch<any>('/api/groupes/rejoindre', { method: 'POST', body: { code: code.value } })
    await navigateTo(`/g/${g.id}/swipe`)
  } catch { erreur.value = 'Code inconnu.' }
}

async function sortir() {
  await $fetch('/api/auth/sortir', { method: 'POST' })
  await navigateTo('/connexion')
}

onMounted(async () => { if (!(await rafraichirMoi())) return navigateTo('/connexion'); charger() })
</script>

<template>
  <div>
    <header class="entete">
      <h1>Prénoms</h1>
      <button v-if="moi" class="btn btn-fantome mini" @click="sortir">Quitter</button>
    </header>

    <main class="page pile">
      <p v-if="chargement" class="doux">Chargement…</p>

      <template v-else>
        <template v-if="groupes.length">
          <NuxtLink v-for="g in groupes" :key="g.id" :to="`/g/${g.id}/swipe`"
                    class="carte" style="text-decoration:none">
            <div class="ligne">
              <div style="flex:1">
                <h2>{{ g.nom }}</h2>
                <p class="mini doux" style="margin:4px 0 0">
                  {{ g.nb_membres }} membre{{ g.nb_membres > 1 ? 's' : '' }} ·
                  {{ g.mes_votes }} prénom{{ g.mes_votes > 1 ? 's' : '' }} jugé{{ g.mes_votes > 1 ? 's' : '' }}
                </p>
              </div>
              <span class="etiq">{{ g.code_invitation }}</span>
            </div>
          </NuxtLink>
        </template>

        <div v-else class="vide">
          <p>Aucune liste pour l’instant.<br>Créez-en une, puis invitez qui vous voulez.</p>
        </div>

        <div class="carte pile">
          <h2>Nouvelle liste</h2>
          <input v-model="nom" class="champ" placeholder="Notre bébé" @keyup.enter="creer">
          <button class="btn btn-principal" :disabled="!nom.trim()" @click="creer">Créer</button>
        </div>

        <div class="carte pile">
          <h2>Rejoindre avec un code</h2>
          <input v-model="code" class="champ" placeholder="8 caractères" maxlength="8"
                 autocapitalize="off" @keyup.enter="rejoindre">
          <button class="btn" :disabled="code.length !== 8" @click="rejoindre">Rejoindre</button>
          <p v-if="erreur" class="mini" style="color:var(--non);margin:0">{{ erreur }}</p>
        </div>
      </template>
    </main>
  </div>
</template>
