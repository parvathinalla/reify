import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
const rates = new Map<string, { count: number; until: number }>();
export function context(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (
    origin &&
    (new URL(origin).host !== req.headers.get("host") ||
      new URL(origin).protocol !== req.nextUrl.protocol)
  )
    throw Error("Cross-origin request denied");
  let owner = req.cookies.get("reify-session")?.value;
  if (!owner || !/^[a-f0-9-]{36}$/.test(owner)) owner = randomUUID();
  const now = Date.now();
  if (rates.size > 10000) rates.clear();
  const r = rates.get(owner);
  if (!r || r.until < now) rates.set(owner, { count: 1, until: now + 60000 });
  else if (++r.count > 120) throw Error("Rate limit: wait one minute");
  return owner;
}
export function respond(data: unknown, owner: string) {
  const r = NextResponse.json(data);
  r.cookies.set("reify-session", owner, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return r;
}
export function failure(e: unknown) {
  const message = e instanceof Error ? e.message : "Request failed";
  return NextResponse.json(
    {
      error: message.includes("ENOENT")
        ? "Workflow not found"
        : message.slice(0, 300),
    },
    { status: 400 },
  );
}
