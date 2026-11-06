// Admin page and View as · v01 (2026-11-04). docs/admin-and-view-as-spec.md
//   GET  /api/admin/people        everyone in People with roles and request counts (Staff only)
//   POST /api/admin/person        change someone (id) or add someone (no id) (Staff only)
//   POST /api/view-as             start viewing as { id } (Staff only)
//   POST /api/view-as/stop        stop viewing
// Staff checks use the real signed-in person and are refused while viewing as someone. Every change, and every
// View as start and stop, writes an Admin Log row.
import { body, checkPost, json, viewAsCookie, clearViewAs, viewAsClaim } from "../lib/core.mjs";
import { readTable, create, update } from "../lib/airtable.mjs";
import { requireStaff, who, personById } from "../lib/access.mjs";
import { normEmail } from "../lib/otp.mjs";

const REGIONS = ["Capital District", "Catskill", "Central NY", "Finger Lakes", "Genesee Valley", "Hudson Valley", "Long Island", "NYC",
  "Northern NY", "Southern Tier", "Western NY", "Westchester/Rockland"];
import { CLOSED } from "../lib/statuses.mjs";
const text = (v, max) => String(v ?? "").trim().slice(0, max);

async function log(action, by, person, summary, details = "") {
  try {
    await create("adminlog", { action, summary: summary.slice(0, 250), by: [by.id], ...(person ? { person: [person] } : {}), details });
  } catch (e) {
    console.error("admin log", e.message); // a failed log line must not undo the change
  }
  console.log(`[admin] ${summary}`);
}

async function people() {
  const cs = await readTable("complaints");
  return (await readTable("people")).map((p) => {
    const roles = p.roles || [];
    const mine = cs.filter((c) => (c.owner || []).includes(p.id) || (c.facilitator || []).includes(p.id));
    return {
      id: p.id, name: p.name || "", email: p.email || "", region: p.region || "", active: !!p.active,
      staff: roles.includes("Staff"), facilitator: roles.includes("Facilitator"), owner: (p.owns || []).length > 0,
      open: mine.filter((c) => !CLOSED.includes(c.status)).length, total: mine.length
    };
  }).sort((a, b) => (b.staff - a.staff) || (b.facilitator - a.facilitator) || a.name.localeCompare(b.name));
}

const describe = (p) => [p.staff && "Staff", p.facilitator && "Facilitator", p.active ? "Active" : "Inactive", p.region || "no region"].filter(Boolean).join(", ");

export default async (req) => {
  const path = new URL(req.url).pathname;
  try {
    if (path === "/api/view-as/stop") {
      const bad = checkPost(req);
      if (bad) return bad;
      const w = await who(req);
      const claim = viewAsClaim(req);
      if (w.real && w.viewing) await log("View as stopped", w.real, w.viewing.id, `${w.real.name} stopped viewing as ${w.viewing.name}`);
      else if (w.real && claim) await log("View as stopped", w.real, null, `${w.real.name} stopped viewing as someone`);
      return json({ ok: true }, 200, { "set-cookie": clearViewAs });
    }

    const me = await requireStaff(req);
    if (me instanceof Response) return me;

    if (req.method === "GET" && path === "/api/admin/people") return json({ people: await people(), regions: REGIONS, me: me.id });

    const bad = checkPost(req);
    if (bad) return bad;
    const b = await body(req);

    if (path === "/api/view-as") {
      const target = await personById(b.id);
      if (!target) return json({ error: "That person was not found." }, 404);
      if (target.id === me.id) return json({ error: "That's you." }, 400);
      await log("View as started", me, target.id, `${me.name} started viewing as ${target.name}`);
      return json({ ok: true, name: target.name }, 200, { "set-cookie": viewAsCookie(me.id, target.id) });
    }

    if (path === "/api/admin/person") {
      const region = b.region && REGIONS.includes(b.region) ? b.region : "";
      const roles = [b.staff === true && "Staff", b.facilitator === true && "Facilitator"].filter(Boolean);
      const name = text(b.name, 120);
      if (!name) return json({ error: "Add a name." }, 400);
      const all = await readTable("people");

      if (!b.id) {
        const email = normEmail(b.email);
        if (!email) return json({ error: "Add a valid email." }, 400);
        if (all.some((p) => String(p.email || "").toLowerCase() === email)) return json({ error: "Someone with that email is already in the list." }, 400);
        const p = await create("people", { email, name, roles, active: b.active === true, region: region || null });
        const after = { staff: roles.includes("Staff"), facilitator: roles.includes("Facilitator"), active: b.active === true, region };
        await log("Person added", me, p.id, `${me.name} added ${name}`, `${email}: ${describe(after)}`);
        return json({ ok: true, id: p.id });
      }

      const row = all.find((p) => p.id === b.id);
      if (!row) return json({ error: "That person was not found." }, 404);
      if (row.id === me.id && (!roles.includes("Staff") || b.active !== true)) return json({ error: "You can't remove your own Staff role or Active. Ask another staff member." }, 400);
      const keep = (row.roles || []).filter((r) => !["Staff", "Facilitator"].includes(r)); // any other role stays as it is
      const before = { staff: (row.roles || []).includes("Staff"), facilitator: (row.roles || []).includes("Facilitator"), active: !!row.active, region: row.region || "" };
      const after = { staff: roles.includes("Staff"), facilitator: roles.includes("Facilitator"), active: b.active === true, region };
      await update("people", row.id, { name, roles: [...keep, ...roles], active: b.active === true, region: region || null });
      const changes = [];
      if (name !== (row.name || "")) changes.push(`name "${row.name || ""}" → "${name}"`);
      for (const k of ["staff", "facilitator", "active"]) if (before[k] !== after[k]) changes.push(`${k} ${before[k] ? "on" : "off"} → ${after[k] ? "on" : "off"}`);
      if (before.region !== after.region) changes.push(`region "${before.region}" → "${after.region}"`);
      if (changes.length) await log("Person changed", me, row.id, `${me.name} changed ${name}: ${changes.join("; ")}`.slice(0, 250), changes.join("\n"));
      return json({ ok: true });
    }

    return json({ error: "Not found." }, 404);
  } catch (e) {
    console.error("admin", e.message);
    return json({ error: "Something went wrong. Please try again." }, 502);
  }
};

export const config = { path: ["/api/admin/people", "/api/admin/person", "/api/view-as", "/api/view-as/stop"] };
