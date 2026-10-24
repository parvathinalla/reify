import { promises as fs } from "node:fs";
import path from "node:path";
import { Workflow } from "./model";
const directory = path.join(process.cwd(), ".data");
let queue: Promise<unknown> = Promise.resolve();
export function writable() {
  if (process.env.VERCEL)
    throw Error(
      "Public sandbox: durable storage is not configured. Run locally to execute.",
    );
}
export async function transact<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation);
  queue = next.catch(() => {});
  return next;
}
export async function save(w: Workflow) {
  writable();
  await fs.mkdir(directory, { recursive: true });
  const target = path.join(directory, `${w.id}.json`);
  await fs.writeFile(`${target}.tmp`, JSON.stringify(w));
  await fs.rename(`${target}.tmp`, target);
}
export async function load(id: string, owner: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("Workflow not found");
  const w = JSON.parse(
    await fs.readFile(path.join(directory, `${id}.json`), "utf8"),
  ) as Workflow;
  if (w.owner !== owner) throw Error("Workflow not found");
  return w;
}
