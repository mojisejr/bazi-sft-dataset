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
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { motion } from "motion/react";

import type {
  SemanticChamberGraph,
  SemanticNode,
} from "@/lib/bazi/semantic-chamber-graph";
import { getSemanticDayFocusNodeIds } from "@/lib/bazi/semantic-chamber-graph";
import { assignChamberGraphLayout } from "@/lib/bazi/chamber-layout";

import { buildChamberSelectionState, type ChamberSelectionState } from "@/lib/bazi/chamber-selection-grammar";
import type { ChamberRelationBundle } from "@/lib/bazi/chamber-relation-bundle";

import { ChamberPillarNode } from "@/components/bazi/reaction-chamber/ChamberPillarNode";
import { ChamberStemNode } from "@/components/bazi/reaction-chamber/ChamberStemNode";
import { ChamberBranchNode } from "@/components/bazi/reaction-chamber/ChamberBranchNode";
import { ChamberMarkerNode } from "@/components/bazi/reaction-chamber/ChamberMarkerNode";
import { ChamberBezierEdge } from "@/components/bazi/reaction-chamber/ChamberSmoothStepEdge";
import { buildChamberRenderModel } from "@/components/bazi/reaction-chamber/chamber-render-model";

export const CHAMBER_NODE_TYPES = {
  chamberPillar: ChamberPillarNode,
  chamberStemNode: ChamberStemNode,
  chamberBranchNode: ChamberBranchNode,
  chamberMarker: ChamberMarkerNode,
};

const EDGE_TYPES = {
  chamberBezier: ChamberBezierEdge,
};

type ReactionChamberCanvasProps = {
  graph: SemanticChamberGraph;
  selection?: ChamberSelectionState;
  relationBundle?: ChamberRelationBundle | null;
  onSelectionChange?: (selection: ChamberSelectionState) => void;
  hoveredNodeId?: string | null;
  forceInlineLabels?: boolean;
  onNodeHover?: (node: SemanticNode | null) => void;
};

function ReactionChamberCanvasInner({
  graph,
  selection,
  relationBundle,
  onSelectionChange,
  hoveredNodeId,
  forceInlineLabels,
  onNodeHover,
}: ReactionChamberCanvasProps) {
  const reactFlowInstance = useReactFlow();
  const focusFitRef = useRef(false);

  const renderModel = useMemo(() => {
    const positions = assignChamberGraphLayout(graph);
    return buildChamberRenderModel(graph, positions, {
      selectedNodeIds: selection?.selectedNodes.map((node) => node.id) ?? [],
      selectedEdgeIds: selection?.selectedEdges.map((edge) => edge.id) ?? [],
      revealedEdgeIds: relationBundle?.visibleEdgeIds ?? [],
      hideUnrevealedEdges: true,
      hoveredNodeId,
      forceInlineLabels,
    });
  }, [forceInlineLabels, graph, hoveredNodeId, relationBundle, selection]);

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
    (nodeIds: string[], edgeIds: string[] = []) => {
      if (!onSelectionChange) {
        return;
      }

      onSelectionChange(buildChamberSelectionState({ graph, nodeIds, edgeIds }));
    },
    [graph, onSelectionChange],
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (!onSelectionChange) {
        return;
      }

      const wantsMultiSelect = event.metaKey || event.ctrlKey || event.shiftKey;
      if (!wantsMultiSelect) {
        handleSelectionChange([node.id]);
        return;
      }

      const selectedNodeIds = selection?.selectedNodes.map((selectedNode) => selectedNode.id) ?? [];
      const nextNodeIds = selectedNodeIds.includes(node.id)
        ? selectedNodeIds.filter((selectedNodeId) => selectedNodeId !== node.id)
        : [...selectedNodeIds, node.id];

      handleSelectionChange(nextNodeIds);
    },
    [handleSelectionChange, onSelectionChange, selection?.selectedNodes],
  );

  const handleNodeMouseEnter: NodeMouseHandler = useCallback(
    (event, node) => {
      if (!onNodeHover) {
        return;
      }
      const matchedNode = graph.nodes.find((candidate) => candidate.id === node.id);
      if (matchedNode) {
        onNodeHover(matchedNode);
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
    (event, edge) => {
      if (!onSelectionChange) {
        return;
      }

      const wantsMultiSelect = event.metaKey || event.ctrlKey || event.shiftKey;
      if (!wantsMultiSelect) {
        handleSelectionChange([], [edge.id]);
        return;
      }

      const selectedEdgeIds = selection?.selectedEdges.map((selectedEdge) => selectedEdge.id) ?? [];
      const nextEdgeIds = selectedEdgeIds.includes(edge.id)
        ? selectedEdgeIds.filter((selectedEdgeId) => selectedEdgeId !== edge.id)
        : [...selectedEdgeIds, edge.id];

      handleSelectionChange([], nextEdgeIds);
    },
    [handleSelectionChange, onSelectionChange, selection?.selectedEdges],
  );

  const handlePaneClick = useCallback(() => {
    handleSelectionChange([]);
  }, [handleSelectionChange]);

  return (
    <motion.div
      className="reaction-chamber-canvas"
      initial={{ opacity: 0.94, scale: 0.995 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
        <ReactFlow
          nodes={renderModel.nodes}
          edges={renderModel.edges}
          nodeTypes={CHAMBER_NODE_TYPES}
          edgeTypes={EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.14 }}
        minZoom={0.55}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        multiSelectionKeyCode={["Meta", "Control", "Shift"]}
        onPaneClick={handlePaneClick}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onEdgeClick={handleEdgeClick}
        defaultEdgeOptions={{ type: "chamberBezier" }}
      >
        <Background gap={28} size={1} />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
    </motion.div>
  );
}

export type { ChamberSelectionState as ChamberSelection };

export const ReactionChamberCanvas = ReactionChamberCanvasInner;
export { ReactFlowProvider };
