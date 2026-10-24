"use client";
import { useState } from "react";
import type { Task } from "@/lib/model";
export default function TaskEditor({
  task,
  tasks = [],
  onSave,
  onClose,
}: {
  task: Task;
  tasks?: Task[];
  onSave: (task: Task) => Promise<boolean>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [deps, setDeps] = useState(task.dependsOn.join(", "));
  const [inputs, setInputs] = useState(JSON.stringify(task.inputs, null, 2));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  let fields: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(inputs);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      fields = parsed;
  } catch {
    /* Advanced JSON is validated on save. */
  }
  return (
    <div className="task">
      <h2>Edit step</h2>
      <p className="muted">
        Changes need a fresh review before external actions run.
      </p>
      <label className="field" htmlFor="task-title">
        Task title
      </label>
      <input
        id="task-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {tasks.length > 1 && (
        <fieldset className="dependency-picker">
          <legend>Start after</legend>
          <p className="muted">Choose the steps that must finish first.</p>
          {tasks
            .filter((t) => t.id !== task.id)
            .map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={deps
                    .split(",")
                    .map((x) => x.trim())
                    .includes(t.id)}
                  onChange={(e) => {
                    const current = deps
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean);
                    setDeps(
                      (e.target.checked
                        ? [...new Set([...current, t.id])]
                        : current.filter((id) => id !== t.id)
                      ).join(", "),
                    );
                  }}
                />
                {t.title}
              </label>
            ))}
        </fieldset>
      )}
      {Object.entries(fields)
        .filter(
          ([key, value]) =>
            !["screenshot", "ownedScreen"].includes(key) &&
            ["string", "number", "boolean"].includes(typeof value),
        )
        .map(([key, value]) => (
          <div key={key}>
            <label className="field" htmlFor={`input-${key}`}>
              {key
                .replace(/([A-Z])/g, " $1")
                .replaceAll("_", " ")
                .replace(/^./, (c) => c.toUpperCase())}
            </label>
            {typeof value === "boolean" ? (
              <select
                id={`input-${key}`}
                value={String(value)}
                onChange={(e) =>
                  setInputs(
                    JSON.stringify(
                      { ...fields, [key]: e.target.value === "true" },
                      null,
                      2,
                    ),
                  )
                }
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <textarea
                id={`input-${key}`}
                className="action-field"
                value={String(value)}
                onChange={(e) =>
                  setInputs(
                    JSON.stringify(
                      {
                        ...fields,
                        [key]:
                          typeof value === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                      },
                      null,
                      2,
                    ),
                  )
                }
              />
            )}
          </div>
        ))}
      <details className="advanced-inputs">
        <summary>Advanced settings</summary>
        <label className="field" htmlFor="task-deps">
          Prerequisite IDs
        </label>
        <input
          id="task-deps"
          value={deps}
          onChange={(e) => setDeps(e.target.value)}
        />
        <label className="field" htmlFor="task-inputs">
          Action data (JSON)
        </label>
        <textarea
          id="task-inputs"
          value={inputs}
          onChange={(e) => setInputs(e.target.value)}
        />
      </details>
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
          className="primary"
          disabled={saving}
          onClick={async () => {
            try {
              setSaving(true);
              setError("");
              const saved = await onSave({
                ...task,
                title,
                dependsOn: deps
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                inputs: JSON.parse(inputs),
              });
              if (!saved)
                setError(
                  "Could not save. Check the prerequisites and action fields, then try again.",
                );
            } catch {
              setError("Enter a valid JSON object");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
