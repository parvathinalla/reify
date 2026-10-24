# Security and privacy

Reify is a local hackathon application, not a production multi-user automation service.

## Keep private

Put provider keys only in `.env.local`. Never use NEXT_PUBLIC variables for credentials. The setup script preserves an existing private environment file and creates a new one with owner-only permissions where the operating system supports it. Windows account permissions still apply.

The development `.data` directory contains workflow text, approval snapshots, session ownership and reservation records. It is ignored by Git and is not encrypted. Do not upload it or use real personal data on a shared computer. Images are sent to Google for actual parsing and are not saved in the workflow store.

`npm run check:secrets` scans publishable files and local Git history for known credential patterns and configured provider key values. It prints file locations only. This is an additional check, not a guarantee that every possible secret is detected. Inspect screenshots and attachments manually too.

## Execution limits

- Provider credentials stay server-side.
- Session ownership and same-origin checks protect local requests; account authentication remains future work.
- Zod schemas, DAG validation, exact approvals and submitted IDs guard the demo scheduler.
- Only the fictional room portal is a supported browser execution target today.
- Twinly live mutation routes are disabled. A key being present does not enable them.
- Vercel writes fail closed because durable production storage is not implemented.

## Reporting a problem

Do not put keys, private screenshots or exploit details into public issues. Use the repository's private vulnerability reporting option if available, or contact the maintainer privately. If a credential was published, revoke it at the provider first; deleting a line from the latest commit does not remove it from Git history.
