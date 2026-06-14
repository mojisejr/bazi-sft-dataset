import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import {
  buildTopicConsumerReading,
  buildTopicHumanReading,
  getTopicKnownlageExcerpt,
} from "@/lib/bazi/topic-knowledge";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { KNOWLEDGE_CATALOG } from "@/lib/bazi/knowledge/knowledge-catalog";
import {
  CONDITION_CATEGORY_ORDER,
  CONDITION_TABLE_CATEGORY,
  miscEntryCategory,
} from "@/lib/bazi/knowledge/condition-categories";
import { BAZI_TOPIC_REGISTRY } from "@/lib/bazi/knowledge/topic-registry";
import { EMPTY_OVERLAY } from "@/lib/bazi/knowledge/knowledge-overlay";
import {
  runWithKnowledgeOverlay,
  setKnowledgeAccessRecorder,
} from "@/lib/bazi/knowledge/knowledge-overlay-context";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

/**
 * Guardrail (เฟส 3): องค์ความรู้ทุกตารางที่ engine "อ่านจริง" ต้องอยู่ใน KNOWLEDGE_CATALOG
 * (= แก้ออนไลน์ได้) และทุกตารางใน catalog ต้องถูกใช้จริง (ไม่มีตาราง "ตาย" ในตัวแก้)
 *
 * ทิศ A: runtime — generate reading หลายดวง × ทุกบท + ดัก tableId ที่ K()/KC()/fillTemplate อ่าน
 *        แล้ว assert accessed ⊆ catalog (ป้องกัน knowledge หลุดจากตัวแก้ เช่นอ่าน const ตรง ๆ)
 * ทิศ B: static — catalog tableId ทุกตัวต้องปรากฏเป็น string-literal ในไฟล์ engine
 *        (ป้องกัน catalog entry ที่ไม่มีใครอ่าน เช่น const ที่ถูกลบทิ้งไปแล้ว)
 */

// ดวงหลากหลายให้ครอบ band/เพศ/ฤดู (ยืม 3 ดวงจาก snapshot + เพิ่มกรณีสุดขั้ว)
const CHARTS = [
  { birthDate: "1966-09-29", birthTime: "11:44", gender: "female" as const },
  { birthDate: "1988-05-17", birthTime: "07:20", gender: "male" as const },
  { birthDate: "1993-11-24", birthTime: "15:09", gender: "male" as const },
  { birthDate: "1975-01-08", birthTime: "03:30", gender: "female" as const },
  { birthDate: "2001-07-22", birthTime: "21:15", gender: "female" as const },
  { birthDate: "1959-12-31", birthTime: "18:45", gender: "male" as const },
];

const PREDICT_TOPICS = TOPIC_PATH.filter((topic) => topic.kind === "predict");
const CATALOG_IDS = new Set(KNOWLEDGE_CATALOG.map((entry) => entry.tableId));

const ENGINE_SOURCE_FILES = [
  "src/lib/bazi/topic-knowledge.ts",
  "src/lib/bazi/reading-phrases.ts",
  "src/lib/bazi/talent-aptitude.ts",
];

afterEach(() => setKnowledgeAccessRecorder(null));

describe("knowledge catalog coverage (guardrail)", () => {
  test("ทิศ A: ทุกตารางที่ engine อ่านจริง อยู่ใน catalog (แก้ออนไลน์ได้)", async () => {
    const accessed = new Set<string>();
    setKnowledgeAccessRecorder((tableId) => accessed.add(tableId));

    for (const chart of CHARTS) {
      const repo = createTestKnowledgeRepository();
      const raw = RawInputSchema.parse({
        ...chart,
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      });
      const state = await calculateBaziChart(raw, repo);
      runWithKnowledgeOverlay(EMPTY_OVERLAY, () => {
        for (const topic of PREDICT_TOPICS) {
          buildTopicHumanReading(state, topic.id, raw);
          buildTopicConsumerReading(state, topic.id, raw);
          getTopicKnownlageExcerpt(state, topic.id, raw);
        }
      });
    }
    setKnowledgeAccessRecorder(null);

    // sanity: ต้องดักได้จริง (กัน recorder พัง = ทดสอบหลอก)
    expect(accessed.size).toBeGreaterThan(20);

    const missingFromCatalog = [...accessed].filter((id) => !CATALOG_IDS.has(id)).sort();
    expect(
      missingFromCatalog,
      `ตารางที่ engine อ่านแต่ catalog ไม่มี (แก้ออนไลน์ไม่ได้) — เพิ่มลง KNOWLEDGE_CATALOG: ${missingFromCatalog.join(", ")}`,
    ).toEqual([]);
  });

  test("ทิศ B: ทุก catalog tableId ถูกอ้างเป็น string-literal ในไฟล์ engine (ไม่มีตาราง 'ตาย')", () => {
    const source = ENGINE_SOURCE_FILES.map((file) =>
      readFileSync(resolve(process.cwd(), file), "utf8"),
    ).join("\n");

    const dead = [...CATALOG_IDS]
      .filter((id) => !source.includes(`"${id}"`) && !source.includes(`'${id}'`))
      .sort();
    expect(
      dead,
      `catalog tableId ที่ไม่มีใครอ้างในไฟล์ engine (โค้ดตาย/แก้แล้วไม่มีผล) — ลบออกจาก catalog หรือ wire ให้ engine อ่าน: ${dead.join(", ")}`,
    ).toEqual([]);
  });

  test("catalog ไม่มี tableId ซ้ำ", () => {
    const ids = KNOWLEDGE_CATALOG.map((entry) => entry.tableId);
    const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dups, `tableId ซ้ำใน catalog: ${dups.join(", ")}`).toEqual([]);
  });

  test("registry: ทุกบทมีหลักการซินแส/แหล่งอ้างอิงให้แก้ได้อย่างน้อย 1 รายการ", () => {
    const empty = BAZI_TOPIC_REGISTRY.filter(
      (topic) => topic.sinsaeLogicRules.length === 0 && topic.sourceRefs.length === 0,
    ).map((topic) => topic.id);
    expect(empty, `บทที่ไม่มีอะไรให้แก้ใน registry: ${empty.join(", ")}`).toEqual([]);
  });

  // ตาราง raw ทุกตัวต้องมีหมวด + ทุก key ของ MISC ต้อง map เข้าหมวดที่รู้จัก (ตัวแก้คลังจัดกลุ่มได้)
  test("condition categories: raw ทุกตารางมีหมวด + MISC ทุก key map หมวดที่ถูกต้อง", () => {
    const rawIds = KNOWLEDGE_CATALOG.filter((e) => e.keyKind === "raw").map((e) => e.tableId);
    const order = new Set(CONDITION_CATEGORY_ORDER);
    const missing = rawIds.filter((id) => id !== "MISC_TEMPLATE_TH" && !CONDITION_TABLE_CATEGORY[id]);
    expect(missing, `ตาราง raw ไม่มีหมวด: ${missing.join(", ")}`).toEqual([]);
    // ทุกหมวดที่ใช้ต้องอยู่ใน CONDITION_CATEGORY_ORDER
    const badTableCat = Object.entries(CONDITION_TABLE_CATEGORY).filter(([, c]) => !order.has(c));
    expect(badTableCat, `หมวดไม่รู้จัก: ${badTableCat.map(([t]) => t).join(", ")}`).toEqual([]);
    const misc = KNOWLEDGE_CATALOG.find((e) => e.tableId === "MISC_TEMPLATE_TH");
    const badMisc = Object.keys(misc?.defaults ?? {}).filter((k) => !order.has(miscEntryCategory(k)));
    expect(badMisc, `MISC key map หมวดไม่รู้จัก: ${badMisc.join(", ")}`).toEqual([]);
  });

  // ตาราง template (มี placeholder {…}) ต้องมี label รายช่อง เพื่อให้ chip อ้างอิงอ่านรู้เรื่อง
  test("ตาราง template: entryLabels ครบทุก key (กัน chip ไม่มีชื่อช่อง)", () => {
    const problems: string[] = [];
    for (const entry of KNOWLEDGE_CATALOG) {
      const isTemplate = Object.values(entry.defaults).some((v) => /\{[^{}]+\}/.test(v));
      if (!isTemplate) continue;
      if (!entry.entryLabels) {
        problems.push(`${entry.tableId}: ไม่มี entryLabels เลย`);
        continue;
      }
      const missing = Object.keys(entry.defaults).filter((k) => !entry.entryLabels?.[k]?.trim());
      if (missing.length > 0) problems.push(`${entry.tableId}: ขาด label ${missing.join(", ")}`);
      const extra = Object.keys(entry.entryLabels).filter((k) => !(k in entry.defaults));
      if (extra.length > 0) problems.push(`${entry.tableId}: label เกิน ${extra.join(", ")}`);
    }
    expect(problems, `entryLabels ไม่ครบ:\n${problems.join("\n")}`).toEqual([]);
  });
});
