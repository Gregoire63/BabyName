/**
 * La purge quotidienne (RGPD) : les durees de conservation appliquees.
 *
 * Lancee chaque nuit par Cloudflare (Cron Trigger, voir scheduledTasks dans
 * nuxt.config.ts : Nitro l'ecrit dans la configuration du Worker). Le bilan
 * ne contient que des nombres : il part dans les journaux du Worker, qui
 * n'ont pas a contenir d'identifiants.
 */
export default defineTask({
  meta: { name: 'purge', description: 'Durees de conservation : comptes inactifs, listes vides, compteurs, liens' },
  async run() {
    const bilan = await purger()
    console.info('[purge]', JSON.stringify(bilan))
    return { result: bilan }
  }
})
