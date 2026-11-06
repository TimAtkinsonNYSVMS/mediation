// NYSVMS account (Novi) sign-in tests v01 (2026-11-06). Novi is faked; nothing here contacts members.nysvms.org.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { setupEnv, EMAILS } from "./fixtures.mjs";

let sso, core;
const HOST = "https://complaints.example.test";
let novi = { email: EMAILS.fac, tokenOk: true };
const noviCalls = [];

before(async () => {
  setupEnv();
  const fake = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith("https://members.nysvms.org/")) {
      noviCalls.push({ url: u, body: opts.body ? String(opts.body) : "" });
      if (u.endsWith("/oauth/token")) return new Response(JSON.stringify(novi.tokenOk ? { access_token: "tok" } : { error: "invalid_grant" }), { status: novi.tokenOk ? 200 : 400 });
      if (u.endsWith("/oauth/userinfo")) return new Response(JSON.stringify({ email: novi.email, name: "Someone" }), { status: 200 });
    }
    return fake(url, opts);
  };
  core = await import("../netlify/lib/core.mjs");
  sso = (await import("../netlify/functions/sso.mjs")).default;
});

const get = (path, cookie) => sso(new Request(HOST + path, { headers: cookie ? { cookie } : {} }));
const loc = (r) => r.headers.get("location");
const cookies = (r) => r.headers.getSetCookie();

test("sso: off until the Novi client is set; the start link then says so instead of failing", async () => {
  delete process.env.NOVI_SSO_CLIENT_ID; delete process.env.NOVI_SSO_CLIENT_SECRET;
  assert.deepEqual(await (await get("/api/auth/sso")).json(), { enabled: false });
  assert.equal(loc(await get("/api/auth/sso-start")), `${HOST}/#/signin/sso-off`);
});

test("sso: start sends the person to Novi with a one-time state held only in an httpOnly cookie", async () => {
  process.env.NOVI_SSO_CLIENT_ID = "client"; process.env.NOVI_SSO_CLIENT_SECRET = "secret";
  assert.deepEqual(await (await get("/api/auth/sso")).json(), { enabled: true });
  const r = await get("/api/auth/sso-start");
  const to = new URL(loc(r));
  assert.equal(to.origin + to.pathname, "https://members.nysvms.org/oauth/authorize");
  assert.equal(to.searchParams.get("redirect_uri"), `${HOST}/api/auth/sso-callback`);
  const state = to.searchParams.get("state");
  assert.match(state, /^[0-9a-f]{32}$/);
  const c = cookies(r)[0];
  assert.ok(c.startsWith(`cm_sso_state=${state};`) && /HttpOnly/.test(c) && /Secure/.test(c));
  assert.ok(!to.searchParams.has("client_secret"), "the secret never goes to the browser");
});

test("sso: a callback this browser did not start is refused before Novi is contacted", async () => {
  const n = noviCalls.length;
  assert.equal(loc(await get("/api/auth/sso-callback?code=abc&state=forged", "cm_sso_state=" + "a".repeat(32))), `${HOST}/#/signin/sso-expired`);
  assert.equal(loc(await get("/api/auth/sso-callback?code=abc&state=x")), `${HOST}/#/signin/sso-expired`);
  assert.equal(noviCalls.length, n);
});

test("sso: a facilitator in People is signed in with the normal session; an email not in People is not", async () => {
  const state = "b".repeat(32), jar = `cm_sso_state=${state}`;
  novi = { email: "Priya@Example.org", tokenOk: true };
  let r = await get(`/api/auth/sso-callback?code=abc&state=${state}`, jar);
  assert.equal(loc(r), `${HOST}/#/`);
  const session = cookies(r).find((c) => c.startsWith("cm_session="));
  assert.ok(session, "session cookie set");
  assert.equal(core.sessionEmail(new Request(HOST, { headers: { cookie: session.split(";")[0] } })), EMAILS.fac);
  assert.ok(cookies(r).some((c) => c.startsWith("cm_sso_state=;")), "the state is cleared");
  assert.ok(noviCalls.at(-2).body.includes("client_secret=secret"), "the secret goes only to Novi's token endpoint");

  novi = { email: EMAILS.stranger, tokenOk: true };
  r = await get(`/api/auth/sso-callback?code=abc&state=${state}`, jar);
  assert.equal(loc(r), `${HOST}/#/signin/sso-noaccess`);
  assert.ok(!cookies(r).some((c) => c.startsWith("cm_session=")));

  novi = { email: EMAILS.fac, tokenOk: false };
  assert.equal(loc(await get(`/api/auth/sso-callback?code=abc&state=${state}`, jar)), `${HOST}/#/signin/sso-failed`);
  assert.equal(loc(await get(`/api/auth/sso-callback?error=access_denied&state=${state}`, jar)), `${HOST}/#/signin/sso-cancelled`);
});
