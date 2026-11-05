/*
 * Golborne Mosque — photos in a News post open in a viewer over the page.
 * ‹ › buttons, the ← → keys or a swipe move through every photo in the post
 * (the main one first, then the gallery); ×, Esc or a click outside closes it.
 * Without JavaScript each photo is still a plain link to the full image.
 */
(function () {
  "use strict";

  const links = Array.from(document.querySelectorAll(".post__photo-link, .post__gallery-item"));
  if (!links.length || typeof HTMLDialogElement !== "function") return;

  const photos = links.map((a) => {
    const img = a.querySelector("img");
    return { src: a.getAttribute("href"), alt: (img && img.alt) || "", width: img && img.getAttribute("width"), height: img && img.getAttribute("height") };
  });
  const many = photos.length > 1;

  const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.setAttribute("aria-label", "Photos");
  dialog.innerHTML =
    `<div class="lightbox__stage"><img class="lightbox__img" alt=""></div>` +
    `<p class="lightbox__caption" aria-live="polite"><span class="lightbox__count"></span><span class="lightbox__alt"></span></p>` +
    `<button class="icon-btn lightbox__btn lightbox__close" type="button" aria-label="Close">${icon("M6 6l12 12M18 6L6 18")}</button>` +
    (many
      ? `<button class="icon-btn lightbox__btn lightbox__prev" type="button" aria-label="Previous photo">${icon("M15 5l-7 7 7 7")}</button>` +
        `<button class="icon-btn lightbox__btn lightbox__next" type="button" aria-label="Next photo">${icon("M9 5l7 7-7 7")}</button>`
      : "");
  document.body.append(dialog);

  const stage = dialog.querySelector(".lightbox__stage");
  const img = dialog.querySelector(".lightbox__img");
  const count = dialog.querySelector(".lightbox__count");
  const alt = dialog.querySelector(".lightbox__alt");
  let index = 0;

  function show(i) {
    index = (i + photos.length) % photos.length;
    const p = photos[index];
    img.src = p.src;
    img.alt = p.alt;
    if (p.width && p.height) {
      img.width = p.width;
      img.height = p.height;
    }
    count.textContent = many ? `${index + 1} of ${photos.length}` : "";
    alt.textContent = p.alt;
    // Fetch the neighbours now, so the next photo is ready when asked for.
    if (many) for (const n of [index + 1, index - 1]) new Image().src = photos[(n + photos.length) % photos.length].src;
  }

  links.forEach((a, i) =>
    a.addEventListener("click", (e) => {
      // Let a cmd/ctrl-click still open the photo in a new tab.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      show(i);
      dialog.showModal();
    })
  );

  const close = () => dialog.close();
  dialog.querySelector(".lightbox__close").addEventListener("click", close);
  if (many) {
    dialog.querySelector(".lightbox__prev").addEventListener("click", () => show(index - 1));
    dialog.querySelector(".lightbox__next").addEventListener("click", () => show(index + 1));
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        show(index - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        show(index + 1);
      }
    });
  }

  // A click on the dark space around the photo closes it.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target === stage) close();
  });

  // Swipe left or right on a phone.
  let start = null;
  stage.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  stage.addEventListener("pointerup", (e) => {
    if (!start || !many) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      show(index + (dx < 0 ? 1 : -1));
    }
  });
  // A swipe shouldn't also count as a click that closes the viewer.
  stage.addEventListener(
    "click",
    (e) => {
      if (e.target === img) e.stopPropagation();
    },
    true
  );
})();
