// Endpoint tests v01 (2026-11-04): sign-in, who sees what, actions, intake, uploads, files. Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { setupEnv, RECORDS, SENT, CODE_ROWS, UPLOADS, IDS, EMAILS, F } from "./fixtures.mjs";

let fn = {}, core, at;
before(async () => {
  setupEnv();
  core = await import("../netlify/lib/core.mjs");
  at = await import("../netlify/lib/airtable.mjs");
  for (const f of ["auth-code", "auth-session", "complaints", "complaint", "intake", "upload", "file", "templates", "facilitators"]) fn[f] = (await import(`../netlify/functions/${f}.mjs`)).default;
});

const HOST = "https://complaints.example.test";
const cookieFor = (email) => core.sessionCookie(email).split(";")[0];
const get = (f, path, email) => fn[f](new Request(HOST + path, { headers: email ? { cookie: cookieFor(email) } : {} }));
const post = (f, path, data, email, extra = {}) => fn[f](new Request(HOST + path, {
  method: "POST", body: JSON.stringify(data),
  headers: { "content-type": "application/json", "x-cm-request": "1", origin: HOST, ...(email ? { cookie: cookieFor(email) } : {}), ...extra }
}));
const complaintRow = (id) => RECORDS.tbl0FlFU8Xxn5UfK1.find((r) => r.id === id);
const fresh = () => at.clearCache();

test("an owner with no role signs in by emailed code; the code is stored only as a hash", async () => {
  let r = await post("auth-code", "/api/auth/code-request", { email: " Jordan@Example.org " });
  assert.equal(r.status, 200);
  const mail = SENT.at(-1);
  assert.deepEqual([mail.type, mail.to, mail.secret], ["code", EMAILS.owner, "hook-secret"]);
  assert.ok(!JSON.stringify(CODE_ROWS).includes(mail.code));
  r = await post("auth-code", "/api/auth/code-verify", { email: EMAILS.owner, code: mail.code });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /^cm_session=/);
});

test("people with no complaint, inactive facilitators and strangers get the same answer and no email", async () => {
  const n = SENT.length;
  for (const email of [EMAILS.stranger, EMAILS.inactive, "who@example.org", "not an email"]) {
    const r = await post("auth-code", "/api/auth/code-request", { email });
    assert.deepEqual(await r.json(), { ok: true });
  }
  assert.equal(SENT.length, n);
});

test("the session reports roles from People", async () => {
  assert.deepEqual(await (await get("auth-session", "/api/auth/session", EMAILS.staff)).json(), { email: EMAILS.staff, name: "Sam Staff", staff: true, facilitator: true, owner: false, admin: true, viewing: null, real: { name: "Sam Staff", staff: true } });
  assert.deepEqual(await (await get("auth-session", "/api/auth/session", EMAILS.fac)).json(), { email: EMAILS.fac, name: "Dr. Priya Raman", staff: false, facilitator: true, owner: false, admin: false, viewing: null, real: { name: "Dr. Priya Raman", staff: false } });
  assert.equal((await get("auth-session", "/api/auth/session", EMAILS.inactive)).status, 401);
  assert.equal((await get("auth-session", "/api/auth/session")).status, 401);
});

test("lists: staff see all, facilitators their assignments, owners their own", async () => {
  const nums = async (email) => { const b = await (await get("complaints", "/api/complaints", email)).json(); return { mine: b.mine.map((c) => c.n), work: b.work.map((c) => c.n) }; };
  assert.deepEqual(await nums(EMAILS.staff), { mine: [], work: [321, 318, 309, 297] });
  assert.deepEqual(await nums(EMAILS.fac), { mine: [], work: [318, 309] });
  assert.deepEqual(await nums(EMAILS.owner), { mine: [318, 309], work: [] });
  const owned = (await (await get("complaints", "/api/complaints", EMAILS.owner)).json()).mine[0];
  assert.equal(owned.owner, undefined, "owners' lists carry no other people's details");
});

test("detail: owners get the owner view without notes or contacts; others' complaints are 404", async () => {
  const o = await (await get("complaint", `/api/complaint?id=${IDS.cMine}`, EMAILS.owner)).json();
  assert.equal(o.view, "owner");
  assert.equal(o.updates, undefined);
  assert.equal(o.owner, undefined);
  assert.equal(o.resolution, undefined, "the resolution shows only once Completed");
  assert.equal(o.facilitator.name, "Dr. Priya Raman");
  assert.equal(o.facilitator.email, undefined);
  const done = await (await get("complaint", `/api/complaint?id=${IDS.cDone}`, EMAILS.owner)).json();
  assert.equal(done.resolution, "The clinic updated its after-vaccine handout.");
  assert.equal(done.can_feedback, true);
  assert.equal((await get("complaint", `/api/complaint?id=${IDS.cNew}`, EMAILS.owner)).status, 404);
  assert.equal((await get("complaint", `/api/complaint?id=${IDS.cOther}`, EMAILS.fac)).status, 404);
  const full = await (await get("complaint", `/api/complaint?id=${IDS.cMine}`, EMAILS.fac)).json();
  assert.equal(full.view, "full");
  assert.deepEqual(full.updates.map((u) => u.n), [601, 600], "newest first");
  assert.equal(full.owner.phone, "(518) 555-0100");
  assert.equal(full.can_assign, false);
  assert.ok(!full.statuses.includes("Awaiting assignment"));
});

test("a facilitator logs an update on an assigned complaint; staff are told; owners and others can't", async () => {
  const n = SENT.length;
  let r = await post("complaint", "/api/complaint/update", { id: IDS.cMine, notes: "Left a message for Dr. Greer." }, EMAILS.fac);
  assert.equal(r.status, 200);
  const row = RECORDS.tblzyvyYFymTo4xR6.at(-1);
  assert.deepEqual(row.fields[F.U.complaint], [IDS.cMine]);
  assert.deepEqual(row.fields[F.U.author], [IDS.fac]);
  assert.deepEqual(SENT.slice(n).map((m) => m.to.map((t) => t.email)), [[EMAILS.staff]]);
  assert.equal((await post("complaint", "/api/complaint/update", { id: IDS.cMine, notes: "x" }, EMAILS.owner)).status, 403);
  assert.equal((await post("complaint", "/api/complaint/update", { id: IDS.cOther, notes: "x" }, EMAILS.fac)).status, 404);
  assert.equal((await post("complaint", "/api/complaint/update", { id: IDS.cMine, notes: "  " }, EMAILS.fac)).status, 400);
});

test("status: facilitators can't send a complaint back to Awaiting assignment; staff can", async () => {
  assert.equal((await post("complaint", "/api/complaint/status", { id: IDS.cMine, status: "Awaiting assignment" }, EMAILS.fac)).status, 400);
  assert.equal((await post("complaint", "/api/complaint/status", { id: IDS.cMine, status: "Made up" }, EMAILS.staff)).status, 400);
  assert.equal((await post("complaint", "/api/complaint/status", { id: IDS.cMine, status: "Mediation in progress" }, EMAILS.fac)).status, 200);
  assert.deepEqual(complaintRow(IDS.cMine).fields[F.C.status], { name: "Mediation in progress" });
});

test("assigning: staff only, active facilitators only; the facilitator is emailed and the status moves on", async () => {
  assert.equal((await post("complaint", "/api/complaint/assign", { id: IDS.cNew, facilitator: IDS.fac2 }, EMAILS.fac)).status, 404);
  assert.equal((await post("complaint", "/api/complaint/assign", { id: IDS.cNew, facilitator: IDS.inactiveFac }, EMAILS.staff)).status, 400);
  const n = SENT.length;
  assert.equal((await post("complaint", "/api/complaint/assign", { id: IDS.cNew, facilitator: IDS.fac2 }, EMAILS.staff)).status, 200);
  assert.deepEqual(complaintRow(IDS.cNew).fields[F.C.fac], [IDS.fac2]);
  assert.deepEqual(complaintRow(IDS.cNew).fields[F.C.status], { name: "Mediator Assigned" });
  assert.equal(SENT[n].to[0].email, EMAILS.fac2);
  assert.match(SENT[n].text, /complaints\.example\.test\/#\/c\/recCMP00000000001/);
  fresh();
  const facs = await (await get("facilitators", "/api/facilitators", EMAILS.staff)).json();
  assert.equal(facs.find((f) => f.id === IDS.fac2).open, 2);
  assert.equal((await get("facilitators", "/api/facilitators", EMAILS.fac)).status, 403);
});

test("feedback: owner only, once, on a completed complaint", async () => {
  assert.equal((await post("complaint", "/api/complaint/feedback", { id: IDS.cMine, overall: 5 }, EMAILS.owner)).status, 400, "not completed");
  assert.equal((await post("complaint", "/api/complaint/feedback", { id: IDS.cDone, overall: 0 }, EMAILS.owner)).status, 400, "needs a rating");
  assert.equal((await post("complaint", "/api/complaint/feedback", { id: IDS.cDone, overall: 4, facilitator: 5, comments: "Helpful." }, EMAILS.owner)).status, 200);
  assert.ok(complaintRow(IDS.cDone).fields[F.C.fbDate]);
  assert.equal((await post("complaint", "/api/complaint/feedback", { id: IDS.cDone, overall: 1 }, EMAILS.owner)).status, 400, "only once");
});

test("intake: validates, numbers the complaint, reuses an existing person, emails owner and inbox", async () => {
  const good = { name: "Jordan Ellery", email: "JORDAN@example.org", vet_name: "Dr. A", subject: "Billing aside, a dosing question", description: "What happened.", a_legal: true, a_opd: true, a_fees: true, a_member: true, a_service: true, a_terms: true };
  assert.equal((await post("intake", "/api/intake", { ...good, a_terms: false })).status, 400);
  assert.equal((await post("intake", "/api/intake", { ...good, email: "nope" })).status, 400);
  const people = RECORDS.tblMC3vdByJkY9jEC.length;
  assert.deepEqual(await (await post("intake", "/api/intake", { ...good, website: "spam" })).json(), { ok: true, n: 0 });
  const n = SENT.length;
  const out = await (await post("intake", "/api/intake", good)).json();
  assert.equal(out.n, 322);
  assert.equal(RECORDS.tblMC3vdByJkY9jEC.length, people, "existing owner reused");
  const c = complaintRow(out.complaint);
  assert.deepEqual([c.fields[F.C.owner], c.fields[F.C.status]], [[IDS.owner], { name: "Awaiting assignment" }]);
  assert.deepEqual(SENT.slice(n).map((m) => m.to[0].email), [EMAILS.owner, "inbox@example.org"]);
  assert.ok(out.ticket);
  // the ticket uploads to this complaint's own fields only
  const file = { filename: "notes.pdf", contentType: "application/pdf", data: Buffer.from("pdf").toString("base64") };
  assert.equal((await post("upload", "/api/upload", { ...file, complaint: out.complaint, field: "uploads", ticket: out.ticket })).status, 200);
  assert.equal((await post("upload", "/api/upload", { ...file, complaint: IDS.cMine, field: "uploads", ticket: out.ticket })).status, 403);
  assert.equal((await post("upload", "/api/upload", { ...file, complaint: out.complaint, field: "uploads", ticket: "forged.sig" })).status, 403);
  assert.equal((await post("upload", "/api/upload", { ...file, contentType: "application/x-msdownload", complaint: out.complaint, field: "uploads", ticket: out.ticket })).status, 400);
  assert.equal(UPLOADS.at(-1).field, "fld5c7WytBfZRJdMG");
});

test("uploads to a progress update need a session that can work on the complaint", async () => {
  const file = { filename: "letter.pdf", contentType: "application/pdf", data: Buffer.from("x").toString("base64") };
  assert.equal((await post("upload", "/api/upload", { ...file, complaint: IDS.cMine, field: "update", update: IDS.u1 }, EMAILS.fac)).status, 200);
  assert.equal((await post("upload", "/api/upload", { ...file, complaint: IDS.cMine, field: "update", update: IDS.u1 }, EMAILS.owner)).status, 403);
  assert.equal((await post("upload", "/api/upload", { ...file, complaint: IDS.cOther, field: "update", update: IDS.u1 }, EMAILS.staff)).status, 404, "update must belong to the complaint");
});

test("files: owners open their own uploads, not progress documents; others get 404", async () => {
  let r = await get("file", `/api/file?c=${IDS.cMine}&a=attRL0000000000001`, EMAILS.owner);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "https://files.example.test/attRL0000000000001/release.pdf");
  assert.equal((await get("file", `/api/file?c=${IDS.cMine}&u=${IDS.u2}&a=attDC0000000000001`, EMAILS.owner)).status, 404);
  assert.equal((await get("file", `/api/file?c=${IDS.cMine}&u=${IDS.u2}&a=attDC0000000000001`, EMAILS.fac)).status, 302);
  assert.equal((await get("file", `/api/file?c=${IDS.cNew}&a=attUP0000000000001`, EMAILS.fac)).status, 404);
  assert.equal((await get("file", `/api/file?c=${IDS.cNew}&a=attUP0000000000001`)).status, 401);
});

test("templates: staff and facilitators only, retired ones hidden", async () => {
  const t = await (await get("templates", "/api/templates", EMAILS.fac)).json();
  assert.deepEqual(t.map((x) => x.type), ["Introduce yourself to Animal Owner", "Introduce yourself to veterinarian"]);
  assert.equal((await get("templates", "/api/templates", EMAILS.owner)).status, 403);
});

test("posts need the request header and the same origin", async () => {
  assert.equal((await post("complaint", "/api/complaint/update", { id: IDS.cMine, notes: "x" }, EMAILS.fac, { "x-cm-request": "" })).status, 400);
  assert.equal((await post("complaint", "/api/complaint/update", { id: IDS.cMine, notes: "x" }, EMAILS.fac, { origin: "https://evil.example" })).status, 403);
  assert.equal((await post("intake", "/api/intake", {}, null, { origin: "https://evil.example" })).status, 403);
});
