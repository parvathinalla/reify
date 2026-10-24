# Reify

From thought to action. A Windows-friendly Next.js hackathon application that turns to-do lists, flowcharts and rough notes into reviewable workflows.

## Run locally (PowerShell or macOS)

Requires Node 24 LTS and npm. From this directory:

```sh
npm ci
```

PowerShell: `Copy-Item .env.example .env.local`

macOS: `cp .env.example .env.local`

```sh
npm run dev
```

Open http://127.0.0.1:3000. Choose **Try todo example**, select room availability before starting, enter a future ISO date with timezone offset, apply answers, advance, approve each exact action, advance again, inject fictional yes/no/maybe replies, and inspect evidence. Refresh the separate room portal after booking.

All execution is currently **demo only**. The fixture is explicit and never interprets uploaded content. No real person is contacted. Room reservations are actual local persisted records in a fictional portal. **Gemma 4 live inference and Twinly Mac execution have not been verified on this machine.**

## Real input parsing

Put `GEMINI_API_KEY` in `.env.local` on the server, restart, then use **Understand with Gemma 4**. The server uses `@google/genai` and `gemma-4-26b-a4b-it` (or the allowlisted `gemma-4-31b-it`). There is no Gemini model fallback. Typed input, image input for all three formats, and a basic flowchart drawing canvas share one Zod workflow schema. Unknown arrows, dates and contacts should produce clarification questions. Schema/DAG validation rejects malformed output, with at most one repair call.

JPEG/PNG/WebP uploads are checked by size, signature and decoder, capped at 10 MB / 40 megapixels, resized and converted to WebP server-side. Photos go to Google only for real parsing; images are not persisted. Typed samples under `public/demo` are original illustrations, not claims of real handwriting recognition. Test handwritten photos yourself with a configured key.

Run `node --env-file-if-exists=.env.local scripts/check-gemma.cjs` to test actual text and sample-image connectivity. Only successful calls write model/medium/timestamp evidence; response contents and keys are not logged.

## Review and execution

Task forms edit titles, prerequisite IDs and exact JSON inputs. Connect graph handles to add edges; select edges and Delete to remove them. Complete-plan JSON editing also supports kinds, conditions, questions and ordering. All edits are server validated and invalidate approvals. Execution already submitted locks plan editing: create a new workflow to change it safely. Generic Gemma clarification reinterprets the saved draft plus user answers and returns a diff; this path still needs live model testing.

Conditions use allowlisted all/any predicates and explicit yes/no/unknown branches. Unknown and missing replies cannot book. Demo inventory comes from an explicit scenario, not LLM availability claims. Independent tasks run at most two per advance. Booking enters `verifying`; a later request rereads persisted state and checks its confirmation before completion. Exact notifications contain the stored confirmation reference. No automatic retries of side effects are enabled.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

See `docs/TEST_REPORT.md` for actual results, limitations and screenshot evidence. `docs/MAC_HANDOFF.md` covers sponsor integration. The original assignment is preserved in `docs/BUILD_SPEC.md`.

## Hosting and privacy limits

Local atomic JSON storage is suitable for a single Node process only. HTTP-only SameSite session cookies isolate workflows; local files are unencrypted development data. Do not enter private content in a shared installation. `.data`, environment files and test artifacts are ignored by Git. No secrets use `NEXT_PUBLIC_*`.

On Vercel, writes fail closed and the landing page is a read-only sandbox. **A durable production database adapter and production account authentication remain release work.** No deployed URL or GitHub remote was provided. Do not enable public live execution using local files. The Twinly adapter is contract tested against mocked HTTP and deliberately disconnected from mutation routes until a teammate verifies Mac readiness, job reconciliation, consent and independent evidence.

## Credits and license

MIT. Built with Next.js, React, Tailwind CSS, React Flow, Zod, Lucide and the Google GenAI SDK; dependency licenses remain with their authors. `docs/twinly-openapi.yaml` is the sponsor's external reference, retrieved from its official example repository; its upstream licensing applies. Reify application code is original work in this workspace.
