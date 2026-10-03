/* Golborne Mosque — About page: the timeline drawn as it is read, and the trustees from js/config.js. */
(function () {
  "use strict";

  /* ---------- the timeline ---------- */
  // As the page scrolls, the rule grows down behind a glowing pen; each star
  // turns gold as the pen reaches it and that milestone's text rises in. The
  // line only ever grows, and whatever is on screen when the page opens is
  // shown straight away, so nothing being read disappears.

  const timeline = document.getElementById("timeline");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (timeline && !calm) {
    const items = Array.from(timeline.children);
    const MARK = 14; // a star's centre, from the top of its milestone
    const PEN = 0.6; // the pen sits this far down the window

    const wrap = document.createElement("div");
    const line = document.createElement("span");
    const pen = document.createElement("span");
    wrap.className = "timeline-wrap";
    line.className = "timeline__line";
    pen.className = "timeline__pen";
    line.setAttribute("aria-hidden", "true");
    pen.setAttribute("aria-hidden", "true");
    timeline.before(wrap);
    wrap.append(timeline, line, pen);

    let marks = [];
    let track = 0;
    let reach = -Infinity; // how far down the timeline the pen has been
    let ticking = false;

    function measure() {
      marks = items.map((li) => li.offsetTop + MARK);
      track = marks[marks.length - 1] - MARK;
      wrap.style.setProperty("--track", `${track}px`);
    }

    function draw() {
      ticking = false;
      reach = Math.max(reach, window.innerHeight * PEN - timeline.getBoundingClientRect().top);
      const drawn = Math.max(0, Math.min(track, reach - MARK));
      line.style.transform = `scaleY(${track ? drawn / track : 0})`;
      pen.style.transform = `translateY(${drawn}px)`;
      pen.classList.toggle("is-on", drawn > 0 && drawn < track);
      items.forEach((li, i) => {
        if (reach >= marks[i]) li.classList.add("is-reached", "is-shown");
      });
      if (drawn >= track) stop();
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(draw);
      }
    };
    const onResize = () => {
      measure();
      draw();
    };
    function stop() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    }

    // Already on screen: drawn at once, before the timeline goes live, so it never fades.
    measure();
    reach = window.innerHeight - 24 - timeline.getBoundingClientRect().top;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    draw();
    timeline.classList.add("timeline--live");
    // Web fonts can change the line lengths once they arrive.
    if (document.fonts) document.fonts.ready.then(onResize);
  }

  /* ---------- trustees ---------- */

  const list = document.getElementById("trustee-list");
  if (!list) return;

  const trustees = (window.MOSQUE_CONFIG || {}).trustees || [];
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // Outline figures for trustees without a photo: a man, or a woman in hijab.
  const FIGURES = {
    man:
      '<circle cx="50" cy="40" r="14"/><path d="M17 104C17 80 31 65 50 65S83 80 83 104"/>' +
      '<path d="M43 65.6L50 74L57 65.6"/>',
    woman:
      '<path d="M50 19C37 19 29.5 29 29.5 42C29.5 50 29 56 26.5 62C21 72 17 84 17 104' +
      'M83 104C83 84 79 72 73.5 62C71 56 70.5 50 70.5 42C70.5 29 63 19 50 19"/>' +
      '<ellipse cx="50" cy="43" rx="10" ry="12.5"/>',
  };
  const figure = (kind) =>
    `<svg class="trustee__figure" viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
    `${FIGURES[kind === "woman" ? "woman" : "man"]}</svg>`;

  list.innerHTML = trustees
    .filter((t) => t && t.name)
    .map((t) => {
      const photo = t.photo
        ? `<img src="${esc(t.photo)}" alt="" width="160" height="160" loading="lazy" decoding="async">`
        : figure(t.figure);
      return (
        `<li class="trustee${/chair/i.test(t.role || "") ? " trustee--chair" : ""}">` +
        `<div class="trustee__photo">${photo}</div>` +
        `<p class="trustee__name">${esc(t.name)}</p>` +
        (t.role ? `<p class="trustee__role">${esc(t.role)}</p>` : "") +
        `</li>`
      );
    })
    .join("");
})();
