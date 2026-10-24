import type { Task } from "./model";
import { featureForTask } from "./twinly-actions";
import { featureDefinitions } from "./twinly-contract";
import type { FeatureStatus } from "./twinly-readiness";
export const externalKinds = [
  "research",
  "send_message",
  "browser_task",
  "twinly_task",
  "read_messages",
  "call",
  "speak",
  "generate_image",
  "twinly_chat",
  "computer_action",
] as const;
export function requiresActionApproval(task: Task, fixture = false) {
  return fixture
    ? ["send_message", "browser_task"].includes(task.kind)
    : (externalKinds as readonly string[]).includes(task.kind);
}
export function capabilityFor(
  task: Task,
  hasGemmaKey: boolean,
  features?: FeatureStatus[],
) {
  if (task.kind === "generate_content")
    return {
      provider: "gemma" as const,
      ready: hasGemmaKey,
      reason: hasGemmaKey
        ? "Generate and save a draft, summary, plan or other text."
        : "Add GEMINI_API_KEY to the private server environment to generate content.",
    };
  if (task.kind === "conditional")
    return {
      provider: "local" as const,
      ready: true,
      reason: "Evaluate verified observations only.",
    };
  if (task.kind === "manual")
    return {
      provider: "manual" as const,
      ready: false,
      reason:
        "This step needs a person or an action adapter that is not connected yet.",
    };
  const feature = featureForTask(task);
  const state = features?.find((f) => f.id === feature);
  return {
    provider: "twinly" as const,
    ready: state?.ready ?? false,
    reason:
      state?.reason ??
      (process.env.TWINLY_API_KEY
        ? "Twinly key configured. Live execution still needs feature permissions and npm run twinly:verify; this task will not be simulated."
        : "Connect Twinly and verify its Mac permissions before this action can run."),
  };
}
export function capabilities(features?: FeatureStatus[]) {
  return [
    {
      id: "content",
      title: "Draft, summarize, explain and organize",
      ...capabilityFor(
        { kind: "generate_content" } as Task,
        !!process.env.GEMINI_API_KEY,
      ),
    },
    ...(features ??
      Object.entries(featureDefinitions).map(([id, d]) => ({
        id,
        title: d.title,
        provider: "twinly",
        ready: false,
        reason: "Check Twinly configuration and verification.",
      }))),
  ];
}
