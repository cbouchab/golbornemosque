/* Golborne Mosque — monthly timetable page. */
(function () {
  "use strict";

  const C = window.MOSQUE_CONFIG;
  const GM = window.GM;
  const P = GM.forConfig(C);
  const $ = (id) => document.getElementById(id);
  const HIGH_LAT = {
    angleBased: "the angle-based rule",
    oneSeventh: "the one-seventh-of-the-night rule",
    nightMiddle: "the middle-of-the-night rule",
  };
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const today = P.today();
  let month = fromQuery() || { y: today.y, m: today.m };

  function fromQuery() {
    const q = new URLSearchParams(location.search).get("month");
    const match = q && q.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    return m >= 1 && m <= 12 ? { y, m } : null;
  }

  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shiftMonth = ({ y, m }, n) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  };

  // "20 Rabiʻ II 1448 AH" → { day: 20, month: "Rabiʻ II", year: 1448 }
  function hijriOf(day) {
    const match = P.hijri(day).match(/^(\d+)\s+(.+?)\s+(\d+)\s*AH$/);
    return match ? { day: Number(match[1]), month: match[2], year: Number(match[3]) } : null;
  }

  function renderHead(withIqamah) {
    const name = (p) => `${p.en}<span lang="ar">${p.ar}</span>`;
    const lead = (span) => `<th scope="col"${span}>Date</th><th scope="col" class="col-hijri"${span}>Hijri</th>`;
    if (!withIqamah) {
      return `<tr>${lead("")}${GM.PRAYERS.map((p) => `<th scope="col">${name(p)}</th>`).join("")}</tr>`;
    }
    const top = GM.PRAYERS.map((p) =>
      p.info ? `<th scope="col" rowspan="2">${name(p)}</th>` : `<th scope="colgroup" colspan="2" class="is-group">${name(p)}</th>`
    ).join("");
    const sub = GM.PRAYERS.filter((p) => !p.info)
      .map(() => `<th scope="col" class="is-sub">Adhan</th><th scope="col" class="is-sub">Iqamah</th>`)
      .join("");
    return `<tr>${lead(' rowspan="2"')}${top}</tr><tr>${sub}</tr>`;
  }

  function render() {
    const { y, m } = month;
    const n = daysInMonth(y, m);
    const first = { y, m, d: 1 };
    const last = { y, m, d: n };
    const title = GM.formatDay(first, { month: "long", year: "numeric" });
    const days = Array.from({ length: n }, (_, i) => ({ y, m, d: i + 1 }));
    // Iqamah columns appear for any month with iqamah times (published or set in js/config.js).
    const withIqamah = P.hasIqamah(days);
    const published = days.filter((day) => P.isPublished(day)).length;
    // Mark calculated days only when the month mixes them with published ones.
    const markCalculated = published > 0 && published < n;

    const h1 = hijriOf(first);
    const h2 = hijriOf(last);
    let hijriRange = "";
    if (h1 && h2) {
      hijriRange =
        h1.year === h2.year
          ? `${h1.month} – ${h2.month} ${h2.year} AH`
          : `${h1.month} ${h1.year} – ${h2.month} ${h2.year} AH`;
    }
    $("month-title").innerHTML = `${title}${hijriRange ? `<span class="month-bar__hijri">${hijriRange}</span>` : ""}`;
    $("month-caption").textContent = `${withIqamah ? "Adhan and iqamah" : "Adhan"} times for ${title}`;
    document.title = `${title} Prayer Timetable · Golborne Mosque`;

    const rows = [];
    for (const day of days) {
      const d = day.d;
      const h = hijriOf(day);
      const isToday = GM.sameDay(day, today);
      const classes = [GM.weekday(day) === 5 ? "is-friday" : "", isToday ? "is-today" : ""].join(" ").trim();
      const hijriCell = h ? (d === 1 || h.day === 1 ? `${h.day} ${h.month}` : String(h.day)) : "";
      rows.push(
        `<tr${classes ? ` class="${classes}"` : ""}${isToday ? ' aria-current="date"' : ""}>` +
          `<th scope="row"><span class="day-num">${d}${markCalculated && !P.isPublished(day) ? '<span class="calc-mark" title="Calculated">*</span>' : ""}</span>` +
          `<span class="day-name">${GM.formatDay(day, { weekday: "short" })}</span></th>` +
          `<td class="col-hijri">${hijriCell}</td>` +
          GM.PRAYERS.map((p) => {
            if (p.info) return `<td class="is-sunrise">${P.fmt(P.times(day)[p.key])}</td>`;
            const adhan = `<td class="is-adhan">${P.fmt(P.adhan(day, p.key))}</td>`;
            return withIqamah ? adhan + `<td class="is-iqamah">${P.fmt(P.iqamah(day, p.key))}</td>` : adhan;
          }).join("") +
          `</tr>`
      );
    }
    document.querySelector(".month-table thead").innerHTML = renderHead(withIqamah);
    document.querySelector(".month-table").classList.toggle("has-iqamah", withIqamah);
    $("month-body").innerHTML = rows.join("");
    $("month-notes").innerHTML = notes(published, n, markCalculated, withIqamah);

    const isThisMonth = y === today.y && m === today.m;
    $("this-month").hidden = isThisMonth;
    const url = new URL(location.href);
    if (isThisMonth) url.searchParams.delete("month");
    else url.searchParams.set("month", `${y}-${String(m).padStart(2, "0")}`);
    history.replaceState(null, "", url);
  }

  function notes(published, n, markCalculated, withIqamah) {
    const calc = C.calculation;
    const parts = [];
    if (published > 0 && P.source) {
      parts.push(
        `${published === n ? "Adhan and iqamah times" : "Times"} as published by the mosque, the same times shown on its screens. ` +
          `Powered by <a href="${esc(P.source.url)}" target="_blank" rel="noopener">MyLocalMasjid</a>.`
      );
    }
    if (published < n) {
      const method =
        `${P.methodName} method${calc.asr === "hanafi" ? " (Hanafi Asr)" : ""}` +
        (GM.METHODS[calc.method] && GM.METHODS[calc.method].seasonal
          ? ""
          : `, with Fajr and Isha following ${HIGH_LAT[calc.highLatitude] || HIGH_LAT.angleBased} in the summer months`);
      const rule = P.iqamahRule();
      parts.push(
        esc(
          `${markCalculated ? "Times for days marked * are" : "Adhan times are"} calculated to match the mosque's timetable, ` +
            `using the ${method}. ` +
            (rule
              ? `Iqamah follows the mosque's usual gap: ${rule}. Please check the notice board in the mosque for any changes.`
              : withIqamah
                ? ""
                : "Iqamah times are posted on the notice board in the mosque.")
        )
      );
    }
    parts.push(
      esc(
        "Times change automatically when the clocks go forward or back. Hijri dates follow the Umm al-Qura calendar and may differ by a day from the local moon sighting."
      )
    );
    return parts.join(" ");
  }

  $("prev-month").addEventListener("click", () => {
    month = shiftMonth(month, -1);
    render();
  });
  $("next-month").addEventListener("click", () => {
    month = shiftMonth(month, 1);
    render();
  });
  $("this-month").addEventListener("click", () => {
    month = { y: today.y, m: today.m };
    render();
  });
  $("print-btn").addEventListener("click", () => window.print());

  render();
})();
