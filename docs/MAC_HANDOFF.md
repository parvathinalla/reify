# Mac handoff

Follow [Twinly setup](TWINLY_SETUP.md) for the current step-by-step checklist, feature matrix, permission requirements and verification commands.

Clone https://github.com/parvathinalla/reify, enter the project folder and run `npm run launch` with Node 24 LTS. Keep credentials only in `.env.local`. Start in demo mode. Ajit completes the Twinly Mac setup; the operator explicitly approves the harmless connection check before local live mode is enabled. All eight API families are wired, but each needs real feature verification before claiming it works on the configured Mac.

The local engine persists claims before submission, consumes exact approvals, polls known jobs and blocks automatic resubmission after uncertainty. Sent/delivered/agreed are distinct. Provider completion of calls/browser submissions requires an independent user outcome check. Connection verification is not feature verification.

Run `npm run check`, `npm run test:twinly-mock`, `npx playwright install chromium`, `npm run test:e2e` and `npm run check:secrets`. See TEST_REPORT for checks actually completed. Real photos and Mac feature verification remain separate work. Never substitute Gemini while displaying Gemma.

Public source exists on GitHub. Public live hosting remains disabled until durable storage, authentication and deployment review are implemented. Local files are not a production database.
