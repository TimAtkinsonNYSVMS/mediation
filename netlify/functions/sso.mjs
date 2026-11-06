// Sign in with an NYSVMS (Novi) account · v01 (2026-11-06). A second way in beside the emailed code, for facilitators and staff.
//   GET /api/auth/sso           { enabled }: whether the Novi client is configured (the sign-in page shows the button only then)
//   GET /api/auth/sso-start     sends the person to Novi with a one-time state held in an httpOnly cookie
//   GET /api/auth/sso-callback  Novi sends them back here; checks the state, asks Novi who they are, and signs them in
// Novi only says who the person is (their email). Whether they may use the portal is decided exactly as for the emailed
// code: personByEmail() in access.mjs, from People. The session is the same signed cookie the code sign-in sets.
// Pattern taken from the Champion portal (nysvms-practice-renewal, sso-start.js / sso-callback.js, 2026-11-05).
// Settings: NOVI_SSO_CLIENT_ID, NOVI_SSO_CLIENT_SECRET (a Novi SSO client for this portal, open to all members), PORTAL_URL.
// The client's redirect URI in Novi must be exactly PORTAL_URL + "/api/auth/sso-callback".
import { randomBytes } from "node:crypto";
import { env, json, readCookie, sessionCookie } from "../lib/core.mjs";
import { personByEmail } from "../lib/access.mjs";

const NOVI = "https://members.nysvms.org";
const STATE_COOKIE = "cm_sso_state";
const STATE_MINUTES = 10;

const portal = () => env("PORTAL_URL", "https://mediation.nysvms.org").replace(/\/+$/, "");
const redirectUri = () => `${portal()}/api/auth/sso-callback`;
const configured = () => !!(env("NOVI_SSO_CLIENT_ID", "") && env("NOVI_SSO_CLIENT_SECRET", ""));
const stateCookie = (value, seconds) => `${STATE_COOKIE}=${value}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;

// Always back to the portal, never to an address taken from the request. The state cookie is cleared on every outcome.
function back(hash, extra = []) {
  const headers = new Headers({ location: `${portal()}/${hash}`, "cache-control": "no-store" });
  headers.append("set-cookie", stateCookie("", 0));
  for (const c of extra) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
}

async function jsonOrNull(res) {
  try { return await res.json(); } catch { return null; }
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/api/auth/sso") return json({ enabled: configured() });

  if (path === "/api/auth/sso-start") {
    if (!configured()) return back("#/signin/sso-off");
    const state = randomBytes(16).toString("hex");
    const to = `${NOVI}/oauth/authorize?` + new URLSearchParams({
      response_type: "code", scope: "openid email profile", client_id: env("NOVI_SSO_CLIENT_ID"), redirect_uri: redirectUri(), state
    });
    return new Response(null, { status: 302, headers: { location: to, "set-cookie": stateCookie(state, STATE_MINUTES * 60), "cache-control": "no-store" } });
  }

  // ---- callback ----
  // The CSRF check comes first, before any network call: a sign-in this browser did not start is refused.
  const want = readCookie(req, STATE_COOKIE);
  const state = String(url.searchParams.get("state") || "").slice(0, 200);
  if (!want || !state || want !== state) { console.error("sso: state did not match"); return back("#/signin/sso-expired"); }
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) return back("#/signin/sso-cancelled");
  if (!configured()) return back("#/signin/sso-off");

  try {
    const tokRes = await fetch(`${NOVI}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(),
        client_id: env("NOVI_SSO_CLIENT_ID"), client_secret: env("NOVI_SSO_CLIENT_SECRET") }),
      signal: AbortSignal.timeout(15000)
    });
    const tok = await jsonOrNull(tokRes);
    if (!tokRes.ok || !tok?.access_token) { console.error(`sso: token exchange refused, HTTP ${tokRes.status}`); return back("#/signin/sso-failed"); }

    const infoRes = await fetch(`${NOVI}/oauth/userinfo`, { headers: { authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(15000) });
    const info = await jsonOrNull(infoRes);
    const email = String(info?.email || "").trim().toLowerCase();
    if (!infoRes.ok || !email) { console.error(`sso: userinfo gave no email, HTTP ${infoRes.status}`); return back("#/signin/sso-failed"); }

    // People decides, exactly as for the emailed code.
    const me = await personByEmail(email);
    if (!me) { console.log("sso: Novi sign-in for an email with no portal access"); return back("#/signin/sso-noaccess"); }
    console.log(`sso: signed in ${me.staff ? "staff" : me.facilitator ? "facilitator" : "owner"} ${me.id}`);
    return back("#/", [sessionCookie(me.email)]);
  } catch (e) {
    console.error("sso failed", e.message);
    return back("#/signin/sso-failed");
  }
};

export const config = { path: ["/api/auth/sso", "/api/auth/sso-start", "/api/auth/sso-callback"] };
