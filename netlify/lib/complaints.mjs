// Mediation portal domain v04 (2026-11-06). v04: new status names; possible duplicates (same owner, same vet, within 14 days).
// v03 (2026-11-06). v03: next_step in staff/facilitator lists and detail.
// v02 (2026-11-06). v02: owner-facing status names, "what's happening" text and the owner Activity list
// (built here from fixed sentences, never from notes). v01 (2026-11-04). Shapes complaints for each kind of viewer, numbers new complaints,
// and builds the notification emails that replaced the 5 Knack email rules (docs/phase2-portal-spec.md).
import { env } from "./core.mjs";
import { readTable, readByIds } from "./airtable.mjs";
import { viewOf, can, activeStaff, statusAllowed, STATUSES } from "./access.mjs";
import { notify } from "./mail.mjs";
import { CLOSED } from "./statuses.mjs";

export const portalUrl = () => env("PORTAL_URL", "https://mediation.nysvms.org");
const first = (a) => (Array.isArray(a) ? a[0] : a) || null;
const files = (list) => (list || []).map((f) => ({ id: f.id, filename: f.filename, size: f.size || 0, type: f.type || "" }));

// Owner-facing wording for the stored statuses (the stored values are renamed later, with the staff redesign).
export const OWNER_STATUS = {
  "Awaiting assignment": "Awaiting assignment", "Facilitator assigned": "Facilitator assigned", "Mediation in progress": "Mediation in progress",
  "Waiting on the veterinarian": "Waiting on the veterinarian", "Waiting on the owner": "Waiting for your reply", "Completed": "Completed",
  "Closed without resolution": "Closed without resolution"
};
export const ownerStatus = (s) => OWNER_STATUS[s || "Awaiting assignment"] || s;
const firstName = (n) => String(n || "").replace(/^Dr\.?\s+/i, "Dr. ");

// The owner's Activity list: dated, fixed sentences. Notes, letter text and anything with "Other" are never included.
export function ownerActivity(c, updates, people) {
  const vet = c.vet_name ? (/^dr\.?\s/i.test(c.vet_name) ? c.vet_name : `Dr. ${c.vet_name}`) : "the veterinarian";
  const out = [{ date: c.received, kind: "sent", text: "You sent your request" }];
  for (const u of updates) {
    const who = firstName(people.get(first(u.author))?.name) || "Your facilitator";
    const lt = String(u.letter_type || "").toLowerCase();
    let kind = null, text = null;
    if (u.type === "Assigned") { kind = "assigned"; text = `${u.status_set || "A volunteer veterinarian"} assigned as your facilitator`; }
    else if (u.type === "Status change" && u.status_set) { kind = u.status_set === "Completed" ? "done" : "status"; text = u.status_set === "Completed" ? "Your request was completed" : ownerStatus(u.status_set); }
    else if ((u.type === "Call" || u.type === "Email") && u.with === "Owner") { kind = "contact"; text = `${who} ${u.type === "Call" ? "called" : "emailed"} you`; }
    else if ((u.type === "Call" || u.type === "Email") && u.with === "Veterinarian") { kind = "contact"; text = `Your facilitator ${u.type === "Call" ? "called" : "emailed"} ${vet}`; }
    else if (u.type === "Letter" || lt) {
      const to = u.with || (/animal owner|complainant|owner/.test(lt) ? "Owner" : /veterinarian/.test(lt) ? "Veterinarian" : "");
      if (to === "Owner") { kind = "contact"; text = "Your facilitator wrote to you"; }
      else if (to === "Veterinarian") { kind = "contact"; text = `Your facilitator wrote to ${vet}`; }
    }
    if (text) out.push({ date: u.date, kind, text });
  }
  // Newest first; on a tie (same timestamp) "You sent your request" stays at the bottom, where it happened.
  return out.map((a, i) => ({ ...a, i })).sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.i - a.i).map(({ i, ...a }) => a);
}

export async function peopleById() {
  return new Map((await readTable("people")).map((p) => [p.id, p]));
}

// Possible duplicates: the same owner about the same vet (name compared loosely) filed within 14 days of an earlier request.
// Returns Map(id -> number of the earlier request).
const vetKey = (v) => String(v || "").toLowerCase().replace(/\b(dr|dvm|vmd)\b\.?/g, "").replace(/[^a-z]/g, "");
export function duplicates(all) {
  const out = new Map();
  const sorted = [...all].sort((a, b) => String(a.received).localeCompare(String(b.received)) || (a.n || 0) - (b.n || 0));
  sorted.forEach((c, i) => {
    const owner = first(c.owner), key = vetKey(c.vet_name);
    if (!owner || !key) return;
    const earlier = sorted.slice(0, i).find((p) => first(p.owner) === owner && vetKey(p.vet_name) === key && !out.has(p.id)
      && Math.abs(new Date(c.received) - new Date(p.received)) <= 14 * 864e5);
    if (earlier) out.set(c.id, earlier);
  });
  return out;
}

// One row of a list.
export function listItem(c, people, view, dups) {
  const fac = people.get(first(c.facilitator));
  const item = {
    id: c.id, n: c.n, received: c.received, status: c.status || "Awaiting assignment", subject: c.subject || "",
    vet_name: c.vet_name || "", practice: c.practice || "", facilitator: fac ? fac.name : "",
    last_activity: c.last_update || (c.received || "").slice(0, 10)
  };
  if (view === "owner") { item.owner_status = ownerStatus(item.status); if (c.status === "Completed") { item.resolution = c.resolution || ""; item.can_feedback = !c.fb_date; } }
  if (view === "full") {
    const owner = people.get(first(c.owner));
    item.owner = owner ? owner.name : "";
    item.region = fac?.region || "";
    item.next_step = c.next_step || "";
    if (dups?.has(c.id)) item.duplicate_of = dups.get(c.id).n;
  }
  return item;
}

// The detail view. "owner" leaves out progress notes and other people's contact details.
export async function detail(me, c) {
  const view = viewOf(me, c);
  const people = await peopleById();
  const fac = people.get(first(c.facilitator));
  const owner = people.get(first(c.owner));
  const base = {
    id: c.id, n: c.n, view, received: c.received, status: c.status || "Awaiting assignment", subject: c.subject || "",
    description: c.description || "", vet_name: c.vet_name || "", practice: c.practice || "",
    facilitator: fac ? { id: fac.id, name: fac.name || "" } : null,
    uploads: files(c.uploads), release: files(c.release), records_ok: !!c.records_ok,
    can_feedback: can(me, "feedback", c), feedback_given: !!c.fb_date
  };
  if (c.status === "Completed") base.resolution = c.resolution || "";
  const raw = await readByIds("updates", c.updates);
  if (view === "owner") {
    if (fac) base.facilitator.region = fac.region || "";
    return { ...base, owner_status: ownerStatus(base.status), activity: ownerActivity(c, raw, people) };
  }
  const updates = raw.map((u) => {
    const a = people.get(first(u.author));
    return { id: u.id, n: u.n, date: u.date, author: a ? a.name : "", notes: u.notes || "", letter_type: u.letter_type || "", letter_text: u.letter_text || "", documents: files(u.documents), type: u.type || "", with: u.with || "", status_set: u.status_set || "" };
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.n || 0) - (a.n || 0));
  const dup = duplicates(await readTable("complaints")).get(c.id);
  return {
    ...base, duplicate_of: dup ? { id: dup.id, n: dup.n } : null,
    owner: owner ? { name: owner.name || "", email: owner.email || "", phone: owner.phone || "", address: owner.address || "" } : null,
    facilitator: fac ? { id: fac.id, name: fac.name || "", email: fac.email || "", region: fac.region || "" } : null,
    vet_email: c.vet_email || "", practice_address: c.practice_address || "", next_step: c.next_step || "",
    attestations: { member: !!c.a_member, legal: !!c.a_legal, opd: !!c.a_opd, fees: !!c.a_fees, service: !!c.a_service, terms: !!c.a_terms },
    resolution: c.resolution || "", resolution_notes: c.resolution_notes || "",
    feedback: c.fb_date ? { date: c.fb_date, overall: c.fb_overall, value: c.fb_value, facilitator: c.fb_facilitator, admin: c.fb_admin, comments: c.fb_comments || "" } : null,
    updates, can_assign: can(me, "assign", c), can_work: can(me, "work", c), closed: CLOSED.includes(base.status),
    statuses: STATUSES.filter((s) => statusAllowed(me, s) || s === c.status)
  };
}

export async function nextNumber() {
  const ns = (await readTable("complaints")).map((c) => Number(c.n) || 0);
  return Math.max(316, ...ns) + 1;
}

// ---- notices (never throw) ----
const link = (c) => `${portalUrl()}/#/c/${c.id}`;
const others = (list, me) => list.filter((p) => !me || p.email !== me.email);

export async function noticeNewComplaint(c, owner) {
  const first = String(owner.name || "").split(" ")[0] || "there";
  await notify([{ email: owner.email, name: owner.name }], "We have received your request for mediation",
    `Dear ${first},\n\nThank you for contacting the NYSVMS mediation service. We have received your request about ${c.vet_name}, request #${c.n}.\n\n` +
    `The next stage is that we will assign a volunteer veterinarian who will review your request, and you should hear from them shortly.\n\n` +
    `You can check on your request at any time: ${portalUrl()}\nSign in with this email address and we will send you a code.\n\n` +
    `If you have any questions in the meantime, please email staff@nysvms.org.\n\nNew York State Veterinary Medical Society`);
  await notify([{ email: env("STAFF_INBOX", "staff@nysvms.org"), name: "NYSVMS staff" }], `New mediation request #${c.n}: ${c.subject}`,
    `A new mediation request has been filed.\n\nRequest #${c.n}\nFrom: ${owner.name}\nAbout: ${c.vet_name}${c.practice ? `, ${c.practice}` : ""}\nSubject: ${c.subject}\n\nAssign a facilitator: ${link(c)}`);
}

export async function noticeAssigned(c, fac, me) {
  const staff = others(await activeStaff(), me);
  await notify([{ email: fac.email, name: fac.name }], `Request #${c.n} assigned to you for mediation`,
    `New facilitator assignment for ${fac.name}.\n\nYou have been asked to facilitate mediation request #${c.n}, received ${String(c.received || "").slice(0, 10)}.\nSubject: ${c.subject}\n\n` +
    `Open it in the mediation portal: ${link(c)}\nSign in with this email address and we will send you a code.\n\nIf you have any questions or can't take this on, please reply to staff@nysvms.org.`);
  if (staff.length) await notify(staff, `Request #${c.n} assigned to ${fac.name}`, `${me?.name || "Staff"} assigned request #${c.n} (${c.subject}) to ${fac.name}.\n\n${link(c)}`);
}

export async function noticeUpdate(c, me, notes) {
  await notify(others(await activeStaff(), me), `Update on request #${c.n}`, `${me.name} added an update to request #${c.n} (${c.subject}):\n\n${notes}\n\n${link(c)}`);
}

export async function noticeStatus(c, me, status) {
  await notify(others(await activeStaff(), me), `Request #${c.n} is now: ${status}`, `${me.name} changed the status of request #${c.n} (${c.subject}) to "${status}".\n\n${link(c)}`);
}

export async function noticeFeedback(c) {
  await notify(await activeStaff(), `Feedback received on request #${c.n}`, `The owner left feedback on request #${c.n} (${c.subject}).\n\n${link(c)}`);
}
