// GET /api/facilitators · v02 (2026-11-06). v02: new status names; stalled count (open, no activity in 90+ days). v01 (2026-11-04). Staff only: every facilitator with their open and total assignments.
import { json } from "../lib/core.mjs";
import { readTable } from "../lib/airtable.mjs";
import { requirePerson, facilitators } from "../lib/access.mjs";

import { CLOSED } from "../lib/statuses.mjs";
const stale = (c) => Date.now() - new Date(c.last_update || c.received || Date.now()) > 90 * 864e5;

export default async (req) => {
  try {
    const me = await requirePerson(req);
    if (me instanceof Response) return me;
    if (!me.staff) return json({ error: "You don't have access to do that." }, 403);
    const cs = await readTable("complaints");
    const out = (await facilitators()).map((f) => {
      const theirs = cs.filter((c) => (c.facilitator || []).includes(f.id));
      return { ...f, open: theirs.filter((c) => !CLOSED.includes(c.status)).length, stalled: theirs.filter((c) => !CLOSED.includes(c.status) && stale(c)).length, total: theirs.length };
    }).sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
    return json(out);
  } catch (e) {
    console.error("facilitators", e.message);
    return json({ error: "Could not load facilitators." }, 502);
  }
};

export const config = { path: "/api/facilitators" };
