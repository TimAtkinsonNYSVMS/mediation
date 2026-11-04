// GET /api/auth/session, POST /api/auth/logout · v01 (2026-11-04)
import { checkPost, clearSession, json } from "../lib/core.mjs";
import { requirePerson } from "../lib/access.mjs";

export default async (req) => {
  if (new URL(req.url).pathname.endsWith("/logout")) {
    const bad = checkPost(req);
    if (bad) return bad;
    return json({ ok: true }, 200, { "set-cookie": clearSession });
  }
  try {
    const me = await requirePerson(req);
    if (me instanceof Response) return me;
    const { id, ...out } = me;
    return json(out);
  } catch (e) {
    console.error("auth-session", e.message);
    return json({ error: "Could not load your account." }, 502);
  }
};

export const config = { path: ["/api/auth/session", "/api/auth/logout"] };
