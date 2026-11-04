// GET /api/auth/session, POST /api/auth/logout · v02 (2026-11-04)
// v02: the session reports View as (viewing: { name, until }, real: { name }); sign-out also ends View as and logs it.
import { checkPost, clearSession, clearViewAs, json } from "../lib/core.mjs";
import { requirePerson, who } from "../lib/access.mjs";
import { create } from "../lib/airtable.mjs";

export default async (req) => {
  if (new URL(req.url).pathname.endsWith("/logout")) {
    const bad = checkPost(req);
    if (bad) return bad;
    try {
      const w = await who(req);
      if (w.real && w.viewing) await create("adminlog", { action: "View as stopped", summary: `${w.real.name} stopped viewing as ${w.viewing.name} (signed out)`, by: [w.real.id], person: [w.viewing.id] });
    } catch (e) {
      console.error("logout log", e.message);
    }
    const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
    headers.append("set-cookie", clearSession);
    headers.append("set-cookie", clearViewAs);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }
  try {
    const me = await requirePerson(req);
    if (me instanceof Response) return me;
    const { id, real, viewing, ...out } = me;
    return json({ ...out, viewing: viewing ? { name: viewing.name, until: viewing.until, can_sign_in: viewing.can_sign_in } : null, real: { name: real.name, staff: real.staff } });
  } catch (e) {
    console.error("auth-session", e.message);
    return json({ error: "Could not load your account." }, 502);
  }
};

export const config = { path: ["/api/auth/session", "/api/auth/logout"] };
