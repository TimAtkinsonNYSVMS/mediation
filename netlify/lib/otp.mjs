// Mediation portal one-time sign-in codes v01 (2026-11-04). Copied from the treasurer portal.
// A 6-digit code is emailed to anyone personByEmail() lets in. Only an HMAC of the code is stored (Sign-in Codes).
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "./core.mjs";
import { request } from "./airtable.mjs";
import { personByEmail as userByEmail } from "./access.mjs";
import { sendCode } from "./mail.mjs";

const CODES = "tblr6tAs6pjmTXVne";
const F = { email: "fldfLCMzHxh7p2epZ", hash: "fldcmnfwyAK850nLg", expires: "fldeQ2tPZ8V3HWYBR", attempts: "fldQSqbcIBd2xNE2k", used: "fldcd0VMZTV6BPgrw", created: "fldJzUTiT2ug5sqkc" };
const CODE_MINUTES = 10;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

// Lower case, and only characters that can appear in an email, so it is safe inside an Airtable formula.
export const normEmail = (e) => {
  const s = String(e || "").trim().toLowerCase();
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : null;
};
const hashCode = (email, code) => createHmac("sha256", env("SESSION_SECRET")).update(`code|${email}|${code}`).digest("base64url");
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// This email's code rows, newest first. The formula narrows the search; the checks are repeated in code.
async function codesFor(email) {
  const qs = new URLSearchParams({ returnFieldsByFieldId: "true", filterByFormula: `LOWER({Email}) = '${email}'` });
  const data = await request(`${CODES}?${qs}`);
  return data.records
    .map((r) => ({ id: r.id, email: normEmail(r.fields[F.email]), hash: r.fields[F.hash] || "", expires: Date.parse(r.fields[F.expires] || 0), attempts: r.fields[F.attempts] || 0, used: !!r.fields[F.used], created: Date.parse(r.fields[F.created] || r.createdTime || 0) }))
    .filter((r) => r.email === email)
    .sort((a, b) => b.created - a.created);
}

// Always resolves the same way for unknown emails, so the form cannot reveal who has access.
export async function requestCode(rawEmail) {
  const email = normEmail(rawEmail);
  if (!email) return { ok: true };
  const user = await userByEmail(email);
  if (!user) return { ok: true };
  const recent = (await codesFor(email)).filter((r) => r.created > Date.now() - 3600e3);
  if (recent.length >= MAX_CODES_PER_HOUR) return { ok: true, limited: true };
  const code = String(randomInt(0, 1e6)).padStart(6, "0");
  await request(CODES, {
    method: "POST",
    body: { fields: { [F.email]: email, [F.hash]: hashCode(email, code), [F.expires]: new Date(Date.now() + CODE_MINUTES * 60e3).toISOString(), [F.attempts]: 0, [F.used]: false } }
  });
  await sendCode(email, user.name, code);
  return { ok: true };
}

// The email when the code is right (and the person still has access), otherwise null.
export async function verifyCode(rawEmail, rawCode) {
  const email = normEmail(rawEmail);
  const code = String(rawCode || "").replace(/\D/g, "");
  if (!email || code.length !== 6) return null;
  const row = (await codesFor(email))[0];
  if (!row || row.used || row.expires < Date.now() || row.attempts >= MAX_ATTEMPTS) return null;
  const ok = same(row.hash, hashCode(email, code));
  await request(`${CODES}/${row.id}`, { method: "PATCH", body: { fields: ok ? { [F.used]: true, [F.attempts]: row.attempts + 1 } : { [F.attempts]: row.attempts + 1 } } });
  if (!ok) return null;
  return (await userByEmail(email)) ? email : null;
}
