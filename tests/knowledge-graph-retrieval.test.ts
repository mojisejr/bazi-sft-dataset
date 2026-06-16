import { describe, expect, test } from "vitest";

import { retrieveKnowledgeForQuestion } from "../src/lib/bazi/knowledge-graph/retrieval-router";

const FLAGSHIP = "ดวงดิถีน้ำกุ่ย (癸) ช่วงนี้วัยจรตกหมูยก เรื่องการงานจะเป็นยังไง?";

describe("retrieval-router", () => {
  const packet = retrieveKnowledgeForQuestion(FLAGSHIP);

  test("resolves flagship entities (stem 癸 + branch 亥), not the other water stem", () => {
    const ids = packet.resolvedEntities.map((entity) => entity.id);
    expect(ids).toContain("stem:癸");
    expect(ids).toContain("branch:亥");
    expect(ids).toContain("element:water");
    // 壬 ก็ธาตุน้ำเหมือนกัน แต่ไม่ถูกพิมพ์ → ต้องไม่ถูก resolve (กัน day-master ผิดตัว)
    expect(ids).not.toContain("stem:壬");
  });

  test("returns grounded evidence with full coverage", () => {
    expect(packet.coverage).toBe("full");
    expect(packet.fallbackRequired).toBe(false);
    expect(packet.evidence.length).toBeGreaterThan(0);
  });

  test("includes career-discipline evidence for a career question", () => {
    expect(packet.evidence.some((item) => item.discipline === "career")).toBe(true);
  });

  test("includes the derived qi-stage meaning (癸×亥 = 帝旺) as timing evidence", () => {
    const qi = packet.evidence.find((item) => item.relation === "qi-stage");
    expect(qi).toBeDefined();
    expect(qi?.excerpt).toContain("帝旺");
  });

  test("every evidence is HybridRetrievalEvidence-compatible + carries provenance", () => {
    for (const item of packet.evidence) {
      expect(typeof item.title).toBe("string");
      expect(typeof item.sourcePath).toBe("string");
      expect(typeof item.excerpt).toBe("string");
      expect(Array.isArray(item.matchedKeywords)).toBe(true);
      expect(item.provenance.ref.length).toBeGreaterThan(0);
    }
  });

  test("citations dedupe by ref", () => {
    const refs = packet.citations.map((citation) => citation.ref);
    expect(new Set(refs).size).toBe(refs.length);
    expect(packet.citations.length).toBeGreaterThan(0);
  });

  test("retrieval is deterministic", () => {
    const again = retrieveKnowledgeForQuestion(FLAGSHIP);
    expect(JSON.stringify(again)).toBe(JSON.stringify(packet));
  });

  test("gibberish question → missing coverage, fallback required", () => {
    const empty = retrieveKnowledgeForQuestion("qqqq zzz 999");
    expect(empty.coverage).toBe("missing");
    expect(empty.fallbackRequired).toBe(true);
    expect(empty.evidence).toHaveLength(0);
  });
});
