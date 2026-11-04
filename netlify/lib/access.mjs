// Mediation portal access v02 (2026-11-04). Who is signed in and what they may see and do.
// v02: View as. requirePerson() returns the *effective* person (the one being viewed, if any), with .real and
// .viewing set; write endpoints call refuseIfViewing(). Staff-only tools check the real person with requireStaff().
// The single place these rules live (docs/phase2-portal-spec.md, docs/admin-and-view-as-spec.md).
// The person is re-read from People on every request (60-second cache), so unticking Active ends access.
import { json, sessionEmail, viewAsClaim } from "./core.mjs";
import { readTable } from "./airtable.mjs";

const norm = (e) => String(e || "").trim().toLowerCase();

// The access flags for one People row (whether or not they could sign in).
export function personFromRow(p) {
  const roles = p.roles || [];
  return {
    id: p.id, email: norm(p.email), name: p.name || norm(p.email),
    staff: !!p.active && roles.includes("Staff"),
    facilitator: !!p.active && roles.includes("Facilitator"),
    owner: (p.owns || []).length > 0,
    admin: !!p.admin && !!p.active
  };
}
const canSignIn = (me) => me.staff || me.facilitator || me.owner;

// { id, email, name, staff, facilitator, owner, admin } for someone who may sign in, otherwise null.
export async function personByEmail(email) {
  const e = norm(email);
  if (!e) return null;
  const p = (await readTable("people")).find((r) => norm(r.email) === e);
  if (!p) return null;
  const me = personFromRow(p);
  return canSignIn(me) ? me : null;
}

export async function personById(id) {
  const p = (await readTable("people")).find((r) => r.id === id);
  return p ? personFromRow(p) : null;
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

// What the person may do with this complaint. (While viewing as someone, write endpoints refuse first.)
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

// The real signed-in person, and the person being viewed (if a valid View as cookie is present).
// The cookie counts only if it was started by this same person and they are still active Staff.
export async function who(req) {
  const real = await personByEmail(sessionEmail(req));
  if (!real) return { real: null, me: null, viewing: null };
  const v = viewAsClaim(req);
  if (v && v.by === real.id && real.staff) {
    const target = await personById(v.as);
    if (target) return { real, me: target, viewing: { id: target.id, name: target.name, can_sign_in: canSignIn(target), until: v.exp } };
  }
  return { real, me: real, viewing: null };
}

// The effective person (the viewed one while viewing), or a 401 Response.
export async function requirePerson(req) {
  const w = await who(req);
  if (!w.real) return json({ error: "Please sign in." }, 401);
  return Object.assign({}, w.me, { real: w.real, viewing: w.viewing });
}

// The real person if they are Staff and not viewing as someone, otherwise a 401/403 Response.
export async function requireStaff(req) {
  const w = await who(req);
  if (!w.real) return json({ error: "Please sign in." }, 401);
  if (!w.real.staff) return json({ error: "You don't have access to do that." }, 403);
  if (w.viewing) return json({ error: `You are viewing as ${w.viewing.name}. Stop viewing to make changes.` }, 403);
  return w.real;
}

// For every write: a 403 Response while viewing as someone, otherwise null.
export const refuseIfViewing = (me) =>
  me && me.viewing ? json({ error: `You are viewing as ${me.viewing.name}. Stop viewing to make changes.` }, 403) : null;
