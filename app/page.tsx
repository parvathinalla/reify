"use client";
import CapabilityStatus, {
  type Capability,
} from "@/components/capability-status";
import WorkflowGraph from "@/components/workflow-graph";
import TaskEditor from "@/components/task-editor";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Workflow as WorkflowIcon,
  ListTodo,
  FilePenLine,
  ShieldCheck,
  ArrowRight,
  SlidersHorizontal,
  CheckCircle2,
  Circle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { Draft, Workflow, Task } from "@/lib/model";
import { samples } from "@/lib/fixtures";
type ViewWorkflow = Workflow & { digests?: Record<string, string> };
const initialNodes: Node[] = [
  { id: "a", position: { x: 20, y: 20 }, data: { label: "Read source notes" } },
  {
    id: "b",
    position: { x: 260, y: 20 },
    data: { label: "Create a draft" },
  },
  {
    id: "c",
    position: { x: 500, y: 20 },
    data: { label: "Review before sending" },
  },
];
export default function Home() {
  const [view, setView] = useState<"plan" | "map" | "results" | "details">(
    "plan",
  );
  const [connections, setConnections] = useState(false);
  const [format, setFormat] = useState<Draft["source"]["format"]>("todo");
  const [medium, setMedium] = useState<Draft["source"]["medium"]>("typed");
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ mime: string; data: string } | null>(
    null,
  );
  const [preview, setPreview] = useState("");
  const [health, setHealth] = useState<{
    gemmaConfigured: boolean;
    persistence: string;
    capabilities: Capability[];
    twinlyLive: boolean;
  }>();
  const [w, setW] = useState<ViewWorkflow>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [editJson, setEditJson] = useState("");
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Task>();
  const [approval, setApproval] = useState<Task>();
  const dialog = useRef<HTMLDialogElement>(null);
  const connectionsDialog = useRef<HTMLDialogElement>(null);
  const editorDialog = useRef<HTMLDialogElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([
    { id: "a-b", source: "a", target: "b", label: "next" },
    { id: "b-c", source: "b", target: "c", label: "YES" },
  ]);
  const onConnect = useCallback(
    (c: Connection) => setEdges((e) => addEdge(c, e)),
    [setEdges],
  );
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth);
    const id = localStorage.getItem("reify-id");
    if (id)
      fetch(`/api/workflows/${id}/status`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.error && Array.isArray(d.tasks)) setW(d);
        });
  }, []);
  useEffect(() => {
    if (approval) dialog.current?.showModal();
  }, [approval]);
  useEffect(() => {
    if (!connections) return;
    const trigger = document.activeElement as HTMLElement | null;
    connectionsDialog.current?.showModal();
    return () => trigger?.focus();
  }, [connections]);
  useEffect(() => {
    if (!selected) return;
    const trigger = document.activeElement as HTMLElement | null;
    editorDialog.current?.showModal();
    return () => trigger?.focus();
  }, [selected]);
  async function request(url: string, data: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (!Array.isArray(d.tasks)) throw Error("Invalid workflow response");
      setW(d);
      localStorage.setItem("reify-id", d.id);
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  async function action(name: string, data: Record<string, unknown> = {}) {
    if (!w) return;
    const result = await request(`/api/workflows/${w.id}/${name}`, {
      version: w.version,
      ...data,
    });
    if (result) {
      const fresh = await fetch(`/api/workflows/${w.id}/status`).then((r) =>
        r.json(),
      );
      if (!fresh.error && Array.isArray(fresh.tasks)) setW(fresh);
    }
    return result;
  }
  async function parse(fixture = false) {
    await request("/api/parse", {
      format,
      medium,
      fixture,
      text:
        medium === "canvas"
          ? JSON.stringify({
              nodes: nodes.map((n) => ({ id: n.id, label: n.data.label })),
              edges: edges.map((e) => ({
                from: e.source,
                to: e.target,
                label: e.label,
              })),
            })
          : text,
      ...(image ? { image } : {}),
    });
  }
  async function upload(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError("Choose a PNG, JPEG, or WebP up to 10 MB");
      return;
    }
    const data = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(file);
    });
    setImage({ mime: file.type, data: data.split(",")[1] });
    setPreview(data);
  }
  return (
    <>
      <header>
        <div className="brand">
          <span className="mark">R</span>REIFY
        </div>
        <div className="row header-actions">
          <span className="local-label">
            <span className="connection-dot" /> Personal workspace
          </span>
          <button className="quiet" onClick={() => setConnections(true)}>
            <SlidersHorizontal size={16} /> Connections
          </button>
        </div>
      </header>
      <main>
        {!w && (
          <div className="hero">
            <div className="eyebrow">
              A little less planning. A little more done.
            </div>
            <h1>
              What would you like <br className="hero-break" />
              <span>to get done?</span>
            </h1>
            <p>Add your notes. Review the plan. Approve external actions.</p>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!w ? (
          <div>
            <section className="panel composer">
              <h2>Start with what you have.</h2>
              <div className="tabs">
                {(
                  [
                    ["todo", "To-do list", ListTodo],
                    ["flowchart", "Flowchart", WorkflowIcon],
                    ["rough_notes", "Rough notes", FilePenLine],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    className={format === id ? "active" : ""}
                    onClick={() => {
                      setFormat(id);
                      setMedium("typed");
                      setText("");
                    }}
                  >
                    <Icon
                      size={17}
                      style={{ display: "inline", marginRight: 6 }}
                    />
                    {label}
                  </button>
                ))}
              </div>
              <label className="field" htmlFor="medium">
                Input medium
              </label>
              <select
                id="medium"
                value={medium}
                onChange={(e) => setMedium(e.target.value as typeof medium)}
              >
                <option value="typed">Type or paste</option>
                <option value="image">Upload an image</option>
                {format === "flowchart" && (
                  <option value="canvas">Draw a flowchart</option>
                )}
              </select>
              {medium === "image" ? (
                <div
                  className="drop"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void upload(e.dataTransfer.files[0]);
                  }}
                >
                  <label htmlFor="upload">
                    Drop your notes here, or choose a photo
                    <br />
                    <span className="muted">
                      PNG, JPEG, WebP · maximum 10 MB
                    </span>
                  </label>
                  <input
                    id="upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                  {preview && (
                    <Image
                      unoptimized
                      width={600}
                      height={190}
                      className="sourceImage"
                      src={preview}
                      alt="Selected source preview"
                    />
                  )}
                </div>
              ) : medium === "canvas" ? (
                <>
                  <div className="row" style={{ marginTop: 16 }}>
                    <button
                      onClick={() =>
                        setNodes((n) => [
                          ...n,
                          {
                            id: crypto.randomUUID(),
                            position: { x: 100, y: n.length * 60 },
                            data: {
                              label: window.prompt("Node label") || "Step",
                            },
                          },
                        ])
                      }
                    >
                      + Node
                    </button>
                    <span className="muted">
                      Drag handles to connect; click a node to rename. Select an
                      edge and Delete to remove.
                    </span>
                  </div>
                  <div className="canvas-preview">
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      onNodeDoubleClick={(_, n) => {
                        const label = window.prompt(
                          "Node label",
                          String(n.data.label),
                        );
                        if (label)
                          setNodes((ns) =>
                            ns.map((x) =>
                              x.id === n.id ? { ...x, data: { label } } : x,
                            ),
                          );
                      }}
                      onEdgeDoubleClick={(_, e) => {
                        const label = window.prompt(
                          "Branch label (YES / NO / UNKNOWN)",
                          String(e.label ?? ""),
                        );
                        if (label)
                          setEdges((es) =>
                            es.map((x) =>
                              x.id === e.id ? { ...x, label } : x,
                            ),
                          );
                      }}
                      fitView
                    >
                      <Controls />
                    </ReactFlow>
                  </div>
                </>
              ) : (
                <>
                  <label className="field" htmlFor="intent">
                    Your {format.replace("_", " ")}
                  </label>
                  <textarea
                    id="intent"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={samples[format]}
                  />
                </>
              )}
              <div className="row" style={{ marginTop: 18 }}>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void parse()}
                >
                  <Sparkles size={15} style={{ display: "inline" }} />{" "}
                  {busy ? "Creating your plan…" : "Create my plan"}
                </button>
                <button
                  className="quiet"
                  onClick={() => setText(samples[format])}
                >
                  Insert example text
                </button>
              </div>
              <p className="muted">
                Powered by Gemma 4. Your input is sent to Google when you create
                a plan. Images are not saved to disk.
              </p>
            </section>
          </div>
        ) : (
          <>
            <div className="workspace-heading">
              <div className="workspace-title">
                <div className="eyebrow">
                  {w.mode === "fixture" ? "Demo workspace" : "Your workspace"}{" "}
                  <span className="version-label"> / Version {w.version}</span>
                </div>
                <h1>{w.title}</h1>
                <p>{w.summary}</p>
              </div>
              <button
                className="quiet"
                onClick={() => {
                  setW(undefined);
                  localStorage.removeItem("reify-id");
                  setSelected(undefined);
                  setAnswers({});
                  setView("plan");
                }}
              >
                + New workflow
              </button>
            </div>
            <div className="workspace-meta">
              <span>
                <CheckCircle2 size={15} />{" "}
                {w.tasks.filter((t) => t.status === "completed").length}{" "}
                completed
              </span>
              <span>{w.tasks.length} steps</span>
              {w.mode === "fixture" && (
                <span className="demo-label">Simulated actions</span>
              )}
              <span className="approval-note">
                <ShieldCheck size={14} /> You approve external actions
              </span>
            </div>
            <nav className="workspace-tabs" aria-label="Workflow views">
              {(
                [
                  ["plan", "Plan"],
                  ["map", "Dependency map"],
                  ["results", "Results"],
                  ["details", "Details"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  aria-current={view === id ? "page" : undefined}
                  className={view === id ? "active" : ""}
                  onClick={() => setView(id)}
                >
                  {label}
                  {id === "results" &&
                    Object.keys(w.outputs ?? {}).length > 0 && (
                      <span className="tab-count">
                        {Object.keys(w.outputs ?? {}).length}
                      </span>
                    )}
                </button>
              ))}
            </nav>
            <div className="workspace-content" aria-busy={busy}>
              {view === "details" && (
                <section className="panel details-panel">
                  <h2>About this plan</h2>
                  <p className="muted">
                    {w.mode === "fixture"
                      ? "Explicit fixture; external actions are simulated."
                      : w.mode === "gemma"
                        ? "Interpreted with Gemma 4. Review the details before running."
                        : "Manually authored plan."}
                  </p>
                  {w.mode === "fixture" && (
                    <a href="/demo/rooms" target="_blank">
                      Open room portal
                    </a>
                  )}
                  {w.mode === "fixture" && (
                    <>
                      {" "}
                      <label className="field" htmlFor="scenario">
                        Controlled demo inventory
                      </label>
                      <select
                        id="scenario"
                        value={w.demoScenario ?? "happy"}
                        disabled={w.audit.length > 0 || busy}
                        onChange={(e) =>
                          void action("scenario", { scenario: e.target.value })
                        }
                      >
                        <option value="happy">Room available</option>
                        <option value="no_room">No room available</option>
                      </select>
                    </>
                  )}

                  <p>{w.summary}</p>
                  {(w.sourceText || text) && (
                    <details>
                      <summary>Source text</summary>
                      <div className="source">{w.sourceText || text}</div>
                    </details>
                  )}
                  {preview && (
                    <Image
                      unoptimized
                      width={600}
                      height={190}
                      className="sourceImage"
                      src={preview}
                      alt="Original source"
                    />
                  )}
                  {w.warnings.map((x, i) => (
                    <p className="muted" key={i}>
                      {x}
                    </p>
                  ))}
                  <h3>Assumptions</h3>
                  {w.assumptions.map((a, i) => (
                    <p className="muted" key={i}>
                      {a}
                    </p>
                  ))}
                  <div className="row">
                    <button
                      onClick={() => {
                        setEditJson(
                          JSON.stringify(
                            {
                              title: w.title,
                              source: w.source,
                              timezone: w.timezone,
                              summary: w.summary,
                              tasks: w.tasks,
                              questions: w.questions,
                              assumptions: w.assumptions,
                              warnings: w.warnings,
                            },
                            null,
                            2,
                          ),
                        );
                        setEditing(!editing);
                      }}
                    >
                      Edit complete plan
                    </button>
                  </div>
                  {editing && (
                    <>
                      <label className="field" htmlFor="plan">
                        Tasks, recipients, inputs and dependencies (validated
                        JSON)
                      </label>
                      <textarea
                        id="plan"
                        style={{ minHeight: 350 }}
                        value={editJson}
                        onChange={(e) => setEditJson(e.target.value)}
                      />
                      <button
                        onClick={() => {
                          try {
                            void action("edit", {
                              draft: JSON.parse(editJson),
                            }).then((r) => {
                              if (r) setEditing(false);
                            });
                          } catch {
                            setError("Invalid JSON");
                          }
                        }}
                      >
                        Save & validate DAG
                      </button>
                    </>
                  )}
                </section>
              )}
              {view === "map" && (
                <section className="panel map-panel">
                  <div className="row between">
                    <div>
                      <div className="eyebrow">See how it connects</div>
                      <h2>Your dependency map</h2>
                    </div>
                    <span className="badge">{w.tasks.length} tasks</span>
                  </div>
                  <div className="flow">
                    <WorkflowGraph
                      tasks={w.tasks}
                      onSelect={setSelected}
                      onEdit={(tasks) =>
                        void action("edit", { draft: { ...w, tasks } })
                      }
                    />
                  </div>
                  <p className="muted">
                    Connect handles to add prerequisites. Select an edge and
                    Delete to remove it. Select a node to edit.
                  </p>
                </section>
              )}
              {view === "plan" && (
                <section className="panel plan-panel">
                  {w.questions.some((q) => !q.answer) && (
                    <div className="clarification-block">
                      <div className="section-heading">
                        <span className="step-marker">?</span>
                        <div>
                          <h2>A few details first</h2>
                          <p>Help Reify get the plan right before it starts.</p>
                        </div>
                      </div>
                      {w.questions
                        .filter((q) => !q.answer)
                        .map((q) => (
                          <div className="question" key={q.id}>
                            <b>{q.question}</b>
                            <details className="question-context">
                              <summary>Why we ask</summary>
                              <p>{q.reason}</p>
                            </details>
                            <label className="field" htmlFor={q.id}>
                              {q.required
                                ? "Required answer"
                                : "Optional — acknowledge uncertainty"}
                            </label>
                            <input
                              id={q.id}
                              value={answers[q.id] ?? q.answer ?? ""}
                              onChange={(e) =>
                                setAnswers((a) => ({
                                  ...a,
                                  [q.id]: e.target.value,
                                }))
                              }
                              placeholder={
                                q.id === "when"
                                  ? "2026-10-25T16:00:00-04:00"
                                  : "Your answer"
                              }
                            />
                          </div>
                        ))}
                      {w.questions.some((q) => !q.answer) && (
                        <button
                          className="primary"
                          disabled={
                            busy ||
                            !w.questions.some(
                              (q) => !q.answer && answers[q.id]?.trim(),
                            )
                          }
                          onClick={() => void action("clarify", { answers })}
                        >
                          {busy ? "Updating your plan..." : "Save answers"}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="plan-toolbar">
                    <div>
                      <h2>Your next steps</h2>
                      <p className="muted">
                        Review the steps. You stay in control.
                      </p>
                    </div>
                    <div className="row">
                      <button
                        className="primary"
                        disabled={
                          busy ||
                          w.paused ||
                          w.questions.some((q) => q.required && !q.answer)
                        }
                        onClick={() => void action("advance")}
                      >
                        {busy ? "Working..." : "Run next steps"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void action("pause")}
                      >
                        {w.paused ? "Resume" : "Pause"}
                      </button>
                      {Object.values(w.jobs ?? {}).some(
                        (j) => j.provider === "twinly",
                      ) && (
                        <button
                          disabled={busy}
                          onClick={() => void action("poll")}
                        >
                          Check provider progress
                        </button>
                      )}
                    </div>
                  </div>
                  {w.paused && (
                    <p className="inline-notice">
                      Paused. Resume when you are ready.
                    </p>
                  )}
                  {w.tasks.map((t) => (
                    <div className={`task ${t.status}`} key={t.id}>
                      <div className="row between">
                        <button
                          className="task-title"
                          onClick={() => setSelected(t)}
                        >
                          <span className="task-indicator">
                            {t.status === "completed" ? (
                              <CheckCircle2 size={20} />
                            ) : (
                              <Circle size={20} />
                            )}
                          </span>
                          {t.title}
                          <ChevronRight size={15} />
                        </button>
                        <span className="status">
                          {(
                            {
                              pending: "Not started",
                              blocked: "Waiting",
                              needs_clarification: "Needs details",
                              awaiting_approval: "Review needed",
                              running: "In progress",
                              completed: "Done",
                              failed: "Needs attention",
                              awaiting_external_reply: "Awaiting reply",
                              verifying: "Checking",
                              skipped: "Skipped",
                              cancelled: "Cancelled",
                            } as Record<string, string>
                          )[t.status] ?? t.status}
                        </span>
                      </div>
                      <p className="muted task-caption">
                        {(
                          {
                            generate_content: "Write with Gemma",
                            research: "Research",
                            send_message: "Send a message",
                            call: "Make a call",
                            speak: "Create voice audio",
                            generate_image: "Create an image",
                            twinly_chat: "Ask Twinly",
                            read_messages: "Read a conversation",
                            computer_action: "Suggest a screen action",
                            browser_task: "Work on a website",
                            twinly_task: "Work in an app",
                            conditional: "Check a condition",
                            manual: "Manual step",
                          } as Record<string, string>
                        )[t.kind] ?? "Task"}
                        {t.dependsOn.length > 0 &&
                          ` · After ${t.dependsOn.map((id) => w.tasks.find((x) => x.id === id)?.title ?? "previous step").join(", ")}`}
                      </p>
                      {t.blockReason && (
                        <p className="muted" role="status">
                          {t.blockReason}
                        </p>
                      )}
                      {w.outputs?.[t.id] && (
                        <details>
                          <summary>View result</summary>
                          <pre>{w.outputs[t.id].text}</pre>
                          {w.outputs[t.id].mime?.startsWith("image/") && (
                            <Image
                              unoptimized
                              width={640}
                              height={400}
                              style={{ maxWidth: "100%", height: "auto" }}
                              alt="Generated image artifact"
                              src={`/api/workflows/${w.id}/artifact?taskId=${encodeURIComponent(t.id)}&inline=1`}
                            />
                          )}
                          {w.outputs[t.id].mime?.startsWith("audio/") && (
                            <audio
                              controls
                              src={`/api/workflows/${w.id}/artifact?taskId=${encodeURIComponent(t.id)}&inline=1`}
                            />
                          )}
                          <a
                            href={`/api/workflows/${w.id}/artifact?taskId=${encodeURIComponent(t.id)}`}
                          >
                            Download{" "}
                            {w.outputs[t.id].mime ? "media" : "Markdown"}
                          </a>
                        </details>
                      )}
                      {t.kind === "generate_content" &&
                        (t.status === "failed" || t.status === "running") && (
                          <button
                            className="small"
                            disabled={busy}
                            onClick={() =>
                              void action("retry", { taskId: t.id })
                            }
                          >
                            Retry failed / interrupted text task
                          </button>
                        )}
                      {t.status === "awaiting_approval" &&
                        w.jobs?.[t.id]?.providerStatus !== "needs_approval" && (
                          <div className="row">
                            <button
                              className="small"
                              onClick={() => {
                                void fetch(`/api/workflows/${w.id}/status`)
                                  .then((r) => r.json())
                                  .then((d) => {
                                    if (!Array.isArray(d.tasks)) {
                                      setError(
                                        d.error || "Unable to refresh approval",
                                      );
                                      return;
                                    }
                                    const current = d.tasks.find(
                                      (x: Task) => x.id === t.id,
                                    );
                                    if (!current) {
                                      setError(
                                        "Task no longer exists. Refresh the plan.",
                                      );
                                      return;
                                    }
                                    setW(d);
                                    setApproval(current);
                                  })
                                  .catch(() =>
                                    setError(
                                      "Unable to refresh approval. Check connection and retry.",
                                    ),
                                  );
                              }}
                            >
                              Review exact action
                            </button>
                            <button
                              className="small"
                              onClick={() =>
                                void action("deny", { taskId: t.id })
                              }
                            >
                              Deny
                            </button>
                          </div>
                        )}
                      {w.jobs?.[t.id]?.provider === "twinly" &&
                        w.jobs[t.id].externalId &&
                        ["running", "awaiting_approval"].includes(t.status) && (
                          <button
                            className="small"
                            disabled={busy}
                            onClick={() =>
                              void action("cancel-provider", { taskId: t.id })
                            }
                          >
                            Request provider stop
                          </button>
                        )}
                      {w.jobs?.[t.id]?.provider === "twinly" &&
                        w.jobs[t.id].state === "uncertain" &&
                        !w.jobs[t.id].externalId && (
                          <button
                            className="small"
                            disabled={busy}
                            onClick={() => {
                              const externalId = window.prompt(
                                "Inspect the existing job on Ajit's Mac. Only paste its UUID after checking its exact action and recipient match this task. This links the existing job; it does not retry.",
                              );
                              if (
                                externalId &&
                                window.confirm(
                                  "I checked that this is the same action and recipient in Twinly.",
                                )
                              )
                                void action("link-provider-job", {
                                  taskId: t.id,
                                  externalId: externalId.trim(),
                                  acknowledged: true,
                                });
                            }}
                          >
                            Link existing Mac job
                          </button>
                        )}
                      {t.status === "verifying" &&
                        w.jobs?.[t.id]?.providerStatus === "done" &&
                        w.jobs[t.id].state === "completed" && (
                          <button
                            className="small"
                            disabled={busy}
                            onClick={() => {
                              const note = window.prompt(
                                "Describe the real outcome you independently checked. This is a user confirmation, not automatic verification.",
                              );
                              if (note && note.trim().length >= 5)
                                void action("confirm-result", {
                                  taskId: t.id,
                                  note,
                                  acknowledged: true,
                                });
                            }}
                          >
                            Record my outcome check
                          </button>
                        )}
                      {w.mode === "fixture" &&
                        t.status === "awaiting_external_reply" && (
                          <div className="row">
                            <span className="muted">
                              Inject simulated reply:
                            </span>
                            {(["yes", "no", "maybe", "silence"] as const).map(
                              (value) => (
                                <button
                                  className="small"
                                  key={value}
                                  onClick={() =>
                                    void action("reply", {
                                      taskId: t.id,
                                      value,
                                    })
                                  }
                                >
                                  {value}
                                </button>
                              ),
                            )}
                          </div>
                        )}
                    </div>
                  ))}
                </section>
              )}
              {view === "results" && (
                <section className="panel results-panel">
                  <h2>Results & activity</h2>
                  <div className="row">
                    <span className="badge">
                      {w.tasks.filter((t) => t.status === "completed").length}{" "}
                      steps finished
                    </span>
                    <span className="badge">
                      {
                        w.tasks.filter(
                          (t) => t.status === "awaiting_external_reply",
                        ).length
                      }{" "}
                      awaiting reply
                    </span>
                    <span className="badge">
                      {w.tasks.filter((t) => t.status === "failed").length}{" "}
                      failed
                    </span>
                  </div>
                  {w.tasks
                    .filter((t) => w.outputs?.[t.id])
                    .map((t) => (
                      <div className="result-card" key={t.id}>
                        <h3>{t.title}</h3>{" "}
                        {w.outputs?.[t.id] && (
                          <details open>
                            <summary>View result</summary>
                            <pre>{w.outputs[t.id].text}</pre>
                            {w.outputs[t.id].mime?.startsWith("image/") && (
                              <Image
                                unoptimized
                                width={640}
                                height={400}
                                style={{ maxWidth: "100%", height: "auto" }}
                                alt="Generated image artifact"
                                src={`/api/workflows/${w.id}/artifact?taskId=${encodeURIComponent(t.id)}&inline=1`}
                              />
                            )}
                            {w.outputs[t.id].mime?.startsWith("audio/") && (
                              <audio
                                controls
                                src={`/api/workflows/${w.id}/artifact?taskId=${encodeURIComponent(t.id)}&inline=1`}
                              />
                            )}
                            <a
                              href={`/api/workflows/${w.id}/artifact?taskId=${encodeURIComponent(t.id)}`}
                            >
                              Download{" "}
                              {w.outputs[t.id].mime ? "media" : "Markdown"}
                            </a>
                          </details>
                        )}
                      </div>
                    ))}
                  {w.evidence.length === 0 ? (
                    <p>Your results will appear here as steps finish.</p>
                  ) : (
                    w.evidence.map((e, i) => (
                      <div className="evidence" key={i}>
                        <b>{e.summary}</b>
                        <p className="muted">
                          {e.provider} · {e.verification} · {e.externalId}
                          <br />
                          {e.checkedAt}
                        </p>
                      </div>
                    ))
                  )}
                  <details className="activity-details">
                    <summary>Activity history</summary>
                    <div className="audit">
                      {w.audit
                        .slice()
                        .reverse()
                        .map((a, i) => (
                          <p key={i}>
                            <span className="muted">
                              {new Date(a.at).toLocaleTimeString()} ·{" "}
                              {a.taskId ?? "workflow"}
                            </span>
                            <br />
                            {a.summary}
                          </p>
                        ))}
                    </div>
                  </details>
                </section>
              )}
            </div>
            {selected && (
              <dialog
                ref={editorDialog}
                className="editor-drawer"
                aria-label="Edit task"
                onCancel={() => setSelected(undefined)}
              >
                <TaskEditor
                  key={`${selected.id}-${w.version}`}
                  task={selected}
                  onClose={() => setSelected(undefined)}
                  onSave={async (task) => {
                    const result = await action("edit", {
                      draft: {
                        ...w,
                        questions: w.questions.map((q) =>
                          q.id === `${task.id}-screenshot` &&
                          task.inputs.screenshot &&
                          task.inputs.ownedScreen === true
                            ? { ...q, answer: "Uploaded an owned screenshot" }
                            : q,
                        ),
                        tasks: w.tasks.map((t) =>
                          t.id === task.id ? task : t,
                        ),
                      },
                    });
                    if (result) setSelected(undefined);
                    return !!result;
                  }}
                />
              </dialog>
            )}
          </>
        )}
        <div className="footer">
          <span>Reify</span>
          <span>
            {w?.mode === "fixture"
              ? "Demo workspace · simulated actions"
              : "Your plan. Your say."}
          </span>
        </div>
      </main>
      {connections && (
        <dialog
          ref={connectionsDialog}
          onCancel={() => setConnections(false)}
          className="connections-dialog"
          aria-labelledby="connections-title"
        >
          <div className="row between">
            <div>
              <div className="eyebrow">Workspace settings</div>
              <h2 id="connections-title">Connections</h2>
            </div>
            <button className="quiet" onClick={() => setConnections(false)}>
              Close
            </button>
          </div>
          <p>
            Connect the tools your plan needs. External actions always need your
            approval.
          </p>
          <CapabilityStatus items={health?.capabilities} expanded />
          <p className="muted">
            Credentials are configured privately on the server.{" "}
            <a
              href="https://github.com/parvathinalla/reify/blob/main/docs/TWINLY_SETUP.md"
              target="_blank"
              rel="noreferrer"
            >
              Setup guide <ArrowRight size={12} style={{ display: "inline" }} />
            </a>
          </p>
        </dialog>
      )}
      <dialog ref={dialog} onCancel={() => setApproval(undefined)}>
        <h2>Approve this exact action?</h2>
        <span className="badge amber">
          {w?.mode === "fixture"
            ? "Demo adapter - no real external message"
            : "Exact action requires provider verification and approval"}
        </span>
        <p>{approval?.title}</p>
        <dl className="approval-fields">
          {Object.entries(approval?.inputs ?? {}).map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/([A-Z])/g, " $1").replaceAll("_", " ")}</dt>
              <dd>
                {key === "screenshot" &&
                typeof value === "string" &&
                value.startsWith("data:image/") ? (
                  <Image
                    unoptimized
                    width={400}
                    height={200}
                    style={{ objectFit: "contain", maxWidth: "100%" }}
                    src={value}
                    alt="Screen for the approved proposal"
                  />
                ) : typeof value === "boolean" ? (
                  value ? (
                    "Yes"
                  ) : (
                    "No"
                  )
                ) : typeof value === "object" ? (
                  JSON.stringify(value)
                ) : (
                  String(value)
                )}
              </dd>
            </div>
          ))}
        </dl>
        <details className="advanced-inputs">
          <summary>Technical action data</summary>
          <pre>{JSON.stringify(approval?.inputs, null, 2)}</pre>
        </details>
        <p className="muted">
          Approval binds these parameters to workflow version {w?.version}.
          Editing invalidates it.
        </p>
        <div className="row">
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              if (approval && w?.digests)
                void action("approve", {
                  taskId: approval.id,
                  digest: w.digests[approval.id],
                }).then(() => {
                  dialog.current?.close();
                  setApproval(undefined);
                });
            }}
          >
            Approve exact action
          </button>
          <button
            onClick={() => {
              dialog.current?.close();
              setApproval(undefined);
            }}
          >
            Cancel
          </button>
        </div>
      </dialog>
    </>
  );
}
