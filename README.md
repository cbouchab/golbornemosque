# Golborne Mosque website

A website for Golborne Mosque (Alhuda Mosque, مسجد الهدى), 76 Golborne Road, London W10 5PS. It is styled after the mosque's frontage: dark grey with gold outlines and lettering.

It is a plain static site: HTML, CSS and a little JavaScript, with no build step, database or monthly fees.

Prayer times come from the mosque's own **MyLocalMasjid** listing: the same adhan and iqamah times its screens show. A scheduled job copies them into the site (see [Prayer times from MyLocalMasjid](#prayer-times-from-mylocalmasjid)). For any day the mosque hasn't published, the site calculates the times itself.

## What's on it

**Prayer times strip** (every page): sits under the menu and scrolls away with the page. It shows today's adhan and iqamah times for Fajr to Isha, plus sunrise, and highlights the next prayer. After Isha it moves on to tomorrow. When the times come from MyLocalMasjid it says "Powered by MyLocalMasjid"; otherwise it says "Calculated times".

**Home page** (`index.html`):

- Next prayer, with a live countdown.
- Today's adhan and iqamah times. Visitors can step back and forth through the days.
- Jumu'ah details, with the date of the next Friday.
- A Ramadan section with a countdown to the expected start.
- Services, and how to find the mosque, with a Google map.
- Donations: online card payments through SumUp, and bank transfer details (sort code, account number, IBAN, BIC) with tap-to-copy buttons.

**About page** (`about.html`):

- "Our story": a timeline of the mosque from the building of Golborne Road and the first Moroccan families of the 1960s to today, with its sources listed underneath.
- The trustees, each with a headshot (or their initials until a photo is added), name and role.
- An invitation to share memories and photos of the mosque's early days, and the charity's details.

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
| `trustees` | Name, role and photo of each trustee on the About page. To add a headshot, save it in `assets/trustees/` and set `photo` (see `assets/trustees/README.txt`). |
| `donations.sumup` | SumUp payment links: one main link, plus optional quick-amount buttons (£10, £25, £50). See below. |
| `donations.bank` | Account name, bank, sort code, account number, IBAN, BIC/SWIFT and reference. |
| `calculation`, `adhan`, `iqamah` | The backup, used for any day without synced MyLocalMasjid times (see below). It is set up to follow the mosque's own pattern. `calculation` uses the Moonsighting Committee method (MyLocalMasjid's), with Fajr and Isha 2 minutes later, which matched the mosque's published September 2026 start times to within 2 minutes. `iqamah` uses the mosque's usual gap after the adhan: 15 minutes for Fajr, Dhuhr and Asr, 5 for Maghrib, 10 for Isha. A gap is written `"+15"`; a fixed time `"13:30"` also works. |
| `hijriOffsetDays` | Moves the Islamic date by a day to match local moon sighting. |
| `timeFormat` | `"24h"` (13:05) or `"12h"` (1:05 pm). |

Any donation detail left as `null` shows on the site as a dashed "To be added" placeholder, so it's obvious what is still missing. If an IBAN, sort code, account number or BIC looks mistyped, the browser console shows a warning.

### Setting up SumUp

SumUp's Payment Links work on a plain website with no server or API keys.

1. In the SumUp app or dashboard, open **Payment Links** and choose **Create payment link**.
2. Turn on **reusable link**, so every donor can use the same link. A one-off link stops working after one payment.
3. Choose **open amount**, so donors can enter whatever they wish.
4. Copy the link and paste it into `donations.sumup.link` in `js/config.js`.
5. Optional: create reusable **fixed-amount** links (e.g. £10, £25, £50) and paste each one into `donations.sumup.amounts`. Any amount without a link is simply not shown.

Donors are taken to SumUp's own secure payment page in a new tab, so card details never touch this website. SumUp charges a fee on each payment; check the current rate in the mosque's SumUp account.

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

With Node.js 18 or newer installed, run this in the folder, then upload `data/timetable.js` again:

```bash
MLM_API_KEY=mlm_live_your_key node scripts/sync-prayer-times.mjs
```

The script prints how many days it saved, or a plain explanation if something went wrong (wrong key, rate limit, no times published).

## Hosting (GitHub Pages)

The site is published free with GitHub Pages at **<https://cbouchab.github.io/golbornemosque/>**, from the repository <https://github.com/cbouchab/golbornemosque>.

Every change pushed to the `main` branch is published automatically by `.github/workflows/deploy.yml`, usually within a minute. Only the website's own files are published, not this README, the scripts or the workflows. Progress shows on the repository's **Actions** tab.

To edit without any tools, open a file on github.com (for example `js/config.js`), click the pencil icon, make the change and commit it. The site updates by itself.

**Custom domain.** A domain such as `golbornemosque.org.uk` costs roughly £5–10 a year from any UK registrar. To use one, add it under **Settings → Pages → Custom domain**, then follow GitHub's instructions for the DNS records.

To preview on your own computer, run this inside the folder and open <http://localhost:8642>:

```bash
python3 -m http.server 8642
```

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
  - Muhammed Khaja's outreach role in the early 1990s, also from a single source;
  - the Grenfell entry and its closing line, "We remember all who were lost… in our prayers", which speaks in the mosque's voice.

  Founders' names, early photographs or memories would make the story much richer. The page invites people to share them.
- [ ] **SumUp payment link**: reusable and open-amount, plus any quick-amount links.
- [ ] **Bank details**: account name, bank, sort code, account number, IBAN and BIC. Check every digit against a bank statement; a wrong number sends donations to the wrong place.
- [ ] **Phone and email.** `020 8968 1592` and `golbornemosquetrust@gmail.com` are taken from the charity register.
- [ ] **Services.** The site lists only those named on the charity register: daily prayers, Jumu'ah, Ramadan prayers and free iftar, Eid, funeral prayers, and spiritual counselling. Classes, sisters' facilities, wudu or access arrangements can be added if the mosque offers them.
- [ ] **Photos.** There are none yet. A photo of the frontage would suit the hero section well.
- [ ] **Trustees.** The About page lists the six trustees named on the Charity Commission register (Ahmed Youssfi, Chair; Abdelkader Akhrif; Faissal Bouchab; Fatima Youssfi; Mohamed Said Daoud; Mustapha Bouyardan). Check each is happy to be listed, and add headshots only with their permission. Update the list in `js/config.js` whenever the board changes.

## Files

```
index.html        Home page
about.html        Our story and the trustees
timetable.html    Monthly, printable timetable
css/styles.css    All styling (colours are set at the top)
js/config.js      Settings the mosque edits
data/timetable.js The mosque's published times (generated, don't edit)
js/praytimes.js   Prayer times (published or calculated) and Hijri dates
js/home.js        Home page behaviour
js/timetable.js   Timetable page behaviour
js/prayer-bar.js  Prayer times strip under the menu
js/donate.js      SumUp buttons and bank transfer details
js/about.js       Trustee cards on the About page
js/site.js        Mobile menu, footer year
assets/favicon.svg
assets/trustees/  Trustee headshots
scripts/sync-prayer-times.mjs        Copies times from MyLocalMasjid
.github/workflows/sync-prayer-times.yml  Runs the sync every two hours
.github/workflows/deploy.yml             Publishes the site to GitHub Pages
```

Fonts come from Google Fonts (Cinzel, Amiri and Source Sans 3), and the map from Google Maps. Google's map embed may set its own cookies; if the site later adds a cookie notice, the map should be included in it.
