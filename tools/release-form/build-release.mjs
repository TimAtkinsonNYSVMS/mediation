// Builds the fillable "Permission to release pet records" PDF from release.html.
// Usage: node build-release.mjs <buildDir> <outPdf>
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const [dir, outPdf] = process.argv.slice(2);
const PORT = 9371;
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe",
  ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "rel-"))}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
try {
  for (let i = 0; i < 80 && !ws; i++) {
    try { const p = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {}
    if (!ws) await sleep(250);
  }
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 816, height: 1056, deviceScaleFactor: 2, mobile: false });
  await send("Page.navigate", { url: pathToFileURL(join(dir, "release.html")).href });
  await sleep(2500);
  const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
  await ev("document.fonts.ready.then(() => true)");
  const info = await ev(`(() => ({ height: document.documentElement.scrollHeight, fonts: [...document.fonts].filter(f => f.status === "loaded").map(f => f.family + " " + f.weight).join(", "),
    fields: [...document.querySelectorAll("[data-field]")].map(e => { const r = e.getBoundingClientRect(); return { name: e.dataset.field, x: r.left, y: r.top, w: r.width, h: r.height }; }),
    lastBottom: Math.max(...[...document.querySelectorAll(".about")].map(e => e.getBoundingClientRect().bottom)), footTop: document.querySelector(".foot").getBoundingClientRect().top }))()`);
  console.log("page height", info.height, "about ends", Math.round(info.lastBottom), "footer starts", Math.round(info.footTop));
  console.log("fonts loaded:", info.fonts);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(outPdf.replace(/\.pdf$/, "-preview.png"), Buffer.from(shot.data, "base64"));
  const pdf = await send("Page.printToPDF", { paperWidth: 8.5, paperHeight: 11, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, printBackground: true, preferCSSPageSize: true });

  // Typeable fields over each box (CSS px at 96/in -> PDF pt at 72/in; PDF y runs from the bottom).
  const doc = await PDFDocument.load(Buffer.from(pdf.data, "base64"));
  if (doc.getPageCount() !== 1) throw new Error(`expected 1 page, got ${doc.getPageCount()}`);
  const page = doc.getPage(0), { height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const form = doc.getForm();
  const pt = (v) => v * 0.75;
  for (const f of info.fields) {
    const tf = form.createTextField(f.name);
    tf.addToPage(page, { x: pt(f.x) + 1.5, y: height - pt(f.y + f.h) + 1.5, width: pt(f.w) - 3, height: pt(f.h) - 3, borderWidth: 0, font, textColor: rgb(0.2, 0.2, 0.2) });
    tf.setFontSize(f.name === "signature" ? 13 : 10.5);
  }
  doc.setTitle("Permission to release pet records");
  doc.setAuthor("New York State Veterinary Medical Society");
  doc.setSubject("NYSVMS mediation service: permission for a veterinarian to share a pet's records with the facilitator");
  writeFileSync(outPdf, await doc.save());
  console.log("wrote", outPdf, info.fields.length, "fields");
} finally { try { ws?.close(); } catch {} chrome.kill(); }
