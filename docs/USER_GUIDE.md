# Using Reify

## Capture your intent

Choose To-do list, Flowchart or Rough notes. Type/paste content, upload a PNG/JPEG/WebP, or draw a flowchart. Images are limited to 10 MB and 40 megapixels and prepared safely before inference. On the canvas, connect handles and double-click nodes or edges to edit labels.

Click Understand with Gemma 4. The server interprets your source and validates a draft. **This does not execute actions.**

For example: “Research three laptops for college. Ask my budget and priorities before recommending one. Do not buy anything.” A real local test of this synthetic input returned two tasks and one question. Actual output depends on the input and model.

## Clarify and edit

Review tasks, assumptions and warnings. Questions should cover missing budget, date/time, location, contacts, duration or uncertain arrows. Answer and apply changes; the version changes and approvals are invalidated.

Domain-specific completeness is not guaranteed yet. If a library/location or duration question is missing, supply it through editing before execution. The model must not invent these details.

Select a node to edit its title, prerequisite IDs and exact inputs. Connect handles to add dependencies; select an edge and Delete to remove it. Complete-plan JSON editing supports kinds, conditions, questions and order. The server rejects cycles and dangling references. Visual node positions are not persisted. Material edits after submission require a new workflow.

## Approve and verify

Advance ready tasks runs at most two ready tasks per demo tick. Required clarification, dependencies or missing approval can block tasks. Review the exact current target and payload before approving. Pause stops further advances; Deny cancels a pending approval.

This release uses a clearly labeled demo adapter. Maybe/silence are not agreement. The fictional booking enters verifying; a subsequent request reloads its record and verifies its confirmation reference. The controlled portal shows the same browser session's reservations. Evidence is not proof of real university bookings or messages.

Saved state reloads in the same browser. New/reset creates a fresh workspace; local development records remain in ignored .data.

## General workflows and current capability

Reify's scope is general intent-to-workflow coordination. The current verified execution path is narrower: a controlled room portal and simulated messages. Other Twinly capabilities need adapter-specific execution, scopes, approvals, reconciliation and evidence before being labeled live. Manual tasks can appear without being automatically executable.

The large study-room example panel was intentionally removed from the start screen. Regression tests seed explicit fixtures directly through the API; users enter their own source and use Gemma.
