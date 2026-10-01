#!/usr/bin/env node
/*
 * Copies Golborne Mosque's published prayer times from MyLocalMasjid into
 * data/timetable.js, which the website reads.
 *
 *   MLM_API_KEY=mlm_live_... node scripts/sync-prayer-times.mjs
 *
 * The API key stays on the computer (or GitHub Action) running this script and is
 * never put on the website. It fetches the current month and the next, so the
 * monthly timetable page has both. If anything goes wrong, data/timetable.js is
 * left as it was and the script exits with an error.
 *
 * Needs Node.js 18 or newer. No packages to install.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "timetable.js");
const API = (process.env.MLM_API_BASE || "https://api.mylocalmasjid.com").replace(/\/+$/, "");
const KEY = (process.env.MLM_API_KEY || "").trim();

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// Runs a browser-style script (`window.X = ...`) and returns its window object.
async function loadWindowScript(file) {
  const src = await readFile(file, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { filename: file });
  return sandbox.window;
}

function todayIn(timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const dateOnly = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

// "05:30", "05:30:00" or "5:30 AM" → "05:30". Anything else → null.
function hhmm(value) {
  if (value == null) return null;
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3]) {
    const pm = /p/i.test(m[3]);
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

async function api(pathname, params) {
  const url = new URL(API + pathname);
  for (const [k, v] of Object.entries(params || {})) if (v != null) url.searchParams.set(k, String(v));
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json", "User-Agent": "golborne-mosque-website" },
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    throw new Error(`couldn't reach ${url.host} (${e.message})`);
  }
  if (!res.ok) {
    let detail = "";
    try {
      const problem = await res.json();
      detail = [problem.code, problem.detail || problem.title].filter(Boolean).join(": ");
    } catch {
      /* not JSON */
    }
    const hint = {
      401: "the API key is missing or wrong",
      403: "this API key isn't allowed to read this data",
      404: "the masjid id in js/config.js wasn't found",
      429: "the API's request limit was reached; try again later",
    }[res.status];
    throw new Error(`${res.status} from ${url.pathname}${hint ? `: ${hint}` : ""}${detail ? ` (${detail})` : ""}`);
  }
  return res.json();
}

async function main() {
  const config = (await loadWindowScript(path.join(ROOT, "js", "config.js"))).MOSQUE_CONFIG;
  const mlm = config.myLocalMasjid || {};
  if (!KEY) fail("MLM_API_KEY is not set. See \"Prayer times from MyLocalMasjid\" in README.md.");
  if (!mlm.id) fail("myLocalMasjid.id is missing from js/config.js.");

  // This month and next month (at most 62 days, the API's limit for one request).
  const t = todayIn(config.location.timeZone);
  const from = iso(t.y, t.m, 1);
  const last = new Date(Date.UTC(t.y, t.m + 1, 0));
  const to = iso(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate());

  let times;
  let special;
  try {
    [times, special] = await Promise.all([
      api(`/v1/masjids/${mlm.id}/prayer-times`, { start_date: from, end_date: to, limit: 62 }),
      api(`/v1/masjids/${mlm.id}/special-prayers`, { type: "jummuah" }),
    ]);
  } catch (e) {
    fail(`MyLocalMasjid request failed: ${e.message}. data/timetable.js was not changed.`);
  }

  const days = {};
  let lastUpdated = null;
  for (const r of (times && times.data) || []) {
    const date = r && dateOnly(r.date);
    if (!date || r.active === false) continue;
    const start = {
      fajr: hhmm(r.fajr_start),
      sunrise: hhmm(r.sunrise),
      dhuhr: hhmm(r.dhur_start),
      asr: hhmm(r.asr_start),
      maghrib: hhmm(r.magrib_start),
      isha: hhmm(r.isha_start),
    };
    const iqamah = {
      fajr: hhmm(r.fajr_jammat),
      dhuhr: hhmm(r.dhur_jammat),
      asr: hhmm(r.asr_jammat),
      maghrib: hhmm(r.magrib_jammat),
      isha: hhmm(r.isha_jammat),
    };
    if (!Object.values(start).some(Boolean) && !Object.values(iqamah).some(Boolean)) continue;
    days[date] = { start, iqamah, hijri: r.hijri_date || null };
    if (r.last_updated && (!lastUpdated || r.last_updated > lastUpdated)) lastUpdated = r.last_updated;
  }

  const count = Object.keys(days).length;
  if (count === 0) {
    fail(`MyLocalMasjid returned no prayer times for ${from} to ${to}. Keeping the previous data/timetable.js.`);
  }

  const jumuah = ((special && special.data) || [])
    .filter((j) => j && j.is_active !== false && /^jum/i.test(j.type || ""))
    .map((j) => ({
      label: j.label || "",
      khutbah: hhmm(j.start_time),
      iqamah: hhmm(j.jammat_time),
      from: dateOnly(j.start_date),
      to: dateOnly(j.end_date),
    }))
    .filter((j) => j.khutbah || j.iqamah)
    .sort((a, b) => (a.iqamah || a.khutbah).localeCompare(b.iqamah || b.khutbah));

  const sortedDays = Object.fromEntries(Object.keys(days).sort().map((k) => [k, days[k]]));
  const data = {
    source: "MyLocalMasjid",
    masjidId: mlm.id,
    masjidUrl: mlm.url || null,
    lastUpdated,
    range: { from, to },
    days: sortedDays,
    jumuah,
  };

  // Only rewrite the file when the times changed, so a scheduled job doesn't commit every run.
  let previous = null;
  try {
    previous = (await loadWindowScript(OUT)).MOSQUE_TIMETABLE;
  } catch {
    /* no previous file */
  }
  if (previous) {
    const { fetchedAt, ...rest } = previous;
    if (JSON.stringify(rest) === JSON.stringify(data)) {
      console.log(`✓ Already up to date: ${count} days, ${from} to ${to}.`);
      return;
    }
  }

  data.fetchedAt = new Date().toISOString();
  const file =
    `/*\n` +
    ` * Golborne Mosque — prayer times published by the mosque on MyLocalMasjid.\n` +
    ` * Generated by scripts/sync-prayer-times.mjs (see README). Do not edit by hand.\n` +
    ` * Powered by MyLocalMasjid${mlm.url ? ` — ${mlm.url}` : ""}\n` +
    ` */\n` +
    `window.MOSQUE_TIMETABLE = ${JSON.stringify(data, null, 2)};\n`;
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, file);

  const missing = Object.values(days).filter((d) => Object.values(d.iqamah).every((v) => !v)).length;
  console.log(`✓ Saved ${count} days of prayer times (${from} to ${to}) to data/timetable.js.`);
  console.log(`  Jumu'ah sessions: ${jumuah.length || "none published"}.`);
  if (missing) console.log(`  ${missing} day(s) have no iqamah times.`);
  if (lastUpdated) console.log(`  Last updated on MyLocalMasjid: ${lastUpdated}.`);
}

main().catch((e) => fail(e.stack || e.message));
