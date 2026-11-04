// Test fixtures v01 (2026-11-04). Made-up people and complaints shaped like Airtable API responses (field IDs, links
// as record ID arrays, selects as { name }, attachments as objects). Never real data. The fake keeps the inverse
// links (People.owns / facilitates, Complaints.updates) in step, as Airtable does.
const r = (id, fields) => ({ id, createdTime: "2026-10-01T12:00:00.000Z", fields });

export const IDS = {
  staff: "recPPL00000000001", fac: "recPPL00000000002", fac2: "recPPL00000000003", owner: "recPPL00000000004", owner2: "recPPL00000000005",
  inactiveFac: "recPPL00000000006", stranger: "recPPL00000000007",
  cNew: "recCMP00000000001", cMine: "recCMP00000000002", cDone: "recCMP00000000003", cOther: "recCMP00000000004",
  u1: "recUPD00000000001", u2: "recUPD00000000002"
};
export const EMAILS = { staff: "sam@example.org", fac: "priya@example.org", fac2: "marcus@example.org", owner: "jordan@example.org", owner2: "dana@example.org", inactive: "old@example.org", stranger: "nobody@example.org" };

const P = { email: "fldvjOpPE8GajiOrx", name: "fldYjFqomse1p91BB", roles: "fldISqQVSu1f3qLnZ", admin: "fldNMO4zYfb6vbk0G", active: "fldM1SsovNPz8jjSc", region: "fldXUBbG7YL9cbK0f", phone: "fldvdFwuiAauexiiR", owns: "fld60rxqaSSHJZSBo", facilitates: "fldT3ICxl0U5L0t3e" };
const C = { n: "fldg11sJnOcSL9isq", received: "fldf529tftYjMmXTz", status: "flduLBEGv02ch9cDn", owner: "fldBXPZ7L6s29trcD", fac: "fldcuf96LhF1XKlaV", subject: "fldn8dv0UnA0sDLfh",
  desc: "fldioiCzvEYdviMJ9", vet: "fldQ1b2UFA3D6mNAI", practice: "fldus5G7qO3ji0IWa", uploads: "fld5c7WytBfZRJdMG", release: "fldPpBXyG3eRyGRi0", resolution: "fldDZZMVNVTayS2dC",
  fbDate: "fldW8uipeCU9zBKGo", updates: "fldMkDgrqPfO1Omc1", last: "fldPQQLEbqW7o9ey1" };
const U = { n: "fld8lFmpecZG7cdaQ", complaint: "fldj3FAAYKeGMKuhG", author: "fldvm1aIsRmvMO4EQ", date: "fldIucKCQWOnZp1Bi", notes: "fldm2HjE7PEN3hU0n", docs: "fldglDofWQ9vufOCk", letterType: "fldi7g5q1MalmVyla" };
export const F = { P, C, U };
const att = (id, filename) => ({ id, filename, size: 1000, type: "application/pdf", url: `https://files.example.test/${id}/${filename}` });

export const RECORDS = {
  tblMC3vdByJkY9jEC: [
    r(IDS.staff, { [P.email]: EMAILS.staff, [P.name]: "Sam Staff", [P.roles]: ["Facilitator", "Staff"], [P.active]: true, [P.admin]: true }),
    r(IDS.fac, { [P.email]: "Priya@Example.org", [P.name]: "Dr. Priya Raman", [P.roles]: ["Facilitator"], [P.active]: true, [P.region]: { name: "Hudson Valley" } }),
    r(IDS.fac2, { [P.email]: EMAILS.fac2, [P.name]: "Dr. Marcus Oyelaran", [P.roles]: ["Facilitator"], [P.active]: true, [P.region]: { name: "Capital District" } }),
    r(IDS.owner, { [P.email]: EMAILS.owner, [P.name]: "Jordan Ellery", [P.phone]: "(518) 555-0100" }),
    r(IDS.owner2, { [P.email]: EMAILS.owner2, [P.name]: "Dana Whitcomb" }),
    r(IDS.inactiveFac, { [P.email]: EMAILS.inactive, [P.name]: "Dr. Former Volunteer", [P.roles]: ["Facilitator"], [P.active]: false }),
    r(IDS.stranger, { [P.email]: EMAILS.stranger, [P.name]: "Signed up, never filed" })
  ],
  tbl0FlFU8Xxn5UfK1: [
    r(IDS.cNew, { [C.n]: 321, [C.received]: "2026-10-28T14:00:00.000Z", [C.status]: { name: "Awaiting assignment" }, [C.owner]: [IDS.owner2], [C.subject]: "Post-surgery infection not explained", [C.desc]: "Swelling a week after a dental extraction.", [C.vet]: "Dr. Ellen Marsh", [C.practice]: "Brookside Animal Hospital", [C.uploads]: [att("attUP0000000000001", "discharge-notes.pdf")] }),
    r(IDS.cMine, { [C.n]: 318, [C.received]: "2026-10-12T14:00:00.000Z", [C.status]: { name: "Mediator waiting for veterinarian to respond" }, [C.owner]: [IDS.owner], [C.fac]: [IDS.fac], [C.subject]: "Euthanasia handled without explanation", [C.desc]: "We felt rushed and were never told what the tests showed.", [C.vet]: "Dr. Thomas Greer", [C.practice]: "Riverbend Veterinary Clinic", [C.release]: [att("attRL0000000000001", "release.pdf")] }),
    r(IDS.cDone, { [C.n]: 309, [C.received]: "2025-08-30T14:00:00.000Z", [C.status]: { name: "Completed" }, [C.owner]: [IDS.owner], [C.fac]: [IDS.fac], [C.subject]: "Vaccine reaction follow-up", [C.desc]: "I was not told what to watch for.", [C.vet]: "Dr. Nina Patel", [C.resolution]: "The clinic updated its after-vaccine handout." }),
    r(IDS.cOther, { [C.n]: 297, [C.received]: "2025-02-03T14:00:00.000Z", [C.status]: { name: "Mediator Assigned" }, [C.owner]: [IDS.owner2], [C.fac]: [IDS.fac2], [C.subject]: "Communication after surgery", [C.desc]: "No one returned my calls.", [C.vet]: "Dr. Omar Haddad" })
  ],
  tblzyvyYFymTo4xR6: [
    r(IDS.u1, { [U.n]: 600, [U.complaint]: [IDS.cMine], [U.author]: [IDS.fac], [U.date]: "2026-10-14T15:00:00.000Z", [U.notes]: "Called the owner and explained the process.", [U.letterType]: { name: "Introduce yourself to Animal Owner" } }),
    r(IDS.u2, { [U.n]: 601, [U.complaint]: [IDS.cMine], [U.author]: [IDS.fac], [U.date]: "2026-10-30T15:00:00.000Z", [U.notes]: "Vet on leave until Nov 6.", [U.docs]: [att("attDC0000000000001", "call-log.pdf")] })
  ],
  tblBXzNsCIKILpPgR: [],
  tbloGcnfTRAu5niHD: [
    r("recTPL00000000001", { flddS63Z2Z3VePtf6: "Introduce yourself to Animal Owner", fldb2G8PeGIWb2asU: { name: "Owner" }, fldsGhPHEA7ozb2qw: "Your complaint about Dr. {vet_name}", fldLkj53XhzL9NcLM: "Dear {owner_name}, I am Dr. {facilitator_name}. {feedback_link}", fldcAeqUTpGRiUYBH: 1 }),
    r("recTPL00000000002", { flddS63Z2Z3VePtf6: "Introduce yourself to veterinarian", fldb2G8PeGIWb2asU: { name: "Veterinarian" }, fldsGhPHEA7ozb2qw: "A complaint from {owner_name}", fldLkj53XhzL9NcLM: "Dear {vet_name}, documents: {uploads_link}", fldcAeqUTpGRiUYBH: 2 }),
    r("recTPL00000000003", { flddS63Z2Z3VePtf6: "Retired letter", fldb2G8PeGIWb2asU: { name: "Owner" }, fldsGhPHEA7ozb2qw: "x", fldLkj53XhzL9NcLM: "x", fldcAeqUTpGRiUYBH: 3, fldulDctWvFGvIlkc: true })
  ]
};

export const CODE_ROWS = [];
export const SENT = [];
export const WRITES = [];
export const UPLOADS = [];
export const MAIL_HOOK = "https://hook.example.test/mail";
const CODES = "tblr6tAs6pjmTXVne";
const PEOPLE = "tblMC3vdByJkY9jEC", COMPLAINTS = "tbl0FlFU8Xxn5UfK1", UPDATES = "tblzyvyYFymTo4xR6";
const SELECTS = ["fldCeen1cs82bzow6", "flduLBEGv02ch9cDn", "fldi7g5q1MalmVyla", "fldXUBbG7YL9cbK0f", "fldV2V8jO2Ncrnizz", "fldb2G8PeGIWb2asU"];
const ok = (b) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
const clone = (x) => JSON.parse(JSON.stringify(x));
const stored = (fields) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, SELECTS.includes(k) && typeof v === "string" ? { name: v } : v]));

// Recompute the inverse links Airtable would maintain.
function withInverse(table, row) {
  const out = clone(row);
  if (table === PEOPLE) {
    out.fields[P.owns] = RECORDS[COMPLAINTS].filter((c) => (c.fields[C.owner] || []).includes(row.id)).map((c) => c.id);
    out.fields[P.facilitates] = RECORDS[COMPLAINTS].filter((c) => (c.fields[C.fac] || []).includes(row.id)).map((c) => c.id);
  }
  if (table === COMPLAINTS) {
    const ups = RECORDS[UPDATES].filter((u) => (u.fields[U.complaint] || []).includes(row.id));
    out.fields[C.updates] = ups.map((u) => u.id);
    const last = ups.map((u) => u.fields[U.date]).sort().pop();
    if (last) out.fields[C.last] = last.slice(0, 10);
  }
  return out;
}

export async function fakeFetch(url, opts = {}) {
  const u = new URL(String(url));
  const method = opts.method || "GET";
  if (String(url) === MAIL_HOOK) { SENT.push(JSON.parse(opts.body)); return ok({ sent: true }); }
  if (u.host === "content.airtable.com") {
    const [, , , recordId, field] = u.pathname.split("/");
    const b = JSON.parse(opts.body);
    UPLOADS.push({ recordId, field, filename: b.filename, contentType: b.contentType });
    const row = [...RECORDS[COMPLAINTS], ...RECORDS[UPDATES]].find((x) => x.id === recordId);
    (row.fields[field] ||= []).push({ id: `attNEW${String(UPLOADS.length).padStart(11, "0")}`, filename: b.filename, size: 10, type: b.contentType, url: `https://files.example.test/new/${b.filename}` });
    return ok({ id: recordId });
  }
  const parts = u.pathname.split("/");
  if (parts.includes(CODES)) {
    const id = parts[parts.indexOf(CODES) + 1];
    if (method === "POST") {
      const row = { id: `recC${String(CODE_ROWS.length).padStart(13, "0")}`, createdTime: new Date().toISOString(), fields: { ...JSON.parse(opts.body).fields, fldJzUTiT2ug5sqkc: new Date().toISOString() } };
      CODE_ROWS.push(row);
      return ok(row);
    }
    if (method === "PATCH") { const row = CODE_ROWS.find((x) => x.id === id); Object.assign(row.fields, JSON.parse(opts.body).fields); return ok(row); }
    return ok({ records: CODE_ROWS });
  }
  const v0 = parts.indexOf("v0");
  const table = parts[v0 + 2], recId = parts[v0 + 3];
  const records = RECORDS[table];
  if (!records) return new Response(JSON.stringify({ error: "unknown table" }), { status: 404 });
  if (method === "POST") {
    const row = { id: `recNEW${String(WRITES.length).padStart(11, "0")}`, createdTime: new Date().toISOString(), fields: stored(JSON.parse(opts.body).fields) };
    records.push(row);
    WRITES.push({ method, table, id: row.id, fields: JSON.parse(opts.body).fields });
    return ok(withInverse(table, row));
  }
  const row = recId ? records.find((x) => x.id === recId) : null;
  if (recId && !row) return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 });
  if (method === "PATCH") {
    const fields = JSON.parse(opts.body).fields;
    for (const [k, v] of Object.entries(stored(fields))) { if (v === null || v === "") delete row.fields[k]; else row.fields[k] = v; }
    WRITES.push({ method, table, id: recId, fields });
    return ok(withInverse(table, row));
  }
  if (row) return ok(withInverse(table, row));
  const formula = u.searchParams.get("filterByFormula") || "";
  const wanted = [...formula.matchAll(/RECORD_ID\(\)='(rec\w+)'/g)].map((m) => m[1]);
  const list = wanted.length ? records.filter((x) => wanted.includes(x.id)) : records;
  return ok({ records: list.map((x) => withInverse(table, x)) });
}

export function setupEnv() {
  process.env.SESSION_SECRET = "test-secret";
  process.env.AIRTABLE_TOKEN = "test";
  process.env.CM_MAIL_WEBHOOK_URL = MAIL_HOOK;
  process.env.CM_WEBHOOK_SECRET = "hook-secret";
  process.env.PORTAL_URL = "https://complaints.example.test";
  process.env.STAFF_INBOX = "inbox@example.org";
  globalThis.fetch = fakeFetch;
}
