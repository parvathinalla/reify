import { Draft } from "./model";
export const samples = {
  todo: "Draft a proposal for a campus recycling drive. Ask me about the audience and goal first. Then create a checklist. Do not send or publish anything.",
  flowchart:
    "Read supplied notes → Summarize the main ideas → Draft an email → Request approval before sending.",
  rough_notes:
    "Need a two-week launch plan. Small team. First ask the goal and audience. Turn ideas into milestones, then draft an announcement. Nothing published yet.",
};
export function fixture(
  format: Draft["source"]["format"],
  medium: Draft["source"]["medium"],
): Draft {
  const task = (
    id: string,
    title: string,
    kind: Draft["tasks"][number]["kind"],
    dependsOn: string[],
    inputs: Record<string, unknown> = {},
  ) => ({
    id,
    title,
    description: title,
    kind,
    dependsOn,
    inputs,
    requiresApproval: kind === "send_message" || kind === "browser_task",
    status: "pending" as const,
  });
  return {
    title: "A place to think, together",
    source: { format, medium },
    timezone: "America/New_York",
    summary:
      "Explicit study-room fixture. Research and invitations can run independently. Booking waits for verified yes replies and room availability.",
    tasks: [
      task("room", "Find a quiet study room", "research", [], {
        available: true,
      }),
      task("ravi", "Invite Ravi", "send_message", [], {
        recipient: "demo:Ravi",
        message: "Can you join our study session? Time pending confirmation.",
        awaitReply: true,
      }),
      task("priya", "Invite Priya", "send_message", [], {
        recipient: "demo:Priya",
        message: "Can you join our study session? Time pending confirmation.",
        awaitReply: true,
      }),
      {
        ...task("gate", "Both people agree + room available", "conditional", [
          "room",
          "ravi",
          "priya",
        ]),
        condition: {
          op: "all",
          facts: [
            "room.available",
            "ravi.confirmed_yes",
            "priya.confirmed_yes",
          ],
          branch: "yes",
        },
      },
      task("book", "Reserve Indigo 204", "browser_task", ["gate"], {
        target: "/demo/rooms",
        date: "",
      }),
      task("notify", "Send reservation details", "send_message", ["book"], {
        recipient: "demo:Ravi + demo:Priya",
        message:
          "Your study room reservation is ready; see the controlled portal.",
      }),
    ],
    questions: [
      {
        id: "when",
        taskId: "book",
        question: "Confirm the reservation date and time",
        reason:
          "“Tomorrow” needs an explicit future time with timezone. This updates invitations and reservation.",
        required: true,
      },
    ],
    assumptions: [
      "Fictional room portal and consenting fictional contacts only.",
    ],
    warnings: [
      "Gemma 4 unverified. This fixture does not interpret your source.",
    ],
  };
}
