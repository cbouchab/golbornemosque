/*
 * Golborne Mosque — the simple formatting News posts are written in.
 * Used on Cloudflare to show a post, and on the posting page for its preview,
 * so both always agree.
 *
 *   A blank line          starts a new paragraph
 *   ## Heading            a heading
 *   **bold**  *italic*
 *   [link text](https://…)
 *   - item                a bulleted list (one item per line)
 *
 * Everything is escaped first, so nothing typed into a post can become HTML
 * of its own.
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Links may go to web pages, email, phone, or elsewhere on this site.
const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;

function inline(text) {
  return escapeHtml(text)
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (whole, label, href) => {
      if (!SAFE_HREF.test(href)) return label;
      const external = /^https?:\/\//i.test(href);
      return `<a href="${href}"${external ? ' rel="noopener" target="_blank"' : ""}>${label}</a>`;
    })
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
}

export function renderBody(source) {
  const blocks = String(source || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim());
      const heading = /^#{1,3}\s+(.+)$/.exec(block);
      if (heading && lines.length === 1) return `<h2>${inline(heading[1])}</h2>`;
      if (lines.every((l) => /^[-*•]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .join("\n");
}

// The post as plain text, for summaries and link previews.
export function plainText(source) {
  return String(source || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// A short summary from the post's ordinary paragraphs (headings and lists read
// oddly run together), falling back to everything if there are none.
export function excerpt(source, max = 180) {
  const prose = String(source || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b && !/^#{1,3}\s/.test(b) && !b.split("\n").every((l) => /^[-*•]\s+/.test(l.trim())));
  const text = plainText(prose.length ? prose.join("\n\n") : source);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[\s,.;:–-]+$/, "")}…`;
}
