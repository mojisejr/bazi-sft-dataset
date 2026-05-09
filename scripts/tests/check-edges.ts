import { calculateBaziChart } from "../../src/lib/bazi/symbolic-engine";
import { buildSemanticChamberGraph } from "../../src/lib/bazi/semantic-chamber-graph";

async function main() {
  const rawInput = {
    birthDate: "1989-01-03",
    birthTime: "12:00",
    province: "กรุงเทพมหานคร",
    gender: "female" as const,
    name: "Test"
  };
  
  const calculated = await calculateBaziChart(rawInput);
  
  const graphQuiet = buildSemanticChamberGraph(calculated, { quietGraph: true });

  console.log("=== Edges (Quiet Graph) ===");
  graphQuiet.edges.forEach(e => {
    const s = e.source.split(":")[1];
    const t = e.target.split(":")[1];
    const kind = e.source.split(":")[0];
    const tkind = e.target.split(":")[0];
    const layer = e.data.layer;
    console.log(`- Layer: ${layer.padEnd(25)} | ${kind}:${s.padEnd(5)} -> ${tkind}:${t.padEnd(5)} | Label: ${e.label || e.data.flowLabel || 'N/A'}`);
  });
}

main().catch(console.error);
