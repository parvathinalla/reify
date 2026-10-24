"use client";
import { useState } from "react";
import type { Task } from "@/lib/model";
export default function TaskEditor({
  task,
  onSave,
  onClose,
}: {
  task: Task;
  onSave: (task: Task) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [deps, setDeps] = useState(task.dependsOn.join(", "));
  const [inputs, setInputs] = useState(JSON.stringify(task.inputs, null, 2));
  const [error, setError] = useState("");
  return (
    <div className="task">
      <h3>Edit task · {task.id}</h3>
      <label className="field" htmlFor="task-title">
        Task title
      </label>
      <input
        id="task-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label className="field" htmlFor="task-deps">
        Prerequisite IDs (comma separated)
      </label>
      <input
        id="task-deps"
        value={deps}
        onChange={(e) => setDeps(e.target.value)}
      />
      <label className="field" htmlFor="task-inputs">
        Exact action inputs (JSON)
      </label>
      <textarea
        id="task-inputs"
        value={inputs}
        onChange={(e) => setInputs(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <div className="row">
        <button
          onClick={() => {
            try {
              void onSave({
                ...task,
                title,
                dependsOn: deps
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                inputs: JSON.parse(inputs),
              });
            } catch {
              setError("Enter a valid JSON object");
            }
          }}
        >
          Save task & invalidate approvals
        </button>
        <button onClick={onClose}>Close details</button>
      </div>
    </div>
  );
}
