import { Draft } from "./model";
import { requiresActionApproval } from "./capabilities";

// Completeness checks are deterministic; a model cannot waive them.
export function ensureClarifications(d: Draft, sourceText = "") {
  for (const task of d.tasks) {
    task.status = "pending";
    delete task.blockReason;
    task.requiresApproval = requiresActionApproval(task);
    const question = (
      field: string,
      text: string,
      reason: string,
      matching: RegExp,
    ) => {
      const existing = d.questions.find(
        (q) =>
          q.id === `${task.id}-${field}` ||
          ((!q.taskId || q.taskId === task.id) && matching.test(q.question)),
      );
      if (existing) {
        existing.required = true;
        if (existing.answer) delete existing.answer;
        return;
      }
      if (d.questions.length >= 30)
        throw Error(
          "Too many missing details; split this workflow into smaller plans.",
        );
      d.questions.push({
        id: `${task.id}-${field}`,
        taskId: task.id,
        question: text,
        reason,
        required: true,
      });
    };
    if (
      task.kind === "generate_content" &&
      !String(task.inputs.prompt ?? "").trim()
    )
      task.inputs.prompt = task.description || task.title;
    if (["send_message", "read_messages", "call"].includes(task.kind)) {
      if (!String(task.inputs.recipient ?? "").trim())
        question(
          "recipient",
          "Who exactly should receive this message?",
          "A specific recipient must be confirmed before any send.",
          /recipient|who.*receiv|contact|phone|email address/i,
        );
      if (
        task.kind === "send_message" &&
        !String(task.inputs.message ?? "").trim()
      )
        question(
          "message",
          "What exact message should be sent?",
          "Review the complete final message before approval.",
          /exact message|what.*(?:message|text)|wording|text.*send|message.*content/i,
        );
      if (task.kind === "call" && !String(task.inputs.goal ?? "").trim())
        question(
          "goal",
          "What should the AI call accomplish?",
          "The exact call goal must be approved before dialing.",
          /call.*goal|accomplish|purpose/i,
        );
    }
    if (task.kind === "speak" && !String(task.inputs.text ?? "").trim())
      question(
        "text",
        "What exact words should the owner-voice audio say?",
        "Approve the full speech text before synthesis.",
        /words|speech|speak|audio.*say/i,
      );
    if (
      ["generate_image", "twinly_chat", "research", "twinly_task"].includes(
        task.kind,
      ) &&
      !String(task.inputs.prompt ?? "").trim()
    )
      task.inputs.prompt = task.description || task.title;
    if (task.kind === "twinly_task" && !String(task.inputs.app ?? "").trim())
      question(
        "app",
        "Which app should Twinly use?",
        "Mac tasks need an explicit app scope.",
        /which app|application/i,
      );
    if (
      task.kind === "computer_action" &&
      (!task.inputs.screenshot || task.inputs.ownedScreen !== true)
    )
      question(
        "screenshot",
        "Upload a screenshot of a screen you own in the task editor, and confirm ownership.",
        "The computer API proposes a step for an owned screen; it does not control the Mac.",
        /screenshot|screen.*own/i,
      );
    if (task.kind === "browser_task") {
      if (!task.inputs.operation)
        task.inputs.operation = /book|reserv|submit|publish|post\b/i.test(
          `${task.title} ${task.description}`,
        )
          ? "browser_submit"
          : "browser_read";
      if (!String(task.inputs.prompt ?? "").trim())
        task.inputs.prompt = task.description || task.title;
      const target = String(task.inputs.target ?? "");
      if (!/^https:\/\//i.test(target) || !sourceText.includes(target))
        question(
          "target",
          "Which exact website should this action use?",
          "Confirm the permitted destination instead of letting the model invent one.",
          /website|destination|portal|URL/i,
        );
      if (
        /\b(room|library|study)\b/i.test(`${task.title} ${task.description}`) &&
        /book|reserv|schedule/i.test(`${task.title} ${task.description}`)
      ) {
        if (!String(task.inputs.location ?? "").trim())
          question(
            "location",
            "Which library or location should I use (for example, Marston or Library West)?",
            "Room availability and booking rules depend on the selected location.",
            /library|location|venue/i,
          );
        if (
          !/(Z|[+-]\d\d:\d\d)$/.test(String(task.inputs.date ?? "")) ||
          !Number.isFinite(Date.parse(String(task.inputs.date))) ||
          Date.parse(String(task.inputs.date)) <= Date.now()
        )
          question(
            "date",
            "What exact date, start time and timezone should I use?",
            "Relative dates must be resolved before a reservation.",
            /date|start time|timezone/i,
          );
        if (!(Number(task.inputs.durationMinutes) > 0))
          question(
            "duration",
            "How long do you need the room, in minutes?",
            "A start time alone does not define a reservation slot.",
            /duration|how long|minutes/i,
          );
        if (!(Number(task.inputs.peopleCount) > 0))
          question(
            "people",
            "How many people need seats?",
            "The room needs enough capacity.",
            /how many|people|seats|capacity/i,
          );
      }
    }
  }
  return d;
}
