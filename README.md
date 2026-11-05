# Golborne Mosque website

A website for Golborne Mosque (مسجد غولبورن, also known as Alhuda Mosque), 76 Golborne Road, London W10 5PS. It is styled after the mosque's logo and frontage: grey and gold, with a faint Moroccan zellige pattern.

It is a plain static site: HTML, CSS and a little JavaScript, with no build tools, database or monthly fees.

Prayer times come from the mosque's own **MyLocalMasjid** listing: the same adhan and iqamah times its screens show. A scheduled job copies them into the site (see [Prayer times from MyLocalMasjid](#prayer-times-from-mylocalmasjid)). For any day the mosque hasn't published, the site calculates the times itself.

## What's on it

**Welcome message** (every page, once): the first time someone opens the site, a short welcome from the trust appears over the page. Closing it (the button, ×, Esc, or a tap outside) takes them to the page; their browser remembers, so it never shows again.

**Prayer times strip** (every page): sits under the menu and scrolls away with the page. It shows today's adhan and iqamah times for Fajr to Isha, plus sunrise, and highlights the next prayer. After Isha it moves on to tomorrow. When the times come from MyLocalMasjid it says "Powered by MyLocalMasjid"; otherwise it says "Calculated times".

**Home page** (`index.html`):

- Next prayer, with a live countdown.
- Today's adhan and iqamah times. Visitors can step back and forth through the days.
- Jumu'ah details, with the date of the next Friday.
- A Ramadan section with a countdown to the expected start.
- Services, and how to find the mosque, with a Google map.
- Donations: card payments on the page itself through SumUp's widget, with a choice of Mosque Fund, Zakat or Sadaqah, and bank transfer details (sort code, account number, IBAN, BIC) with tap-to-copy buttons.

**About page** (`about.html`):

- "Our story": a timeline of the mosque from the first Moroccan families of the 1960s to today, with its sources listed underneath. The line draws itself down the page as you scroll, and each milestone appears as it reaches it (everything simply shows with reduced motion or without JavaScript).
- The trust's mission, set large: Strengthen Faith. Nurture Knowledge. Unite Our Community. Serve Humanity.
- About Golborne Mosque Trust, in the trust's own words, with its charity number.

**News** (`news.html`, and each post at `/news/<post>`):

- Posts with a title, date, text and an optional photo, newest first. The three newest also appear on the home page under "Latest news" (the section stays hidden until there is a post).
- Each post has its own page, built on Cloudflare so link previews on WhatsApp, Facebook and the like show its title, summary and photo.
- Written on the private posting page, `/admin` (see **News** below).

**Monthly timetable** (`timetable.html`):

- Adhan and iqamah times for every day of the month, with Hijri dates. In a month the mosque has only partly published, calculated days are marked with *.
- Fridays are highlighted.
- A print button prints one clean A4 page for the notice board.

## Updating the site

Daily adhan and iqamah times are updated on MyLocalMasjid, not here. Everything else that changes is in **`js/config.js`**. Open it in any text editor, change the values, save, and upload the file again.

| Setting | What it does |
|---|---|
| `myLocalMasjid` | The mosque's MyLocalMasjid listing (its id and page address). |
| `jumuah` | Khutbah and prayer times for Friday, e.g. `khutbah: "13:15", prayer: "13:45"`. Used only if MyLocalMasjid has no Jumu'ah times. On Fridays the prayer time is shown as the Jumu'ah iqamah. |
| `notices` | Announcements shown at the top of the home page. Each one hides itself after its `until` date. |
| `welcome` | The welcome message shown once to each new visitor, on whichever page they open first. Their browser remembers it so it isn't shown again; raise `version` to show a new message to everyone once more, or set `enabled: false` to turn it off. |
| `donations.sumup` | Card donations through SumUp's widget: the amount buttons and the one picked at first. See below. |
| `donations.bank` | Account name, bank, sort code, account number, IBAN, BIC/SWIFT and reference. |
| `calculation`, `adhan`, `iqamah` | The backup, used for any day without synced MyLocalMasjid times (see below). It is set up to follow the mosque's own pattern. `calculation` uses the Moonsighting Committee method (MyLocalMasjid's), with Fajr and Isha 2 minutes later, which matched the mosque's published September 2026 start times to within 2 minutes. `iqamah` uses the mosque's usual gap after the adhan: 15 minutes for Fajr, Dhuhr and Asr, 5 for Maghrib, 10 for Isha. A gap is written `"+15"`; a fixed time `"13:30"` also works. |
| `hijriOffsetDays` | Moves the Islamic date by a day to match local moon sighting. |
| `timeFormat` | `"24h"` (13:05) or `"12h"` (1:05 pm). |

Any donation detail left as `null` shows on the site as a dashed "To be added" placeholder, so it's obvious what is still missing. If an IBAN, sort code, account number or BIC looks mistyped, the browser console shows a warning.

### Donations by card (SumUp)

Donors choose the type of donation (Mosque Fund, Zakat or Sadaqah) and an amount (£10, £25, £50, £100, or any amount from £1 to £5,000), and SumUp's card form opens right on the page. Card details go straight from the donor's browser to SumUp; the mosque's website never sees them. When SumUp reports success, the site checks with SumUp that the payment is really marked paid before it thanks the donor.

**Telling Zakat apart.** Each payment reaches SumUp labelled with its type, so Zakat can be kept separate from other giving. In SumUp's sales list, the description reads "Zakat - Golborne Mosque", "Sadaqah - Golborne Mosque" or "Mosque Fund - Golborne Mosque", and the reference starts with `zakat-`, `sadaqah-` or `mosque-`. To add or rename a type, change it in two places: the options of the "Type of donation" list in `index.html` (`id="donate-fund"`), and `FUNDS` in `functions/api/donate.js`, which only accepts the types listed there. The wording on the page ("Giving £25 as Zakat", the thank-you message) is in `FUNDS` in `js/donate.js`.

Behind it is a small Cloudflare function, `functions/api/donate.js`. It holds the mosque's **SumUp API key**, which must never be put in the website's own files, and uses it to set up each payment. The mosque's SumUp merchant code is looked up automatically with the key. Card donations switch on by themselves once the key is added; until then the panel shows "Card donations to be switched on".

**1. Create an API key.** Log in to <https://me.sumup.com>, open **Settings → For Developers → Toolkit → API Keys**, choose **Create** and name it (e.g. "Website donations"). Copy it straight away; SumUp shows it only once.

**2. Add it to Cloudflare** as a secret, from this folder:

```bash
npx wrangler@4.147.0 pages secret put SUMUP_API_KEY --project-name golbornemosque
```

Paste the key when asked; it isn't shown on screen. The next deploy picks it up. (It can also be added in the Cloudflare dashboard: **Workers & Pages → golbornemosque → Settings → Variables and secrets**, type *Secret*.)

**Testing without real money.** SumUp offers a sandbox account: in **Settings → For Developers → Toolkit → Sandboxes**, create one, then create an API key for it. Put that key in a file called `.dev.vars` in this folder (it is never published or committed):

```
SUMUP_API_KEY=the-sandbox-key
```

then run `npx wrangler@4.147.0 pages dev . --port 8642` and donate with SumUp's test card `4200 0000 0000 0091` (any future expiry, any CVV). Amounts of £11.00 always fail, to try the error message.

To hide card donations without removing the key, set `donations.sumup.enabled` to `false` in `js/config.js`. SumUp charges 2.5% on each online payment; there is no monthly fee.

## News

Posts are written at **<https://golbornemosque.org/admin>**, a private page that isn't linked from the site. Sign in with the News password, then:

- **New post**: a title, the date (today unless changed), an optional photo with a short description for people who can't see it, and the text. The buttons above the text add a heading, bold, italic, a link or a list; **Preview** shows how it will look.
- **Show on the website** publishes it straight away. Untick it to keep a draft, which only signed-in writers can see.
- **Edit** changes a post; its address stays the same so links already shared keep working. **Delete post** removes it and its photo for good.

Photos are shrunk in the browser to at most 1600 pixels across before uploading, so phone photos upload quickly.

**Setting the password.** Everyone who posts shares one password, kept as a Cloudflare secret called `NEWS_PASSWORD`. Choose a long one (four or five random words works well) and set it from this folder:

```bash
CLOUDFLARE_ACCOUNT_ID=722237b243245541dfb7d4407d4c234c npx wrangler@4.147.0 pages secret put NEWS_PASSWORD --project-name golbornemosque
```

or in the Cloudflare dashboard: **Workers & Pages → golbornemosque → Settings → Variables and secrets**, type *Secret*. It applies from the next deploy. Changing it signs everyone out. Signing in lasts 14 days on each device; after 10 wrong passwords in 15 minutes, that connection has to wait.

**Where posts are kept.** In a Cloudflare D1 database, `golbornemosque-news`, in the same account (free). Its tables are in `migrations/`. If the tables ever need creating again:

```bash
CLOUDFLARE_ACCOUNT_ID=722237b243245541dfb7d4407d4c234c npx wrangler@4.147.0 d1 migrations apply golbornemosque-news --remote
```

**Trying it on your own computer.** Put a test password in `.dev.vars` (never published or committed), create the local tables, and preview:

```
NEWS_PASSWORD=any-test-password
```

```bash
npx wrangler@4.147.0 d1 migrations apply golbornemosque-news --local
```

Posts made locally stay on your computer.

## Prayer times from MyLocalMasjid

The mosque's screens use the times it publishes on MyLocalMasjid, so the website uses them too:
[Al Huda Mosque on MyLocalMasjid](https://mylocalmasjid.com/uk/london/royal-borough-of-kensington-and-chelsea/north-kensington/al-huda-mosque).

Until an API key is set up, the site uses the backup: calculated times that follow the mosque's own pattern, as described above. The times aren't copied from MyLocalMasjid's web pages, because its terms don't allow scraping or copying content without permission. The API is the permitted route.

**How it works.** `scripts/sync-prayer-times.mjs` asks the MyLocalMasjid API for this month's and next month's adhan and iqamah times, plus any Jumu'ah times. It saves them to `data/timetable.js`, which the website reads. The API key needed for this stays with the script and is never put on the website. If the API can't be reached, the last saved times stay in place. Beyond the saved dates, the site falls back to calculated times.

### 1. Get an API key

The MyLocalMasjid Developer API needs a key that starts with `mlm_live_`. Keys are issued from the MyLocalMasjid admin app (<https://admin.mylocalmasjid.com>); the developer page also has a waitlist (<https://mylocalmasjid.com/developers>, or email developer@mylocalmasjid.com). The free **Build** tier (on request, 10,000 requests a month) is the right one for a website; the self-serve **Explore** tier (100 a day) is enough for this job too. Each sync uses 2 requests.

MyLocalMasjid's terms ask for a visible "Powered by MyLocalMasjid" wherever its times are shown. The site already does this.

### 2. Keep the times up to date automatically (GitHub)

1. In the repository (<https://github.com/cbouchab/golbornemosque>), go to **Settings → Secrets and variables → Actions → New repository secret**. Name it `MLM_API_KEY` and paste the key.
2. Go to **Actions → Sync prayer times → Run workflow** to run it once now.

The workflow (`.github/workflows/sync-prayer-times.yml`) then runs every two hours. When the times have changed, it commits `data/timetable.js` and republishes the website. Until the secret is added, it does nothing. GitHub pauses scheduled workflows in repositories with no activity for 60 days. If that happens, re-enable it on the **Actions** tab.

### Or update by hand

With Node.js 18 or newer installed, run this in the folder, then publish again (see Hosting below):

```bash
MLM_API_KEY=mlm_live_your_key node scripts/sync-prayer-times.mjs
```

The script prints how many days it saved, or a plain explanation if something went wrong (wrong key, rate limit, no times published).

## Hosting (Cloudflare Pages)

The site is published free on Cloudflare Pages at **<https://golbornemosque.org>**, from the personal Cloudflare account of cbouchab@gmail.com. Its Cloudflare address, <https://golbornemosque.pages.dev>, still works too. The code lives in the repository <https://github.com/cbouchab/golbornemosque>.

Cloudflare serves the files as they are; there is no server code. `scripts/build.sh` copies the website's own files into `_site/`, and only that folder is published, so this README, the scripts, the workflows and the git files never go online. `wrangler.jsonc` holds the settings. Pages have clean addresses (`/about`, `/timetable`), old links ending in `.html` redirect to them, and any address that doesn't exist shows `404.html`.

Every publish names the account ID (`722237b243245541dfb7d4407d4c234c`), so it fails rather than landing on any other Cloudflare account.

### Publishing automatically from GitHub

Every change pushed to the `main` branch is published by `.github/workflows/deploy.yml`, usually within a minute. Progress shows on the repository's **Actions** tab. It needs a Cloudflare API token, added once:

1. In the Cloudflare dashboard, go to **My Profile → API Tokens → Create Token → Create Custom Token**. Give it the permission **Account · Cloudflare Pages · Edit**, set **Account Resources** to cbouchab@gmail.com's account, then create the token and copy it.
2. In the repository, go to **Settings → Secrets and variables → Actions → New repository secret**. Name it `CLOUDFLARE_API_TOKEN` and paste the token.

Until the secret is added, the workflow does nothing.

To edit without any tools, open a file on github.com (for example `js/config.js`), click the pencil icon, make the change and commit it. The site updates by itself.

### Publishing from your own computer

With Node.js installed, run these inside the folder. Log in with the personal Cloudflare account:

```bash
npx wrangler@4.147.0 login
```

```bash
sh scripts/build.sh && CLOUDFLARE_ACCOUNT_ID=722237b243245541dfb7d4407d4c234c npx wrangler@4.147.0 pages deploy --branch main
```

To preview on your own computer first, run this and open <http://localhost:8642>. It behaves like the live site, clean addresses and the not-found page included:

```bash
npx wrangler@4.147.0 pages dev . --port 8642
```

**Domains.** golbornemosque.org is the main address, and golbornemosque.com redirects to it. Both are registered at GoDaddy, where they're renewed each year, but their nameservers point to Cloudflare. So every DNS change, email records included, is made in the Cloudflare dashboard; GoDaddy's own DNS page is no longer used.

- `golbornemosque.org` and `www.golbornemosque.org` are custom domains of the Pages project (**Workers & Pages → golbornemosque → Custom domains**).
- Redirect Rules send `www.golbornemosque.org` and all of `golbornemosque.com` to `https://golbornemosque.org`, keeping the rest of the address. The .com domain has two placeholder A records (`@` and `www`, `192.0.2.1`, proxied) so that Cloudflare receives its visits.
- The `og:image` and `og:url` lines in the pages use the full `https://golbornemosque.org` address, because link previews need it.

## Please confirm with the mosque before launch

The content is limited to what could be verified from the mosque's public Charity Commission entry (charity no. 294588). Please check the following with the trustees:

- [ ] **MyLocalMasjid API key**, so the site shows the mosque's exact published times (see above). Until then it shows calculated times that follow the mosque's pattern, within about 2 minutes.
- [ ] **The iqamah gaps.** In September 2026 the published iqamah was always 15 minutes after the adhan for Fajr, Dhuhr and Asr, 5 for Maghrib and 10 for Isha. Check this is the mosque's own rule rather than a listing default, and whether it changes in winter (e.g. a fixed Isha time).
- [ ] **The right MyLocalMasjid listing.** The site uses "Al Huda Mosque", 74 Golborne Rd, which has published times. A second listing, "Golborne Mosque Trust", is empty. Check that Al Huda is the listing the screens use. Claiming it lets the mosque manage it directly, and removing the duplicate avoids confusion.
- [ ] **Jumu'ah times.** MyLocalMasjid has none for this mosque yet. Adding them there (preferred) or in `jumuah` in `js/config.js` fills in the Jumu'ah card and the Friday iqamah.
- [ ] **Address.** The site uses 76 Golborne Road, as on the charity register. Council planning records confirm the mosque is at 76; No. 74 has been offices since 1970. MyLocalMasjid's "74" looks like a typo worth correcting there.
- [ ] **"Our story" (About page).** It is built only from the sources listed under it on the page. Please ask the trustees to check:
  - the 1981 founding by three Moroccans, which comes from a single community-history record;
  - where the congregation prayed before 76 Golborne Road (not found anywhere);

  Founders' names, early photographs or memories would make the story much richer.
- [ ] **SumUp payment link**: reusable and open-amount, plus any quick-amount links.
- [ ] **Bank details**: account name, bank, sort code, account number, IBAN and BIC. Check every digit against a bank statement; a wrong number sends donations to the wrong place.
- [ ] **Email.** The site shows `info@golbornemosque.org`, an iCloud Mail address on the mosque's domain (golbornemosque.org, registered at GoDaddy). Send it a test message before publishing. The charity register still lists `golbornemosquetrust@gmail.com`, so the trustees may want to update it there too. The phone number has been taken off the site.
- [ ] **Services.** The site lists only those named on the charity register: daily prayers, Jumu'ah, Ramadan prayers and free iftar, Eid, funeral prayers, and spiritual counselling. Classes, sisters' facilities, wudu or access arrangements can be added if the mosque offers them.
- [ ] **Photos.** There are none yet. A photo of the frontage would suit the hero section well.

## Files

```
index.html        Home page
about.html        Our story, the mission and the trust
timetable.html    Monthly, printable timetable
news.html         All news
news-post.html    The page each post is built on (by functions/news/[slug].js)
admin.html        The private posting page for News
404.html          Shown for addresses that don't exist
css/styles.css    All styling (colours are set at the top)
js/config.js      Settings the mosque edits
data/timetable.js The mosque's published times (generated, don't edit)
js/praytimes.js   Prayer times (published or calculated) and Hijri dates
js/home.js        Home page behaviour
js/timetable.js   Timetable page behaviour
js/prayer-bar.js  Prayer times strip under the menu
js/donate.js      SumUp card widget and bank transfer details
js/about.js       The scrolling timeline on the About page
js/news.js        News cards on the News and home pages
js/news-format.js The simple formatting posts are written in (used on Cloudflare and in the preview)
js/admin.js       The posting page
js/site.js        Mobile menu, footer year, welcome message
assets/logo.svg   The full logo at the top of the home page (a lighter copy of brand/logo.svg)
assets/symbol.svg The mosque symbol beside the name in the header and footer: brand/symbol.svg in gold only, its white left out so the background shows through
assets/icons/     Browser-tab and home-screen icons; favicon.ico and site.webmanifest sit at the top level
assets/og.jpg     The picture shown when a link to the site is shared
assets/zellige.webp  The faint background pattern (one repeat, in the logo's gold)
brand/            The mosque's master logo files (logo, icon, symbol, favicon, and the full favicon set); not published
scripts/build.sh                     Collects the site's files into _site/ for publishing
functions/api/donate.js              Sets up SumUp card payments (runs on Cloudflare, holds the API key)
functions/api/news/                  Published posts and their photos
functions/api/admin/                 Signing in, and writing, editing and deleting posts (password-protected)
functions/news/[slug].js             Each post's page
lib/news-server.js                   Shared News code for the functions above (not published as a file)
migrations/                          The News database's tables
scripts/sync-prayer-times.mjs        Copies times from MyLocalMasjid
.github/workflows/sync-prayer-times.yml  Runs the sync every two hours
.github/workflows/deploy.yml             Publishes the site to Cloudflare
wrangler.jsonc    Cloudflare Pages settings
```

Text is set in each device's own system font (San Francisco on Apple devices). Google Fonts supplies two: Cinzel for the name beside the logo and the timetable's title, and Amiri for Arabic. The map comes from Google Maps. Google's map embed may set its own cookies; if the site later adds a cookie notice, the map should be included in it.
