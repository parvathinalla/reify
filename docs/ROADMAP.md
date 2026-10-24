# Roadmap and release boundary

Implemented: three input formats, actual Gemma 4 text parsing, validated drafts, questions and edits, exact approvals, a local deterministic engine, controlled portal, simulated replies and persisted verification. See TEST_REPORT for actual results.

## Before general live workflows

1. Enforce completeness for location, date/duration, destination, recipients and resources server-side. Do not rely only on model-generated questions.
2. Verify real photos for all formats and generic clarification revisions, including ambiguous handwriting and arrows.
3. Verify Mac /me readiness, scopes and setup; one benign task and one exact-approved consenting message.
4. Wire live actions with durable submission IDs, job polling/reconciliation, provider approvals and independent evidence.
5. Bind real replies to verified participants. Sent, delivered and agreed are different states.
6. Expand capabilities one verified adapter at a time. A plan node is not automatically executable.

## Before public execution

Transactional durable storage, account ownership, distributed-safe transitions, appropriate rate limiting, retention/deletion and deployment verification. Local files are not Vercel persistence.

A CI file is not a passing run. A configured key is not verified access. Mocked jobs are not live evidence. Preserve the working demo while completing these milestones.
