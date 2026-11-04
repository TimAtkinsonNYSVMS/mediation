<!-- v02 (2026-11-04) -->
# Airtable: Complaints Mediation `appUbdZxOQ7WjyOYJ`

Workspace: My First Workspace. Use field IDs, not names. The Knack ID columns hold the source record IDs, so the migration can be rerun safely.

## People `tblMC3vdByJkY9jEC` (replaces Knack Accounts object_2, Pet Owner object_9, Facilitators object_4, Admin object_6)

One row per email address. A person can hold several roles: for example, Katie Smith is Staff and Facilitator.

| Field | ID |
|---|---|
| Email (primary) | `fldvjOpPE8GajiOrx` |
| Name | `fldYjFqomse1p91BB` |
| Phone | `fldvdFwuiAauexiiR` |
| Address | `fldSaGISV1gYGdGxD` |
| Roles (Pet Owner / Facilitator / Staff) | `fldISqQVSu1f3qLnZ` |
| Admin (Admin page; Tim only) | `fldNMO4zYfb6vbk0G` |
| Active (needed for Facilitator and Staff access) | `fldM1SsovNPz8jjSc` |
| Region (12 NYSVMS regions) | `fldXUBbG7YL9cbK0f` |
| Knack IDs (the Knack Facilitators object_4 record ID; owners have none and are matched by email) | `fldJlsqHZyveFk9Wo` |
| Notes | `fldqsQqgaY0guGSUv` |
| Complaints as owner (inverse of Complaints.Owner) | `fld60rxqaSSHJZSBo` |
| Complaints as facilitator (inverse of Complaints.Facilitator) | `fldT3ICxl0U5L0t3e` |
| Progress updates authored (inverse of Progress Updates.Author) | `fldRjRBNQUzmj41k6` |

## Complaints `tbl0FlFU8Xxn5UfK1` (Knack object_1)

| Field | ID | Knack |
|---|---|---|
| Complaint # (primary, number; new = max + 1) | `fldg11sJnOcSL9isq` | field_2 |
| Received | `fldf529tftYjMmXTz` | field_66 |
| Status | `flduLBEGv02ch9cDn` | field_54 (adds "Withdrawn") |
| Owner (link → People) | `fldBXPZ7L6s29trcD` | field_19 |
| Facilitator (link → People) | `fldcuf96LhF1XKlaV` | field_39 |
| Subject | `fldn8dv0UnA0sDLfh` | field_1 |
| Description | `fldioiCzvEYdviMJ9` | field_7 |
| Veterinarian Name | `fldQ1b2UFA3D6mNAI` | field_8 |
| Veterinarian Email | `fldjTlxd3X4FG2uKs` | field_76 |
| Practice Name | `fldus5G7qO3ji0IWa` | field_52 |
| Practice Address | `fldNBq6JPynKKyHqu` | field_53 |
| Attest Vet Is Member | `fldrQoWyAYJAIjIw5` | field_22 |
| Attest No Legal Action | `fldSOmidssLI4qhfF` | field_9 |
| Attest No OPD Complaint | `fld8dwP5IQ83QKMMF` | field_11 |
| Attest Not About Fees | `fldujZaqEFtTSxVuF` | field_65 |
| Attest Understands Service | `fld8fHdDGtVKQJydo` | field_12 |
| Attest Terms and Indemnity | `fld8pkG02efarEZC6` | field_13 |
| Records Permission | `fldHeqnXSU0drmpe7` | field_24 |
| Uploads (attachments) | `fld5c7WytBfZRJdMG` | field_23 |
| Records Release Form (attachments) | `fldPpBXyG3eRyGRi0` | field_25 |
| Resolution | `fldDZZMVNVTayS2dC` | field_63 |
| Resolution Notes | `fldCwzyS6IxW5Wc1G` | field_62 |
| Form Completed By | `fldkFRh6jGXrSV8Hx` | field_86 |
| Feedback Date | `fldW8uipeCU9zBKGo` | field_71 |
| Feedback Overall (1–5) | `fldAK4HIVK3mOAAYs` | field_72 (Knack allowed half stars: round up) |
| Feedback Member Value (1–5) | `fldXs9UGqSVLyuVd8` | field_85 |
| Feedback Facilitator (1–5) | `flddQcVoT2wAhu6ul` | field_73 |
| Feedback Admin Team (1–5) | `fldZ7eJTGBYf38ydY` | field_74 |
| Feedback Comments | `fld9Vnqur9xRama69` | field_75 |
| Knack ID | `fldUCyupEW8d0KPIj` | record id |
| Progress Updates (inverse) | `fldMkDgrqPfO1Omc1` | |

Knack's concatenation fields (owner email, phone and address, and facilitator status and email: field_67, 68, 69, 79 and 80) are not copied. The portal reads them through the links.

## Progress Updates `tblzyvyYFymTo4xR6` (Knack object_3)

| Field | ID | Knack |
|---|---|---|
| Update # (primary, number) | `fld8lFmpecZG7cdaQ` | field_41 |
| Complaint (link) | `fldj3FAAYKeGMKuhG` | field_40 |
| Author (link → People) | `fldvm1aIsRmvMO4EQ` | field_42 "Mediator" |
| Date | `fldIucKCQWOnZp1Bi` | field_27 |
| Notes | `fldm2HjE7PEN3hU0n` | field_43 |
| Documents (attachments) | `fldglDofWQ9vufOCk` | field_44 |
| Letter Type | `fldi7g5q1MalmVyla` | field_81 / field_84 |
| Letter Text | `fldQeNqc0kHjt8Jki` | field_82 |
| Visible to Owner (reserved, unused) | `fldxpgDTTJqplOBC9` | |
| Knack ID | `fldBXhXqXp02JKC3o` | record id |

## Letter Templates `tbloGcnfTRAu5niHD` (7 rows, from Make scenario 2006069)

| Field | ID |
|---|---|
| Letter Type (primary; matches the Progress Updates choice) | `flddS63Z2Z3VePtf6` |
| Recipient (Owner / Veterinarian) | `fldb2G8PeGIWb2asU` |
| Subject | `fldsGhPHEA7ozb2qw` |
| Body | `fldLkj53XhzL9NcLM` |
| Sort Order | `fldcAeqUTpGRiUYBH` |
| Inactive | `fldulDctWvFGvIlkc` |

Placeholders: `{complaint_number}`, `{received_date}`, `{owner_name}`, `{owner_email}`, `{vet_name}`, `{vet_email}`, `{facilitator_name}`, `{subject}`, `{description}`, `{resolution}`, `{uploads_link}`, `{release_form_link}`, `{feedback_link}`. An unknown placeholder must stay visible in the draft, never blank, so the facilitator notices it.

## Sign-in Codes `tblr6tAs6pjmTXVne`

| Field | ID |
|---|---|
| Email (primary) | `fldfLCMzHxh7p2epZ` |
| Code hash (HMAC only) | `fldcmnfwyAK850nLg` |
| Expires | `fldeQ2tPZ8V3HWYBR` |
| Attempts | `fldQSqbcIBd2xNE2k` |
| Used | `fldcd0VMZTV6BPgrw` |
| Created | `fldJzUTiT2ug5sqkc` |
