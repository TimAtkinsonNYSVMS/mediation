// Admin page and View as tests v01 (2026-11-04). docs/admin-and-view-as-spec.md. Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { setupEnv, RECORDS, IDS, EMAILS, F } from "./fixtures.mjs";

let fn = {}, core;
before(async () => {
  setupEnv();
  core = await import("../netlify/lib/core.mjs");
  for (const f of ["admin", "auth-session", "complaints", "complaint", "upload", "file"]) fn[f] = (await import(`../netlify/functions/${f}.mjs`)).default;
});

const HOST = "https://mediation.example.test";
const LOG = () => RECORDS.tblBXzNsCIKILpPgR;
const PEOPLE = () => RECORDS.tblMC3vdByJkY9jEC;
const cookieFor = (email, view) => [core.sessionCookie(email).split(";")[0], view].filter(Boolean).join("; ");
const get = (f, path, email, view) => fn[f](new Request(HOST + path, { headers: email ? { cookie: cookieFor(email, view) } : {} }));
const post = (f, path, data, email, view) => fn[f](new Request(HOST + path, {
  method: "POST", body: JSON.stringify(data),
  headers: { "content-type": "application/json", "x-cm-request": "1", origin: HOST, ...(email ? { cookie: cookieFor(email, view) } : {}) }
}));
const viewCookieFrom = (r) => r.headers.get("set-cookie").split(";")[0];

test("only staff can open the Admin page; it lists everyone with roles and counts", async () => {
  assert.equal((await get("admin", "/api/admin/people", EMAILS.fac)).status, 403);
  assert.equal((await get("admin", "/api/admin/people", EMAILS.owner)).status, 403);
  assert.equal((await get("admin", "/api/admin/people")).status, 401);
  const b = await (await get("admin", "/api/admin/people", EMAILS.staff)).json();
  const priya = b.people.find((p) => p.id === IDS.fac);
  assert.deepEqual([priya.facilitator, priya.staff, priya.active, priya.region], [true, false, true, "Hudson Valley"]);
  const jordan = b.people.find((p) => p.id === IDS.owner);
  assert.deepEqual([jordan.owner, jordan.staff], [true, false]);
  assert.ok(b.regions.includes("Hudson Valley"));
});

test("staff change roles; each change is logged; nobody can remove their own Staff or Active", async () => {
  const n = LOG().length;
  let r = await post("admin", "/api/admin/person", { id: IDS.fac2, name: "Dr. Marcus Oyelaran", staff: true, facilitator: true, active: true, region: "Capital District" }, EMAILS.staff);
  assert.equal(r.status, 200);
  const row = PEOPLE().find((p) => p.id === IDS.fac2);
  assert.deepEqual(row.fields[F.P.roles], ["Staff", "Facilitator"]);
  assert.equal(LOG().length, n + 1);
  assert.match(LOG().at(-1).fields.fldZhKXGNU19DESBK, /Sam Staff changed Dr\. Marcus Oyelaran: staff off → on/);
  assert.deepEqual(LOG().at(-1).fields.fldbB0o7a0SkFuGbD, [IDS.staff]);
  r = await post("admin", "/api/admin/person", { id: IDS.staff, name: "Sam Staff", staff: false, facilitator: true, active: true }, EMAILS.staff);
  assert.equal(r.status, 400);
  r = await post("admin", "/api/admin/person", { id: IDS.staff, name: "Sam Staff", staff: true, facilitator: true, active: false }, EMAILS.staff);
  assert.equal(r.status, 400);
  assert.equal((await post("admin", "/api/admin/person", { id: IDS.fac2, name: "x", staff: true, active: true }, EMAILS.fac)).status, 403);
  // put Marcus back
  await post("admin", "/api/admin/person", { id: IDS.fac2, name: "Dr. Marcus Oyelaran", staff: false, facilitator: true, active: true, region: "Capital District" }, EMAILS.staff);
});

test("staff add a new person; duplicate emails are refused", async () => {
  const r = await post("admin", "/api/admin/person", { name: "Dr. New Volunteer", email: "New@Example.org", facilitator: true, active: true, region: "NYC" }, EMAILS.staff);
  assert.equal(r.status, 200);
  const row = PEOPLE().at(-1);
  assert.deepEqual([row.fields[F.P.email], row.fields[F.P.roles]], ["new@example.org", ["Facilitator"]]);
  assert.equal(LOG().at(-1).fields.fldCeen1cs82bzow6.name, "Person added");
  assert.equal((await post("admin", "/api/admin/person", { name: "Again", email: "new@example.org" }, EMAILS.staff)).status, 400);
});

test("View as a facilitator: their list and pages only, every change refused, start and stop logged", async () => {
  assert.equal((await post("admin", "/api/view-as", { id: IDS.fac }, EMAILS.fac)).status, 403, "facilitators can't start a view");
  const n = LOG().length;
  const start = await post("admin", "/api/view-as", { id: IDS.fac }, EMAILS.staff);
  assert.equal(start.status, 200);
  const view = viewCookieFrom(start);
  assert.match(view, /^cm_viewas=/);
  assert.equal(LOG().at(-1).fields.fldCeen1cs82bzow6.name, "View as started");

  const s = await (await get("auth-session", "/api/auth/session", EMAILS.staff, view)).json();
  assert.deepEqual([s.name, s.staff, s.facilitator, s.viewing.name, s.real.name], ["Dr. Priya Raman", false, true, "Dr. Priya Raman", "Sam Staff"]);
  const list = await (await get("complaints", "/api/complaints", EMAILS.staff, view)).json();
  assert.deepEqual(list.work.map((c) => c.n), [318, 309]);
  assert.equal((await get("complaint", `/api/complaint?id=${IDS.cOther}`, EMAILS.staff, view)).status, 404);

  const before = RECORDS.tblzyvyYFymTo4xR6.length;
  let r = await post("complaint", "/api/complaint/update", { id: IDS.cMine, notes: "x" }, EMAILS.staff, view);
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /viewing as Dr\. Priya Raman/);
  assert.equal(RECORDS.tblzyvyYFymTo4xR6.length, before, "nothing written");
  for (const [path, data] of [["/api/complaint/status", { status: "Completed" }], ["/api/complaint/resolution", { resolution: "x" }], ["/api/complaint/assign", { facilitator: IDS.fac2 }]])
    assert.equal((await post("complaint", path, { id: IDS.cMine, ...data }, EMAILS.staff, view)).status, 403);
  assert.equal((await post("upload", "/api/upload", { complaint: IDS.cMine, field: "update", update: IDS.u1, filename: "a.pdf", contentType: "application/pdf", data: "eA==" }, EMAILS.staff, view)).status, 403);
  assert.equal((await get("admin", "/api/admin/people", EMAILS.staff, view)).status, 403, "the Admin page is refused while viewing");
  assert.equal((await get("file", `/api/file?c=${IDS.cMine}&u=${IDS.u2}&a=attDC0000000000001`, EMAILS.staff, view)).status, 302, "files open as they would for her");

  const stop = await post("admin", "/api/view-as/stop", {}, EMAILS.staff, view);
  assert.match(stop.headers.get("set-cookie"), /^cm_viewas=; .*Max-Age=0/);
  assert.equal(LOG().at(-1).fields.fldCeen1cs82bzow6.name, "View as stopped");
  assert.equal(LOG().length, n + 2);
});

test("View as an owner shows the owner view only", async () => {
  const view = viewCookieFrom(await post("admin", "/api/view-as", { id: IDS.owner }, EMAILS.staff));
  const list = await (await get("complaints", "/api/complaints", EMAILS.staff, view)).json();
  assert.deepEqual([list.mine.map((c) => c.n), list.work], [[318, 309], []]);
  const d = await (await get("complaint", `/api/complaint?id=${IDS.cMine}`, EMAILS.staff, view)).json();
  assert.deepEqual([d.view, d.updates], ["owner", undefined]);
  assert.equal((await post("complaint", "/api/complaint/feedback", { id: IDS.cDone, overall: 5 }, EMAILS.staff, view)).status, 403, "can't leave feedback in their name");
});

test("a View as cookie is ignored for another person's session, for non-staff, and once expired", async () => {
  const view = viewCookieFrom(await post("admin", "/api/view-as", { id: IDS.owner }, EMAILS.staff));
  // the same cookie in a facilitator's browser does nothing
  const s = await (await get("auth-session", "/api/auth/session", EMAILS.fac, view)).json();
  assert.deepEqual([s.name, s.viewing], ["Dr. Priya Raman", null]);
  // a forged cookie naming a facilitator as the viewer does nothing either
  const forged = `cm_viewas=${core.seal({ by: IDS.fac, as: IDS.owner, exp: Date.now() + 60e3 })}`;
  assert.equal((await (await get("auth-session", "/api/auth/session", EMAILS.fac, forged)).json()).viewing, null);
  // expired
  const old = `cm_viewas=${core.seal({ by: IDS.staff, as: IDS.owner, exp: Date.now() - 1000 })}`;
  assert.equal((await (await get("auth-session", "/api/auth/session", EMAILS.staff, old)).json()).viewing, null);
  // a tampered signature is rejected
  const tampered = view.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
  assert.equal((await (await get("auth-session", "/api/auth/session", EMAILS.staff, tampered)).json()).viewing, null);
});

test("signing out ends View as and logs the stop", async () => {
  const view = viewCookieFrom(await post("admin", "/api/view-as", { id: IDS.fac }, EMAILS.staff));
  const r = await post("auth-session", "/api/auth/logout", {}, EMAILS.staff, view);
  const cookies = r.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith("cm_session=;")) && cookies.some((c) => c.startsWith("cm_viewas=;")));
  assert.match(LOG().at(-1).fields.fldZhKXGNU19DESBK, /signed out/);
});
