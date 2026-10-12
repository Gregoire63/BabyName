<script setup lang="ts">
import { lireLegalEnFrancais } from '~/utils/pagesLegales'

/**
 * Traduction anglaise des conditions generales (legal/Conditions.vue). Le
 * francais fait seul foi, et c'est sa version (VERSIONS_TEXTES.conditions)
 * qui est gravee dans chaque paiement : changer l'un, c'est changer l'autre.
 * Memes conditions d'affichage que l'original (ios, vente) : voir son script.
 */
const e = EDITEUR
const config = useRuntimeConfig()
const prix = (config.public.prixListe as string) || '6 €'

const ios = useCoquille().app?.plateforme === 'ios'
const vente = useVente()
</script>

<template>
  <p class="avis-traduction">
    <em>This is a translation provided for convenience. The French version is the only legally binding one.</em>
    <button type="button" class="lien-fr" @click="lireLegalEnFrancais()">Read the French version</button>
  </p>

  <h2>1. Purpose</h2>
  <p>
    These terms govern the use of babyNamed, an application that helps several people choose a first
    name together, and the purchase of its paid option. They are concluded between you and the publisher,
    {{ e.nom }}, {{ e.formeEn }} (<span lang="fr">{{ e.forme.toLowerCase() }}</span>) (see the <NuxtLink to="/mentions-legales">legal notice</NuxtLink>).
    Creating an account constitutes acceptance of the terms of use; a purchase additionally requires
    acceptance of the terms of sale<template v-if="ios">, presented before the App Store purchase sheet</template><template v-else>,
    by ticking the box provided before payment</template>.
  </p>

  <h2>2. The service</h2>
  <p>
    babyNamed offers a catalogue of first names drawn from the statistics of Insee (French national
    statistics institute), shared lists in which each person rates the names without seeing the others’
    opinions before giving their own, and the list of names on which everyone agrees.
  </p>
  <p>
    <strong>The free version</strong> gives access to the full catalogue, to search, to the name pages,
    to matches, to the ranking and to vetoing names. On lists that have not been unlocked, the number of
    names rated is limited: a first batch to rate freely, then a number per day. These limits are shown
    in the app; they never permanently interrupt the sorting.
  </p>

  <h2>3. Your account</h2>
  <p>
    An account is created with a display name and an <strong>email address</strong>, confirmed by the link or
    the code it receives. There is no password: this address receives, on request, a sign-in link and
    code, and you can also create a <strong>passkey</strong> (unlocked by your phone’s face recognition,
    fingerprint or code). An older account, with neither an address nor a passkey, exists only on the
    device on which it was created, and the publisher cannot recover it for you. Do not share your codes
    or access to your mailbox; <em>My account</em> lets you log out all your other devices.
  </p>
  <p>
    You are responsible for what you write in the app (list names, comments, reasons). Any unlawful or
    abusive content, or content infringing the rights of others, may be removed and the account
    suspended. You can delete your account at any time from <em>My account</em>.
    Anyone can leave a list from its settings: what they gave there (votes, vetoes, comments) is
    erased, and the list remains with the others. Its owner (the person who created it; if they leave
    it, the longest-standing of those who make decisions on it) can also delete it: it then disappears
    for all its members, along with their votes.
  </p>

  <h2>4. The paid option: unlocking a list</h2>
  <h3>What you are buying</h3>
  <p>
    The unlocking of <strong>one</strong> list, for <strong>all its members</strong>: sorting without a daily
    limit, trying names with your surname, the projection of the number of children bearing the name
    in a class, the portrait of your tastes, the explanation of disagreements and the invitation of
    people with read-only access. The unlocking extends <strong>neither to your other lists nor to your
    account</strong>: each list is unlocked separately. The details are presented in the app before any
    payment.
  </p>
  <!-- Dans l'app iPhone : la caisse d'Apple, et elle seule (voir Conditions.vue). -->
  <template v-if="ios">
    <h3>Price</h3>
    <p>
      The price is the one displayed by the App Store before the purchase<template v-if="vente.prix">:
      <strong>{{ vente.prix }}</strong> today</template>. In France and in the European Union, it
      includes VAT, which Apple invoices. It is paid only once: the list is unlocked for life, that is,
      for its entire existence, and nothing is charged afterwards.
    </p>
    <h3>Order and payment</h3>
    <p>
      In the app, the purchase is made through App Store in-app purchase. From the list,
      <em>Unlock</em> presents the offer and its price; Apple’s purchase sheet then asks you to
      confirm, with the payment method of your Apple account. Confirming it constitutes an order with an
      obligation to pay. Apple collects the payment, under the terms of its services, and sends you the
      receipt. Your payment data remain with Apple and are never passed on to the publisher.
    </p>
    <h3>Delivery</h3>
    <p>
      Immediate: the list is unlocked as soon as Apple confirms the purchase, for its entire
      existence. A purchase awaiting a third party’s approval (Family Sharing, bank) unlocks the list
      as soon as that approval is given. If a list is erased (deleted by its owner, left by all those
      who make decisions on it, or after {{ CONSERVATION.inactiviteMois }} months without anyone
      opening it), its unlocking disappears with it.
    </p>
    <p>
      If another member unlocks the list while you are buying it, your purchase is not lost:
      it unlocks, at no extra cost, the next list you choose to unlock. You can also ask Apple for a
      refund.
    </p>

    <h3>Withdrawal and refund</h3>
    <div class="encadre">
      <p>
        For an online purchase, you in principle have fourteen days to withdraw
        (art. L221-18 of the French Consumer Code), except for digital content supplied immediately
        at your request (art. L221-28, 13°). As the purchase goes through the App Store, cancellation
        and refund are requested from Apple, which collected the payment, under the terms of its
        services: from <a href="https://reportaproblem.apple.com" rel="noopener">reportaproblem.apple.com</a>
        or the purchase history of your Apple account.
      </p>
    </div>
    <p>
      A full refund granted by Apple cancels the sale: the list then reverts to the free version,
      without loss of votes or data.
    </p>
  </template>

  <template v-else>
    <h3>Price</h3>
    <p>
      <strong>{{ prix }} including tax per list</strong>, paid only once: the list is unlocked for life, that is,
      for its entire existence, and nothing is charged afterwards. {{ mentionTva(e, 'en') }}.
    </p>
    <h3>Order and payment</h3>
    <p>
      The purchase is made on the babynamed.fr website.
      From the list, <em>Unlock</em> presents the offer and its price. You tick the acceptance box,
      then pay on Stripe’s secure payment page (bank card, Apple Pay, Google Pay and other methods
      offered). The payment button constitutes an order with an obligation to pay. Your payment data
      are entered with Stripe and are never passed on to the publisher.
    </p>
    <h3>Delivery</h3>
    <p>
      Immediate: the list is unlocked as soon as payment is confirmed, for its entire existence.
      An invoice is sent to you by email. If a list is erased (deleted by its owner, left by all those
      who make decisions on it, or after {{ CONSERVATION.inactiviteMois }} months without anyone
      opening it), its unlocking disappears with it.
    </p>

    <h3>Right of withdrawal</h3>
    <div class="encadre">
      <p>
        For an online purchase, you in principle have fourteen days to withdraw
        (art. L221-18 of the French Consumer Code). This right does not apply to digital content supplied
        immediately, where you have expressly requested such immediate performance and acknowledged that
        you lose your right of withdrawal (art. L221-28, 13°).
      </p>
      <p>
        This is the purpose of the checkbox that precedes payment: without it, payment cannot
        begin. This agreement, dated, appears on the invoice you receive by email.
      </p>
    </div>
    <p>
      A full or partial refund remains possible at the publisher’s discretion. A full refund cancels
      the sale: the list then reverts to the free version, without loss of votes or data.
    </p>

    <h3>In the iPhone and Android apps</h3>
    <p>
      The apps give access to the same service, and a list that has been unlocked is unlocked
      everywhere, wherever it was bought. In the Android app, nothing can be bought. In the iPhone app,
      a list is unlocked through App Store in-app purchase: Apple collects the payment, at the price
      displayed by the App Store before the purchase (which may differ from the website’s), under the
      terms of its services, and sends you the receipt. The list is unlocked as soon as Apple confirms
      the purchase. Cancellation and refund of such a purchase are requested from Apple; a full refund
      returns the list to the free version, without loss of votes or data. If another member unlocks
      the list during this purchase, it is not lost: it unlocks, at no extra cost, the next list the
      buyer chooses to unlock.
    </p>
  </template>

  <h3>Legal guarantee of conformity</h3>
  <p>
    Throughout the period of supply, you benefit from the legal guarantee of conformity for digital
    content and services (art. L224-25-12 et seq. of the French Consumer Code). In the event of a
    defect, you may obtain that it be brought into conformity; failing that, under the conditions
    provided for by law, a price reduction or termination of the contract. Report any defect to
    <a :href="`mailto:${e.email}`">{{ e.email }}</a>.
  </p>

  <!-- Les codes cadeaux : voir Conditions.vue (absents de l'app iPhone). -->
  <template v-if="!ios">
  <h3 id="cadeau">Giving a list: the gift code</h3>
  <p>
    From the <em>Give babyNamed</em> page, without an account, you can buy the unlocking of a list for
    someone else, at the same price (<strong>{{ prix }} including tax</strong>). You can add your name and
    a message, which the recipient will read when opening the gift. Payment is made with Stripe, as for a
    list.
  </p>
  <p>
    <strong>Delivery</strong>: a twelve-character code and a link, displayed as soon as payment is
    confirmed and shown on the invoice sent by email. It is up to you to pass them on. Anyone who
    holds the code can use it: keep it like a voucher. The publisher cannot send the code on your
    behalf, nor replace it if it has already been used.
  </p>
  <p>
    <strong>Use</strong>: the code unlocks a single list, chosen by the person using it: a list of which
    they are a member and which has not yet been unlocked, or a new list, created already unlocked. It is
    valid for <strong>{{ CONSERVATION.cadeauMois / 12 }} years</strong> from the purchase; after that period,
    it no longer unlocks anything and is not refunded. It cannot be exchanged for cash.
    It is used on the babynamed.fr website, not in the iPhone and Android apps; the list it unlocks
    is then unlocked everywhere.
  </p>
  <div class="encadre">
    <p>
      <strong>Withdrawal</strong>: since nothing is supplied at the time of purchase, you keep your
      fourteen-day right of withdrawal (art. L221-18 of the French Consumer Code) as long as the code has
      not been used: write to <a :href="`mailto:${e.email}`">{{ e.email }}</a> with the email address used
      for the payment, the code is cancelled and you are refunded. By ticking the box that precedes payment,
      you request that the list be unlocked as soon as the code is used, and acknowledge that you then lose
      this right (art. L221-28, 13°); the invoice confirms this.
    </p>
  </div>
  <p>
    A full refund or a successfully disputed payment cancels the code; if it has already been used, the
    list it unlocked reverts to the free version, without loss of votes or data.
  </p>
  </template>

  <h2>5. Availability and changes</h2>
  <p>
    The publisher makes its best efforts to keep the app available, without guaranteeing permanent
    availability (maintenance, provider outages). Features may change. Should the service close
    permanently, you would be notified in the app at least three months in advance, and the export
    of your data would remain available until closure.
  </p>

  <h2>6. Information provided</h2>
  <p>
    Statistics, trends, projections, meanings and origins are given for information only, based on
    public sources and calculations that may contain errors. The choice of name is yours; its
    registration with the civil registry is a matter for the civil registrar (art. 57 of the French
    Civil Code).
  </p>

  <h2>7. Personal data</h2>
  <p>
    Their processing is described in the <NuxtLink to="/confidentialite">privacy policy</NuxtLink>.
  </p>

  <h2>8. Changes to the terms</h2>
  <p>
    These terms may be amended; the date at the top of the page indicates the version in force. A
    purchase remains governed by the version accepted at the time of purchase. For the free part, any
    significant change is notified to you in the app; continuing to use the service constitutes
    acceptance, and you can delete your account at any time.
  </p>

  <h2>9. Complaints and mediation</h2>
  <p>
    For any complaint, first write to <a :href="`mailto:${e.email}`">{{ e.email }}</a>.
    If the answer does not satisfy you, or if you receive no answer within two months, you may refer
    the matter free of charge to the consumer mediator (art. L612-1 of the French Consumer Code):
    <!-- Sans médiateur : « en cours de traitement » (voir Conditions.vue). -->
    <template v-if="e.mediateur.nom">
      <strong>{{ e.mediateur.nom }}</strong>
      <template v-if="e.mediateur.adresse">, {{ e.mediateur.adresse }}</template>
      <template v-if="e.mediateur.site">, <a :href="e.mediateur.site" rel="noopener">{{ e.mediateur.site.replace(/^https?:\/\//, '') }}</a></template>
      <template v-else>, <ACompleter quoi="mediator’s website" /></template>.
    </template>
    <template v-else>currently being processed.</template>
  </p>

  <h2>10. Governing law</h2>
  <p>
    These terms are governed by French law. In the event of a dispute, and failing an amicable
    settlement, you may bring the matter, at your choice, before the court of the place where you
    were residing at the time the contract was concluded or the harmful event occurred, or before any
    other competent court (art. R631-3 of the French Consumer Code).
  </p>
</template>

<style scoped>
.avis-traduction { font-size: .9rem; color: var(--doux); }
.lien-fr { border: 0; background: none; padding: 0; font: inherit; color: var(--texte);
  text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
</style>
