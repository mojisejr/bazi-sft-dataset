import { calculateBaziChart, createDbKnowledgeRepository } from "../../src/lib/bazi/symbolic-engine";
import { buildSemanticChamberGraph } from "../../src/lib/bazi/semantic-chamber-graph";

async function main() {
  const rawInput = {
    birthDate: "1989-01-03",
    birthTime: "12:00",
    province: "กรุงเทพมหานคร",
    gender: "female" as const,
    name: "Test"
  };
  
  const repo = createDbKnowledgeRepository();
  const calculated = await calculateBaziChart(rawInput, repo);
  
  const graphOriginal = buildSemanticChamberGraph(calculated, { quietGraph: false });
  const graphQuiet = buildSemanticChamberGraph(calculated, { quietGraph: true });

  const proposedEdges = graphQuiet.edges.filter(e => {
    if (e.data.layer === "element-flow" || e.data.layer === "daymaster-meaning") {
      return false;
    }
    return true;
  });

  console.log("=== Edge Counts ===");
  console.log("Total Raw Edges:", graphOriginal.edges.length);
  console.log("Current Quiet Graph Edges:", graphQuiet.edges.length);
  console.log("Proposed Graph Edges:", proposedEdges.length);
  
  console.log("\n=== Proposed Edges Details ===");
  proposedEdges.forEach(e => {
    const s = e.source.split(":")[1];
    const t = e.target.split(":")[1];
    const kind = e.source.split(":")[0];
    const tkind = e.target.split(":")[0];
    const layer = e.data.layer;
    console.log(`- Layer: ${layer.padEnd(25)} | ${kind.padEnd(6)}:${s.padEnd(5)} -> ${tkind.padEnd(6)}:${t.padEnd(5)} | Label: ${e.label || e.data.flowLabel || 'N/A'}`);
  });
  
  process.exit(0);
}

main().catch(console.error);
