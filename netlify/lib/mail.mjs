// Mediation portal email v03 (2026-11-06). Every email goes through the Make webhook "Mediation portal - email" (5021786, Mandrill),
// always as type "notify" with an HTML body built here; Make passes the HTML and text straight to Mandrill.
// v03: one branded NYSVMS layout for every email (Tim asked that they look like official NYSVMS communications): navy header
// with the logo, a heading, short paragraphs, an optional details box and quote, a real button instead of a raw link, and a
// footer with the Society's address. Table-based with inline styles so it holds up in Outlook and Gmail. The sign-in code now
// uses the same layout (it used to be formatted inside Make). Links use PUBLIC_URL (mediation.nysvms.org).
// v02: notices carried an escaped HTML body. v01 (2026-11-04): copied from the treasurer portal.
// Every value placed in the HTML is escaped, so names and notes can't inject markup.
import { env } from "./core.mjs";

export const publicUrl = () => env("PUBLIC_URL", "https://mediation.nysvms.org").replace(/\/+$/, "");

async function send(payload) {
  const res = await fetch(env("CM_MAIL_WEBHOOK_URL"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: env("CM_WEBHOOK_SECRET"), ...payload })
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.sent !== true) throw new Error(`Email not sent (${res.status})`);
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NAVY = "#0a5a85", ACTION = "#0f7bb3", ACCENT = "#5778a2", BODY = "#333333", MUTED = "#555555", RULE = "#e4e8ec", SOFT = "#f6f8f9";
const FONT = "Helvetica, Arial, sans-serif";
const HEAD = "Roboto, Helvetica, Arial, sans-serif";

// A message: { eyebrow?, heading, greeting?, paras: [string], details?: [[label, value]], quote?: { label, text },
//   button?: { label, url }, after?: [string], code? } -> { html, text }. Strings are plain text.
export function render(m) {
  const p = (t, style = "") => `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${BODY};${style}">${esc(t).replace(/\n/g, "<br>")}</p>`;
  const rows = (m.details || []).filter(([, v]) => v !== undefined && v !== null && v !== "");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.heading)}</title></head>
<body style="margin:0;padding:0;background:${SOFT};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${SOFT};">${esc(m.preheader || m.paras?.[0] || "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SOFT};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${RULE};">
<tr><td style="background:${NAVY};padding:20px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td><img src="${publicUrl()}/assets/nysvms-logo-on-dark.png" width="190" alt="New York State Veterinary Medical Society" style="display:block;width:190px;max-width:100%;height:auto;border:0;color:#ffffff;font-family:${FONT};font-size:14px;"></td>
    <td align="right" style="font-family:${HEAD};font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#d6dfea;">Mediation</td>
  </tr></table>
</td></tr>
<tr><td style="padding:32px 28px 8px;">
  ${m.eyebrow ? `<p style="margin:0 0 8px;font-family:${HEAD};font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${ACCENT};">${esc(m.eyebrow)}</p>` : ""}
  <h1 style="margin:0 0 20px;font-family:${HEAD};font-size:26px;line-height:1.25;font-weight:500;color:${NAVY};">${esc(m.heading)}</h1>
  ${m.greeting ? p(m.greeting) : ""}
  ${(m.paras || []).map((t) => p(t)).join("")}
  ${m.code ? `<p style="margin:4px 0 20px;font-family:Menlo,Consolas,monospace;font-size:36px;font-weight:bold;letter-spacing:8px;color:${NAVY};">${esc(m.code)}</p>` : ""}
  ${rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;background:${SOFT};border:1px solid ${RULE};">
    ${rows.map(([k, v], i) => `<tr><td style="padding:10px 16px;${i ? `border-top:1px solid ${RULE};` : ""}font-family:${HEAD};font-size:13px;font-weight:bold;color:${MUTED};width:34%;vertical-align:top;">${esc(k)}</td><td style="padding:10px 16px;${i ? `border-top:1px solid ${RULE};` : ""}font-family:${FONT};font-size:15px;color:${BODY};vertical-align:top;">${esc(v)}</td></tr>`).join("")}
  </table>` : ""}
  ${m.quote ? `<p style="margin:0 0 6px;font-family:${HEAD};font-size:13px;font-weight:bold;color:${MUTED};">${esc(m.quote.label)}</p>
  <div style="margin:0 0 20px;padding:12px 16px;border-left:4px solid ${ACTION};background:${SOFT};font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY};">${esc(m.quote.text).replace(/\n/g, "<br>")}</div>` : ""}
  ${m.button ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td style="background:${ACTION};">
    <a href="${esc(m.button.url)}" style="display:inline-block;padding:14px 26px;font-family:${HEAD};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(m.button.label)}</a></td></tr></table>` : ""}
  ${(m.after || []).map((t) => p(t, `font-size:14px;color:${MUTED};`)).join("")}
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid ${RULE};background:${SOFT};font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
  <strong style="color:${NAVY};">New York State Veterinary Medical Society</strong><br>
  300 Great Oaks Blvd., Suite 314, Albany, NY 12203<br>
  <a href="mailto:staff@nysvms.org" style="color:${ACTION};">staff@nysvms.org</a> &nbsp;·&nbsp; (518) 869-7867 &nbsp;·&nbsp; <a href="${publicUrl()}" style="color:${ACTION};">mediation.nysvms.org</a>
</td></tr>
</table></td></tr></table></body></html>`;
  const text = [m.heading, "", m.greeting, m.greeting ? "" : null, ...(m.paras || []).flatMap((t) => [t, ""]), m.code ? `${m.code}\n` : null,
    ...rows.map(([k, v]) => `${k}: ${v}`), rows.length ? "" : null,
    m.quote ? `${m.quote.label}\n${m.quote.text}\n` : null,
    m.button ? `${m.button.label}: ${m.button.url}\n` : null,
    ...(m.after || []).flatMap((t) => [t, ""]),
    "New York State Veterinary Medical Society", "300 Great Oaks Blvd., Suite 314, Albany, NY 12203", "staff@nysvms.org · (518) 869-7867"]
    .filter((x) => x !== null && x !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
  return { html, text };
}

// people: [{ email, name }]; message: as render(). Never throws: a failed notice must not undo the change that triggered it.
export async function notify(people, subject, message) {
  const to = people.filter((p) => p.email);
  if (!to.length) return { sent: false, reason: "nobody to tell" };
  try {
    const { html, text } = render(message);
    await send({ type: "notify", to: to.map((p) => ({ email: p.email, name: p.name || "" })), subject, text, html });
    return { sent: true };
  } catch (e) {
    console.error("notify", e.message);
    return { sent: false, reason: e.message };
  }
}

// The sign-in code, in the same layout. (The code also travels as its own field, which Make ignores and tests read.)
export async function sendCode(to, name, code) {
  const first = String(name || "").trim().split(/\s+/)[0];
  const { html, text } = render({
    eyebrow: "Sign in", heading: "Your sign-in code", greeting: first ? `Hi ${first},` : "Hello,",
    paras: ["Here is your code to sign in to the NYSVMS mediation portal:"], code,
    after: ["It expires in 10 minutes. If you didn't ask for it, you can ignore this email."], preheader: `Your code is ${code}`
  });
  await send({ type: "notify", to: [{ email: to, name: name || "" }], subject: `Your NYSVMS Mediation sign-in code: ${code}`, text, html, code });
}
