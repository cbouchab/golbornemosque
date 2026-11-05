/* Golborne Mosque — donations: SumUp card widget and bank transfer details. */
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

  /* ---------- SumUp card widget ---------- */
  // The page asks /api/donate (a Cloudflare function holding the SumUp key) to
  // create a checkout, then mounts SumUp's card form for it. Card details go
  // straight to SumUp; the page only learns whether the payment succeeded.

  const SDK = "https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js";
  const MIN = 1;
  const MAX = 5000;
  const form = $("donate-form");
  const fund = $("donate-fund");
  const fundHint = $("donate-fund-hint");
  const other = $("donate-other");
  const submit = $("donate-submit");
  const status = $("donate-status");
  const pounds = (n) => `£${n % 1 ? n.toFixed(2) : n}`;
  // How each type of donation reads in "Giving £25 as Zakat" and "Your Zakat of £25 has been received".
  // The keys must match the <select id="donate-fund"> values and FUNDS in functions/api/donate.js.
  const FUNDS = {
    mosque: { giving: "to the Mosque Fund", gift: (p) => `donation of ${p} to the Mosque Fund` },
    zakat: { giving: "as Zakat", gift: (p) => `Zakat of ${p}` },
    sadaqah: { giving: "as Sadaqah", gift: (p) => `Sadaqah of ${p}` },
  };
  const giftText = () => (FUNDS[chosenFund] || FUNDS.mosque).gift(pounds(chosen));
  let widget = null;
  let checkoutId = null;
  let chosen = null;
  let chosenFund = null;

  function setStatus(msg) {
    status.textContent = msg || "";
  }

  function readAmount() {
    const typed = other.value.trim().replace(/^£/, "").replace(/,/g, "");
    if (typed) {
      const n = Math.round(Number(typed) * 100) / 100;
      return Number.isFinite(n) ? n : NaN;
    }
    const picked = form.querySelector('input[name="amount"]:checked');
    return picked ? Number(picked.value) : NaN;
  }

  function refreshFund() {
    const opt = fund.selectedOptions[0];
    const hint = opt && opt.value ? opt.dataset.hint || "" : "";
    fundHint.textContent = hint;
    fundHint.hidden = !hint;
    const box = fund.closest(".donate-type");
    if (fund.value && box.classList.contains("is-missing")) {
      box.classList.remove("is-missing");
      setStatus("");
    }
  }

  function refreshButton() {
    const n = readAmount();
    submit.textContent = Number.isFinite(n) && n >= MIN && n <= MAX ? `Donate ${pounds(n)}` : "Donate";
  }

  function renderAmounts() {
    const list = (sumup.amounts || []).filter((n) => Number.isFinite(Number(n)) && n >= MIN && n <= MAX);
    $("donate-amounts").insertAdjacentHTML(
      "beforeend",
      list
        .map(
          (n) =>
            `<label class="amount"><input type="radio" name="amount" value="${n}"${n === sumup.preselected ? " checked" : ""}>` +
            `<span>${pounds(Number(n))}</span></label>`
        )
        .join("")
    );
  }

  let sdkPromise = null;
  function loadSdk() {
    if (window.SumUpCard) return Promise.resolve();
    if (!sdkPromise) {
      sdkPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = SDK;
        s.onload = () => resolve();
        s.onerror = () => {
          sdkPromise = null;
          reject(new Error("SumUp's card form couldn't load"));
        };
        document.head.appendChild(s);
      });
    }
    return sdkPromise;
  }

  function show(state) {
    form.hidden = state !== "choose";
    $("donate-card").hidden = state !== "card";
    $("donate-done").hidden = state !== "done";
  }

  function reset() {
    if (widget) widget.unmount();
    widget = null;
    checkoutId = null;
    show("choose");
    setStatus("");
    refreshButton();
  }

  async function confirmPaid(id) {
    // The widget's "success" is checked with SumUp before thanking the donor.
    for (const wait of [0, 1500, 3000]) {
      if (wait) await new Promise((r) => setTimeout(r, wait));
      try {
        const res = await fetch(`/api/donate?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = await res.json();
        if (data.status === "PAID") return true;
        if (data.status === "FAILED" || data.status === "EXPIRED") return false;
      } catch (e) {
        /* try again */
      }
    }
    return null;
  }

  function onResponse(type) {
    if (type === "sent") setStatus("Processing your payment…");
    else if (type === "auth-screen") setStatus("Please confirm the payment with your bank.");
    else if (type === "error") setStatus("Something went wrong with the card payment. No money was taken. Please try again.");
    else if (type === "fail") setStatus("The payment didn’t go through, so no money was taken. You can try again or use another card.");
    else if (type === "success") {
      const id = checkoutId;
      setStatus("Confirming your payment…");
      confirmPaid(id).then((paid) => {
        if (paid === false) {
          setStatus("The payment didn’t go through, so no money was taken. You can try again or use another card.");
          return;
        }
        if (widget) widget.unmount();
        widget = null;
        $("donate-done-text").textContent =
          paid === true
            ? `Your ${giftText()} has been received. May Allah reward you.`
            : `Thank you for your ${giftText()}. SumUp is still confirming the payment; you’ll get a receipt if you gave an email.`;
        show("done");
        setStatus("");
        $("donate-done").focus();
      });
    }
  }

  async function startCheckout(amount, fundId) {
    submit.disabled = true;
    setStatus("Opening the secure card form…");
    try {
      const [res] = await Promise.all([
        fetch("/api/donate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ amount, fund: fundId }),
        }),
        loadSdk(),
      ]);
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) throw new Error("Card donations aren’t switched on yet. Please give by bank transfer for now.");
      if (!res.ok || !data.checkoutId) throw new Error("The card form couldn’t be opened just now. Please try again in a moment.");
      checkoutId = data.checkoutId;
      chosen = data.amount;
      chosenFund = data.fund || fundId;
      $("donate-chosen").textContent = pounds(chosen);
      $("donate-chosen-fund").textContent = (FUNDS[chosenFund] || FUNDS.mosque).giving;
      show("card");
      setStatus("");
      widget = window.SumUpCard.mount({
        id: "sumup-card",
        checkoutId,
        onResponse,
        locale: "en-GB",
        currency: "GBP",
        amount: String(chosen),
        donateSubmitButton: true,
        showFooter: true,
      });
    } catch (e) {
      show("choose");
      setStatus(e.message);
    } finally {
      submit.disabled = false;
    }
  }

  // Shown as a placeholder until the mosque's SumUp key is in place.
  function setReady(ready) {
    form.classList.toggle("is-off", !ready);
    form.querySelectorAll("input, select, button").forEach((el) => (el.disabled = !ready));
    $("sumup-note").innerHTML = ready
      ? "Card payments are handled securely by SumUp. The mosque never sees your card details."
      : '<span class="placeholder-chip">Card donations to be switched on</span>';
    if (ready) refreshButton();
    else submit.textContent = "Donate";
  }

  function setupSumUp() {
    renderAmounts(false);
    setReady(false);
    if (sumup.enabled === false) return;
    // Card donations switch on by themselves once the SumUp key is added on Cloudflare.
    fetch("/api/donate", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { ready: false }))
      .then((data) => setReady(Boolean(data.ready)))
      .catch(() => setReady(false));
    form.addEventListener("change", (e) => {
      if (e.target.name === "amount") other.value = "";
      if (e.target === fund) refreshFund();
      refreshButton();
    });
    other.addEventListener("input", () => {
      if (other.value.trim()) form.querySelectorAll('input[name="amount"]').forEach((r) => (r.checked = false));
      refreshButton();
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!FUNDS[fund.value]) {
        setStatus("Please choose the type of donation: Mosque Fund, Zakat or Sadaqah.");
        fund.closest(".donate-type").classList.add("is-missing");
        fund.focus();
        return;
      }
      const amount = readAmount();
      if (!Number.isFinite(amount) || amount < MIN || amount > MAX) {
        setStatus(`Please choose an amount from £${MIN} to £${MAX.toLocaleString("en-GB")}.`);
        other.focus();
        return;
      }
      startCheckout(amount, fund.value);
    });
    $("donate-change").addEventListener("click", reset);
    $("donate-again").addEventListener("click", reset);
  }

  /* ---------- bank transfer ---------- */

  const digits = (v) => String(v).replace(/\D/g, "");

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
    // Guidance for the donor rather than a value to copy.
    { key: "reference", label: "Reference", note: true, optional: true },
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
        : `<span class="${f.note ? "bank__note" : "bank__value"}">${esc(shown)}</span>`;
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

  setupSumUp();
  renderBank();
})();
