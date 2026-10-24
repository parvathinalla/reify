import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@google/genai", () => ({
  ThinkingLevel: { MINIMAL: "minimal" },
  GoogleGenAI: class {
    models = { generateContent: mock.generate };
  },
}));
import { parseGemma, parseInput } from "../lib/gemma";
import { fixture } from "../lib/fixtures";
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  mock.generate.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe("Gemma SDK contract, mocked inference only", () => {
  it.each(["todo", "flowchart", "rough_notes"] as const)(
    "validates %s and uses actual configured Gemma model ID",
    async (format) => {
      mock.generate.mockResolvedValue({
        text: JSON.stringify(fixture(format, "typed")),
      });
      const w = await parseGemma(
        parseInput.parse({ format, medium: "typed", text: "source" }),
      );
      expect(w.tasks[0].id).toBe("task-1");
      expect(w.tasks[3].condition?.facts[0]).toBe("task-1.available");
      expect(mock.generate.mock.calls[0][0].model).toBe("gemma-4-26b-a4b-it");
    },
  );
  it("sends correct image MIME and inline bytes", async () => {
    mock.generate.mockResolvedValue({
      text: JSON.stringify(fixture("todo", "image")),
    });
    await parseGemma(
      parseInput.parse({
        format: "todo",
        medium: "image",
        image: { mime: "image/webp", data: "sample" },
      }),
    );
    expect(mock.generate.mock.calls[0][0].contents[0].parts[1]).toEqual({
      inlineData: { mimeType: "image/webp", data: "sample" },
    });
  });
  it("repairs invalid JSON at most once", async () => {
    mock.generate.mockResolvedValue({ text: "not JSON" });
    await expect(
      parseGemma(
        parseInput.parse({ format: "todo", medium: "typed", text: "source" }),
      ),
    ).rejects.toThrow("twice");
    expect(mock.generate).toHaveBeenCalledTimes(2);
  });
  it("never silently falls back to Gemini", async () => {
    vi.stubEnv("GEMMA_MODEL", "gemini-2.0-flash");
    await expect(
      parseGemma(
        parseInput.parse({ format: "todo", medium: "typed", text: "source" }),
      ),
    ).rejects.toThrow("supported Gemma");
    expect(mock.generate).not.toHaveBeenCalled();
  });
});
