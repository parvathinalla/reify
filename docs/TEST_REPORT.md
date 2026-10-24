# Test report — Windows, October 24, 2026

## Environment and phase evidence

Node v24.11.1; npm 11.6.2; Next.js installed from lockfile (16.4.3); Chromium installed by Playwright. Workspace initially contained only TODO.md; authoritative attached spec recovered and saved as docs/BUILD_SPEC.md. No .env.local or Gemini key was present. Official Google Gemma API guide and sponsor Twinly OpenAPI/README were retrieved before adapter implementation. Snapshot: docs/twinly-openapi.yaml.

- Phase 0: PASS — inspected workspace/tools; recovered authoritative build prompt; verified documented Gemma IDs and Twinly methods.
- Phases 1–2: PASS for implementation and mocked contracts — Next full-stack app, typed/photo inputs for three formats, flowchart drawing, canonical schema, real Google SDK code path, task forms and graph edge edits. Actual Gemma inference NOT RUN (no key). Original sample PNGs are typed illustrative assets, not handwriting evidence.
- Phase 3: PASS — deterministic local engine, dependency checks, approval snapshots/digests/versions, conditional yes/no/unknown semantics, pause/denial, submitted-ID deduplication, session isolation, image size/MIME/decoder validation, exact fictional notification with persisted reference.
- Phase 4: PASS — full browser booking journey, API decline/no-room/maybe scenarios, reload persistence, portal confirmation, mobile upload rejection. Screenshots under docs/evidence-desktop.png and docs/evidence-mobile.png.
- Phase 5: NOT RUN live — Twinly adapter has mocked HTTP contract tests only. Mac, key, consent and provider job reconciliation evidence are pending.
- Phase 6: local checks complete; public deployment, video, GitHub publication and Devpost submission NOT RUN.

## Quality commands

| Command | Actual outcome |
|---|---|
| npm install | PASS; lockfile produced; audit reported 0 vulnerabilities |
| npm run lint | PASS after navigation/markup fixes |
| npm run typecheck | PASS; skipLibCheck used for Next's external URLPattern declaration mismatch |
| npm test | PASS: 36 tests across 4 files |
| npm run build | PASS: optimized build and route generation |
| npm run test:e2e | 10 browser/API checks; final run recorded below |
| node --env-file-if-exists=.env.local scripts/check-gemma.cjs | NOT RUN live: GEMINI_API_KEY unavailable |

The SDK contract tests are mock inference. They verify requested model ID, schema validation, server ID mapping, MIME payload and bounded repair; they do not prove model access or handwriting quality. Twinly mocked HTTP tests verify documented message payload, held approval state, offline refusal and 402/403/409/429/503 handling without automatic resend.

## Defects found and corrected

Initial lint rejected raw internal navigation. Browser tests found Next's local origin mismatch (localhost internal URL versus 127.0.0.1 host), repeated approval cards, and graph measurement updates causing invisible nodes/edges. Corrections preserve origin protection, transition approved actions out of the approval prompt, and keep React Flow measurement state synchronized. Full graph visibility is now asserted. Negative tests confirm no booking for declined, unavailable or uncertain conditions.

## Known gaps / not established

- Actual Gemma text/photo inference and generic clarification quality require an API key and real samples. Health intentionally says configured/unverified; a successful workflow has a source-specific Gemma label.
- Twinly is not wired into external mutation routes. Its adapter alone is not a live integration. Real Mac setup/scopes, delivery, reply identity, job reconciliation, provider approvals and cancellation remain unverified.
- Local storage is serialized only within one Node process. No durable production DB adapter or account authentication was implemented. Vercel mutation routes fail closed; the landing page remains a read-only sandbox.
- Bounded scheduling performs up to two tasks per tick; it does not dispatch concurrent external workers. No automatic side-effect retry exists. This is safer than resending an uncertain job.
- Task order/parameters/dependencies are editable; canvas node layout is not persisted. No reliable handwritten source-to-node highlighting was claimed.
- Optional ambiguities can be acknowledged through question answers; automatic date/contact extraction still depends on real model output and human review.
- Screenshot QA covers 1280px desktop and 390px mobile; exhaustive accessibility, screen reader, real photograph and deployed-browser testing remain manual work.
- No external messages, real university reservations, deployed URL, public repository or event eligibility claim has been made.
## Final local verification

Clean `npm ci`: PASS (449 packages installed; audit 0 vulnerabilities). Final suite: lint PASS, typecheck PASS, 36 unit/contract tests PASS, production build PASS, 10 Playwright browser/API tests PASS. Browser assertions include six visible nodes and all five dependency paths, successful exact approvals, persisted portal confirmation and saved-state reload. Final screenshot was visually reviewed after the graph measurement fix. The approval dialog now refreshes the latest task payload before presenting it and handles failed refreshes without replacing workspace state.

No live model call, Twinly action or deployment is included in these PASS results.

UI follow-up: removed the complete study-room example panel from the start screen and expanded the input panel. Browser demo tests now create their labeled fixture through the existing API rather than through the removed example cards. No execution/provider behavior changed.

Gemma live follow-up: a direct text request to gemma-4-26b-a4b-it succeeded with the configured private key. Full parsing failed with the previous settings and generic error. After selecting the documented MINIMAL thinking level, the real /api/parse request for a synthetic college-laptop planning input succeeded in 10.2 seconds, returning 2 tasks and 1 clarification question (mode gemma). No user source, model response text, or key logged. Unit tests: 36 PASS; typecheck PASS. Real image inference is still not established by this check. Added distinct timeout/400/500/503 errors; the precise original provider failure was not retained, so its root cause is not proven.

## Repository and easy-install release

Public source repository created and pushed: https://github.com/parvathinalla/reify (main).
Added cross-platform setup/launch/doctor, detailed installation/user/troubleshooting/roadmap guides, contributor/security docs, GitHub issue/PR templates and Linux/Windows/macOS CI.

Actual local checks: npm run check PASS (lint, typecheck, 36 unit tests, production build); secret scan PASS for publishable files and existing history; private-environment preservation PASS byte-for-byte.
The first browser rerun during a concurrent clean dependency install hit five 30-second scenario timeouts, with five checks passing. These are recorded as a failed run, not passing evidence. A clean-install launcher smoke test and subsequent browser rerun are being completed separately. CI status must be read from actual GitHub runs; no remote PASS is assumed.
No credentials, .env.local, .data or private source uploads were published. The public .env.example was cleared before commit/push.
Final installer evidence: clean Windows clone installed via npm run launch -- --port 3001, created a blank private environment, started successfully and returned HTTP 200. Its doctor check confirmed both provider keys absent and dependencies prepared; its 36 unit tests passed. Existing private-environment preservation was checked separately byte-for-byte. A warmed-server browser rerun with npm run test:e2e -- --timeout=120000 passed all 10 checks (29.8 seconds total; each scenario under 30 seconds).

The first GitHub matrix run failed at npm ci: npm 11.19 detected missing optional @emnapi core/runtime entries from the older Windows-generated lockfile. Regenerated the lockfile with npm 11.19 in a directory without node_modules, then passed npm 11.19 ci --dry-run. Remote rerun results are recorded only after actual completion.
