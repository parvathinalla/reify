import { NextRequest } from "next/server";
import { draftSchema, validate } from "@/lib/model";
import { ensureClarifications } from "@/lib/clarification";
import { create } from "@/lib/engine";
import { save, writable } from "@/lib/storage";
import { context, respond, failure } from "@/lib/http";

// Explicit manually authored plans use the same engine; they are never labeled model-parsed.
export async function POST(req: NextRequest) {
  try {
    const owner = context(req);
    writable();
    const raw = await req.text();
    if (raw.length > 6000000) throw Error("Plan too large");
    const d = validate(
      ensureClarifications(draftSchema.parse(JSON.parse(raw)), raw),
    );
    const w = create(d, owner, "manual");
    await save(w);
    return respond(w, owner);
  } catch (e) {
    return failure(e);
  }
}
