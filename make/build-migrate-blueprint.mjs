// build-migrate-blueprint v01 (2026-11-04)
// Generates make/migrate.blueprint.json for Make scenario "Complaints portal - Migrate (Knack → Airtable)".
// Run: node make/build-migrate-blueprint.mjs
// Input `stage`: facilitators | complaints | updates. Run them in that order. Every write is an upsert, so reruns are safe.
import { writeFileSync } from "node:fs";

const KNACK = 2176791;      // Knack - Complaints Process
const AT = 4677355;         // Airtable connection (same as treasurer portal)
const BASE = "appUbdZxOQ7WjyOYJ";
const T = { people: "tblMC3vdByJkY9jEC", complaints: "tbl0FlFU8Xxn5UfK1", updates: "tblzyvyYFymTo4xR6" };
const P = { email: "fldvjOpPE8GajiOrx", name: "fldYjFqomse1p91BB", phone: "fldvdFwuiAauexiiR", address: "fldSaGISV1gYGdGxD",
  roles: "fldISqQVSu1f3qLnZ", active: "fldM1SsovNPz8jjSc", region: "fldXUBbG7YL9cbK0f", knack: "fldJlsqHZyveFk9Wo" };
const C = { num: "fldg11sJnOcSL9isq", received: "fldf529tftYjMmXTz", status: "flduLBEGv02ch9cDn", owner: "fldBXPZ7L6s29trcD",
  fac: "fldcuf96LhF1XKlaV", subject: "fldn8dv0UnA0sDLfh", desc: "fldioiCzvEYdviMJ9", vetName: "fldQ1b2UFA3D6mNAI",
  vetEmail: "fldjTlxd3X4FG2uKs", practice: "fldus5G7qO3ji0IWa", practiceAddr: "fldNBq6JPynKKyHqu",
  aMember: "fldrQoWyAYJAIjIw5", aLegal: "fldSOmidssLI4qhfF", aOpd: "fld8dwP5IQ83QKMMF", aFees: "fldujZaqEFtTSxVuF",
  aService: "fld8fHdDGtVKQJydo", aTerms: "fld8pkG02efarEZC6", records: "fldHeqnXSU0drmpe7", uploads: "fld5c7WytBfZRJdMG",
  release: "fldPpBXyG3eRyGRi0", resolution: "fldDZZMVNVTayS2dC", resNotes: "fldCwzyS6IxW5Wc1G", completedBy: "fldkFRh6jGXrSV8Hx",
  fbDate: "fldW8uipeCU9zBKGo", fbOverall: "fldAK4HIVK3mOAAYs", fbValue: "fldXs9UGqSVLyuVd8", fbFac: "flddQcVoT2wAhu6ul",
  fbAdmin: "fldZ7eJTGBYf38ydY", fbComments: "fld9Vnqur9xRama69", knack: "fldUCyupEW8d0KPIj" };
const U = { num: "fld8lFmpecZG7cdaQ", complaint: "fldj3FAAYKeGMKuhG", author: "fldvm1aIsRmvMO4EQ", date: "fldIucKCQWOnZp1Bi",
  notes: "fldm2HjE7PEN3hU0n", docs: "fldglDofWQ9vufOCk", letterType: "fldi7g5q1MalmVyla", letterText: "fldQeNqc0kHjt8Jki", knack: "fldBXhXqXp02JKC3o" };

let x = 0;
const pos = () => ({ designer: { x: (x += 300), y: 0 } });
const exist = (a) => ({ a, o: "exist" });
const filter = (name, ...conds) => ({ name, conditions: [conds] });
const search = (id, object) => ({ id, module: "knack:SearchForRecords", version: 2, parameters: { __IMTCONN__: KNACK },
  mapper: { object_id: object, limit: 1000, mode: "both", match: "", filters: [], sort_field: "" }, metadata: pos() });
const col = (id, type, value) => ({ id, type, value });
const upsert = (id, table, mergeOn, record, name, f) => ({ id, module: "airtable:bulkUpsertRecords", version: 3,
  parameters: { __IMTCONN__: AT }, ...(f ? { filter: f } : {}),
  mapper: { select: "map", base: BASE, table, fieldsToMergeOn: [mergeOn], typecast: true, useColumnId: true, records: [{ record }] },
  metadata: { ...pos(), designer: { ...pos().designer, name } } });
const atSearch = (id, table, formula, name, f) => ({ id, module: "airtable:ActionSearchRecords", version: 3,
  parameters: { __IMTCONN__: AT }, ...(f ? { filter: f } : {}),
  mapper: { base: BASE, table, formula, formulaField: "formula", maxRecords: 1, useColumnId: true },
  metadata: { ...pos(), designer: { ...pos().designer, name } } });
const date = (m, f) => `{{ifempty(${m}.${f}_raw.proper_iso_timestamp; ${m}.${f}_raw.iso_timestamp)}}`;
const yes = (m, f) => `{{if(${m}.${f}; true; false)}}`;
const lowerEmail = (expr) => `{{lower(trim(${expr}))}}`;

// ---------- stage: facilitators (Knack object_4) ----------
const facRoute = { flow: [
  { ...search(10, "object_4"), filter: filter("stage = facilitators", { a: "{{1.stage}}", o: "text:equal", b: "facilitators" }) },
  upsert(11, T.people, P.email, [
    col(P.email, "text", lowerEmail("10.field_30_raw.email")),
    col(P.name, "text", "{{trim(10.field_29_raw.full)}}"),
    col(P.roles, "multiple", ["Facilitator"]),
    col(P.active, "boolean", "{{if(contains(10.field_32_raw; \"active\"); true; false)}}"),
    col(P.region, "text", "{{10.field_77_raw[1]}}"),
    col(P.knack, "text", "{{10.id}}"),
  ], "Upsert facilitator", filter("has email", exist("{{10.field_30_raw.email}}"))),
] };

// ---------- stage: complaints (Knack object_1) ----------
const cBranches = [
  { flow: [
    upsert(31, T.people, P.email, [
      col(P.email, "text", lowerEmail("20.field_67_raw")),
      col(P.name, "text", "{{trim(20.field_19_raw[1].identifier)}}"),
      col(P.phone, "text", "{{20.field_68_raw}}"),
      col(P.address, "text", "{{trim(replace(20.field_69_raw; \"<br />\"; \", \"))}}"),
    ], "Upsert owner", filter("owner email", exist("{{20.field_67_raw}}"))),
    upsert(32, T.complaints, C.knack, [col(C.knack, "text", "{{20.id}}"), col(C.owner, "multiple", ["{{31.id}}"])], "Link owner"),
  ] },
  { flow: [
    atSearch(33, T.people, "{Knack IDs} = \"{{20.field_39_raw[1].id}}\"", "Find facilitator", filter("has facilitator", exist("{{20.field_39_raw[1].id}}"))),
    upsert(34, T.complaints, C.knack, [col(C.knack, "text", "{{20.id}}"), col(C.fac, "multiple", ["{{33.id}}"])], "Link facilitator"),
  ] },
  { flow: [
    upsert(35, T.complaints, C.knack, [col(C.knack, "text", "{{20.id}}"),
      col(C.uploads, "openUrl", [{ url: "{{20.field_23_raw.url}}", filename: "{{20.field_23_raw.filename}}" }])],
      "Uploads file", filter("has upload", exist("{{20.field_23_raw.url}}"))),
  ] },
  { flow: [
    upsert(36, T.complaints, C.knack, [col(C.knack, "text", "{{20.id}}"),
      col(C.release, "openUrl", [{ url: "{{20.field_25_raw.url}}", filename: "{{20.field_25_raw.filename}}" }])],
      "Release form file", filter("has release form", exist("{{20.field_25_raw.url}}"))),
  ] },
  { flow: [
    upsert(37, T.complaints, C.knack, [col(C.knack, "text", "{{20.id}}"),
      col(C.fbDate, "date", date("20", "field_71")),
      col(C.fbOverall, "number", "{{if(20.field_72_raw; ceil(20.field_72_raw); \"\")}}"),
      col(C.fbValue, "number", "{{if(20.field_85_raw; ceil(20.field_85_raw); \"\")}}"),
      col(C.fbFac, "number", "{{if(20.field_73_raw; ceil(20.field_73_raw); \"\")}}"),
      col(C.fbAdmin, "number", "{{if(20.field_74_raw; ceil(20.field_74_raw); \"\")}}"),
      col(C.fbComments, "text", "{{20.field_75_raw}}")],
      "Feedback", { name: "has feedback", conditions: [[exist("{{20.field_72_raw}}")], [exist("{{20.field_75_raw}}")]] }),
  ] },
];
const complaintRoute = { flow: [
  { ...search(20, "object_1"), filter: filter("stage = complaints", { a: "{{1.stage}}", o: "text:equal", b: "complaints" }) },
  upsert(30, T.complaints, C.knack, [
    col(C.knack, "text", "{{20.id}}"),
    col(C.num, "number", "{{20.field_2_raw}}"),
    col(C.received, "date", date("20", "field_66")),
    col(C.status, "text", "{{ifempty(20.field_54_raw[1]; \"Awaiting assignment\")}}"),
    col(C.subject, "text", "{{20.field_1_raw}}"),
    col(C.desc, "text", "{{20.field_7_raw}}"),
    col(C.vetName, "text", "{{20.field_8_raw}}"),
    col(C.vetEmail, "text", "{{20.field_76_raw.email}}"),
    col(C.practice, "text", "{{20.field_52_raw}}"),
    col(C.practiceAddr, "text", "{{20.field_53_raw.full}}"),
    col(C.aMember, "boolean", yes("20", "field_22_raw")),
    col(C.aLegal, "boolean", yes("20", "field_9_raw")),
    col(C.aOpd, "boolean", yes("20", "field_11_raw")),
    col(C.aFees, "boolean", yes("20", "field_65_raw")),
    col(C.aService, "boolean", yes("20", "field_12_raw")),
    col(C.aTerms, "boolean", yes("20", "field_13_raw")),
    col(C.records, "boolean", "{{if(20.field_24_raw; true; false)}}"),
    col(C.resolution, "text", "{{20.field_63_raw}}"),
    col(C.resNotes, "text", "{{20.field_62_raw}}"),
    col(C.completedBy, "text", "{{20.field_86_raw.full}}"),
  ], "Upsert complaint"),
  { id: 39, module: "builtin:BasicRouter", version: 1, mapper: null, metadata: pos(), routes: cBranches },
] };

// ---------- stage: updates (Knack object_3) ----------
const updateRoute = { flow: [
  { ...search(40, "object_3"), filter: filter("stage = updates", { a: "{{1.stage}}", o: "text:equal", b: "updates" }) },
  atSearch(41, T.complaints, "{Knack ID} = \"{{40.field_40_raw[1].id}}\"", "Find complaint", filter("has complaint", exist("{{40.field_40_raw[1].id}}"))),
  upsert(42, T.updates, U.knack, [
    col(U.knack, "text", "{{40.id}}"),
    col(U.num, "number", "{{40.field_41_raw}}"),
    col(U.complaint, "multiple", ["{{41.id}}"]),
    col(U.date, "date", date("40", "field_27")),
    col(U.notes, "text", "{{40.field_43_raw}}"),
    col(U.letterType, "text", "{{40.field_84_raw}}"),
    col(U.letterText, "text", "{{40.field_82_raw}}"),
  ], "Upsert update"),
  { id: 49, module: "builtin:BasicRouter", version: 1, mapper: null, metadata: pos(), routes: [
    { flow: [
      atSearch(43, T.people, "{Knack IDs} = \"{{40.field_42_raw[1].id}}\"", "Find author", filter("has author", exist("{{40.field_42_raw[1].id}}"))),
      upsert(44, T.updates, U.knack, [col(U.knack, "text", "{{40.id}}"), col(U.author, "multiple", ["{{43.id}}"])], "Link author"),
    ] },
    { flow: [
      upsert(45, T.updates, U.knack, [col(U.knack, "text", "{{40.id}}"),
        col(U.docs, "openUrl", [{ url: "{{40.field_44_raw.url}}", filename: "{{40.field_44_raw.filename}}" }])],
        "Document file", filter("has document", exist("{{40.field_44_raw.url}}"))),
    ] },
  ] },
] };

const blueprint = {
  name: "Complaints portal - Migrate (Knack → Airtable)",
  flow: [
    { id: 1, module: "scenario-service:StartSubscenario", version: 2, metadata: { designer: { x: 0, y: 0 }, interface: [
      { name: "stage", label: "Stage", type: "text", required: true, help: "facilitators | complaints | updates — run in that order" }] } },
    { id: 2, module: "builtin:BasicRouter", version: 1, mapper: null, metadata: pos(), routes: [facRoute, complaintRoute, updateRoute] },
  ],
  metadata: { version: 1, instant: false, scenario: { roundtrips: 1, maxErrors: 3, autoCommit: true, autoCommitTriggerLast: true, sequential: false, confidential: false, dataloss: false, dlq: false, freshVariables: false } },
};
writeFileSync(new URL("./migrate.blueprint.json", import.meta.url), JSON.stringify(blueprint, null, 1));
console.log("ok", JSON.stringify(blueprint).length);
