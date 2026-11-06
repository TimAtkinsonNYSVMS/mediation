// Email preview v01 (2026-11-06). Writes every portal email, with made-up data, to HTML files for checking by eye.
// Run: node test/email-preview.mjs <outDir>. Nothing is sent: the mail webhook is faked by fixtures.mjs.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupEnv, SENT, IDS } from "./fixtures.mjs";

const out = process.argv[2] || "email-preview";
mkdirSync(out, { recursive: true });
setupEnv();
process.env.PUBLIC_URL = "https://mediation.nysvms.org"; // so the logo and links are the real ones
const { sendCode } = await import("../netlify/lib/mail.mjs");
const n = await import("../netlify/lib/complaints.mjs");
const { readOne } = await import("../netlify/lib/airtable.mjs");
const c = await readOne("complaints", IDS.cMine);
const owner = { email: "jordan@example.org", name: "Jordan Ellery" };
const fac = { email: "priya@example.org", name: "Dr. Priya Raman" };
const staff = { id: IDS.staff, name: "Sam Staff", email: "sam@example.org" };

await sendCode(owner.email, owner.name, "482913");
await n.noticeNewComplaint(c, owner);
await n.noticeAssigned(c, fac, staff);
await n.noticeUpdate(c, { ...fac, id: IDS.fac }, "Called the practice manager. Dr. Greer is back on Nov 6 and will call the owner that week.");
await n.noticeStatus(c, { ...fac, id: IDS.fac }, "Mediation in progress");
await n.noticeFeedback(c);
SENT.forEach((m, i) => {
  const name = `${i + 1}-` + m.subject.toLowerCase().replace(/#\d+|\d{6}/g, "").replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  writeFileSync(join(out, `${name}.html`), m.html);
  writeFileSync(join(out, `${name}.txt`), `To: ${m.to.map((t) => t.email).join(", ")}\nSubject: ${m.subject}\n\n${m.text}`);
  console.log(name.padEnd(24), "|", m.subject);
});
