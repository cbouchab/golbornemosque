/* Golborne Mosque — adhan and iqamah bar under the menu, on every page. */
(function () {
  "use strict";

  const bar = document.getElementById("prayer-bar");
  if (!bar) return;

  const C = window.MOSQUE_CONFIG;
  const GM = window.GM;
  const P = GM.forConfig(C);
  const PRAYERS = GM.PRAYERS.filter((p) => !p.info);

  const table = bar.querySelector("table");
  const dayEl = bar.querySelector("[data-bar-day]");
  const dateEl = bar.querySelector("[data-bar-date]");
  const sunriseEl = bar.querySelector("[data-bar-sunrise]");
  const creditEl = bar.querySelector("[data-bar-credit]");
  let lastId = "";

  function render() {
    const today = P.today();
    const next = P.next(Date.now());
    // After Isha the bar moves on to tomorrow's times.
    const day = next ? next.day : today;
    const id = GM.dayKey(today) + GM.dayKey(day) + (next ? next.p.key : "");
    if (id === lastId) return;
    lastId = id;

    const tomorrow = !GM.sameDay(day, today);
    const hijri = P.hijri(day);
    dayEl.textContent = tomorrow ? "Tomorrow" : "Today";
    dateEl.textContent = GM.formatDay(day, { weekday: "short", day: "numeric", month: "short" }) + (hijri ? ` · ${hijri}` : "");
    sunriseEl.textContent = `Sunrise ${P.fmt(P.times(day).sunrise)}`;
    // MyLocalMasjid's terms ask for this credit wherever its times are shown.
    creditEl.innerHTML =
      P.isPublished(day) && P.source
        ? `Powered by <a href="${P.source.url}" target="_blank" rel="noopener">MyLocalMasjid</a>`
        : "Calculated times";

    const cols = PRAYERS.map((p) => ({
      label: GM.labelFor(p, day),
      adhan: P.adhan(day, p.key),
      iqamah: P.iqamah(day, p.key),
      isNext: Boolean(next && GM.sameDay(next.day, day) && next.p.key === p.key),
    }));
    const cls = (c) => (c.isNext ? ' class="is-next"' : "");

    table.innerHTML =
      `<caption class="visually-hidden">Adhan and iqamah times ${tomorrow ? "tomorrow" : "today"}</caption>` +
      `<thead><tr><td></td>` +
      cols
        .map((c) => `<th scope="col"${cls(c)}>${c.label.en}${c.isNext ? '<span class="visually-hidden"> (next prayer)</span>' : ""}</th>`)
        .join("") +
      `</tr></thead><tbody>` +
      `<tr><th scope="row">Adhan</th>${cols.map((c) => `<td${cls(c)}>${P.fmt(c.adhan)}</td>`).join("")}</tr>` +
      `<tr><th scope="row">Iqamah</th>${cols.map((c) => `<td${cls(c)}>${P.fmt(c.iqamah)}</td>`).join("")}</tr>` +
      `</tbody>`;
  }

  render();
  setInterval(render, 20000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });
})();
