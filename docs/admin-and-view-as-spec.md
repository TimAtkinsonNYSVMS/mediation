<!-- v02 (2026-11-04). Status: approved by Tim 2026-11-04. -->
# Spec: Admin people page and "View as"

## Decisions (Tim, 2026-11-04)
1. **Staff** (Tim and Katie) see the Admin page.
2. Staff can **change roles** on the page.
3. View as lasts **2 hours**.
4. Every View as start and stop, and every role change, is recorded in an Airtable **Admin Log** table.

## Goal
Staff can see everyone in the portal and their roles, change those roles, and see the portal exactly as a particular person sees it (a pet owner, a facilitator, another staff member). They can do this to check what that person gets and to answer "I can't see X", without the person's sign-in and without any risk of changing data in their name.

## 1. Admin page (`#/admin`)
- **Who:** anyone whose own session is Staff and Active. The server checks this on every call, and refuses it while viewing as someone.
- **The list:** everyone in People.
  - Each row shows the name, email, role chips (Staff, Facilitator, Pet owner), Active, Region, and open and total requests.
  - "Pet owner" is not a stored role. It means the person is the owner of at least one request.
  - Search by name or email. Filters: Everyone · Staff · Facilitators · Pet owners · Inactive.
- **Changing someone:** **Edit** opens a small form with Staff and Facilitator boxes, Active, Region and Name. Email is not editable, because it is how people sign in.
  - **Safety:** you can't remove your own Staff role or untick your own Active, so nobody can lock themselves out.
- **Adding someone:** **Add a person** takes name, email, roles and region, for example a new facilitator. The email must not already be in People.
- Every save writes an Admin Log row recording what changed, from what, to what, by whom.

## 2. View as
- **Starting:** **View as** on any row of the Admin page.
- **While it's on:**
  - A coloured bar on every page reads "Viewing as Dr. Priya Raman. Changes are switched off.", with a **Stop** button.
  - The header shows the viewed person's role and name, with "(you are Tim Atkinson)".
  - Everything else is the portal exactly as that person gets it.
  - If the person couldn't normally sign in, for example someone who is no longer Active, the view shows what they would see: nothing but the public pages, plus a note.
- **Changes are refused on the server** with "You are viewing as … Stop viewing to make changes." This covers updates, status, resolution, assigning, feedback, uploads, and the Admin page itself. Opening files is allowed, just as that person could.
- **Ending:** Stop, sign-out, or after **2 hours**.
- **Safety:**
  - Your own sign-in never changes. "View as" is a separate signed cookie (`cm_viewas`) holding your People ID, theirs, and an expiry.
  - It's honoured only while your own session belongs to an active Staff member, and only to the person who started it.
- **Record:** each start and stop writes an Admin Log row: who viewed as whom, and when.

## Airtable: Admin Log table
Fields: Summary (primary), Action (View as started / View as stopped / Person changed / Person added), By (link to People), Person (link to People), Details, When (created time).

## Tests
- Facilitators and owners get 403 for the Admin page, role changes and starting a view, even with a forged request.
- Staff can change roles, but can't remove their own Staff or Active. Each change writes an Admin Log row.
- While viewing as a facilitator, only their requests are listed and others are 404. While viewing as an owner, they get the owner view only.
- Every change endpoint returns 403 and writes nothing while viewing. That includes the Admin page.
- The view cookie is ignored for another session, for a non-staff session, and after it expires. Stop and sign-out clear it and log the stop.
