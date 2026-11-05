/*
 * Golborne Mosque — card donations through SumUp's payment widget.
 *
 * Runs on Cloudflare (Pages Functions), so the mosque's SumUp API key never
 * reaches the browser. It is read from the SUMUP_API_KEY secret (see README →
 * Donations by card).
 *
 *   GET  /api/donate                    → { ready }  whether a key is set (the page switches on by itself)
 *   POST /api/donate  { amount, fund }  → { checkoutId }  creates a SumUp checkout (fund: mosque, zakat or sadaqah)
 *   GET  /api/donate?id=…               → { status, amount }  checks a checkout
 *
 * The page mounts SumUp's card form with the checkout id; the card details go
 * straight from the donor's browser to SumUp.
 */

const API = "https://api.sumup.com/v0.1";
const MIN = 1;
const MAX = 5000;

// The type of donation the donor picks. Its description and reference go into
// SumUp with the payment, so the mosque can tell Zakat apart from other giving.
// The keys must match the <select id="donate-fund"> values in index.html.
const FUNDS = {
  mosque: { description: "Mosque Fund - Golborne Mosque", reference: "mosque" },
  zakat: { description: "Zakat - Golborne Mosque", reference: "zakat" },
  sadaqah: { description: "Sadaqah - Golborne Mosque", reference: "sadaqah" },
};

let merchantCodeCache = null;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function sumup(env, path, init = {}) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${env.SUMUP_API_KEY}`, "content-type": "application/json", ...(init.headers || {}) },
  });
}

// The merchant code can be set as SUMUP_MERCHANT_CODE; otherwise it is looked up once with the API key.
async function merchantCode(env) {
  if (env.SUMUP_MERCHANT_CODE) return env.SUMUP_MERCHANT_CODE;
  if (merchantCodeCache) return merchantCodeCache;
  const res = await sumup(env, "/me");
  if (!res.ok) throw new Error(`SumUp /me answered ${res.status}`);
  const me = await res.json();
  const code = (me.merchant_profile && me.merchant_profile.merchant_code) || me.merchant_code;
  if (!code) throw new Error("SumUp /me returned no merchant code");
  merchantCodeCache = code;
  return code;
}

// Only this website may create checkouts.
function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch (e) {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.SUMUP_API_KEY) return json({ error: "not-configured" }, 503);
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "bad-request" }, 400);
  }
  const amount = Math.round(Number(body && body.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < MIN || amount > MAX) {
    return json({ error: "amount", min: MIN, max: MAX }, 400);
  }
  // A page still running a script from before the type list existed sends no
  // fund. Its donation goes through, labelled plainly rather than guessed.
  const fundId = body.fund == null || body.fund === "" ? null : String(body.fund);
  if (fundId !== null && !Object.prototype.hasOwnProperty.call(FUNDS, fundId)) {
    return json({ error: "fund", funds: Object.keys(FUNDS) }, 400);
  }
  const fund = fundId ? FUNDS[fundId] : { description: "Donation - Golborne Mosque", reference: "donation" };

  try {
    const res = await sumup(env, "/checkouts", {
      method: "POST",
      body: JSON.stringify({
        checkout_reference: `${fund.reference}-${crypto.randomUUID()}`,
        amount,
        currency: "GBP",
        merchant_code: await merchantCode(env),
        description: fund.description,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) {
      console.error("SumUp checkout failed", res.status, JSON.stringify(data).slice(0, 300));
      return json({ error: "sumup" }, 502);
    }
    return json({ checkoutId: data.id, amount, fund: fundId });
  } catch (e) {
    console.error("SumUp checkout error", e && e.message);
    return json({ error: "sumup" }, 502);
  }
}

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id");
  if (id === null) return json({ ready: Boolean(env.SUMUP_API_KEY) });
  if (!env.SUMUP_API_KEY) return json({ error: "not-configured" }, 503);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return json({ error: "bad-request" }, 400);
  try {
    const res = await sumup(env, `/checkouts/${encodeURIComponent(id)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: "sumup" }, 502);
    // Only what the page needs to thank the donor.
    return json({ status: data.status, amount: data.amount });
  } catch (e) {
    return json({ error: "sumup" }, 502);
  }
}
