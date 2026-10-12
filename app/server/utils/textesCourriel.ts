import type { LangueCompte } from './langues'

/**
 * Les textes des e-mails (courriel.ts), dans les langues d'un compte.
 *
 * Le français est la source ; l'anglais en est traduit, les autres langues
 * de l'anglais. Le français ne change pas : les essais y cherchent leurs mots
 * (essais/essai-connexion.mjs) et la boîte de dev y lit le code
 * (api/dev/courriels.get.ts, « … : 123456 » en fin de ligne).
 *
 * Forme de politesse : vouvoiement (fr, de, nl, lv), « du » (sv, nb, l'usage),
 * « Ty » avec majuscule en polonais (« Pan/Pani » demanderait le genre). Pas
 * de participe passé accordé à la personne dans les langues qui l'accordent :
 * on ne connaît pas le genre de celui qui lit.
 */
export interface MessageCode {
  sujet: (code: string) => string
  /** Le titre du message mis en forme. */
  titre: (pseudo: string) => string
  /** La phrase avant le lien, en texte brut (elle finit par « ouvrez ce lien : »). */
  texte: string
  /** La même, au-dessus du bouton. `pseudo` arrive déjà échappé. */
  html: (pseudo: string) => string
  bouton: string
  fin: (minutes: number) => string
}

export interface TextesCourriel {
  /** La première ligne du texte brut : « Bonjour Alice, ». */
  salut: (pseudo: string) => string
  /** Suivi du code, en texte brut, et au-dessus de lui, en HTML. */
  ouTapez: string
  copier: string
  connexion: MessageCode
  verification: MessageCode
  inscription: MessageCode
  dejaInscrit: MessageCode
  /** Sous chaque alerte de sécurité. */
  siPasVous: string
  passkey: { sujet: string; texte: (pseudo: string, nom: string) => string }
  adresse: { sujet: string; texte: (pseudo: string, nouvelle: string) => string }
}

/** « 15 minut » / « 2 minuty » / « 1 minutę ». */
const minutesPl = (m: number) => m === 1 ? '1 minutę'
  : m % 10 >= 2 && m % 10 <= 4 && (m % 100 < 12 || m % 100 > 14) ? `${m} minuty` : `${m} minut`
/** « 15 minūtes » / « 21 minūti ». */
const minutesLv = (m: number) => m % 10 === 1 && m % 100 !== 11 ? `${m} minūti` : `${m} minūtes`

const fr: TextesCourriel = {
  salut: p => `Bonjour ${p},`,
  ouTapez: 'Ou tapez ce code dans l’app :',
  copier: 'Copier le code',
  connexion: {
    sujet: c => `Votre code de connexion à babyNamed : ${c}`,
    titre: p => `Bonjour ${p}`,
    texte: 'Pour vous connecter à babyNamed sur cet appareil, ouvrez ce lien :',
    html: () => 'Pour vous connecter à babyNamed sur cet appareil :',
    bouton: 'Me connecter',
    fin: m => `Lien et code valent ${m} minutes, une seule fois. Si vous n’avez rien demandé, ignorez ce message : personne ne peut entrer sans eux.`
  },
  verification: {
    sujet: c => `Confirmez votre adresse, code ${c}`,
    titre: () => 'Confirmez votre adresse',
    texte: 'Pour pouvoir retrouver votre compte babyNamed avec cette adresse, confirmez-la :',
    html: p => `${p}, pour pouvoir retrouver votre compte babyNamed avec cette adresse :`,
    bouton: 'Confirmer mon adresse',
    fin: m => `Valable ${m} minutes. Si vous n’avez rien demandé, ignorez ce message : l’adresse ne sera pas enregistrée.`
  },
  inscription: {
    sujet: c => `Votre code d’inscription à babyNamed : ${c}`,
    titre: p => `Bienvenue ${p}`,
    texte: 'Pour créer votre compte babyNamed, ouvrez ce lien :',
    html: () => 'Pour créer votre compte babyNamed :',
    bouton: 'Créer mon compte',
    fin: m => `Valable ${m} minutes. Si vous n’avez rien demandé, ignorez ce message : aucun compte ne sera créé.`
  },
  dejaInscrit: {
    sujet: c => `Vous avez déjà un compte babyNamed, code ${c}`,
    titre: p => `Bonjour ${p}`,
    texte: 'Cette adresse a déjà un compte babyNamed : inutile d’en créer un second. Pour y entrer, ouvrez ce lien :',
    html: () => 'Cette adresse a déjà un compte babyNamed : inutile d’en créer un second. Pour y entrer :',
    bouton: 'Me connecter',
    fin: m => `Lien et code valent ${m} minutes, une seule fois. Si vous n’avez rien demandé, ignorez ce message : personne ne peut entrer sans eux.`
  },
  siPasVous: 'Si ce n’est pas vous : ouvrez babyNamed, Mon compte → Se connecter, retirez ce que vous ne reconnaissez pas, puis « Déconnecter mes autres appareils ».',
  passkey: {
    sujet: 'Une passkey a été ajoutée à votre compte',
    texte: (p, nom) => `${p}, une passkey (${nom}) vient d’être ajoutée à votre compte babyNamed : elle permet désormais de s’y connecter.`
  },
  adresse: {
    sujet: 'L’adresse de votre compte a changé',
    texte: (p, nouvelle) => `${p}, l’adresse de votre compte babyNamed est désormais ${nouvelle}. Les liens de connexion partiront là-bas, plus ici.`
  }
}

const en: TextesCourriel = {
  salut: p => `Hello ${p},`,
  ouTapez: 'Or enter this code in the app:',
  copier: 'Copy the code',
  connexion: {
    sujet: c => `Your babyNamed login code: ${c}`,
    titre: p => `Hello ${p}`,
    texte: 'To log in to babyNamed on this device, open this link:',
    html: () => 'To log in to babyNamed on this device:',
    bouton: 'Log me in',
    fin: m => `The link and code are valid for ${m} minutes, once only. If you didn’t ask for this, ignore this message: no one can get in without them.`
  },
  verification: {
    sujet: c => `Confirm your address, code ${c}`,
    titre: () => 'Confirm your address',
    texte: 'So that you can find your babyNamed account again with this address, please confirm it:',
    html: p => `${p}, so that you can find your babyNamed account again with this address:`,
    bouton: 'Confirm my address',
    fin: m => `Valid for ${m} minutes. If you didn’t ask for this, ignore this message: the address won’t be saved.`
  },
  inscription: {
    sujet: c => `Your babyNamed sign-up code: ${c}`,
    titre: p => `Welcome ${p}`,
    texte: 'To create your babyNamed account, open this link:',
    html: () => 'To create your babyNamed account:',
    bouton: 'Create my account',
    fin: m => `Valid for ${m} minutes. If you didn’t ask for this, ignore this message: no account will be created.`
  },
  dejaInscrit: {
    sujet: c => `You already have a babyNamed account, code ${c}`,
    titre: p => `Hello ${p}`,
    texte: 'This address already has a babyNamed account: no need to create a second one. To get in, open this link:',
    html: () => 'This address already has a babyNamed account: no need to create a second one. To get in:',
    bouton: 'Log me in',
    fin: m => `The link and code are valid for ${m} minutes, once only. If you didn’t ask for this, ignore this message: no one can get in without them.`
  },
  siPasVous: 'If this wasn’t you: open babyNamed, go to My account → Log in, remove anything you don’t recognise, then choose “Log out my other devices”.',
  passkey: {
    sujet: 'A passkey has been added to your account',
    texte: (p, nom) => `${p}, a passkey (${nom}) has just been added to your babyNamed account: it can now be used to log in.`
  },
  adresse: {
    sujet: 'Your account’s address has changed',
    texte: (p, nouvelle) => `${p}, your babyNamed account’s address is now ${nouvelle}. Login links will go there from now on, not here.`
  }
}

const de: TextesCourriel = {
  salut: p => `Hallo ${p},`,
  ouTapez: 'Oder geben Sie diesen Code in der App ein:',
  copier: 'Code kopieren',
  connexion: {
    sujet: c => `Ihr Anmeldecode für babyNamed: ${c}`,
    titre: p => `Hallo ${p}`,
    texte: 'Um sich auf diesem Gerät bei babyNamed anzumelden, öffnen Sie diesen Link:',
    html: () => 'Um sich auf diesem Gerät bei babyNamed anzumelden:',
    bouton: 'Anmelden',
    fin: m => `Link und Code sind ${m} Minuten gültig, nur ein einziges Mal. Wenn Sie nichts angefordert haben, ignorieren Sie diese Nachricht: Ohne sie kommt niemand in Ihr Konto.`
  },
  verification: {
    sujet: c => `Bestätigen Sie Ihre Adresse, Code ${c}`,
    titre: () => 'Bestätigen Sie Ihre Adresse',
    texte: 'Damit Sie Ihr babyNamed-Konto mit dieser Adresse wiederfinden können, bestätigen Sie sie bitte:',
    html: p => `${p}, damit Sie Ihr babyNamed-Konto mit dieser Adresse wiederfinden können:`,
    bouton: 'Adresse bestätigen',
    fin: m => `${m} Minuten gültig. Wenn Sie nichts angefordert haben, ignorieren Sie diese Nachricht: Die Adresse wird nicht gespeichert.`
  },
  inscription: {
    sujet: c => `Ihr Registrierungscode für babyNamed: ${c}`,
    titre: p => `Willkommen ${p}`,
    texte: 'Um Ihr babyNamed-Konto zu erstellen, öffnen Sie diesen Link:',
    html: () => 'Um Ihr babyNamed-Konto zu erstellen:',
    bouton: 'Konto erstellen',
    fin: m => `${m} Minuten gültig. Wenn Sie nichts angefordert haben, ignorieren Sie diese Nachricht: Es wird kein Konto erstellt.`
  },
  dejaInscrit: {
    sujet: c => `Sie haben bereits ein babyNamed-Konto, Code ${c}`,
    titre: p => `Hallo ${p}`,
    texte: 'Zu dieser Adresse gibt es bereits ein babyNamed-Konto: Ein zweites ist nicht nötig. Um sich anzumelden, öffnen Sie diesen Link:',
    html: () => 'Zu dieser Adresse gibt es bereits ein babyNamed-Konto: Ein zweites ist nicht nötig. Um sich anzumelden:',
    bouton: 'Anmelden',
    fin: m => `Link und Code sind ${m} Minuten gültig, nur ein einziges Mal. Wenn Sie nichts angefordert haben, ignorieren Sie diese Nachricht: Ohne sie kommt niemand in Ihr Konto.`
  },
  siPasVous: 'Waren Sie das nicht? Öffnen Sie babyNamed, Mein Konto → Anmelden, entfernen Sie alles, was Sie nicht kennen, und wählen Sie dann „Meine anderen Geräte abmelden“.',
  passkey: {
    sujet: 'Ihrem Konto wurde ein Passkey hinzugefügt',
    texte: (p, nom) => `${p}, Ihrem babyNamed-Konto wurde soeben ein Passkey (${nom}) hinzugefügt: Damit kann man sich jetzt anmelden.`
  },
  adresse: {
    sujet: 'Die Adresse Ihres Kontos wurde geändert',
    texte: (p, nouvelle) => `${p}, die Adresse Ihres babyNamed-Kontos lautet jetzt ${nouvelle}. Anmeldelinks gehen ab sofort dorthin, nicht mehr hierher.`
  }
}

const nl: TextesCourriel = {
  salut: p => `Hallo ${p},`,
  ouTapez: 'Of voer deze code in de app in:',
  copier: 'Code kopiëren',
  connexion: {
    sujet: c => `Uw inlogcode voor babyNamed: ${c}`,
    titre: p => `Hallo ${p}`,
    texte: 'Open deze link om op dit apparaat in te loggen bij babyNamed:',
    html: () => 'Om op dit apparaat in te loggen bij babyNamed:',
    bouton: 'Inloggen',
    fin: m => `Link en code zijn ${m} minuten geldig, voor één keer. Heeft u niets aangevraagd? Negeer dan dit bericht: zonder deze gegevens kan niemand inloggen.`
  },
  verification: {
    sujet: c => `Bevestig uw adres, code ${c}`,
    titre: () => 'Bevestig uw adres',
    texte: 'Bevestig dit adres, zodat u uw babyNamed-account ermee kunt terugvinden:',
    html: p => `${p}, om uw babyNamed-account met dit adres terug te kunnen vinden:`,
    bouton: 'Mijn adres bevestigen',
    fin: m => `${m} minuten geldig. Heeft u niets aangevraagd? Negeer dan dit bericht: het adres wordt niet opgeslagen.`
  },
  inscription: {
    sujet: c => `Uw registratiecode voor babyNamed: ${c}`,
    titre: p => `Welkom ${p}`,
    texte: 'Open deze link om uw babyNamed-account aan te maken:',
    html: () => 'Om uw babyNamed-account aan te maken:',
    bouton: 'Mijn account aanmaken',
    fin: m => `${m} minuten geldig. Heeft u niets aangevraagd? Negeer dan dit bericht: er wordt geen account aangemaakt.`
  },
  dejaInscrit: {
    sujet: c => `U heeft al een babyNamed-account, code ${c}`,
    titre: p => `Hallo ${p}`,
    texte: 'Dit adres heeft al een babyNamed-account: een tweede is niet nodig. Open deze link om in te loggen:',
    html: () => 'Dit adres heeft al een babyNamed-account: een tweede is niet nodig. Om in te loggen:',
    bouton: 'Inloggen',
    fin: m => `Link en code zijn ${m} minuten geldig, voor één keer. Heeft u niets aangevraagd? Negeer dan dit bericht: zonder deze gegevens kan niemand inloggen.`
  },
  siPasVous: 'Was u dit niet? Open babyNamed, ga naar Mijn account → Inloggen, verwijder wat u niet herkent en kies daarna ‘Mijn andere apparaten uitloggen’.',
  passkey: {
    sujet: 'Er is een passkey aan uw account toegevoegd',
    texte: (p, nom) => `${p}, er is zojuist een passkey (${nom}) aan uw babyNamed-account toegevoegd: daarmee kan nu worden ingelogd.`
  },
  adresse: {
    sujet: 'Het adres van uw account is gewijzigd',
    texte: (p, nouvelle) => `${p}, het adres van uw babyNamed-account is nu ${nouvelle}. Inloglinks gaan voortaan daarheen, niet meer hierheen.`
  }
}

const sv: TextesCourriel = {
  salut: p => `Hej ${p},`,
  ouTapez: 'Eller skriv in den här koden i appen:',
  copier: 'Kopiera koden',
  connexion: {
    sujet: c => `Din inloggningskod till babyNamed: ${c}`,
    titre: p => `Hej ${p}`,
    texte: 'Öppna den här länken för att logga in på babyNamed på den här enheten:',
    html: () => 'För att logga in på babyNamed på den här enheten:',
    bouton: 'Logga in',
    fin: m => `Länken och koden gäller i ${m} minuter och kan bara användas en gång. Har du inte bett om detta kan du ignorera meddelandet: ingen kan logga in utan dem.`
  },
  verification: {
    sujet: c => `Bekräfta din adress, kod ${c}`,
    titre: () => 'Bekräfta din adress',
    texte: 'Bekräfta adressen, så att du kan hitta tillbaka till ditt babyNamed-konto med den:',
    html: p => `${p}, för att kunna hitta tillbaka till ditt babyNamed-konto med den här adressen:`,
    bouton: 'Bekräfta min adress',
    fin: m => `Gäller i ${m} minuter. Har du inte bett om detta kan du ignorera meddelandet: adressen sparas inte.`
  },
  inscription: {
    sujet: c => `Din registreringskod till babyNamed: ${c}`,
    titre: p => `Välkommen ${p}`,
    texte: 'Öppna den här länken för att skapa ditt babyNamed-konto:',
    html: () => 'För att skapa ditt babyNamed-konto:',
    bouton: 'Skapa mitt konto',
    fin: m => `Gäller i ${m} minuter. Har du inte bett om detta kan du ignorera meddelandet: inget konto skapas.`
  },
  dejaInscrit: {
    sujet: c => `Du har redan ett babyNamed-konto, kod ${c}`,
    titre: p => `Hej ${p}`,
    texte: 'Den här adressen har redan ett babyNamed-konto, så du behöver inte skapa ett till. Öppna den här länken för att logga in:',
    html: () => 'Den här adressen har redan ett babyNamed-konto, så du behöver inte skapa ett till. För att logga in:',
    bouton: 'Logga in',
    fin: m => `Länken och koden gäller i ${m} minuter och kan bara användas en gång. Har du inte bett om detta kan du ignorera meddelandet: ingen kan logga in utan dem.`
  },
  siPasVous: 'Var det inte du? Öppna babyNamed, Mitt konto → Logga in, ta bort det du inte känner igen och välj sedan ”Logga ut mina andra enheter”.',
  passkey: {
    sujet: 'En passkey har lagts till på ditt konto',
    texte: (p, nom) => `${p}, en passkey (${nom}) har just lagts till på ditt babyNamed-konto: den kan nu användas för att logga in.`
  },
  adresse: {
    sujet: 'Adressen till ditt konto har ändrats',
    texte: (p, nouvelle) => `${p}, adressen till ditt babyNamed-konto är nu ${nouvelle}. Inloggningslänkar skickas dit från och med nu, inte hit.`
  }
}

const nb: TextesCourriel = {
  salut: p => `Hei ${p},`,
  ouTapez: 'Eller skriv inn denne koden i appen:',
  copier: 'Kopier koden',
  connexion: {
    sujet: c => `Din innloggingskode for babyNamed: ${c}`,
    titre: p => `Hei ${p}`,
    texte: 'Åpne denne lenken for å logge inn på babyNamed på denne enheten:',
    html: () => 'For å logge inn på babyNamed på denne enheten:',
    bouton: 'Logg inn',
    fin: m => `Lenken og koden gjelder i ${m} minutter og kan bare brukes én gang. Har du ikke bedt om dette, kan du se bort fra meldingen: ingen kan logge inn uten dem.`
  },
  verification: {
    sujet: c => `Bekreft adressen din, kode ${c}`,
    titre: () => 'Bekreft adressen din',
    texte: 'Bekreft adressen, slik at du kan finne igjen babyNamed-kontoen din med den:',
    html: p => `${p}, for å kunne finne igjen babyNamed-kontoen din med denne adressen:`,
    bouton: 'Bekreft adressen min',
    fin: m => `Gjelder i ${m} minutter. Har du ikke bedt om dette, kan du se bort fra meldingen: adressen blir ikke lagret.`
  },
  inscription: {
    sujet: c => `Din registreringskode for babyNamed: ${c}`,
    titre: p => `Velkommen ${p}`,
    texte: 'Åpne denne lenken for å opprette babyNamed-kontoen din:',
    html: () => 'For å opprette babyNamed-kontoen din:',
    bouton: 'Opprett kontoen min',
    fin: m => `Gjelder i ${m} minutter. Har du ikke bedt om dette, kan du se bort fra meldingen: ingen konto blir opprettet.`
  },
  dejaInscrit: {
    sujet: c => `Du har allerede en babyNamed-konto, kode ${c}`,
    titre: p => `Hei ${p}`,
    texte: 'Denne adressen har allerede en babyNamed-konto, så du trenger ikke å opprette en til. Åpne denne lenken for å logge inn:',
    html: () => 'Denne adressen har allerede en babyNamed-konto, så du trenger ikke å opprette en til. For å logge inn:',
    bouton: 'Logg inn',
    fin: m => `Lenken og koden gjelder i ${m} minutter og kan bare brukes én gang. Har du ikke bedt om dette, kan du se bort fra meldingen: ingen kan logge inn uten dem.`
  },
  siPasVous: 'Var det ikke deg? Åpne babyNamed, Min konto → Logg inn, fjern det du ikke kjenner igjen, og velg deretter «Logg ut mine andre enheter».',
  passkey: {
    sujet: 'En passkey er lagt til på kontoen din',
    texte: (p, nom) => `${p}, en passkey (${nom}) er nettopp lagt til på babyNamed-kontoen din: den kan nå brukes til å logge inn.`
  },
  adresse: {
    sujet: 'Adressen til kontoen din er endret',
    texte: (p, nouvelle) => `${p}, adressen til babyNamed-kontoen din er nå ${nouvelle}. Innloggingslenker sendes dit fra nå av, ikke hit.`
  }
}

const pl: TextesCourriel = {
  salut: p => `Dzień dobry, ${p}!`,
  ouTapez: 'Albo wpisz ten kod w aplikacji:',
  copier: 'Skopiuj kod',
  connexion: {
    sujet: c => `Twój kod logowania do babyNamed: ${c}`,
    titre: p => `Dzień dobry, ${p}`,
    texte: 'Aby zalogować się do babyNamed na tym urządzeniu, otwórz ten link:',
    html: () => 'Aby zalogować się do babyNamed na tym urządzeniu:',
    bouton: 'Zaloguj mnie',
    fin: m => `Link i kod są ważne przez ${minutesPl(m)}, tylko raz. Jeśli to nie Ty, zignoruj tę wiadomość: bez nich nikt się nie zaloguje.`
  },
  verification: {
    sujet: c => `Potwierdź swój adres, kod ${c}`,
    titre: () => 'Potwierdź swój adres',
    texte: 'Potwierdź ten adres, aby móc dzięki niemu odzyskać swoje konto babyNamed:',
    html: p => `${p}, aby móc dzięki temu adresowi odzyskać swoje konto babyNamed:`,
    bouton: 'Potwierdź mój adres',
    fin: m => `Ważne przez ${minutesPl(m)}. Jeśli to nie Ty, zignoruj tę wiadomość: adres nie zostanie zapisany.`
  },
  inscription: {
    sujet: c => `Twój kod rejestracji w babyNamed: ${c}`,
    titre: p => `Witaj, ${p}`,
    texte: 'Aby założyć konto babyNamed, otwórz ten link:',
    html: () => 'Aby założyć konto babyNamed:',
    bouton: 'Załóż konto',
    fin: m => `Ważne przez ${minutesPl(m)}. Jeśli to nie Ty, zignoruj tę wiadomość: żadne konto nie zostanie założone.`
  },
  dejaInscrit: {
    sujet: c => `Masz już konto babyNamed, kod ${c}`,
    titre: p => `Dzień dobry, ${p}`,
    texte: 'Ten adres ma już konto babyNamed: nie trzeba zakładać drugiego. Aby się zalogować, otwórz ten link:',
    html: () => 'Ten adres ma już konto babyNamed: nie trzeba zakładać drugiego. Aby się zalogować:',
    bouton: 'Zaloguj mnie',
    fin: m => `Link i kod są ważne przez ${minutesPl(m)}, tylko raz. Jeśli to nie Ty, zignoruj tę wiadomość: bez nich nikt się nie zaloguje.`
  },
  siPasVous: 'Jeśli to nie Ty: otwórz babyNamed, Moje konto → Logowanie, usuń to, czego nie rozpoznajesz, a potem wybierz „Wyloguj moje inne urządzenia”.',
  passkey: {
    sujet: 'Do Twojego konta dodano passkey',
    texte: (p, nom) => `${p}, do Twojego konta babyNamed właśnie dodano passkey (${nom}): od teraz można się nim logować.`
  },
  adresse: {
    sujet: 'Adres Twojego konta został zmieniony',
    texte: (p, nouvelle) => `${p}, adres Twojego konta babyNamed to teraz ${nouvelle}. Linki do logowania będą trafiać tam, a nie tutaj.`
  }
}

const lv: TextesCourriel = {
  salut: p => `Labdien, ${p}!`,
  ouTapez: 'Vai ievadiet šo kodu lietotnē:',
  copier: 'Kopēt kodu',
  connexion: {
    sujet: c => `Jūsu babyNamed pieteikšanās kods: ${c}`,
    titre: p => `Labdien, ${p}`,
    texte: 'Lai pieteiktos babyNamed šajā ierīcē, atveriet šo saiti:',
    html: () => 'Lai pieteiktos babyNamed šajā ierīcē:',
    bouton: 'Pieteikties',
    fin: m => `Saite un kods ir derīgi ${minutesLv(m)}, tikai vienu reizi. Ja tas nebijāt Jūs, neņemiet šo ziņu vērā: bez tiem neviens nevar pieteikties.`
  },
  verification: {
    sujet: c => `Apstipriniet savu adresi, kods ${c}`,
    titre: () => 'Apstipriniet savu adresi',
    texte: 'Apstipriniet šo adresi, lai ar to varētu atgūt savu babyNamed kontu:',
    html: p => `${p}, lai ar šo adresi varētu atgūt savu babyNamed kontu:`,
    bouton: 'Apstiprināt adresi',
    fin: m => `Derīgs ${minutesLv(m)}. Ja tas nebijāt Jūs, neņemiet šo ziņu vērā: adrese netiks saglabāta.`
  },
  inscription: {
    sujet: c => `Jūsu babyNamed reģistrācijas kods: ${c}`,
    titre: p => `Laipni lūdzam, ${p}`,
    texte: 'Lai izveidotu savu babyNamed kontu, atveriet šo saiti:',
    html: () => 'Lai izveidotu savu babyNamed kontu:',
    bouton: 'Izveidot kontu',
    fin: m => `Derīgs ${minutesLv(m)}. Ja tas nebijāt Jūs, neņemiet šo ziņu vērā: konts netiks izveidots.`
  },
  dejaInscrit: {
    sujet: c => `Jums jau ir babyNamed konts, kods ${c}`,
    titre: p => `Labdien, ${p}`,
    texte: 'Šai adresei jau ir babyNamed konts, otrs nav vajadzīgs. Lai pieteiktos, atveriet šo saiti:',
    html: () => 'Šai adresei jau ir babyNamed konts, otrs nav vajadzīgs. Lai pieteiktos:',
    bouton: 'Pieteikties',
    fin: m => `Saite un kods ir derīgi ${minutesLv(m)}, tikai vienu reizi. Ja tas nebijāt Jūs, neņemiet šo ziņu vērā: bez tiem neviens nevar pieteikties.`
  },
  siPasVous: 'Ja tas nebijāt Jūs: atveriet babyNamed, Mans konts → Pieteikšanās, noņemiet to, ko neatpazīstat, un pēc tam izvēlieties “Izrakstīties citās manās ierīcēs”.',
  passkey: {
    sujet: 'Jūsu kontam pievienota piekļuves atslēga (passkey)',
    texte: (p, nom) => `${p}, Jūsu babyNamed kontam tikko pievienota piekļuves atslēga (passkey, ${nom}): ar to tagad var pieteikties.`
  },
  adresse: {
    sujet: 'Jūsu konta adrese ir mainīta',
    texte: (p, nouvelle) => `${p}, Jūsu babyNamed konta adrese tagad ir ${nouvelle}. Pieteikšanās saites turpmāk tiks sūtītas turp, nevis šeit.`
  }
}

const TEXTES_COURRIEL: Record<LangueCompte, TextesCourriel> = { fr, en, de, nl, sv, nb, pl, lv }

/** Les textes des e-mails dans une langue (inconnue : le français). */
export function textesCourriel(l: LangueCompte | string | null | undefined): TextesCourriel {
  return TEXTES_COURRIEL[l as LangueCompte] ?? fr
}
