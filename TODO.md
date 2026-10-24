# Reify — Submission TODO

Working deadline: Sunday, October 25, 2026, 5 PM ET, as stated in the shared planning chat. Confirm against event submission rules.
Source: https://chatgpt.com/share/6adc7d12-4e28-83ea-9042-36dc835f2da7

## Product and acceptance target
Reify turns handwritten to-do lists, flowcharts, and rough notes into understandable, editable workflows. Users resolve ambiguities, review dependencies, approve actions, run tasks through execution adapters, and inspect evidence of results.

Core demo: upload handwritten study-room planning notes → extract tasks → answer missing details → edit dependency graph → approve actions → run workflow → inspect results. Simulated execution must always be labeled. Actual external completion requires real provider evidence.

## P0 — Today on Windows
- [x] Recover the product plan from the shared chat.
- [ ] Create React + TypeScript frontend with Tailwind and React Flow, plus a deployment-compatible backend.
- [ ] Create a polished responsive workspace: input area, clarifications, editable workflow graph, task detail panel, execution history.
- [ ] Support image upload for handwritten lists, flowcharts, and rough notes; include typed text input.
- [ ] Validate file size/type and provide upload preview, replacement, and accessible controls.
- [ ] Verify official Gemma model availability, image support, and API schema before choosing the provider configuration; do not assume the flyer model name is usable.
- [ ] Implement server-side model calls and validated structured task extraction.
- [ ] Preserve original input and associate tasks with source context where available.
- [ ] Detect missing recipients, dates, locations, resources, and ambiguous instructions; ask focused clarification questions.
- [ ] Apply clarification answers to the plan and let users correct extracted tasks.
- [ ] Support editable task nodes and dependencies; reject cycles and invalid references.
- [ ] Define task states: draft, needs clarification, awaiting approval, ready, running, succeeded, failed, blocked, canceled.
- [ ] Implement dependency scheduling, branching semantics, and safe parallel execution.
- [ ] Require approval for external actions and invalidate approval after material edits.
- [ ] Add retry, cancellation, timeouts, duplicate-action protection, and failure propagation.
- [ ] Implement a clearly labeled simulation adapter for the study-room demo.
- [ ] Show activity, results, evidence, and whether each result is simulated or real.
- [ ] Persist workflows with an explicit user/session boundary appropriate to the chosen storage.
- [ ] Add loading, empty, validation, service-unavailable, and recovery states.
- [ ] Keep API secrets server-side; add input limits, request throttling, and privacy-conscious logs.
- [ ] Deploy an initial public HTTPS build early and verify the main workflow.

## P0 — Twinly handoff for Mac teammate
- [ ] Document adapter inputs, outputs, action types, approval snapshot, execution IDs, errors, and evidence format.
- [ ] Implement the Twinly adapter boundary and configuration; leave unavailable actions disabled until connected.
- [ ] Verify official Twinly endpoints, authentication, task lifecycle, and supported actions.
- [ ] Provide .env.example and exact installation/integration instructions.
- [ ] Mac: install Twinly, sign in, redeem GATORHACKVTWINLY, obtain developer API key.
- [ ] Mac: keep Twinly running; test real computer-use execution.
- [ ] Connect the deployed backend to Twinly using its documented architecture; verify connectivity from production.
- [ ] Test one real browser task end to end.
- [ ] Test iMessage with a consenting teammate if required for the final demo.
- [ ] Record actual provider results and evidence; never translate simulated success into real success.
- [ ] Skip voice cloning/calling for initial submission unless all essential work is complete.

## P0 — Release verification
- [ ] Test extraction for all three input formats, including unclear and invalid input.
- [ ] Test clarification updates, graph edits, cycle rejection, approval invalidation, dependency blocking, retries, and duplicate-action prevention.
- [ ] Run typecheck, production build, and focused engine/API tests.
- [ ] Test the deployed core journey on desktop and mobile.
- [ ] Check keyboard access, focus, labels, contrast, and error announcements.
- [ ] Verify no exposed secrets, cross-user workflow access, or unapproved execution.
- [ ] Verify real integration behavior separately from simulation.
- [ ] Document remaining limitations honestly before calling the release production-ready.

## P1 — Public launch and discoverability
- [ ] Deploy to a suitable free hosting tier, subject to its usage and eligibility limits.
- [ ] Add title, description, favicon, social preview, crawlable landing page, robots.txt, and sitemap.
- [ ] Configure Google Search Console and request indexing when account access is available.
- [ ] Use the direct public URL for submission; Google indexing/ranking by the deadline is not guaranteed.

## P0 — Submission, Sunday before 5 PM ET
- [ ] Prepare repository README: setup, architecture, environment variables, deployment, Mac integration, limitations.
- [ ] Choose an open-source license with the team and check dependencies before publishing.
- [ ] Verify prize eligibility against official event rules: Gemma, Twinly, open-source AI.
- [ ] Record a short end-to-end demo with clear simulation/real execution labels.
- [ ] Capture screenshots and prepare Devpost description, deployment URL, and repository URL.
- [ ] Rehearse judging flow and retain a backup demo recording.
- [ ] Freeze features early enough for final verification; target submission by 4 PM ET for a buffer.

## Delivery order
1. Real extraction → clarification → editable graph.
2. Approval and workflow engine → clearly labeled simulation → public deployment.
3. Mac Twinly integration → verified real execution.
4. Reliability/accessibility checks → demo recording → submission.

## Current status
Local Next.js implementation is now present. See docs/TEST_REPORT.md for actual checks and remaining live-provider/deployment work. The shared chat establishes the product workflow and stack, but does not provide a recovered pixel-level visual specification. Use a coherent professional interface consistent with the workflow unless additional design references are provided.

## Local-first general capability milestone
- [x] General workflow scheduler and real Gemma text artifacts; room fixture kept separate.
- [x] Eight documented Twinly API families, configuration status, approval and local job lifecycle.
- [x] Required missing-action fields and recipient/time-bound reply handling.
- [x] Local quality checks: 67 unit tests, 11 browser/API checks and 12 official-mock checks.
- [x] Simple Ajit configuration guide in docs/TWINLY_SETUP.md.
- [ ] Ajit verifies every configured Twinly feature on the real Mac with consenting contacts.
- [ ] Production hosting: durable database, account isolation and distributed execution protections. Local-first is the current authorized target.
