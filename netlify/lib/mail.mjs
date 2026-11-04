// Complaints portal email v01 (2026-11-04). Copied from the treasurer portal. All email goes through the Make webhook "Complaints portal - email"
// (Mandrill). type "code" is a sign-in code; type "notify" is a plain message to one or more people.
// v02: notices carry an escaped HTML body built here, so names and notes can't inject markup.
import { env } from "./core.mjs";

async function send(payload) {
  const res = await fetch(env("CM_MAIL_WEBHOOK_URL"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: env("CM_WEBHOOK_SECRET"), ...payload })
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.sent !== true) throw new Error(`Email not sent (${res.status})`);
}

export const sendCode = (to, name, code) => send({ type: "code", to, name, firstName: String(name || "").split(" ")[0] || "", code });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Plain text to a simple HTML email: escaped, line breaks kept, the portal link made clickable.
export function toHtml(text) {
  const body = esc(text).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0f7bb3;">$1</a>').replace(/\n/g, "<br>");
  return `<div style="max-width:560px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#333333;font-size:16px;line-height:1.6;padding:24px 20px;">${body}</div>`;
}

// people: [{ email, name }]. Never throws: a failed notice must not undo the change that triggered it.
export async function notify(people, subject, text) {
  const to = people.filter((p) => p.email);
  if (!to.length) return { sent: false, reason: "nobody to tell" };
  try {
    await send({ type: "notify", to: to.map((p) => ({ email: p.email, name: p.name || "" })), subject, text, html: toHtml(text) });
    return { sent: true };
  } catch (e) {
    console.error("notify", e.message);
    return { sent: false, reason: e.message };
  }
}
