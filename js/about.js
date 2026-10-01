/* Golborne Mosque — About page: the trustees, from js/config.js. */
(function () {
  "use strict";

  const list = document.getElementById("trustee-list");
  if (!list) return;

  const trustees = (window.MOSQUE_CONFIG || {}).trustees || [];
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // "Mohamed Said Daoud" → "MD": first and last names only.
  const initials = (name) => {
    const parts = String(name).trim().split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  };

  list.innerHTML = trustees
    .filter((t) => t && t.name)
    .map((t) => {
      const photo = t.photo
        ? `<img src="${esc(t.photo)}" alt="" width="160" height="160" loading="lazy" decoding="async">`
        : `<span class="trustee__initials" aria-hidden="true">${esc(initials(t.name))}</span>`;
      return (
        `<li class="trustee${/chair/i.test(t.role || "") ? " trustee--chair" : ""}">` +
        `<div class="trustee__photo">${photo}</div>` +
        `<p class="trustee__name">${esc(t.name)}</p>` +
        (t.role ? `<p class="trustee__role">${esc(t.role)}</p>` : "") +
        `</li>`
      );
    })
    .join("");

  document.getElementById("trustee-note").innerHTML =
    'As listed on the <a href="https://register-of-charities.charitycommission.gov.uk/charity-search/-/charity-details/294588" ' +
    'rel="noopener" target="_blank">Charity Commission register</a> (charity no. 294588).';
})();
