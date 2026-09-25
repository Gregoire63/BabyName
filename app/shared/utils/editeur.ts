/**
 * Qui edite babyNames, et ce que la loi oblige a dire.
 *
 * UNE seule source pour les mentions legales, la politique de
 * confidentialite, les conditions de vente, la facture Stripe et /api/sante.
 * Recopier un SIRET a cinq endroits, c'est garantir qu'un jour l'un d'eux
 * sera faux.
 *
 * Partage entre l'app et le serveur (dossier shared/ de Nuxt) : aucune
 * dependance, que des donnees.
 *
 * ⚠ AVANT DE VENDRE : remplir tout ce qui est vide ci-dessous. Chaque champ
 * obligatoire vide s'affiche en rouge « à compléter » sur les pages publiques
 * et est liste par /api/sante (champ `legal.manquants`).
 */

export type RegimeTva = 'franchise' | 'assujetti'

export const EDITEUR = {
  marque: 'babyNames',
  /** Personne physique qui exploite le service (entreprise individuelle). */
  nom: 'Grégoire Raturat',
  forme: 'Entrepreneur individuel',
  /** 14 chiffres — verifie dans l'annuaire des entreprises (EI active, NAF 62.01Z). */
  siret: '920 575 578 00025',
  /** Adresse professionnelle : celle declaree pour l'entreprise (domicile ou domiciliation). */
  adresse: '',
  /** Exige par la LCEN (art. 6 III) pour une personne physique qui edite un site. */
  telephone: '',
  email: 'gregoireraturatpro@gmail.com',
  directeurPublication: 'Grégoire Raturat',

  /**
   * TVA. « franchise » : micro-entreprise sous le seuil, prix sans TVA, et la
   * mention « TVA non applicable, art. 293 B du CGI » devient obligatoire sur
   * la facture. « assujetti » : 6 € TTC dont 1 € de TVA, numero obligatoire,
   * et un taux a poser dans Stripe (voir LISEZMOI, « TVA »).
   * Le bon regime se lit sur n'importe quelle facture emise dans Tiime.
   */
  tva: 'franchise' as RegimeTva,
  numeroTva: '',

  /**
   * Mediateur de la consommation — obligatoire pour vendre a des particuliers
   * (art. L612-1 du Code de la consommation), meme pour 6 €. Adhesion a un
   * mediateur agree (liste sur economie.gouv.fr/mediation-conso), puis ses
   * coordonnees ici.
   */
  mediateur: { nom: '', adresse: '', site: '' },

  /** Facultatif : la region des serveurs, si on veut la preciser (ex. « Francfort, Allemagne »). */
  regionDonnees: ''
}

/**
 * Les versions des textes. On les change quand le texte change : la version
 * des conditions acceptees est gravee dans chaque paiement (metadonnees
 * Stripe), c'est ce qui permet de savoir quel texte un acheteur a accepte.
 */
export const VERSIONS_TEXTES = {
  conditions: '2026-09-25',
  confidentialite: '2026-09-25',
  accessibilite: '2026-09-25'
} as const

export const HEBERGEUR = {
  nom: 'Vercel Inc.',
  adresse: '440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis',
  contact: 'privacy@vercel.com',
  site: 'https://vercel.com'
}

/**
 * Les sous-traitants au sens de l'article 28, et Stripe — qui est aussi
 * responsable de ses propres traitements (lutte contre la fraude,
 * obligations financieres). Cette liste alimente la politique de
 * confidentialite ; un prestataire ajoute a l'app sans etre ajoute ici est
 * un prestataire cache.
 */
export const DESTINATAIRES = [
  {
    nom: 'Vercel Inc.',
    role: 'Hébergement de l’application et exécution du serveur',
    pays: 'États-Unis',
    garantie: 'Certifié Data Privacy Framework UE–États-Unis ; clauses contractuelles types de la Commission européenne',
    lien: 'https://vercel.com/legal/privacy-notice'
  },
  {
    nom: 'Neon, LLC (groupe Databricks)',
    role: 'Base de données',
    pays: 'États-Unis (société) — serveurs dans la région choisie à la création de la base',
    garantie: 'Certifié Data Privacy Framework UE–États-Unis ; clauses contractuelles types',
    lien: 'https://www.databricks.com/legal/privacynotice'
  },
  {
    nom: 'Stripe Payments Europe, Ltd.',
    role: 'Paiement (uniquement si vous débloquez une liste) : encaissement, reçu et facture, lutte contre la fraude',
    pays: 'Irlande (Union européenne) ; certaines données peuvent être traitées par Stripe, Inc. aux États-Unis',
    garantie: 'Data Privacy Framework ; clauses contractuelles types. Stripe est aussi responsable de ses propres traitements.',
    lien: 'https://stripe.com/fr/privacy'
  }
] as const

/**
 * Les durees de conservation. La purge nocturne (server/utils/conservation.ts)
 * et la politique de confidentialite lisent ces memes nombres.
 */
export const CONSERVATION = {
  /** Compte efface apres ce nombre de mois sans ouvrir l'app. */
  inactiviteMois: 24,
  /** Compteurs de gestes (quota de la version gratuite). */
  quotaJours: 62,
  /** Duree de vie du cookie de session. */
  sessionJours: 120,
  /** Pieces comptables (factures, paiements) : obligation legale. */
  comptabiliteAns: 10
} as const

export const CNIL = {
  adresse: '3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07',
  plainte: 'https://www.cnil.fr/fr/plaintes'
}

/**
 * Ce qui BLOQUE la vente : l'identite du vendeur. Sans SIRET, adresse et
 * telephone, la facture Stripe et les conditions ne disent pas qui vend —
 * on ne vend pas. Le mediateur, lui, est obligatoire aussi mais ne bloque
 * pas le paiement : il s'affiche en rouge partout ou il manque, et /api/sante
 * le liste, parce qu'une adhesion prend quelques jours et qu'il faut pouvoir
 * tester la caisse en production entre-temps (code promo a 100 %).
 */
export function mentionsBloquantes(e = EDITEUR): string[] {
  return mentionsManquantes(e).filter(m => ['siret', 'adresse', 'telephone', 'numero_tva'].includes(m))
}

/** Les champs obligatoires encore vides. */
export function mentionsManquantes(e = EDITEUR): string[] {
  const manque: string[] = []
  if (!/^\d{14}$/.test(e.siret.replace(/\s/g, ''))) manque.push('siret')
  if (!e.adresse.trim()) manque.push('adresse')
  if (!e.telephone.trim()) manque.push('telephone')
  if (!e.mediateur.nom.trim() || !e.mediateur.site.trim()) manque.push('mediateur')
  if (e.tva === 'assujetti' && !e.numeroTva.trim()) manque.push('numero_tva')
  return manque
}

/** La mention TVA a porter sous un prix et sur la facture. */
export function mentionTva(e = EDITEUR): string {
  return e.tva === 'franchise'
    ? 'TVA non applicable, art. 293 B du CGI'
    : 'TVA française de 20 % incluse'
}
