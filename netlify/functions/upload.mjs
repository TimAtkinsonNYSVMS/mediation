// POST /api/upload · v02 (2026-11-04). v02: refused while viewing as someone. Adds one file (base64 JSON, up to 4 MB) to a complaint or a progress update.
// Allowed with a session that can work on the complaint, or with the intake ticket for that complaint's own
// Uploads and Records Release Form fields.
import { body, checkPost, json, unseal } from "../lib/core.mjs";
import { readOne, uploadAttachment } from "../lib/airtable.mjs";
import { who, can } from "../lib/access.mjs";

const MAX = 4 * 1024 * 1024;
const OK_TYPES = /^(application\/pdf|image\/(jpeg|png|gif|heic|heif|webp)|text\/plain|application\/(msword|rtf|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.[\w.]+))$/;
const FIELDS = { uploads: "uploads", release: "release" };
const NO = () => json({ error: "You don't have access to do that." }, 403);

export default async (req) => {
  const bad = checkPost(req);
  if (bad) return bad;
  const b = await body(req);
  const data = String(b.data || "");
  const size = Math.floor((data.length * 3) / 4);
  const filename = String(b.filename || "file").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
  const contentType = String(b.contentType || "");
  if (!data || size > MAX) return json({ error: "Files must be 4 MB or smaller." }, 400);
  if (!OK_TYPES.test(contentType)) return json({ error: "Please upload a PDF, Word document, photo or text file." }, 400);
  try {
    const c = await readOne("complaints", b.complaint);
    if (!c) return json({ error: "That request was not found." }, 404);
    const ticket = unseal(b.ticket);
    const w = await who(req);
    const byTicket = !!(ticket && ticket.c === c.id && FIELDS[b.field]);
    if (!byTicket && w.viewing) return json({ error: `You are viewing as ${w.viewing.name}. Stop viewing to make changes.` }, 403);
    const bySession = !!(w.real && !w.viewing && can(w.real, "work", c));
    if (!byTicket && !bySession) return NO();
    const file = { filename, contentType, base64: data };
    if (b.field === "update") {
      if (!bySession) return NO();
      const u = await readOne("updates", b.update);
      if (!u || !(u.complaint || []).includes(c.id)) return json({ error: "That update was not found." }, 404);
      await uploadAttachment("updates", u.id, "documents", file);
    } else if (FIELDS[b.field]) {
      await uploadAttachment("complaints", c.id, FIELDS[b.field], file);
    } else return json({ error: "Unknown field." }, 400);
    return json({ ok: true });
  } catch (e) {
    console.error("upload", e.message);
    return json({ error: "The file didn't upload. Please try again." }, 502);
  }
};

export const config = { path: "/api/upload" };
