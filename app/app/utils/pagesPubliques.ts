/**
 * Les pages publiques (fiches prénoms, listes, guide, outils) : du HTML
 * statique généré par scripts/seo.mjs, servi par Cloudflare hors de l'app.
 * On y va par un vrai lien (<a href>), jamais par le routeur : ce ne sont pas
 * des pages Vue. Même liste que le service worker (public/sw.js).
 */
export const CHEMIN_PUBLIC = /^\/(prenoms?|choisir-un-prenom-a-deux|tester-prenom-nom-de-famille|idee-cadeau-futurs-parents|chercher-un-prenom)(\/|$)/

export interface Retour { href: string, texte: string }

/**
 * Où ramène « ← » depuis l'entrée de l'app : la page publique d'où l'on
 * vient (le navigateur le dit dans document.referrer, même site seulement),
 * sinon la fiche du prénom suivi, sinon l'index des prénoms.
 */
export function retourPublic(referrer: string, slugPrenom: string, prenomAffiche: string): Retour {
  try {
    const u = new URL(referrer)
    if (u.origin === location.origin && CHEMIN_PUBLIC.test(u.pathname)) {
      const fiche = /^\/prenom\//.test(u.pathname)
      return { href: u.pathname + u.search,
        texte: fiche && prenomAffiche ? `Revenir à ${prenomAffiche}` : 'Revenir aux prénoms' }
    }
  } catch { /* pas de referrer, ou illisible */ }
  if (/^[a-z0-9-]{1,60}$/.test(slugPrenom)) {
    return { href: `/prenom/${slugPrenom}/`, texte: prenomAffiche ? `Revenir à ${prenomAffiche}` : 'Revenir à la fiche' }
  }
  return { href: '/prenoms/', texte: 'Parcourir les prénoms' }
}
