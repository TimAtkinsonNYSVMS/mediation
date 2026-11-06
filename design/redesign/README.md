# Mediation portal UX redesign

28 static HTML mockups of every portal screen, built on the NYSVMS Design System. Open any `.html` file in a browser. The buttons and tabs link between screens, so you can click through each role's flow.

These are design references, not production code. Match their layout, copy and behavior in the real app. Don't copy the markup in wholesale.

## Files

| File | What it is |
|---|---|
| `portal.css` | Shared UI layer: header, tabs, buttons, cards, status pills, forms, tables, timeline, stepper. Port these patterns into the app's styles. |
| `tokens.css` | NYSVMS Design System tokens (colors, type, spacing). Source of truth for values. |
| `nysvms-logo-on-dark.png` | Official logo for the navy header. |
| `01` to `05` | Public: About, request form (step 1 of 4), request received, sign in (email, code) |
| `06` to `09` | Pet owner: My requests, request in progress, request completed, feedback |
| `10` to `14` | Facilitator: My assignments, request workspace, log an update, draft a letter, guide |
| `15` to `23` | Staff: Requests (Open, Needs attention), unassigned request, facilitators, letter templates, people and access, edit/add person, View as |
| `24` to `28` | Phone layouts: About, request form step 3, staff requests, request workspace, owner requests |

## Rules for implementing

- Use "Facilitator" everywhere. Never "Mediator". Statuses: Awaiting assignment, Facilitator assigned, Mediation in progress, Waiting on the veterinarian ("Waiting on the vet" in tight spaces), Completed. Owners see a 4-step tracker: Received, Facilitator assigned, Mediation in progress, Completed.
- Status pill colors: orange = needs staff action, amber = waiting on someone, blue = in progress, green = completed, grey = neutral. The label carries the meaning. Color only supports it.
- Buttons and inputs are square (radius 0). Cards are 6px rounded. Touch targets are at least 44px.
- Every page must work at phone width. Tables become stacked cards on phones (see 26).
- Don't use em dashes in any UI copy.

## Changes that need backend or data work

Confirm each with Tim before building:

1. **Request form in 4 steps** (02, 25). Eligibility becomes yes/no questions. Contact details and Submit move to the last step. Answering "Yes" to legal action, discipline or fees should show a referral instead of continuing.
2. **Duplicate detection** (15, 16, 26). Flag requests from the same owner about the same vet within a short window, and offer "keep one, close others". Also find out why #322 to #324 were created: probably a double submit on the form.
3. **"Next step" for facilitators** (10, 23). Decide whether this is a new field facilitators fill in or something derived from the activity log.
4. **Update types** (12). Each update records a type (Call, Email, Note) and who it was with (Owner, Veterinarian, Other). It can optionally change the status in the same save.
5. **Close request flow** (11). One step that records the owner-visible resolution and sets the status to Completed. Replaces the separate Resolution form.
6. **Owner activity feed** (07). Owners see status changes and contact events, never facilitator notes.
7. **Facilitator suggestions on assign** (17). List active facilitators, fewest open requests first, and email on assign.
8. **Stalled requests** (16). No activity in 90+ days, with "Check in with facilitator" and "Close as stalled" actions.
9. **Facilitators page** (18) should send staff to People and access for region and role edits, not to Airtable.
10. **Letters** (13). "Open in my email" (mailto with To, Subject and body), highlight and count unfilled `{placeholders}`, and "Log as sent".

## Known bugs seen in the current build

- The owner introduction letter fills in a `http://localhost:8892/#/feedback/...` link. The feedback link must use the production URL.
- Mixed "Mediator" and "Facilitator" wording in status names.
- `Priya@Example.org` is stored with capitals. Emails should be lowercased on save, since sign-in matches by email.
