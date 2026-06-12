import { describe, expect, test } from "vitest";

import {
  knowledgeForDefinition,
  listTopicKnowledgeViews,
} from "@/lib/bazi/knowledge/topic-knowledge-view";
import { type ReadingDoctrineRepository } from "@/lib/bazi/reading-doctrine-repository";
import { TOPIC_PATH, getTopicDefinition } from "@/lib/bazi/topic-path";

// repository ปลอม → ไม่แตะ DB (no overrides) เพื่อให้ accessor ใช้ TOPIC_PATH default
const noOverrides = {
  listOverrides: async () => ({}),
} as unknown as ReadingDoctrineRepository;

const PREDICT_COUNT = TOPIC_PATH.filter((topic) => topic.kind === "predict").length;

describe("knowledgeForDefinition", () => {
  test("บทที่ dimension ว่าง (basis) → ไม่มีก้อนความรู้", () => {
    const basis = getTopicDefinition("calculated_basis");
    expect(basis.evidenceDimension).toBeNull();
    expect(knowledgeForDefinition(basis)).toEqual([]);
  });

  test("บทพื้นฐานดวง (personality_psychology) → ก้อนความรู้ตรง dimension", () => {
    const chartFoundation = getTopicDefinition("chart_foundation");
    const knowledge = knowledgeForDefinition(chartFoundation);
    expect(knowledge.length).toBeGreaterThan(0);
    // ทุกก้อนต้องมี annotationDimension ตรงกับ dimension ของบท
    for (const bundle of knowledge) {
      expect(bundle.annotationDimension).toBe(chartFoundation.evidenceDimension);
      expect(bundle.thaiLabel.length).toBeGreaterThan(0);
      expect(bundle.engineDependencies.length).toBeGreaterThan(0);
      expect(bundle.sinsaeLogicRules.length).toBeGreaterThan(0);
      expect(bundle.sourceRefs.length).toBeGreaterThan(0);
    }
  });
});

describe("listTopicKnowledgeViews", () => {
  test("คืนเฉพาะบททำนาย (predict) ครบจำนวน และไม่รวมบท basis", async () => {
    const views = await listTopicKnowledgeViews({ repository: noOverrides });
    expect(views).toHaveLength(PREDICT_COUNT);
    expect(views.every((view) => view.definition.kind === "predict")).toBe(true);
    expect(views.some((view) => view.definition.id === "calculated_basis")).toBe(false);
  });

  test("ทุก view มี definition + knowledge ที่ map dimension ถูกต้อง (ไม่ throw)", async () => {
    const views = await listTopicKnowledgeViews({ repository: noOverrides });
    for (const view of views) {
      expect(view.definition.id.length).toBeGreaterThan(0);
      for (const bundle of view.knowledge) {
        expect(bundle.annotationDimension).toBe(view.definition.evidenceDimension);
      }
    }
  });
});
