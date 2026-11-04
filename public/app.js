// Complaints portal app v01 (2026-11-04). Plain JS, hash routes:
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
const show = (...kids) => { main.replaceChildren(); for (const k of kids.flat(Infinity)) if (k) main.append(k); window.scrollTo(0, 0); };
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
  if (!me) return [["#/", "About"], ["#/file", "File a complaint"], ["#/signin", "Sign in"]];
  const t = [];
  if (me.staff) t.push(["#/", "All complaints"], ["#/facilitators", "Facilitators"], ["#/letters", "Letter templates"]);
  else if (me.facilitator) t.push(["#/", "My assignments"], ["#/guide", "Facilitator guide"]);
  else t.push(["#/", "My complaints"]);
  return t;
}
function renderHeader() {
  const who = $("who");
  who.replaceChildren();
  if (me) {
    const role = me.staff ? "Staff" : me.facilitator ? "Facilitator" : "Pet owner";
    who.append(el("span", { class: "pill", text: role }), el("span", { class: "name", text: me.name }),
      el("button", { class: "btn-on-dark", type: "button", text: "Sign out", onclick: async () => { await post("/api/auth/logout").catch(() => {}); me = null; location.hash = "#/"; renderHeader(); route(); } }));
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
    if (!me) return about();
    if (parts[0] === "c" && parts[2] === "letter") return letter(parts[1]);
    if (parts[0] === "c") return complaint(parts[1]);
    if (parts[0] === "feedback") return feedback(parts[1]);
    if (parts[0] === "facilitators") return facilitatorList();
    if (parts[0] === "letters") return letterList();
    if (parts[0] === "guide") return guide();
    return home();
  } catch (e) {
    if (e.message !== "Please sign in.") show(el("div", { class: "err", text: e.message }));
  }
}
window.addEventListener("hashchange", route);

// ---- public pages ----
function about() {
  show(
    el("p", { class: "eyebrow", text: "Consumer complaint service" }),
    el("h1", { text: "Help understanding the care your animal received" }),
    el("p", { class: "lede", text: "NYSVMS volunteer veterinarians help pet owners understand the treatment provided by a veterinarian who is a member of the Society, and help communicate your concerns to them. We have no connection to the State licensing board and cannot impose penalties or remove licenses." }),
    el("div", { class: "cards" },
      el("div", { class: "card" }, el("h3", { text: "We can help with" }), el("p", { class: "small muted", text: "Questions about the diagnosis, treatment or communication you received from an NYSVMS member veterinarian." })),
      el("div", { class: "card" }, el("h3", { text: "Fees and billing" }), el("p", { class: "small muted", text: "We can't review what a practice charges. For a dispute about fees, contact a consumer protection organization." })),
      el("div", { class: "card" }, el("h3", { text: "Discipline" }), el("p", { class: "small muted", text: "For fines or license action, contact the NY State Office of the Professions, Office of Professional Discipline." }))),
    el("div", { class: "row" }, el("a", { class: "btn", href: "#/file", text: "File a complaint" }), el("a", { class: "btn-outline", href: "#/signin", text: "Check on a complaint" })));
}

function signIn() {
  if (me) { location.hash = "#/"; return; }
  const email = el("input", { id: "si-email", type: "email", autocomplete: "email", required: true });
  const code = el("input", { id: "si-code", type: "text", inputmode: "numeric", autocomplete: "one-time-code", class: "code-box", maxlength: "7" });
  const codeWrap = el("div", { hidden: true }, el("label", { for: "si-code", text: "6-digit code" }), code, el("p", { class: "hint", text: "Codes expire after 10 minutes. Check your spam folder if it hasn't arrived." }));
  const msg = el("div");
  const btn = el("button", { class: "btn", type: "submit", text: "Email me a code" });
  const form = el("form", { class: "panel", style: "max-width:480px" }, el("label", { for: "si-email", text: "Email" }), email, codeWrap, msg, el("div", { class: "row", style: "margin-top:16px" }, btn));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); msg.replaceChildren(); btn.disabled = true;
    try {
      if (codeWrap.hidden) {
        await post("/api/auth/code-request", { email: email.value });
        codeWrap.hidden = false; btn.textContent = "Sign in"; code.focus();
        msg.append(el("p", { class: "note", text: "If that email is linked to a complaint or a facilitator account, a code is on its way." }));
      } else {
        await post("/api/auth/code-verify", { email: email.value, code: code.value });
        me = await api("/api/auth/session"); location.hash = "#/"; route();
      }
    } catch (err) { msg.append(el("div", { class: "err", text: err.message })); }
    btn.disabled = false;
  });
  show(el("p", { class: "eyebrow", text: "Sign in" }), el("h1", { text: "We'll email you a code" }),
    el("p", { class: "lede", text: "No password to remember. Enter the email you used when you filed your complaint, or the email NYSVMS has for you if you are a facilitator." }), form);
}

function fileForm() {
  const f = (id, label, type = "text", attrs = {}) => [el("label", { for: id, text: label }), el(type === "textarea" ? "textarea" : "input", { id, ...(type === "textarea" ? {} : { type }), ...attrs })];
  const ATT = [["a_legal", "I have not taken any legal action about this."], ["a_opd", "I have not complained to the NYS Office of Professional Discipline."],
    ["a_fees", "My complaint is not about fees or the cost of services."], ["a_member", "I have confirmed the veterinarian is a member of NYSVMS."],
    ["a_service", "I have read and understood how this service works (see About)."], ["a_terms", "I have read and accept the terms, including the indemnity."]];
  const msg = el("div");
  const btn = el("button", { class: "btn", type: "submit", text: "Submit complaint" });
  const form = el("form", { class: "grid2", novalidate: true },
    el("div", {},
      el("fieldset", {}, el("legend", { text: "Before you start" }), ATT.map(([k, t]) => el("div", { class: "check" }, el("input", { type: "checkbox", id: k }), el("label", { for: k, text: t })))),
      el("fieldset", {}, el("legend", { text: "The veterinarian" }), f("vet_name", "Veterinarian's name"), f("practice", "Practice name"), f("practice_address", "Practice address"),
        f("vet_email", "Veterinarian's email (if you have it)", "email"), el("p", { class: "hint", text: "Optional. It helps your facilitator reach them sooner." })),
      el("fieldset", {}, el("legend", { text: "Your complaint" }), f("subject", "In one sentence, what is your complaint about?"), f("description", "What happened", "textarea"),
        el("label", { for: "uploads", text: "Records, photos or other documents (optional)" }), el("input", { id: "uploads", type: "file", multiple: true, accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.txt" }),
        el("p", { class: "hint", text: "Up to 4 MB per file." }),
        el("div", { class: "check" }, el("input", { type: "checkbox", id: "records_ok" }), el("label", { for: "records_ok", text: "I give my veterinarian permission to share my pet's records with NYSVMS." })),
        el("label", { for: "release", text: "Signed records release form (optional)" }), el("input", { id: "release", type: "file", accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png" }))),
    el("div", {},
      el("div", { class: "panel" }, el("h2", { text: "About you" }), f("name", "Your name"), f("email", "Email", "email", { autocomplete: "email" }), f("phone", "Phone", "tel", { autocomplete: "tel" }), f("address", "Mailing address"),
        el("div", { class: "hp", "aria-hidden": "true" }, el("label", { for: "website", text: "Leave this empty" }), el("input", { id: "website", type: "text", tabindex: "-1", autocomplete: "off" })),
        el("p", { class: "hint", text: "We email you a confirmation and your complaint number. Use this email to sign in and check on it later." }), msg,
        el("div", { class: "row", style: "margin-top:18px" }, btn)),
      el("div", { class: "note", style: "margin-top:18px", text: "A volunteer veterinarian is usually assigned within two weeks. They will contact you directly." })));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); msg.replaceChildren(); btn.disabled = true; btn.textContent = "Submitting…";
    const v = (id) => $(id).value;
    const data = { name: v("name"), email: v("email"), phone: v("phone"), address: v("address"), vet_name: v("vet_name"), vet_email: v("vet_email"), practice: v("practice"),
      practice_address: v("practice_address"), subject: v("subject"), description: v("description"), records_ok: $("records_ok").checked, website: v("website") };
    for (const [k] of ATT) data[k] = $(k).checked;
    try {
      const out = await post("/api/intake", data);
      const failed = [];
      if (out.ticket) {
        failed.push(...(await uploadFiles([...$("uploads").files], { complaint: out.complaint, ticket: out.ticket, field: "uploads" })));
        failed.push(...(await uploadFiles([...$("release").files], { complaint: out.complaint, ticket: out.ticket, field: "release" })));
      }
      show(el("p", { class: "eyebrow", text: "Complaint received" }), el("h1", { text: `Thank you. Your complaint number is #${out.n}.` }),
        el("p", { class: "lede", text: "We've emailed you a confirmation. A volunteer veterinarian will be assigned and will contact you directly. You can check on your complaint at any time by signing in with your email." }),
        failed.length ? el("div", { class: "err", text: `These files didn't upload: ${failed.join(", ")}. Please email them to staff@nysvms.org with your complaint number.` }) : null,
        el("div", { class: "row" }, el("a", { class: "btn", href: "#/signin", text: "Sign in to check on it" })));
    } catch (err) { msg.append(el("div", { class: "err", text: err.message })); btn.disabled = false; btn.textContent = "Submit complaint"; }
  });
  show(el("p", { class: "eyebrow", text: "File a complaint" }), el("h1", { text: "Tell us what happened" }),
    el("p", { class: "lede", text: "This takes about ten minutes. Please read About first: we can only help with NYSVMS member veterinarians, and not with fees or discipline." }), form);
}

// ---- signed-in lists ----
let filter = "open";
async function home() {
  const { mine, work } = await api("/api/complaints");
  const parts = [];
  if (me.staff || me.facilitator) {
    const open = work.filter((c) => !CLOSED.includes(c.status));
    parts.push(el("p", { class: "eyebrow", text: me.staff ? "Staff" : "Facilitator" }), el("h1", { text: me.staff ? "All complaints" : "My assignments" }));
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
    parts.push(el("p", { class: "eyebrow", style: me.staff || me.facilitator ? "margin-top:40px" : "", text: "My complaints" }));
    if (!me.staff && !me.facilitator) parts.push(el("h1", { text: `Welcome back, ${String(me.name).split(" ")[0]}` }), el("p", { class: "lede", text: "Here is where each of your complaints stands. Your facilitator will contact you directly by email or phone." }));
    for (const c of mine) parts.push(el("div", { class: "panel" },
      el("div", { class: "row between" }, el("h2", { style: "margin:0" }, el("a", { href: `#/c/${c.id}`, text: `#${c.n} · ${c.subject || "Complaint"}` })), statusChip(c.status)),
      el("p", { class: "muted small", text: `About ${c.vet_name}${c.practice ? ", " + c.practice : ""} · received ${fmtDate(c.received)}` }),
      steps(c.status), c.facilitator ? el("p", { class: "small" }, "Your facilitator: ", el("strong", { text: c.facilitator })) : null));
  }
  show(parts);
}
const card = (n, label, attn) => el("div", { class: "card" + (attn ? " attn" : "") }, el("div", { class: "big", text: String(n) }), el("div", { class: "lbl", text: label }));
const steps = (s) => el("ol", { class: "steps" }, STEPS.map((t, i) => el("li", { class: i < stepIndex(s) ? "done" : i === stepIndex(s) ? "now" : "", text: t })));
function table(rows, staff) {
  return el("div", { class: "tbl-wrap" }, el("table", {},
    el("thead", {}, el("tr", {}, ["#", "Complaint", staff ? "Facilitator" : null, "Status", "Last activity"].filter(Boolean).map((h) => el("th", { text: h })))),
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
  const doc = el("input", { id: "nt-f", type: "file" });
  const noteForm = el("div", { hidden: true, style: "margin-top:12px" }, el("label", { for: "nt", text: "Update" }), note, el("label", { for: "nt-f", text: "Attach a document (optional, up to 4 MB)" }), doc,
    el("div", { class: "row", style: "margin-top:12px" }, el("button", { class: "btn", type: "button", text: "Save update", onclick: async (e) => {
      e.target.disabled = true;
      try {
        const out = await post("/api/complaint/update", { id: c.id, notes: note.value });
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
  const resPanel = el("div", { class: "panel" }, el("h2", { text: "Resolution" }), el("label", { for: "res", text: "Resolution (the owner sees this once the complaint is Completed)" }), res,
    el("label", { for: "res-n", text: "Notes for staff" }), resNotes,
    el("div", { class: "row", style: "margin-top:10px" }, el("button", { class: "btn-small", type: "button", text: "Save resolution", onclick: async () => {
      try { await post("/api/complaint/resolution", { id: c.id, resolution: res.value, resolution_notes: resNotes.value }); toast("Resolution saved"); } catch (err) { toast(err.message, true); }
    } })));
  const fb = c.feedback ? el("div", { class: "panel" }, el("h2", { text: "Owner feedback" }), el("dl", { class: "facts" },
    [["Overall", c.feedback.overall], ["Facilitator", c.feedback.facilitator], ["Admin team", c.feedback.admin], ["Member value", c.feedback.value]].filter(([, v]) => v).map(([k, v]) => [el("dt", { text: k }), el("dd", { text: "★".repeat(v) + ` ${v} of 5` })])),
    c.feedback.comments ? el("p", { class: "story", text: c.feedback.comments }) : null) : null;
  const A = c.attestations;
  show(back, el("p", { class: "eyebrow", style: "margin-top:14px", text: `Complaint #${c.n} · received ${fmtDate(c.received)}` }), el("h1", { text: c.subject || "Complaint" }),
    el("div", { class: "row", style: "margin-bottom:18px" }, statusChip(c.status), el("span", { class: "muted small", text: `Facilitator: ${c.facilitator ? c.facilitator.name : "not assigned"}` })),
    el("div", { class: "grid2" },
      el("div", {},
        el("div", { class: "panel" }, el("h2", { text: "What the owner told us" }), el("p", { class: "story", text: c.description || "—" }),
          (c.uploads.length || c.release.length) ? el("div", { class: "files" }, c.uploads.map((f) => fileLink(c.id, f)), c.release.map((f) => fileLink(c.id, f))) : null,
          el("p", { class: "hint", text: `${c.records_ok ? "The owner gave permission to share records." : "The owner did not give permission to share records."}${Object.values(A).every(Boolean) ? "" : " Some 'before you start' statements were not confirmed."}` })),
        progress),
      el("div", {}, people, statusPanel, resPanel, fb)));
}

function ownerView(c) {
  const parts = [el("a", { class: "btn-small", href: "#/", text: "← My complaints" }),
    el("p", { class: "eyebrow", style: "margin-top:14px", text: `Complaint #${c.n} · received ${fmtDate(c.received)}` }), el("h1", { text: c.subject || "Your complaint" }),
    el("div", { class: "panel" }, el("div", { class: "row between" }, el("h2", { style: "margin:0", text: "Where it stands" }), statusChip(c.status)), steps(c.status),
      c.facilitator ? el("p", {}, "Your facilitator: ", el("strong", { text: c.facilitator.name }), ". They will contact you directly.") : el("p", { class: "muted", text: "We are finding a volunteer veterinarian for your complaint." }),
      c.status === "Completed" && c.resolution ? el("p", {}, el("strong", { text: "Resolution: " }), c.resolution) : null,
      c.can_feedback ? el("a", { class: "btn", href: `#/feedback/${c.id}`, text: "Tell us how it went" }) : c.feedback_given ? el("p", { class: "note", text: "Thank you for your feedback." }) : null),
    el("div", { class: "panel" }, el("h2", { text: "What you told us" }), el("p", { class: "muted small", text: `About ${c.vet_name}${c.practice ? ", " + c.practice : ""}` }), el("p", { class: "story", text: c.description }),
      (c.uploads.length || c.release.length) ? el("div", { class: "files" }, c.uploads.map((f) => fileLink(c.id, f)), c.release.map((f) => fileLink(c.id, f))) : null)];
  show(parts);
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
    try { await post("/api/complaint/update", { id: c.id, notes: `Letter drafted to ${to.value}: ${subj.value}`, letter_type: templates[Number(pick.value)].type, letter_text: `Subject: ${subj.value}\n\n${body.value}` }); toast("Saved to progress"); location.hash = `#/c/${c.id}`; }
    catch (err) { toast(err.message, true); e.target.disabled = false; }
  };
  show(el("a", { class: "btn-small", href: `#/c/${c.id}`, text: `← Back to #${c.n}` }),
    el("p", { class: "eyebrow", style: "margin-top:14px", text: `Complaint #${c.n}` }), el("h1", { text: "Draft a letter" }),
    el("p", { class: "lede", text: "Pick a letter. The complaint's details are filled in for you. Edit it, then copy it into your own email. Anything still in {braces} needs your attention before sending." }),
    el("div", { class: "grid2" },
      el("div", { class: "panel" }, el("label", { for: "lt", style: "margin-top:0", text: "Letter" }), pick, el("label", { for: "lt-to", text: "To" }), to,
        el("label", { for: "lt-sub", text: "Subject" }), subj, el("label", { for: "lt-body", text: "Letter" }), body, left,
        el("div", { class: "row", style: "margin-top:14px" }, el("button", { class: "btn", type: "button", text: "Copy letter", onclick: copy }), el("button", { class: "btn-outline", type: "button", text: "Save to progress", onclick: save }))),
      el("div", { class: "note", text: "The portal never sends these letters. You review and send each one from your own email, so you stay the person the owner and veterinarian hear from. Files can't be linked for the vet, so attach them to your email." })));
}

// ---- feedback ----
async function feedback(id) {
  const c = await api(`/api/complaint?id=${encodeURIComponent(id)}`);
  if (!c.can_feedback) { location.hash = `#/c/${id}`; return; }
  const val = { overall: 0, facilitator: 0, admin: 0, value: 0 };
  const stars = (k) => {
    const box = el("div", { class: "stars", role: "group" });
    const draw = () => box.replaceChildren(...[1, 2, 3, 4, 5].map((i) => el("button", { type: "button", class: i <= val[k] ? "on" : "", "aria-label": `${i} of 5`, "aria-pressed": String(i === val[k]), text: "★", onclick: () => { val[k] = i; draw(); } })));
    draw(); return box;
  };
  const comments = el("textarea", { id: "fb-c" });
  const msg = el("div");
  const form = el("form", { class: "panel", style: "max-width:640px" },
    el("label", { text: "Overall, how satisfied were you with the NYSVMS complaints process?" }), stars("overall"),
    el("label", { text: "How satisfied were you with the support from your facilitator?" }), stars("facilitator"),
    el("label", { text: "How satisfied were you with the support from the NYSVMS staff?" }), stars("admin"),
    el("label", { text: "How valuable was this service to you?" }), stars("value"),
    el("label", { for: "fb-c", text: "Anything that would help us improve the process" }), comments, msg,
    el("div", { class: "row", style: "margin-top:16px" }, el("button", { class: "btn", type: "submit", text: "Send feedback" }), el("a", { class: "btn-outline", href: `#/c/${c.id}`, text: "Back" })));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); msg.replaceChildren();
    try { await post("/api/complaint/feedback", { id: c.id, ...val, comments: comments.value }); toast("Feedback sent. Thank you."); location.hash = `#/c/${c.id}`; }
    catch (err) { msg.append(el("div", { class: "err", text: err.message })); }
  });
  show(el("p", { class: "eyebrow", text: `Complaint #${c.n}` }), el("h1", { text: "How did we do?" }), form);
}

// ---- staff pages ----
async function facilitatorList() {
  const facs = await api("/api/facilitators");
  show(el("p", { class: "eyebrow", text: "Staff" }), el("h1", { text: "Facilitators" }),
    el("p", { class: "lede", text: `Volunteer veterinarians who mediate complaints. ${facs.filter((f) => f.active).length} are active. To add someone or change their region, edit the People table in Airtable (Roles: Facilitator, Active ticked).` }),
    el("div", { class: "tbl-wrap" }, el("table", {}, el("thead", {}, el("tr", {}, ["Name", "Region", "Open", "All time", "Status"].map((h) => el("th", { text: h })))),
      el("tbody", {}, facs.map((f) => el("tr", {}, el("td", {}, f.name, el("div", { class: "small muted", text: f.email })), el("td", { text: f.region || "—" }),
        el("td", { class: "num", text: String(f.open) }), el("td", { class: "num", text: String(f.total) }), el("td", {}, el("span", { class: "chip " + (f.active ? "ok" : "neutral"), text: f.active ? "Active" : "Inactive" }))))))));
}
async function letterList() {
  const t = await api("/api/templates");
  show(el("p", { class: "eyebrow", text: "Staff" }), el("h1", { text: "Letter templates" }),
    el("p", { class: "lede", text: "The letters facilitators can draft. Words in {braces} are filled in from the complaint. To change the wording, edit the Letter Templates table in Airtable; changes show here within a minute." }),
    el("div", { class: "stack" }, t.map((x) => el("div", { class: "panel" }, el("div", { class: "row between" }, el("h3", { text: x.type }), el("span", { class: "chip neutral", text: x.recipient === "Owner" ? "To owner" : "To veterinarian" })),
      el("p", { class: "small muted", style: "margin:6px 0 0", text: `Subject: ${x.subject}` }), el("details", { class: "letter-text" }, el("summary", { text: "Show the letter" }), el("pre", { text: x.body }))))));
}
function guide() {
  show(el("p", { class: "eyebrow", text: "Facilitator guide" }), el("h1", { text: "How mediation works" }),
    el("ol", { class: "lede", style: "padding-left:20px" },
      el("li", { text: "Staff ask you to take a complaint. You get an email and it appears under My assignments." }),
      el("li", { text: "Introduce yourself to the owner, then to the veterinarian, using Draft a letter." }),
      el("li", { text: "Log each call or email as an update so staff can see where things stand, and keep the status current." }),
      el("li", { text: "When it's resolved, record the resolution, set the status to Completed and send the two resolution letters. The owner's letter includes a feedback link." })),
    el("p", {}, "Questions? Email ", el("a", { href: "mailto:staff@nysvms.org", text: "staff@nysvms.org" }), "."));
}

// ---- start ----
(async () => {
  try { me = await fetch("/api/auth/session", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)); } catch { me = null; }
  route();
})();
