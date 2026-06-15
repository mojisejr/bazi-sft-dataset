import { describe, expect, test } from "vitest";

import { KNOWLEDGE_CATALOG } from "@/lib/bazi/knowledge/knowledge-catalog";
import {
  buildTopicHumanReading,
  getStandaloneCoreDescriptions,
} from "@/lib/bazi/topic-knowledge";
import {
  SIXTY_JIAZI_ID,
  STANDALONE_EDITABLE_TABLES,
  STEM_STRENGTH_MATRIX_ID,
  TWELVE_NAKSHATRA_ID,
  getStandaloneEntry,
} from "@/lib/bazi/knowledge/standalone-tables";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { EMPTY_OVERLAY, type KnowledgeOverlay } from "@/lib/bazi/knowledge/knowledge-overlay";
import { runWithKnowledgeOverlay } from "@/lib/bazi/knowledge/knowledge-overlay-context";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

describe("standalone editable tables (core data)", () => {
  test("เมทริกซ์ 10 ราศีบน × 5 ดิถี = 50 ช่อง (เริ่มต้นว่าง)", () => {
    const entry = getStandaloneEntry(STEM_STRENGTH_MATRIX_ID);
    expect(entry).toBeDefined();
    const keys = Object.keys(entry!.defaults);
    expect(keys).toHaveLength(50);
    expect(keys.every((k) => entry!.defaults[k] === "")).toBe(true);
    // composite key รูป `{stem}|{band}` แตกได้ถูกต้อง
    expect(keys.every((k) => k.split("|").length === 2)).toBe(true);
  });

  test("12 นักษัตร = 12 ช่อง (default มีจีน + ไทย + ธาตุ)", () => {
    const entry = getStandaloneEntry(TWELVE_NAKSHATRA_ID);
    expect(entry).toBeDefined();
    expect(Object.keys(entry!.defaults)).toHaveLength(12);
    expect(entry!.defaults["子"]).toContain("ชวด");
    expect(entry!.defaults["子"]).toContain("ธาตุน้ำ");
  });

  test("60 กะจี่อ = 60 ช่องครบ ไม่ซ้ำ", () => {
    const entry = getStandaloneEntry(SIXTY_JIAZI_ID);
    expect(entry).toBeDefined();
    const keys = Object.keys(entry!.defaults);
    expect(keys).toHaveLength(60);
    expect(new Set(keys).size).toBe(60);
    expect(keys[0]).toBe("甲子");
    expect(keys[59]).toBe("癸亥");
  });

  test("tableId ของตารางอิสระไม่ชนกับ KNOWLEDGE_CATALOG (กัน guardrail engine-sync)", () => {
    const catalogIds = new Set(KNOWLEDGE_CATALOG.map((e) => e.tableId));
    const clashes = STANDALONE_EDITABLE_TABLES.filter((e) => catalogIds.has(e.tableId));
    expect(clashes.map((e) => e.tableId)).toEqual([]);
  });

  test("คำบรรยายตั้งต้น: 60 กะจี่อ ครบ + 12 นักษัตร ดึงจากไฟล์ 'นิสัย 12 นักษัตร'", () => {
    const { nakshatra, jiazi } = getStandaloneCoreDescriptions();
    expect(Object.keys(jiazi)).toHaveLength(60);
    expect(Object.keys(nakshatra)).toHaveLength(12);
    // jiazi มีโครง ก้าน/กิ่ง/ธาตุ ครบ
    expect(jiazi["甲子"]).toContain("ก้าน 甲:");
    expect(jiazi["甲子"]).toContain("กิ่ง 子:");
    // นักษัตร 子 = เนื้อหาจากไฟล์ "นิสัย 12 นักษัตร" (วลีเฉพาะที่ไม่มีในแหล่งเดิม)
    expect(nakshatra["子"]).toContain("เฉลียวฉลาด");
    // 辰 ต้องอ่านได้ (กัน bug codepoint U+F971)
    expect(nakshatra["辰"]).toContain("จินตนาการ");
  });

  test("มีเฉพาะ 3 ตารางอิสระ (ยังไม่เปิดกล่อง 4/5/6)", () => {
    expect(STANDALONE_EDITABLE_TABLES.map((e) => e.tableId)).toEqual([
      STEM_STRENGTH_MATRIX_ID,
      TWELVE_NAKSHATRA_ID,
      SIXTY_JIAZI_ID,
    ]);
  });
});

/** ครอบทั้งหมด 6 ตาราง: เติม sentinel ทุกช่อง → ผลทายต้องมี sentinel ครบ (ยืนยัน wiring + แทนที่) */
function overlayAllSentinel(): KnowledgeOverlay {
  const tables: Record<string, Record<string, string>> = {};
  for (const entry of STANDALONE_EDITABLE_TABLES) {
    tables[entry.tableId] = {};
    for (const key of Object.keys(entry.defaults)) {
      tables[entry.tableId][key] = `OVR::${entry.tableId}`;
    }
  }
  return { tables, appends: {}, registry: {} };
}

describe("เชื่อมตารางอิสระเข้าบท 1 (chart_foundation)", () => {
  async function buildState() {
    const repo = createTestKnowledgeRepository();
    const raw = RawInputSchema.parse({
      birthDate: "1988-05-17",
      birthTime: "07:20",
      gender: "male",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziChart(raw, repo);
    return { state, raw };
  }

  test("ช่องมีข้อความ → แทนที่เนื้อหากล่อง (ครบทั้ง 6 ตาราง)", async () => {
    const { state, raw } = await buildState();
    const reading = runWithKnowledgeOverlay(overlayAllSentinel(), () =>
      buildTopicHumanReading(state, "chart_foundation", raw),
    );
    for (const entry of STANDALONE_EDITABLE_TABLES) {
      expect(reading).toContain(`OVR::${entry.tableId}`);
    }
  });

  test("overlay ว่าง → ใช้ข้อความเดิม (ไม่มี sentinel)", async () => {
    const { state, raw } = await buildState();
    const reading = runWithKnowledgeOverlay(EMPTY_OVERLAY, () =>
      buildTopicHumanReading(state, "chart_foundation", raw),
    );
    expect(reading).not.toContain("OVR::");
    expect((reading ?? "").length).toBeGreaterThan(0);
  });
});
