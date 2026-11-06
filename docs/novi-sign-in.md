# Sign in with an NYSVMS account (Novi) · 2026-11-06

A second way into the mediation portal for facilitators and staff, beside the emailed 6-digit code. Pet owners keep using the code.

## How it works

1. The sign-in page shows **Sign in with your NYSVMS account** only when the Novi client is configured (`GET /api/auth/sso` returns `{ enabled }`).
2. `/api/auth/sso-start` sends the person to `https://members.nysvms.org/oauth/authorize` with a one-time `state`, kept in an httpOnly cookie (`cm_sso_state`, 10 minutes).
3. Novi sends them back to `/api/auth/sso-callback`. The state is checked first; then the code is exchanged for a token (the client secret only ever goes to Novi's token endpoint) and `/oauth/userinfo` gives their email.
4. **Novi only says who the person is.** Whether they may sign in is decided exactly as for the emailed code: `personByEmail()` in `netlify/lib/access.mjs`, from People (active Staff or Facilitator, or someone who owns a request). If the Novi email isn't in People they are sent back with a message to use the emailed code.
5. A successful sign-in sets the same `cm_session` cookie as the code (8 hours).

Code: `netlify/functions/sso.mjs`. Tests: `test/sso.test.mjs` (Novi is faked). Pattern from the Champion portal (`nysvms-practice-renewal`, `sso-start.js` / `sso-callback.js`).

## One-time setup (Tim, in Novi admin and Netlify)

1. In Novi, create a new SSO (OAuth/OpenID) client for the mediation portal:
   - Scopes: `openid email profile`.
   - Redirect URI: `https://nysvms-mediation.netlify.app/api/auth/sso-callback`. When `mediation.nysvms.org` goes live, add `https://mediation.nysvms.org/api/auth/sso-callback` too. It must match `PORTAL_URL` + `/api/auth/sso-callback` exactly.
   - Who may use it: all members (not restricted to staff like the Champion client). The portal decides access from People.
2. In Netlify (site `nysvms-mediation`), add `NOVI_SSO_CLIENT_ID` and `NOVI_SSO_CLIENT_SECRET`, then redeploy (functions only see settings that existed at deploy time).
3. The button appears on the sign-in page once both are set.

## Things to know

- A facilitator whose Novi email differs from their People email will be told their account isn't set up; fix the email in People and access.
- When `PORTAL_URL` changes to `mediation.nysvms.org`, the redirect URI in Novi must include the new address.
