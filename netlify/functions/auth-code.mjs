// POST /api/auth/code-request, POST /api/auth/code-verify · v01 (2026-11-04). Sign in with an emailed one-time code.
import { body, checkPost, json, sessionCookie } from "../lib/core.mjs";
import { requestCode, verifyCode } from "../lib/otp.mjs";

export default async (req) => {
  const bad = checkPost(req);
  if (bad) return bad;
  const b = await body(req);
  try {
    if (new URL(req.url).pathname.endsWith("/code-request")) {
      await requestCode(b.email);
      // Same answer whether or not the email has access (and when the hourly limit is reached).
      return json({ ok: true });
    }
    const email = await verifyCode(b.email, b.code);
    if (!email) return json({ error: "That code is not right or has expired." }, 401);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(email) });
  } catch (e) {
    console.error("auth-code", e.message);
    return json({ error: "Could not send or check the code. Please try again." }, 502);
  }
};

export const config = { path: ["/api/auth/code-request", "/api/auth/code-verify"] };
