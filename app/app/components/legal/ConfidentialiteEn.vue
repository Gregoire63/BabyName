<script setup lang="ts">
import { lireLegalEnFrancais } from '~/utils/pagesLegales'

/**
 * Traduction anglaise de la politique de confidentialite
 * (legal/Confidentialite.vue). Le francais fait seul foi : changer l'un,
 * c'est changer l'autre. Memes constantes (CONSERVATION, DESTINATAIRES et
 * leur traduction `en`, shared/utils/editeur.ts).
 */
const e = EDITEUR
const c = CONSERVATION
</script>

<template>
  <p class="avis-traduction">
    <em>This is a translation provided for convenience. The French version is the only legally binding one.</em>
    <button type="button" class="lien-fr" @click="lireLegalEnFrancais()">Read the French version</button>
  </p>

  <div class="encadre">
    <p><strong>The essentials.</strong></p>
    <ul>
      <li>We ask you for a first name or a nickname, and an email address to validate the account. No password, no phone number.</li>
      <li>No advertising, no third-party cookies, no tracking from one person to another. Anonymous audience measurement, without cookies, counts page views. Nothing is sold or rented.</li>
      <li>Your account is erased when you decide, in a single step from the app, and automatically after {{ c.inactiviteMois }} months without opening it.</li>
      <li>You can download all your data at any time: <em>My account → Download my data</em>.</li>
    </ul>
  </div>

  <h2>Who is responsible</h2>
  <p>
    The data controller is {{ e.nom }}, {{ e.formeEn }} (<span lang="fr">{{ e.forme.toLowerCase() }}</span>), publisher of
    babyNamed (full contact details in the <NuxtLink to="/mentions-legales">legal notice</NuxtLink>).
    For any question about your data: <a :href="`mailto:${e.email}`">{{ e.email }}</a>.
  </p>

  <h2>What we process, why, and on what basis</h2>

  <h3>Your account</h3>
  <dl>
    <dt>Data</dt>
    <dd>
      The display name you choose; the dates of creation and of last opening of the app.
      To sign you back in, depending on what you choose:
      <strong>your passkeys</strong>: their <em>public</em> key, their name (“iCloud Keychain”), their dates
      of creation and last use; the private key, your face or your fingerprint never leave
      your device;
      <strong>your email address</strong>, confirmed at sign-up (an account created before this step may not have one).
    </dd>
    <dt>Why</dt>
    <dd>To recognise you, and to let you find your account on another device. The email address
      is used only to validate your sign-up, to send you the sign-in links and codes you
      request and to warn you of a security change on the account: no newsletter, no
      advertising.</dd>
    <dt>Legal basis</dt>
    <dd>The performance of the contract formed by the <NuxtLink to="/conditions">terms of use</NuxtLink> (art. 6.1.b GDPR).</dd>
  </dl>

  <h3>Your lists</h3>
  <dl>
    <dt>Data</dt>
    <dd>The name of the lists and, if you enter it, the child’s surname; your search filters; your votes (yes, neutral, no), vetoes and their reason, “already taken” names you add and their note, names you add to a list outside the catalogue (and your note) or propose to it outside its filters, favourites, rankings, duels and comments; the members and observers of each list.</dd>
    <dt>Why</dt>
    <dd>This is the service itself: sorting names together and finding those on which you agree.</dd>
    <dt>Legal basis</dt>
    <dd>The performance of the contract (art. 6.1.b).</dd>
  </dl>

  <h3>The counters of the free version</h3>
  <dl>
    <dt>Data</dt>
    <dd>The number of names rated on free lists: in total (for the starting batch), and on the last day of sorting (for the number per day).</dd>
    <dt>Why</dt>
    <dd>To apply the limits of the free version: the starting batch, then the number per day.</dd>
    <dt>Legal basis</dt>
    <dd>The performance of the contract (art. 6.1.b).</dd>
  </dl>

  <h3>Unlocking a list (purchase)</h3>
  <dl>
    <dt>Data</dt>
    <dd>
      <strong>On the website.</strong>
      At babyNamed: the date of the unlocking, the account that paid for it, the payment reference at
      Stripe, the version of the terms accepted and the time of your agreement.
      At Stripe, which collects the payment: your email, your payment method, your country and technical
      information used to prevent fraud.
      <strong>In the iPhone app</strong>, through App Store in-app purchase.
      At babyNamed: the App Store transaction number, its date, the babyNamed account that
      made the purchase, the list concerned, and the date of any refund.
      At Apple, which collects the payment: your Apple account and your payment method. Apple does not
      pass on to us your name, your email address or your payment method.
      <strong>In both cases, babyNamed never sees your card.</strong>
    </dd>
    <dt>Why</dt>
    <dd>To sell, invoice, prove your agreement to immediate performance, unlock the right list, handle a refund or a dispute.</dd>
    <dt>Legal basis</dt>
    <dd>The performance of the contract (art. 6.1.b) and our accounting and tax obligations (art. 6.1.c). Stripe and Apple also process these data on their own behalf, in particular against fraud.</dd>
  </dl>

  <h3>Gifts (gift code)</h3>
  <dl>
    <dt>Data</dt>
    <dd>
      If you give: the name and the message you choose to write (optional), the fingerprint of the code
      (not the code itself), its purchase date and the payment reference. No account is required;
      your email and your payment method are held by Stripe, not by babyNamed. If you receive: the
      date on which you used the code, and the list it unlocked.
    </dd>
    <dt>Why</dt>
    <dd>To hand the gift over to whoever holds the code, show the recipient who it comes from, handle a withdrawal or a refund.</dd>
    <dt>Legal basis</dt>
    <dd>The performance of the contract (art. 6.1.b) and our accounting obligations (art. 6.1.c).</dd>
  </dl>

  <h3>Sign-in links and attempt limits</h3>
  <dl>
    <dt>Data</dt>
    <dd>
      For a link or a code sent by email: the address, the account (or, for a sign-up not yet
      confirmed, the first name chosen), and a fingerprint of the link and the code (never in plain text), with the time.
      A sign-up that is never confirmed creates no account. To slow down anyone trying to guess a code or to create
      accounts in bulk: attempt counters attached to an encrypted fingerprint of the IP address, the
      account or the email address, never to their plain-text value.
    </dd>
    <dt>Why</dt>
    <dd>To sign you in without a password, and to protect accounts and lists against repeated attempts.</dd>
    <dt>Legal basis</dt>
    <dd>The performance of the contract (art. 6.1.b) for the links; our legitimate interest in securing the service
      (art. 6.1.f) for the counters.</dd>
  </dl>

  <h3>App notifications (iPhone, Android)</h3>
  <dl>
    <dt>Data</dt>
    <dd>
      Only in the app installed from the App Store or Google Play, and only if you enable
      notifications: your phone’s notification token (a routing address, assigned
      by Apple or Google), its operating system (iOS or Android), the date of its registration and that of the
      last opening of the app on this phone. The message itself never contains a first name. It says
      “New match”; or else, with a member’s display name and the name of the list, that they have
      joined it, unlocked it, left a comment on it (without its text), or rated
      more names than you on it (with the difference). So as not to notify you too often, a counter keeps,
      for two days at most, the time of the last message of this kind, under a key that contains neither your name
      nor your address.
    </dd>
    <dt>Why</dt>
    <dd>To let you know what is happening in your lists when you are not there: a match, an arrival,
      an unlocking, a comment, the lead taken by another member. Nothing else: no reminders, no promotions.</dd>
    <dt>Legal basis</dt>
    <dd>Your consent (art. 6.1.a): nothing is recorded until you have tapped “Notify me” in the
      app. You can withdraw it whenever you wish: “Stop notifying me” in “My
      account”, or the phone’s settings (on Android, they also let you keep only
      matches).</dd>
  </dl>

  <h3>Technical logs</h3>
  <dl>
    <dt>Data</dt>
    <dd>IP address, date, address of the page requested and type of browser, recorded by our host for each request.</dd>
    <dt>Why</dt>
    <dd>To operate and secure the service, and to diagnose a failure.</dd>
    <dt>Legal basis</dt>
    <dd>Our legitimate interest in ensuring the security of the service (art. 6.1.f).</dd>
  </dl>

  <p>
    We carry out <strong>no advertising profiling</strong> and no automated decision produces
    any effect on you within the meaning of Article 22 GDPR. The “portrait” of your tastes is merely a calculation on your
    own votes, shown to you and to the members of the list.
  </p>

  <h2>Who sees what</h2>
  <ul>
    <li>
      <strong>The members of a list</strong> see your display name, your comments, the number of names
      you have rated and the matches you have taken part in. Your vote on a name is only
      shown to them once they have voted on that same name: this is the blind vote. No one sees who
      vetoed a name. An “already taken” name, on the other hand, is meant to be seen: it is shown to
      the whole list, observers included, with your name and your note. Likewise a name you add to the
      list outside the catalogue: its card says you added it, with your note. And a name outside the
      list’s filters that you found through the search and rated yes or neutral: it goes to the top of
      the other members’ stacks, and its card says you proposed it.
    </li>
    <li><strong>The publisher</strong> has technical access to the database, for maintenance and support. They do not consult it outside these needs.</li>
    <li><strong>Our providers</strong>, solely for what they do for us:</li>
  </ul>
  <ul class="prestataires">
    <li v-for="d in DESTINATAIRES" :key="d.nom">
      <strong>{{ d.nom }}</strong>: {{ d.en.role }}. {{ d.en.pays }}. Safeguards: {{ d.en.garantie }}.
      <a :href="d.lien" rel="noopener">Its policy</a>.
    </li>
  </ul>

  <h2>Transfers outside the European Union</h2>
  <p>
    Cloudflare, which hosts the application, is an American company: your data may be processed
    in the United States<template v-if="e.regionDonnees">, but the database itself is kept in
    {{ e.regionDonneesEn }}</template>.
    These transfers rely on the European Commission’s adequacy decision for companies
    certified under the Data Privacy Framework, and on the Commission’s standard contractual clauses.
    Stripe Payments Europe is established in Ireland; some data may be processed by Stripe, Inc.
    in the United States, under the same safeguards. A purchase made in the iPhone app is collected by Apple
    Distribution International, also established in Ireland; some data may be processed
    by Apple Inc. in the United States. The nightly backup goes through GitHub, also an American
    company: the database is encrypted there for the duration of the task, under the same safeguards, and the encrypted
    copy is kept in France, at OVH.
    If you enable notifications in the iPhone or Android app, each message goes through Expo, an American
    company, then through Apple or Google, which deliver it to your phone: under the same safeguards.
    <template v-if="COURRIEL.fournisseur === 'resend'">
      Resend, which sends the sign-in emails, is also an American company (standard contractual
      clauses).
    </template>
    <template v-else-if="COURRIEL.fournisseur === 'brevo'">
      Sign-in emails are sent through Brevo, a French company, from the European Union.
    </template>
    <template v-else>
      Sign-in emails are sent from the babynamed.fr mail service, at OVH, a French company,
      from France.
    </template>
  </p>

  <h2>How long</h2>
  <ul>
    <li><strong>Account and lists</strong>: as long as you use them. Erased immediately if you delete your account; erased automatically after <strong>{{ c.inactiviteMois }} months</strong> without opening the app.</li>
    <li><strong>A list</strong> is erased, whether or not it has been unlocked, as soon as its owner deletes it (from its settings, for everyone), or when there is no one left in it to make decisions.</li>
    <li><strong>Leaving a list</strong> erases what you gave there: votes, vetoes, favourites, comments. The “already taken” names you added there remain with the list, without your name or your note; likewise the names you added or proposed there.</li>
    <li><strong>Gift codes</strong>: a code that is never used is erased {{ c.cadeauMois }} months after purchase, along with the name and message of the person who gave it; a cancelled code, one month later; a used code remains attached to the list it unlocked (“a gift from…”) and disappears with it.</li>
    <li><strong>“Already taken” names</strong>: they belong to the list. If you erase your account, those you added remain there for the other members, without your name or your note.</li>
    <li><strong>Added or proposed names</strong>: they too belong to the list, whose members may have rated them. As long as no one else has, you can remove a name you added outside the catalogue, from its card; a proposal is withdrawn if you then say no to the name. If you erase your account, they remain, without your name or your note.</li>
    <li><strong>Free version counters</strong>: the total, with the account; the daily one, until the next day of sorting, and {{ c.quotaJours }} days at most.</li>
    <li><strong>Sign-in cookie</strong>: {{ c.sessionJours }} days, renewed at each sign-in. <em>My account → Log out my other devices</em> cancels them all at once, except the one on the device in hand.</li>
    <li><strong>Email address and passkeys</strong>: as long as your account exists, or until you remove them in <em>My account</em>.</li>
    <li><strong>Notification token</strong> (iPhone or Android app): as long as notifications are enabled on this phone. Erased as soon as you turn them off, on logging out, when you log out your other devices, with the account, and as soon as Apple or Google report it as expired (app uninstalled).</li>
    <li><strong>Links and codes by email</strong> (sign-in, sign-up): valid for {{ c.lienMinutes }} minutes, once only; erased the day after they expire, along with the address and first name of a sign-up that was never confirmed.</li>
    <li><strong>Attempt counters</strong>: two days at most.</li>
    <li><strong>Records relating to a payment</strong> (invoice, payment): {{ c.comptabiliteAns }} years, a period imposed by the French Commercial Code (art. L123-22). They are kept by Stripe or by Apple, depending on where the purchase was made, and in our accounts, not in the app.</li>
    <li><strong>Purchase in the iPhone app</strong>: the transaction number remains attached to the unlocked list and to your account, as long as either of them exists. A purchase sheet opened then closed without a purchase leaves only a technical trace (a randomly drawn identifier, the list concerned), erased after {{ c.intentionAchatMois }} months.</li>
    <li><strong>Technical logs</strong>: a few days at most, at the host.</li>
    <li><strong>Backups</strong>: the database keeps {{ c.historiqueJours }} days of restore history. Each night, an encrypted copy is also sent to OVH, in France: we keep the last {{ c.sauvegardeNuits }} nights, then one copy per month for {{ c.sauvegardeMois }} months. They are used only to repair a failure or an error. Erased data thus disappear from all copies no later than {{ c.sauvegardeMois }} months afterwards.</li>
  </ul>

  <h2>Your rights</h2>
  <p>You have the following rights over your data:</p>
  <ul>
    <li><strong>Access and portability</strong>: <em>My account → Download my data</em> gives you everything, in a readable and reusable file (JSON).</li>
    <li><strong>Rectification</strong>: your display name can be changed in <em>My account</em>; the rest (votes, comments, lists) can be edited in the app.</li>
    <li><strong>Erasure</strong>: <em>My account → Delete my account</em>, immediate and permanent. The lists you share remain with their other members; those where you were the only member are erased.</li>
    <li><strong>Restriction and objection</strong>: for processing based on our legitimate interest (the technical logs), you may object on grounds relating to your situation.</li>
    <li><strong>Instructions after your death</strong>: you may tell us what you wish to be done with your data (art. 85 of the French Data Protection Act, <span lang="fr">loi Informatique et Libertés</span>).</li>
  </ul>
  <p>
    For any request that cannot be made from the app, write to
    <a :href="`mailto:${e.email}`">{{ e.email }}</a>. We reply within one month. If no
    address is linked to your account, we will ask you for something to verify that it is indeed yours,
    never a sign-in code.
  </p>
  <p>
    If you consider that your rights are not being respected, you may lodge a complaint with the CNIL (French data protection authority)
    ({{ CNIL.adresse }}, <a :href="CNIL.plainte" rel="noopener">cnil.fr/plaintes</a>).
  </p>

  <h2>Cookies and storage on your device</h2>
  <p>babyNamed sets <strong>no advertising or audience measurement cookies</strong>. What it keeps on your device is used to make the app work, or for audience measurement strictly limited to babyNamed, which exempts it from your consent (art. 82 of the French Data Protection Act, CNIL guidelines):</p>
  <ul>
    <li><strong>pr_session</strong> (cookie): keeps you signed in for {{ c.sessionJours }} days. Unreadable by the page’s scripts, sent only over HTTPS.</li>
    <li><strong>pr_defi</strong> (cookie): for the time it takes to create or use a passkey, five minutes at most; it is erased as soon as it has been used.</li>
    <li><strong>Browser local storage</strong>: the list you are sorting, the number of matches already seen, the day’s break reminder, the name chosen from a name page until it has been rated, a gift code received by link while you sign in (one month at most), and a word that says how you arrived the first time (a page of the website, a search engine, TikTok, a gift link…). This information stays on your device and is erased when you log out, except the chosen theme (light, dark) and, in the iPhone or Android app, the choice of whether or not to be notified on this phone: settings of the device, not of the account.</li>
    <li><strong>Offline cache</strong>: the application files and the catalogue of names, so that the app opens quickly. No personal data.</li>
  </ul>
  <p>The typeface is served by babyNamed itself: opening the app sends nothing to Google.</p>
  <h3>Audience measurement</h3>
  <p>To know which pages are read and where visitors come from, babyNamed uses <strong>Cloudflare Web Analytics</strong>: without cookies, without storage on your device, without any identifier that would follow you from one site to another. It counts page views, the referring site, the type of device and the country; it serves no other purpose and is not combined with any other data.</p>
  <p>At sign-up, and when buying a gift, the app also keeps this word of origin (for example “tiktok” or “google”), never the address of the page you came from. It appears in your downloadable data and is erased with the account.</p>

  <h2>Security</h2>
  <p>
    Encrypted connections (HTTPS); no password: passkeys (only the public key is kept) or a link
    and code by email, single-use and kept in fingerprint form; limited number of attempts; cookie
    inaccessible to scripts, and revocable from <em>My account</em>; a content security policy that
    prevents the execution of foreign scripts; secrets and database accessible to the server alone;
    payment entrusted to Stripe, PCI-DSS certified. In the event of a data breach presenting a risk to you, the CNIL and,
    where necessary, the persons concerned will be notified within the time limits laid down by the GDPR.
  </p>

  <h2>Minors</h2>
  <p>babyNamed is intended for adults who are choosing a first name for their child.</p>

  <h2>Changes</h2>
  <p>
    This policy may change; the date at the top of the page indicates its version. In the event of a significant change
    (new use, new provider), we will notify you in the app before it applies.
  </p>
</template>

<style scoped>
.prestataires { margin-top: -4px; }
.avis-traduction { font-size: .9rem; color: var(--doux); }
.lien-fr { border: 0; background: none; padding: 0; font: inherit; color: var(--texte);
  text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
</style>
