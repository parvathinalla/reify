# Install Reify

Install [Node.js 24 LTS](https://nodejs.org/) (includes npm) and [Git](https://git-scm.com/downloads). Reopen your terminal, then run the same commands on Windows, macOS or Linux:

```sh
git clone https://github.com/parvathinalla/reify.git
cd reify
npm run launch
```

Open **http://127.0.0.1:3000** and keep the terminal open. Press Ctrl+C to stop. No WSL, Python, global npm packages or database is required.

If another app uses port 3000, run `npm run launch -- --port 3001` and open http://127.0.0.1:3001 instead.

Alternatively, download GitHub's ZIP, extract it, open a terminal in the folder containing package.json, and run `npm run launch`.

## What launch does

The first launch installs exact lockfile dependencies with npm ci, creates a private .env.local if missing, and starts Next.js. Later launches reuse dependencies until the lockfile changes. Existing private settings are never overwritten. No provider actions happen during setup.

The first install can take several minutes depending on your network and disk speed, especially on Windows. Later launches skip installation when the lockfile is unchanged.

## Add Gemma access

Open .env.local and replace only the empty GEMINI_API_KEY value with your own key from [Google AI Studio](https://aistudio.google.com/apikey). Leave GEMMA_MODEL as gemma-4-26b-a4b-it. Save, stop the server, and run npm run launch again.

Put credentials in .env.local, never .env.example, GitHub, chat or screenshots. A configured key still needs model access/quota. `npm run check:gemma` performs actual text/image requests and can consume provider quota. Without a key, the UI and deterministic fixture tests remain usable; interpretation of your own content requires model access.

## Twinly on a Mac

Follow [Twinly setup](TWINLY_SETUP.md). Put the scoped key only in .env.local. Start with EXECUTION_MODE=demo. Live execution requires the explicit Mac connection check, current feature permissions, exact approvals and any required consenting-contact/website policies. Key presence alone does not enable it. Keep this setup local while Ajit completes live feature verification.

## Commands

| Command | Purpose |
|---|---|
| npm run launch | Setup if needed and start locally |
| npm run setup | Reinstall exact dependencies, preserve private settings |
| npm run doctor | Safe configuration booleans, no keys or provider calls |
| npm run dev | Developer startup after installation |
| npm run check | Lint, typecheck, unit tests and production build |
| npm run check:secrets | Check publishable files and local Git history |
| npm run check:gemma | Real text/image model connectivity |
| npm run test:e2e | Fixture-based browser/API verification |

Install Chromium once before browser tests: `npx playwright install chromium`. On Linux, missing system dependencies can be installed with `npx playwright install --with-deps chromium` using the permissions required by your OS.

## Updates and production build

Stop the app before updating. Commit/stash your changes, run git pull, then npm run launch. Ignored .env.local and .data are preserved.

For a local production build, run npm run build, then npm start. Local persistence is single-process only. Vercel writes fail closed until durable production storage and account authentication are implemented; do not bypass that guard.

See [Troubleshooting](TROUBLESHOOTING.md) for common failures.
