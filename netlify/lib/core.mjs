// Mediation portal server core v01 (2026-11-04). Responses, request checks and signed values. Copied from the treasurer portal.
// Adapted from the volunteer portal's core (no Novi sign-in, no View as). The session is a signed cookie holding
// the person's email; their role is re-read from Portal Users on every request (access.mjs).
import { createHmac, timingSafeEqual } from "node:crypto";

export const env = (k, fallback) => {
  const v = globalThis.Netlify?.env.get(k) ?? process.env[k];
  if (v) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing setting ${k}`);
};

export const SESSION_COOKIE = "cm_session";
const SESSION_HOURS = 8;

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers }
  });
}

export function redirect(location) {
  return new Response(null, { status: 302, headers: { location, "cache-control": "no-store" } });
}

// Every state-changing call must be same-origin JSON with our header.
export function checkPost(req) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (req.headers.get("x-cm-request") !== "1") return json({ error: "Bad request" }, 400);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(req.url).host) return json({ error: "Bad origin" }, 403);
  return null;
}

export async function body(req) {
  return req.json().catch(() => ({}));
}

// ---- signed values (session cookie and upload tickets) ----
const b64 = (s) => Buffer.from(s).toString("base64url");
const unb64 = (s) => Buffer.from(s, "base64url").toString("utf8");
const mac = (s) => createHmac("sha256", env("SESSION_SECRET")).update(s).digest("base64url");
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function seal(obj) {
  const b = b64(JSON.stringify(obj));
  return `${b}.${mac(b)}`;
}

export function unseal(value) {
  if (!value) return null;
  const [b, sig] = String(value).split(".");
  if (!b || !sig || !same(sig, mac(b))) return null;
  try {
    const obj = JSON.parse(unb64(b));
    return obj.exp && obj.exp > Date.now() ? obj : null;
  } catch {
    return null;
  }
}

export function readCookie(req, name) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

const cookie = (name, value, seconds) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;

export const sessionCookie = (email) =>
  cookie(SESSION_COOKIE, seal({ email, exp: Date.now() + SESSION_HOURS * 3600e3 }), SESSION_HOURS * 3600);
export const clearSession = cookie(SESSION_COOKIE, "", 0);

// The signed-in email, or null. Who that person is (and whether they still have access) is access.mjs's job.
export function sessionEmail(req) {
  const s = unseal(readCookie(req, SESSION_COOKIE));
  return s && s.email ? s.email : null;
}

// ---- View as (docs/admin-and-view-as-spec.md) ----
// A separate signed cookie: { by: staff People ID, as: viewed People ID, exp }. The session cookie never changes.
export const VIEWAS_COOKIE = "cm_viewas";
export const VIEWAS_HOURS = 2;
export const viewAsCookie = (by, as) =>
  cookie(VIEWAS_COOKIE, seal({ by, as, exp: Date.now() + VIEWAS_HOURS * 3600e3 }), VIEWAS_HOURS * 3600);
export const clearViewAs = cookie(VIEWAS_COOKIE, "", 0);
export function viewAsClaim(req) {
  const v = unseal(readCookie(req, VIEWAS_COOKIE));
  return v && v.by && v.as ? v : null;
}

// Today's date in New York as YYYY-MM-DD (approval dates).
export const today = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
