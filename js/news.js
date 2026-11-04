/*
 * Golborne Mosque — News cards, on the News page and the home page.
 * Any element with data-news is filled from /api/news:
 *   data-news-limit="3"     how many posts to show (and load each time)
 *   data-news-heading="h2"  the heading level for each post's title
 * A surrounding [data-news-section] stays hidden until there is a post to show.
 */
(function () {
  "use strict";

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const longDate = (iso) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  // Posts without a photo show the mosque's symbol on the gold lattice instead.
  const placeholder = '<span class="news-card__mark"><img src="/assets/symbol.svg" width="30" height="38" alt=""></span>';

  function card(post, heading) {
    const photo = post.image
      ? `<img src="${esc(post.image.url)}" width="${post.image.width}" height="${post.image.height}" alt="${esc(post.image.alt)}" loading="lazy" decoding="async">`
      : placeholder;
    return (
      `<article class="news-card">` +
      `<div class="news-card__photo">${photo}</div>` +
      `<div class="news-card__text">` +
      `<p class="news-card__date"><time datetime="${esc(post.date)}">${esc(longDate(post.date))}</time></p>` +
      `<${heading} class="news-card__title"><a href="/news/${esc(post.slug)}">${esc(post.title)}</a></${heading}>` +
      (post.excerpt ? `<p class="news-card__excerpt">${esc(post.excerpt)}</p>` : "") +
      `</div></article>`
    );
  }

  function init(grid) {
    const limit = parseInt(grid.dataset.newsLimit, 10) || 12;
    const heading = /^h[2-4]$/.test(grid.dataset.newsHeading || "") ? grid.dataset.newsHeading : "h3";
    const section = grid.closest("[data-news-section]");
    const scope = grid.parentElement;
    const empty = scope.querySelector("[data-news-empty]");
    const more = scope.querySelector("[data-news-more]");
    const moreButton = more && more.querySelector("button");
    let offset = 0;

    async function load() {
      if (moreButton) moreButton.disabled = true;
      try {
        const res = await fetch(`/api/news?limit=${limit}&offset=${offset}`, { headers: { accept: "application/json" } });
        const data = await res.json();
        const posts = data.posts || [];
        grid.insertAdjacentHTML("beforeend", posts.map((p) => card(p, heading)).join(""));
        offset += posts.length;
        if (section) section.hidden = offset === 0;
        if (empty) empty.hidden = offset > 0;
        if (more) more.hidden = !data.more;
        grid.removeAttribute("aria-busy");
      } catch (e) {
        if (empty && offset === 0) {
          empty.textContent = "News couldn’t be loaded just now. Please try again later.";
          empty.hidden = false;
        }
        grid.removeAttribute("aria-busy");
      } finally {
        if (moreButton) moreButton.disabled = false;
      }
    }

    if (moreButton) moreButton.addEventListener("click", load);
    load();
  }

  document.querySelectorAll("[data-news]").forEach(init);
})();
