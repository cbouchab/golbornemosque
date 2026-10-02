/* Golborne Mosque — shared page behaviour: mobile menu, footer year, scroll reveal. */
(function () {
  "use strict";

  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");

  if (toggle && nav) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
      // The menu covers the page, so the page behind it shouldn't scroll.
      document.documentElement.classList.toggle("nav-open", open);
    };
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    // Close it if the window grows to the desktop layout while it's open.
    window.matchMedia("(min-width: 900px)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  }

  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  /*
   * Content below the fold fades up the first time it scrolls into view.
   * Only for the storytelling parts of the site: never the prayer times,
   * and never anything already on screen when the page loads, so nothing
   * someone is looking at ever disappears and comes back.
   */
  const REVEAL = [
    ".section__head",
    ".card",
    ".band__grid > *",
    ".donate__intro",
    ".give",
    ".visit__info",
    ".map",
    ".timeline__item",
    ".trustee",
    ".story__after > *",
  ].join(",");

  function initReveal() {
    if (!("IntersectionObserver" in window)) return;
    const fold = window.innerHeight;
    const items = Array.from(document.querySelectorAll(REVEAL)).filter(
      (el) => !el.closest("#prayer-times, .hero, .page-head") && el.getBoundingClientRect().top > fold
    );
    if (!items.length) return;

    // Siblings that arrive together (a row of cards) cascade by 60ms each.
    const counts = new Map();
    for (const el of items) {
      const i = counts.get(el.parentElement) || 0;
      counts.set(el.parentElement, i + 1);
      if (i) el.style.setProperty("--reveal-delay", `${Math.min(i, 5) * 60}ms`);
      el.classList.add("reveal");
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  // After all deferred scripts have run, so content they render (the trustees) is included.
  document.addEventListener("DOMContentLoaded", initReveal);
})();
