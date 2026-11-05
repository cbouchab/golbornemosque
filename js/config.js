/*
 * Golborne Mosque — site settings
 * ---------------------------------------------------------------
 * This is the only file that needs editing for day-to-day updates:
 * Jumu'ah, notices and donation details. Daily adhan and iqamah times come
 * from the mosque's own timetable, the one its TV screens show: the files in
 * timetables/, turned into data/mosque-times.js by scripts/import-timetables.mjs
 * (README → Prayer times). They cover 2026 to 2033.
 *
 * Times use the 24-hour clock as text, e.g. "13:30".
 * Anything left as null is simply not shown on the website.
 */
window.MOSQUE_CONFIG = {
  name: "Golborne Mosque",
  arabicName: "مسجد غولبورن",

  // 76 Golborne Road, London W10 5PS
  location: { lat: 51.52195, lng: -0.2086, timeZone: "Europe/London" },

  // The mosque's MyLocalMasjid listing. If its times are ever synced
  // (scripts/sync-prayer-times.mjs → data/timetable.js), they fill any day the
  // mosque's own timetable doesn't cover.
  myLocalMasjid: {
    id: "3f6cc274-7ec9-4367-b925-966d484ae2f9",
    url: "https://mylocalmasjid.com/uk/london/royal-borough-of-kensington-and-chelsea/north-kensington/al-huda-mosque",
  },

  // Everything from here to `jumuah` is the BACKUP, used only for days that
  // neither the mosque's timetable nor MyLocalMasjid covers (2034 onwards).

  // How backup prayer START times are calculated.
  //   method:       "MoonsightingCommittee" (what MyLocalMasjid uses), "MWL" (Muslim World League),
  //                 "Morocco", "ISNA", "Egypt", "Makkah", "Karachi"
  //   asr:          "standard" (Maliki, Shafi'i, Hanbali) or "hanafi"
  //   highLatitude: "angleBased", "oneSeventh" or "nightMiddle" — how Fajr and Isha are set
  //                 in summer when the sky over London never gets fully dark (not used by
  //                 MoonsightingCommittee, which has its own seasonal rule)
  //   adjustMinutes: fine-tune any time to match the mosque's own timetable. Fajr and
  //                 Isha are 2 minutes later than the plain method, which brings every
  //                 prayer within 2 minutes of the mosque's published September 2026 times.
  calculation: {
    method: "MoonsightingCommittee",
    asr: "standard",
    highLatitude: "angleBased",
    adjustMinutes: { fajr: 2, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 2 },
  },

  // "24h" shows 13:05, "12h" shows 1:05 pm
  timeFormat: "24h",

  // Backup adhan (call to prayer) times.
  //   "+0"    — at the moment the prayer begins (the usual practice)
  //   "+5"    — 5 minutes after the prayer begins
  //   "13:15" — a fixed time
  adhan: {
    fajr: "+0",
    dhuhr: "+0",
    asr: "+0",
    maghrib: "+0",
    isha: "+0",
  },

  // Backup iqamah (start of the congregational prayer) times.
  //   "+10"   — 10 minutes after the adhan
  //   "13:30" — a fixed time (remember to update fixed times as the seasons change)
  //   null    — not known; the website shows "—"
  // These follow the usual gap between adhan and iqamah in the mosque's own
  // timetable (in summer it sets Fajr later and Isha right at the adhan).
  iqamah: {
    fajr: "+15",
    dhuhr: "+15",
    asr: "+10",
    maghrib: "+7",
    isha: "+10",
  },

  // Friday prayer, e.g. khutbah: "13:15", prayer: "13:45". Used when MyLocalMasjid
  // has no Jumu'ah times. On Fridays the prayer time is shown as the Jumu'ah iqamah.
  // `languages` and `liveTranslation` show in the Jumu'ah card (null hides them).
  jumuah: {
    khutbah: null,
    prayer: null,
    languages: "Arabic and English",
    liveTranslation: "Available",
  },

  // Shift the Islamic (Hijri) date shown on the site by whole days, to match
  // the local moon-sighting the mosque follows. Usually 0, sometimes -1 or +1.
  hijriOffsetDays: 0,

  // Notices appear at the top of the home page. They hide themselves after "until".
  // Example:
  // { title: "Eid al-Fitr prayer", body: "Eid prayer will be held at 8:00 and 9:00.", until: "2027-03-12" }
  notices: [],

  // The welcome message, shown once to each new visitor on whichever page they
  // open first. Their browser remembers it, so it doesn't appear again. To show
  // a new message to everyone once more, raise `version` (1 → 2).
  // Set enabled to false to turn it off.
  welcome: {
    enabled: true,
    version: 1,
    arabic: "السلام عليكم",
    title: "A Warm Welcome to Golborne Mosque",
    greeting: "Assalamu Alaikum Wa Rahmatullahi Wa Barakatuh,",
    paragraphs: [
      "On behalf of Golborne Mosque Trust, it is our pleasure to welcome you to our mosque and our online community.",
      "Golborne Mosque is more than a place of worship. It is a place where faith brings people together, knowledge inspires personal growth, brotherhood is strengthened, and community spirit flourishes.",
      "Our vision is to provide a welcoming, inclusive and spiritually enriching environment where everyone can feel a sense of belonging, find guidance and strengthen their relationship with Allah.",
      "As we look towards the future, we remain dedicated to developing our mosque, improving our services and creating opportunities for generations to come.",
      "Whether you are a regular worshipper, a local resident, a visitor or simply interested in learning more about Islam, you are warmly welcome.",
      "May Allah bless our community, accept our efforts and guide us towards a future built on faith, sincerity and unity.",
    ],
    closing: "Welcome to Golborne Mosque.",
    motto: "Together in Faith. Stronger as a Community.",
    button: "Continue to the website",
  },

  // Donations. Anything left as null shows as "To be added" on the website,
  // so fill these in before the site goes live.
  donations: {
    // Card donations through SumUp's payment widget: the card form appears on the
    // page itself. They switch on by themselves once the mosque's SumUp API key
    // is added on Cloudflare (see README → Donations by card). Set enabled to
    // false to hide card donations without removing the key.
    sumup: {
      enabled: true,
      // The amount buttons, in pounds. Donors can also type any amount from £1 to £5,000.
      amounts: [10, 25, 50, 100],
      // The amount picked when the page opens.
      preselected: 25,
    },

    // Bank transfer, for donors who prefer to give straight from their banking app.
    bank: {
      accountName: "Golborne Mosque Trust", // exactly as the bank holds it, so Confirmation of Payee matches
      bankName: "Barclays Bank",
      sortCode: "20-96-55", // 6 digits, e.g. "00-00-00"
      accountNumber: "20072257", // 8 digits
      // Shown as guidance next to "Reference", not as a copyable value.
      reference: "Please state whether it is for the Mosque Fund, Zakat or Sadaqah.",
    },
  },

  contact: {
    email: "info@golbornemosque.org",
    address: ["76 Golborne Road", "London", "W10 5PS"],
  },

  charityNumber: "294588",
};
