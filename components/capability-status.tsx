"use client";
import { useState } from "react";
export type Capability = {
  id: string;
  title: string;
  provider: string;
  ready: boolean;
  reason: string;
  setupReady?: boolean;
};
type TwinlyStatus = {
  online: boolean;
  setup?: Record<string, boolean | string>;
  error?: string;
  features?: Capability[];
  liveVerified?: boolean;
  executionEnabled?: boolean;
};
export default function CapabilityStatus({
  items,
  expanded = false,
}: {
  items?: Capability[];
  expanded?: boolean;
}) {
  const [status, setStatus] = useState<TwinlyStatus>();
  const [busy, setBusy] = useState(false);
  const visible = status?.features
    ? [
        ...(items ?? []).filter((i) => i.provider !== "twinly"),
        ...status.features,
      ]
    : items;
  return (
    <details open={expanded || undefined} style={{ margin: "18px 0" }}>
      <summary>Connected capabilities</summary>
      {visible?.map((item) => (
        <div className="task" key={item.id}>
          <div className="row between">
            <b>{item.title}</b>
            <span className="badge">
              {item.provider} ·{" "}
              {item.ready
                ? item.provider === "twinly"
                  ? "ready - approval required"
                  : "configured"
                : item.setupReady
                  ? "permissions ready - verify connection"
                  : "setup required"}
            </span>
          </div>
          <p className="muted">{item.reason}</p>
        </div>
      ))}
      <button
        className="small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/twinly/health");
            setStatus(await r.json());
          } catch {
            setStatus({
              online: false,
              error: "Could not check Twinly readiness.",
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking…" : "Check Twinly readiness"}
      </button>
      {status && (
        <div className="task">
          <b>Twinly Mac: {status.online ? "online" : "not ready"}</b>
          {status.error && <p className="muted">{status.error}</p>}
          {Object.entries(status.setup ?? {})
            .filter(([, v]) => v !== true)
            .map(([name, value]) => (
              <p className="muted" key={name}>
                <b>{name.replaceAll("_", " ")}:</b> {String(value)}
              </p>
            ))}
          <p className="muted">
            Connection check:{" "}
            {status.liveVerified
              ? "verified by a completed Mac test job"
              : "not verified"}
            . Live mode:{" "}
            {status.executionEnabled
              ? "enabled; each feature still needs permission and approval"
              : "disabled"}
            . This readiness check sends no calls or messages.
          </p>
        </div>
      )}
    </details>
  );
}
