/* Golborne Mosque — home page: today's times, next prayer, Jumu'ah, Ramadan and notices. */
(function () {
  "use strict";

  const C = window.MOSQUE_CONFIG;
  const GM = window.GM;
  const P = GM.forConfig(C);
  const $ = (id) => document.getElementById(id);

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const longDate = (day) => GM.formatDay(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const shortDate = (day) => GM.formatDay(day, { weekday: "long", day: "numeric", month: "long" });
  const labelFor = GM.labelFor;

  let today = P.today();
  let viewing = today;
  let lastNextId = "";

  /* ---------- next prayer ---------- */

  const findNext = (now) => P.next(now);

  function countdownText(ms) {
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "in under a minute";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `in ${m} min`;
    return m ? `in ${h} hr ${m} min` : `in ${h} hr`;
  }

  function renderHero(next) {
    $("hero-date").textContent = shortDate(today);
    $("hero-hijri").textContent = P.hijri(today);
    if (!next) return;

    const label = labelFor(next.p, next.day);
    $("next-name").textContent = label.en;
    $("next-name-ar").textContent = label.ar;
    $("next-time").textContent = P.fmt(next.adhan);

    const tomorrow = !GM.sameDay(next.day, today);
    $("next-countdown").textContent = `Adhan ${tomorrow ? "tomorrow, " : ""}${countdownText(next.at - Date.now())}`;

    const iqamah = P.iqamah(next.day, next.p.key);
    const qEl = $("next-iqamah");
    qEl.hidden = iqamah == null;
    if (iqamah != null) qEl.textContent = `Iqamah ${P.fmt(iqamah)}`;
  }

  /* ---------- daily table ---------- */

  function renderTable(next) {
    const isToday = GM.sameDay(viewing, today);
    const nextKey = isToday && next && GM.sameDay(next.day, today) ? next.p.key : null;

    $("pt-body").innerHTML = GM.PRAYERS.map((p) => {
      const label = labelFor(p, viewing);
      const classes = [p.info ? "is-info" : "", p.key === nextKey ? "is-next" : ""].join(" ").trim();
      const tag = p.key === nextKey ? '<span class="prayer__tag">Next</span>' : "";
      // Sunrise has no adhan or iqamah; its time sits in the first column for reference.
      const adhan = p.info ? P.times(viewing)[p.key] : P.adhan(viewing, p.key);
      const iqamah = p.info ? "" : P.fmt(P.iqamah(viewing, p.key));
      return (
        `<tr${classes ? ` class="${classes}"` : ""}>` +
        `<td><div class="prayer"><span class="prayer__en">${esc(label.en)}</span>` +
        `<span class="prayer__ar" lang="ar" dir="rtl">${label.ar}</span>${tag}</div></td>` +
        `<td>${esc(P.fmt(adhan))}</td><td>${esc(iqamah)}</td></tr>`
      );
    }).join("");

    $("pt-date").textContent = (isToday ? "Today · " : "") + longDate(viewing);
    $("pt-hijri").textContent = P.hijri(viewing);
    $("today-btn").hidden = isToday;

    $("pt-source").innerHTML = sourceNote(viewing);
  }

  // Where the times come from. MyLocalMasjid's terms ask for credit wherever its times are shown.
  function sourceNote(day) {
    if (P.isPublished(day) && P.source) {
      const updated = P.source.updated ? new Date(P.source.updated) : null;
      const when =
        updated && !isNaN(updated)
          ? ` Last updated ${updated.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: P.zone })}.`
          : "";
      return (
        `Adhan and iqamah times as published by the mosque, the same times shown on its screens.${when} ` +
        `Powered by <a href="${esc(P.source.url)}" target="_blank" rel="noopener">MyLocalMasjid</a>.`
      );
    }
    const asrNote = C.calculation.asr === "hanafi" ? " with the Hanafi Asr" : "";
    const rule = P.iqamahRule();
    return esc(
      `Adhan times are calculated to match the mosque's timetable, using the ${P.methodName} method${asrNote}. ` +
        (rule
          ? `Iqamah follows the mosque's usual gap: ${rule}. Please check the notice board in the mosque for any changes.`
          : P.hasIqamah([day])
            ? "Please check the notice board in the mosque."
            : "Iqamah times are posted on the notice board in the mosque.")
    );
  }

  /* ---------- Jumu'ah ---------- */

  function renderJumuah() {
    const now = Date.now();
    let friday = today;
    const daysAhead = (5 - GM.weekday(today) + 7) % 7;
    if (daysAhead > 0) friday = GM.addDays(today, daysAhead);
    else if (now > P.instant(today, P.times(today).dhuhr + 2)) friday = GM.addDays(today, 7);

    const ahead = Math.round((Date.UTC(friday.y, friday.m - 1, friday.d) - Date.UTC(today.y, today.m - 1, today.d)) / 86400000);
    const prefix = ahead === 0 ? "Today, " : ahead === 1 ? "Tomorrow, " : "Friday ";
    const rows = [["Next Jumu‘ah", prefix + GM.formatDay(friday, { day: "numeric", month: "long" })]];

    // One or more sessions (e.g. 1st and 2nd Jumu'ah).
    const sessions = P.jumuah(friday);
    sessions.forEach((j, i) => {
      const name = sessions.length > 1 ? j.label || `${i + 1}${["st", "nd", "rd"][i] || "th"} Jumu‘ah` : "";
      if (j.khutbah != null) rows.push([name ? `${name} · khutbah` : "Khutbah", P.fmt(j.khutbah)]);
      if (j.prayer != null) rows.push([name ? `${name} · prayer` : "Prayer", P.fmt(j.prayer)]);
    });
    rows.push(["Dhuhr begins", P.fmt(P.adhan(friday, "dhuhr"))]);

    $("jumuah-list").innerHTML = rows.map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join("");
    $("jumuah-note").hidden = sessions.length > 0;
  }

  /* ---------- Ramadan ---------- */

  function renderRamadan() {
    const label = $("ramadan-label");
    const value = $("ramadan-value");
    const detail = $("ramadan-detail");
    const h = P.hijriParts(today);

    if (!h) {
      label.textContent = "Ramadan";
      value.textContent = "Free iftar daily";
      detail.textContent = "The start of Ramadan is announced at the mosque, following the sighting of the moon.";
      return;
    }

    if (h.month === 9) {
      label.textContent = `Ramadan ${h.year} · Ramadan Mubarak`;
      value.textContent = `Day ${h.day}`;
      detail.textContent = `Iftar today at Maghrib, ${P.fmt(P.times(today).maghrib)}.`;
      return;
    }
    if ((h.month === 10 && h.day <= 3) || (h.month === 12 && h.day >= 10 && h.day <= 13)) {
      label.textContent = h.month === 10 ? "Eid al-Fitr" : "Eid al-Adha";
      value.textContent = "Eid Mubarak";
      detail.innerHTML = '<span lang="ar" dir="rtl">تقبّل الله منّا ومنكم</span> · May Allah accept from us and from you.';
      return;
    }

    for (let i = 1; i < 400; i++) {
      const day = GM.addDays(today, i);
      const hp = P.hijriParts(day);
      if (hp && hp.month === 9 && hp.day === 1) {
        label.textContent = `Ramadan ${hp.year} is expected`;
        value.textContent = i === 1 ? "Tomorrow" : `in ${i} days`;
        detail.textContent = `First fast expected on or around ${longDate(day)}, subject to the sighting of the moon.`;
        return;
      }
    }
  }

  /* ---------- notices ---------- */

  function renderNotices() {
    const key = GM.dayKey(today);
    const list = (C.notices || []).filter((n) => n && n.title && (!n.until || n.until >= key));
    const box = $("notices");
    box.hidden = list.length === 0;
    box.innerHTML = list
      .map(
        (n) =>
          `<div class="notice" role="note"><svg aria-hidden="true"><use href="#i-star"/></svg>` +
          `<div><h3>${esc(n.title)}</h3>${n.body ? `<p>${esc(n.body)}</p>` : ""}</div></div>`
      )
      .join("");
  }

  /* ---------- wiring ---------- */

  function renderAll() {
    const next = findNext(Date.now());
    lastNextId = next ? GM.dayKey(next.day) + next.p.key : "";
    renderHero(next);
    renderTable(next);
    renderJumuah();
    renderRamadan();
    renderNotices();
  }

  function tick() {
    const nowDay = P.today();
    if (!GM.sameDay(nowDay, today)) {
      const wasViewingToday = GM.sameDay(viewing, today);
      today = nowDay;
      if (wasViewingToday) viewing = today;
      renderAll();
      return;
    }
    const next = findNext(Date.now());
    const id = next ? GM.dayKey(next.day) + next.p.key : "";
    if (id !== lastNextId) {
      lastNextId = id;
      renderTable(next);
      renderJumuah();
    }
    renderHero(next);
  }

  $("prev-day").addEventListener("click", () => {
    viewing = GM.addDays(viewing, -1);
    renderTable(findNext(Date.now()));
  });
  $("next-day").addEventListener("click", () => {
    viewing = GM.addDays(viewing, 1);
    renderTable(findNext(Date.now()));
  });
  $("today-btn").addEventListener("click", () => {
    viewing = today;
    renderTable(findNext(Date.now()));
  });

  renderAll();
  setInterval(tick, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });
})();
