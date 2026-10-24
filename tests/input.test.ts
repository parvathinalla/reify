import { describe, it, expect } from "vitest";
import { validateImage, parseInput } from "../lib/gemma";
import { draftSchema } from "../lib/model";
import { fixture } from "../lib/fixtures";
describe("input boundaries", () => {
  it("rejects mislabeled images", () =>
    expect(() =>
      validateImage({
        mime: "image/png",
        data: Buffer.from("not png").toString("base64"),
      }),
    ).toThrow("MIME"));
  it("rejects oversized images", () =>
    expect(() =>
      validateImage({
        mime: "image/jpeg",
        data: Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64"),
      }),
    ).toThrow("10 MB"));
  it("rejects invalid models and unsafe task kinds at schema boundary", () => {
    const d = fixture("todo", "typed");
    expect(
      draftSchema.safeParse({ ...d, tasks: [{ ...d.tasks[0], kind: "eval" }] })
        .success,
    ).toBe(false);
  });
  it("typed input remains typed", () =>
    expect(
      parseInput.parse({ format: "todo", medium: "typed", text: "hello" })
        .image,
    ).toBeUndefined());
});
