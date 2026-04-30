"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnSelectionChangeParams,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import type {
  SemanticEdge,
  SemanticChamberGraph,
  SemanticNode,
} from "@/lib/bazi/semantic-chamber-graph";

import { ChamberPillarNode } from "@/components/bazi/reaction-chamber/ChamberPillarNode";
import { ChamberMarkerNode } from "@/components/bazi/reaction-chamber/ChamberMarkerNode";

const NODE_TYPES = {
  chamberPillar: ChamberPillarNode,
  chamberMarker: ChamberMarkerNode,
};

type ChamberSelection =
  | { kind: "node"; node: SemanticNode }
  | { kind: "edge"; edge: SemanticEdge }
  | null;

type ReactionChamberCanvasProps = {
  graph: SemanticChamberGraph;
  onSelectionChange?: (selection: ChamberSelection) => void;
  onNodeHover?: (node: SemanticNode | null, event?: React.MouseEvent) => void;
};

function computeGraphLayout(graph: SemanticChamberGraph): Map<string, { x: number; y: number }> {
  const positionMap = new Map<string, { x: number; y: number }>();
  graph.nodes.forEach((node) => {
    positionMap.set(node.id, node.position);
  });

  return positionMap;
}

function toReactFlowNodes(graph: SemanticChamberGraph, positions: Map<string, { x: number; y: number }>): Node[] {
  return graph.nodes.map((node) => {
    const layoutPosition = positions.get(node.id);
    const fallbackPosition = node.position;

    return {
      id: node.id,
      type: node.type,
      data: node.data as unknown as Record<string, unknown>,
      position: layoutPosition ?? fallbackPosition,
      draggable: false,
      selectable: true,
    } satisfies Node;
  });
}

function toReactFlowEdges(graph: SemanticChamberGraph): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    className: edge.className,
    data: edge.data as unknown as Record<string, unknown>,
    selectable: true,
    focusable: true,
    type: "default",
  } satisfies Edge));
}

function ReactionChamberCanvasInner({
  graph,
  onSelectionChange,
  onNodeHover,
}: ReactionChamberCanvasProps) {
  const reactFlowInstance = useReactFlow();
  const focusFitRef = useRef(false);

  const layoutPositions = useMemo(() => computeGraphLayout(graph), [graph]);
  const nodes = useMemo(() => toReactFlowNodes(graph, layoutPositions), [graph, layoutPositions]);
  const edges = useMemo(() => toReactFlowEdges(graph), [graph]);

  useEffect(() => {
    focusFitRef.current = false;
  }, [graph]);

  useEffect(() => {
    if (nodes.length === 0 || focusFitRef.current) {
      return;
    }

    const focalNode = graph.nodes.find(
      (node) => node.data.kind === "pillar" && node.data.isFocal,
    );

    if (focalNode) {
      reactFlowInstance.fitView({ padding: 0.25, duration: 400 });
      focusFitRef.current = true;
    }
  }, [graph, nodes.length, reactFlowInstance]);

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      if (!onSelectionChange) {
        return;
      }

      if (params.nodes.length > 0) {
        const selectedNode = graph.nodes.find((node) => node.id === params.nodes[0].id);
        if (selectedNode) {
          onSelectionChange({ kind: "node", node: selectedNode });
          return;
        }
      }

      if (params.edges.length > 0) {
        const selectedEdge = graph.edges.find((edge) => edge.id === params.edges[0].id);
        if (selectedEdge) {
          onSelectionChange({ kind: "edge", edge: selectedEdge });
          return;
        }
      }

      onSelectionChange(null);
    },
    [graph, onSelectionChange],
  );

  const handleNodeMouseEnter: NodeMouseHandler = useCallback(
    (event, node) => {
      if (!onNodeHover) {
        return;
      }
      const matchedNode = graph.nodes.find((candidate) => candidate.id === node.id);
      if (matchedNode) {
        onNodeHover(matchedNode, event as unknown as React.MouseEvent);
      }
    },
    [graph, onNodeHover],
  );

  const handleNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    if (onNodeHover) {
      onNodeHover(null);
    }
  }, [onNodeHover]);

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      if (!onSelectionChange) {
        return;
      }
      const matched = graph.edges.find((candidate) => candidate.id === edge.id);
      if (matched) {
        onSelectionChange({ kind: "edge", edge: matched });
      }
    },
    [graph, onSelectionChange],
  );

  return (
    <div className="reaction-chamber-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.4}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        onSelectionChange={handleSelectionChange}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onEdgeClick={handleEdgeClick}
      >
        <Background gap={28} size={1} />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export type { ChamberSelection };

export const ReactionChamberCanvas = ReactionChamberCanvasInner;
export { ReactFlowProvider };
