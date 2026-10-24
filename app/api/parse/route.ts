import { NextRequest } from "next/server";
import { context, failure, respond } from "@/lib/http";
import { parseInput, parseGemma, prepareImage } from "@/lib/gemma";
import { fixture } from "@/lib/fixtures";
import { create } from "@/lib/engine";
import { save, writable } from "@/lib/storage";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const owner = context(req);
    writable();
    if (Number(req.headers.get("content-length") ?? 0) > 14500000)
      throw Error("Request exceeds upload limit");
    const input = parseInput.parse(
      JSON.parse(
        await req.text().then((s) => {
          if (s.length > 14500000) throw Error("Request exceeds upload limit");
          return s;
        }),
      ),
    );
    if (input.medium === "image") {
      if (!input.image) throw Error("Select an image");
      input.image = await prepareImage(input.image);
    } else if (!input.text.trim() && !input.fixture)
      throw Error("Enter text or a canvas graph");
    const draft = input.fixture
      ? fixture(input.format, input.medium)
      : await parseGemma(input);
    const w = create(draft, owner, input.fixture ? "fixture" : "gemma");
    w.sourceText = input.text;
    await save(w);
    return respond(w, owner);
  } catch (e) {
    return failure(e);
  }
}
