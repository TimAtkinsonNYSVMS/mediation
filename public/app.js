// Mediation portal app v09 (2026-11-06). v09: request form step 1 fits above the fold (question and answers on one line on computers)
// and the answer buttons are coloured by meaning (green = we can help, red = another organization, amber = not sure).
// v08 (2026-11-06). v08: staff pages redesigned (15-22, 26): Requests with Needs attention, duplicate and stalled warnings,
// assign with suggestions, Close without resolution, Facilitators, Letter templates, People and access. New stored status names.
// v07 (2026-11-06). v07: home page restyled to Tim's mockup (full-width bands). v06: About NYSVMS section on the home page.
// v05 (2026-11-06). v05: facilitator pages redesigned (10-14, 27): My assignments with next step, request workspace,
// log an update (type, with, next step, optional status), Close request, add the vet's email, Draft a letter with Open in my email and Log as sent.
// v04 (2026-11-06). v04: pet owner pages redesigned (06-09, 28) with the Activity list; updates record a Type and With.
// v03 (2026-11-06). v03: public pages redesigned (design/redesign 01-05, 24-25): About, 4-step request form, received, sign in with 6-box code.
// v02 (2026-11-04). v02: Admin page (#/admin, staff) and View as (read-only, 2 hours).
// v01 (2026-11-04). Plain JS, hash routes:
//   #/ (home: public about page, or the signed-in person's lists)   #/file (public complaint form)   #/signin
//   #/c/<id> (one complaint)   #/c/<id>/letter (draft a letter)   #/feedback/<id>   #/facilitators   #/letters   #/guide
// All data comes from /api; every element is built with textContent, never HTML strings.
"use strict";

const main = document.getElementById("main");
let me = null;

// ---- DOM helpers ----
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false && k !== "") n.append(typeof k === "string" ? document.createTextNode(k) : k);
  return n;
}
const show = (...kids) => { main.className = "in main-in"; main.parentElement.classList.remove("rd-soft"); main.replaceChildren(); for (const k of kids.flat(Infinity)) if (k) main.append(k); window.scrollTo(0, 0); };
const $ = (id) => document.getElementById(id);
function toast(msg, bad) {
  const t = $("toast"); t.textContent = msg; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200);
}
const fmtDate = (d) => (d ? new Date(String(d).length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const daysSince = (d) => (d ? Math.round((Date.now() - new Date(String(d).length === 10 ? d + "T12:00:00" : d)) / 864e5) : 0);
const CLOSED = ["Completed", "Closed without resolution"];
const STEPS = ["Received", "Facilitator assigned", "Mediation in progress", "Completed"];
const stepIndex = (s) => (CLOSED.includes(s) ? 3 : (s || "Awaiting assignment") === "Awaiting assignment" ? 0 : s === "Mediation in progress" || String(s).startsWith("Waiting on") ? 2 : 1);

// ---- API ----
async function api(url) {
  const r = await fetch(url, { credentials: "same-origin" });
  if (r.status === 401) { me = null; renderHeader(); location.hash = "#/signin"; throw new Error("Please sign in."); }
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || "Something went wrong.");
  return b;
}
async function post(url, data) {
  const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-cm-request": "1" }, body: JSON.stringify(data || {}) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || "Something went wrong.");
  return b;
}
const toBase64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.onerror = rej; fr.readAsDataURL(file); });
async function uploadFiles(files, extra) {
  const failed = [];
  for (const f of files) {
    if (f.size > 4 * 1024 * 1024) { failed.push(`${f.name} (over 4 MB)`); continue; }
    try { await post("/api/upload", { ...extra, filename: f.name, contentType: f.type || "application/octet-stream", data: await toBase64(f) }); }
    catch (e) { failed.push(`${f.name} (${e.message})`); }
  }
  return failed;
}

// ---- header and tabs ----
function tabsFor() {
  if (!me) return [["#/", "About"], ["#/file", "Request mediation"], ["#/signin", "Sign in"]];
  const t = [];
  if (me.staff) t.push(["#/", "Requests"], ["#/facilitators", "Facilitators"], ["#/letters", "Letter templates"]);
  else if (me.viewing && !me.facilitator && !me.owner) t.push(["#/", "Home"]);
  else if (me.facilitator) t.push(["#/", "My assignments"], ["#/guide", "Facilitator guide"]);
  else t.push(["#/", "My requests"], ["#/about", "How mediation works"]);
  if (me.real && me.real.staff && !me.viewing) t.push(["#/admin", "People and access"]);
  return t;
}
function renderHeader() {
  const who = $("who");
  who.replaceChildren();
  viewBar();
  if (me) {
    const role = me.staff ? "Staff" : me.facilitator ? "Facilitator" : me.owner ? "Pet owner" : "No access";
    who.append(...[el("span", { class: "pill", text: role }), el("span", { class: "name", text: me.name }),
      me.viewing ? el("span", { class: "name small", text: `(you are ${me.real.name})` }) : null,
      el("button", { class: "btn-on-dark", type: "button", text: "Sign out", onclick: async () => { await post("/api/auth/logout").catch(() => {}); me = null; location.hash = "#/"; renderHeader(); route(); } })].filter(Boolean));
  }
  const cur = location.hash.split("/").slice(0, 2).join("/") || "#/";
  $("tabs").replaceChildren(...tabsFor().map(([h, l]) => el("a", { href: h, text: l, "aria-current": (h === "#/" ? ["#/", "#", "#/c"].includes(cur) : cur === h) ? "page" : false })));
}

// ---- router ----
async function route() {
  const parts = (location.hash || "#/").slice(2).split("/");
  renderHeader();
  try {
    if (parts[0] === "file") return fileForm();
    if (parts[0] === "signin") return signIn();
    if (parts[0] === "about" || !me) return about();
    if (parts[0] === "c" && parts[2] === "letter") return await letter(parts[1]);
    if (parts[0] === "c") return await complaint(parts[1]);
    if (parts[0] === "feedback") return await feedback(parts[1]);
    if (parts[0] === "facilitators") return await facilitatorList();
    if (parts[0] === "letters") return await letterList();
    if (parts[0] === "guide") return guide();
    if (parts[0] === "admin" && parts[1] === "new") return await adminPerson(null);
    if (parts[0] === "admin" && parts[1] === "p") return await adminPerson(parts[2]);
    if (parts[0] === "admin") return await admin();
    return await home();
  } catch (e) {
    if (e.message !== "Please sign in.") show(el("div", { class: "err", text: e.message }));
  }
}
window.addEventListener("hashchange", route);

// ---- redesign helpers (design/redesign, scoped by rd.css) ----
// showRd renders a redesigned page: #main gets the .rd scope; soft = grey page ground (sign-in).
function showRd(opts, ...kids) {
  main.className = opts.bleed ? "rd rd-bleed" : "rd rd-wrap" + (opts.narrow ? " rd-narrow" : "");
  main.parentElement.classList.toggle("rd-soft", !!opts.soft);
  main.replaceChildren();
  for (const k of kids.flat(Infinity)) if (k) main.append(k);
  if (!opts.keep) window.scrollTo(0, 0);
  rdKeep = false;
}
const ICO = {
  right: ["M5 12h14", "M12 5l7 7-7 7"], left: ["M19 12H5", "M12 19l-7-7 7-7"], check: ["M20 6 9 17l-5-5"],
  clock: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 6v6l4 2"], info: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 16v-4", "M12 8h.01"],
  ext: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  clip: ["m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"],
  alert: ["M12 3 2 21h20L12 3z", "M12 10v4", "M12 17h.01"],
  phone: ["M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"],
  mail: ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "m22 7-10 6L2 7"],
  pen: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"], plus: ["M12 5v14", "M5 12h14"],
  copy: ["M11 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
  x: ["M18 6 6 18", "m6 6 12 12"], ban: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "m4.9 4.9 14.2 14.2"],
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"]
};
function ico(name) {
  const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "ico"); s.setAttribute("aria-hidden", "true");
  for (const d of ICO[name] || []) { const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); s.append(p); }
  return s;
}
// Outside help for requests we can't take. Tim to confirm these addresses.
const HELP = {
  fees: { label: "NY Attorney General: consumer help", href: "https://ag.ny.gov/" },
  opd: { label: "NY State Office of the Professions", href: "https://www.op.nysed.gov/" }
};
const extLink = (h, cls = "sm strong") => el("a", { class: cls, href: h.href, target: "_blank", rel: "noopener" }, h.label, " ", ico("ext"));
// The wording owners agreed to in the Knack form, kept word for word.
const SERVICE_TEXT = ["Our mediation service is most helpful when your pet has been harmed or has died and you have concerns about the treatment provided by your veterinarian. You should first attempt to discuss your concerns with your veterinarian, but sometimes a third party is needed to help you get a satisfactory response.",
  "We do not have the ability to impose fines or suspend licenses. We are not able to negotiate financial settlements."];
const TERMS_TEXT = ["We offer a free service, and in return we ask you to confirm that you waive all rights to make any claim against the New York State Veterinary Medical Society for any action or information we provide."];

// ---- public pages ----
function about() {
  const band = (cls, label, ...kids) => el("section", { class: "band " + cls, "aria-labelledby": label || null }, el("div", { class: "band-in" }, kids));
  const head = (eyebrow, id, title, sub) => el("div", { class: "stack g8", style: "margin-bottom:28px" }, el("p", { class: "eyebrow", text: eyebrow }),
    el("h2", { id, class: "t1 band-h", text: title }), sub ? el("p", { class: "muted", text: sub }) : null);
  const step = (n, t, d) => el("li", { class: "card stack g12 step s" + n }, el("span", { class: "stepn", "aria-hidden": "true", text: String(n) }), el("h3", { class: "t3", text: t }), el("p", { class: "sm muted", text: d }));
  const no = (title, text, help) => el("div", { class: "fitcard no" },
    el("div", { class: "fit-top" }, ico("ban"), "Not something we review"),
    el("div", { class: "stack g12 fit-body" }, el("h3", { class: "t3", text: title }), el("p", { class: "sm", text }),
      el("a", { class: "btn red", href: help.href, target: "_blank", rel: "noopener" }, help.label, ico("ext"))));
  showRd({ bleed: true },
    band("hero", "hero-h",
      el("div", { class: "cols", style: "gap:48px;align-items:center" },
        el("div", { class: "colmain", style: "gap:20px" },
          el("p", { class: "eyebrow", text: "Mediation for pet owners" }),
          el("h1", { id: "hero-h", class: "t1 hero", text: "Help understanding the care your animal received" }),
          el("p", { style: "max-width:640px", text: "NYSVMS volunteer veterinarians help pet owners understand the treatment provided by a veterinarian who is a member of the Society, and help communicate your concerns to them." }),
          el("div", { class: "row g12", style: "margin-top:8px" },
            el("a", { class: "btn lg go", href: "#/file" }, "Start a request", ico("right")),
            el("a", { class: "btn2 lg ghost", href: "#/signin", text: "Check on a request" })),
          el("div", { class: "row g8", style: "margin-top:4px" },
            el("span", { class: "chiplet" }, ico("clock"), "About 10 minutes to fill in"),
            el("span", { class: "chiplet" }, ico("user"), "A volunteer is usually assigned within two weeks"))),
        el("aside", { class: "colside know", "aria-labelledby": "know-h" },
          el("h2", { id: "know-h", class: "row g12 nowrap" }, el("span", { class: "know-ico" }, ico("alert")), "Please know before you start"),
          el("ul", { class: "stack g12" },
            el("li", {}, ico("x"), el("span", { text: "We have no connection to the State licensing board and cannot impose penalties or remove licenses." })),
            el("li", {}, ico("info"), el("span", { text: "We can only help when the veterinarian is a member of NYSVMS." })))))),
    band("soft", "how",
      head("Three steps", "how", "How it works"),
      el("ol", { class: "grid3" },
        step(1, "Tell us what happened", "Answer a few questions about the visit and your veterinarian. You can attach records and photos."),
        step(2, "A volunteer is assigned", "A volunteer veterinarian, your facilitator, is usually assigned within two weeks and contacts you directly by email or phone."),
        step(3, "They talk with your vet", "Your facilitator helps you understand the care and shares your concerns with the veterinarian. You can sign in any time to see where things stand."))),
    band("plain", "fit",
      head("Check first", "fit", "Is mediation right for you?", "If your concern is about fees or discipline, another organization can help you faster."),
      el("div", { class: "grid3" },
        el("div", { class: "fitcard yes" },
          el("div", { class: "fit-top" }, el("span", { class: "yes-ico" }, ico("check")), "We can help"),
          el("div", { class: "stack g12 fit-body" }, el("h3", { class: "t3", text: "Questions about care" }),
            el("p", { class: "sm", text: "Questions about the diagnosis, treatment or communication you received from an NYSVMS member veterinarian." }),
            el("a", { class: "btn white", href: "#/file" }, "Start a request", ico("right")))),
        no("Fees and billing", "We can't review what a practice charges. For a dispute about fees, contact a consumer protection organization.", HELP.fees),
        no("Discipline or license action", "For fines or license action, contact the NY State Office of the Professions, Office of Professional Discipline.", HELP.opd))),
    band("soft", "nysvms",
      el("div", { class: "row g32", style: "align-items:flex-start" },
        el("div", { class: "stack g12", style: "flex:2 1 420px;min-width:0" },
          el("p", { class: "eyebrow", text: "About NYSVMS" }),
          el("h2", { id: "nysvms", class: "t1 band-h", text: "Who we are" }),
          el("p", { text: "The New York State Veterinary Medical Society (NYSVMS) is a nonprofit professional association for veterinarians across New York State. It was founded by veterinarians, is led by veterinarians, and has served New York veterinarians since 1890 through 12 regional chapters." }),
          el("p", { text: "Mediation is a free service the Society offers to the public. Volunteer veterinarians who are NYSVMS members help pet owners understand the care their animal received and share their concerns with the treating veterinarian." })),
        el("div", { class: "stack g12", style: "flex:1 1 280px;min-width:0" },
          el("p", { class: "lede", text: "“Leading the veterinary profession in New York State through education, advancement and protection of animal wellness, public health and veterinary medicine.”" }),
          el("span", { class: "sm muted", text: "The NYSVMS mission" }),
          extLink({ label: "Learn more at nysvms.org", href: "https://nysvms.org/about-us-2/" })))),
    band("cta", "cta-h",
      el("div", { class: "row g24 between" },
        el("div", { class: "stack g8" }, el("h2", { id: "cta-h", class: "t2", text: "Ready to tell us what happened?" }),
          el("p", { text: "It takes about 10 minutes. You can attach records and photos." })),
        el("a", { class: "btn lg go", href: "#/file" }, "Start a request", ico("right")))));
}

// Sign in: email, then a 6-box code (paste fills all six).
let signinEmail = "";
function signIn() {
  if (me) { location.hash = "#/"; return; }
  const msg = el("div");
  const email = el("input", { id: "si-email", class: "input", type: "email", autocomplete: "email", placeholder: "you@example.com", value: signinEmail });
  const btn = el("button", { class: "btn lg full", type: "submit", text: "Email me a code" });
  const form = el("form", { class: "stack g16", novalidate: true },
    el("div", { class: "field" }, el("label", { for: "si-email", text: "Email address" }), email), msg, btn);
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); msg.replaceChildren();
    if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) { msg.append(el("div", { class: "alert a-attn" }, ico("alert"), "Enter the email address you used.")); email.setAttribute("aria-invalid", "true"); return; }
    btn.disabled = true;
    try { await post("/api/auth/code-request", { email: email.value.trim() }); signinEmail = email.value.trim(); codeStep(); }
    catch (err) { msg.append(el("div", { class: "alert a-attn" }, ico("alert"), err.message)); btn.disabled = false; }
  });
  showRd({ soft: true }, el("div", { style: "display:flex;justify-content:center;padding-top:24px" },
    el("div", { class: "card stack g24 signin-card", style: "width:100%;max-width:480px;padding:40px" },
      el("div", { class: "stack g12" }, el("p", { class: "eyebrow", text: "Sign in" }), el("h1", { class: "t1", style: "font-size:32px", text: "We'll email you a code" }),
        el("p", { class: "muted", text: "No password to remember. Use the email from your mediation request, or the email NYSVMS has for you as a facilitator or staff member." })),
      form, el("hr", { class: "divider" }),
      el("p", { class: "sm muted" }, "Don't have a request yet? ", el("a", { href: "#/file", text: "Start a request" })))));
  email.focus();
}
function codeStep() {
  const boxes = [0, 1, 2, 3, 4, 5].map((i) => el("input", { class: "input", inputmode: "numeric", maxlength: "1", autocomplete: i === 0 ? "one-time-code" : "off", "aria-label": `Digit ${i + 1}` }));
  const fill = (digits, from = 0) => { digits.split("").slice(0, 6 - from).forEach((d, j) => (boxes[from + j].value = d)); boxes[Math.min(from + digits.length, 5)].focus(); };
  boxes.forEach((b, i) => {
    b.addEventListener("input", () => { const d = b.value.replace(/\D/g, ""); b.value = ""; if (d) fill(d, i); if (boxes.every((x) => x.value)) form.requestSubmit(); });
    b.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !b.value && i) { boxes[i - 1].value = ""; boxes[i - 1].focus(); e.preventDefault(); } });
    b.addEventListener("paste", (e) => { const d = (e.clipboardData.getData("text") || "").replace(/\D/g, ""); if (d) { e.preventDefault(); fill(d, i); if (boxes.every((x) => x.value)) form.requestSubmit(); } });
  });
  const msg = el("div");
  const btn = el("button", { class: "btn lg full", type: "submit", text: "Sign in" });
  const form = el("form", { class: "stack g16", novalidate: true },
    el("fieldset", { class: "fs" }, el("legend", { style: "font-size:15px", text: "6-digit code" }), el("div", { class: "code" }, boxes),
      el("p", { class: "help", text: "Codes expire after 10 minutes. You can paste the whole code into the first box." })), msg, btn);
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); msg.replaceChildren();
    const code = boxes.map((b) => b.value).join("");
    if (code.length !== 6) { msg.append(el("div", { class: "alert a-attn" }, ico("alert"), "Enter all six digits.")); return; }
    btn.disabled = true;
    try { await post("/api/auth/code-verify", { email: signinEmail, code }); me = await api("/api/auth/session"); location.hash = "#/"; route(); }
    catch (err) { msg.append(el("div", { class: "alert a-attn" }, ico("alert"), err.message)); btn.disabled = false; boxes.forEach((b) => (b.value = "")); boxes[0].focus(); }
  });
  const resend = el("a", { class: "strong", href: "#", text: "send a new code", onclick: async (e) => {
    e.preventDefault();
    try { await post("/api/auth/code-request", { email: signinEmail }); toast("A new code is on its way"); } catch (err) { toast(err.message, true); }
  } });
  showRd({ soft: true }, el("div", { style: "display:flex;justify-content:center;padding-top:24px" },
    el("div", { class: "card stack g24 signin-card", style: "width:100%;max-width:480px;padding:40px" },
      el("a", { class: "back", href: "#/signin", style: "margin:-8px 0 -8px -2px", onclick: (e) => { e.preventDefault(); signIn(); } }, ico("left"), "Use a different email"),
      el("div", { class: "stack g12" }, el("p", { class: "eyebrow", text: "Sign in" }), el("h1", { class: "t1", style: "font-size:32px", text: "Check your email" }),
        el("p", { class: "muted" }, "If ", el("span", { class: "strong", style: "color:#333", text: signinEmail }), " is linked to a mediation request or a facilitator account, we've sent it a 6-digit code.")),
      form, el("hr", { class: "divider" }),
      el("div", { class: "stack g8 sm muted" },
        el("span", {}, "Nothing yet? Check your spam folder, then ", resend, "."),
        el("span", {}, "Still stuck? Email ", el("a", { href: "mailto:staff@nysvms.org", text: "staff@nysvms.org" }))))));
  boxes[0].focus();
}

// Request mediation: four steps, answers kept in `req` while moving between them.
const REQ_STEPS = ["Check we can help", "Your veterinarian", "What happened", "About you"];
let req = null;
const newReq = () => ({ step: 0, legal: "", opd: "", fees: "", member: "", service: false, terms: false, vet_name: "", practice: "", practice_address: "", vet_email: "",
  subject: "", description: "", uploads: [], records_ok: false, release: [], name: "", email: "", phone: "", address: "", website: "" });
function fileForm(keep) {
  if (!req) req = newReq();
  const s = req.step;
  const msg = el("div");
  const input = (id, label, opts = {}) => {
    const n = el(opts.area ? "textarea" : "input", { id, class: opts.area ? "textarea" : "input", ...(opts.area ? {} : { type: opts.type || "text" }), autocomplete: opts.ac || "off", placeholder: opts.ph || false });
    n.value = req[id]; n.addEventListener("input", () => { req[id] = n.value; n.removeAttribute("aria-invalid"); });
    return el("div", { class: "field" }, el("label", { for: id }, label, opts.optional ? el("span", { class: "opt", text: " (optional)" }) : null), n, opts.help ? el("span", { class: "help", text: opts.help }) : null);
  };
  // One question per row: the question (and any hint) on the left, answer buttons on the right; stacked on phones.
  // Each answer is coloured by what it means once chosen: ok (green), stop (red), maybe (amber).
  const yesNo = (key, legend, choices, help) => {
    const name = "q-" + key, qid = "qt-" + key;
    return el("div", { class: "qrow", role: "radiogroup", "aria-labelledby": qid },
      el("span", { id: qid, class: "qtext", text: legend }),
      el("div", { class: "seg bold" }, choices.map(([v, l, tone]) => el("label", { class: tone }, (() => { const r = el("input", { type: "radio", name, value: v }); r.checked = req[key] === v; r.addEventListener("change", () => { req[key] = v; fileForm(true); }); return r; })(), l))),
      help || null);
  };
  const check = (key, content) => { const c = el("input", { type: "checkbox", id: "cb-" + key }); c.checked = req[key]; c.addEventListener("change", () => { req[key] = c.checked; }); return el("label", { class: "choice", for: "cb-" + key }, c, content); };
  const filePicker = (key, label, multiple) => {
    const pick = el("input", { type: "file", multiple: multiple || false, accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.txt", style: "display:none" });
    const list = el("ul", { class: "filelist" });
    const draw = () => list.replaceChildren(...req[key].map((f, i) => el("li", {}, el("span", {}, f.name, el("span", { class: "sm muted", text: ` · ${Math.max(1, Math.round(f.size / 1024))} KB${f.size > 4194304 ? " (too big, over 4 MB)" : ""}` })),
      el("button", { class: "btnq", type: "button", text: "Remove", onclick: () => { req[key].splice(i, 1); draw(); } }))));
    pick.addEventListener("change", () => { req[key] = multiple ? [...req[key], ...pick.files] : [...pick.files].slice(0, 1); pick.value = ""; draw(); });
    draw();
    return el("div", { class: "field" }, el("span", { class: "lbl" }, label, el("span", { class: "opt", text: " (optional)" })),
      el("div", { class: "drop" }, el("button", { class: "btn2", type: "button", onclick: () => pick.click() }, ico("clip"), multiple ? "Add files" : "Add the form"), el("span", { class: "sm muted", text: "Up to 4 MB per file" }), list, pick));
  };
  // Answers that mean another organization is the right place.
  const referral = () => {
    if (req.legal === "yes") return el("div", { class: "alert a-warn" }, ico("info"), el("span", {}, "We can't mediate once legal action has been taken. Your lawyer is the best person to help from here."));
    if (req.opd === "yes") return el("div", { class: "alert a-warn" }, ico("info"), el("span", {}, "Once the Office of Professional Discipline is involved, we can't mediate as well. ", extLink(HELP.opd, "strong")));
    if (req.fees === "yes") return el("div", { class: "alert a-warn" }, ico("info"), el("span", {}, "We can't review what a practice charges. A consumer protection organization can help: ", extLink(HELP.fees, "strong")));
    if (req.member === "no") return el("div", { class: "alert a-warn" }, ico("info"), el("span", {}, "We can only help when the veterinarian is a member of NYSVMS. For other concerns, the practice owner is usually the best first contact."));
    return null;
  };
  const steps = el("ol", { class: "steps", "aria-label": `Form progress: step ${s + 1} of 4` }, REQ_STEPS.map((t, i) => el("li", { class: i < s ? "done" : i === s ? "now" : "" }, el("span", { class: "bar" }), el("span", { class: "lab", text: `${i + 1}. ${t}` }))));
  let body, title, intro;
  if (s === 0) {
    title = "First, let's check we can help"; intro = "Answer these honestly. If mediation isn't the right fit, we'll point you somewhere that is.";
    body = [el("div", { class: "qlist" },
      yesNo("legal", "Have you taken any legal action about this?", [["yes", "Yes", "stop"], ["no", "No", "ok"]]),
      yesNo("opd", "Have you complained to the NYS Office of Professional Discipline?", [["yes", "Yes", "stop"], ["no", "No", "ok"]]),
      yesNo("fees", "Is your concern about fees or the cost of services?", [["yes", "Yes", "stop"], ["no", "No", "ok"]]),
      yesNo("member", "Is the veterinarian a member of NYSVMS?", [["yes", "Yes", "ok"], ["no", "No", "stop"], ["unsure", "I'm not sure", "maybe"]],
        req.member === "unsure" ? el("span", { class: "help", text: "That's fine. Our staff will check before a facilitator is assigned." }) : null)),
      referral(),
      el("div", { class: "grid2 checks" },
        check("service", el("span", { class: "stack g4" }, el("span", { text: "I have read how this service works." }), el("details", { class: "terms" }, el("summary", { text: "How this service works" }), el("div", {}, SERVICE_TEXT.map((t) => el("p", { text: t })))))),
        check("terms", el("span", { class: "stack g4" }, el("span", { text: "I accept the terms, including the indemnity." }), el("details", { class: "terms" }, el("summary", { text: "Read the terms" }), el("div", {}, TERMS_TEXT.map((t) => el("p", { text: t })))))))];
  } else if (s === 1) {
    title = "Your veterinarian"; intro = "Tell us who you saw. Your facilitator uses this to contact them.";
    body = [input("vet_name", "Veterinarian's name", { ph: "Dr. Lee Park" }), input("practice", "Practice name", { optional: true }), input("practice_address", "Practice address", { optional: true }),
      input("vet_email", "Veterinarian's email", { type: "email", optional: true, help: "If you have it, it helps your facilitator reach them sooner." })];
  } else if (s === 2) {
    title = "What happened"; intro = "Describe the visit in your own words. There's no wrong way to tell it.";
    body = [input("subject", "In one sentence, what would you like help with?", { help: "This becomes the title of your request." }),
      input("description", "What happened", { area: true, ph: "When was the visit? What were you told? What would you like to understand?" }),
      filePicker("uploads", "Records, photos or other documents", true),
      check("records_ok", el("span", { class: "stack g4" }, el("span", { text: "I give my veterinarian permission to share my pet's records with NYSVMS." }), el("span", { class: "sm muted", text: "Helps your facilitator understand the care." }))),
      filePicker("release", "Signed records release form", false)];
  } else {
    title = "About you"; intro = "We use your email to send your confirmation and to let you sign in later. No account or password needed.";
    body = [input("name", "Your name", { ac: "name" }), input("email", "Email", { type: "email", ac: "email" }), input("phone", "Phone", { type: "tel", ac: "tel", optional: true }),
      input("address", "Mailing address", { ac: "street-address", optional: true }),
      el("div", { class: "hp", "aria-hidden": "true", style: "position:absolute;left:-9999px" }, el("label", { for: "website", text: "Leave this empty" }), (() => { const h = el("input", { id: "website", type: "text", tabindex: "-1", autocomplete: "off" }); h.addEventListener("input", () => (req.website = h.value)); return h; })())];
  }
  const blocked = s === 0 && !!referral();
  const go = async (dir) => {
    msg.replaceChildren();
    if (dir < 0) { if (s === 0) { location.hash = "#/"; return; } req.step--; return fileForm(); }
    const problem = validate(s);
    if (problem) { msg.append(el("div", { class: "alert a-attn", role: "alert" }, ico("alert"), problem.text)); if (problem.field) { const f = $(problem.field); if (f) { f.setAttribute("aria-invalid", "true"); f.focus(); } } return; }
    if (s < 3) { req.step++; return fileForm(); }
    await submitRequest(nextBtns, msg);
  };
  const nextLabel = ["Continue to your veterinarian", "Continue to what happened", "Continue to about you", "Submit request"][s];
  const backLabel = s === 0 ? "Back to About" : "Back";
  const nextBtns = [];
  const mkNext = (cls, label) => { const b = el("button", { class: cls, type: "button", disabled: blocked, onclick: () => go(1) }, label, s < 3 ? ico("right") : null); nextBtns.push(b); return b; };
  const navDesktop = el("div", { class: "row g12 between formnav" }, el("button", { class: "btnq", type: "button", onclick: () => go(-1) }, ico("left"), backLabel), mkNext("btn lg", nextLabel));
  const navPhone = el("div", { class: "stickybar" }, el("button", { class: "btn2", type: "button", text: "Back", onclick: () => go(-1) }), mkNext("btn", s < 3 ? "Continue" : "Submit request"));
  showRd({ keep },
    el("div", { class: "cols", style: "gap:48px" },
      el("div", { class: "colmain reqform", style: "flex-basis:640px" },
        el("div", { class: "stack g8" }, el("h1", { class: "t1", text: title }), el("p", { class: "muted", text: intro })),
        steps,
        el("form", { class: "stack " + (s === 0 ? "g16" : "g24"), novalidate: true, onsubmit: (e) => { e.preventDefault(); go(1); } }, body, msg, navDesktop)),
      el("aside", { class: "colside hide-phone", style: "flex-basis:320px;position:sticky;top:24px" },
        el("div", { class: "card soft stack g16" }, el("h2", { class: "t3", text: "What you'll need" }),
          el("ul", { class: "stack g8 sm", style: "margin:0;padding-left:18px" },
            el("li", { text: "The veterinarian's name and practice" }), el("li", { text: "A short description of what happened" }),
            el("li", { text: "Records or photos, if you have them (up to 4 MB each)" }), el("li", { text: "A signed records release form, if you want your facilitator to see your pet's records" })),
          el("p", { class: "sm muted", text: "About 10 minutes in all." })),
        el("div", { class: "alert a-info" }, ico("info"), el("span", { text: "A volunteer veterinarian is usually assigned within two weeks. They will contact you directly." })))),
    navPhone);
}
function validate(s) {
  const r = req;
  if (s === 0) {
    if (!r.legal || !r.opd || !r.fees || !r.member) return { text: "Please answer each question." };
    if (!r.service || !r.terms) return { text: "Please confirm you've read how the service works and accept the terms." };
  }
  if (s === 1 && !r.vet_name.trim()) return { text: "Add the veterinarian's name.", field: "vet_name" };
  if (s === 2) {
    if (!r.subject.trim()) return { text: "Add a one-sentence summary.", field: "subject" };
    if (!r.description.trim()) return { text: "Tell us what happened.", field: "description" };
    if ([...r.uploads, ...r.release].some((f) => f.size > 4194304)) return { text: "One of your files is over 4 MB. Remove it, or email it to staff@nysvms.org after you submit." };
  }
  if (s === 3) {
    if (!r.name.trim()) return { text: "Add your name.", field: "name" };
    if (!/^\S+@\S+\.\S+$/.test(r.email.trim())) return { text: "Add a valid email address.", field: "email" };
  }
  return null;
}
async function submitRequest(btns, msg) {
  btns.forEach((b) => { b.disabled = true; b.textContent = "Sending…"; });
  const r = req;
  const data = { name: r.name, email: r.email, phone: r.phone, address: r.address, vet_name: r.vet_name, vet_email: r.vet_email, practice: r.practice, practice_address: r.practice_address,
    subject: r.subject, description: r.description, records_ok: r.records_ok, website: r.website,
    a_legal: r.legal === "no", a_opd: r.opd === "no", a_fees: r.fees === "no", a_member: r.member === "yes", member_unsure: r.member === "unsure", a_service: r.service, a_terms: r.terms };
  try {
    const out = await post("/api/intake", data);
    const failed = [];
    if (out.ticket) {
      failed.push(...(await uploadFiles(r.uploads, { complaint: out.complaint, ticket: out.ticket, field: "uploads" })));
      failed.push(...(await uploadFiles(r.release, { complaint: out.complaint, ticket: out.ticket, field: "release" })));
    }
    const done = { n: out.n, name: r.name.trim().split(/\s+/)[0], email: r.email.trim(), failed };
    req = null;
    received(done);
  } catch (err) {
    msg.append(el("div", { class: "alert a-attn", role: "alert" }, ico("alert"), err.message));
    btns.forEach((b) => { b.disabled = false; b.textContent = "Submit request"; });
  }
}
function received(d) {
  const step = (dot, now, title, text) => el("li", {}, el("span", { class: "dot" + (now ? " now" : "") }, now ? ico("check") : dot), el("div", { class: "tlbody" }, el("span", { class: "strong", text: title }), el("span", { class: "sm muted", text })));
  showRd({},
    el("div", { style: "max-width:820px" },
      el("div", { class: "stack g16", style: "align-items:flex-start;margin-bottom:36px" },
        el("span", { class: "tick" }, ico("check")),
        el("p", { class: "eyebrow", text: "Request received" }),
        el("h1", { class: "t1", text: d.name ? `Thank you, ${d.name}. We have your request.` : "Thank you. We have your request." }),
        el("div", { class: "card soft row g24 between", style: "width:100%" },
          el("div", { class: "stack g4" }, el("span", { class: "sm muted", text: "Your request number" }), el("span", { class: "kpi", style: "font-size:40px", text: `#${d.n}` })),
          el("div", { class: "stack g4" }, el("span", { class: "sm muted", text: "Confirmation sent to" }), el("span", { class: "strong", style: "overflow-wrap:anywhere", text: d.email })))),
      d.failed.length ? el("div", { class: "alert a-attn", style: "margin-bottom:24px" }, ico("alert"), el("span", { text: `These files didn't upload: ${d.failed.join(", ")}. Please email them to staff@nysvms.org and mention request #${d.n}.` })) : null,
      el("h2", { class: "t2", style: "margin-bottom:20px", text: "What happens next" }),
      el("ol", { class: "tl", style: "margin-bottom:32px" },
        step("1", true, "Today: you sent your request", "Check your inbox for the confirmation email. If it isn't there, look in your spam folder."),
        step("2", false, "Usually within two weeks: a volunteer is assigned", "A volunteer veterinarian becomes your facilitator and contacts you directly by email or phone."),
        step("3", false, "Your facilitator talks with the veterinarian", "You can sign in any time with your email to see where things stand.")),
      el("div", { class: "row g12" }, el("a", { class: "btn lg", href: "#/signin", text: "Sign in to track your request" }), el("a", { class: "btn2 lg", href: "#/", text: "Back to About" })),
      el("p", { class: "sm muted", style: "margin-top:24px" }, "Questions? Email ", el("a", { href: "mailto:staff@nysvms.org", text: "staff@nysvms.org" }), ` and mention request #${d.n}.`)));
}

// ---- signed-in lists ----
async function home() {
  const { mine, work } = await api("/api/complaints");
  if (!me.staff && !me.facilitator) return ownerHome(mine);
  if (!me.staff) return facHome(work, mine);
  return staffHome(work);
}

// ---- staff pages (design/redesign 15-22, 26) ----
const STALE_DAYS = 90;
const isStalled = (c) => !CLOSED.includes(c.status) && (c.status || "Awaiting assignment") !== "Awaiting assignment" && daysSince(c.last_activity) > STALE_DAYS;
const dupTag = (c) => (c.duplicate_of ? el("span", { class: "tag warn" }, ico("alert"), `Appears to be a duplicate of #${c.duplicate_of}`) : null);
const staleTag = (c) => (isStalled(c) ? el("span", { class: "tag bad" }, ico("alert"), `Stalled: no activity in ${daysSince(c.last_activity)} days`) : null);
let staffFilter = "open", staffQuery = "";

function staffHome(work) {
  const open = work.filter((c) => !CLOSED.includes(c.status));
  const needFac = open.filter((c) => (c.status || "Awaiting assignment") === "Awaiting assignment");
  const dups = open.filter((c) => c.duplicate_of), stalled = open.filter(isStalled);
  const attention = new Set([...dups, ...needFac, ...stalled].map((c) => c.id));
  const year = String(new Date().getFullYear());
  const FILTERS = [["open", "Open", open.length], ["need", "Need a facilitator", needFac.length], ["attention", "Needs attention", attention.size],
    ["done", "Completed", null], ["all", "All", null]];
  const chips = el("div", { class: "chips", role: "group", "aria-label": "Filter requests" });
  const search = el("input", { class: "input", type: "search", placeholder: "Search number, owner or vet", "aria-label": "Search requests", value: staffQuery });
  const box = el("div");
  const matches = (c) => {
    const q = staffQuery.trim().toLowerCase();
    return !q || [String(c.n), c.subject, c.vet_name, c.owner, c.facilitator, c.practice].some((v) => String(v || "").toLowerCase().includes(q));
  };
  const group = (title, rows, render) => rows.length ? el("section", { class: "card stack g12" },
    el("h2", { class: "t3" }, title, el("span", { class: "muted", text: ` · ${rows.length}` })), staffTable(rows, render)) : null;
  const draw = () => {
    chips.replaceChildren(...FILTERS.map(([k, l, n]) => el("button", { type: "button", class: "chip" + (k === staffFilter ? " on" : ""), "aria-pressed": String(k === staffFilter), onclick: () => { staffFilter = k; draw(); } },
      l, n === null ? null : el("span", { class: "n", text: String(n) }))));
    search.hidden = staffFilter === "attention";
    if (staffFilter === "attention") {
      const parts = [
        group("Possible duplicates", dups.filter(matches)),
        group("Need a facilitator", needFac.filter((c) => !c.duplicate_of).filter(matches)),
        group(`No activity in ${STALE_DAYS}+ days`, stalled.filter(matches))].filter(Boolean);
      box.replaceChildren(el("p", { class: "muted", style: "margin-bottom:16px", text: "Grouped by what needs doing. Each request drops off this list once it's handled." }),
        parts.length ? el("div", { class: "stack g24" }, parts) : el("div", { class: "card soft" }, el("p", { class: "strong", text: "Nothing needs attention right now." })));
      return;
    }
    const base = staffFilter === "open" ? open : staffFilter === "need" ? needFac : staffFilter === "done" ? work.filter((c) => CLOSED.includes(c.status)) : work;
    const rows = base.filter(matches);
    box.replaceChildren(rows.length ? staffTable(rows) : el("div", { class: "card soft" }, el("p", { class: "strong", text: "No requests match." })));
  };
  search.addEventListener("input", () => { staffQuery = search.value; draw(); });
  draw();
  showRd({},
    el("div", { class: "row g16 between", style: "align-items:flex-end;margin-bottom:28px" },
      el("div", { class: "stack g12" }, el("p", { class: "eyebrow", text: "Staff" }), el("h1", { class: "t1", text: "Requests" })),
      el("p", { class: "sm muted", text: `${work.filter((c) => String(c.received).startsWith(year)).length} filed in ${year}` })),
    el("div", { class: "toolbar" }, chips, el("div", { class: "search" }, search)), box);
}

function staffTable(rows) {
  return el("div", { class: "tbl-box" }, el("table", { class: "tbl stackable" },
    el("thead", {}, el("tr", {}, ["Request", "Facilitator", "Status", "Last activity"].map((h) => el("th", { scope: "col", text: h })))),
    el("tbody", {}, rows.map((c) => el("tr", { class: isStalled(c) ? "hl-bad" : "" },
      el("td", { "data-label": "Request" }, el("div", { class: "stack g4" }, el("a", { class: "ttl", href: `#/c/${c.id}`, text: c.subject || "Mediation request" }),
        el("span", { class: "sm muted", text: [`#${c.n}`, c.vet_name ? vetName(c) : "", c.owner ? `owner ${c.owner}` : ""].filter(Boolean).join(" · ") }), dupTag(c), staleTag(c))),
      el("td", { "data-label": "Facilitator" }, c.facilitator ? el("span", { text: c.facilitator }) : CLOSED.includes(c.status) ? el("span", { class: "muted", text: "None" }) : el("a", { class: "btn2 mini", href: `#/c/${c.id}`, text: "Assign" })),
      el("td", { "data-label": "Status" }, facPill(c.status, true)),
      el("td", { "data-label": "Last activity" }, el("div", { class: "stack g4" }, el("span", { text: fmtDate(c.last_activity) }),
        el("span", { class: isStalled(c) ? "sm strong bad-text" : "sm muted", text: isStalled(c) ? `No activity in ${daysSince(c.last_activity)} days` : ago(c.last_activity) }))))))));
}

// Assign card (17): active facilitators, fewest open requests first.
async function assignCard(c) {
  const facs = (await api("/api/facilitators")).filter((f) => f.active).sort((a, b) => a.open - b.open || a.name.localeCompare(b.name));
  if (!facs.length) return el("div", { class: "alert a-attn" }, ico("alert"), el("span", { text: "There are no active facilitators. Add one in People and access." }));
  let pick = (c.facilitator && facs.find((f) => f.id === c.facilitator.id)) ? c.facilitator.id : facs[0].id;
  const btn = el("button", { class: "btn", type: "button" });
  const label = () => { const f = facs.find((x) => x.id === pick); btn.textContent = `${c.facilitator ? "Reassign to" : "Assign and email"} ${f.name}`; };
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try { await post("/api/complaint/assign", { id: c.id, facilitator: pick }); toast("Assigned. The facilitator has been emailed."); reload(); }
    catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  label();
  return el("section", { class: "card stack g16", "aria-labelledby": "as" },
    el("div", { class: "card-h", style: "margin:0" }, el("h2", { id: "as", class: "t2", text: c.facilitator ? "Reassign" : "Assign a facilitator" }), el("span", { class: "sm muted", text: "Active facilitators, fewest open requests first" })),
    el("fieldset", { class: "fs" }, el("legend", { class: "vh", text: "Facilitator" }),
      facs.map((f) => {
        const r = el("input", { type: "radio", name: "as-f", value: f.id, checked: f.id === pick });
        r.addEventListener("change", () => { pick = f.id; label(); });
        return el("label", { class: "choice", style: "align-items:center" }, r, avatar(f.name),
          el("span", { class: "stack", style: "flex:1;min-width:0" }, el("span", { class: "strong", text: f.name }), el("span", { class: "sm muted", text: f.region || "No region" })),
          el("span", { class: "sm muted nowrap", text: `${f.open} open` }));
      })),
    el("div", { class: "row g12" }, btn, el("span", { class: "sm muted", text: c.facilitator ? "The new facilitator is emailed." : "Status changes to Facilitator assigned." })));
}

// ---- facilitators (18) ----
let facListFilter = "active";
async function facilitatorList() {
  const facs = await api("/api/facilitators");
  const box = el("div"), chips = el("div", { class: "chips", role: "group", "aria-label": "Filter facilitators" });
  const draw = () => {
    const rows = facs.filter((f) => (facListFilter === "active" ? f.active : !f.active));
    chips.replaceChildren(...[["active", "Active"], ["inactive", "Inactive"]].map(([k, l]) => el("button", { type: "button", class: "chip" + (k === facListFilter ? " on" : ""), "aria-pressed": String(k === facListFilter), onclick: () => { facListFilter = k; draw(); } },
      l, el("span", { class: "n", text: String(facs.filter((f) => (k === "active" ? f.active : !f.active)).length) }))));
    box.replaceChildren(rows.length ? el("div", { class: "tbl-box" }, el("table", { class: "tbl stackable" },
      el("thead", {}, el("tr", {}, ["Facilitator", "Region", "Open now", "All time", "Actions"].map((h) => el("th", { scope: "col", text: h })))),
      el("tbody", {}, rows.map((f) => el("tr", {},
        el("td", { "data-label": "Facilitator" }, el("div", { class: "row g12 nowrap" }, avatar(f.name), el("div", { class: "stack", style: "min-width:0" }, el("span", { class: "ttl", text: f.name }),
          f.email ? el("a", { class: "sm", href: `mailto:${f.email}`, text: f.email }) : null))),
        el("td", { "data-label": "Region" }, f.region || [el("span", { class: "muted", text: "No region " }), el("a", { class: "sm", href: `#/admin/p/${f.id}`, text: "Set" })]),
        el("td", { "data-label": "Open now" }, el("div", { class: "row g8" }, el("div", { class: "load", "aria-hidden": "true" }, el("span", { style: `width:${Math.min(100, f.open * 25)}%` })), el("span", { text: String(f.open) })),
          f.stalled ? el("span", { class: "sm strong bad-text", text: `${f.stalled} stalled` }) : null),
        el("td", { "data-label": "All time", text: String(f.total) }),
        el("td", { "data-label": "Actions" }, el("a", { class: "btnq", href: `#/admin/p/${f.id}`, text: "Edit" }))))))) : el("div", { class: "card soft" }, el("p", { text: "Nobody here." })));
  };
  draw();
  showRd({},
    el("div", { class: "row g16 between", style: "align-items:flex-end;margin-bottom:28px" },
      el("div", { class: "stack g12" }, el("p", { class: "eyebrow", text: "Staff" }), el("h1", { class: "t1", text: "Facilitators" }),
        el("p", { class: "muted", text: "Volunteer veterinarians who mediate requests, and how busy each one is." })),
      me.real && me.real.staff && !me.viewing ? el("a", { class: "btn2", href: "#/admin/new", text: "Add a facilitator" }) : null),
    el("div", { class: "toolbar" }, chips), box,
    el("p", { class: "sm muted", style: "margin-top:16px" }, "Region and roles are edited in ", el("a", { href: "#/admin", text: "People and access" }), "."));
}

// ---- letter templates (19) ----
let tplPick = 0;
async function letterList() {
  const t = await api("/api/templates");
  const withPh = (s) => String(s).split(/(\{\w+\})/g).map((part) => (/^\{\w+\}$/.test(part) ? el("span", { class: "ph", text: part }) : part));
  const nav = el("nav", { class: "colside stack g8", style: "flex:1 1 280px;max-width:380px", "aria-label": "Templates" });
  const view = el("section", { class: "colmain card", "aria-labelledby": "tp" });
  const draw = () => {
    const x = t[tplPick] || t[0];
    nav.replaceChildren(...t.map((y, i) => el("button", { type: "button", class: "choice tplbtn" + (i === tplPick ? " on" : ""), "aria-current": i === tplPick ? "true" : null, onclick: () => { tplPick = i; draw(); } },
      el("span", { class: "stack g4", style: "text-align:left" }, el("span", { class: "strong", text: y.type }), el("span", { class: "tag", text: y.recipient === "Owner" ? "To owner" : "To veterinarian" })))));
    view.replaceChildren(!x ? el("p", { text: "No templates yet." }) : [
      el("div", { class: "card-h" }, el("h2", { id: "tp", class: "t2", text: x.type }), el("span", { class: "tag", text: x.recipient === "Owner" ? "To owner" : "To veterinarian" })),
      el("p", { class: "sm" }, el("span", { class: "strong", text: "Subject: " }), withPh(x.subject)),
      el("hr", { class: "divider", style: "margin:16px 0" }),
      el("div", { class: "lettertext", style: "background:none;padding:0;font-size:16px" }, withPh(x.body)),
      el("p", { class: "sm muted", style: "margin-top:16px", text: "Changes made in Airtable show here within a minute." })]);
  };
  draw();
  showRd({},
    el("div", { class: "row g16 between", style: "align-items:flex-end;margin-bottom:28px" },
      el("div", { class: "stack g12" }, el("p", { class: "eyebrow", text: "Staff" }), el("h1", { class: "t1", text: "Letter templates" }),
        el("p", { class: "muted", text: "The letters facilitators can draft. Words in {braces} are filled in from the request." })),
      el("a", { class: "btn2", href: "https://airtable.com/appUbdZxOQ7WjyOYJ/tbloGcnfTRAu5niHD", target: "_blank", rel: "noopener" }, "Edit in Airtable", ico("ext"))),
    el("div", { class: "cols" }, nav, view));
}

// ---- People and access (20-22) ----
let adminFilter = "everyone", adminQuery = "";
const accessPills = (p) => {
  const pills = [p.staff && el("span", { class: "pill p-info", text: "Staff" }), p.facilitator && el("span", { class: "pill p-ok", text: "Facilitator" }),
    p.owner && el("span", { class: "pill p-mute", text: "Pet owner" }), !p.active && (p.staff || p.facilitator) && el("span", { class: "pill p-attn", text: "Inactive" })].filter(Boolean);
  return pills.length ? el("div", { class: "row g4" }, pills) : el("span", { class: "sm muted", text: "No access yet" });
};
async function admin() {
  if (!me.real || !me.real.staff || me.viewing) { location.hash = "#/"; return; }
  const { people } = await api("/api/admin/people");
  const FILTERS = [["everyone", "Everyone"], ["staff", "Staff"], ["facilitator", "Facilitators"], ["owner", "Pet owners"], ["inactive", "Inactive"]];
  const match = (p, k) => k === "everyone" || (k === "inactive" ? !p.active && (p.staff || p.facilitator) : p[k]);
  const search = el("input", { class: "input", type: "search", placeholder: "Search by name or email", "aria-label": "Search people", value: adminQuery });
  const chips = el("div", { class: "chips", role: "group", "aria-label": "Filter people" });
  const box = el("div");
  const draw = () => {
    const q = adminQuery.trim().toLowerCase();
    const rows = people.filter((p) => match(p, adminFilter) && (!q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)));
    chips.replaceChildren(...FILTERS.map(([k, l]) => el("button", { type: "button", class: "chip" + (k === adminFilter ? " on" : ""), "aria-pressed": String(k === adminFilter), onclick: () => { adminFilter = k; draw(); } },
      l, el("span", { class: "n", text: String(people.filter((p) => match(p, k)).length) }))));
    box.replaceChildren(rows.length ? el("div", { class: "tbl-box" }, el("table", { class: "tbl stackable" },
      el("thead", {}, el("tr", {}, ["Person", "Access", "Region", "Requests", "Actions"].map((h) => el("th", { scope: "col", text: h })))),
      el("tbody", {}, rows.slice(0, 300).map((p) => el("tr", {},
        el("td", { "data-label": "Person" }, el("div", { class: "stack", style: "min-width:0" }, el("span", { class: "ttl", text: p.name || "(no name)" }), el("span", { class: "sm muted", style: "overflow-wrap:anywhere", text: p.email }))),
        el("td", { "data-label": "Access" }, accessPills(p)),
        el("td", { "data-label": "Region" }, p.region || el("span", { class: "muted", text: "None" })),
        el("td", { "data-label": "Requests" }, p.total ? `${p.open} open of ${p.total}` : el("span", { class: "muted", text: "None" })),
        el("td", { "data-label": "Actions" }, el("div", { class: "row g8 nowrap" }, el("a", { class: "btn2 mini", href: `#/admin/p/${p.id}`, text: "Edit" }),
          p.email.toLowerCase() === me.email ? el("span", { class: "sm muted", text: "That's you" }) : el("button", { class: "btnq", type: "button", text: "View as", onclick: () => startViewing(p) })))))))) : el("div", { class: "card soft" }, el("p", { text: "Nobody matches." })));
  };
  search.addEventListener("input", () => { adminQuery = search.value; draw(); });
  draw();
  showRd({},
    el("div", { class: "row g16 between", style: "align-items:flex-end;margin-bottom:28px" },
      el("div", { class: "stack g12", style: "max-width:760px" }, el("p", { class: "eyebrow", text: "Staff · Admin" }), el("h1", { class: "t1", text: "People and access" }),
        el("p", { class: "muted", text: "Everyone in the portal and what they can do. Every change and every View as is recorded in the Admin Log table in Airtable." })),
      el("a", { class: "btn", href: "#/admin/new", text: "Add a person" })),
    el("div", { class: "toolbar" }, el("div", { class: "search" }, search), chips), box,
    el("p", { class: "sm muted", style: "margin-top:16px", text: "Pet owner isn't a setting: it means the person owns at least one mediation request." }));
}

async function adminPerson(id) {
  if (!me.real || !me.real.staff || me.viewing) { location.hash = "#/"; return; }
  const { people, regions } = await api("/api/admin/people");
  const isNew = !id;
  const p = isNew ? { name: "", email: "", staff: false, facilitator: true, active: true, region: "", open: 0, total: 0 } : people.find((x) => x.id === id);
  if (!p) { showRd({}, el("div", { class: "alert a-attn" }, ico("alert"), el("span", { text: "That person was not found." }))); return; }
  const name = el("input", { id: "ed-name", class: "input", value: p.name, autocomplete: "off", placeholder: isNew ? "Dr. First Last" : null });
  const email = el("input", { id: "ed-email", class: "input", type: "email", value: p.email, autocomplete: "off", readonly: !isNew, "aria-describedby": "ed-emh", placeholder: isNew ? "name@example.org" : null });
  const role = (id2, title, text, on) => el("label", { class: "choice" }, el("input", { type: "checkbox", id: id2, checked: on }), el("span", { class: "stack g4" }, el("span", { class: "strong", text: title }), el("span", { class: "sm muted", text })));
  const region = el("select", { id: "ed-region", class: "select" }, el("option", { value: "", text: isNew ? "Choose a region" : "No region" }), regions.map((r) => el("option", { value: r, text: r, selected: r === p.region })));
  const active = segField("ed-active", "Account", ["Active", "Inactive"], p.active ? "Active" : "Inactive");
  const msg = el("div");
  const form = el("form", { class: "colmain card stack", style: "gap:24px", novalidate: true },
    el("div", { class: isNew ? "grid2" : "stack g24" },
      el("div", { class: "field" }, el("label", { for: "ed-name", text: "Name" }), name),
      el("div", { class: "field" }, el("label", { for: "ed-email", text: "Email" }), email,
        el("span", { id: "ed-emh", class: "help", text: isNew ? "They sign in with this email. It can't be changed later." : "Locked because it's how they sign in." }))),
    el("fieldset", { class: "fs" }, el("legend", { text: "What can they do?" }),
      role("ed-staff", "Staff", "Sees every request, assigns facilitators, uses People and access.", p.staff),
      role("ed-fac", "Facilitator", "Can be assigned requests and mediates them.", p.facilitator)),
    el("div", { class: "field" }, el("label", { for: "ed-region", text: "Region" }), region, el("span", { class: "help", text: "Helps staff match facilitators to requests." })),
    isNew ? el("div", { class: "alert a-info" }, ico("info"), el("span", { text: "New people start as Active. You can make them Inactive any time from their page." }))
      : [active.node, el("span", { class: "help", style: "margin-top:-12px", text: "Inactive people keep their history but can't use Staff or Facilitator access." })],
    p.owner ? el("p", { class: "sm muted", text: "This person also owns at least one request, so they can always sign in to see their own." }) : null,
    msg,
    el("div", { class: "row g12" }, el("button", { class: "btn", type: "submit", text: isNew ? "Add person" : "Save changes" }), el("a", { class: "btnq", href: "#/admin", text: "Cancel" })));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); msg.replaceChildren();
    const btn = form.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      await post("/api/admin/person", { id: isNew ? undefined : p.id, name: name.value, email: email.value, staff: $("ed-staff").checked, facilitator: $("ed-fac").checked,
        active: isNew ? true : active.value === "Active", region: region.value });
      toast(isNew ? "Person added" : "Saved"); location.hash = "#/admin";
    } catch (err) { msg.append(el("div", { class: "alert a-attn" }, ico("alert"), el("span", { text: err.message }))); btn.disabled = false; }
  });
  const self = !isNew && p.email.toLowerCase() === me.email;
  showRd({},
    el("nav", { "aria-label": "Breadcrumb", class: "sm", style: "margin-bottom:16px" }, el("a", { href: "#/admin", text: "People and access" }), el("span", { class: "muted", text: ` / ${isNew ? "Add a person" : p.name || p.email}` })),
    el("div", { class: "stack g12", style: "margin-bottom:32px" }, el("h1", { class: "t1", text: isNew ? "Add a person" : p.name || p.email }),
      isNew ? el("p", { class: "muted", text: "Usually a new volunteer facilitator or a new staff member. Pet owners are added automatically when they file a request." }) : null),
    el("div", { class: "cols" }, form,
      isNew ? null : el("aside", { class: "colside" },
        el("section", { class: "card stack g12" }, el("h2", { class: "t3", text: "Their requests" }),
          el("p", {}, el("span", { class: "strong", text: `${p.open} open` }), el("span", { class: "muted", text: ` of ${p.total} all time` }))),
        self ? null : el("section", { class: "card soft stack g12" }, el("h2", { class: "t3", text: "See what they see" }),
          el("p", { class: "sm muted", text: "Opens the portal as this person with changes switched off. Recorded in the Admin Log." }),
          el("button", { class: "btn2", type: "button", style: "align-self:flex-start", text: `View as ${p.name || p.email}`, onclick: () => startViewing(p) })))));
}

// ---- one request ----
async function complaint(id) {
  const c = await api(`/api/complaint?id=${encodeURIComponent(id)}`);
  if (c.view === "owner") return ownerView(c);
  return facRequest(c, c.can_assign && !CLOSED.includes(c.status) ? await assignCard(c) : null);
}

// ---- pet owner pages (design/redesign 06-09, 28) ----
const OWNER_PILL = { "Awaiting assignment": "p-attn", "Facilitator assigned": "p-info", "Mediation in progress": "p-info", "Waiting on the veterinarian": "p-wait", "Waiting for your reply": "p-wait", "Completed": "p-ok", "Closed without resolution": "p-mute" };
const ownerPill = (label, short) => el("span", { class: "pill " + (OWNER_PILL[label] || "p-info"), text: short && label === "Waiting on the veterinarian" ? "Waiting on the vet" : label });
const vetName = (c) => (c.vet_name ? (/^dr\.?\s/i.test(c.vet_name) ? c.vet_name : `Dr. ${c.vet_name}`) : "the veterinarian");
const vetShort = (c) => (c.vet_name ? `Dr. ${String(c.vet_name).replace(/^Dr\.?\s+/i, "").split(" ").pop()}` : "the veterinarian");
function whatsHappening(c) {
  const fac = c.facilitator ? (typeof c.facilitator === "string" ? c.facilitator : c.facilitator.name) : "";
  switch (c.owner_status) {
    case "Awaiting assignment": return "We are finding a volunteer veterinarian for your request. This usually takes up to two weeks. You don't need to do anything right now.";
    case "Facilitator assigned": return `${fac || "Your facilitator"} will contact you directly by email or phone to talk it through.`;
    case "Waiting on the veterinarian": return `${fac ? fac + ", your facilitator," : "Your facilitator"} has reached out to ${vetShort(c)} and is waiting for a reply. You don't need to do anything right now.`;
    case "Waiting for your reply": return `${fac || "Your facilitator"} is waiting to hear from you. Please check your email and phone messages, or reply to their last message.`;
    case "Mediation in progress": return `${fac || "Your facilitator"} is talking with ${vetShort(c)} about your concerns. They'll be in touch with you.`;
    case "Closed without resolution": return "This request was closed without a resolution. If you have questions, email staff@nysvms.org. If something has changed, you can start a new request.";
    default: return "";
  }
}
function ownerSteps(status, labels = true) {
  const idx = stepIndex(status);
  return el("ol", { class: "steps", "aria-label": idx === 3 ? "Progress: all steps complete" : `Progress: step ${idx + 1} of 4` },
    STEPS.map((t, i) => el("li", { class: i < idx || (idx === 3 && status === "Completed") ? "done" : i === idx ? "now" : "" }, el("span", { class: "bar" }), labels ? el("span", { class: "lab", text: t }) : null)));
}
const initials = (n) => String(n || "").replace(/^Dr\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const avatar = (n) => el("span", { class: "avatar", "aria-hidden": "true", text: initials(n) });

function ownerHome(mine) {
  const open = mine.filter((c) => !CLOSED.includes(c.status)), closed = mine.filter((c) => CLOSED.includes(c.status));
  const first = String(me.name || "").split(" ")[0];
  const openCard = (c) => el("article", { class: "card stack", style: "gap:20px;margin-bottom:24px" },
    el("div", { class: "row g12 between", style: "align-items:flex-start" },
      el("div", { class: "stack g4", style: "min-width:0;flex:1 1 300px" }, el("span", { class: "sm muted", text: `Request #${c.n} · received ${fmtDate(c.received)}` }),
        el("h3", { class: "t2" }, el("a", { href: `#/c/${c.id}`, style: "color:#0a5a85", text: c.subject || "Your request" })),
        el("span", { class: "sm muted", text: `About ${vetName(c)}${c.practice ? ", " + c.practice : ""}` })),
      ownerPill(c.owner_status)),
    ownerSteps(c.status),
    el("p", { class: "sm strong show-phone", text: `Step ${stepIndex(c.status) + 1} of 4: ${STEPS[stepIndex(c.status)]}` }),
    el("div", { class: "alert a-info" }, ico("info"), el("span", {}, el("span", { class: "strong", text: "What's happening: " }), whatsHappening(c))),
    el("div", { class: "row g12 between" },
      c.facilitator ? el("span", { class: "row g12 nowrap" }, avatar(c.facilitator), el("span", { class: "stack" }, el("span", { class: "sm muted", text: "Your facilitator" }), el("span", { class: "strong", text: c.facilitator }))) : el("span"),
      el("a", { class: "btn", href: `#/c/${c.id}`, text: "View request" })));
  const closedCard = (c) => el("article", { class: "card stack", style: "gap:16px;margin-bottom:24px" },
    el("div", { class: "row g12 between", style: "align-items:flex-start" },
      el("div", { class: "stack g4", style: "min-width:0;flex:1 1 300px" }, el("span", { class: "sm muted", text: `Request #${c.n} · received ${fmtDate(c.received)}` }),
        el("h3", { class: "t3", style: "font-size:20px" }, el("a", { href: `#/c/${c.id}`, style: "color:#0a5a85", text: c.subject || "Your request" })),
        el("span", { class: "sm muted", text: `About ${vetName(c)}${c.facilitator ? " · Facilitator " + c.facilitator : ""}` })),
      ownerPill(c.owner_status)),
    c.resolution ? el("p", {}, el("span", { class: "strong", text: "Resolution: " }), c.resolution) : null,
    el("div", { class: "row g12" }, c.can_feedback ? el("a", { class: "btn", href: `#/feedback/${c.id}`, text: "Tell us how it went" }) : null, el("a", { class: c.can_feedback ? "btnq" : "btn2", href: `#/c/${c.id}`, text: "View request" })));
  showRd({},
    me.viewing && !me.viewing.can_sign_in ? el("div", { class: "alert a-warn", style: "margin-bottom:24px" }, ico("info"), el("span", { text: `${me.name} can't sign in to the portal: they aren't an active facilitator or staff member, and they don't own a request.` })) : null,
    el("div", { class: "row g16 between", style: "align-items:flex-end;margin-bottom:32px" },
      el("div", { class: "stack g12" }, el("p", { class: "eyebrow", text: "My requests" }), el("h1", { class: "t1", text: first ? `Welcome back, ${first}` : "Welcome back" }),
        el("p", { class: "muted", text: "Here is where each of your requests stands. Your facilitator will contact you directly by email or phone." })),
      el("a", { class: "btn2 hide-phone", href: "#/file" }, "+ New request")),
    open.length ? [el("h2", { class: "eyebrow", style: "margin-bottom:12px", text: `Open (${open.length})` }), open.map(openCard)] : null,
    closed.length ? [el("h2", { class: "eyebrow", style: "margin:16px 0 12px", text: `Completed (${closed.length})` }), closed.map(closedCard)] : null,
    !mine.length ? el("div", { class: "card soft stack g12" }, el("h2", { class: "t3", text: "No requests yet" }), el("p", { class: "muted", text: "When you request mediation, it will appear here." })) : null,
    el("a", { class: "btn2 full show-phone", style: "margin-top:8px", href: "#/file", text: "Start a new request" }));
}

function ownerView(c) {
  const done = c.status === "Completed";
  const crumb = el("nav", { "aria-label": "Breadcrumb", class: "sm", style: "margin-bottom:16px" }, el("a", { href: "#/", text: "My requests" }), el("span", { class: "muted", text: ` / Request #${c.n}` }));
  const head = el("div", { class: "stack g12", style: "margin-bottom:32px" },
    el("div", { class: "row g12" }, ownerPill(c.owner_status), el("span", { class: "sm muted", text: `Request #${c.n} · received ${fmtDate(c.received)}` })),
    el("h1", { class: "t1", text: c.subject || "Your request" }));
  const kindIco = { sent: "check", assigned: "check", done: "check", status: "clock", contact: "info" };
  const activity = (c.activity || []).length ? el("section", { class: "card", "aria-labelledby": "act" },
    el("h2", { id: "act", class: "t2", style: "margin-bottom:20px", text: "Activity" }),
    el("ol", { class: "tl" }, c.activity.map((a, i) => el("li", {}, el("span", { class: "dot" + (i === 0 && !done ? " now" : "") }, ico(kindIco[a.kind] || "check")),
      el("div", { class: "tlbody" }, el("span", { class: "sm muted", text: fmtDate(a.date) }), el("span", { text: a.text })))))) : null;
  const told = el("section", { class: "card stack g12", "aria-labelledby": "told" },
    el("h2", { id: "told", class: done ? "t3" : "t2", text: "What you told us" }),
    el("p", { class: "sm muted", text: `About ${vetName(c)}${c.practice ? ", " + c.practice : ""}` }),
    el("p", { style: "white-space:pre-wrap;overflow-wrap:anywhere", text: c.description || "" }),
    (c.uploads.length || c.release.length) ? el("div", { class: "row g8" }, [...c.uploads, ...c.release].map((f) => el("a", { class: "file", href: `/api/file?c=${c.id}&a=${f.id}`, target: "_blank", rel: "noopener", text: f.filename }))) : null);
  const facCard = el("section", { class: "card stack g16", "aria-labelledby": "fac" },
    el("h2", { id: "fac", class: "eyebrow", text: "Your facilitator" }),
    c.facilitator ? el("div", { class: "row g12 nowrap" }, avatar(c.facilitator.name), el("span", { class: "stack" }, el("span", { class: "strong", text: c.facilitator.name }),
      el("span", { class: "sm muted", text: `Volunteer veterinarian${c.facilitator.region ? " · " + c.facilitator.region : ""}` }))) : el("p", { class: "sm muted", text: "Not assigned yet. A volunteer veterinarian is usually assigned within two weeks." }),
    c.facilitator && !done ? el("p", { class: "sm muted", text: "They'll contact you directly. Reply to their emails to add anything new." }) : null);
  const help = el("section", { class: "card soft stack g8" }, el("h2", { class: "t3", text: done ? "Something else came up?" : "Need help?" }),
    done ? el("p", { class: "sm muted" }, "You can ", el("a", { href: "#/file", text: "start a new request" }), `, or email `, el("a", { href: "mailto:staff@nysvms.org", text: "staff@nysvms.org" }), ` and mention request #${c.n}.`)
      : el("p", { class: "sm muted" }, "Email ", el("a", { href: "mailto:staff@nysvms.org", text: "staff@nysvms.org" }), ` and mention request #${c.n}.`));
  let mainCol;
  if (done) {
    mainCol = [
      el("section", { class: "card stack fit", style: "gap:18px", "aria-labelledby": "res" }, el("h2", { id: "res", class: "eyebrow", text: "Resolution" }),
        el("p", { style: "font-family:Roboto,sans-serif;font-size:24px;line-height:1.35;color:#0a5a85", text: c.resolution || "Your facilitator closed this request." }),
        c.facilitator ? el("p", { class: "sm muted", text: `Recorded by your facilitator, ${c.facilitator.name}.` }) : null),
      c.can_feedback ? el("section", { class: "navy row g24 between", "aria-labelledby": "fb" },
        el("div", { class: "stack g8", style: "max-width:520px" }, el("h2", { id: "fb", class: "t3", style: "font-size:22px", text: "How did we do?" }),
          el("p", { text: "Four quick questions. Your answers help us improve mediation for other pet owners." })),
        el("a", { class: "btn lg", href: `#/feedback/${c.id}`, style: "background:#fff;color:#0a5a85", text: "Tell us how it went" }))
        : c.feedback_given ? el("div", { class: "alert a-ok" }, ico("check"), el("span", { text: "Thank you for your feedback." })) : null,
      el("section", { class: "card stack g16" }, el("h2", { class: "t3", text: "Progress" }), ownerSteps(c.status)),
      activity, told];
  } else {
    mainCol = [
      el("section", { class: "card stack", style: "gap:20px", "aria-labelledby": "ws" }, el("h2", { id: "ws", class: "t2", text: "Where it stands" }), ownerSteps(c.status),
        el("p", {}, el("span", { class: "strong", text: "What's happening: " }), whatsHappening({ ...c, facilitator: c.facilitator?.name || "" }), c.status !== "Closed without resolution" ? " When the request is completed you'll see the resolution here." : "")),
      activity, told];
  }
  showRd({}, crumb, head, el("div", { class: "cols" }, el("div", { class: "colmain" }, mainCol), el("aside", { class: "colside" }, facCard, help)));
}

// ---- facilitator pages (design/redesign 10-14, 27) ----
// Stored statuses keep their old names until the staff redesign; facilitators see these labels instead.
const facLabel = (s) => s || "Awaiting assignment";
const isWaiting = (s) => String(s).startsWith("Waiting on");
const facPillClass = (s) => (s === "Completed" ? "p-ok" : s === "Closed without resolution" ? "p-mute" : (s || "Awaiting assignment") === "Awaiting assignment" ? "p-attn" : isWaiting(s) ? "p-wait" : "p-info");
const facPill = (s, short) => el("span", { class: "pill " + facPillClass(s), text: short && s === "Waiting on the veterinarian" ? "Waiting on the vet" : facLabel(s) });
const ago = (d) => { const n = daysSince(d); return n <= 0 ? "Today" : n === 1 ? "Yesterday" : `${n} days ago`; };
const rdFile = (cid, f, uid) => el("a", { class: "file", href: `/api/file?c=${cid}${uid ? `&u=${uid}` : ""}&a=${f.id}`, target: "_blank", rel: "noopener" }, ico("file"), f.filename);
let facFilter = "open";
let rdKeep = false;
const reload = () => { rdKeep = true; route(); };

function facHome(work, mine) {
  const open = work.filter((c) => !CLOSED.includes(c.status));
  const FILTERS = [["open", "Open", open], ["waiting", "Waiting on a reply", work.filter((c) => isWaiting(c.status))], ["done", "Completed", work.filter((c) => CLOSED.includes(c.status))], ["all", "All", work]];
  const chips = el("div", { class: "chips", role: "group", "aria-label": "Filter assignments" });
  const box = el("div");
  const draw = () => {
    const rows = (FILTERS.find((f) => f[0] === facFilter) || FILTERS[0])[2];
    chips.replaceChildren(...FILTERS.map(([k, l, list]) => el("button", { type: "button", class: "chip" + (k === facFilter ? " on" : ""), "aria-pressed": String(k === facFilter), onclick: () => { facFilter = k; draw(); } },
      l, el("span", { class: "n", text: String(list.length) }))));
    box.replaceChildren(rows.length ? facTable(rows) : el("div", { class: "card soft stack g8" },
      el("p", { class: "strong", text: facFilter === "open" ? "No open assignments" : "Nothing here" }), el("p", { class: "sm muted", text: facFilter === "open" ? "You have nothing open right now." : "No requests match this filter." })));
  };
  draw();
  const noStep = open.filter((c) => !c.next_step);
  showRd({},
    me.viewing && !me.viewing.can_sign_in ? el("div", { class: "alert a-warn", style: "margin-bottom:24px" }, ico("info"), el("span", { text: `${me.name} can't sign in to the portal: they aren't an active facilitator or staff member, and they don't own a request.` })) : null,
    el("div", { class: "stack g12", style: "margin-bottom:32px" }, el("p", { class: "eyebrow", text: "Facilitator" }), el("h1", { class: "t1", text: "My assignments" })),
    noStep.length ? el("div", { class: "alert a-warn", style: "margin-bottom:28px" }, ico("clock"),
      el("span", {}, el("span", { class: "strong", text: `${noStep.length} open ${noStep.length === 1 ? "request has" : "requests have"} no next step. ` }),
        "Add one so staff can see where things stand: ", noStep.map((c, i) => [i ? ", " : "", el("a", { href: `#/c/${c.id}`, text: `request #${c.n}` })]))) : null,
    el("div", { class: "toolbar" }, chips), box,
    el("p", { class: "sm muted", style: "margin-top:16px" }, "New assignments arrive by email and appear here. ", el("a", { href: "#/guide", text: "How mediation works" })),
    mine.length ? el("section", { class: "stack g12", style: "margin-top:40px" }, el("h2", { class: "eyebrow", text: "Your own requests" }),
      mine.map((c) => el("p", {}, el("a", { href: `#/c/${c.id}`, text: `#${c.n} · ${c.subject || "Mediation request"}` }), " ", ownerPill(c.owner_status || "Awaiting assignment")))) : null);
}

function facTable(rows) {
  return el("div", { class: "tbl-box" }, el("table", { class: "tbl stackable" },
    el("thead", {}, el("tr", {}, ["Request", "Status", "Your next step", "Last activity"].map((h) => el("th", { scope: "col", text: h })))),
    el("tbody", {}, rows.map((c) => el("tr", {},
      el("td", { "data-label": "Request" }, el("div", { class: "stack g4" }, el("a", { class: "ttl", href: `#/c/${c.id}`, text: c.subject || "Mediation request" }),
        el("span", { class: "sm muted", text: [`#${c.n}`, c.vet_name ? vetName(c) : "", c.owner ? `owner ${c.owner}` : ""].filter(Boolean).join(" · ") }))),
      el("td", { "data-label": "Status" }, facPill(c.status, true)),
      el("td", { "data-label": "Your next step" }, CLOSED.includes(c.status) ? el("span", { class: "muted", text: "None" }) : c.next_step ? el("span", { text: c.next_step }) : el("span", { class: "muted", text: "Not set" })),
      el("td", { "data-label": "Last activity" }, el("div", { class: "stack g4" }, el("span", { text: fmtDate(c.last_activity) }), el("span", { class: "sm muted", text: ago(c.last_activity) }))))))));
}

// A row of square toggle buttons (radio inputs underneath).
function segField(name, legend, opts, initial, onchange) {
  let val = initial;
  const node = el("fieldset", { class: "fs" }, el("legend", { text: legend }),
    el("div", { class: "seg" }, opts.map((o) => {
      const r = el("input", { type: "radio", name, value: o, checked: o === initial });
      r.addEventListener("change", () => { val = o; if (onchange) onchange(o); });
      return el("label", {}, r, o);
    })));
  return { node, get value() { return val; } };
}

const TL_ICO = { Call: "phone", Email: "mail", Letter: "mail", Note: "pen", "Status change": "clock", Assigned: "check" };
const WITH_WORD = { Owner: "the owner", Veterinarian: "the vet", Other: "someone else" };
function facTimeline(c) {
  const items = c.updates.map((u) => {
    const type = u.type || (u.letter_type ? "Letter" : "Note");
    const label = type === "Letter" ? (u.with ? `Letter to ${WITH_WORD[u.with]}` : "Letter")
      : ["Call", "Email"].includes(type) && u.with ? `${type} with ${WITH_WORD[u.with]}` : type === "Status change" ? "Status" : type;
    const text = type === "Status change" && u.status_set ? `Status set to ${facLabel(u.status_set)}` : u.notes;
    return el("li", {}, el("span", { class: "dot" }, ico(TL_ICO[type] || "pen")), el("div", { class: "tlbody" },
      el("span", { class: "sm muted", text: [fmtDate(u.date), u.author, label].filter(Boolean).join(" · ") }),
      text ? el("span", { style: "white-space:pre-wrap;overflow-wrap:anywhere", text }) : null,
      u.letter_type ? el("span", { class: "tag", text: `Letter used: ${u.letter_type}` }) : null,
      u.letter_text ? el("details", { class: "sm" }, el("summary", { text: "Show the letter" }), el("pre", { class: "lettertext", text: u.letter_text })) : null,
      u.documents.length ? el("div", { class: "row g8" }, u.documents.map((f) => rdFile(c.id, f, u.id))) : null));
  });
  items.push(el("li", {}, el("span", { class: "dot" }, ico("check")), el("div", { class: "tlbody" }, el("span", { class: "sm muted", text: fmtDate(c.received) }), el("span", { class: "muted", text: "Request received" }))));
  return el("ol", { class: "tl" }, items);
}

const UNCONFIRMED = { member: "that the veterinarian is a NYSVMS member", legal: "that no legal action is under way", opd: "that no complaint was filed with the Office of the Professions",
  fees: "that the concern isn't about fees", service: "that they read how this service works", terms: "that they accepted the terms" };

function facRequest(c, assign) {
  const done = CLOSED.includes(c.status), completed = c.status === "Completed";
  const home = me.staff ? "Requests" : "My assignments";
  const busy = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (err) { toast(err.message, true); btn.disabled = false; } };

  // status: saves on change; Completed only through Close request
  const st = el("select", { id: "st", class: "select" }, c.statuses.filter((s) => s !== "Completed" || s === c.status).map((s) => el("option", { value: s, text: facLabel(s), selected: s === c.status })));
  st.addEventListener("change", async () => {
    try { await post("/api/complaint/status", { id: c.id, status: st.value }); toast(`Status set to ${facLabel(st.value)}`); reload(); }
    catch (err) { toast(err.message, true); st.value = c.status; }
  });

  // close request (resolution + Completed in one step)
  const resIn = el("textarea", { id: "cl-res", class: "textarea", style: "min-height:100px", maxlength: "500" }); resIn.value = c.resolution || "";
  const resNotes = el("textarea", { id: "cl-notes", class: "textarea", style: "min-height:100px" }); resNotes.value = c.resolution_notes || "";
  const closeBox = el("section", { class: "card stack g16 focusbox", hidden: true, "aria-labelledby": "cl-h" },
    el("h2", { id: "cl-h", class: "t2", text: completed ? "Edit the resolution" : "Close request" }),
    el("p", { class: "muted", text: completed ? "The owner sees the resolution on their request page." : "Saving records the resolution and sets the status to Completed. The owner then sees the resolution on their request page. After that, send the two resolution letters." }),
    el("div", { class: "field" }, el("label", { for: "cl-res", text: "Resolution the owner will see" }), resIn,
      el("span", { class: "help", text: "One or two plain sentences. For example: The clinic explained the test results and refunded the exam fee." })),
    el("div", { class: "field" }, el("label", { for: "cl-notes" }, "Notes for staff", el("span", { class: "opt", text: " (optional, the owner never sees these)" })), resNotes),
    el("div", { class: "row g12" },
      el("button", { class: "btn", type: "button", text: completed ? "Save resolution" : "Close request", onclick: (e) => busy(e.currentTarget, async () => {
        await post("/api/complaint/close", { id: c.id, resolution: resIn.value, resolution_notes: resNotes.value });
        toast(completed ? "Resolution saved" : "Request closed. Next, send the two resolution letters."); reload();
      }) }),
      el("button", { class: "btnq", type: "button", text: "Cancel", onclick: () => (closeBox.hidden = true) })));
  const openClose = () => { closeBox.hidden = false; closeBox.scrollIntoView({ behavior: "smooth", block: "start" }); resIn.focus({ preventScroll: true }); };

  // log an update (12)
  const withSeg = segField("up-w", "With", ["Owner", "Veterinarian", "Other"], "Owner");
  const kindSeg = segField("up-k", "What kind of update?", ["Call", "Email", "Note"], "Call", (v) => (withSeg.node.hidden = v === "Note"));
  const upText = el("textarea", { id: "up", class: "textarea", placeholder: "What happened, who you spoke to, what's next" });
  const upFile = el("input", { id: "up-f", type: "file", class: "sm" });
  const nextIn = el("input", { id: "up-next", class: "input", maxlength: "200", value: c.next_step || "", placeholder: "For example: Follow up with the vet next week" });
  const alsoBox = el("input", { type: "checkbox", id: "up-also" });
  const alsoOpts = c.statuses.filter((s) => s !== "Completed" && s !== c.status);
  const alsoSel = el("select", { class: "select inline", "aria-label": "New status" }, alsoOpts.map((s) => el("option", { value: s, text: facLabel(s) })));
  alsoSel.addEventListener("change", () => (alsoBox.checked = true));
  const upForm = el("form", { class: "stack focusbox", style: "gap:20px;margin-bottom:28px", hidden: true, "aria-label": "Log an update", novalidate: true },
    el("div", { class: "row g24", style: "align-items:flex-start" }, kindSeg.node, withSeg.node),
    el("div", { class: "field" }, el("label", { for: "up", text: "What happened" }), upText,
      el("span", { class: "help", text: "Staff can read this. The owner can't. A call or email with the owner or vet shows on the owner's page as one line, for example \"Your facilitator called Dr. Greer\"." })),
    el("div", { class: "field" }, el("label", { for: "up-f" }, "Attach a document", el("span", { class: "opt", text: " (optional, up to 4 MB)" })), el("div", { class: "drop" }, ico("clip"), upFile)),
    !done ? el("div", { class: "field" }, el("label", { for: "up-next" }, "Your next step", el("span", { class: "opt", text: " (shows on My assignments)" })), nextIn) : null,
    !done && alsoOpts.length ? el("label", { class: "choice", style: "align-items:center" }, alsoBox, el("span", {}, "Also change status to", alsoSel)) : null,
    el("div", { class: "row g12" }, el("button", { class: "btn", type: "submit", text: "Save update" }), el("button", { class: "btnq", type: "button", text: "Cancel", onclick: () => (upForm.hidden = true) })));
  upForm.addEventListener("submit", (e) => {
    e.preventDefault();
    busy(upForm.querySelector("button[type=submit]"), async () => {
      const out = await post("/api/complaint/update", { id: c.id, notes: upText.value, type: kindSeg.value, with: kindSeg.value === "Note" ? undefined : withSeg.value,
        next_step: done ? undefined : nextIn.value, status: alsoBox.checked ? alsoSel.value : undefined });
      const failed = upFile.files.length ? await uploadFiles([...upFile.files], { complaint: c.id, field: "update", update: out.update }) : [];
      toast(failed.length ? `Update saved, but ${failed.join(", ")} didn't upload` : "Update saved", failed.length > 0); reload();
    });
  });
  const openLog = () => { upForm.hidden = false; upForm.scrollIntoView({ behavior: "smooth", block: "start" }); upText.focus({ preventScroll: true }); };

  // checks before contacting the vet
  const A = c.attestations || {};
  const missing = Object.keys(UNCONFIRMED).filter((k) => !A[k]);
  const warn = !done && (!c.records_ok || missing.length) ? el("div", { class: "alert a-warn", style: "margin-bottom:28px" }, ico("alert"), el("div", { class: "stack g4" },
    el("span", { class: "strong", text: "Check before you contact the vet" }),
    el("span", { text: [!c.records_ok ? "The owner did not give permission to share records." : "", missing.length ? "Some \"Before you start\" statements were not confirmed." : ""].filter(Boolean).join(" ") }),
    missing.length ? el("details", { class: "sm" }, el("summary", { text: "See which" }), el("p", { text: `The owner did not confirm ${missing.map((k) => UNCONFIRMED[k]).join("; ")}.` })) : null)) : null;

  // People
  const o = c.owner;
  const tel = (p) => String(p).replace(/[^\d+]/g, "");
  const vetEmailIn = el("input", { id: "vet-em", class: "input", type: "email", autocomplete: "off", placeholder: "name@practice.com" });
  const vetAdd = el("div", { class: "stack g8", hidden: true }, el("label", { for: "vet-em", class: "lbl", text: "Veterinarian's email" }), vetEmailIn,
    el("div", { class: "row g8" }, el("button", { class: "btn2 mini", type: "button", text: "Save email", onclick: (e) => busy(e.currentTarget, async () => {
      await post("/api/complaint/vet_email", { id: c.id, email: vetEmailIn.value }); toast("Email saved"); reload();
    }) }), el("button", { class: "btnq", type: "button", text: "Cancel", onclick: () => (vetAdd.hidden = true) })));
  const people = el("section", { class: "card stack", style: "gap:20px", "aria-labelledby": "ppl" }, el("h2", { id: "ppl", class: "t3", text: "People" }),
    el("div", { class: "stack g8" }, el("span", { class: "eyebrow", style: "color:#555", text: "Owner" }), el("span", { class: "strong", text: o?.name || "Not recorded" }),
      o ? el("div", { class: "row g8" },
        o.email ? el("a", { class: "btn2 mini", href: `mailto:${o.email}` }, ico("mail"), el("span", { class: "hide-phone", text: o.email }), el("span", { class: "show-phone", text: "Email" })) : null,
        o.phone ? el("a", { class: "btn2 mini", href: `tel:${tel(o.phone)}` }, ico("phone"), el("span", { class: "hide-phone", text: o.phone }), el("span", { class: "show-phone", text: "Call" })) : null) : null),
    el("hr", { class: "divider" }),
    el("div", { class: "stack g8" }, el("span", { class: "eyebrow", style: "color:#555", text: "Veterinarian" }), el("span", { class: "strong", text: c.vet_name ? vetName(c) : "Not recorded" }),
      c.practice || c.practice_address ? el("span", { class: "sm muted", text: [c.practice, c.practice_address].filter(Boolean).join(", ") }) : null,
      c.vet_email ? el("a", { class: "btn2 mini", style: "align-self:flex-start", href: `mailto:${c.vet_email}` }, ico("mail"), c.vet_email)
        : el("div", { class: "alert a-attn", style: "padding:10px 12px;font-size:14px" }, el("span", {}, "No email on file. ",
          el("button", { class: "linkbtn", type: "button", text: "Add an email", onclick: () => { vetAdd.hidden = false; vetEmailIn.focus(); } }))),
      vetAdd),
    me.staff && c.facilitator ? [el("hr", { class: "divider" }), el("div", { class: "stack g4" }, el("span", { class: "eyebrow", style: "color:#555", text: "Facilitator" }), el("span", { class: "strong", text: c.facilitator.name }),
      c.facilitator.region ? el("span", { class: "sm muted", text: c.facilitator.region }) : null,
      assign ? el("button", { class: "linkbtn sm", type: "button", style: "align-self:flex-start", text: "Reassign", onclick: () => { assignBox.hidden = false; assignBox.scrollIntoView({ behavior: "smooth", block: "start" }); } }) : null)] : null);

  // next step and staff notes
  const nsIn = el("input", { id: "ns", class: "input", maxlength: "200", value: c.next_step || "", placeholder: "What you'll do next" });
  const nextCard = !done ? el("section", { class: "card stack g12", "aria-labelledby": "ns-h" }, el("h2", { id: "ns-h", class: "t3", text: me.staff ? "Next step" : "Your next step" }),
    el("p", { class: "sm muted", text: "Shows on My assignments, so you and staff can see what's next." }), nsIn,
    el("button", { class: "btn2", type: "button", style: "align-self:flex-start", text: "Save next step", onclick: (e) => busy(e.currentTarget, async () => {
      await post("/api/complaint/next_step", { id: c.id, next_step: nsIn.value }); toast("Next step saved"); reload();
    }) })) : null;
  const sn = el("textarea", { id: "sn-t", class: "textarea", style: "min-height:100px" });
  const notesCard = el("section", { class: "card stack g12", "aria-labelledby": "sn" }, el("h2", { id: "sn", class: "t3" }, el("label", { for: "sn-t", text: "Notes for staff" })),
    el("p", { class: "sm muted", text: me.staff ? "Only NYSVMS staff and the facilitator see these. The owner never does. Each note is added to Activity." : "Only you and NYSVMS staff see these. The owner never does. Each note is added to Activity." }), sn,
    el("button", { class: "btn2", type: "button", style: "align-self:flex-start", text: "Save note", onclick: (e) => busy(e.currentTarget, async () => {
      await post("/api/complaint/update", { id: c.id, notes: sn.value, type: "Note" }); toast("Note saved"); reload();
    }) }));
  const fb = c.feedback ? el("section", { class: "card stack g12" }, el("h2", { class: "t3", text: "Owner feedback" }),
    el("dl", { class: "sm stack g4", style: "margin:0" }, [["Overall", c.feedback.overall], ["Facilitator", c.feedback.facilitator], ["Staff", c.feedback.admin], ["Value", c.feedback.value]].filter(([, v]) => v)
      .map(([k, v]) => el("div", { class: "row g8 between" }, el("dt", { text: k }), el("dd", { style: "margin:0", class: "strong", text: `${v} of 5` })))),
    c.feedback.comments ? el("p", { class: "sm", style: "white-space:pre-wrap", text: c.feedback.comments }) : null) : null;

  // staff: assign, close without resolution; duplicate and stalled warnings
  const assignBox = el("div", { hidden: !(assign && !c.facilitator) }, assign);
  const reason = el("textarea", { id: "un-r", class: "textarea", style: "min-height:90px", maxlength: "500" });
  if (c.duplicate_of) reason.value = `Duplicate of #${c.duplicate_of.n}`;
  const unresBox = el("section", { class: "card stack g16 focusbox", hidden: true, "aria-labelledby": "un-h" },
    el("h2", { id: "un-h", class: "t2", text: "Close without resolution" }),
    el("p", { class: "muted", text: "For a duplicate, a stalled request, or one we can't take. The status becomes Closed without resolution. The owner is not emailed; they see the new status when they sign in." }),
    el("div", { class: "field" }, el("label", { for: "un-r", text: "Reason (staff only)" }), reason),
    el("div", { class: "row g12" }, el("button", { class: "btn", type: "button", text: "Close without resolution", onclick: (e) => busy(e.currentTarget, async () => {
      await post("/api/complaint/close_unresolved", { id: c.id, reason: reason.value }); toast("Closed without resolution"); reload();
    }) }), el("button", { class: "btnq", type: "button", text: "Cancel", onclick: () => (unresBox.hidden = true) })));
  const openUnres = () => { unresBox.hidden = false; unresBox.scrollIntoView({ behavior: "smooth", block: "start" }); reason.focus({ preventScroll: true }); };
  const lastAct = c.updates.length ? c.updates[0].date : c.received;
  const stale = !done && c.facilitator && daysSince(lastAct) > STALE_DAYS;
  const dupWarn = c.duplicate_of && !done ? el("div", { class: "alert a-warn", style: "margin-bottom:28px" }, ico("alert"), el("span", {},
    el("span", { class: "strong", text: "Appears to be a duplicate of " }), el("a", { href: `#/c/${c.duplicate_of.id}`, text: `request #${c.duplicate_of.n}` }),
    ". Same owner and veterinarian, filed within 14 days.", c.can_assign ? [" ", el("button", { class: "linkbtn", type: "button", text: "Close this one without resolution", onclick: openUnres })] : null)) : null;
  const staleWarn = stale ? el("div", { class: "alert a-bad", style: "margin-bottom:28px" }, ico("alert"),
    el("span", {}, el("span", { class: "strong", text: `Stalled: no activity in ${daysSince(lastAct)} days.` }), " Check in with the facilitator, or close it.")) : null;
  const unresNote = (c.updates.find((u) => u.type === "Status change" && u.status_set === "Closed without resolution") || {}).notes;
  const unresCard = c.status === "Closed without resolution" ? el("section", { class: "card soft stack g8" }, el("h2", { class: "eyebrow", text: "Closed without resolution" }),
    el("p", { text: String(unresNote || "No reason recorded.").replace(/^Closed without resolution:s*/, "") })) : null;

  const head = el("div", { class: "row g24 between", style: "align-items:flex-end;margin-bottom:24px" },
    el("div", { class: "stack g12", style: "min-width:0;flex:1 1 420px" },
      el("span", { class: "sm muted", text: `Request #${c.n} · received ${fmtDate(c.received)}${c.facilitator ? " · facilitator " + c.facilitator.name : ""}` }),
      el("h1", { class: "t1", text: c.subject || "Mediation request" })),
    el("div", { class: "row g12", style: "align-items:flex-end" },
      el("div", { class: "field", style: "min-width:260px;flex:1 1 260px" }, el("label", { for: "st", text: "Status" }), st),
      el("a", { class: "btn2 hide-phone", href: `#/c/${c.id}/letter`, text: "Draft a letter" }),
      !done ? el("button", { class: "btn hide-phone", type: "button", text: "Close request", onclick: openClose }) : null,
      !done && c.can_assign ? el("button", { class: "btnq hide-phone", type: "button", text: "Close without resolution", onclick: openUnres }) : null));

  const resCard = completed ? el("section", { class: "card stack fit", style: "gap:12px" }, el("h2", { class: "eyebrow", text: "Resolution" }),
    el("p", { style: "font-family:Roboto,sans-serif;font-size:20px;line-height:1.4;color:#0a5a85", text: c.resolution || "No resolution recorded." }),
    c.resolution_notes ? el("p", { class: "sm muted", style: "white-space:pre-wrap", text: `Notes for staff: ${c.resolution_notes}` }) : null,
    el("button", { class: "btnq", type: "button", style: "align-self:flex-start;padding:0", text: "Edit the resolution", onclick: openClose })) : null;

  const activity = el("section", { class: "card", "aria-labelledby": "act" },
    el("div", { class: "card-h" }, el("h2", { id: "act", class: "t2", text: "Activity" }), el("span", { class: "sm muted", text: `${c.updates.length} ${c.updates.length === 1 ? "update" : "updates"}` })),
    el("button", { class: "logbtn", type: "button", onclick: openLog }, ico("plus"), "Log a call, email or note"),
    upForm, facTimeline(c));
  const told = el("section", { class: "card stack g12", "aria-labelledby": "told" }, el("h2", { id: "told", class: "t2", text: "What the owner told us" }),
    el("p", { style: "font-size:18px;white-space:pre-wrap;overflow-wrap:anywhere", text: c.description || "Nothing written." }),
    c.uploads.length || c.release.length ? el("div", { class: "row g8" }, [...c.uploads, ...c.release].map((f) => rdFile(c.id, f))) : null);

  showRd({ keep: rdKeep },
    el("nav", { "aria-label": "Breadcrumb", class: "sm", style: "margin-bottom:16px" }, el("a", { href: "#/", text: home }), el("span", { class: "muted", text: ` / Request #${c.n}` })),
    head, staleWarn, dupWarn, warn,
    el("div", { class: "cols" },
      el("div", { class: "colmain" }, assignBox, unresBox, closeBox, resCard, unresCard, activity, told),
      el("aside", { class: "colside" }, people, nextCard, notesCard, fb,
        !done ? el("p", { class: "sm muted hide-phone" }, "Ready to wrap up? ", el("span", { class: "strong", style: "color:#333", text: "Close request" }), " asks for the resolution the owner will see and sets the status to Completed in one step.") : null)),
    el("div", { class: "stickybar" }, el("button", { class: "btn", type: "button", text: "Log update", onclick: openLog }),
      el("a", { class: "btn2", href: `#/c/${c.id}/letter`, text: "Draft letter" }),
      !done ? el("button", { class: "btn2", type: "button", text: "Close", onclick: openClose }) : null),
    !done && c.can_assign ? el("p", { class: "show-phone sm", style: "margin-top:16px" }, el("button", { class: "linkbtn", type: "button", text: "Close without resolution", onclick: openUnres })) : null);
}

// ---- letters (13) ----
async function letter(id) {
  const [c, templates] = await Promise.all([api(`/api/complaint?id=${encodeURIComponent(id)}`), api("/api/templates")]);
  if (c.view !== "full") { location.hash = `#/c/${id}`; return; }
  const names = (list) => (list.length ? `${list.map((f) => f.filename).join(", ")} (please attach to your email)` : "");
  const values = (t) => ({
    complaint_number: c.n, received_date: fmtDate(c.received), owner_name: c.owner?.name, owner_email: c.owner?.email, vet_name: String(c.vet_name || "").replace(/^Dr\.?\s+/i, ""), vet_email: c.vet_email,
    facilitator_name: String(c.facilitator?.name || "").replace(/^Dr\.?\s*/i, ""), subject: c.subject, description: c.description, resolution: c.resolution,
    uploads_link: names(c.uploads) || "None provided", release_form_link: names(c.release),
    feedback_link: t.recipient === "Owner" ? `${location.origin}/#/feedback/${c.id}` : ""
  });
  const fill = (s, t) => String(s).replace(/\{(\w+)\}/g, (m, k) => { const v = values(t)[k]; return v === undefined || v === null || v === "" ? m : String(v); });
  const recip = (t) => (t.recipient === "Owner" ? { name: c.owner?.name || "the owner", email: c.owner?.email || "" } : { name: c.vet_name ? vetName(c) : "the veterinarian", email: c.vet_email || "" });
  const lastUsed = (t) => c.updates.filter((u) => u.letter_type === t.type).map((u) => u.date).sort().pop();
  const home = me.staff ? "All requests" : "My assignments";
  let cur = 0;
  const to = el("input", { id: "lt-to", class: "input" }), subj = el("input", { id: "lt-sub", class: "input" });
  const body = el("textarea", { id: "lt-body", class: "textarea", style: "min-height:380px;font-size:16px" });
  const check = el("div", { "aria-live": "polite" });
  const mail = el("a", { class: "btn" }, ico("mail"), "Open in my email");
  const mailNote = el("p", { class: "sm muted" });
  const refresh = () => {
    const found = [...new Set(`${subj.value}\n${body.value}`.match(/\{\w+\}/g) || [])];
    check.replaceChildren(found.length
      ? el("div", { class: "alert a-warn" }, ico("alert"), el("span", {}, el("span", { class: "strong", text: `${found.length} left in {braces}: ` }), found.map((m, i) => [i ? " " : "", el("span", { class: "ph", text: m })]), " Replace each one before sending."))
      : el("div", { class: "alert a-ok" }, ico("check"), el("span", { text: "Nothing left in {braces}. Ready to send." })));
    const addr = (to.value.match(/<([^>\s]+@[^>\s]+)>/) || [])[1] || (/^[^\s@<>]+@[^\s@<>]+$/.test(to.value.trim()) ? to.value.trim() : "");
    const href = `mailto:${addr}?subject=${encodeURIComponent(subj.value)}&body=${encodeURIComponent(body.value)}`;
    mail.hidden = !addr; mail.href = href;
    mailNote.textContent = !addr ? "There's no email address to send to. Copy the letter and send it another way." : href.length > 1800 ? "This letter is long. If your email program cuts it off, use Copy letter and paste it instead." : "";
  };
  [to, subj, body].forEach((n) => n.addEventListener("input", refresh));
  const load = (i) => {
    cur = i; const t = templates[i], r = recip(t);
    to.value = r.email ? `${r.name} <${r.email}>` : r.name;
    subj.value = fill(t.subject, t); body.value = fill(t.body, t);
    refresh();
  };
  const choices = el("fieldset", { class: "fs" }, el("legend", { class: "eyebrow", style: "color:#555;font-size:12px", text: "Choose a letter" }),
    templates.map((t, i) => {
      const r = recip(t), used = lastUsed(t);
      const radio = el("input", { type: "radio", name: "lt", value: String(i), checked: i === 0 });
      radio.addEventListener("change", () => load(i));
      return el("label", { class: "choice" }, radio, el("span", { class: "stack g4" }, el("span", { class: "strong", text: t.type }), el("span", { class: "sm muted", text: `To ${r.name}` }),
        !r.email ? el("span", { class: "sm", style: "color:#9b4318", text: "No email on file. Copy the letter and send it another way." }) : null,
        used ? el("span", { class: "tag", text: `Used ${fmtDate(used)}` }) : null));
    }));
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Subject: ${subj.value}\n\n${body.value}`); toast("Letter copied. Paste it into your email."); }
    catch { body.select(); toast("Press Ctrl+C to copy the selected letter"); }
  };
  const logSent = async (e) => {
    const btn = e.currentTarget, t = templates[cur];
    btn.disabled = true;
    try {
      await post("/api/complaint/update", { id: c.id, notes: `Letter sent to ${to.value}: ${subj.value}`, letter_type: t.type, with: t.recipient === "Owner" ? "Owner" : "Veterinarian", letter_text: `Subject: ${subj.value}\n\n${body.value}` });
      toast("Logged in Activity"); location.hash = `#/c/${c.id}`;
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  };
  showRd({},
    el("nav", { "aria-label": "Breadcrumb", class: "sm", style: "margin-bottom:16px" }, el("a", { href: "#/", text: home }), el("span", { class: "muted", text: " / " }),
      el("a", { href: `#/c/${c.id}`, text: `Request #${c.n}` }), el("span", { class: "muted", text: " / Draft a letter" })),
    el("div", { class: "stack g12", style: "margin-bottom:32px" }, el("h1", { class: "t1", text: "Draft a letter" }),
      el("p", { class: "muted", style: "max-width:760px", text: "Pick a letter and the request's details are filled in for you. Edit it, then send it from your own email so the owner and veterinarian hear from you directly." })),
    templates.length ? el("div", { class: "cols" },
      el("aside", { class: "colside", style: "flex:1 1 300px;max-width:380px" }, choices,
        el("div", { class: "alert a-info" }, ico("info"), el("span", { text: "The portal never sends letters for you. Files can't be linked for the vet, so attach them to your email." }))),
      el("section", { class: "colmain card", style: "gap:18px", "aria-label": "Letter editor" },
        el("div", { class: "grid2" }, el("div", { class: "field" }, el("label", { for: "lt-to", text: "To" }), to), el("div", { class: "field" }, el("label", { for: "lt-sub", text: "Subject" }), subj)),
        el("div", { class: "field" }, el("label", { for: "lt-body", text: "Letter" }), body), check,
        el("div", { class: "row g12 between" },
          el("div", { class: "row g12" }, mail, el("button", { class: "btn2", type: "button", onclick: copy }, ico("copy"), "Copy letter")),
          el("button", { class: "btnq", type: "button", text: "Log as sent and go back", onclick: logSent })),
        mailNote)) : el("div", { class: "card soft" }, el("p", { text: "There are no letter templates yet." })));
  if (templates.length) load(0);
}

// ---- facilitator guide (14) ----
function guide() {
  const step = (n, title, text, link) => el("li", { class: "card row g24", style: "align-items:flex-start;flex-wrap:nowrap" }, el("span", { class: "kpi", "aria-hidden": "true", style: "width:40px;flex:none", text: String(n) }),
    el("div", { class: "stack g8" }, el("h2", { class: "t3", text: title }), el("p", { class: "muted", text }), link || null));
  const rows = [["Awaiting assignment", "Staff haven't picked a facilitator yet."], ["Facilitator assigned", "You have it. Introduce yourself next."],
    ["Mediation in progress", "You're talking with the owner and the vet."], ["Waiting on the veterinarian", "You've reached out and the vet hasn't replied."],
    ["Waiting on the owner", "You've reached out and the owner hasn't replied."], ["Completed", "Resolved. The owner can now see the resolution."],
    ["Closed without resolution", "Staff closed it, for example as a duplicate or because it stalled."]];
  showRd({},
    el("div", { class: "stack g12", style: "margin-bottom:32px" }, el("p", { class: "eyebrow", text: "Facilitator guide" }), el("h1", { class: "t1", text: "How mediation works" }),
      el("p", { class: "lede", text: "Four steps from assignment to resolution." })),
    el("ol", { class: "stack g16", style: "list-style:none;margin:0 0 48px;padding:0;max-width:880px" },
      step(1, "Accept the assignment", "Staff ask you to take a mediation request. You get an email and it appears under My assignments.", el("a", { class: "sm strong", href: "#/", text: "Go to My assignments" })),
      step(2, "Introduce yourself", "Introduce yourself to the owner, then to the veterinarian, using Draft a letter on the request page."),
      step(3, "Log every contact", "Log each call or email as an update so staff can see where things stand. Keep the status and your next step current."),
      step(4, "Close the request", "When it's resolved, choose Close request: record the resolution, which sets the status to Completed. Then send the two resolution letters. The owner's letter includes a feedback link.")),
    el("h2", { class: "t2", style: "margin-bottom:16px", text: "What each status means" }),
    el("div", { class: "tbl-box", style: "max-width:880px;margin-bottom:32px" }, el("table", { class: "tbl stackable" },
      el("thead", {}, el("tr", {}, ["Status", "Means", "Owner sees"].map((h) => el("th", { scope: "col", text: h })))),
      el("tbody", {}, rows.map(([s, m]) => el("tr", {}, el("td", { "data-label": "Status" }, facPill(s)), el("td", { "data-label": "Means", text: m }),
        el("td", { "data-label": "Owner sees", text: OWNER_SEES[s] })))))),
    el("p", {}, "Questions? Email ", el("a", { href: "mailto:staff@nysvms.org", text: "staff@nysvms.org" }), "."));
}
const OWNER_SEES = { "Awaiting assignment": "Awaiting assignment", "Facilitator assigned": "Facilitator assigned", "Mediation in progress": "Mediation in progress",
  "Waiting on the veterinarian": "Waiting on the veterinarian", "Waiting on the owner": "Waiting for your reply", "Completed": "Completed", "Closed without resolution": "Closed without resolution" };

// ---- feedback (design/redesign 09) ----
async function feedback(id) {
  const c = await api(`/api/complaint?id=${encodeURIComponent(id)}`);
  if (!c.can_feedback) { location.hash = `#/c/${id}`; return; }
  const val = { overall: 0, facilitator: 0, admin: 0, value: 0 };
  const scale = (k, n, legend, lo, hi) => el("fieldset", { class: "fs" }, el("legend", { text: `${n}. ${legend}` }),
    el("div", { class: "seg", role: "radiogroup" }, [1, 2, 3, 4, 5].map((i) => el("label", {}, (() => { const r = el("input", { type: "radio", name: "fb-" + k, value: String(i) }); r.addEventListener("change", () => (val[k] = i)); return r; })(), String(i)))),
    el("div", { class: "row sm muted between", style: "max-width:356px" }, el("span", { text: lo }), el("span", { text: hi })));
  const comments = el("textarea", { id: "fb-c", class: "textarea" });
  const msg = el("div");
  const btn = el("button", { class: "btn lg", type: "submit", text: "Send feedback" });
  const form = el("form", { class: "card stack", style: "gap:28px;padding:36px", novalidate: true },
    scale("overall", 1, "Overall, how satisfied were you with the NYSVMS mediation process?", "Not satisfied", "Very satisfied"), el("hr", { class: "divider" }),
    scale("facilitator", 2, "How satisfied were you with the support from your facilitator?", "Not satisfied", "Very satisfied"), el("hr", { class: "divider" }),
    scale("admin", 3, "How satisfied were you with the support from the NYSVMS staff?", "Not satisfied", "Very satisfied"), el("hr", { class: "divider" }),
    scale("value", 4, "How valuable was this service to you?", "Not valuable", "Very valuable"), el("hr", { class: "divider" }),
    el("div", { class: "field" }, el("label", { for: "fb-c" }, "Anything that would help us improve the process?", el("span", { class: "opt", text: " (optional)" })), comments),
    msg, el("div", { class: "row g12" }, btn, el("a", { class: "btnq", href: `#/c/${c.id}`, text: "Not now" })));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); msg.replaceChildren();
    if (!val.overall) { msg.append(el("div", { class: "alert a-attn", role: "alert" }, ico("alert"), el("span", { text: "Choose a rating for question 1, the overall process." }))); return; }
    btn.disabled = true;
    try { await post("/api/complaint/feedback", { id: c.id, ...Object.fromEntries(Object.entries(val).map(([k, v]) => [k, v || null])), comments: comments.value }); toast("Feedback sent. Thank you."); location.hash = `#/c/${c.id}`; }
    catch (err) { msg.append(el("div", { class: "alert a-attn" }, ico("alert"), el("span", { text: err.message }))); btn.disabled = false; }
  });
  showRd({},
    el("div", { style: "max-width:860px" },
      el("nav", { "aria-label": "Breadcrumb", class: "sm", style: "margin-bottom:16px" }, el("a", { href: "#/", text: "My requests" }), el("span", { class: "muted", text: " / " }), el("a", { href: `#/c/${c.id}`, text: `Request #${c.n}` }), el("span", { class: "muted", text: " / Feedback" })),
      el("div", { class: "stack g12", style: "margin-bottom:32px" }, el("p", { class: "eyebrow", text: `Request #${c.n} · ${c.subject || ""}` }), el("h1", { class: "t1", text: "How did we do?" }),
        el("p", { class: "muted", text: "Four quick ratings and an optional comment. About a minute." })),
      form));
}

// ---- View as ----
function viewBar() {
  let bar = $("viewbar");
  if (!me || !me.viewing) { if (bar) bar.remove(); return; }
  if (!bar) { bar = el("div", { id: "viewbar", class: "viewbar" }); document.body.prepend(bar); }
  const until = new Date(me.viewing.until).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  bar.replaceChildren(el("div", { class: "in viewbar-in" },
    el("span", {}, el("strong", { text: `Viewing as ${me.viewing.name}.` }), ` Changes are switched off. Ends at ${until}.`),
    el("button", { type: "button", class: "btn-small", text: "Stop viewing", onclick: stopViewing })));
}
async function startViewing(p) {
  try { await post("/api/view-as", { id: p.id }); me = await api("/api/auth/session"); location.hash = "#/"; route(); }
  catch (err) { toast(err.message, true); }
}
async function stopViewing() {
  await post("/api/view-as/stop").catch(() => {});
  me = await api("/api/auth/session").catch(() => null);
  location.hash = "#/admin"; route();
}

// ---- start ----
(async () => {
  try { me = await fetch("/api/auth/session", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)); } catch { me = null; }
  route();
})();
