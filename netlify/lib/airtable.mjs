// Mediation portal Airtable access v03 (2026-11-06). v03: Mediation Requests "Next step"; Progress Updates Type/With/Status Set.
// Was v02 (2026-11-04). v02: Admin Log table; People "active" etc. used by the Admin page.
// Was v01 (2026-11-04). Field IDs, never names (see docs/airtable.md).
// Base "Complaints Mediation". People and Letter Templates are cached for 60 seconds per function instance;
// Complaints and Progress Updates are always read fresh.
import { env } from "./core.mjs";

export const BASE = "appUbdZxOQ7WjyOYJ";
export const TABLES = {
  people: {
    id: "tblMC3vdByJkY9jEC",
    fields: {
      fldvjOpPE8GajiOrx: "email", fldYjFqomse1p91BB: "name", fldvdFwuiAauexiiR: "phone", fldSaGISV1gYGdGxD: "address",
      fldISqQVSu1f3qLnZ: "roles", fldNMO4zYfb6vbk0G: "admin", fldM1SsovNPz8jjSc: "active", fldXUBbG7YL9cbK0f: "region",
      fld60rxqaSSHJZSBo: "owns", fldT3ICxl0U5L0t3e: "facilitates"
    }
  },
  complaints: {
    id: "tbl0FlFU8Xxn5UfK1",
    fresh: true,
    fields: {
      fldg11sJnOcSL9isq: "n", fldf529tftYjMmXTz: "received", flduLBEGv02ch9cDn: "status", fldBXPZ7L6s29trcD: "owner",
      fldcuf96LhF1XKlaV: "facilitator", fldn8dv0UnA0sDLfh: "subject", fldioiCzvEYdviMJ9: "description",
      fldQ1b2UFA3D6mNAI: "vet_name", fldjTlxd3X4FG2uKs: "vet_email", fldus5G7qO3ji0IWa: "practice", fldNBq6JPynKKyHqu: "practice_address",
      fldrQoWyAYJAIjIw5: "a_member", fldSOmidssLI4qhfF: "a_legal", fld8dwP5IQ83QKMMF: "a_opd", fldujZaqEFtTSxVuF: "a_fees",
      fld8fHdDGtVKQJydo: "a_service", fld8pkG02efarEZC6: "a_terms", fldHeqnXSU0drmpe7: "records_ok",
      fld5c7WytBfZRJdMG: "uploads", fldPpBXyG3eRyGRi0: "release", fldDZZMVNVTayS2dC: "resolution", fldCwzyS6IxW5Wc1G: "resolution_notes",
      fldW8uipeCU9zBKGo: "fb_date", fldAK4HIVK3mOAAYs: "fb_overall", fldXs9UGqSVLyuVd8: "fb_value", flddQcVoT2wAhu6ul: "fb_facilitator",
      fldZ7eJTGBYf38ydY: "fb_admin", fld9Vnqur9xRama69: "fb_comments", fldMkDgrqPfO1Omc1: "updates", fldPQQLEbqW7o9ey1: "last_update",
      fldV2V8jO2Ncrnizz: "source", fldUo8RrnkHHwM6s0: "next_step"
    }
  },
  updates: {
    id: "tblzyvyYFymTo4xR6",
    fresh: true,
    fields: {
      fld8lFmpecZG7cdaQ: "n", fldj3FAAYKeGMKuhG: "complaint", fldvm1aIsRmvMO4EQ: "author", fldIucKCQWOnZp1Bi: "date",
      fldm2HjE7PEN3hU0n: "notes", fldglDofWQ9vufOCk: "documents", fldi7g5q1MalmVyla: "letter_type", fldQeNqc0kHjt8Jki: "letter_text",
      fld3vGp10i4Rtbmjo: "type", fldobe9YSssCoqTED: "with", fldenMKQCNzFzAtS3: "status_set"
    }
  },
  adminlog: {
    id: "tblBXzNsCIKILpPgR",
    fresh: true,
    fields: { fldZhKXGNU19DESBK: "summary", fldCeen1cs82bzow6: "action", fldbB0o7a0SkFuGbD: "by", fldV6FrXvm9CEIt22: "person", fldeAZYCVVfulrBQC: "details", fld9veSoNZh6HPUr5: "when" }
  },
  templates: {
    id: "tbloGcnfTRAu5niHD",
    fields: { flddS63Z2Z3VePtf6: "type", fldb2G8PeGIWb2asU: "recipient", fldsGhPHEA7ozb2qw: "subject", fldLkj53XhzL9NcLM: "body", fldcAeqUTpGRiUYBH: "sort", fldulDctWvFGvIlkc: "inactive" }
  }
};
for (const t of Object.values(TABLES)) t.ids = Object.fromEntries(Object.entries(t.fields).map(([id, name]) => [name, id]));

const cache = new Map();
const TTL = 60e3;

// Attachments keep { id, filename, size, type, url }; links arrive as record ID arrays; selects as { name }.
const flat = (v) => {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === "object" ? (x.filename !== undefined ? { id: x.id, filename: x.filename, size: x.size, type: x.type, url: x.url } : x.name ?? x.id ?? null) : x));
  if (typeof v === "object") return v.name ?? null;
  return v;
};

const row = (t, r) => {
  const o = { id: r.id, created: r.createdTime || "" };
  for (const [fid, name] of Object.entries(t.fields)) o[name] = flat(r.fields[fid]);
  return o;
};

async function readAll(t, extra = {}) {
  const rows = [];
  let offset;
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ pageSize: "100", returnFieldsByFieldId: "true", ...extra });
    Object.keys(t.fields).forEach((f) => qs.append("fields[]", f));
    if (offset) qs.set("offset", offset);
    const data = await request(`${t.id}?${qs}`);
    for (const r of data.records) rows.push(row(t, r));
    offset = data.offset;
    if (!offset) break;
  }
  return rows;
}

export async function readTable(key) {
  const t = TABLES[key];
  const hit = cache.get(key);
  if (!t.fresh && hit && Date.now() - hit.at < TTL) return hit.rows;
  const rows = await readAll(t);
  cache.set(key, { at: Date.now(), rows });
  return rows;
}

// Records by ID (e.g. one complaint's updates). IDs are validated so they are safe inside the formula.
export async function readByIds(key, ids) {
  const clean = (ids || []).filter((id) => /^rec[A-Za-z0-9]{14}$/.test(id));
  if (!clean.length) return [];
  const out = [];
  for (let i = 0; i < clean.length; i += 50) {
    const f = `OR(${clean.slice(i, i + 50).map((id) => `RECORD_ID()='${id}'`).join(",")})`;
    out.push(...(await readAll(TABLES[key], { filterByFormula: f })));
  }
  return out;
}

export async function readOne(key, id) {
  if (!/^rec[A-Za-z0-9]{14}$/.test(String(id || ""))) return null;
  const t = TABLES[key];
  try {
    return row(t, await request(`${t.id}/${id}?returnFieldsByFieldId=true`));
  } catch (e) {
    if (/Airtable 404/.test(e.message)) return null;
    throw e;
  }
}

export const clearCache = () => cache.clear();

export async function create(key, values) {
  const t = TABLES[key];
  const out = await request(`${t.id}?returnFieldsByFieldId=true`, { method: "POST", body: { fields: toFields(t, values), typecast: true } });
  clearCache();
  return row(t, out);
}

export async function update(key, id, values) {
  const t = TABLES[key];
  const out = await request(`${t.id}/${id}?returnFieldsByFieldId=true`, { method: "PATCH", body: { fields: toFields(t, values), typecast: true } });
  clearCache();
  return row(t, out);
}

function toFields(t, values) {
  const f = {};
  for (const [name, v] of Object.entries(values)) {
    if (!t.ids[name]) throw new Error(`Unknown field ${name}`);
    f[t.ids[name]] = v;
  }
  return f;
}

// Adds one file to an attachment field (Airtable's upload endpoint, up to 5 MB).
export async function uploadAttachment(key, recordId, field, { filename, contentType, base64 }) {
  const t = TABLES[key];
  const res = await fetch(`https://content.airtable.com/v0/${BASE}/${recordId}/${t.ids[field]}/uploadAttachment`, {
    method: "POST",
    headers: { authorization: `Bearer ${env("AIRTABLE_TOKEN")}`, "content-type": "application/json" },
    body: JSON.stringify({ contentType, filename, file: base64 })
  });
  if (!res.ok) throw new Error(`Airtable upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
  clearCache();
  return res.json();
}

export async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${path}`, {
    method,
    headers: { authorization: `Bearer ${env("AIRTABLE_TOKEN")}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
