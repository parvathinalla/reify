# Mac handoff — next live milestone

1. Install dependencies from the lockfile. PowerShell: `Copy-Item .env.example .env.local`; macOS: `cp .env.example .env.local`. Run `npm ci`, then `npm run dev`. Both use http://127.0.0.1:3000. Keep Node 24 LTS.
2. Install/open Twinly from https://twinly.tech on Mac, sign in, accept Terms, redeem `GATORHACKVTWINLY` in Account / Developer API, create scoped project key and put it only in server `.env.local`. The voucher is not a key. Enable Mac jobs and keep Mac awake.
3. Visit `/api/twinly/health`. Confirm `online`, per-family `setup`, and `can.mac` scopes. `lib/twinly.ts` implements /me, message, task, job poll and cancellation from the checked-in official OpenAPI. Live mutation routes are intentionally absent. A configured key is not proof of capability.
4. In a local server-only harness, verify one benign /tasks request and its polled job result; then one exact approved message to a consenting teammate. Never paste credentials or real contact details into source/chat. Scope-check endpoint families before enabling them in production. On 503/timeout after submission, reconcile known jobs; never blindly resend. Preserve needs_approval and delivered=null as pending/inconclusive. Do not interpret send success as agreement. Real reply classification/identity binding and independent delivery verification remain to be connected.
5. Wire the adapter to the server engine only after these checks; retain exact payload/version approvals and durable deduplication before any call. Validate a full booking workflow, record safe job IDs/timestamps, update TEST_REPORT and record the honest three-minute demo. Preserve working mock mode if live integration fails.

## Remaining integration work

The Windows build is an end-to-end local **demo**, with a real Gemma parsing code path but no key. Twinly adapter HTTP contract tests pass; actual Mac jobs, readiness scopes, cancellation and real replies are unverified. `EXECUTION_MODE=live` does not turn on external mutations yet. This is deliberate. Add a durable database and account auth before exposing live execution on Vercel.

Gemma test: `node --env-file-if-exists=.env.local scripts/check-gemma.cjs`. Then exercise real handwritten photo + typed paragraph for each format through the UI and record actual model outcomes. Never substitute Gemini under a Gemma badge.

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx playwright install chromium`, `npm run test:e2e`.

The supplied brief says submission is October 25, 2026, 5 PM America/New_York. Reconfirm with organizers; keep at least 90 minutes for video and submission. No deployment, public repository, or submission was made by this implementation.
