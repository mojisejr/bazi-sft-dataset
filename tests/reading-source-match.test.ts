import { describe, expect, test } from "vitest";

import { KNOWLEDGE_CATALOG } from "@/lib/bazi/knowledge/knowledge-catalog";
import { fillTemplate } from "@/lib/bazi/knowledge/knowledge-overlay-context";
import {
  buildTemplateRegex,
  compileKnowledgeTables,
  resolveParagraphSources,
  type KnowledgeTableLite,
} from "@/lib/bazi/reading-source-match";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildTopicHumanReading, MISC_TEMPLATE_TH } from "@/lib/bazi/topic-knowledge";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

/** จำลอง KnowledgeTableLite ที่ UI ได้รับจาก /api/reading/knowledge-override (incl. keyLabel จาก entryLabels) */
function catalogTables(): KnowledgeTableLite[] {
  return KNOWLEDGE_CATALOG.map((e) => ({
    tableId: e.tableId,
    label: e.label,
    entries: Object.keys(e.defaults).map((key) => ({
      key,
      keyLabel: e.entryLabels?.[key] ?? key,
      default: (e.defaults as Record<string, string>)[key],
      published: null,
      draft: null,
    })),
  }));
}

function tableFrom(tableId: string, label: string, defaults: Record<string, string>): KnowledgeTableLite {
  return {
    tableId,
    label,
    entries: Object.keys(defaults).map((key) => ({ key, default: defaults[key], published: null, draft: null })),
  };
}

describe("reading-source-match: chip จับย่อหน้าที่มาจาก fillTemplate", () => {
  const compiled = compileKnowledgeTables([tableFrom("MISC_TEMPLATE_TH", "MISC", MISC_TEMPLATE_TH)]);

  test("ย่อหน้าจาก template (wealthChainLead) → full=true, exact=false, ชี้ key ถูก", () => {
    const para = fillTemplate(
      "MISC_TEMPLATE_TH",
      MISC_TEMPLATE_TH,
      { "ดิถี": "ดิน", "ถ่ายเท": "ทอง", "ลาภ": "น้ำ" },
      "wealthChainLead",
    );
    const s = resolveParagraphSources(para, compiled).find((x) => x.key === "wealthChainLead");
    expect(s).toBeDefined();
    expect(s!.full).toBe(true);
    expect(s!.exact).toBe(false); // template → publish กลับไม่ได้ (จะทับ {placeholder})
    expect(s!.tableId).toBe("MISC_TEMPLATE_TH");
  });

  test("template หลายตัวแปร (careerWealthCustomer) ก็ full-match", () => {
    const para = fillTemplate(
      "MISC_TEMPLATE_TH",
      MISC_TEMPLATE_TH,
      { "ธาตุ": "น้ำ", "เนื้อหา": "กลุ่มคนค้าขาย เดินทาง บริการ" },
      "careerWealthCustomer",
    );
    expect(resolveParagraphSources(para, compiled).find((x) => x.key === "careerWealthCustomer")?.full).toBe(true);
  });

  test("constant ตรงเป๊ะ → exact=true, full=true", () => {
    const c = compileKnowledgeTables([tableFrom("X", "X", { a: "ข้อความคงที่ยาวพอสมควรไม่มีตัวแปรเลย" })]);
    const s = resolveParagraphSources("ข้อความคงที่ยาวพอสมควรไม่มีตัวแปรเลย", c).find((x) => x.key === "a");
    expect(s?.exact).toBe(true);
    expect(s?.full).toBe(true);
  });

  test("template literal สั้น/placeholder ล้วน → ไม่ match (กัน false positive)", () => {
    expect(buildTemplateRegex("{a} {b}")).toBeNull();
    expect(buildTemplateRegex("{a} → {b}")).toBeNull();
    const c = compileKnowledgeTables([tableFrom("Y", "Y", { tiny: "{a} {b}", arrow: "{a} → {b}" })]);
    expect(resolveParagraphSources("อะไรก็ได้ที่ยาวพอ → บลาๆ", c)).toHaveLength(0);
  });
});

describe("reading-source-match: integration กับ output จริงของ engine (เคสในภาพผู้ใช้)", () => {
  test("บทโชคลาภ: ย่อหน้า 'สายโซ่' + 'ดาวโชคลาภไม่เด่น' ได้ chip เต็ม (ไม่ 'บางส่วน')", async () => {
    const repo = createTestKnowledgeRepository();
    const raw = RawInputSchema.parse({
      birthDate: "1966-09-29",
      birthTime: "11:44",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziChart(raw, repo);
    const human = buildTopicHumanReading(state, "wealth_and_investment", raw) ?? "";
    // เลียน splitBoxParagraphs ของ UI: ตัด box-marker [[box=…]] และหัวข้อ **…** (โครงสร้าง ไม่ใช่เนื้อหา)
    const paras = human
      .replace(/\r/g, "")
      .replace(/\[\[[^\]]*\]\]/g, "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && !/^\*\*[^\n]*\*\*$/.test(p));
    const compiled = compileKnowledgeTables(catalogTables());

    const chainPara = paras.find((p) => p.startsWith("อ่านโชคลาภเป็นสายโซ่"));
    expect(chainPara, "ต้องมีย่อหน้าสายโซ่").toBeTruthy();
    const chainFull = resolveParagraphSources(chainPara!, compiled).find((s) => s.full);
    expect(chainFull?.key).toBe("wealthChainLead");
    expect(chainFull?.keyLabel).toBe("สายโซ่โชคลาภ (ดิถี→ถ่ายเท→ลาภ)"); // chip โชว์ label รายช่อง

    // ทุกย่อหน้าเนื้อหา (>=20 ตัว) อย่างน้อยต้องมี source สักอัน — ไม่มี "ย่อหน้าลอย"
    const orphans = paras.filter((p) => p.length >= 20 && resolveParagraphSources(p, compiled).length === 0);
    expect(orphans, `ย่อหน้าไม่มีอ้างอิงเลย:\n${orphans.join("\n---\n")}`).toHaveLength(0);
  });

  test("ทุกบท: ย่อหน้าเนื้อหาไม่มี 'ย่อหน้าลอย' (ไม่มี chip เลย)", async () => {
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
    const compiled = compileKnowledgeTables(catalogTables());
    const predictTopics = TOPIC_PATH.filter((t) => t.kind === "predict");
    const report: string[] = [];
    for (const topic of predictTopics) {
      const human = buildTopicHumanReading(state, topic.id, raw) ?? "";
      const paras = human
        .replace(/\r/g, "")
        .replace(/\[\[[^\]]*\]\]/g, "")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && !/^\*\*[^\n]*\*\*$/.test(p));
      for (const p of paras) {
        // ตัด bullet/รายการย่อย (ขึ้นต้น • หรือ -) — พวกนี้เป็นชิ้นในย่อหน้าใหญ่ ไม่ใช่ย่อหน้าหลัก
        if (p.length < 25 || /^[•\-]/.test(p)) continue;
        if (resolveParagraphSources(p, compiled).length === 0) {
          report.push(`[${topic.id}] ${p.slice(0, 70)}`);
        }
      }
    }
    expect(report, `ย่อหน้าไม่มีอ้างอิง (${report.length}):\n${report.join("\n")}`).toHaveLength(0);
  }, 30000);

  test("ทุกบท: ไม่มี chip ซ้ำ (label+full เหมือนกัน) ในย่อหน้าเดียว", async () => {
    const repo = createTestKnowledgeRepository();
    const raw = RawInputSchema.parse({
      birthDate: "1966-09-29",
      birthTime: "11:44",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziChart(raw, repo);
    const compiled = compileKnowledgeTables(catalogTables());
    const dups: string[] = [];
    for (const topic of TOPIC_PATH.filter((t) => t.kind === "predict")) {
      const human = buildTopicHumanReading(state, topic.id, raw) ?? "";
      const paras = human
        .replace(/\r/g, "")
        .replace(/\[\[[^\]]*\]\]/g, "")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
      for (const p of paras) {
        const sources = resolveParagraphSources(p, compiled);
        // chip ที่ผู้ใช้เห็น = (label ที่โชว์) + full → ต้องไม่ซ้ำ
        const seen = new Set<string>();
        for (const s of sources) {
          const shown = `${s.full && !s.exact ? s.keyLabel : s.label}|${s.full}`;
          if (seen.has(shown)) dups.push(`[${topic.id}] ${shown} :: ${p.slice(0, 50)}`);
          seen.add(shown);
        }
      }
    }
    expect(dups, `chip ซ้ำ (${dups.length}):\n${dups.join("\n")}`).toHaveLength(0);
  }, 30000);

  test("dayPillarLine: chip ข้อมูลคู่ครองเหลืออันเดียว ลิงก์ key ที่ตรงดวง", async () => {
    const repo = createTestKnowledgeRepository();
    const raw = RawInputSchema.parse({
      birthDate: "1966-09-29",
      birthTime: "11:44",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziChart(raw, repo);
    const human = buildTopicHumanReading(state, "love_partner", raw) ?? "";
    const paras = human
      .replace(/\r/g, "")
      .replace(/\[\[[^\]]*\]\]/g, "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const compiled = compileKnowledgeTables(catalogTables());
    const dayPara = paras.find((p) => p.startsWith("ลักษณะคู่ครอง (ตารางหลักวัน"));
    expect(dayPara, "ต้องมีย่อหน้า dayPillarLine").toBeTruthy();
    const sources = resolveParagraphSources(dayPara!, compiled);
    const spouseChips = sources.filter((s) => s.tableId === "LOVE_DAY_SPOUSE_TH");
    expect(spouseChips, "chip ข้อมูลคู่ครองต้องเหลืออันเดียว").toHaveLength(1);
    // ลิงก์ไปแถวที่ตรงดวง: ทุกส่วนของ composite key (เช่น "辛|卯") ต้องปรากฏในย่อหน้า
    for (const part of spouseChips[0].key.split("|")) {
      expect(dayPara, `key part ${part} ต้องอยู่ในย่อหน้า`).toContain(part);
    }
  });
});
