/**
 * La langue du compte (migration 0013, app/composables/useLangue.ts) :
 * `choix`, celle choisie (null : automatique), et `langue`, celle affichée
 * — celle des e-mails et des notifications.
 */
const LANGUES = ['fr', 'en', 'de', 'nl', 'sv', 'nb', 'pl', 'lv']

export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  const { choix, langue } = await readBody<{ choix?: string | null; langue?: string }>(e) ?? {}
  if (!LANGUES.includes(String(langue))) throw createError({ statusCode: 400, statusMessage: 'langue_inconnue' })
  if (choix !== null && choix !== undefined && !LANGUES.includes(choix)) {
    throw createError({ statusCode: 400, statusMessage: 'langue_inconnue' })
  }
  await ecrire(`update utilisateurs set langue = ?1, langue_choix = ?2 where id = ?3`, [langue, choix ?? null, uid])
  return { ok: true }
})
