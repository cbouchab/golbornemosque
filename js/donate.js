/* Golborne Mosque — donations: SumUp payment links and bank transfer details. */
(function () {
  "use strict";

  const list = document.getElementById("bank-list");
  if (!list) return;

  const D = (window.MOSQUE_CONFIG || {}).donations || {};
  const sumup = D.sumup || {};
  const bank = D.bank || {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const warn = (msg) => console.warn(`Golborne Mosque settings: ${msg}`);
  const PLACEHOLDER = '<span class="placeholder-chip">To be added</span>';

  /* ---------- SumUp ---------- */

  // Only https:// addresses are used, so a typo can't turn the button into something else.
  function safeLink(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      if (u.protocol === "https:") return u.href;
    } catch (e) {
      /* fall through */
    }
    warn(`ignoring a SumUp link that isn't an https:// address: ${url}`);
    return null;
  }

  function renderSumUp() {
    const link = safeLink(sumup.link);
    const amounts = (sumup.amounts || []).filter((a) => a && a.label).map((a) => ({ label: a.label, link: safeLink(a.link) }));
    const live = amounts.filter((a) => a.link);
    const newTab = '<span class="visually-hidden"> (opens SumUp in a new tab)</span>';

    if (!link && live.length === 0) {
      // Placeholder until the mosque adds its SumUp payment links.
      $("sumup-amounts").innerHTML = amounts
        .map((a) => `<span class="amount is-placeholder" aria-hidden="true">${esc(a.label)}</span>`)
        .join("");
      $("sumup-action").innerHTML = '<span class="btn btn--gold btn--block is-placeholder" aria-disabled="true">Donate online</span>';
      $("sumup-note").innerHTML = '<span class="placeholder-chip">SumUp payment link to be added</span>';
      return;
    }

    $("sumup-amounts").innerHTML = live
      .map((a) => `<a class="amount" href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.label)}${newTab}</a>`)
      .join("");
    $("sumup-action").innerHTML = link
      ? `<a class="btn btn--gold btn--block" href="${esc(link)}" target="_blank" rel="noopener">` +
        `${live.length ? "Give another amount" : "Donate online"}${newTab}</a>`
      : "";
    $("sumup-note").textContent = "Payments are processed securely by SumUp. The mosque never sees your card details.";
  }

  /* ---------- bank transfer ---------- */

  const digits = (v) => String(v).replace(/\D/g, "");
  const compact = (v) => String(v).replace(/[\s-]/g, "").toUpperCase();

  // IBAN check digits (ISO 13616, mod 97), to catch typos in the settings.
  function ibanValid(v) {
    const s = compact(v);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
    let rem = 0;
    for (const ch of s.slice(4) + s.slice(0, 4)) {
      const n = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
      for (const d of n) rem = (rem * 10 + Number(d)) % 97;
    }
    return rem === 1;
  }

  const FIELDS = [
    { key: "accountName", label: "Account name", copy: true },
    { key: "bankName", label: "Bank" },
    {
      key: "sortCode",
      label: "Sort code",
      copy: true,
      show: (v) => digits(v).replace(/(\d{2})(?=\d)/g, "$1-"),
      raw: digits,
      check: (v) => digits(v).length === 6,
    },
    { key: "accountNumber", label: "Account number", copy: true, show: digits, raw: digits, check: (v) => digits(v).length === 8 },
    { key: "iban", label: "IBAN", copy: true, show: (v) => compact(v).replace(/(.{4})(?=.)/g, "$1 "), raw: compact, check: ibanValid },
    {
      key: "bic",
      label: "BIC / SWIFT",
      copy: true,
      show: compact,
      raw: compact,
      check: (v) => /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(compact(v)),
    },
    { key: "reference", label: "Reference", copy: true, optional: true },
  ];

  function renderBank() {
    list.innerHTML = FIELDS.map((f) => {
      const v = bank[f.key];
      if (v == null || v === "") {
        return f.optional ? "" : `<div><dt>${f.label}</dt><dd>${PLACEHOLDER}</dd></div>`;
      }
      if (f.check && !f.check(v)) warn(`the ${f.label} looks wrong. Please double-check it in js/config.js.`);
      const shown = f.show ? f.show(v) : String(v);
      const raw = f.raw ? f.raw(v) : String(v);
      const value = f.copy
        ? `<button class="copy" type="button" data-copy="${esc(raw)}" data-label="${esc(f.label)}">` +
          `<span class="copy__value">${esc(shown)}</span> ` +
          `<span class="copy__hint"><span class="copy__word">Copy</span><span class="visually-hidden"> ${esc(f.label)}</span></span></button>`
        : `<span class="bank__value">${esc(shown)}</span>`;
      return `<div><dt>${f.label}</dt><dd>${value}</dd></div>`;
    }).join("");
  }

  // Older copy method, for browsers that block or lack the Clipboard API.
  function legacyCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  function copyText(text) {
    const fallback = () => (legacyCopy(text) ? Promise.resolve() : Promise.reject(new Error("copy failed")));
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(fallback);
    return fallback();
  }

  // Last resort: highlight the value so it can be copied by hand.
  function selectValue(btn) {
    const range = document.createRange();
    range.selectNodeContents(btn.querySelector(".copy__value"));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".copy");
    if (!btn) return;
    const hint = btn.querySelector(".copy__word");
    const status = $("copy-status");
    copyText(btn.dataset.copy).then(
      () => {
        btn.classList.add("is-copied");
        hint.textContent = "Copied";
        status.textContent = `${btn.dataset.label} copied`;
        clearTimeout(btn.copyTimer);
        btn.copyTimer = setTimeout(() => {
          btn.classList.remove("is-copied");
          hint.textContent = "Copy";
        }, 2000);
      },
      () => {
        selectValue(btn);
        status.textContent = `Couldn't copy automatically. The ${btn.dataset.label} is selected so you can copy it.`;
      }
    );
  });

  renderSumUp();
  renderBank();
})();
