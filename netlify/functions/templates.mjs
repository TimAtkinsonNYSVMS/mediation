// GET /api/templates · v01 (2026-11-04). Letter templates, for staff and facilitators only.
import { json } from "../lib/core.mjs";
import { readTable } from "../lib/airtable.mjs";
import { requirePerson } from "../lib/access.mjs";

export default async (req) => {
  try {
    const me = await requirePerson(req);
    if (me instanceof Response) return me;
    if (!me.staff && !me.facilitator) return json({ error: "You don't have access to do that." }, 403);
    const t = (await readTable("templates")).filter((x) => !x.inactive && x.type)
      .sort((a, b) => (a.sort || 99) - (b.sort || 99))
      .map((x) => ({ type: x.type, recipient: x.recipient || "Owner", subject: x.subject || "", body: x.body || "" }));
    return json(t);
  } catch (e) {
    console.error("templates", e.message);
    return json({ error: "Could not load the letters." }, 502);
  }
};

export const config = { path: "/api/templates" };
