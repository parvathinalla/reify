"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Workflow } from "@/lib/model";
export default function Rooms() {
  const [w, setW] = useState<Workflow>();
  useEffect(() => {
    const id = localStorage.getItem("reify-id");
    if (id)
      fetch(`/api/workflows/${id}/status`)
        .then((r) => r.json())
        .then(setW);
  }, []);
  return (
    <main>
      <div className="eyebrow">
        CONTROLLED DEMO PORTAL · FICTIONAL INVENTORY
      </div>
      <h1>The quiet corner.</h1>
      <p>Indigo 204 · 4 seats · whiteboard · quiet floor</p>
      <section className="panel">
        <h2>Persisted reservations</h2>
        {Object.values(w?.reservations ?? {}).map((r) => (
          <div className="evidence" key={r.reference}>
            <b>
              {r.room} · {r.reference}
            </b>
            <p>{r.date}</p>
          </div>
        ))}
        {!Object.keys(w?.reservations ?? {}).length && (
          <p>No reservation stored for this session.</p>
        )}
        <button onClick={() => location.reload()}>Refresh portal state</button>{" "}
        <Link href="/">Return to Reify</Link>
      </section>
    </main>
  );
}
