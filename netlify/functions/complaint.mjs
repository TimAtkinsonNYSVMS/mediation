// GET /api/complaint?id=rec… and POST /api/complaint/<action> · v04 (2026-11-06). v04: update can also set the status and
// the next step in the same save; close (resolution + Completed in one step); vet_email; next_step. v03 (2026-11-06). v03: updates record a Type and With;
// status changes and assignments write a dated Progress Update row (feeds the owner Activity list). v02 (2026-11-04). v02: every action is refused while viewing as someone.
// Actions: update (log progress, optionally a drafted letter, status, next step), status, resolution, close, vet_email, next_step, assign, feedback.
// Every check is in access.mjs (viewOf, can, statusAllowed); this file only applies the change.
import { body, checkPost, json } from "../lib/core.mjs";
import { readOne, create, update } from "../lib/airtable.mjs";
import { requirePerson, viewOf, can, statusAllowed, facilitators, refuseIfViewing } from "../lib/access.mjs";
import { detail, noticeAssigned, noticeUpdate, noticeStatus, noticeFeedback } from "../lib/complaints.mjs";

const NOT_FOUND = json({ error: "That request was not found." }, 404);
const NO = () => json({ error: "You don't have access to do that." }, 403);
const text = (v, max = 20000) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const now = () => new Date().toISOString();

// Sets the status and writes the dated Status change row the Activity lists are built from.
async function setStatus(c, me, status) {
  await update("complaints", c.id, { status });
  await create("updates", { complaint: [c.id], author: [me.id], date: now(), type: "Status change", status_set: status, notes: `Status changed from "${c.status || "Awaiting assignment"}" to "${status}"` });
  await noticeStatus(c, me, status);
}

const stars = (v) => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : null; };

export default async (req) => {
  try {
    const me = await requirePerson(req);
    if (me instanceof Response) return me;
    const url = new URL(req.url);

    if (req.method === "GET") {
      const c = await readOne("complaints", url.searchParams.get("id"));
      if (!c || !viewOf(me, c)) return NOT_FOUND.clone();
      return json(await detail(me, c));
    }

    const bad = checkPost(req) || refuseIfViewing(me);
    if (bad) return bad;
    const b = await body(req);
    const c = await readOne("complaints", b.id);
    if (!c || !viewOf(me, c)) return NOT_FOUND.clone();
    const action = url.pathname.split("/").pop();

    if (action === "update") {
      if (!can(me, "work", c)) return NO();
      const notes = text(b.notes), letter_type = text(b.letter_type, 200), letter_text = text(b.letter_text);
      if (!notes && !letter_text) return json({ error: "Write the update first." }, 400);
      const status = b.status ? String(b.status) : null;
      if (status && !statusAllowed(me, status)) return json({ error: "That status can't be set here." }, 400);
      if (status === "Completed") return json({ error: "Use Close request to complete a request." }, 400);
      const type = letter_type ? "Letter" : ["Call", "Email", "Note"].includes(b.type) ? b.type : "Note";
      const withWho = ["Owner", "Veterinarian", "Other"].includes(b.with) ? b.with : null;
      const u = await create("updates", { complaint: [c.id], author: [me.id], date: new Date().toISOString(), notes, type, ...(withWho && type !== "Note" ? { with: withWho } : {}),
        ...(letter_type ? { letter_type } : {}), ...(letter_text ? { letter_text } : {}) });
      await noticeUpdate(c, me, notes || `Letter sent: ${letter_type}`);
      if (typeof b.next_step === "string") await update("complaints", c.id, { next_step: text(b.next_step, 200) });
      if (status && status !== (c.status || "Awaiting assignment")) await setStatus(c, me, status);
      return json({ ok: true, update: u.id });
    }

    if (action === "status") {
      if (!can(me, "work", c)) return NO();
      if (!statusAllowed(me, b.status)) return json({ error: "That status can't be set here." }, 400);
      if (b.status === c.status) return json({ ok: true });
      await setStatus(c, me, b.status);
      return json({ ok: true });
    }

    if (action === "resolution") {
      if (!can(me, "work", c)) return NO();
      await update("complaints", c.id, { resolution: text(b.resolution, 500), resolution_notes: text(b.resolution_notes) });
      return json({ ok: true });
    }

    if (action === "close") {
      if (!can(me, "work", c)) return NO();
      const resolution = text(b.resolution, 500);
      if (!resolution) return json({ error: "Write the resolution the owner will see." }, 400);
      await update("complaints", c.id, { resolution, resolution_notes: text(b.resolution_notes), next_step: "" });
      if (c.status !== "Completed") await setStatus(c, me, "Completed");
      return json({ ok: true });
    }

    if (action === "vet_email") {
      if (!can(me, "work", c)) return NO();
      const email = text(b.email, 200).toLowerCase();
      if (!EMAIL.test(email)) return json({ error: "Enter a valid email address." }, 400);
      await update("complaints", c.id, { vet_email: email });
      await create("updates", { complaint: [c.id], author: [me.id], date: now(), type: "Note", notes: `Veterinarian's email set to ${email}` });
      return json({ ok: true });
    }

    if (action === "next_step") {
      if (!can(me, "work", c)) return NO();
      await update("complaints", c.id, { next_step: text(b.next_step, 200) });
      return json({ ok: true });
    }

    if (action === "assign") {
      if (!can(me, "assign", c)) return NO();
      const fac = (await facilitators()).find((f) => f.id === b.facilitator && f.active);
      if (!fac) return json({ error: "Choose an active facilitator." }, 400);
      if ((c.facilitator || []).includes(fac.id)) return json({ ok: true });
      const status = ["Awaiting assignment", "Asking mediator to accept"].includes(c.status || "Awaiting assignment") ? "Mediator Assigned" : c.status;
      await update("complaints", c.id, { facilitator: [fac.id], status });
      await create("updates", { complaint: [c.id], author: [me.id], date: now(), type: "Assigned", status_set: fac.name, notes: `${fac.name} assigned as facilitator by ${me.name}` });
      await noticeAssigned({ ...c, status }, fac, me);
      return json({ ok: true });
    }

    if (action === "feedback") {
      if (!can(me, "feedback", c)) return json({ error: "Feedback has already been sent for this request." }, 400);
      const overall = stars(b.overall);
      if (!overall) return json({ error: "Choose a rating for the overall process." }, 400);
      await update("complaints", c.id, {
        fb_date: new Date().toISOString(), fb_overall: overall, fb_facilitator: stars(b.facilitator), fb_value: stars(b.value),
        fb_admin: stars(b.admin), fb_comments: text(b.comments, 5000)
      });
      await noticeFeedback(c);
      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 404);
  } catch (e) {
    console.error("complaint", e.message);
    return json({ error: "Something went wrong. Please try again." }, 502);
  }
};

export const config = { path: ["/api/complaint", "/api/complaint/*"] };
