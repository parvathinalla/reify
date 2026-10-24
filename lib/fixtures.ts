import { Draft } from "./model";
export const samples = {
  todo: "Find a study room tomorrow. Ask Ravi and Priya if they can join at 4 PM. If both agree and a room is available, book it and send details.",
  flowchart:
    "Find room → Ask Ravi + Ask Priya → IF both yes AND room available → Book → Send details. ELSE stop.",
  rough_notes:
    "Study session? Tomorrow 4pm. Ravi, Priya. Need a quiet room. Only reserve if both say yes. Send confirmation after booking.",
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
