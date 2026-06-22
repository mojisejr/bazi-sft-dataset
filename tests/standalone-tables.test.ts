import { describe, expect, test } from "vitest";

import { KNOWLEDGE_CATALOG } from "@/lib/bazi/knowledge/knowledge-catalog";
import { getStandaloneCoreDescriptions } from "@/lib/bazi/topic-knowledge";
import {
  ELEMENT_LEARNING_BANK_ID,
  STANDALONE_EDITABLE_TABLES,
  SUBORDINATE_MATCHING_ID,
} from "@/lib/bazi/knowledge/standalone-tables";

describe("standalone editable tables (core data)", () => {
  test("tableId ของตารางอิสระไม่ชนกับ KNOWLEDGE_CATALOG (กัน guardrail engine-sync)", () => {
    const catalogIds = new Set(KNOWLEDGE_CATALOG.map((e) => e.tableId));
    const clashes = STANDALONE_EDITABLE_TABLES.filter((e) => catalogIds.has(e.tableId));
    expect(clashes.map((e) => e.tableId)).toEqual([]);
  });

  test("เหลือ 2 ตารางอิสระ (บท 10 บริวาร + บท 11 คลังเรียน) — 50/12/60 ย้ายไป NewData แล้ว", () => {
    expect(STANDALONE_EDITABLE_TABLES.map((e) => e.tableId)).toEqual([
      SUBORDINATE_MATCHING_ID,
      ELEMENT_LEARNING_BANK_ID,
    ]);
  });

  test("คำบรรยายตั้งต้น 60 กะจื่อ + 12 นักษัตร (ตัวที่ seed NewData reuse)", () => {
    const { nakshatra, jiazi } = getStandaloneCoreDescriptions();
    expect(Object.keys(jiazi)).toHaveLength(60);
    expect(Object.keys(nakshatra)).toHaveLength(12);
    expect(jiazi["甲子"]).toContain("ก้าน 甲:");
    expect(jiazi["甲子"]).toContain("กิ่ง 子:");
    expect(nakshatra["子"]).toContain("เฉลียวฉลาด");
    // 辰 ต้องอ่านได้ (กัน bug codepoint U+F971)
    expect(nakshatra["辰"]).toContain("จินตนาการ");
  });
});
