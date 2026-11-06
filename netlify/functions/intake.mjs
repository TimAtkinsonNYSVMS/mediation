// POST /api/intake · v02 (2026-11-06). Public request form (no sign-in).
// v02: the 4-step form lets owners answer "I am not sure" on NYSVMS membership (member_unsure); the request is saved
// with Attest Vet Is Member unticked so staff check before assigning. Every other statement must still be confirmed.
// Finds or creates the owner in People by email, creates the complaint with the next number, emails the owner and the
// staff inbox, and returns a signed 30-minute ticket that lets the browser upload files to this one complaint.
import { body, checkPost, json, seal } from "../lib/core.mjs";
import { readTable, create, update } from "../lib/airtable.mjs";
import { normEmail } from "../lib/otp.mjs";
import { nextNumber, noticeNewComplaint } from "../lib/complaints.mjs";

const text = (v, max) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const ATTEST = ["a_legal", "a_opd", "a_fees", "a_service", "a_terms"]; // must all be true; a_member may be unsure

export default async (req) => {
  const bad = checkPost(req);
  if (bad) return bad;
  const b = await body(req);
  if (b.website) return json({ ok: true, n: 0 }); // honeypot: bots fill every field
  const email = normEmail(b.email);
  const f = {
    name: text(b.name, 120), phone: text(b.phone, 40), address: text(b.address, 300),
    vet_name: text(b.vet_name, 120), vet_email: normEmail(b.vet_email) || "", practice: text(b.practice, 160), practice_address: text(b.practice_address, 300),
    subject: text(b.subject, 160), description: text(b.description, 20000)
  };
  const missing = [];
  if (!f.name) missing.push("your name");
  if (!email) missing.push("a valid email");
  if (!f.vet_name) missing.push("the veterinarian's name");
  if (!f.subject) missing.push("a one-line summary");
  if (!f.description) missing.push("what happened");
  if (missing.length) return json({ error: `Please add ${missing.join(", ")}.` }, 400);
  if (!ATTEST.every((k) => b[k] === true) || !(b.a_member === true || b.member_unsure === true)) return json({ error: "Please answer each question on the first step." }, 400);
  try {
    let owner = (await readTable("people")).find((p) => String(p.email || "").toLowerCase() === email);
    if (!owner) owner = await create("people", { email, name: f.name, phone: f.phone, address: f.address });
    else {
      const fill = {};
      if (!owner.name) fill.name = f.name;
      if (!owner.phone && f.phone) fill.phone = f.phone;
      if (!owner.address && f.address) fill.address = f.address;
      if (Object.keys(fill).length) owner = await update("people", owner.id, fill);
    }
    const n = await nextNumber();
    const c = await create("complaints", {
      n, received: new Date().toISOString(), status: "Awaiting assignment", source: "Portal", owner: [owner.id],
      subject: f.subject, description: f.description, vet_name: f.vet_name, ...(f.vet_email ? { vet_email: f.vet_email } : {}),
      practice: f.practice, practice_address: f.practice_address, records_ok: b.records_ok === true,
      ...Object.fromEntries(ATTEST.map((k) => [k, true])), a_member: b.a_member === true
    });
    await noticeNewComplaint({ ...c, n }, { email, name: owner.name || f.name });
    return json({ ok: true, n, complaint: c.id, ticket: seal({ c: c.id, exp: Date.now() + 30 * 60e3 }) });
  } catch (e) {
    console.error("intake", e.message);
    return json({ error: "We couldn't save your request. Please try again, or email staff@nysvms.org." }, 502);
  }
};

export const config = { path: "/api/intake" };
