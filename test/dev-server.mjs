// Local test server v01 (2026-11-04). Not deployed. Serves public/ and runs the real functions against the made-up
// data in fixtures.mjs. Sign in at /dev/as/staff, /dev/as/fac or /dev/as/owner. Codes and emails print here.
// Run: npm run dev   then open http://localhost:8892
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { setupEnv, SENT, EMAILS, MAIL_HOOK } from "./fixtures.mjs";

setupEnv();
process.env.PORTAL_URL = `http://localhost:${process.env.PORT || 8892}`;
const fake = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const out = await fake(url, opts);
  if (String(url) === MAIL_HOOK) { const m = SENT.at(-1); console.log(m.type === "code" ? `[test] code for ${m.to}: ${m.code}` : `[test] email to ${m.to.map((t) => t.email).join(", ")}: ${m.subject}`); }
  return out;
};

const { sessionCookie } = await import("../netlify/lib/core.mjs");
const routes = [];
for (const f of ["auth-session", "auth-code", "complaints", "complaint", "intake", "upload", "file", "templates", "facilitators"]) {
  const mod = await import(`../netlify/functions/${f}.mjs`);
  for (const p of [].concat(mod.config.path)) routes.push([p.endsWith("/*") ? new RegExp("^" + p.slice(0, -2) + "/[^/]+$") : p, mod.default]);
}
const findRoute = (path) => routes.find(([p]) => (typeof p === "string" ? p === path : p.test(path)))?.[1];

const PORT = Number(process.env.PORT || 8892);
const PUBLIC = new URL("../public/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const read = (req) => new Promise((r) => { const c = []; req.on("data", (x) => c.push(x)); req.on("end", () => r(Buffer.concat(c))); });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    const as = url.pathname.match(/^\/dev\/as\/(\w+)$/);
    if (as && EMAILS[as[1]]) {
      res.writeHead(302, { location: "/#/", "set-cookie": sessionCookie(EMAILS[as[1]]).replace("; Secure", "") });
      return res.end();
    }
    const fn = findRoute(url.pathname);
    if (fn) {
      const body = req.method === "POST" ? (await read(req)).toString() : undefined;
      const out = await fn(new Request(url, { method: req.method, headers: req.headers, body }));
      const headers = Object.fromEntries(out.headers);
      const cookies = out.headers.getSetCookie().map((c) => c.replace("; Secure", ""));
      if (cookies.length) headers["set-cookie"] = cookies;
      if (out.status === 302 && /files\.example\.test/.test(headers.location || "")) { res.writeHead(200, { "content-type": "text/plain" }); return res.end(`Test server: this would open ${headers.location}`); }
      res.writeHead(out.status, headers);
      return res.end(Buffer.from(await out.arrayBuffer()));
    }
    const file = normalize(join(PUBLIC, url.pathname === "/" ? "index.html" : url.pathname));
    if (!file.startsWith(normalize(PUBLIC))) throw new Error("bad path");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    if (res.headersSent) return res.end();
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
}).listen(PORT, () => console.log(`Complaints portal test server on http://localhost:${PORT}`));
