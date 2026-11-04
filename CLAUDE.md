<!-- v03 (2026-11-04) -->
# NYSVMS Mediation Portal: rules for Claude

This portal replaces the Knack app "NYSVMS Complaints Process" (app `5a622d7763fc886409098318`). README.md covers the stack and phases, `docs/airtable.md` has every field ID, and `docs/phase0-audit.md` covers what Knack holds and how it behaves.

**This app holds sensitive personal data:** pet owners' names, addresses and phone numbers, complaints about named veterinarians, and medical records. Treat every record as confidential.

## Where things live
- **Code:** this repo (`C:UsersTimAtkinson
ysvms-mediation-portal`). GitHub: `TimAtkinsonNYSVMS/mediation` (private), branch `main`.
- **Hosting:** Netlify site `nysvms-mediation` (site ID `cc638529-3a34-414e-becb-708acc07b16e`, team tatkinsonnysvms), https://nysvms-mediation.netlify.app until mediation.nysvms.org is set up. It deploys on every push to `main` once Tim links the repo in Netlify. Settings are for the production context only: SESSION_SECRET, CM_WEBHOOK_SECRET, CM_MAIL_WEBHOOK_URL, PORTAL_URL, STAFF_INBOX, and AIRTABLE_TOKEN (Tim adds it).
- **Data:** Airtable base `appUbdZxOQ7WjyOYJ`. Tables: People, Complaints, Progress Updates, Letter Templates, Sign-in Codes.
- **Knack (source until cutover):** read only, through Make **5021492** (`object_id`, `limit`). Never write to Knack.
- **Make:**
  - **2006069 "Create draft email"** is the live Knack draft-letter generator (ON). Leave it alone until cutover.
  - The Knack connection is 2176791.
  - **5021628** is the migration (OFF; see docs/phase1-migration.md).
  - **5021786 "Mediation portal - email"** (hook 2865284, Mandrill 417657) takes `type: code | notify` and replies `{"sent": true}`. Its filter checks the shared secret, which is `CM_WEBHOOK_SECRET` in Netlify. The secret is never kept in this repo.
- **Docs:** Google Drive, Claude Development / NYSVMS Mediation Portal. `1zamV0difxthigtatnBQUwjaUp0fsEc9_`. Follow the nysvms-dev-docs skill.

## Code
- Server: `netlify/lib` (core, airtable, access, otp, mail, complaints) and `netlify/functions` (one file per endpoint).
- Page: `public/` (plain JS, hash routes).
- Tests: `npm test`.
- Local server: `npm run dev` (port 8892, made-up data; sign in at /dev/as/staff, /dev/as/fac or /dev/as/owner).

## Rules
1. **Never deploy by uploading files to Netlify.** Every change goes through a commit to this repo.
2. **Never put secrets, or any real complaint data, in code, tests, Drive or chat.** Tests use made-up data only. Don't paste owner or vet details into docs; refer to complaints by number.
3. **Airtable:** use field IDs.
4. **Who sees what (to build in Phase 2):**
   - An owner sees only complaints where they are the Owner.
   - A facilitator sees only complaints where they are the Facilitator.
   - Staff see everything.
   - Every rule lives in one access module, and endpoints ask it rather than deciding for themselves. Roles are re-read from People on each request; never trust a role stored in the cookie.
5. **Letter drafts:** fill placeholders from Letter Templates. Leave any unknown placeholder visible. Drafts are for the facilitator to review and send; the portal never emails a vet or owner a letter by itself.
6. **Versioning:** each file starts with a version comment. Bump it when you change the file.
7. **Design:** follow the nysvms-design-standards skill, with the same tokens as the volunteer and treasurer portals.
