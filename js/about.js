/* Golborne Mosque — About page: the timeline drawn as it is read. */
(function () {
  "use strict";

  /* ---------- the timeline ---------- */
  // As the page scrolls, the rule grows down behind a glowing pen; each dot
  // turns gold as the pen reaches it and that milestone's text rises in. The
  // line only ever grows, and whatever is on screen when the page opens is
  // shown straight away, so nothing being read disappears.

  const timeline = document.getElementById("timeline");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (timeline && !calm) {
    const items = Array.from(timeline.children);
    const MARK = 14; // a dot's centre, from the top of its milestone
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
})();
