// Mediation portal app v04 (2026-11-06). v04: pet owner pages redesigned (06-09, 28) with the Activity list; updates record a Type and With.
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
const CLOSED = ["Completed", "Withdrawn"];
function statusChip(s) {
  const k = s === "Completed" ? "ok" : s === "Awaiting assignment" ? "bad" : s === "Withdrawn" ? "neutral" : String(s).startsWith("Mediator waiting") ? "warn" : "info";
  return el("span", { class: "chip " + k, text: s });
}
const STEPS = ["Received", "Facilitator assigned", "Mediation in progress", "Completed"];
const stepIndex = (s) => (CLOSED.includes(s) ? 3 : s === "Awaiting assignment" ? 0 : s === "Mediation in progress" || String(s).startsWith("Mediator waiting") ? 2 : 1);

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
  if (me.staff) t.push(["#/", "All requests"], ["#/facilitators", "Facilitators"], ["#/letters", "Letter templates"]);
  else if (me.viewing && !me.facilitator && !me.owner) t.push(["#/", "Home"]);
  else if (me.facilitator) t.push(["#/", "My assignments"], ["#/guide", "Facilitator guide"]);
  else t.push(["#/", "My requests"], ["#/about", "How mediation works"]);
  if (me.real && me.real.staff && !me.viewing) t.push(["#/admin", "Admin"]);
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
  main.className = "rd rd-wrap" + (opts.narrow ? " rd-narrow" : "");
  main.parentElement.classList.toggle("rd-soft", !!opts.soft);
  main.replaceChildren();
  for (const k of kids.flat(Infinity)) if (k) main.append(k);
  if (!opts.keep) window.scrollTo(0, 0);
}
const ICO = {
  right: ["M5 12h14", "M12 5l7 7-7 7"], left: ["M19 12H5", "M12 19l-7-7 7-7"], check: ["M20 6 9 17l-5-5"],
  clock: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 6v6l4 2"], info: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 16v-4", "M12 8h.01"],
  ext: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  clip: ["m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"],
  alert: ["M12 3 2 21h20L12 3z", "M12 10v4", "M12 17h.01"]
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
  const fit = (pill, kind, title, text, link) => el("div", { class: "card stack g12" + (kind === "p-ok" ? " fit" : "") },
    el("span", { class: "pill " + kind, text: pill }), el("h3", { class: "t3", text: title }), el("p", { class: "sm muted", text }), link);
  showRd({},
    el("div", { class: "cols", style: "gap:48px;align-items:center;margin-bottom:56px" },
      el("div", { class: "colmain", style: "gap:20px" },
        el("p", { class: "eyebrow", text: "Mediation for pet owners" }),
        el("h1", { class: "t1 hero", text: "Help understanding the care your animal received" }),
        el("p", { style: "max-width:680px", text: "NYSVMS volunteer veterinarians help pet owners understand the treatment provided by a veterinarian who is a member of the Society, and help communicate your concerns to them." }),
        el("div", { class: "row g12", style: "margin-top:8px" },
          el("a", { class: "btn lg", href: "#/file" }, "Start a request", ico("right")),
          el("a", { class: "btn2 lg", href: "#/signin", text: "Check on a request" })),
        el("div", { class: "row g24 sm muted", style: "margin-top:4px" },
          el("span", { class: "row g8" }, ico("clock"), "About 10 minutes to fill in"),
          el("span", { class: "row g8" }, ico("check"), "A volunteer is usually assigned within two weeks"))),
      el("aside", { class: "colside navy stack g12", style: "flex:1 1 340px" },
        el("h2", { class: "t3", style: "font-size:20px", text: "Please know before you start" }),
        el("p", { text: "We have no connection to the State licensing board and cannot impose penalties or remove licenses." }),
        el("p", { text: "We can only help when the veterinarian is a member of NYSVMS." }))),
    el("section", { style: "margin-bottom:56px", "aria-labelledby": "how" },
      el("h2", { id: "how", class: "t2", style: "margin-bottom:24px", text: "How it works" }),
      el("ol", { class: "grid3" },
        [["Tell us what happened", "Answer a few questions about the visit and your veterinarian. You can attach records and photos."],
         ["A volunteer is assigned", "A volunteer veterinarian, your facilitator, is usually assigned within two weeks and contacts you directly by email or phone."],
         ["They talk with your vet", "Your facilitator helps you understand the care and shares your concerns with the veterinarian. You can sign in any time to see where things stand."]]
          .map(([t, d], i) => el("li", { class: "card stack g12" }, el("span", { class: "kpi", "aria-hidden": "true", text: String(i + 1) }), el("h3", { class: "t3", text: t }), el("p", { class: "sm muted", text: d }))))),
    el("section", { "aria-labelledby": "fit" },
      el("h2", { id: "fit", class: "t2", style: "margin-bottom:8px", text: "Is mediation right for you?" }),
      el("p", { class: "muted", style: "margin-bottom:24px", text: "If your concern is about fees or discipline, another organization can help you faster." }),
      el("div", { class: "grid3" },
        fit("We can help", "p-ok", "Questions about care", "Questions about the diagnosis, treatment or communication you received from an NYSVMS member veterinarian.", el("a", { class: "sm strong", href: "#/file", text: "Start a request" })),
        fit("Not something we review", "p-mute", "Fees and billing", "We can't review what a practice charges. For a dispute about fees, contact a consumer protection organization.", extLink(HELP.fees)),
        fit("Not something we review", "p-mute", "Discipline or license action", "For fines or license action, contact the NY State Office of the Professions, Office of Professional Discipline.", extLink(HELP.opd)))));
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
  const yesNo = (key, legend, choices, help) => {
    const name = "q-" + key;
    return el("fieldset", { class: "fs" }, el("legend", { text: legend }),
      el("div", { class: "seg", role: "radiogroup" }, choices.map(([v, l]) => el("label", {}, (() => { const r = el("input", { type: "radio", name, value: v }); r.checked = req[key] === v; r.addEventListener("change", () => { req[key] = v; fileForm(true); }); return r; })(), l))),
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
    body = [yesNo("legal", "Have you taken any legal action about this?", [["yes", "Yes"], ["no", "No"]]), el("hr", { class: "divider" }),
      yesNo("opd", "Have you complained to the NYS Office of Professional Discipline?", [["yes", "Yes"], ["no", "No"]]), el("hr", { class: "divider" }),
      yesNo("fees", "Is your concern about fees or the cost of services?", [["yes", "Yes"], ["no", "No"]], el("p", { class: "help", text: "If it is, a consumer protection organization can help. We can't review what a practice charges." })), el("hr", { class: "divider" }),
      yesNo("member", "Is the veterinarian a member of NYSVMS?", [["yes", "Yes"], ["no", "No"], ["unsure", "I'm not sure"]], el("p", { class: "help", text: req.member === "unsure" ? "That's fine. Carry on and our staff will check before a facilitator is assigned." : "Not sure? Ask the practice, or choose I'm not sure and our staff will check." })),
      referral(), el("hr", { class: "divider" }),
      el("div", { class: "stack g12" },
        check("service", el("span", { class: "stack g4" }, el("span", { text: "I have read how this service works." }), el("details", { class: "terms" }, el("summary", { text: "How this service works" }), el("div", {}, SERVICE_TEXT.map((t) => el("p", { text: t })))))),
        check("terms", el("span", { class: "stack g4" }, el("span", { text: "I have read and accept the terms, including the indemnity." }), el("details", { class: "terms" }, el("summary", { text: "Read the terms" }), el("div", {}, TERMS_TEXT.map((t) => el("p", { text: t })))))))];
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
  const navDesktop = el("div", { class: "row g12 between formnav", style: "margin-top:8px" }, el("button", { class: "btnq", type: "button", onclick: () => go(-1) }, ico("left"), backLabel), mkNext("btn lg", nextLabel));
  const navPhone = el("div", { class: "stickybar" }, el("button", { class: "btn2", type: "button", text: "Back", onclick: () => go(-1) }), mkNext("btn", s < 3 ? "Continue" : "Submit request"));
  showRd({ keep },
    el("div", { class: "cols", style: "gap:48px" },
      el("div", { class: "colmain", style: "gap:28px;flex-basis:640px" },
        el("div", { class: "stack g12" }, el("p", { class: "eyebrow", text: `Request mediation · Step ${s + 1} of 4` }), el("h1", { class: "t1", text: title }), el("p", { class: "muted", text: intro })),
        steps,
        el("form", { class: "stack g24", novalidate: true, onsubmit: (e) => { e.preventDefault(); go(1); } }, body, msg, navDesktop)),
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
let filter = "open";
async function home() {
  const { mine, work } = await api("/api/complaints");
  if (!me.staff && !me.facilitator) return ownerHome(mine);
  const parts = [];
  if (me.viewing && !me.viewing.can_sign_in) parts.push(el("div", { class: "note", text: `${me.name} can't sign in to the portal: they aren't an active facilitator or staff member, and they don't own a request. If they tried, they would only see the public pages.` }));
  if (me.staff || me.facilitator) {
    const open = work.filter((c) => !CLOSED.includes(c.status));
    parts.push(el("p", { class: "eyebrow", text: me.staff ? "Staff" : "Facilitator" }), el("h1", { text: me.staff ? "All requests" : "My assignments" }));
    parts.push(me.staff
      ? el("div", { class: "cards" },
          card(work.filter((c) => c.status === "Awaiting assignment").length, "Need a facilitator", true),
          card(open.length, "Open"), card(open.filter((c) => daysSince(c.last_activity) > 90).length, "No activity in 90+ days"),
          card(work.filter((c) => String(c.received).startsWith(String(new Date().getFullYear()))).length, `Filed in ${new Date().getFullYear()}`))
      : el("div", { class: "cards" }, card(open.length, "Open", true), card(open.filter((c) => c.status.startsWith("Mediator waiting")).length, "Waiting on a reply"), card(work.length - open.length, "Completed")));
    const FILTERS = [["open", "Open"], ["attention", "Needs attention"], ["all", "All"]];
    const list = el("div");
    const draw = () => {
      const rows = work.filter((c) => filter === "all" || (filter === "open" ? !CLOSED.includes(c.status) : !CLOSED.includes(c.status) && (c.status === "Awaiting assignment" || daysSince(c.last_activity) > 90)));
      list.replaceChildren(rows.length ? table(rows, me.staff) : el("p", { class: "muted", text: "Nothing here." }));
      bar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === filter)));
    };
    const bar = el("div", { class: "filters" }, FILTERS.map(([k, l]) => el("button", { type: "button", class: "fchip", "data-f": k, text: l, onclick: () => { filter = k; draw(); } })));
    parts.push(bar, list);
    draw();
  }
  if (mine.length) {
    parts.push(el("p", { class: "eyebrow", style: me.staff || me.facilitator ? "margin-top:40px" : "", text: "My requests" }));
    if (!me.staff && !me.facilitator) parts.push(el("h1", { text: `Welcome back, ${String(me.name).split(" ")[0]}` }), el("p", { class: "lede", text: "Here is where each of your mediation requests stands. Your facilitator will contact you directly by email or phone." }));
    for (const c of mine) parts.push(el("div", { class: "panel" },
      el("div", { class: "row between" }, el("h2", { style: "margin:0" }, el("a", { href: `#/c/${c.id}`, text: `#${c.n} · ${c.subject || "Mediation request"}` })), statusChip(c.status)),
      el("p", { class: "muted small", text: `About ${c.vet_name}${c.practice ? ", " + c.practice : ""} · received ${fmtDate(c.received)}` }),
      steps(c.status), c.facilitator ? el("p", { class: "small" }, "Your facilitator: ", el("strong", { text: c.facilitator })) : null));
  }
  show(parts);
}
const card = (n, label, attn) => el("div", { class: "card" + (attn ? " attn" : "") }, el("div", { class: "big", text: String(n) }), el("div", { class: "lbl", text: label }));
const steps = (s) => el("ol", { class: "steps" }, STEPS.map((t, i) => el("li", { class: i < stepIndex(s) ? "done" : i === stepIndex(s) ? "now" : "", text: t })));
function table(rows, staff) {
  return el("div", { class: "tbl-wrap" }, el("table", {},
    el("thead", {}, el("tr", {}, ["#", "Request", staff ? "Facilitator" : null, "Status", "Last activity"].filter(Boolean).map((h) => el("th", { text: h })))),
    el("tbody", {}, rows.map((c) => {
      const d = daysSince(c.last_activity), open = !CLOSED.includes(c.status);
      return el("tr", {}, el("td", { class: "num", text: String(c.n) }),
        el("td", {}, el("a", { class: "open", href: `#/c/${c.id}`, text: c.subject || "(no summary)" }), el("div", { class: "small muted", text: [c.vet_name, c.owner].filter(Boolean).join(" · ") })),
        staff ? el("td", {}, c.facilitator ? c.facilitator : el("span", { class: "stale", text: "Not assigned" })) : null,
        el("td", {}, statusChip(c.status)),
        el("td", {}, fmtDate(c.last_activity), open && d > 90 ? el("div", { class: "stale", text: `${d} days ago` }) : null));
    }))));
}

// ---- one complaint ----
const fileLink = (cid, f, uid) => el("a", { class: "file", href: `/api/file?c=${cid}${uid ? `&u=${uid}` : ""}&a=${f.id}`, target: "_blank", rel: "noopener", text: f.filename });

async function complaint(id) {
  const c = await api(`/api/complaint?id=${encodeURIComponent(id)}`);
  if (c.view === "owner") return ownerView(c);
  const back = el("a", { class: "btn-small", href: "#/", text: "← Back" });
  // Progress
  const note = el("textarea", { id: "nt", placeholder: "What happened, who you spoke to, what's next" });
  const ntType = el("select", { id: "nt-type" }, [["Call", "Phone call"], ["Email", "Email"], ["Note", "Note to file (not shown to the owner)"]].map(([v, l]) => el("option", { value: v, text: l })));
  const ntWith = el("select", { id: "nt-with" }, [["Owner", "The owner"], ["Veterinarian", "The veterinarian"], ["Other", "Someone else"]].map(([v, l]) => el("option", { value: v, text: l })));
  const withWrap = el("div", {}, el("label", { for: "nt-with", text: "With" }), ntWith);
  ntType.addEventListener("change", () => (withWrap.hidden = ntType.value === "Note"));
  const doc = el("input", { id: "nt-f", type: "file" });
  const noteForm = el("div", { hidden: true, style: "margin-top:12px" }, el("label", { for: "nt-type", text: "Type" }), ntType, withWrap,
    el("p", { class: "hint", text: "Calls and emails with the owner or vet show on the owner's Activity list as one line, for example \"Your facilitator called Dr. Greer\". Your notes are never shown to the owner." }),
    el("label", { for: "nt", text: "Update" }), note, el("label", { for: "nt-f", text: "Attach a document (optional, up to 4 MB)" }), doc,
    el("div", { class: "row", style: "margin-top:12px" }, el("button", { class: "btn", type: "button", text: "Save update", onclick: async (e) => {
      e.target.disabled = true;
      try {
        const out = await post("/api/complaint/update", { id: c.id, notes: note.value, type: ntType.value, with: ntType.value === "Note" ? undefined : ntWith.value });
        const failed = doc.files.length ? await uploadFiles([...doc.files], { complaint: c.id, field: "update", update: out.update }) : [];
        toast(failed.length ? `Update saved, but ${failed.join(", ")} didn't upload` : "Update saved", failed.length > 0); route();
      } catch (err) { toast(err.message, true); e.target.disabled = false; }
    } })));
  const progress = el("div", { class: "panel" },
    el("div", { class: "row between" }, el("h2", { style: "margin:0", text: "Progress" }),
      el("div", { class: "row" }, el("a", { class: "btn-small", href: `#/c/${c.id}/letter`, text: "Draft a letter" }), el("button", { class: "btn-small", type: "button", text: "Add an update", onclick: () => { noteForm.hidden = !noteForm.hidden; note.focus(); } }))),
    noteForm,
    c.updates.length ? el("ol", { class: "timeline" }, c.updates.map((u) => el("li", {},
      el("div", { class: "when", text: `${fmtDate(u.date)}${u.author ? " · " + u.author : ""}` }),
      u.letter_type ? el("div", { class: "letter", text: `Letter: ${u.letter_type}` }) : null,
      u.notes ? el("div", { class: "notes", text: u.notes }) : null,
      u.letter_text ? el("details", { class: "letter-text" }, el("summary", { text: "Show the letter" }), el("pre", { text: u.letter_text })) : null,
      u.documents.length ? el("div", { class: "files" }, u.documents.map((f) => fileLink(c.id, f, u.id))) : null)))
      : el("p", { class: "muted", style: "margin-top:12px", text: "No updates yet." }));
  // Side panels
  const people = el("div", { class: "panel" }, el("h2", { text: "People" }), el("dl", { class: "facts" },
    el("dt", { text: "Owner" }), el("dd", {}, c.owner ? [c.owner.name, el("br"), el("span", { class: "small muted", text: [c.owner.email, c.owner.phone].filter(Boolean).join(" · ") }), c.owner.address ? [el("br"), el("span", { class: "small muted", text: c.owner.address })] : null] : "—"),
    el("dt", { text: "Vet" }), el("dd", {}, c.vet_name || "—", el("br"), el("span", { class: "small muted", text: [c.practice, c.practice_address].filter(Boolean).join(", ") }), el("br"),
      c.vet_email ? el("span", { class: "small muted", text: c.vet_email }) : el("span", { class: "small stale", text: "No email on file" })),
    el("dt", { text: "Facilitator" }), el("dd", { text: c.facilitator ? `${c.facilitator.name}${c.facilitator.region ? " · " + c.facilitator.region : ""}` : "Not assigned" })));
  const status = el("select", { id: "st" }, c.statuses.map((s) => el("option", { value: s, text: s, selected: s === c.status })));
  const statusPanel = el("div", { class: "panel" }, el("h2", { text: c.can_assign ? "Assign and update" : "Status" }));
  if (c.can_assign) {
    const facs = await api("/api/facilitators");
    const pick = el("select", { id: "as-f" }, el("option", { value: "", text: "Choose a facilitator…" }),
      facs.filter((f) => f.active).map((f) => el("option", { value: f.id, text: `${f.name}${f.region ? " · " + f.region : ""} (${f.open} open)`, selected: c.facilitator && c.facilitator.id === f.id })));
    statusPanel.append(el("label", { for: "as-f", text: "Facilitator" }), pick,
      el("div", { class: "row", style: "margin-top:10px" }, el("button", { class: "btn-small", type: "button", text: "Assign", onclick: async () => {
        if (!pick.value) return toast("Choose a facilitator first", true);
        try { await post("/api/complaint/assign", { id: c.id, facilitator: pick.value }); toast("Assigned. The facilitator has been emailed."); route(); } catch (err) { toast(err.message, true); }
      } })), el("p", { class: "hint", text: "Assigning emails the facilitator." }));
  }
  statusPanel.append(el("label", { for: "st", text: "Status" }), status,
    el("div", { class: "row", style: "margin-top:10px" }, el("button", { class: "btn-small", type: "button", text: "Save status", onclick: async () => {
      try { await post("/api/complaint/status", { id: c.id, status: status.value }); toast("Status saved"); route(); } catch (err) { toast(err.message, true); }
    } })));
  const res = el("input", { id: "res", type: "text", value: c.resolution });
  const resNotes = el("textarea", { id: "res-n" }); resNotes.value = c.resolution_notes;
  const resPanel = el("div", { class: "panel" }, el("h2", { text: "Resolution" }), el("label", { for: "res", text: "Resolution (the owner sees this once the request is Completed)" }), res,
    el("label", { for: "res-n", text: "Notes for staff" }), resNotes,
    el("div", { class: "row", style: "margin-top:10px" }, el("button", { class: "btn-small", type: "button", text: "Save resolution", onclick: async () => {
      try { await post("/api/complaint/resolution", { id: c.id, resolution: res.value, resolution_notes: resNotes.value }); toast("Resolution saved"); } catch (err) { toast(err.message, true); }
    } })));
  const fb = c.feedback ? el("div", { class: "panel" }, el("h2", { text: "Owner feedback" }), el("dl", { class: "facts" },
    [["Overall", c.feedback.overall], ["Facilitator", c.feedback.facilitator], ["Admin team", c.feedback.admin], ["Member value", c.feedback.value]].filter(([, v]) => v).map(([k, v]) => [el("dt", { text: k }), el("dd", { text: "★".repeat(v) + ` ${v} of 5` })])),
    c.feedback.comments ? el("p", { class: "story", text: c.feedback.comments }) : null) : null;
  const A = c.attestations;
  show(back, el("p", { class: "eyebrow", style: "margin-top:14px", text: `Request #${c.n} · received ${fmtDate(c.received)}` }), el("h1", { text: c.subject || "Mediation request" }),
    el("div", { class: "row", style: "margin-bottom:18px" }, statusChip(c.status), el("span", { class: "muted small", text: `Facilitator: ${c.facilitator ? c.facilitator.name : "not assigned"}` })),
    el("div", { class: "grid2" },
      el("div", {},
        el("div", { class: "panel" }, el("h2", { text: "What the owner told us" }), el("p", { class: "story", text: c.description || "—" }),
          (c.uploads.length || c.release.length) ? el("div", { class: "files" }, c.uploads.map((f) => fileLink(c.id, f)), c.release.map((f) => fileLink(c.id, f))) : null,
          el("p", { class: "hint", text: `${c.records_ok ? "The owner gave permission to share records." : "The owner did not give permission to share records."}${Object.values(A).every(Boolean) ? "" : " Some 'before you start' statements were not confirmed."}` })),
        progress),
      el("div", {}, people, statusPanel, resPanel, fb)));
}

// ---- pet owner pages (design/redesign 06-09, 28) ----
const OWNER_PILL = { "Awaiting assignment": "p-attn", "Facilitator assigned": "p-info", "Mediation in progress": "p-info", "Waiting on the veterinarian": "p-wait", "Waiting for your reply": "p-wait", "Completed": "p-ok", "Withdrawn": "p-mute" };
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
    case "Withdrawn": return "This request was closed without a resolution. If something has changed, you can start a new request.";
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
        el("p", {}, el("span", { class: "strong", text: "What's happening: " }), whatsHappening({ ...c, facilitator: c.facilitator?.name || "" }), c.status !== "Withdrawn" ? " When the request is completed you'll see the resolution here." : "")),
      activity, told];
  }
  showRd({}, crumb, head, el("div", { class: "cols" }, el("div", { class: "colmain" }, mainCol), el("aside", { class: "colside" }, facCard, help)));
}

// ---- letters ----
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
  const pick = el("select", { id: "lt" }, templates.map((t, i) => el("option", { value: String(i), text: t.type })));
  const to = el("input", { id: "lt-to", type: "text" }), subj = el("input", { id: "lt-sub", type: "text" }), body = el("textarea", { id: "lt-body", class: "letter" });
  const left = el("p", { class: "hint" });
  const load = () => {
    const t = templates[Number(pick.value)];
    to.value = t.recipient === "Owner" ? `${c.owner?.name || ""} <${c.owner?.email || ""}>` : c.vet_email ? `${c.vet_name} <${c.vet_email}>` : `${c.vet_name} (no email on file)`;
    subj.value = fill(t.subject, t); body.value = fill(t.body, t);
    const missing = [...new Set((subj.value + body.value).match(/\{\w+\}/g) || [])];
    left.textContent = missing.length ? `Still to fill in: ${missing.join(", ")}` : "";
  };
  pick.addEventListener("change", load);
  load();
  const copy = async () => {
    const txt = `Subject: ${subj.value}\n\n${body.value}`;
    try { await navigator.clipboard.writeText(txt); toast("Letter copied. Paste it into your email."); } catch { body.select(); toast("Press Ctrl+C to copy the selected letter"); }
  };
  const save = async (e) => {
    e.target.disabled = true;
    try { await post("/api/complaint/update", { id: c.id, notes: `Letter drafted to ${to.value}: ${subj.value}`, letter_type: templates[Number(pick.value)].type, with: templates[Number(pick.value)].recipient === "Owner" ? "Owner" : "Veterinarian", letter_text: `Subject: ${subj.value}\n\n${body.value}` }); toast("Saved to progress"); location.hash = `#/c/${c.id}`; }
    catch (err) { toast(err.message, true); e.target.disabled = false; }
  };
  show(el("a", { class: "btn-small", href: `#/c/${c.id}`, text: `← Back to #${c.n}` }),
    el("p", { class: "eyebrow", style: "margin-top:14px", text: `Request #${c.n}` }), el("h1", { text: "Draft a letter" }),
    el("p", { class: "lede", text: "Pick a letter. The request's details are filled in for you. Edit it, then copy it into your own email. Anything still in {braces} needs your attention before sending." }),
    el("div", { class: "grid2" },
      el("div", { class: "panel" }, el("label", { for: "lt", style: "margin-top:0", text: "Letter" }), pick, el("label", { for: "lt-to", text: "To" }), to,
        el("label", { for: "lt-sub", text: "Subject" }), subj, el("label", { for: "lt-body", text: "Letter" }), body, left,
        el("div", { class: "row", style: "margin-top:14px" }, el("button", { class: "btn", type: "button", text: "Copy letter", onclick: copy }), el("button", { class: "btn-outline", type: "button", text: "Save to progress", onclick: save }))),
      el("div", { class: "note", text: "The portal never sends these letters. You review and send each one from your own email, so you stay the person the owner and veterinarian hear from. Files can't be linked for the vet, so attach them to your email." })));
}

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

// ---- staff pages ----
async function facilitatorList() {
  const facs = await api("/api/facilitators");
  show(el("p", { class: "eyebrow", text: "Staff" }), el("h1", { text: "Facilitators" }),
    el("p", { class: "lede", text: `Volunteer veterinarians who mediate requests. ${facs.filter((f) => f.active).length} are active. To add someone or change their region, edit the People table in Airtable (Roles: Facilitator, Active ticked).` }),
    el("div", { class: "tbl-wrap" }, el("table", {}, el("thead", {}, el("tr", {}, ["Name", "Region", "Open", "All time", "Status"].map((h) => el("th", { text: h })))),
      el("tbody", {}, facs.map((f) => el("tr", {}, el("td", {}, f.name, el("div", { class: "small muted", text: f.email })), el("td", { text: f.region || "—" }),
        el("td", { class: "num", text: String(f.open) }), el("td", { class: "num", text: String(f.total) }), el("td", {}, el("span", { class: "chip " + (f.active ? "ok" : "neutral"), text: f.active ? "Active" : "Inactive" }))))))));
}
async function letterList() {
  const t = await api("/api/templates");
  show(el("p", { class: "eyebrow", text: "Staff" }), el("h1", { text: "Letter templates" }),
    el("p", { class: "lede", text: "The letters facilitators can draft. Words in {braces} are filled in from the request. To change the wording, edit the Letter Templates table in Airtable; changes show here within a minute." }),
    el("div", { class: "stack" }, t.map((x) => el("div", { class: "panel" }, el("div", { class: "row between" }, el("h3", { text: x.type }), el("span", { class: "chip neutral", text: x.recipient === "Owner" ? "To owner" : "To veterinarian" })),
      el("p", { class: "small muted", style: "margin:6px 0 0", text: `Subject: ${x.subject}` }), el("details", { class: "letter-text" }, el("summary", { text: "Show the letter" }), el("pre", { text: x.body }))))));
}
function guide() {
  show(el("p", { class: "eyebrow", text: "Facilitator guide" }), el("h1", { text: "How mediation works" }),
    el("ol", { class: "lede", style: "padding-left:20px" },
      el("li", { text: "Staff ask you to take a mediation request. You get an email and it appears under My assignments." }),
      el("li", { text: "Introduce yourself to the owner, then to the veterinarian, using Draft a letter." }),
      el("li", { text: "Log each call or email as an update so staff can see where things stand, and keep the status current." }),
      el("li", { text: "When it's resolved, record the resolution, set the status to Completed and send the two resolution letters. The owner's letter includes a feedback link." })),
    el("p", {}, "Questions? Email ", el("a", { href: "mailto:staff@nysvms.org", text: "staff@nysvms.org" }), "."));
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

// ---- Admin (staff) ----
let adminFilter = "everyone", adminQuery = "";
async function admin() {
  if (!me.real || !me.real.staff || me.viewing) { location.hash = "#/"; return; }
  const { people, regions } = await api("/api/admin/people");
  const FILTERS = [["everyone", "Everyone"], ["staff", "Staff"], ["facilitator", "Facilitators"], ["owner", "Pet owners"], ["inactive", "Inactive"]];
  const count = (k) => people.filter((p) => match(p, k)).length;
  const match = (p, k) => k === "everyone" || (k === "inactive" ? !p.active && (p.staff || p.facilitator) : p[k]);
  const search = el("input", { id: "adm-q", type: "text", placeholder: "Search by name or email", value: adminQuery });
  const list = el("div");
  const bar = el("div", { class: "filters" }, FILTERS.map(([k, l]) => el("button", { type: "button", class: "fchip", "data-f": k, text: `${l} (${count(k)})`, onclick: () => { adminFilter = k; draw(); } })));
  const draw = () => {
    const q = adminQuery.trim().toLowerCase();
    const rows = people.filter((p) => match(p, adminFilter) && (!q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)));
    bar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === adminFilter)));
    list.replaceChildren(rows.length ? el("div", { class: "tbl-wrap" }, el("table", {},
      el("thead", {}, el("tr", {}, ["Name", "Roles", "Region", "Requests", ""].map((h) => el("th", { text: h })))),
      el("tbody", {}, rows.slice(0, 300).map((p) => personRow(p, regions))))) : el("p", { class: "muted", text: "Nobody matches." }));
  };
  search.addEventListener("input", () => { adminQuery = search.value; draw(); });
  show(el("p", { class: "eyebrow", text: "Staff" }), el("h1", { text: "Admin" }),
    el("p", { class: "lede", text: "Everyone in the portal and what they can do. Pet owner is not a setting: it means the person owns at least one mediation request. Every change and every View as is recorded in the Admin Log table in Airtable." }),
    el("div", { class: "row", style: "margin-bottom:12px" }, el("div", { style: "flex:1 1 280px" }, search), el("button", { class: "btn-outline", type: "button", text: "Add a person", onclick: () => editPerson(null, regions) })),
    bar, list);
  draw();
}
function roleChips(p) {
  return [p.staff && el("span", { class: "chip info", text: "Staff" }), p.facilitator && el("span", { class: "chip ok", text: "Facilitator" }),
    p.owner && el("span", { class: "chip neutral", text: "Pet owner" }), !p.active && (p.staff || p.facilitator) && el("span", { class: "chip bad", text: "Inactive" })].filter(Boolean);
}
function personRow(p, regions) {
  return el("tr", {},
    el("td", {}, el("strong", { text: p.name || "(no name)" }), el("div", { class: "small muted", text: p.email })),
    el("td", {}, el("div", { class: "row", style: "gap:6px" }, roleChips(p))),
    el("td", { text: p.region || "—" }),
    el("td", { class: "num", text: p.total ? `${p.open} open · ${p.total}` : "—" }),
    el("td", {}, el("div", { class: "row", style: "gap:6px;flex-wrap:nowrap" },
      el("button", { class: "btn-small", type: "button", text: "Edit", onclick: () => editPerson(p, regions) }),
      p.email.toLowerCase() !== me.email ? el("button", { class: "btn-small", type: "button", text: "View as", onclick: () => startViewing(p) }) : null)));
}
function editPerson(p, regions) {
  const isNew = !p;
  p = p || { name: "", email: "", staff: false, facilitator: true, active: true, region: "" };
  const name = el("input", { id: "ed-name", type: "text", value: p.name });
  const email = el("input", { id: "ed-email", type: "email", value: p.email, disabled: !isNew });
  const box = (id, label, on) => el("div", { class: "check" }, el("input", { type: "checkbox", id, checked: on }), el("label", { for: id, text: label }));
  const region = el("select", { id: "ed-region" }, el("option", { value: "", text: "No region" }), regions.map((r) => el("option", { value: r, text: r, selected: r === p.region })));
  const msg = el("div");
  const save = async () => {
    msg.replaceChildren();
    try {
      await post("/api/admin/person", { id: isNew ? undefined : p.id, name: name.value, email: email.value, staff: $("ed-staff").checked, facilitator: $("ed-fac").checked, active: $("ed-active").checked, region: region.value });
      toast(isNew ? "Person added" : "Saved"); route();
    } catch (err) { msg.append(el("div", { class: "err", text: err.message })); }
  };
  show(el("a", { class: "btn-small", href: "#/admin", text: "← Admin", onclick: (e) => { e.preventDefault(); route(); } }),
    el("p", { class: "eyebrow", style: "margin-top:14px", text: "Admin" }), el("h1", { text: isNew ? "Add a person" : p.name || p.email }),
    el("div", { class: "panel", style: "max-width:560px" },
      el("label", { for: "ed-name", text: "Name" }), name,
      el("label", { for: "ed-email", text: "Email" }), email,
      isNew ? el("p", { class: "hint", text: "They sign in with this email." }) : el("p", { class: "hint", text: "Email can't be changed here because it is how they sign in." }),
      el("fieldset", { style: "margin-top:16px" }, el("legend", { text: "Roles" }),
        box("ed-staff", "Staff: sees every request, assigns facilitators, uses this Admin page", p.staff),
        box("ed-fac", "Facilitator: can be assigned requests and mediates them", p.facilitator),
        box("ed-active", "Active: needed for Staff and Facilitator access", p.active)),
      el("label", { for: "ed-region", text: "Region" }), region,
      p.owner ? el("p", { class: "hint", text: "This person also owns at least one request, so they can always sign in to see their own." }) : null,
      msg,
      el("div", { class: "row", style: "margin-top:16px" }, el("button", { class: "btn", type: "button", text: isNew ? "Add person" : "Save", onclick: save }),
        el("button", { class: "btn-outline", type: "button", text: "Cancel", onclick: () => route() }))));
}

// ---- start ----
(async () => {
  try { me = await fetch("/api/auth/session", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)); } catch { me = null; }
  route();
})();
