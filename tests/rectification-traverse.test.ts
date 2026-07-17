// Hour Rectification — traverse.ts unit tests (#hour-rectification-engine). Pure, no LLM/DB.
import { describe, expect, test } from "vitest";
import { answerStep, startTraversal, traverseFullPath } from "@/lib/bazi/hour-rectification/domain/traverse";
import type { QuestionNetwork } from "@/lib/bazi/hour-rectification/domain/types";

// Small, hand-built, structurally valid 3-level tree: root splits 3-way, each splits 2-way, each
// of those splits 2-way into a result — 3*2*2 = 12 leaves, one per hour branch, depth 3 (well
// inside the 10-question budget). Not meant to be bazi-accurate content, just a valid shape to
// exercise traverse.ts against.
function buildFixtureNetwork(): QuestionNetwork {
  const branchOrder = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
  let leafIndex = 0;
  const nodes: QuestionNetwork["nodes"] = {};

  function leaf() {
    const branch = branchOrder[leafIndex];
    leafIndex += 1;
    return branch;
  }

  // level 2 (6 nodes, each 2-way into a result leaf)
  const level2Ids: string[] = [];
  for (let i = 0; i < 6; i++) {
    const id = `q2-${i}`;
    level2Ids.push(id);
    nodes[id] = {
      id,
      question: `คำถามระดับ 2 ข้อที่ ${i}`,
      options: [
        { id: "a", label: "ตัวเลือก A", next: { kind: "result", hourBranch: leaf() } },
        { id: "b", label: "ตัวเลือก B", next: { kind: "result", hourBranch: leaf() } },
      ],
    };
  }

  // level 1 (3 nodes, each 2-way into a level-2 node)
  const level1Ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const id = `q1-${i}`;
    level1Ids.push(id);
    nodes[id] = {
      id,
      question: `คำถามระดับ 1 ข้อที่ ${i}`,
      options: [
        { id: "a", label: "ตัวเลือก A", next: { kind: "question", nodeId: level2Ids[i * 2] } },
        { id: "b", label: "ตัวเลือก B", next: { kind: "question", nodeId: level2Ids[i * 2 + 1] } },
      ],
    };
  }

  // root (3-way into level-1 nodes)
  nodes.root = {
    id: "root",
    question: "คำถามหลัก",
    options: [
      { id: "a", label: "ตัวเลือก A", next: { kind: "question", nodeId: level1Ids[0] } },
      { id: "b", label: "ตัวเลือก B", next: { kind: "question", nodeId: level1Ids[1] } },
      { id: "c", label: "ตัวเลือก C", next: { kind: "question", nodeId: level1Ids[2] } },
    ],
  };

  return {
    version: "test-fixture-1",
    generatedAt: "2026-07-17T00:00:00.000Z",
    rootNodeId: "root",
    nodes,
  };
}

describe("startTraversal", () => {
  test("returns the root question node", () => {
    const network = buildFixtureNetwork();
    const outcome = startTraversal(network);
    expect(outcome.status).toBe("question");
    if (outcome.status === "question") {
      expect(outcome.node.id).toBe("root");
    }
  });

  test("errors cleanly when rootNodeId points nowhere", () => {
    const network = buildFixtureNetwork();
    const broken = { ...network, rootNodeId: "does-not-exist" };
    const outcome = startTraversal(broken);
    expect(outcome.status).toBe("error");
  });
});

describe("answerStep", () => {
  test("moving root -> a question node", () => {
    const network = buildFixtureNetwork();
    const outcome = answerStep(network, "root", "a");
    expect(outcome.status).toBe("question");
    if (outcome.status === "question") {
      expect(outcome.node.id).toBe("q1-0");
    }
  });

  test("reaching a terminal result", () => {
    const network = buildFixtureNetwork();
    const outcome = answerStep(network, "q2-0", "a");
    expect(outcome.status).toBe("result");
    if (outcome.status === "result") {
      expect(outcome.hourBranch).toBe("子");
    }
  });

  test("unknown node id -> error, does not throw", () => {
    const network = buildFixtureNetwork();
    const outcome = answerStep(network, "nonexistent", "a");
    expect(outcome.status).toBe("error");
  });

  test("unknown option id on a real node -> error, does not throw", () => {
    const network = buildFixtureNetwork();
    const outcome = answerStep(network, "root", "z-does-not-exist");
    expect(outcome.status).toBe("error");
  });

  test("option pointing at a missing next node -> error, does not throw", () => {
    const network = buildFixtureNetwork();
    const broken = {
      ...network,
      nodes: {
        ...network.nodes,
        root: {
          ...network.nodes.root,
          options: [
            { id: "a", label: "A", next: { kind: "question" as const, nodeId: "ghost" } },
            ...network.nodes.root.options.slice(1),
          ],
        },
      },
    };
    const outcome = answerStep(broken, "root", "a");
    expect(outcome.status).toBe("error");
  });
});

describe("traverseFullPath", () => {
  test("walks a full answer sequence to a result and records the trail", () => {
    const network = buildFixtureNetwork();
    const result = traverseFullPath(network, ["a", "a", "a"]);
    expect(result.status).toBe("result");
    if (result.status === "result") {
      expect(result.hourBranch).toBe("子");
      expect(result.trail).toEqual([
        { nodeId: "root", optionId: "a" },
        { nodeId: "q1-0", optionId: "a" },
        { nodeId: "q2-0", optionId: "a" },
      ]);
    }
  });

  test("every one of the 12 branches is reachable by SOME real answer sequence", () => {
    const network = buildFixtureNetwork();
    const paths: [string, string, string][] = [
      ["a", "a", "a"], ["a", "a", "b"],
      ["a", "b", "a"], ["a", "b", "b"],
      ["b", "a", "a"], ["b", "a", "b"],
      ["b", "b", "a"], ["b", "b", "b"],
      ["c", "a", "a"], ["c", "a", "b"],
      ["c", "b", "a"], ["c", "b", "b"],
    ];
    const seenBranches = new Set<string>();
    for (const path of paths) {
      const result = traverseFullPath(network, path);
      expect(result.status).toBe("result");
      if (result.status === "result") seenBranches.add(result.hourBranch);
    }
    expect(seenBranches.size).toBe(12);
  });

  test("running out of answers before a result -> incomplete, not an error", () => {
    const network = buildFixtureNetwork();
    const result = traverseFullPath(network, ["a"]);
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.nextNode.id).toBe("q1-0");
      expect(result.trail).toHaveLength(1);
    }
  });

  test("an invalid option mid-path -> error, trail preserved up to that point", () => {
    const network = buildFixtureNetwork();
    const result = traverseFullPath(network, ["a", "does-not-exist"]);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.trail).toEqual([{ nodeId: "root", optionId: "a" }]);
    }
  });

  test("empty answer sequence -> incomplete at the root", () => {
    const network = buildFixtureNetwork();
    const result = traverseFullPath(network, []);
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.nextNode.id).toBe("root");
      expect(result.trail).toHaveLength(0);
    }
  });
});
