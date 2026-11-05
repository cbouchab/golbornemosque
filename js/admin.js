/*
 * Golborne Mosque — the admin page (/admin): sign in, then write, edit and
 * delete News posts, and see volunteer sign-ups. Talks to /api/admin
 * (functions/api/admin).
 */
import { renderBody, escapeHtml as esc } from "./news-format.js";

const $ = (id) => document.getElementById(id);
const VIEWS = ["admin-loading", "view-setup", "view-login", "view-list", "view-editor", "view-volunteers"];
const SIGNED_IN_VIEWS = ["view-list", "view-editor", "view-volunteers"];
const MAX_SIDE = 1600; // photos are resized to at most this many pixels across

const longDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const todayInLondon = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function show(id) {
  for (const v of VIEWS) $(v).hidden = v !== id;
  const inside = SIGNED_IN_VIEWS.includes(id);
  $("sign-out").hidden = !inside;
  $("admin-tabs").hidden = !inside;
  $("tab-news").setAttribute("aria-pressed", String(id === "view-list" || id === "view-editor"));
  $("tab-volunteers").setAttribute("aria-pressed", String(id === "view-volunteers"));
  window.scrollTo(0, 0);
  const heading = $(id).querySelector("h1");
  if (heading) heading.focus({ preventScroll: true });
}

/* ---------- talking to Cloudflare ---------- */

class Handled extends Error {}

let signedIn = false;
// The latest view asked for: a slow earlier request mustn't switch the page back.
let viewRequest = 0;

const MESSAGES = {
  "wrong-password": "That password isn’t right.",
  "too-many": "Too many wrong passwords. Please wait 15 minutes and try again.",
  forbidden: "This request was blocked. Please reload the page and try again.",
  "not-found": "That post no longer exists.",
};

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(path, { credentials: "same-origin", ...options, headers: { accept: "application/json", ...(options.headers || {}) } });
  } catch (e) {
    throw new Error("Couldn’t reach the website. Check the internet connection and try again.");
  }
  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    /* not JSON */
  }
  if (res.status === 503 && data.error === "not-configured") {
    show("view-setup");
    throw new Handled();
  }
  if (res.status === 401 && data.error === "signed-out") {
    // Only say "again" to someone whose session ran out while working.
    $("login-error").textContent = signedIn ? "Please sign in again." : "";
    signedIn = false;
    dirty = false;
    show("view-login");
    throw new Handled();
  }
  if (!res.ok) throw new Error(data.message || MESSAGES[data.error] || `Something went wrong (${res.status}). Please try again.`);
  return data;
}

function report(el, error) {
  if (error instanceof Handled) return;
  el.textContent = error.message;
}

/* ---------- signing in and out ---------- */

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const error = $("login-error");
  error.textContent = "";
  const button = e.submitter || e.target.querySelector("button");
  button.disabled = true;
  try {
    await api("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: $("login-password").value }),
    });
    $("login-password").value = "";
    await openList();
  } catch (err) {
    report(error, err);
  } finally {
    button.disabled = false;
  }
});

$("sign-out").addEventListener("click", async () => {
  if (dirty && !confirm("Leave without saving this post?")) return;
  dirty = false;
  try {
    await api("/api/admin/logout", { method: "POST" });
  } catch (e) {
    /* signed out locally either way */
  }
  signedIn = false;
  $("login-error").textContent = "";
  show("view-login");
});

/* ---------- the list of posts ---------- */

function notice(html) {
  const el = $("list-status");
  el.innerHTML = html || "";
  el.hidden = !html;
}

async function openList(message) {
  const request = ++viewRequest;
  const data = await api("/api/admin/posts");
  if (request !== viewRequest) return;
  const list = $("post-list");
  list.innerHTML = data.posts
    .map((p) => {
      const thumb = p.image
        ? `<img src="${esc(p.image.url)}" alt="" width="${p.image.width}" height="${p.image.height}" loading="lazy">`
        : `<img class="admin-post__mark" src="/assets/symbol.svg" alt="" width="30" height="38">`;
      return (
        `<li class="admin-post">` +
        `<div class="admin-post__thumb">${thumb}</div>` +
        `<div class="admin-post__info"><p class="admin-post__title">${esc(p.title)}</p>` +
        `<p class="admin-post__meta">${esc(longDate(p.date))}${p.published ? "" : ' · <span class="admin-badge">Draft</span>'}</p></div>` +
        `<div class="admin-post__actions">` +
        `<button class="btn btn--line btn--small" type="button" data-edit="${p.id}">Edit</button>` +
        `<a class="link-btn" href="/news/${esc(p.slug)}" target="_blank" rel="noopener">View</a>` +
        `</div></li>`
      );
    })
    .join("");
  $("list-empty").hidden = data.posts.length > 0;
  signedIn = true;
  notice(message);
  show("view-list");
  loadVolunteers().catch(() => {}); // just for the count on the Volunteers tab
}

/* ---------- volunteer sign-ups ---------- */

let volunteers = [];

const signedUp = (iso) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

async function loadVolunteers() {
  volunteers = (await api("/api/admin/volunteers")).volunteers;
  $("volunteer-count").textContent = volunteers.length ? ` (${volunteers.length})` : "";
  $("volunteer-list").innerHTML = volunteers
    .map((v) => {
      const name = `${v.firstName} ${v.lastName}`;
      return (
        `<li class="admin-volunteer">` +
        `<div class="admin-volunteer__head"><p class="admin-post__title">${esc(name)}</p>` +
        `<p class="admin-post__meta">${esc(signedUp(v.createdAt))}</p></div>` +
        `<p class="admin-volunteer__contact"><a href="mailto:${esc(v.email)}">${esc(v.email)}</a>` +
        (v.phone ? ` · <a href="tel:${esc(v.phone.replace(/[^0-9+]/g, ""))}">${esc(v.phone)}</a>` : "") +
        `</p>` +
        (v.interests ? `<p class="admin-volunteer__interests">${esc(v.interests)}</p>` : "") +
        `<button class="link-btn link-btn--danger" type="button" data-remove="${v.id}">Remove</button>` +
        `</li>`
      );
    })
    .join("");
  $("volunteers-empty").hidden = volunteers.length > 0;
  $("volunteers-csv").hidden = volunteers.length === 0;
}

async function openVolunteers(message) {
  if (dirty && !confirm("Leave without saving this post?")) return;
  dirty = false;
  const request = ++viewRequest;
  await loadVolunteers();
  if (request !== viewRequest) return;
  const status = $("volunteers-status");
  status.textContent = message || "";
  status.hidden = !message;
  show("view-volunteers");
}

$("tab-volunteers").addEventListener("click", () => openVolunteers().catch((err) => report($("volunteers-status"), err)));
$("tab-news").addEventListener("click", () => {
  if (!$("view-volunteers").hidden) openList().catch((err) => report($("list-status"), err));
});

$("volunteer-list").addEventListener("click", async (e) => {
  const button = e.target.closest("[data-remove]");
  if (!button) return;
  const v = volunteers.find((x) => String(x.id) === button.dataset.remove);
  if (!v || !confirm(`Remove ${v.firstName} ${v.lastName}’s sign-up? This can’t be undone.`)) return;
  try {
    await api(`/api/admin/volunteers/${v.id}`, { method: "DELETE" });
    await openVolunteers(`${v.firstName} ${v.lastName}’s sign-up was removed.`);
  } catch (err) {
    const status = $("volunteers-status");
    report(status, err);
    status.hidden = false;
  }
});

// A spreadsheet (CSV) of every sign-up, for Excel, Numbers or Google Sheets.
$("volunteers-csv").addEventListener("click", () => {
  const cell = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
  const rows = [["Signed up", "First name", "Last name", "Email", "Phone", "Interested in"]].concat(
    volunteers.map((v) => [signedUp(v.createdAt), v.firstName, v.lastName, v.email, v.phone, v.interests])
  );
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `volunteers-${todayInLondon()}.csv`;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
});

$("post-list").addEventListener("click", (e) => {
  const button = e.target.closest("[data-edit]");
  if (button) openEditor(Number(button.dataset.edit)).catch((err) => report($("list-status"), err));
});
$("new-post").addEventListener("click", () => openEditor(null));

/* ---------- the editor ---------- */

let editing = null; // the post being edited, or null for a new one
let photo = null; // a newly chosen photo: { blob, width, height, url }
let removePhoto = false;
let dirty = false;

function resetPhoto() {
  if (photo) URL.revokeObjectURL(photo.url);
  photo = null;
  removePhoto = false;
  $("f-photo").value = "";
}

function showPhoto(src, width, height) {
  const img = $("photo-preview");
  if (src) {
    img.src = src;
    img.width = width;
    img.height = height;
  } else {
    img.removeAttribute("src");
  }
  img.hidden = !src;
  $("photo-remove").hidden = !src;
  $("alt-field").hidden = !src;
  $("photo-choose-label").textContent = src ? "Choose a different photo" : "Choose a photo";
}

function updateSaveLabel() {
  const published = $("f-published").checked;
  $("save").textContent = editing ? (published ? "Save changes" : "Save draft") : published ? "Publish" : "Save draft";
}

async function openEditor(id) {
  ++viewRequest;
  resetPhoto();
  $("form-error").textContent = "";
  setTab(false);
  let post = { title: "", date: todayInLondon(), body: "", published: true, image: null, imageAlt: "" };
  if (id) post = (await api(`/api/admin/posts/${id}`)).post;
  editing = id ? post : null;

  $("editor-title").textContent = id ? "Edit post" : "New post";
  $("f-title").value = post.title;
  $("f-date").value = post.date;
  $("f-body").value = post.body;
  $("f-published").checked = post.published;
  $("f-alt").value = post.imageAlt || "";
  showPhoto(post.image && post.image.url, post.image && post.image.width, post.image && post.image.height);
  resetGallery(post.gallery);
  $("delete").hidden = !id;
  updateSaveLabel();
  dirty = false;
  show("view-editor");
}

function leaveEditor() {
  if (dirty && !confirm("Leave without saving this post?")) return;
  dirty = false;
  resetPhoto();
  resetGallery([]);
  openList().catch((err) => report($("form-error"), err));
}
$("editor-back").addEventListener("click", leaveEditor);
$("cancel").addEventListener("click", leaveEditor);

$("post-form").addEventListener("input", () => (dirty = true));
$("f-published").addEventListener("change", updateSaveLabel);
window.addEventListener("beforeunload", (e) => {
  if (dirty) e.preventDefault();
});

/* Photos: resized in the browser (at most 1600px across), as WebP where the
   browser can make it, otherwise JPEG. */

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decode(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
      /* fall back to an <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function resize(file) {
  const source = await decode(file);
  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  if (source.close) source.close();

  let blob = await canvasBlob(canvas, "image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await canvasBlob(canvas, "image/jpeg", 0.85);
  if (blob && blob.size > 1500000) blob = await canvasBlob(canvas, "image/jpeg", 0.7);
  if (!blob) throw new Error("This photo couldn’t be prepared. Please try a JPEG or PNG.");
  return { blob, width, height, url: URL.createObjectURL(blob) };
}

$("f-photo").addEventListener("change", async () => {
  const file = $("f-photo").files[0];
  if (!file) return;
  $("form-error").textContent = "";
  $("photo-note").textContent = "Preparing the photo…";
  try {
    const ready = await resize(file);
    if (photo) URL.revokeObjectURL(photo.url);
    photo = ready;
    removePhoto = false;
    showPhoto(photo.url, photo.width, photo.height);
    dirty = true;
    $("photo-note").textContent = `Ready: ${photo.width} × ${photo.height}, ${Math.round(photo.blob.size / 1024)} KB.`;
  } catch (err) {
    $("photo-note").textContent = "It’s resized automatically before uploading.";
    $("form-error").textContent = err.message || "This photo couldn’t be opened. Please try a JPEG or PNG.";
  }
});

$("photo-remove").addEventListener("click", () => {
  resetPhoto();
  removePhoto = true;
  showPhoto(null);
  $("photo-note").textContent = "It’s resized automatically before uploading.";
  dirty = true;
});

/* More photos: a small gallery under the text, in the order they're added. */

const MAX_GALLERY = 8;
let gallery = []; // each { keep: id, url, … } (already saved) or { blob, url, … } (new)

function resetGallery(list) {
  for (const g of gallery) if (g.blob) URL.revokeObjectURL(g.url);
  gallery = (list || []).map((g) => ({ keep: g.id, url: g.url, width: g.width, height: g.height, alt: g.alt || "" }));
  $("f-gallery").value = "";
  renderGallery();
}

function renderGallery() {
  $("gallery-list").innerHTML = gallery
    .map(
      (g, i) =>
        `<li class="gallery-pick__item">` +
        `<img src="${esc(g.url)}" alt="" width="${g.width}" height="${g.height}">` +
        `<input data-gallery-alt="${i}" maxlength="300" value="${esc(g.alt)}" placeholder="Describe this photo" aria-label="Description of photo ${i + 1}">` +
        `<button class="link-btn link-btn--danger" type="button" data-gallery-remove="${i}">Remove</button>` +
        `</li>`
    )
    .join("");
  $("gallery-note").textContent =
    gallery.length >= MAX_GALLERY
      ? `That’s the most a post can have (${MAX_GALLERY}).`
      : "Up to 8. Each one is resized automatically before uploading.";
}

$("f-gallery").addEventListener("change", async () => {
  const files = Array.from($("f-gallery").files).slice(0, MAX_GALLERY - gallery.length);
  $("f-gallery").value = "";
  if (!files.length) return;
  $("form-error").textContent = "";
  for (const [n, file] of files.entries()) {
    $("gallery-note").textContent = `Preparing photo ${n + 1} of ${files.length}…`;
    try {
      gallery.push({ ...(await resize(file)), alt: "" });
    } catch (err) {
      $("form-error").textContent = `${file.name} couldn’t be opened. Please try a JPEG or PNG.`;
    }
  }
  dirty = true;
  renderGallery();
});

$("gallery-list").addEventListener("input", (e) => {
  const i = e.target.dataset.galleryAlt;
  if (i != null && gallery[i]) gallery[i].alt = e.target.value;
});

$("gallery-list").addEventListener("click", (e) => {
  const button = e.target.closest("[data-gallery-remove]");
  if (!button) return;
  const [removed] = gallery.splice(Number(button.dataset.galleryRemove), 1);
  if (removed && removed.blob) URL.revokeObjectURL(removed.url);
  dirty = true;
  renderGallery();
});

/* Formatting buttons: they type the simple formatting for you. */

const body = $("f-body");

function replaceSelection(text, selectFrom, selectTo) {
  const start = body.selectionStart;
  body.focus();
  body.setRangeText(text, start, body.selectionEnd, "end");
  if (selectFrom != null) body.setSelectionRange(start + selectFrom, start + selectTo);
  body.dispatchEvent(new Event("input", { bubbles: true }));
}

function selectedLines() {
  const value = body.value;
  const start = value.lastIndexOf("\n", body.selectionStart - 1) + 1;
  let end = value.indexOf("\n", body.selectionEnd);
  if (end === -1) end = value.length;
  body.setSelectionRange(start, end);
  return value.slice(start, end);
}

const FORMATS = {
  bold() {
    const text = body.value.slice(body.selectionStart, body.selectionEnd) || "bold text";
    replaceSelection(`**${text}**`, 2, 2 + text.length);
  },
  italic() {
    const text = body.value.slice(body.selectionStart, body.selectionEnd) || "italic text";
    replaceSelection(`*${text}*`, 1, 1 + text.length);
  },
  link() {
    const start = body.selectionStart;
    const end = body.selectionEnd;
    let text = body.value.slice(start, end).trim();
    const address = (prompt("Web address for the link (or an email address):", "https://") || "").trim();
    if (!address || address === "https://") return body.focus();
    const href = /^[^\s@/]+@[^\s@]+\.[^\s@]+$/.test(address)
      ? `mailto:${address}`
      : /^www\./i.test(address)
        ? `https://${address}`
        : address;
    if (!text) text = (prompt("Words to show for the link:", address) || address).trim();
    body.setSelectionRange(start, end);
    replaceSelection(`[${text}](${href})`);
  },
  heading() {
    const line = selectedLines().replace(/^#{1,3}\s*/, "") || "Heading";
    replaceSelection(`## ${line}`, 3, 3 + line.length);
  },
  list() {
    const lines = selectedLines();
    replaceSelection(
      lines
        .split("\n")
        .map((l) => (/^[-*•]\s+/.test(l) ? l : `- ${l}`))
        .join("\n")
    );
  },
};

$("toolbar").addEventListener("click", (e) => {
  const button = e.target.closest("[data-format]");
  if (!button) return;
  setTab(false);
  FORMATS[button.dataset.format]();
});

function setTab(preview) {
  $("tab-write").setAttribute("aria-pressed", String(!preview));
  $("tab-preview").setAttribute("aria-pressed", String(preview));
  body.hidden = preview;
  $("toolbar").hidden = preview;
  const box = $("body-preview");
  box.hidden = !preview;
  if (preview) box.innerHTML = renderBody(body.value) || '<p class="admin-empty">Nothing written yet.</p>';
}
$("tab-write").addEventListener("click", () => setTab(false));
$("tab-preview").addEventListener("click", () => setTab(true));

/* Saving and deleting */

$("post-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const error = $("form-error");
  error.textContent = "";
  const title = $("f-title").value.trim();
  if (!title) {
    error.textContent = "Please give the post a title.";
    $("f-title").focus();
    return;
  }

  const form = new FormData();
  form.set("title", title);
  form.set("date", $("f-date").value || todayInLondon());
  form.set("body", body.value);
  form.set("published", $("f-published").checked ? "1" : "0");
  form.set("image_alt", $("f-alt").value.trim());
  if (photo) {
    const ext = photo.blob.type === "image/webp" ? "webp" : "jpg";
    form.set("image", photo.blob, `photo.${ext}`);
    form.set("image_width", String(photo.width));
    form.set("image_height", String(photo.height));
  } else if (removePhoto) {
    form.set("remove_image", "1");
  }
  const entries = gallery.map((g, i) => {
    if (!g.blob) return { keep: g.keep, alt: g.alt.trim() };
    const field = `gallery_${i}`;
    form.set(field, g.blob, `photo-${i + 1}.${g.blob.type === "image/webp" ? "webp" : "jpg"}`);
    return { file: field, width: g.width, height: g.height, alt: g.alt.trim() };
  });
  form.set("gallery", JSON.stringify(entries));

  const save = $("save");
  save.disabled = true;
  try {
    const { post } = await api(editing ? `/api/admin/posts/${editing.id}` : "/api/admin/posts", {
      method: editing ? "PUT" : "POST",
      body: form,
    });
    dirty = false;
    resetPhoto();
    resetGallery([]);
    const link = `<a href="/news/${esc(post.slug)}" target="_blank" rel="noopener">View the post</a>`;
    await openList(post.published ? `Saved and on the website. ${link}.` : `Saved as a draft: only you can see it. ${link}.`);
  } catch (err) {
    report(error, err);
  } finally {
    save.disabled = false;
  }
});

$("delete").addEventListener("click", async () => {
  if (!editing || !confirm(`Delete “${editing.title}”? This can’t be undone.`)) return;
  try {
    await api(`/api/admin/posts/${editing.id}`, { method: "DELETE" });
    dirty = false;
    resetPhoto();
    resetGallery([]);
    await openList("The post was deleted.");
  } catch (err) {
    report($("form-error"), err);
  }
});

/* ---------- start ---------- */

openList().catch((err) => {
  if (err instanceof Handled) return;
  $("admin-loading").textContent = err.message;
});
