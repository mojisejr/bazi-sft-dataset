"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
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
import { getSemanticDayFocusNodeIds } from "@/lib/bazi/semantic-chamber-graph";
import { assignChamberGraphLayout } from "@/lib/bazi/chamber-layout";

import { ChamberPillarNode } from "@/components/bazi/reaction-chamber/ChamberPillarNode";
import { ChamberMarkerNode } from "@/components/bazi/reaction-chamber/ChamberMarkerNode";
import { ChamberStemNode } from "@/components/bazi/reaction-chamber/ChamberStemNode";
import { ChamberBranchNode } from "@/components/bazi/reaction-chamber/ChamberBranchNode";
import { ChamberBezierEdge } from "@/components/bazi/reaction-chamber/ChamberSmoothStepEdge";
import { ChamberEdgeLegend } from "@/components/bazi/reaction-chamber/ChamberEdgeLegend";
import { buildChamberRenderModel } from "@/components/bazi/reaction-chamber/chamber-render-model";

const NODE_TYPES = {
  chamberPillar: ChamberPillarNode,
  chamberMarker: ChamberMarkerNode,
  chamberStemNode: ChamberStemNode,
  chamberBranchNode: ChamberBranchNode,
};

const EDGE_TYPES = {
  chamberBezier: ChamberBezierEdge,
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

function ReactionChamberCanvasInner({
  graph,
  onSelectionChange,
  onNodeHover,
}: ReactionChamberCanvasProps) {
  const reactFlowInstance = useReactFlow();
  const focusFitRef = useRef(false);

  const renderModel = useMemo(() => {
    const positions = assignChamberGraphLayout(graph);
    return buildChamberRenderModel(graph, positions);
  }, [graph]);

  useEffect(() => {
    focusFitRef.current = false;
  }, [graph]);

  useEffect(() => {
    if (renderModel.nodes.length === 0 || focusFitRef.current) {
      return;
    }

    const focusNodeIds = getSemanticDayFocusNodeIds(graph);
    const focalNode = graph.nodes.find((node) => focusNodeIds.includes(node.id));

    if (focalNode) {
      reactFlowInstance.fitView({ padding: 0.14, duration: 400 });
      focusFitRef.current = true;
    }
  }, [graph, renderModel.nodes.length, reactFlowInstance]);

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
        nodes={renderModel.nodes}
        edges={renderModel.edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.14 }}
        minZoom={0.55}
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
      <ChamberEdgeLegend />
    </div>
  );
}

export type { ChamberSelection };

export const ReactionChamberCanvas = ReactionChamberCanvasInner;
export { ReactFlowProvider };
