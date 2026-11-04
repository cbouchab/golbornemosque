/* Golborne Mosque — shared page behaviour: mobile menu, footer year, scroll reveal, welcome message. */
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
    ".mission__inner",
    ".trust",
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

  // After all deferred scripts have run, so content they render is included.
  document.addEventListener("DOMContentLoaded", initReveal);

  /*
   * The welcome message (`welcome` in config.js): shown once, on whichever page
   * someone opens first. The browser remembers it was shown, so it never comes
   * back until `version` changes. Where the browser won't let the site remember
   * anything (storage blocked), it isn't shown at all rather than on every page.
   */
  function initWelcome() {
    const w = window.MOSQUE_CONFIG && window.MOSQUE_CONFIG.welcome;
    if (!w || !w.enabled || typeof HTMLDialogElement !== "function") return;

    const key = `golborne-welcome-${w.version || 1}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, new Date().toISOString().slice(0, 10));
    } catch {
      return;
    }

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    };

    const dialog = el("dialog", "welcome");
    dialog.setAttribute("aria-labelledby", "welcome-title");
    // Focus lands on the message itself (below, once open): screen readers read
    // it from the top, and the arrow keys scroll it.
    dialog.tabIndex = -1;

    const x = el("button", "icon-btn welcome__x");
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    const head = el("div", "welcome__head");
    const mark = el("img", "welcome__mark");
    Object.assign(mark, { src: "/assets/symbol.svg", width: 30, height: 38, alt: "" });
    head.append(mark);
    if (w.arabic) {
      const ar = el("p", "welcome__ar", w.arabic);
      ar.lang = "ar";
      ar.dir = "rtl";
      head.append(ar);
    }
    const title = el("h2", "welcome__title", w.title);
    title.id = "welcome-title";
    head.append(title);

    const body = el("div", "welcome__body");
    if (w.greeting) body.append(el("p", "welcome__greeting", w.greeting));
    (w.paragraphs || []).forEach((text) => body.append(el("p", "", text)));
    if (w.closing) body.append(el("p", "welcome__closing", w.closing));
    if (w.motto) body.append(el("p", "welcome__motto", w.motto));

    const foot = el("div", "welcome__foot");
    const go = el("button", "btn btn--gold btn--block", w.button || "Continue");
    go.type = "button";
    foot.append(go);

    dialog.append(x, head, body, foot);

    const close = () => dialog.close();
    x.addEventListener("click", close);
    go.addEventListener("click", close);
    // A click on the dimmed page around the message closes it too.
    dialog.addEventListener("click", (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
    });

    document.body.append(dialog);
    dialog.showModal();
    dialog.focus();
  }

  initWelcome();
})();
