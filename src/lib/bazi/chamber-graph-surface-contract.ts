export type ChamberGraphBoundaryStatus = "active" | "dormant";

export type ChamberSurfaceItem = {
  readonly path: string;
  readonly name: string;
  readonly status: ChamberGraphBoundaryStatus;
  readonly reason: string;
};

export type ChamberFrozenInvariant = {
  readonly id: string;
  readonly description: string;
};

export const CHAMBER_GRAPH_SURFACE_INVENTORY: readonly ChamberSurfaceItem[] = [
  {
    path: "src/lib/bazi/semantic-chamber-graph.ts",
    name: "active graph adapter",
    status: "active",
    reason: "sole canonical source of semantic nodes, edges, clusters, and overlays for the live chamber surface",
  },
  {
    path: "src/components/bazi/reaction-chamber/ReactionChamberShell.tsx",
    name: "active chamber entry",
    status: "active",
    reason: "session guard, selection state owner, and builder of the live semantic graph from workspace state",
  },
  {
    path: "src/components/bazi/reaction-chamber/ReactionChamberCanvas.tsx",
    name: "active React Flow renderer",
    status: "active",
    reason: "canonical canvas binding for the live chamber graph, including node types, edge types, selection, and fit behavior",
  },
  {
    path: "src/components/bazi/reaction-chamber/ChamberCommandBar.tsx",
    name: "active command surface",
    status: "active",
    reason: "primary viewport controls that depend on semantic focus ids from the active graph",
  },
  {
    path: "src/components/bazi/reaction-chamber/ChamberEdgeLegend.tsx",
    name: "active decode legend",
    status: "active",
    reason: "collapsible edge legend that supports graph reading without competing for primary focus",
  },
  {
    path: "src/components/bazi/reaction-chamber/ChamberTenGodPanel.tsx",
    name: "active decode aid",
    status: "active",
    reason: "support decode surface for role badges; must remain subordinate to the graph",
  },
  {
    path: "src/components/bazi/reaction-chamber/ChamberInspector.tsx",
    name: "active selection inspector",
    status: "active",
    reason: "selection detail surface that reads node and edge semantic data from the active graph",
  },
  {
    path: "src/components/bazi/reaction-chamber/ChamberStemNode.tsx",
    name: "active stem node",
    status: "active",
    reason: "used explicitly by the live canvas node map",
  },
  {
    path: "src/components/bazi/reaction-chamber/ChamberBranchNode.tsx",
    name: "active branch node",
    status: "active",
    reason: "used explicitly by the live canvas node map",
  },
  {
    path: "src/components/bazi/reaction-chamber/ChamberMarkerNode.tsx",
    name: "active marker node",
    status: "active",
    reason: "used explicitly by the live canvas node map",
  },
  {
    path: "src/lib/bazi/bazi-session-store.ts",
    name: "active session contract",
    status: "active",
    reason: "sole authoritative session store used by the live chamber route to read calculated state",
  },
  {
    path: "src/lib/bazi/base-chart-chamber-graph.ts",
    name: "legacy graph adapter",
    status: "dormant",
    reason: "not imported by any live app component or by the active semantic graph builder",
  },
  {
    path: "src/lib/bazi/chamber-session-store.ts",
    name: "legacy chamber store",
    status: "dormant",
    reason: "exists as a standalone module but is not used by the live chamber shell or canvas",
  },
  {
    path: "src/components/bazi/reaction-chamber/ChamberPillarNode.tsx",
    name: "registered pillar node",
    status: "dormant",
    reason: "still registered in the canvas node types but no live graph builder emits this node kind currently",
  },
] as const;

export const CHAMBER_FROZEN_INVARIANTS: readonly ChamberFrozenInvariant[] = [
  {
    id: "graph-first-primary",
    description: "reaction chamber remains graph-first; overlays, legends, and inspectors stay subordinate to the graph",
  },
  {
    id: "symbolic-engine-truth",
    description: "no chamber surface may invent calculated state or override symbolic engine output",
  },
  {
    id: "typed-doctrine-first",
    description: "typed doctrine fields such as doctrineKey, semanticKind, hierarchyLevel, and readingOrder remain authoritative before string labels",
  },
  {
    id: "session-redirect-behavior",
    description: "the chamber route continues to redirect to the main workspace when session state is missing",
  },
  {
    id: "support-surfaces-subordinate",
    description: "support decode aids may clarify graph meaning but must not compete for visual primacy with the graph",
  },
] as const;
