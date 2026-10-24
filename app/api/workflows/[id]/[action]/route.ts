import { NextRequest } from "next/server";
import { z } from "zod";
import { context, respond, failure } from "@/lib/http";
import { load, save, transact, writable } from "@/lib/storage";
import {
  advance,
  verify,
  approve,
  digest,
  edit,
  reply,
  log,
} from "@/lib/engine";
import { parseGemma } from "@/lib/gemma";
import { draftSchema } from "@/lib/model";
export const runtime = "nodejs";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  try {
    const owner = context(req);
    const { id } = await params;
    const w = await load(id, owner);
    return respond(
      {
        ...w,
        digests: Object.fromEntries(w.tasks.map((t) => [t.id, digest(t)])),
      },
      owner,
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  try {
    const owner = context(req);
    writable();
    const { id, action } = await params;
    const raw = await req.text();
    if (raw.length > 1000000) throw Error("Request too large");
    const b = JSON.parse(raw);
    return await transact(async () => {
      const w = await load(id, owner);
      if (b.version !== w.version)
        throw Error("Stale workflow version. Refresh and review.");
      if (action === "advance") {
        verify(w);
        advance(w);
      } else if (action === "approve") {
        approve(
          w,
          z.string().parse(b.taskId),
          w.version,
          z.string().parse(b.digest),
        );
      } else if (action === "edit") {
        edit(w, draftSchema.parse(b.draft));
      } else if (action === "clarify") {
        const answers = z
          .record(z.string(), z.string().min(1).max(1000))
          .parse(b.answers);
        if (w.submitted.length)
          throw Error("Reset before clarifying an executed plan");
        if (w.mode === "gemma") {
          const before = w.tasks;
          const revised = await parseGemma({
            format: w.source.format,
            medium: w.source.medium,
            fixture: false,
            text: `Revise this established draft using ONLY the user's clarification answers. Preserve all other details, tasks, recipients, and dependencies. Keep resolved question answers. Current draft: ${JSON.stringify({ title: w.title, summary: w.summary, tasks: w.tasks, questions: w.questions, assumptions: w.assumptions, warnings: w.warnings, source: w.source, timezone: w.timezone })} Answers: ${JSON.stringify(answers)}`,
          });
          edit(w, revised);
          const changed = w.tasks
            .filter(
              (t) =>
                JSON.stringify(t) !==
                JSON.stringify(before.find((b) => b.id === t.id)),
            )
            .map((t) => t.id);
          const added = w.tasks
            .filter((t) => !before.some((b) => b.id === t.id))
            .map((t) => t.id);
          const removed = before
            .filter((t) => !w.tasks.some((n) => n.id === t.id))
            .map((t) => t.id);
          await save(w);
          return respond(
            {
              ...w,
              diff: { changed, added, removed, approvalsInvalidated: true },
            },
            owner,
          );
        }
        const changed: string[] = [];
        for (const q of w.questions)
          if (answers[q.id]) {
            q.answer = answers[q.id];
            if (q.id === "when" && w.mode === "fixture") {
              const value = q.answer;
              if (
                !Number.isFinite(Date.parse(value)) ||
                !/(Z|[+-]\d\d:\d\d)$/.test(value) ||
                Date.parse(value) <= Date.now()
              )
                throw Error(
                  "Enter a future ISO time with offset, e.g. 2026-10-25T16:00:00-04:00",
                );
              const book = w.tasks.find((t) => t.id === "book")!;
              book.inputs.date = value;
              changed.push(book.id);
              for (const t of w.tasks.filter((t) => t.inputs.awaitReply)) {
                t.inputs.message = `Can you join our study session at ${value}?`;
                changed.push(t.id);
              }
            } else if (q.taskId) {
              const t = w.tasks.find((t) => t.id === q.taskId)!;
              t.inputs[`clarification_${q.id}`] = q.answer;
              changed.push(t.id);
            }
          }
        if (w.submitted.length)
          throw Error(
            "Resolve clarification before execution; reset to change an executed plan",
          );
        w.version++;
        w.approvals = {};
        log(w, "Clarifications applied; review changed task parameters");
        await save(w);
        return respond(
          { ...w, diff: { changed, approvalsInvalidated: true } },
          owner,
        );
      } else if (action === "reply") {
        reply(
          w,
          z.string().parse(b.taskId),
          z.enum(["yes", "no", "maybe", "silence"]).parse(b.value),
        );
      } else if (action === "scenario") {
        if (w.audit.length)
          throw Error(
            "Choose scenario before starting; reset for a new scenario",
          );
        w.demoScenario = z.enum(["happy", "no_room"]).parse(b.scenario);
        w.version++;
        w.approvals = {};
      } else if (action === "pause") {
        w.paused = !w.paused;
        log(w, w.paused ? "Paused" : "Resumed");
      } else if (action === "deny") {
        const t = w.tasks.find((t) => t.id === b.taskId);
        if (!t || t.status !== "awaiting_approval")
          throw Error("Only a pending approval can be denied");
        t.status = "cancelled";
        delete w.approvals[t.id];
        log(w, "User denied action", t.id);
      } else throw Error("Unknown action");
      await save(w);
      return respond(w, owner);
    });
  } catch (e) {
    return failure(e);
  }
}
