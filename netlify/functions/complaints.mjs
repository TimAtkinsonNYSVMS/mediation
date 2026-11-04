// GET /api/complaints · v01 (2026-11-04). The complaints this person may see, newest first.
// Staff: all. Facilitators: those assigned to them. Owners: their own. One person can be more than one.
import { json } from "../lib/core.mjs";
import { readTable } from "../lib/airtable.mjs";
import { requirePerson, viewOf } from "../lib/access.mjs";
import { listItem, peopleById } from "../lib/complaints.mjs";

export default async (req) => {
  try {
    const me = await requirePerson(req);
    if (me instanceof Response) return me;
    const people = await peopleById();
    const mine = [], assigned = [];
    for (const c of await readTable("complaints")) {
      const view = viewOf(me, c);
      if (!view) continue;
      if ((c.owner || []).includes(me.id)) mine.push(listItem(c, people, "owner"));
      if (view === "full") assigned.push({ ...listItem(c, people, "full"), assigned_to_me: (c.facilitator || []).includes(me.id) });
    }
    const byN = (a, b) => (b.n || 0) - (a.n || 0);
    return json({ mine: mine.sort(byN), work: assigned.sort(byN) });
  } catch (e) {
    console.error("complaints", e.message);
    return json({ error: "Could not load complaints. Please try again." }, 502);
  }
};

export const config = { path: "/api/complaints" };
