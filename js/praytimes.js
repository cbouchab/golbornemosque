/*
 * Golborne Mosque — prayer time calculation and date helpers.
 *
 * Prayer start times are worked out from the position of the sun, using the
 * standard formulas behind most published Muslim timetables. Nothing is fetched
 * from the internet, so the times keep working offline and need no upkeep.
 */
(function (global) {
  "use strict";

  const METHODS = {
    // The method MyLocalMasjid uses for its start times. Fajr and Isha follow
    // Khalid Shaukat's seasonal limits, and Dhuhr and Maghrib are set a few minutes late.
    MoonsightingCommittee: { name: "Moonsighting Committee", fajr: 18, isha: 18, seasonal: true, adjust: { dhuhr: 5, maghrib: 3 } },
    MWL: { name: "Muslim World League", fajr: 18, isha: 17 },
    Morocco: { name: "Ministry of Habous and Islamic Affairs, Morocco", fajr: 19, isha: 17 },
    ISNA: { name: "Islamic Society of North America", fajr: 15, isha: 15 },
    Egypt: { name: "Egyptian General Authority of Survey", fajr: 19.5, isha: 17.5 },
    Makkah: { name: "Umm al-Qura, Makkah", fajr: 18.5, ishaMinutes: 90 },
    Karachi: { name: "University of Islamic Sciences, Karachi", fajr: 18, isha: 18 },
  };

  const PRAYERS = [
    { key: "fajr", en: "Fajr", ar: "الفجر" },
    { key: "sunrise", en: "Sunrise", ar: "الشروق", info: true },
    { key: "dhuhr", en: "Dhuhr", ar: "الظهر", friday: { en: "Jumu‘ah", ar: "الجمعة" } },
    { key: "asr", en: "Asr", ar: "العصر" },
    { key: "maghrib", en: "Maghrib", ar: "المغرب" },
    { key: "isha", en: "Isha", ar: "العشاء" },
  ];

  /* ---------- trigonometry in degrees ---------- */
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const sin = (d) => Math.sin(rad(d));
  const cos = (d) => Math.cos(rad(d));
  const tan = (d) => Math.tan(rad(d));
  const asin = (x) => deg(Math.asin(x));
  const acos = (x) => deg(Math.acos(x));
  const atan2 = (y, x) => deg(Math.atan2(y, x));
  const acot = (x) => deg(Math.atan(1 / x));
  const fix = (a, b) => {
    const r = a - b * Math.floor(a / b);
    return r < 0 ? r + b : r;
  };
  const fixAngle = (a) => fix(a, 360);
  const fixHour = (h) => fix(h, 24);

  function julian(y, m, d) {
    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fixAngle(357.529 + 0.98560028 * D);
    const q = fixAngle(280.459 + 0.98564736 * D);
    const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
    return { declination: asin(sin(e) * sin(L)), equation: q / 15 - fixHour(RA) };
  }

  // Moonsighting Committee: minutes between sunrise and Fajr (morning) or sunset and
  // Isha (evening, general shafaq) for a latitude and date. Coefficients follow the
  // published method, as implemented in the widely used "adhan" library.
  const SEASONAL = { morning: [28.65, 19.44, 32.74, 48.1], evening: [25.6, 2.05, -9.21, 6.14] };

  function seasonalMinutes(lat, y, m, d, coeffs) {
    const L = Math.abs(lat);
    const [a, b, c, dd] = coeffs.map((k) => 75 + (k / 55) * L);
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const daysInYear = leap ? 366 : 365;
    const dayOfYear = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
    let n;
    if (lat >= 0) {
      n = dayOfYear + 10;
      if (n >= daysInYear) n -= daysInYear;
    } else {
      n = dayOfYear - (leap ? 173 : 172);
      if (n < 0) n += daysInYear;
    }
    if (n < 91) return a + ((b - a) / 91) * n;
    if (n < 137) return b + ((c - b) / 46) * (n - 91);
    if (n < 183) return c + ((dd - c) / 46) * (n - 137);
    if (n < 229) return dd + ((c - dd) / 46) * (n - 183);
    if (n < 275) return c + ((b - c) / 46) * (n - 229);
    return b + ((a - b) / 91) * (n - 275);
  }

  /*
   * Prayer start times for one calendar day, as decimal hours of local clock time.
   * opts: { lat, lng, offset (hours from UTC), method, asr, highLatitude, adjustMinutes }
   */
  function computeTimes(y, m, d, opts) {
    const lat = opts.lat;
    const lng = opts.lng;
    const method = METHODS[opts.method] || METHODS.MWL;
    const asrFactor = opts.asr === "hanafi" ? 2 : 1;
    const jDate = julian(y, m, d) - lng / (15 * 24);
    const riseSetAngle = 0.833;

    const midDay = (t) => fixHour(12 - sunPosition(jDate + t).equation);
    const sunAngleTime = (angle, t, beforeNoon) => {
      const decl = sunPosition(jDate + t).declination;
      const noon = midDay(t);
      const v = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
      return noon + (beforeNoon ? -v : v);
    };
    const asrTime = (factor, t) => {
      const decl = sunPosition(jDate + t).declination;
      return sunAngleTime(-acot(factor + tan(Math.abs(lat - decl))), t);
    };

    // Start from rough guesses and refine; the sun's position depends on the time of day.
    let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
    for (let i = 0; i < 2; i++) {
      const p = {};
      for (const k in t) p[k] = (isNaN(t[k]) ? 12 : t[k]) / 24;
      t = {
        fajr: sunAngleTime(method.fajr, p.fajr, true),
        sunrise: sunAngleTime(riseSetAngle, p.sunrise, true),
        dhuhr: midDay(p.dhuhr),
        asr: asrTime(asrFactor, p.asr),
        sunset: sunAngleTime(riseSetAngle, p.sunset),
        isha: method.isha ? sunAngleTime(method.isha, p.isha) : 18,
      };
    }

    const shift = opts.offset - lng / 15;
    for (const k in t) t[k] += shift;

    if (method.seasonal) {
      // Fajr is no earlier, and Isha no later, than the seasonal limits.
      const safeFajr = t.sunrise - seasonalMinutes(lat, y, m, d, SEASONAL.morning) / 60;
      if (isNaN(t.fajr) || safeFajr > t.fajr) t.fajr = safeFajr;
      const safeIsha = t.sunset + seasonalMinutes(lat, y, m, d, SEASONAL.evening) / 60;
      if (isNaN(t.isha) || safeIsha < t.isha) t.isha = safeIsha;
    } else {
      // In the summer the sun never sinks far enough below the horizon over London,
      // so Fajr and Isha are taken as a portion of the night instead.
      const night = fixHour(t.sunrise - t.sunset);
      const portion = (angle) => {
        if (opts.highLatitude === "nightMiddle") return night / 2;
        if (opts.highLatitude === "oneSeventh") return night / 7;
        return (angle / 60) * night;
      };
      const fajrPortion = portion(method.fajr);
      if (isNaN(t.fajr) || fixHour(t.sunrise - t.fajr) > fajrPortion) t.fajr = t.sunrise - fajrPortion;
      if (method.isha) {
        const ishaPortion = portion(method.isha);
        if (isNaN(t.isha) || fixHour(t.isha - t.sunset) > ishaPortion) t.isha = t.sunset + ishaPortion;
      } else {
        t.isha = t.sunset + method.ishaMinutes / 60;
      }
    }

    const adj = opts.adjustMinutes || {};
    const methodAdj = method.adjust || {};
    const out = {
      fajr: t.fajr,
      sunrise: t.sunrise,
      dhuhr: t.dhuhr,
      asr: t.asr,
      maghrib: t.sunset,
      isha: t.isha,
    };
    for (const k in out) out[k] += ((adj[k] || 0) + (methodAdj[k] || 0)) / 60;
    return out;
  }

  /* ---------- dates in the mosque's time zone ---------- */

  function zonedParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }).formatToParts(date);
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour"), mm: get("minute"), ss: get("second") };
  }

  // Hours ahead of UTC on a given day (0 in winter, 1 during British Summer Time).
  function utcOffset(day, timeZone) {
    const noonUtc = Date.UTC(day.y, day.m - 1, day.d, 12);
    const p = zonedParts(new Date(noonUtc), timeZone);
    return (Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - noonUtc) / 3600000;
  }

  function todayIn(timeZone) {
    const p = zonedParts(new Date(), timeZone);
    return { y: p.y, m: p.m, d: p.d };
  }

  function addDays(day, n) {
    const dt = new Date(Date.UTC(day.y, day.m - 1, day.d + n));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  const sameDay = (a, b) => a.y === b.y && a.m === b.m && a.d === b.d;
  const dayKey = (day) => `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;
  const weekday = (day) => new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
  const asDate = (day) => new Date(Date.UTC(day.y, day.m - 1, day.d, 12));

  function formatDay(day, options) {
    return new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: "UTC" }, options)).format(asDate(day));
  }

  // The moment a local clock time happens, as a timestamp — used for countdowns.
  function instant(day, hours, timeZone) {
    return Date.UTC(day.y, day.m - 1, day.d) + (hours - utcOffset(day, timeZone)) * 3600000;
  }

  /* ---------- Hijri calendar (Umm al-Qura, via the browser) ---------- */

  let hijriFormatter = null;
  let hijriPartsFormatter = null;
  try {
    const f = new Intl.DateTimeFormat("en-GB-u-ca-islamic-umalqura", {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (f.resolvedOptions().calendar === "islamic-umalqura") {
      hijriFormatter = f;
      hijriPartsFormatter = new Intl.DateTimeFormat("en-GB-u-ca-islamic-umalqura", {
        timeZone: "UTC",
        day: "numeric",
        month: "numeric",
        year: "numeric",
      });
    }
  } catch (e) {
    /* older browsers: the Hijri date is simply left out */
  }

  function hijri(day, offsetDays) {
    if (!hijriFormatter) return "";
    return hijriFormatter.format(asDate(addDays(day, offsetDays || 0))).replace(/\s*AH$/, " AH");
  }

  function hijriParts(day, offsetDays) {
    if (!hijriPartsFormatter) return null;
    const parts = hijriPartsFormatter.formatToParts(asDate(addDays(day, offsetDays || 0)));
    const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
    return { day: get("day"), month: get("month"), year: get("year") };
  }

  /* ---------- formatting ---------- */

  function formatTime(hours, format) {
    if (hours == null || isNaN(hours)) return "—";
    const total = Math.round(hours * 60);
    const mins = ((total % 1440) + 1440) % 1440;
    const h = Math.floor(mins / 60);
    const m = String(mins % 60).padStart(2, "0");
    if (format === "12h") {
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${m} ${h < 12 ? "am" : "pm"}`;
    }
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  // "13:30" → 13.5, "+10" → begins + 10 minutes, null → null
  function resolveTime(value, begins) {
    if (value == null || value === "") return null;
    const s = String(value).trim();
    if (/^\+\d+$/.test(s)) return begins + parseInt(s.slice(1), 10) / 60;
    const match = s.match(/^(\d{1,2}):(\d{2})$/);
    return match ? Number(match[1]) + Number(match[2]) / 60 : null;
  }

  /* ---------- convenience wrapper bound to the site config ---------- */

  /*
   * `timetable` is the mosque's published times (data/timetable.js, synced from
   * MyLocalMasjid). Published times are used wherever they exist; the calculation
   * and the backup settings in js/config.js fill in any gaps.
   */
  function forConfig(config, timetable) {
    const zone = config.location.timeZone;
    const calc = config.calculation;
    const T = timetable !== undefined ? timetable : global.MOSQUE_TIMETABLE || null;
    const cache = new Map();
    const hours = (s) => resolveTime(s, 0);

    const published = (day) => (T && T.days && T.days[dayKey(day)]) || null;

    const api = {
      zone,
      methodName: (METHODS[calc.method] || METHODS.MWL).name,
      today: () => todayIn(zone),
      // True when the mosque has published times for this day.
      isPublished: (day) => Boolean(published(day)),
      // Credit for the published times ("Powered by MyLocalMasjid"), or null.
      source: T ? { name: "MyLocalMasjid", url: (config.myLocalMasjid || {}).url, updated: T.lastUpdated || T.fetchedAt } : null,
      // Start times for the day: the mosque's published ones, else calculated.
      times(day) {
        const key = dayKey(day);
        if (!cache.has(key)) {
          const t = computeTimes(day.y, day.m, day.d, {
            lat: config.location.lat,
            lng: config.location.lng,
            offset: utcOffset(day, zone),
            method: calc.method,
            asr: calc.asr,
            highLatitude: calc.highLatitude,
            adjustMinutes: calc.adjustMinutes,
          });
          const pub = published(day);
          if (pub && pub.start) {
            for (const k in t) {
              const v = hours(pub.start[k]);
              if (v != null) t[k] = v;
            }
          }
          cache.set(key, t);
        }
        return cache.get(key);
      },
      // Adhan time: the published start time, or the backup rule in js/config.js.
      adhan(day, key) {
        const begins = api.times(day)[key];
        const pub = published(day);
        if (pub && pub.start && hours(pub.start[key]) != null) return begins;
        const t = resolveTime((config.adhan || {})[key], begins);
        return t == null ? begins : t;
      },
      // Jumu'ah sessions for a Friday: published ones, else the one in js/config.js.
      jumuah(day) {
        const key = dayKey(day);
        const sessions = ((T && T.jumuah) || []).filter((j) => (!j.from || j.from <= key) && (!j.to || j.to >= key));
        if (sessions.length) {
          return sessions.map((j) => ({ label: j.label || "", khutbah: hours(j.khutbah), prayer: hours(j.iqamah) }));
        }
        const c = config.jumuah || {};
        const dhuhr = api.times(day).dhuhr;
        const khutbah = resolveTime(c.khutbah, dhuhr);
        const prayer = resolveTime(c.prayer, dhuhr);
        return khutbah == null && prayer == null ? [] : [{ label: "", khutbah, prayer }];
      },
      // Iqamah time, or null when none is known. On Fridays Dhuhr becomes Jumu'ah,
      // so the published weekday Dhuhr jamaat is deliberately not used.
      iqamah(day, key) {
        if (key === "dhuhr" && weekday(day) === 5) {
          const first = api.jumuah(day)[0];
          return first && first.prayer != null ? first.prayer : null;
        }
        const pub = published(day);
        const p = pub && pub.iqamah ? hours(pub.iqamah[key]) : null;
        if (p != null) return p;
        return resolveTime((config.iqamah || {})[key], api.adhan(day, key));
      },
      // The backup iqamah rule in words, e.g. "15 minutes after the adhan for Fajr,
      // Dhuhr and Asr, 5 minutes for Maghrib and 10 minutes for Isha". Empty unless
      // every prayer uses a "+N" rule.
      iqamahRule() {
        const q = config.iqamah || {};
        const groups = [];
        for (const p of PRAYERS) {
          if (p.info) continue;
          const m = /^\+(\d+)$/.exec(String(q[p.key] == null ? "" : q[p.key]).trim());
          if (!m) return "";
          const mins = Number(m[1]);
          const g = groups.find((x) => x.mins === mins);
          if (g) g.names.push(p.en);
          else groups.push({ mins, names: [p.en] });
        }
        const list = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
        return list(
          groups.map((g, i) => `${g.mins} minute${g.mins === 1 ? "" : "s"}${i === 0 ? " after the adhan" : ""} for ${list(g.names)}`)
        );
      },
      // Whether any daily iqamah time is known for these days (Jumu'ah alone doesn't count).
      hasIqamah(days) {
        return days.some((day) =>
          PRAYERS.some((p) => !p.info && !(p.key === "dhuhr" && weekday(day) === 5) && api.iqamah(day, p.key) != null)
        );
      },
      instant: (day, h) => instant(day, h, zone),
      hijri: (day) => hijri(day, config.hijriOffsetDays),
      hijriParts: (day) => hijriParts(day, config.hijriOffsetDays),
      fmt: (h) => formatTime(h, config.timeFormat),
      resolveTime,
      // The next adhan after `now` (a timestamp), looking into tomorrow after Isha.
      next(now) {
        const today = todayIn(zone);
        for (const day of [today, addDays(today, 1)]) {
          for (const p of PRAYERS) {
            if (p.info) continue;
            const adhan = api.adhan(day, p.key);
            const at = api.instant(day, adhan);
            if (at > now) return { p, day, at, adhan };
          }
        }
        return null;
      },
    };
    return api;
  }

  // Dhuhr is shown as Jumu'ah on Fridays.
  const labelFor = (p, day) => (p.friday && weekday(day) === 5 ? p.friday : p);

  global.GM = {
    METHODS,
    PRAYERS,
    computeTimes,
    utcOffset,
    todayIn,
    addDays,
    sameDay,
    dayKey,
    weekday,
    formatDay,
    formatTime,
    labelFor,
    forConfig,
  };
})(typeof window !== "undefined" ? window : globalThis);
