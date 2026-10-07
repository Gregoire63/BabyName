/**
 * Qui edite babyNamed, et ce que la loi oblige a dire.
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
  marque: 'babyNamed',
  /** Personne physique qui exploite le service (entreprise individuelle). */
  nom: 'Grégoire Raturat',
  forme: 'Entrepreneur individuel',
  /** 14 chiffres — verifie dans l'annuaire des entreprises (EI active, NAF 62.01Z). */
  siret: '920 575 578 00025',
  /** Adresse professionnelle : celle declaree pour l'entreprise (domicile ou domiciliation). */
  adresse: '10 rue Jean-Baptiste Croibier, 69200 Vénissieux',
  /** Exige par la LCEN (art. 6 III) pour une personne physique qui edite un site. */
  telephone: '06 69 36 57 34',
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
   * coordonnees ici. Tant qu'il est vide, les conditions disent « en cours de
   * traitement » : a remplir AVANT d'ouvrir la vente (cles Stripe), puisque le
   * site doit donner ses coordonnees des la premiere vente.
   */
  mediateur: { nom: '', adresse: '', site: '' },

  /**
   * Ou dort la base. La base D1 est creee avec `--jurisdiction eu` (voir
   * LISEZMOI) : Cloudflare garantit alors qu'elle reste dans l'Union
   * europeenne. A vider si la base etait creee sans.
   */
  regionDonnees: 'l’Union européenne'
}

/**
 * Les versions des textes. On les change quand le texte change : la version
 * des conditions acceptees est gravee dans chaque paiement (metadonnees
 * Stripe), c'est ce qui permet de savoir quel texte un acheteur a accepte.
 * Un achat de l'app iPhone ne grave rien : il n'a pas de case d'accord, et
 * c'est sa date (achats_apple.achete_le) qui dit quelle version valait.
 */
export const VERSIONS_TEXTES = {
  conditions: '2026-10-07',
  confidentialite: '2026-10-07',
  accessibilite: '2026-09-25'
} as const

/**
 * L'envoi des e-mails d'inscription et de connexion (lien + code), et des
 * alertes de sécurité. UN prestataire, nommé ici : le serveur l'utilise
 * (server/utils/courriel.ts) et la politique de confidentialité le cite —
 * changer l'un sans l'autre est impossible.
 *
 * OVH par défaut : la boîte e-mail du domaine (Zimbra, comprise avec
 * babynamed.fr), en SMTP depuis le Worker — société française, serveurs en
 * France, rien de plus à payer. Le mot de passe de la boîte ne vit que dans
 * les secrets du Worker (NUXT_EMAIL_CLE), l'adresse dans NUXT_EMAIL_EXPEDITEUR
 * (« babyNamed <contact@babynamed.fr> » : la boîte elle-même, OVH refuse
 * d'envoyer au nom d'une autre). Le serveur SMTP : NUXT_EMAIL_SMTP.
 *
 * Brevo (français, 300 e-mails par jour gratuits) et Resend (américain)
 * restent prévus, par API : une ligne à changer ici si OVH ne suffit plus
 * (plafond d'envoi horaire des boîtes mutualisées, délivrabilité).
 */
export const COURRIEL = {
  fournisseur: 'ovh' as 'ovh' | 'brevo' | 'resend'
}

/** L'hebergeur (LCEN, art. 6 III : nom, adresse, telephone). */
export const HEBERGEUR = {
  nom: 'Cloudflare, Inc.',
  adresse: '101 Townsend Street, San Francisco, CA 94107, États-Unis',
  telephone: '+1 888 993 5273',
  contact: 'dpo@cloudflare.com',
  site: 'https://www.cloudflare.com'
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
    nom: 'Cloudflare, Inc.',
    role: 'Hébergement de l’application, exécution du serveur et base de données (Cloudflare Workers et D1)',
    pays: 'États-Unis (société), base de données conservée dans l’Union européenne ; le serveur s’exécute au plus près de chaque visiteur',
    garantie: 'Certifié Data Privacy Framework entre l’UE et les États-Unis ; clauses contractuelles types de la Commission européenne',
    lien: 'https://www.cloudflare.com/fr-fr/privacypolicy/'
  },
  {
    nom: 'OVH SAS',
    role: COURRIEL.fournisseur === 'ovh'
      ? 'Messagerie de babynamed.fr (envoi des e-mails d’inscription, de connexion et d’alerte) et hébergement des sauvegardes chiffrées de la base'
      : 'Hébergement des sauvegardes chiffrées de la base',
    pays: 'France (Union européenne)',
    garantie: 'Données hébergées et traitées dans l’Union européenne',
    lien: 'https://www.ovhcloud.com/fr/personal-data-protection/'
  },
  ...(COURRIEL.fournisseur === 'ovh' ? [] : [COURRIEL.fournisseur === 'brevo'
      ? {
          nom: 'Brevo (Sendinblue SAS)',
          role: 'Envoi des e-mails d’inscription, de connexion et d’alerte',
          pays: 'France (Union européenne)',
          garantie: 'Données traitées dans l’Union européenne',
          lien: 'https://www.brevo.com/fr/legal/privacypolicy/'
        }
      : {
          nom: 'Resend, Inc.',
          role: 'Envoi des e-mails d’inscription, de connexion et d’alerte',
          pays: 'États-Unis',
          garantie: 'Clauses contractuelles types de la Commission européenne',
          lien: 'https://resend.com/legal/privacy-policy'
        }]),
  {
    // La sauvegarde nocturne tourne sur GitHub Actions : la base y passe en
    // clair, le temps de l'exporter et de la chiffrer (scripts/sauvegarde-ovh.sh).
    nom: 'GitHub, Inc.',
    role: 'Sauvegarde nocturne : la base y est exportée, compressée et chiffrée le temps de la tâche, puis envoyée chez OVH ; rien n’y est conservé',
    pays: 'États-Unis',
    garantie: 'Certifié Data Privacy Framework entre l’UE et les États-Unis ; clauses contractuelles types de la Commission européenne',
    lien: 'https://docs.github.com/fr/site-policy/privacy-policies/github-general-privacy-statement'
  },
  {
    // Les apps des stores (dossier mobile/ du dépôt) : le serveur confie le
    // message au service d'acheminement d'Expo, qui le remet au service de
    // notification d'Apple ou de Google (server/utils/push.ts). Rien n'y part
    // pour qui n'a pas activé les notifications dans l'app.
    nom: 'Expo (650 Industries, Inc.)',
    role: 'Notifications de l’app iPhone et Android (uniquement si vous les activez) : acheminement du message jusqu’au service de notification d’Apple ou de Google. Expo garde le jeton de notification du téléphone, pas le contenu des messages',
    pays: 'États-Unis',
    garantie: 'Data Privacy Framework entre l’UE et les États-Unis ; clauses contractuelles types de la Commission européenne',
    lien: 'https://expo.dev/privacy'
  },
  {
    // Deux rôles. Les notifications : Apple achemine pour notre compte. L'achat
    // intégré (app iOS, server/utils/apple.ts) : Apple encaisse, facture sa
    // TVA et rembourse en son nom — responsable de ses propres traitements.
    nom: 'Apple Distribution International Ltd.',
    role: 'Remise des notifications sur iPhone et iPad (uniquement si vous les activez dans l’app) ; encaissement, reçu et remboursement des achats faits dans l’app iPhone (achat intégré de l’App Store)',
    pays: 'Irlande (Union européenne) ; certaines données peuvent être traitées par Apple Inc. aux États-Unis',
    garantie: 'Clauses contractuelles types de la Commission européenne. Pour les achats, Apple est responsable de ses propres traitements.',
    lien: 'https://www.apple.com/legal/privacy/fr-ww/'
  },
  {
    nom: 'Google Ireland Ltd.',
    role: 'Remise des notifications sur Android, par Firebase Cloud Messaging (uniquement si vous les activez dans l’app)',
    pays: 'Irlande (Union européenne) ; certaines données peuvent être traitées par Google LLC aux États-Unis',
    garantie: 'Data Privacy Framework ; clauses contractuelles types de la Commission européenne',
    lien: 'https://policies.google.com/privacy?hl=fr'
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
  /** Un lien (ou un code) de connexion recu par e-mail : minutes de validite. */
  lienMinutes: 15,
  /** Pieces comptables (factures, paiements) : obligation legale. */
  comptabiliteAns: 10,
  /** Un code cadeau : valable ce nombre de mois apres l'achat ; inutilise,
   *  il est efface a l'echeance (avec le nom et le mot de l'offrant). */
  cadeauMois: 24,
  /** App iPhone : une feuille d'achat ouverte sans achat laisse une intention
   *  (un jeton tiré au hasard, la liste, le compte), effacée après ce nombre
   *  de mois. Pas plus tôt : un achat « en attente d'accord » (partage
   *  familial) peut être validé bien après, et c'est le jeton qui dit alors
   *  quelle liste débloquer. */
  intentionAchatMois: 3,
  /** L'historique de restauration de D1 (Time Travel, offre gratuite). */
  historiqueJours: 7,
  /** Les copies chiffrées chez OVH (scripts/sauvegarde-ovh.sh) : les nuits
   *  récentes, puis la première de chaque mois. Au-delà, rien. */
  sauvegardeNuits: 30,
  sauvegardeMois: 12
} as const

export const CNIL = {
  adresse: '3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07',
  plainte: 'https://www.cnil.fr/fr/plaintes'
}

/**
 * Ce qui BLOQUE la vente : l'identite du vendeur. Sans SIRET, adresse et
 * telephone, la facture Stripe et les conditions ne disent pas qui vend —
 * on ne vend pas. Le mediateur, lui, est obligatoire aussi mais ne bloque
 * pas le paiement : les conditions disent « en cours de traitement » tant
 * qu'il manque, et /api/sante le liste, parce qu'une adhesion prend quelques
 * jours et qu'il faut pouvoir tester la caisse en production entre-temps
 * (code promo a 100 %).
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
