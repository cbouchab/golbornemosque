/*
 * Golborne Mosque — emails a volunteer sign-up to the mosque's inbox.
 * Not published as a file: Cloudflare bundles it into functions/api/volunteer.js.
 *
 * Goes through the mosque's own Microsoft 365 (Microsoft Graph), so it's the
 * info@ mailbox sending to itself: no outside mail service, no DNS changes, and
 * nothing for spam filters to doubt. Replying goes straight to the volunteer.
 *
 * Needs an app registered in Microsoft Entra (README → Volunteer sign-ups):
 * M365_TENANT_ID, M365_CLIENT_ID and the secret M365_CLIENT_SECRET.
 */

const INBOX = "info@golbornemosque.org";
const SITE = "https://golbornemosque.org";

export const mailConfigured = (env) => Boolean(env.M365_TENANT_ID && env.M365_CLIENT_ID && env.M365_CLIENT_SECRET);

async function accessToken(env) {
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(env.M365_TENANT_ID)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.M365_CLIENT_ID,
      client_secret: env.M365_CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const data = await res.json().catch(() => ({}));
  // Only Microsoft's error code is reported: never the request, which holds the secret.
  if (!res.ok || !data.access_token) throw new Error(`Microsoft sign-in failed (${res.status} ${data.error || "no token"})`);
  return data.access_token;
}

// v: { firstName, lastName, email, phone, interests }, already checked by the form's handler.
export function signUpMessage(v) {
  const name = `${v.firstName} ${v.lastName}`.replace(/\s+/g, " ").trim();
  return {
    subject: `Volunteer sign-up: ${name}`,
    body: {
      contentType: "Text",
      content: [
        "Someone has registered as a volunteer on the website.",
        "",
        `Name: ${name}`,
        `Email: ${v.email}`,
        `Phone: ${v.phone || "Not given"}`,
        "",
        "Interested in:",
        v.interests || "Not given",
        "",
        "Reply to this email to answer them directly.",
        `All sign-ups are also at ${SITE}/admin`,
      ].join("\n"),
    },
    toRecipients: [{ emailAddress: { address: INBOX } }],
    replyTo: [{ emailAddress: { address: v.email, name } }],
  };
}

// Resolves once Microsoft has accepted the email; throws if it hasn't.
export async function emailSignUp(env, v) {
  const token = await accessToken(env);
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(INBOX)}/sendMail`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ message: signUpMessage(v), saveToSentItems: false }),
  });
  if (res.status !== 202) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Microsoft didn't accept the email (${res.status} ${(data.error && data.error.code) || ""})`.trim());
  }
}
