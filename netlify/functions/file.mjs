// GET /api/file?c=rec…&a=att… (add &u=rec… for a progress update's document) · v01 (2026-11-04)
// Checks the person may see that file, then redirects to Airtable's short-lived attachment link.
// Owners may open their own uploads and release form; progress documents need full access.
import { json, redirect } from "../lib/core.mjs";
import { readOne } from "../lib/airtable.mjs";
import { requirePerson, viewOf } from "../lib/access.mjs";

const GONE = () => json({ error: "That file was not found." }, 404);

export default async (req) => {
  try {
    const me = await requirePerson(req);
    if (me instanceof Response) return me;
    const q = new URL(req.url).searchParams;
    const c = await readOne("complaints", q.get("c"));
    const view = viewOf(me, c);
    if (!view) return GONE();
    let list = [...(c.uploads || []), ...(c.release || [])];
    if (q.get("u")) {
      if (view !== "full") return GONE();
      const u = await readOne("updates", q.get("u"));
      list = u && (u.complaint || []).includes(c.id) ? u.documents || [] : [];
    }
    const f = list.find((x) => x.id === q.get("a"));
    if (!f || !f.url) return GONE();
    return redirect(f.url);
  } catch (e) {
    console.error("file", e.message);
    return json({ error: "Could not open the file. Please try again." }, 502);
  }
};

export const config = { path: "/api/file" };
