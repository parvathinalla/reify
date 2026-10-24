# Troubleshooting

Start with npm run doctor. Share safe booleans and non-sensitive errors, never .env.local or private source content.

| Symptom | Action |
|---|---|
| npm/node not recognized | Install Node 24 LTS and reopen the terminal |
| Git not recognized | Install Git or download/extract the repository ZIP |
| Missing package.json | Open a terminal in the project root |
| Install fails | Check npm/network/proxy access; stop other servers in this checkout; npm run setup |
| Page refuses connection | npm run launch; keep terminal open; use http://127.0.0.1:3000 |
| Port 3000 in use | Use the running server or stop it before starting another |
| Old UI | Refresh; stop/relaunch if needed. A saved workflow may have been restored |
| Gemma key missing | Set GEMINI_API_KEY in private .env.local and restart |
| Gemma 401/403 | Check key and project permissions in AI Studio |
| Gemma 404 | Confirm access to an allowlisted Gemma 4 model; no Gemini substitution |
| Gemma 429 | Wait for quota recovery or inspect the project's quota |
| Slow/timeout | Try fewer tasks or a smaller image; transient failures remain possible |
| Invalid image | Valid PNG/JPEG/WebP, under 10 MB and 40 megapixels |
| Invalid workflow twice | Simplify input or clarify arrows; repair is capped at one attempt |
| Missing clarification | Edit and supply the detail; domain-specific completeness remains a known gap |
| Twinly key detected but mock | Expected: key presence does not enable live mutation routes |
| Twinly offline/409 | Mac owner signs in, accepts Terms, enables jobs and keeps app/Mac awake |
| Twinly 402/403 | Check usage and key scopes; follow Mac handoff |
| Twinly 503/uncertain job | Reconcile existing job before resubmitting; it may have executed |
| Stale approval/version | Refresh and review the current exact payload |
| Maybe/silence blocks booking | Expected: unknown is not verified consent |
| Vercel writes blocked | Durable storage is missing; run locally and preserve the guard |
| Another browser cannot see state | Expected session isolation; not an authenticated multi-user service |

## Restart and diagnosis

Press Ctrl+C in the app terminal, then npm run launch. Do not delete .env.local or .data as a generic fix.

npm run check:gemma makes real text/image requests and logs only model/medium/timestamp success metadata. It does not message people or book rooms.

Bug reports should contain OS, Node version, format/medium, non-sensitive error and reproduction using synthetic content. State whether Gemma or a fixture was used. Omit credentials, private photos/contact details and .data.
