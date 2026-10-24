# Roadmap and release boundary

Implemented: three input formats, actual Gemma 4 parsing and text generation, general drafts, server completeness questions, exact approvals, local persisted execution, eight official Twinly adapter families, readiness UI, job polling/cancellation/reconciliation and reply identity/time matching. The controlled room fixture remains separate. See TEST_REPORT for actual results and TWINLY_SETUP for Ajit's configuration.

## Before general live workflows

1. Ajit completes Mac permissions, voice/call setup and the explicit harmless connection check.
2. Record live per-feature outcomes using synthetic inputs and consenting recipients. Mock coverage is not sufficient for release claims.
3. Verify real photos for all formats and generic clarification revisions, including ambiguous handwriting and arrows.
4. Test disconnects, Mac approval holds, timeouts, ambiguous replies and reconciliation against the real provider without duplicate submissions.
5. Broaden optional API fields such as attachments/group messages only with validation and evidence.

## Before public execution

Transactional durable storage, account ownership, distributed-safe transitions, appropriate rate limiting, retention/deletion and deployment verification. Local files are not Vercel persistence.

A CI file is not a passing run. A configured key is not verified access. Mocked jobs are not live evidence. Preserve the working demo while completing these milestones.
