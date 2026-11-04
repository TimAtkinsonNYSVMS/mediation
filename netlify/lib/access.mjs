// Complaints portal access v01 (2026-11-04). Who is signed in and what they may see and do.
// The single place these rules live (docs/phase2-portal-spec.md); every endpoint asks here.
// The person is re-read from People on every request (60-second cache), so unticking Active ends access.
import { json, sessionEmail } from "./core.mjs";
import { readTable } from "./airtable.mjs";

const norm = (e) => String(e || "").trim().toLowerCase();

// { id, email, name, staff, facilitator, owner, admin } for someone who may sign in, otherwise null.
export async function personByEmail(email) {
  const e = norm(email);
  if (!e) return null;
  const p = (await readTable("people")).find((r) => norm(r.email) === e);
  if (!p) return null;
  const roles = p.roles || [];
  const me = {
    id: p.id, email: e, name: p.name || e,
    staff: !!p.active && roles.includes("Staff"),
    facilitator: !!p.active && roles.includes("Facilitator"),
    owner: (p.owns || []).length > 0,
    admin: !!p.admin && !!p.active
  };
  return me.staff || me.facilitator || me.owner ? me : null;
}

export const activeStaff = async () =>
  (await readTable("people")).filter((p) => p.active && (p.roles || []).includes("Staff") && p.email).map((p) => ({ id: p.id, email: norm(p.email), name: p.name || "" }));

export const facilitators = async () =>
  (await readTable("people")).filter((p) => (p.roles || []).includes("Facilitator")).map((p) => ({ id: p.id, name: p.name || p.email, email: norm(p.email), region: p.region || "", active: !!p.active }));

const has = (list, id) => (list || []).includes(id);

// "full", "owner" or null: how much of this complaint the person may see.
export function viewOf(me, c) {
  if (!me || !c) return null;
  if (me.staff) return "full";
  if (me.facilitator && has(c.facilitator, me.id)) return "full";
  if (has(c.owner, me.id)) return "owner";
  return null;
}

// What the person may do with this complaint.
export function can(me, action, c) {
  const view = viewOf(me, c);
  switch (action) {
    case "work": // progress updates, documents, status, resolution, letters
      return view === "full";
    case "assign":
      return !!me?.staff && !!c;
    case "feedback":
      return view === "owner" && c.status === "Completed" && !c.fb_date;
    default:
      return false;
  }
}

// Statuses a facilitator may set (staff may set any).
export const STATUSES = ["Awaiting assignment", "Asking mediator to accept", "Mediator Assigned", "Mediator waiting for owner to respond",
  "Mediator waiting for veterinarian to respond", "Mediation in progress", "Completed", "Withdrawn"];
export const statusAllowed = (me, s) => STATUSES.includes(s) && (me.staff || !["Awaiting assignment", "Asking mediator to accept"].includes(s));

// The signed-in person, or a 401 Response.
export async function requirePerson(req) {
  const me = await personByEmail(sessionEmail(req));
  return me || json({ error: "Please sign in." }, 401);
}
