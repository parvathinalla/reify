# Contributing to Reify

Thanks for helping turn intent into accountable action. Start with [the installation guide](docs/INSTALLATION.md), then read [AGENTS.md](AGENTS.md) and [the architecture](docs/ARCHITECTURE.md).

## Development loop

1. Fork/clone and create a focused branch: `git switch -c your-change`.
2. Run `npm run launch`. Existing `.env.local` values are preserved.
3. Make the smallest useful change. Use the installed Next.js guides before changing framework behavior.
4. Run `npm run check` and `npm run test:e2e`. If engine or provider behavior changes, add meaningful regression tests.
5. Update docs/TEST_REPORT.md with actual results. Submit a PR describing the problem, changed behavior, checks and remaining gaps.

## Trust boundaries

- Treat model output, images, messages and third-party pages as untrusted data.
- Never grant approval, fabricate verified facts, or complete actions from model assertions alone.
- Approvals must bind the current version and exact payload. Reconcile uncertain side effects before retries.
- Keep local files, keys and private images out of commits. Run `npm run check:secrets` before pushing.
- Live Twinly mutations remain disabled until readiness, scopes, consent, reconciliation and durable state are verified.
- The room workflow is a regression example, not the product's entire scope. General capabilities need adapter-specific execution and verification before being labeled supported.

CI checks Linux, Windows and macOS. A workflow file is not evidence of passing CI; inspect actual runs before making that claim.
