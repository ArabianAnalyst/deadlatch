"use client";

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

function PrimNode({ data }: NodeProps) {
  const d = data as { tag?: string; kind?: string; name: string; sub: string };
  return (
    <div className={`rf-node ${d.kind ?? ""}`}>
      <Handle id="l" type="target" position={Position.Left} />
      <Handle id="t" type="target" position={Position.Top} />
      {d.tag ? <div className="rf-tag">{d.tag}</div> : null}
      <div className="rf-name">{d.name}</div>
      <div className="rf-sub">{d.sub}</div>
      <Handle id="r" type="source" position={Position.Right} />
      <Handle id="b" type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { prim: PrimNode };

const nodes: Node[] = [
  { id: "agent", type: "prim", position: { x: 0, y: 96 }, data: { name: "Agent", sub: "picks a tool, wants to act" } },
  { id: "purse", type: "prim", position: { x: 300, y: 96 }, data: { tag: "enforce", kind: "enforce", name: "Purse", sub: "checks the action against policy" } },
  { id: "rail", type: "prim", position: { x: 620, y: 96 }, data: { name: "Rail", sub: "money moves, tool runs" } },
  { id: "blackbox", type: "prim", position: { x: 300, y: 268 }, data: { tag: "prove", kind: "prove", name: "blackbox", sub: "tamper-evident record" } },
  { id: "tripwire", type: "prim", position: { x: 620, y: 268 }, data: { tag: "watch", kind: "watch", name: "Tripwire", sub: "flags the silent wrong turn" } },
];

const edges: Edge[] = [
  {
    id: "a-p", source: "agent", target: "purse", sourceHandle: "r", targetHandle: "l",
    label: "action", style: { stroke: "#3a434f", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#7c8798" },
  },
  {
    id: "p-r", source: "purse", target: "rail", sourceHandle: "r", targetHandle: "l",
    label: "allowed", style: { stroke: "#37d07e", strokeWidth: 1.7 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#37d07e" },
  },
  {
    id: "p-b", source: "purse", target: "blackbox", sourceHandle: "b", targetHandle: "t",
    label: "records", animated: true, style: { stroke: "#f2b33d", strokeWidth: 1.7 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#f2b33d" },
  },
  {
    id: "r-t", source: "rail", target: "tripwire", sourceHandle: "b", targetHandle: "t",
    label: "observes", style: { stroke: "#fb5b4b", strokeWidth: 1.5, strokeDasharray: "5 4" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#fb5b4b" },
  },
];

export default function FlowGraph() {
  return (
    <div className="rf-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="#1b222b" />
      </ReactFlow>
    </div>
  );
}
