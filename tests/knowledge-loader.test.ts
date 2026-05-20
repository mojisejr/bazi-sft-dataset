import { describe, expect, test } from "vitest";

import {
  getCompiledKnowledgeArtifact,
  getTopicKnowledge,
  getTopicKnowledgeContext,
  getTopicSourceBundle,
  listCompiledTopicKnowledge,
} from "@/lib/bazi/knowledge/knowledge-loader";

describe("knowledge-loader", () => {
  test("loads the compiled artifact once and indexes all 15 topics", () => {
    const artifact = getCompiledKnowledgeArtifact();

    expect(artifact.topicCount).toBe(15);
    expect(listCompiledTopicKnowledge()).toHaveLength(15);
  });

  test("returns exact compiled knowledge text for a topic bundle", () => {
    const topic = getTopicKnowledge("personality_baseline");
    const bundle = getTopicSourceBundle(
      "personality_baseline",
      "1.นิสัยโดยพื้นฐาน",
    );

    expect(topic.thaiLabel).toBe("นิสัย/บุคลิกพื้นฐาน");
    expect(bundle).toBeDefined();
    expect(bundle?.combinedNormalizedContent).toContain("นิสัย");
    expect(bundle?.combinedNormalizedContent).toContain(
      "1.1 ทายนิสัยตามดิถีแข็ง-ดิถีอ่อนแอ",
    );
    expect(bundle?.combinedNormalizedContent).toContain(
      "เคลื่อนไหวไว ไหวพริบดี มักระวังตัวและไม่ประมาท",
    );
  });

  test("builds prompt-ready context with rules and compiled corpus text", () => {
    const context = getTopicKnowledgeContext("personality_baseline");

    expect(context).toContain("หัวข้อ: นิสัย/บุคลิกพื้นฐาน");
    expect(context).toContain(
      "ดูธาตุถ่ายเท (Output) เป็นหลักเพื่อดูการแสดงออก",
    );
    expect(context).toContain("แหล่งอ้างอิง: 1.นิสัยโดยพื้นฐาน");
    expect(context).toContain("1.1 ทายนิสัยตามดิถีแข็ง-ดิถีอ่อนแอ");
  });
});