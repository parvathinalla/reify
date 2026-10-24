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
      {task.kind === "computer_action" && (
        <>
          <label className="field" htmlFor="owned-screen">
            Owned screenshot (PNG/JPEG/WebP, max 4 MB)
          </label>
          <input
            id="owned-screen"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (
                file.size > 4 * 1024 * 1024 ||
                !["image/png", "image/jpeg", "image/webp"].includes(file.type)
              ) {
                setError("Choose a PNG, JPEG or WebP under 4 MB.");
                return;
              }
              const screenshot = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.readAsDataURL(file);
              });
              try {
                setInputs(
                  JSON.stringify(
                    { ...JSON.parse(inputs), screenshot, ownedScreen: false },
                    null,
                    2,
                  ),
                );
              } catch {
                setError("Fix the input JSON first.");
              }
            }}
          />
          <label className="field">
            <input
              style={{ width: "auto", marginRight: 8 }}
              type="checkbox"
              onChange={(e) => {
                try {
                  setInputs(
                    JSON.stringify(
                      { ...JSON.parse(inputs), ownedScreen: e.target.checked },
                      null,
                      2,
                    ),
                  );
                } catch {
                  setError("Fix the input JSON first.");
                }
              }}
            />
            This is a screen I own or am authorized to use. Only a proposed
            action will be generated.
          </label>
        </>
      )}
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
