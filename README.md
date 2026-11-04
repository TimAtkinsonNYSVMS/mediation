<!-- v01 (2026-11-04) -->
# Complaints Mediation Portal

Replaces the Knack app "NYSVMS Complaints Process" (slug `complaints`, app `5a622d7763fc886409098318`). A pet owner files a complaint about an NYSVMS member veterinarian. Staff assign a volunteer facilitator, who mediates, logs progress updates and sends template letters. At the end the owner leaves feedback.

The stack follows the volunteer and treasurer portals (`nysvms-volunteer-portal`, `nysvms-treasurer-portal`):
- **Data:** Airtable base **Complaints Mediation** `appUbdZxOQ7WjyOYJ` (My First Workspace). Every ID is in `docs/airtable.md`.
- **Files:** Airtable attachments. The complaint uploads, release forms and update documents are small, under 200 files in 8 years. The portal only ever hands out short-lived Airtable URLs to signed-in users who may see that complaint.
- **Portal:** Netlify, plain HTML and JS, with Node functions as the only route to Airtable. Sign-in is an emailed one-time code with a signed session cookie. Planned address: complaints.nysvms.org.
- **Email:** Make plus Mandrill, the same pattern as "Treasurer portal - email".
- **Docs:** Google Drive, Claude Development / Complaints Mediation Portal `1zamV0difxthigtatnBQUwjaUp0fsEc9_`.

## Defaults (Tim, 2026-11-04: "start Phase 0 with the defaults")
- Migrate all history (125 complaints, 453 updates, 158 files).
- Staff are Tim and Katie Smith. Facilitators and owners sign in by emailed code; there are no passwords.
- Template letters are built into the portal, replacing Make 2006069.

## Phases
- **Phase 0 (done 2026-11-04):** Knack read path (Make 5021492), audit (`docs/phase0-audit.md`), Airtable base, and the 7 letter templates loaded.
- **Phase 1 (done 2026-11-04):** Make 5021628 migrated 151 people, 125 complaints, 446 progress updates and 155 files; every count reconciles with Knack (`docs/phase1-migration.md`). Knack is still live, so rerun the `complaints` and `updates` stages just before cutover.
- **Phase 2 (built 2026-11-04, not deployed yet):** the portal, per `docs/phase2-portal-spec.md`.
  - Public intake with file uploads, owner view and feedback, facilitator and staff views, letter drafts, and the 5 notification emails through Make 5021786.
  - 14 endpoint tests pass (`npm test`). The local test server (`npm run dev`, port 8892, sign in at /dev/as/staff, /dev/as/fac or /dev/as/owner) was clicked through on desktop and phone.
  - To go live: Tim creates the GitHub repo, then a Netlify site linked to it with the settings in the spec. Switch on Make 5021786, add the complaints.nysvms.org DNS record, and test with real sign-ins.
- **Phase 3:** cutover.
  - Point the nysvms.org links at the portal.
  - Turn off Make 2006069.
  - Set Knack read-only, then close it.
