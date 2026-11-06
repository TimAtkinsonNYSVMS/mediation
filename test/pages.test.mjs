// Page check v01 (2026-11-06). Opens every main page in headless Chrome against the local test server (made-up data) as a
// visitor, a pet owner, a facilitator and staff, and fails if a page throws, shows an error box or is missing its heading.
// Added after the 2026-11-06 sign-in outage (a missing declaration in app.js that the server tests could not see).
// Needs Google Chrome or Microsoft Edge installed; skipped with a message if neither is found. Run: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 8893, DEBUG = 9363, BASE = `http://localhost:${PORT}`;
const BROWSERS = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
const browserPath = BROWSERS.find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server, browser, profile, ws, nextId = 0;
const pending = new Map(), problems = [];
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++nextId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

before(async () => {
  if (!browserPath) return;
  server = spawn(process.execPath, ["test/dev-server.mjs"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  profile = mkdtempSync(join(tmpdir(), "cm-pages-"));
  browser = spawn(browserPath, ["--headless=new", `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 80 && !ws; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${DEBUG}/json`)).json()).find((t) => t.type === "page");
      if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
    } catch {}
    if (!ws) await sleep(250);
  }
  if (!ws) throw new Error("Could not start headless browser");
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    if (m.method === "Runtime.exceptionThrown") problems.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(250); }
});

after(() => {
  try { ws?.close(); } catch {}
  browser?.kill(); server?.kill();
  if (profile) setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch {} }, 500).unref();
});

const signInAs = async (who) => {
  await send("Network.clearBrowserCookies");
  await send("Page.navigate", { url: who ? `${BASE}/dev/as/${who}` : `${BASE}/` });
  await sleep(1200);
};
// Opens a page and waits until it shows `expect` (text in #main), then checks for errors.
async function check(hash, expect) {
  problems.length = 0;
  await js(`if (location.hash === ${JSON.stringify(hash)}) route(); else location.hash = ${JSON.stringify(hash)};`);
  let text = "";
  for (let i = 0; i < 30; i++) {
    await sleep(150);
    text = await js(`return document.getElementById("main").innerText`);
    if (text.includes(expect)) break;
  }
  const errBox = await js(`const e = document.querySelector("#main .err"); return e ? e.textContent : ""`);
  assert.equal(errBox, "", `${hash}: the page shows an error: ${errBox}`);
  assert.deepEqual(problems, [], `${hash}: the page threw: ${problems.join(" | ")}`);
  assert.ok(text.includes(expect), `${hash}: expected "${expect}" on the page, got: ${text.slice(0, 160)}`);
}

const skip = browserPath ? false : "no Chrome or Edge found (set CHROME_PATH to run the page check)";

test("pages: a visitor can see About, sign in, and the request form", { skip }, async () => {
  await signInAs(null);
  await check("#/", "Help understanding the care your animal received");
  await check("#/signin", "Email me a code");
  // the sign-in flow itself: email, then the code step
  await js(`const i = document.querySelector("#main input"); i.value = "jordan@example.org"; i.dispatchEvent(new Event("input"));
    const f = i.closest("form"); if (f) f.requestSubmit(); else [...document.querySelectorAll("#main button")].find((b) => /code/i.test(b.textContent)).click();`);
  await sleep(1200);
  assert.ok((await js(`return document.getElementById("main").innerText`)).includes("6-digit code"), "after the email, the code step shows");
  assert.deepEqual(problems, []);
  await check("#/file", "Check we can help");
});

test("pages: a pet owner's requests, request page and feedback", { skip }, async () => {
  await signInAs("owner");
  await check("#/", "Welcome back");
  await check("#/c/recCMP00000000002", "Activity");
  await check("#/feedback/recCMP00000000003", "How did we do?");
  await check("#/about", "How it works");
});

test("pages: a facilitator's assignments, request, letter and guide", { skip }, async () => {
  await signInAs("fac");
  await check("#/", "My assignments");
  await check("#/c/recCMP00000000002", "Log a call, email or note");
  await check("#/c/recCMP00000000002/letter", "Open in my email");
  await check("#/guide", "What each status means");
});

test("pages: staff requests, request, facilitators, templates and people", { skip }, async () => {
  await signInAs("staff");
  await check("#/", "Requests");
  await check("#/c/recCMP00000000001", "Assign a facilitator");
  await check("#/facilitators", "Facilitators");
  await check("#/letters", "Letter templates");
  await check("#/admin", "People and access");
  await check("#/admin/new", "Add a person");
  await check("#/admin/p/recPPL00000000003", "Their requests");
  // staff who also facilitate get My assignments (the test staff member has both roles)
  await check("#/mine", "My assignments");
  assert.ok(await js(`return [...document.querySelectorAll("nav.tabs a")].some((a) => a.textContent === "My assignments")`), "the tab shows");
});
