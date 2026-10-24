# Reify project conventions

Use Node 24 LTS and npm with package-lock.json. Preserve TODO.md and docs/BUILD_SPEC.md. Run npm ci, npm run lint, npm run typecheck, npm test, npm run build; browser checks: npx playwright install chromium, npm run test:e2e.

The application root is this directory. Dev URL: http://127.0.0.1:3000. App Router handlers run on Node. Secrets stay in .env.local, never NEXT_PUBLIC variables. Do not log private inputs, response transcripts or keys.

Schema/validation: lib/model.ts. Deterministic engine: lib/engine.ts. Atomic single-process development storage: lib/storage.ts. Real model path: lib/gemma.ts. Twinly adapter: lib/twinly.ts with official reference docs/twinly-openapi.yaml. Never invent endpoints or switch to Gemini while claiming Gemma.

Preserve clear fixture/demo/live distinctions. The live Twinly mutation path is disabled until Mac verification, job reconciliation, consent and durable execution state are implemented. Do not bypass Vercel storage guard. Do not claim tests/integrations not run. Update docs/TEST_REPORT.md after material changes. Images in public/demo are original typed samples, not handwriting evidence.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
