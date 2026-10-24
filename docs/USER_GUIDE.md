# Using Reify

## Capture your intent

Choose To-do list, Flowchart or Rough notes. Type/paste content, upload a PNG/JPEG/WebP, or draw a flowchart. Images are limited to 10 MB and 40 megapixels and prepared safely before inference. On the canvas, connect handles and double-click nodes or edges to edit labels.

Click Understand with Gemma 4. The server interprets your source and validates a draft. **This does not execute actions.**

For example: “Research three laptops for college. Ask my budget and priorities before recommending one. Do not buy anything.” A real local test of this synthetic input returned two tasks and one question. Actual output depends on the input and model.

## Clarify and edit

Review tasks, assumptions and warnings. Questions should cover missing budget, date/time, location, contacts, duration or uncertain arrows. Answer and apply changes; the version changes and approvals are invalidated.

The server requires missing action fields even if Gemma asks nothing: recipients and exact messages, call goals, approved website destinations, owned screenshots, and location/date/duration/capacity for room reservations. Review the actual draft and add any other important constraints before execution.

Select a node to edit its title, prerequisite IDs and exact inputs. Connect handles to add dependencies; select an edge and Delete to remove it. Complete-plan JSON editing supports kinds, conditions, questions and order. The server rejects cycles and dangling references. Visual node positions are not persisted. Material edits after submission require a new workflow.

## Approve and verify

Advance ready tasks runs at most two jobs concurrently. Required clarification, dependencies, provider readiness or missing approval can block tasks. Review the exact current target and payload before approving. Pause stops new claims; an already submitted action may still finish. Deny cancels an unsubmitted approval. Submitted jobs use provider stop requests and reconciliation instead.

General workflows create real Gemma text artifacts or submit gated Twinly jobs. The capability panel explains configuration blockers. Check provider progress to poll existing jobs. Downloads and image/audio previews use your private browser session. A sent message does not establish agreement: only explicit replies matching the approved sender and a timestamp after sending set yes/no facts. Calls and browser submissions require your independent outcome check. An uncertain submission is not automatically retried; inspect the Mac and link its existing job when appropriate.

The separate regression fixture uses fictional inventory and simulated messages. Its portal verifies only local fixture reservations. Fixture controls and simulated replies are unavailable in general workflows.

Saved state reloads in the same browser. New/reset creates a fresh workspace; local development records remain in ignored .data.

## General workflows and current capability

Reify supports the eight documented Twinly API families, subject to provider capabilities and configuration. See [Twinly setup](TWINLY_SETUP.md). Mock checks cover the adapter; real Mac feature verification remains pending with Ajit. Manual tasks can appear without being automatically executable. Reify does not promise every arbitrary request or optional provider field.

The large study-room example panel was intentionally removed from the start screen. Regression tests seed explicit fixtures directly through the API; users enter their own source and use Gemma.
