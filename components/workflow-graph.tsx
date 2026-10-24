"use client";
import { useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from "@xyflow/react";
import type { Task } from "@/lib/model";
function buildNodes(tasks: Task[]): Node[] {
  const depth = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const t = tasks.find((t) => t.id === id);
    return !t?.dependsOn.length
      ? 0
      : 1 + Math.max(...t.dependsOn.map((d) => depth(d, new Set(seen))));
  };
  const ranks = tasks.map((t) => depth(t.id));
  const slots: Record<number, number> = {};
  return tasks.map((t, i) => {
    const rank = ranks[i];
    const slot = slots[rank] ?? 0;
    slots[rank] = slot + 1;
    const total = ranks.filter((r) => r === rank).length;
    return {
      id: t.id,
      position: { x: ((3 - total) / 2 + slot) * 225, y: rank * 130 },
      data: {
        label: `${t.kind === "conditional" ? "◇ " : ""}${t.title} · ${t.status.replaceAll("_", " ")}`,
      },
      style: { borderColor: t.status === "completed" ? "#5a9c80" : "#d8d4e4" },
    };
  });
}
function buildEdges(tasks: Task[]): Edge[] {
  return tasks.flatMap((t) =>
    t.dependsOn.map((id) => ({
      id: `${id}-${t.id}`,
      source: id,
      target: t.id,
      label: t.condition ? t.condition.branch : undefined,
      style: { stroke: "#9983cb", strokeWidth: 2 },
    })),
  );
}
export default function WorkflowGraph({
  tasks,
  onSelect,
  onEdit,
}: {
  tasks: Task[];
  onSelect: (task: Task) => void;
  onEdit: (tasks: Task[]) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes(tasks));
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges(tasks));
  useEffect(() => {
    setNodes((current) =>
      buildNodes(tasks).map((n) => ({
        ...current.find((c) => c.id === n.id),
        ...n,
      })),
    );
    setEdges(buildEdges(tasks));
  }, [tasks, setNodes, setEdges]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, n) => {
        const t = tasks.find((t) => t.id === n.id);
        if (t) onSelect(t);
      }}
      onConnect={(c) => {
        if (c.source && c.target)
          onEdit(
            tasks.map((t) =>
              t.id === c.target
                ? { ...t, dependsOn: [...new Set([...t.dependsOn, c.source])] }
                : t,
            ),
          );
      }}
      onEdgesDelete={(es) =>
        onEdit(
          tasks.map((t) => ({
            ...t,
            dependsOn: t.dependsOn.filter(
              (id) => !es.some((e) => e.source === id && e.target === t.id),
            ),
          })),
        )
      }
      fitView
      fitViewOptions={{ padding: 0.18 }}
      colorMode="light"
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}
