# NYSVMS Mediation portal: design brief and screenshots

Screenshots of every page of the NYSVMS Mediation portal, captured 2026-11-05 for a design review in Claude Design. **All names, requests and emails in them are made up** (test data), so the set can be shared freely.

## What the portal is
NYSVMS (New York State Veterinary Medical Society) runs a free mediation service. A pet owner with a concern about the care given by an NYSVMS member veterinarian requests mediation. A volunteer veterinarian (a **facilitator**) helps the owner understand the treatment and passes their concerns to the vet. It does not handle fees or discipline, and no penalties are imposed.

The portal is at https://nysvms-mediation.netlify.app, moving to mediation.nysvms.org. It replaces an old Knack app.

## Who uses it
| Who | How they sign in | What they see |
|---|---|---|
| **Public** | no sign-in | About, Request mediation form, Sign in |
| **Pet owner** (about 15 a year; often upset, sometimes grieving) | emailed 6-digit code | their own requests: progress steps, facilitator name, resolution, feedback form |
| **Facilitator** (about 20 volunteer vets) | emailed code | requests assigned to them: the owner's account, files, progress timeline, status, resolution, and letter drafts they copy into their own email |
| **Staff** (2 people) | emailed code | every request, assigning facilitators, the facilitator list, letter templates, the Admin page (people and roles), and View as (see the portal as someone else, read-only) |

## Screenshots
Desktop shots are 1280 px wide; phone shots are 390 px wide at 2×. Every shot is the full length of the page.

| File | What it shows |
|---|---|
| 01-public-about.png | Public home (About): what the service does and doesn't do |
| 02-public-request-form.png | Public: Request mediation form (six confirmations, vet details, the request, about you) |
| 03-public-request-received.png | Public: confirmation after submitting a request |
| 04-signin-email.png | Sign in, step 1: enter email |
| 05-signin-code.png | Sign in, step 2: enter the emailed 6-digit code |
| 06-owner-my-requests.png | Pet owner: My requests (progress steps per request) |
| 07-owner-request-in-progress.png | Pet owner: one request in progress (owners don't see progress notes) |
| 08-owner-request-completed.png | Pet owner: completed request with resolution and feedback button |
| 09-owner-feedback-form.png | Pet owner: feedback form (star ratings) |
| 10-facilitator-my-assignments.png | Facilitator: My assignments |
| 11-facilitator-request.png | Facilitator: request page (owner's account, files, progress timeline, people, status, resolution) |
| 12-facilitator-add-update.png | Facilitator: Add an update form open |
| 13-facilitator-draft-letter.png | Facilitator: Draft a letter (template filled in from the request) |
| 14-facilitator-guide.png | Facilitator guide |
| 15-staff-all-requests.png | Staff: All requests (summary cards, filters, table) |
| 16-staff-needs-attention.png | Staff: Needs attention filter |
| 17-staff-request-unassigned.png | Staff: unassigned request with Assign panel |
| 18-staff-facilitators.png | Staff: Facilitators list |
| 19-staff-letter-templates.png | Staff: Letter templates |
| 20-staff-admin.png | Staff: Admin page (people, roles, View as) |
| 21-staff-admin-edit-person.png | Staff: Admin, editing a person's roles |
| 22-staff-admin-add-person.png | Staff: Admin, add a person |
| 23-staff-view-as-facilitator.png | Staff: View as a facilitator (yellow bar, read-only) |
| 24-phone-public-about.png | Phone: public home |
| 25-phone-request-form.png | Phone: Request mediation form |
| 26-phone-staff-all-requests.png | Phone: staff All requests |
| 27-phone-request-page.png | Phone: request page |
| 28-phone-owner-my-requests.png | Phone: pet owner My requests |

## Current design system (shared with the other NYSVMS portals)
- **Colors:**
  - Header bar deep blue `#0A5A85`, accent blue `#0F7BB3`, soft blue `#D6DFEA`, blue wash `#E8F1F8`.
  - Ink `#333333` and `#555555`; light ground `#F6F8F9`; rules `#E4E8EC` and `#C9D2DB`.
  - Status chips: green (done), amber (waiting), red (needs a facilitator), blue (in progress), grey (withdrawn).
  - The View as bar is yellow `#F6D860`.
- **Type:** Roboto 500/700 for headings, labels and buttons; Lato 400/700 for body text. Uppercase eyebrows have wide letter-spacing.
- **Shapes:** square buttons (no radius), 6 px radius on panels and cards, and 1 px light borders instead of shadows.
- **Logo:** the white NYSVMS logo in the header, with "MEDIATION" beside it. The favicon is the animal medallion from the logo.
- **Sister portals with the same look:** the Volunteer Center (volunteers.nysvms.org) and Monthly Statements (statements.nysvms.org).

## Constraints for the redesign
- **Keep:** the NYSVMS brand (logo, blues, Roboto and Lato), plain JavaScript with no framework, and pages that work on a phone. Text needs to be readable by older users (body 16–17 px).
- **Tone:** calm and reassuring for pet owners, who may be grieving. Efficient and scannable for staff and facilitators.
- **The word is "mediation request", not "complaint".** Letters are drafted in the portal but always sent by the facilitator from their own email.
- **Can change:** layout, spacing, hierarchy, card and table styles, the progress-step design, the empty states, and the public home page.
- **Not built yet:** dark mode (the site is light only today).

## Questions for the designer
1. The public home and request form: does it feel welcoming enough for a worried pet owner?
2. The facilitator request page (11): it carries a lot. Is the two-column split right, and should Status and Resolution be combined?
3. Staff All requests (15): are the summary cards worth their space, or should the table come first?
4. The progress steps (06): is the four-step track the clearest way to show where a request stands?
