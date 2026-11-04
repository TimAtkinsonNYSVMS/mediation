<!-- v01 (2026-11-04) -->
# Phase 0 audit (2026-11-04)

Knack app "NYSVMS Complaints Process" (slug `complaints`, app `5a622d7763fc886409098318`, live at https://nysvms.knack.com/complaints).

## How to read Knack
- Knack SQL is disabled for this app (403 feature_disabled).
- Make subroutine **5021492 "Claude subroutine - Knack Complaints GET (read only)"** (folder 45165, on-demand, connection 2176791) takes `object_id` (and optionally `limit`) and returns every record's raw fields. The large outputs get saved to a file, so parse them with node.
- The raw "Make an API call" module returns a knack.com redirect page with connection 2176791. That's why 5021492 uses Search for Records plus an array aggregator. Its aggregator maps every non-password field by key, so a new Knack field has to be added there before it can be read.
- The public metadata (`GET https://api.knack.com/v1/applications/5a622d7763fc886409098318`, no key needed) gives the pages, views, field options and email rules.

## Volumes
| Knack object | Rows | Notes |
|---|---|---|
| Complaints object_1 | 125 | Numbered #13 to #316, so about 180 numbers are missing (deleted, or test records). New complaints continue at #317. |
| Progress Update object_3 | 453 | 100 in 2024, 82 in 2025, 45 so far in 2026 |
| Accounts object_2 (root user table) | 395 | 388 unique emails, 8 with no email. 350 pet owner, 35 facilitator and 3 admin profiles. Complaint owner links point here (all 119 linked owners). |
| Pet Owner object_9 | 351 | A role table; complaints don't link to it |
| Facilitators object_4 | 34 | 20 active. Region is set on newer rows only. |
| Admin object_6 | 4 | Tim (twice), Katie Smith, Lauren Kleine |

Complaints by year: 2018 5 · 2019 11 · 2020 9 · 2021 26 · 2022 21 · 2023 18 · 2024 17 · 2025 13 · 2026 5 (latest 2026-10-18). The latest progress update is dated 2026-10-30. **The app is in active use.**

Files: 38 complaint uploads, 51 records-release forms and 69 progress-update documents, 158 in all. The 7 feedback forms have ever been filled in.

## Open complaints (9; several look stale)
| # | Received | Status | Facilitator |
|---|---|---|---|
| 210 | 2023-04-17 | Awaiting assignment | – |
| 211 | 2023-04-18 | Awaiting assignment | – |
| 283 | 2024-02-16 | Mediator Assigned | Tim Atkinson |
| 284 | 2024-02-19 | Mediator Assigned | Lauren Kleine |
| 291 | 2024-06-29 | Mediator Assigned | Lauren Kleine |
| 295 | 2024-11-26 | Waiting for owner | Danielle Shemanski |
| 310 | 2025-09-29 | Mediator Assigned | Heather Zaidel |
| 314 | 2026-05-21 | Mediator Assigned | Lauren Kleine |
| 315 | 2026-09-17 | Mediator Assigned | Susan Sickels |

**For Tim:** #210 to #295 are probably finished but were never marked Completed. Close or withdraw them before or after migration. Their status migrates as-is either way.

## Workflows found
- **Knack email rules (5):**
  - New complaint goes to the owner and staff@.
  - Facilitator assigned goes to the facilitator, Katie and Tim.
  - Progress update added goes to Katie and Tim.
  - Status changed goes to staff@ and Tim.
  - Feedback submitted goes to Tim.
- **Draft letters:** Make **2006069 "Create draft email"** (ON, instant webhook, last run 2026-10-26 OK).
  - A Knack progress update with a letter type triggers it.
  - Its router builds one of 7 templates, writes the text back to the update (field_82) and emails it to the facilitator through Mandrill.
  - The 7 templates are now in Airtable **Letter Templates**, with named placeholders. The wording is unchanged. Typos still in them: "eithr", "is on longer involved", "We suggests", "in a timely matter".
  - The Knack feedback links in templates 6 and 7 point at nysvms.knack.com and must become portal links.
- Usage of the draft letters: introduce to vet 29, introduce to owner 21, owner resolution 10, vet resolution 8, fees 4, vet not responding 3, legal 1.
- No custom JavaScript or CSS in Knack.

## Data quality notes
- Veterinarian Email (field_76) is blank on 124 of 125 complaints. Facilitators find vet emails themselves, so the vet letters can't be addressed automatically. The intake form should ask for it (optional), and Novi lookup is a Phase 2 option.
- One complaint has no owner linked.
- About 230 pet-owner accounts never filed a complaint (sign-ups that went no further).
- Feedback ratings in Knack allow half stars. Airtable ratings are whole numbers, so round up.

## Proposed migration scope (Phase 1)
- **People:**
  - Every account linked to a complaint as owner (119), every facilitator (34) and the 3 admins, de-duplicated by email.
  - Accounts that never filed a complaint are **not** migrated. That's less personal data to hold, and they can sign up again.
- **Complaints:** all 125. **Progress updates:** all 453. **Files:** all 158, copied into Airtable attachments by URL.
