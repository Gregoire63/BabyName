import { langueDe, TEXTES, textes } from '../src/textes'

test('la langue du téléphone : celles du site, le norvégien sous une seule forme, l’anglais sinon', () => {
  expect(langueDe('fr-FR')).toBe('fr')
  expect(langueDe('fr_BE')).toBe('fr')
  expect(langueDe('de-CH')).toBe('de')
  expect(langueDe('nb-NO')).toBe('nb')
  expect(langueDe('no')).toBe('nb')
  expect(langueDe('nn-NO')).toBe('nb')
  expect(langueDe('lv-LV')).toBe('lv')
  expect(langueDe('es-ES')).toBe('en')
  expect(langueDe('')).toBe('en')
  expect(langueDe(null)).toBe('en')
})

test('le français ne change pas ; toutes les langues ont tous les textes', () => {
  expect(textes('fr').panneTitre).toBe('Pas de connexion')
  expect(textes('fr').reessayer).toBe('Réessayer')
  const cles = Object.keys(TEXTES.fr).sort()
  for (const t of Object.values(TEXTES)) {
    expect(Object.keys(t).sort()).toEqual(cles)
    for (const v of Object.values(t)) expect(v.trim().length).toBeGreaterThan(0)
  }
})
