<!-- v01 (2026-11-04) -->
# Phase 2: portal spec

The portal follows the clickable demo Tim approved (https://claude.ai/artifact/XKCoPPZhEH25o31Laevb8V) and uses the same stack as the treasurer portal.

## Who can sign in
Sign-in is a 6-digit code emailed to the person's address, valid 10 minutes, with at most 5 codes an hour. Before sending, the server finds the People row for that email (case-insensitive) and allows sign-in when the person:
- has **Staff** in Roles and is Active; or
- has **Facilitator** in Roles and is Active; or
- is the **Owner** of at least one complaint (pet owners need no Active flag or role).

Anyone else gets the same "check your email" answer and no email, so the form can't reveal who has access.

## Who sees what (`netlify/lib/access.mjs`, the only place these rules live)
| | Staff | Facilitator | Owner |
|---|---|---|---|
| List | all complaints | complaints where they are the Facilitator | their own complaints |
| Detail | full | full, for assigned complaints only | owner view: their own submission, status, facilitator name, resolution once Completed; no progress notes and no other people's contact details |
| Add a progress update or document | yes | assigned only | no |
| Change status, record the resolution | yes | assigned only (not back to "Awaiting assignment") | no |
| Assign a facilitator | yes | no | no |
| Draft letters | yes | assigned only | no |
| Leave feedback | no | no | own complaint, once Completed, once only |
| Open files | all | assigned only | the files they uploaded and the release form |

Roles are re-read from People on every request (60-second cache). The cookie holds only the email.

## Public intake (no sign-in)
- The six "before you start" boxes must all be ticked, and owner name, email, vet name and the description are required. A hidden honeypot field rejects bots.
- The People row is found or created by email, keeping existing names and phone numbers.
- The complaint gets the next number (the highest + 1), Status "Awaiting assignment" and Source "Portal".
- The response carries a signed 30-minute upload ticket for that one complaint, so the owner's files can follow, up to 4 MB each.
- Emails go to the owner (confirmation, using the Knack wording) and the staff inbox (`STAFF_INBOX`, default staff@nysvms.org).

## Notifications (replacing the 5 Knack email rules)
| Event | To |
|---|---|
| New complaint | Owner (confirmation) and the staff inbox |
| Facilitator assigned | That facilitator, and all active Staff |
| Progress update added | Active Staff, except the author |
| Status changed | Active Staff |
| Feedback left | Active Staff |

Email goes through the Make webhook "Mediation portal - email" (Mandrill), with the same contract as the treasurer portal: `type: code | notify`. A failed notice never undoes the change that triggered it.

## Letters
- The client fills placeholders from Letter Templates (`/api/templates`). Any unknown or empty placeholder stays visible in {braces}.
- `{uploads_link}` and `{release_form_link}` become a list of the file names, plus a reminder to attach them, because vets can't sign in to the portal.
- `{feedback_link}` is the owner's portal link for owner letters. For vet letters it stays visible, because vet feedback has no portal page yet (a decision for Tim).
- The portal never sends letters. The facilitator copies each one into their own email. "Save to progress" logs it as an update, with the letter type and text.

## Files
- Stored as Airtable attachments.
- Uploads go through `/api/upload` (base64 JSON, 4 MB per file) to Airtable's upload-attachment endpoint.
- `/api/file` checks access, then redirects to Airtable's short-lived attachment URL.

## Settings (Netlify, production)
`AIRTABLE_TOKEN` (needs read and write on appUbdZxOQ7WjyOYJ, plus data.records:write for attachments), `SESSION_SECRET`, `CM_MAIL_WEBHOOK_URL`, `CM_WEBHOOK_SECRET`, `PORTAL_URL`, `STAFF_INBOX`.
