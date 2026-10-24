# Twinly setup for Ajit

Reify runs locally on Windows; Twinly runs on Ajit's Mac. Keep the Mac awake and online. Never send API keys in chat or commit them.

1. Install/open Twinly on the Mac, sign in, create its API key and select the feature scopes needed. Use the official Twinly instructions and the checked-in `twinly-openapi.yaml` for API details.
2. Finish permissions in Twinly. Messages and reading chats need Full Disk Access and an app restart. On-screen tasks need Screen Recording and Accessibility. Calls need the documented BlackHole 2ch/Google Voice in Chrome setup and a voice profile. Voice generation needs recorded clips and a built voice clone.
3. On the machine running Reify, open `.env.local` and set `TWINLY_API_KEY`. Leave `EXECUTION_MODE=demo` initially. Restart Reify with `npm run launch`.
4. Run `npm run twinly:verify -- --status`. This reads readiness only. Reify also shows per-feature readiness in its UI.
5. Run `npm run twinly:verify` from an interactive terminal. Read the fixed harmless connection-check prompt and type `VERIFY` to authorize it. It submits one Mac task, preserves its job reference and polls that same job. Approve on the Mac if Twinly asks. It sends no messages and makes no calls.
6. Only after that check returns the expected structured result, the utility writes `TWINLY_VERIFICATION_JOB_ID` and switches the local configuration to live. Restart Reify. This proves the connection, not every feature.
7. Add only consenting test recipients to `TWINLY_ALLOWED_CONTACTS` in `.env.local` (comma-separated exact phone numbers with country codes or email addresses). Add exact approved website hostnames to `TWINLY_ALLOWED_DOMAINS` for browser actions. Keep these values private. Restart after changes.
8. Test each feature independently with synthetic inputs and consenting recipients. Review exact parameters in Reify, approve, check progress, and inspect the real outcome. Record evidence before declaring a feature live-verified.

If the verification submission times out, inspect the Mac queue and use `npm run twinly:verify -- --job=<existing UUID>` to reconcile it. Do not blindly submit again. In Reify, an uncertain action can link an existing Mac job after you check its action and recipient; the server also checks job kind/time. Stop requests do not recall already completed actions.

## Implemented feature families

| Request | Reify task | Execution/result |
|---|---|---|
| Web research or work in a Mac app | research / twinly_task / browser_task | Bounded `/tasks` job; reported output; browser submissions require independent outcome confirmation |
| Send an iMessage | send_message | Exact consenting recipient/text; delivery separate from agreement |
| Read a chat | read_messages | Only the configured approved recipient; bounded message count |
| AI voice call | call | Exact consenting recipient/goal; provider result followed by independent outcome check |
| Create owner-voice audio | speak | Private downloadable audio artifact |
| Generate an image | generate_image | Private image artifact |
| Twinly AI response | twinly_chat | Saved text artifact |
| Screenshot reasoning | computer_action | Owned screenshot and proposed next action; no automatic screen click |

These are the eight documented API families, not a promise of every optional parameter or arbitrary action. Attachment/group-message configuration is not exposed. Payments, deletion, secret extraction and bypassing authentication/CAPTCHA are excluded from the Mac task prompt. Provider scopes, permissions, consent policy, connection verification and exact current approval must all pass. All eight families currently have mock contract evidence; live feature verification remains Ajit's task.

## Local reliability and hosting boundary

Jobs and consumed approvals are saved before submission, repeated Advance clicks do not resubmit, and uncertain results require reconciliation. Concurrent work is bounded; result artifacts and evidence persist locally. Reify uses atomic single-process files, not a production multi-instance database. Keep it on loopback for the local handoff. Vercel writes remain disabled until account isolation, durable database/execution leases, rate limits and a deployment review are implemented.

## Repeatable checks

`npm run test:twinly-mock` runs the real adapter against the pinned official Twinly examples mock at commit `3c059afda3d9f46b2960e26ec18754bbb0e08254`. The harness downloads source/fixtures into ignored `.data`, starts localhost only and prevents adapter requests from reaching a real provider. Its explicit test-only `/me` readiness augmentation supplies setup fields missing in that older mock; production never assumes missing permission fields are ready.

Run `npm run check`, `npx playwright install chromium`, `npm run test:e2e`, and `npm run check:secrets` for the application checks. Mock results are not live integration evidence.
