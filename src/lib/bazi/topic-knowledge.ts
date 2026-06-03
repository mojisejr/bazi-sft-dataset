import { readFileSync } from "node:fs";
import path from "node:path";

import type { CalculatedStateValue, RawInputValue, SupportedElementValue } from "@/lib/bazi/schema-types";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import {
  BRANCH_TO_ELEMENT,
  CONTROLS,
  ELEMENT_LABELS_TH,
  GENERATES,
  PILLAR_CONTEXT_MAP,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";

/**
 * อ่าน "องค์ความรู้ภาษามนุษย์" จากโฟลเดอร์ `knownlage/` (ของจริง ไม่ใช่ AI)
 * เพื่อใช้เป็นบล็อก "ผลการทำนาย" ใต้คำอ่านของแต่ละหัวข้อ.
 *
 * รอบนี้รองรับเฉพาะไฟล์ที่เป็น .txt และคีย์ชัด:
 *  - ลักษณะนิสัย60แบบ_ราศีบน-ล่าง_12เซี่ยงแซ.txt → ใช้กับ chart_foundation / talent
 * หัวข้ออื่นยังเป็น .docx (ยังไม่แตกเป็น txt) จึงคืน null และถูกรายงานใน coverage.
 *
 * server-side เท่านั้น (อ่าน fs) — ห้าม import จาก client component.
 */

const KNOWLEDGE_DIR = path.resolve(process.cwd(), "knownlage");
const PERSONALITY_FILE = "ลักษณะนิสัย60แบบ_ราศีบน-ล่าง_12เซี่ยงแซ.txt";

const HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const ELEMENT_WORDS = new Set(["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"]);

type PersonalityRecord = {
  stemText: string;
  branchText: string;
  elementLabel: string;
  qiLabel: string;
  elementText: string;
};

type PersonalityIndex = {
  stemText: Map<string, string>;
  byStemBranch: Map<string, PersonalityRecord>;
};

let cachedPersonality: PersonalityIndex | null | undefined;

function splitRow(line: string): string[] {
  return line.split(" : ").map((part) => part.trim());
}

function parsePersonalityFile(): PersonalityIndex | null {
  let raw: string;
  try {
    raw = readFileSync(path.join(KNOWLEDGE_DIR, PERSONALITY_FILE), "utf8");
  } catch {
    return null;
  }

  const stemText = new Map<string, string>();
  const byStemBranch = new Map<string, PersonalityRecord>();

  let currentStem: string | null = null;
  let pendingBranch: string | null = null;
  let pendingBranchText = "";

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("===")) {
      // หยุดที่ section ที่สอง (นิสัยเฉพาะราศีล่าง) เพราะ section แรกมีครบ triple
      if (line.startsWith("===") && stemText.size > 0) {
        break;
      }
      continue;
    }

    const parts = splitRow(line);
    if (parts.length < 3) {
      continue;
    }

    const [col0, col1, ...rest] = parts;
    const text = rest.join(" : ").trim();

    // บรรทัด stem: คอลัมน์ 2 เป็นอักษรจีนก้าน (เชื่อถือได้กว่า prefix ไทย)
    if (HEAVENLY_STEMS.includes(col1)) {
      currentStem = col1;
      if (!stemText.has(col1)) {
        stemText.set(col1, text);
      }
      continue;
    }

    // บรรทัดกิ่ง: คอลัมน์ 1 เป็นตัวเลข, คอลัมน์ 2 เป็นอักษรจีนกิ่ง
    if (/^\d+$/.test(col0) && EARTHLY_BRANCHES.includes(col1)) {
      pendingBranch = col1;
      pendingBranchText = text;
      continue;
    }

    // บรรทัดธาตุ:เชี่ยงแซ → ปิด record ของ (stem, branch) ปัจจุบัน
    if (ELEMENT_WORDS.has(col0) && currentStem && pendingBranch) {
      byStemBranch.set(`${currentStem}|${pendingBranch}`, {
        stemText: stemText.get(currentStem) ?? "",
        branchText: pendingBranchText,
        elementLabel: col0,
        qiLabel: col1,
        elementText: text,
      });
      pendingBranch = null;
      pendingBranchText = "";
    }
  }

  if (byStemBranch.size === 0) {
    return null;
  }

  return { stemText, byStemBranch };
}

function getPersonalityIndex(): PersonalityIndex | null {
  if (cachedPersonality === undefined) {
    cachedPersonality = parsePersonalityFile();
  }
  return cachedPersonality;
}

// ───────────────────────── Batch 1: knowledge จาก docx ที่แตกเป็น txt ─────────────────────────

const EXTRACTED_DIR = path.join(KNOWLEDGE_DIR, "extracted");
const THAI_ELEMENTS = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"] as const;
type ThaiElement = (typeof THAI_ELEMENTS)[number];
type StrengthBand = "very-weak" | "weak" | "balanced" | "strong" | "very-strong";

const extractedCache = new Map<string, string[] | null>();

function readExtractedLines(file: string): string[] | null {
  if (!extractedCache.has(file)) {
    try {
      const raw = readFileSync(path.join(EXTRACTED_DIR, file), "utf8");
      extractedCache.set(file, raw.split("\n").map((line) => line.trim()));
    } catch {
      extractedCache.set(file, null);
    }
  }
  return extractedCache.get(file) ?? null;
}

function elementLabel(element: SupportedElementValue): ThaiElement {
  return ELEMENT_LABELS_TH[element] as ThaiElement;
}

function dayMasterElement(calculatedState: CalculatedStateValue): SupportedElementValue {
  return (STEM_TO_ELEMENT[calculatedState.dayMaster as keyof typeof STEM_TO_ELEMENT] ?? "wood") as SupportedElementValue;
}

function resolveStrengthBand(calculatedState: CalculatedStateValue): StrengthBand {
  try {
    return classifyOperatorStrengthScore(calculatedState.strengthScore).id as StrengthBand;
  } catch {
    return "balanced";
  }
}

/** ธาตุที่ดวงต้องการ (useful god) ตามตาราง Source7 ข้อ 1 → คืนเป็นป้ายไทย เรียงตามลำดับความสำคัญ */
function resolveUsefulElements(calculatedState: CalculatedStateValue): ThaiElement[] {
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue; // ถ่ายเท
  const wealth = CONTROLS[dm] as SupportedElementValue; // พิฆาต/ลาภ
  const same = dm; // คู่ธาตุ
  const resource = (Object.keys(GENERATES) as SupportedElementValue[]).find(
    (element) => GENERATES[element] === dm,
  ) as SupportedElementValue; // ส่งเสริม

  const band = resolveStrengthBand(calculatedState);
  const roleMap: Record<StrengthBand, SupportedElementValue[]> = {
    "very-strong": [output],
    strong: [wealth],
    balanced: [output, wealth],
    weak: [resource, same],
    "very-weak": [same],
  };

  const ordered = roleMap[band].map(elementLabel);
  return [...new Set(ordered)];
}

/** ธาตุที่อ่อนแอในดวง (ป้ายไทย) จาก elementAnalysis */
function resolveWeakElements(calculatedState: CalculatedStateValue): ThaiElement[] {
  const labels = new Set<ThaiElement>();
  for (const element of calculatedState.elementAnalysis.missingElements) {
    labels.add(elementLabel(element));
  }
  for (const entry of calculatedState.elementAnalysis.elementStrengths) {
    if (entry.strength === "weak" || entry.strength === "missing") {
      labels.add(elementLabel(entry.element));
    }
  }
  return [...labels];
}

/** health.txt: ธาตุ{E}ในดวงอ่อนแอ ... / คือ {อวัยวะ} */
function parseHealthByElement(): Map<ThaiElement, string> | null {
  const lines = readExtractedLines("health.txt");
  if (!lines) {
    return null;
  }
  const map = new Map<ThaiElement, string>();
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^ธาตุ(ไม้|ไฟ|ดิน|ทอง|น้ำ)ในดวงอ่อนแอ/);
    if (!match) {
      continue;
    }
    const next = lines.slice(i + 1).find((line) => line.startsWith("คือ"));
    if (next) {
      map.set(match[1] as ThaiElement, next.replace(/^คือ\s*/, "").trim());
    }
  }
  return map.size > 0 ? map : null;
}

/** wealth.txt 1.1: หากหลักวันราศีบน มีความ{band}... → verdict ต่อ strength band */
function parseWealthByBand(): Map<StrengthBand, string> | null {
  const lines = readExtractedLines("wealth.txt");
  if (!lines) {
    return null;
  }
  const map = new Map<StrengthBand, string>();
  for (const line of lines) {
    if (!line.startsWith("หากหลักวันราศีบน")) {
      continue;
    }
    if (line.includes("แข็งแรงเกินไป")) {
      map.set("very-strong", line);
    } else if (line.includes("แข็งแรง/สมดุล")) {
      map.set("strong", line);
      map.set("balanced", line);
    } else if (line.includes("อ่อนแอเกินไป")) {
      map.set("very-weak", line);
    } else if (line.includes("อ่อนแอ")) {
      map.set("weak", line);
    }
  }
  return map.size > 0 ? map : null;
}

/** Source7 element-keyed section: หลัง marker, แต่ละบล็อก = บรรทัดชื่อธาตุ + field ตามจำนวน */
function parseSource7ElementSection(marker: string, fieldCount: number): Map<ThaiElement, string[]> | null {
  const lines = readExtractedLines("source7-enhancement.txt");
  if (!lines) {
    return null;
  }
  const start = lines.findIndex((line) => line.startsWith(marker));
  if (start === -1) {
    return null;
  }
  const map = new Map<ThaiElement, string[]>();
  let current: ThaiElement | null = null;
  let fields: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    // เจอ section ถัดไป (เช่น "2.2", "2.3", "3.") → จบ
    if (/^\d+(\.\d+)?\s/.test(line) || /^\d+\.\s/.test(line)) {
      break;
    }
    if ((THAI_ELEMENTS as readonly string[]).includes(line)) {
      if (current && fields.length > 0) {
        map.set(current, fields);
      }
      current = line as ThaiElement;
      fields = [];
      continue;
    }
    if (current && fields.length < fieldCount) {
      fields.push(line);
    }
  }
  if (current && fields.length > 0) {
    map.set(current, fields);
  }
  return map.size > 0 ? map : null;
}

/** Source7 2.3: ธาตุ{E}: {อาชีพ} (บรรทัดเดียวต่อธาตุ) */
function parseSource7Careers(): Map<ThaiElement, string> | null {
  const lines = readExtractedLines("source7-enhancement.txt");
  if (!lines) {
    return null;
  }
  const map = new Map<ThaiElement, string>();
  for (const line of lines) {
    const match = line.match(/^ธาตุ(ไม้|ไฟ|ดิน|ทอง|น้ำ):\s*(.+)$/);
    if (match) {
      map.set(match[1] as ThaiElement, match[2].trim());
    }
  }
  return map.size > 0 ? map : null;
}

function buildPersonalityReading(calculatedState: CalculatedStateValue): string | null {
  const index = getPersonalityIndex();
  if (!index) {
    return null;
  }
  const dayStem = calculatedState.dayMaster;
  const dayBranch = calculatedState.fourPillars.day.branch;
  const record = index.byStemBranch.get(`${dayStem}|${dayBranch}`);
  if (!record) {
    return null;
  }
  const segments = [
    record.stemText ? `ดิถี ${dayStem}: ${record.stemText}` : null,
    record.branchText ? `ราศีล่างวัน ${dayBranch}: ${record.branchText}` : null,
    record.elementText ? `${record.elementLabel} ${record.qiLabel}: ${record.elementText}` : null,
  ].filter((segment): segment is string => Boolean(segment));
  return segments.length > 0 ? segments.join("\n\n") : null;
}

function buildHealthReading(calculatedState: CalculatedStateValue): string | null {
  const map = parseHealthByElement();
  if (!map) {
    return null;
  }
  const weak = resolveWeakElements(calculatedState);
  const segments = weak
    .map((element) => (map.has(element) ? `ธาตุ${element}อ่อนแอ: ${map.get(element)}` : null))
    .filter((segment): segment is string => Boolean(segment));
  return segments.length > 0 ? segments.join("\n\n") : null;
}

function buildWealthReading(calculatedState: CalculatedStateValue): string | null {
  const map = parseWealthByBand();
  if (!map) {
    return null;
  }
  return map.get(resolveStrengthBand(calculatedState)) ?? null;
}

function buildUsefulElementReading(
  calculatedState: CalculatedStateValue,
  section: Map<ThaiElement, string[]> | Map<ThaiElement, string> | null,
  format: (element: ThaiElement, value: string[] | string) => string,
): string | null {
  if (!section) {
    return null;
  }
  const useful = resolveUsefulElements(calculatedState);
  const segments = useful
    .map((element) => (section.has(element) ? format(element, section.get(element)!) : null))
    .filter((segment): segment is string => Boolean(segment));
  return segments.length > 0 ? segments.join("\n\n") : null;
}

// ───────── Batch 2: วัยจร (luck-cycle.txt) คีย์ด้วย strength band × บทบาทธาตุของวัยจร ─────────

type RelationRole = "คู่ธาตุ" | "ธาตุถ่ายเท" | "ธาตุพิฆาต" | "พิฆาตธาตุ" | "ธาตุส่งเสริม";

const LUCK_ROLE_WORDS: readonly RelationRole[] = [
  "คู่ธาตุ",
  "ธาตุถ่ายเท",
  "ธาตุพิฆาต",
  "พิฆาตธาตุ",
  "ธาตุส่งเสริม",
];

/** บทบาทของธาตุวัยจรเทียบดิถี (ตามตรรกะปฏิกิริยา 5 ธาตุ) */
function resolveRelationRole(
  dayElement: SupportedElementValue,
  targetElement: SupportedElementValue,
): RelationRole {
  if (targetElement === dayElement) {
    return "คู่ธาตุ";
  }
  if (GENERATES[dayElement] === targetElement) {
    return "ธาตุถ่ายเท";
  }
  if (GENERATES[targetElement] === dayElement) {
    return "ธาตุส่งเสริม";
  }
  if (CONTROLS[dayElement] === targetElement) {
    return "ธาตุพิฆาต"; // ดิถีพิฆาตเขา = ธาตุลาภ
  }
  return "พิฆาตธาตุ"; // เขาพิฆาตดิถี = ธาตุอำนาจ
}

/** luck-cycle.txt → Map<`${band}|${role}`, verdict> */
function parseLuckCycleByBandRole(): Map<string, string> | null {
  const lines = readExtractedLines("luck-cycle.txt");
  if (!lines) {
    return null;
  }
  const map = new Map<string, string>();
  let bands: StrengthBand[] = [];

  for (const line of lines) {
    if (line.startsWith("ดิถีแข็งแรงเกินไป")) {
      bands = ["very-strong"];
      continue;
    }
    if (line.startsWith("ดิถีแข็งแรงและดิถีสมดุล")) {
      bands = ["strong", "balanced"];
      continue;
    }
    if (line.startsWith("ดิถีอ่อน")) {
      bands = ["weak", "very-weak"];
      continue;
    }
    if (bands.length === 0) {
      continue;
    }
    const role = LUCK_ROLE_WORDS.find(
      (word) => line === word || line.startsWith(`${word} `),
    );
    if (role) {
      const verdict = line.slice(role.length).trim();
      for (const band of bands) {
        if (!map.has(`${band}|${role}`)) {
          map.set(`${band}|${role}`, verdict);
        }
      }
    }
  }
  return map.size > 0 ? map : null;
}

type CurrentPhase = { symbol: string; element: SupportedElementValue; ageRange: string };

function findCurrentDaYunPhase(calculatedState: CalculatedStateValue): CurrentPhase | null {
  const pillars = [...calculatedState.daYun].sort((a, b) => a.startAge - b.startAge);
  for (let index = 0; index < pillars.length; index += 1) {
    const pillar = pillars[index];
    const base = 5 + index * 10; // normalize 5-9 เหมือนหน้า /reading
    for (const phase of [pillar.upperPhase, pillar.lowerPhase]) {
      if (phase?.isCurrent) {
        const element = phase.source === "stem"
          ? (STEM_TO_ELEMENT[phase.symbol as keyof typeof STEM_TO_ELEMENT] ?? "wood")
          : (BRANCH_TO_ELEMENT[phase.symbol as keyof typeof BRANCH_TO_ELEMENT] ?? "wood");
        const ageRange = phase.source === "stem"
          ? `${base}-${base + 4} ปี`
          : `${base + 5}-${base + 9} ปี`;
        return { symbol: phase.symbol, element: element as SupportedElementValue, ageRange };
      }
    }
  }
  return null;
}

function buildLuckCycleReading(calculatedState: CalculatedStateValue): string | null {
  const map = parseLuckCycleByBandRole();
  if (!map) {
    return null;
  }
  const phase = findCurrentDaYunPhase(calculatedState);
  if (!phase) {
    return null;
  }
  const band = resolveStrengthBand(calculatedState);
  const role = resolveRelationRole(dayMasterElement(calculatedState), phase.element);
  const verdict = map.get(`${band}|${role}`);
  if (!verdict) {
    return null;
  }
  return `ช่วงวัยจรปัจจุบัน ${phase.ageRange} (${phase.symbol} ธาตุ${elementLabel(phase.element)} เป็น${role}): ${verdict}`;
}

// ───────── Rev6: ตารางวิเคราะห์เส้นขีดความสัมพันธ์ หมวดวัยจร (Relationship Lines Mapping, อ้างอิง M.docx บทเสริม) ─────────

export type RelationshipLineRow = {
  ageRange: string;
  symbol: string;
  /** เส้นขีดที่ทำงาน เช่น "ถ่ายเท → เชี่ยงแซ" */
  relationLine: string;
  /** คำอธิบายดี-ร้ายเชิงลึก (จาก luck-cycle band × role) */
  deepNote: string;
};

const RELATION_ROLE_SHORT: Record<RelationRole, string> = {
  "คู่ธาตุ": "คู่ธาตุ",
  "ธาตุถ่ายเท": "ถ่ายเท",
  "ธาตุพิฆาต": "ลาภ (ดิถีพิฆาต)",
  "พิฆาตธาตุ": "อำนาจ (พิฆาตดิถี)",
  "ธาตุส่งเสริม": "ส่งเสริม",
};

/** ทุกเฟสวัยจร (5 ปี, normalize 5-9) → เส้นขีด + คำอธิบายดี-ร้าย */
export function buildRelationshipLinesMapping(
  calculatedState: CalculatedStateValue,
): RelationshipLineRow[] {
  const luckMap = parseLuckCycleByBandRole();
  const band = resolveStrengthBand(calculatedState);
  const dm = dayMasterElement(calculatedState);
  const pillars = [...calculatedState.daYun].sort((a, b) => a.startAge - b.startAge);

  const rows: RelationshipLineRow[] = [];
  pillars.forEach((pillar, index) => {
    const base = 5 + index * 10;
    const phases: Array<{ symbol: string; element: SupportedElementValue; age: string; qi: string }> = [];
    if (pillar.upperPhase) {
      phases.push({
        symbol: pillar.upperPhase.symbol,
        element: stemElement(pillar.upperPhase.symbol),
        age: `${base}-${base + 4} ปี`,
        qi: (pillar.upperPhase.twelveQiDisplay ?? "").trim(),
      });
    }
    if (pillar.lowerPhase) {
      phases.push({
        symbol: pillar.lowerPhase.symbol,
        element: branchElement(pillar.lowerPhase.symbol),
        age: `${base + 5}-${base + 9} ปี`,
        qi: (pillar.lowerPhase.twelveQiDisplay ?? "").trim(),
      });
    }
    for (const phase of phases) {
      const role = resolveRelationRole(dm, phase.element);
      const deepNote = luckMap?.get(`${band}|${role}`) ?? "";
      rows.push({
        ageRange: phase.age,
        symbol: phase.symbol,
        relationLine: `${RELATION_ROLE_SHORT[role]}${phase.qi ? ` → ${phase.qi}` : ""}`,
        deepNote: deepNote || `${RELATION_ROLE_SHORT[role]} ในช่วงนี้ (อ่านรวมกับสภาวะ ${phase.qi || "—"})`,
      });
    }
  });
  return rows;
}

// ───────── Batch 3: ความรัก (love-family.txt) + หุ้นส่วน/ธุรกิจ (career-business.txt) ─────────

function matchBandFromLine(line: string): StrengthBand | null {
  // ตรวจคำที่เฉพาะเจาะจงกว่าก่อน
  if (line.includes("อ่อนมาก") || line.includes("อ่อนแอเกินไป")) {
    return "very-weak";
  }
  if (line.includes("แข็งแรงเกินไป")) {
    return "very-strong";
  }
  if (line.includes("สมดุล")) {
    return "balanced";
  }
  if (line.includes("อ่อน")) {
    return "weak";
  }
  if (line.includes("แข็งแรง") || line.includes("แข็ง")) {
    return "strong";
  }
  return null;
}

/** love-family.txt 1.1: เพศ × strength band → โอกาสมีคู่ */
function parseLoveByGenderBand(): Map<string, string> | null {
  const lines = readExtractedLines("love-family.txt");
  if (!lines) {
    return null;
  }
  const map = new Map<string, string>();
  let gender: "male" | "female" | null = null;

  for (const line of lines) {
    if (line.startsWith("ดิถีเป็นเพศชาย")) {
      gender = "male";
      continue;
    }
    if (line.startsWith("ดิถีเป็นเพศหญิง")) {
      gender = "female";
      continue;
    }
    if (!gender) {
      continue;
    }
    if (line.startsWith("เพศชาย") || line.startsWith("เพศหญิง")) {
      const band = matchBandFromLine(line);
      if (band) {
        map.set(`${gender}|${band}`, line);
      }
    }
    // หยุด section เมื่อเจอหัวข้อถัดไป
    if (/^หลักวันราศีบน/.test(line)) {
      gender = null;
    }
  }
  return map.size > 0 ? map : null;
}

/** career-business.txt 1.1: strength band → ควรทำอาชีพ/ธุรกิจแบบใด (ใช้กับหุ้นส่วน/ธุรกิจ) */
function parseCareerBusinessByBand(): Map<StrengthBand, string> | null {
  const lines = readExtractedLines("career-business.txt");
  if (!lines) {
    return null;
  }
  const map = new Map<StrengthBand, string>();
  for (const line of lines) {
    if (!line.startsWith("ดิถี")) {
      continue;
    }
    if (line.includes("แข็งแรงเกินไป")) {
      map.set("very-strong", line);
    } else if (line.includes("แข็งแรงหรือสมดุล")) {
      map.set("strong", line);
      map.set("balanced", line);
    } else if (line.includes("อ่อนแอหรืออ่อนแอเกินไป")) {
      map.set("weak", line);
      map.set("very-weak", line);
    }
  }
  return map.size > 0 ? map : null;
}

function buildLoveReading(
  calculatedState: CalculatedStateValue,
  rawInput?: RawInputValue,
): string | null {
  const gender = rawInput?.gender;
  if (gender !== "male" && gender !== "female") {
    return null;
  }
  const map = parseLoveByGenderBand();
  if (!map) {
    return null;
  }
  return map.get(`${gender}|${resolveStrengthBand(calculatedState)}`) ?? null;
}

function buildPartnershipReading(calculatedState: CalculatedStateValue): string | null {
  const map = parseCareerBusinessByBand();
  if (!map) {
    return null;
  }
  const verdict = map.get(resolveStrengthBand(calculatedState));
  return verdict ? `แนวทางทำธุรกิจ/หุ้นส่วน: ${verdict}` : null;
}

// ───────── Batch 4: 5 บทที่เหลือ — derive จากกฎ engine (PILLAR_CONTEXT_MAP + relation + 12 เชี่ยงแซ) ─────────

type PillarKey = "year" | "month" | "day" | "hour";
const PILLAR_LABEL_TH: Record<PillarKey, string> = {
  year: "เสาปี",
  month: "เสาเดือน",
  day: "เสาวัน",
  hour: "เสายาม",
};
// 12 เชี่ยงแซ "ดี" (พลังขึ้น) — ใช้แยกเพื่อน/ศัตรู และคุณภาพช่วง
const GOOD_QI = new Set(["เชี่ยงแซ", "กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง", "หมกยก"]);
const BAD_QI = new Set(["ซวย", "แป่", "ซี่", "เจ๊าะ"]);

function stemElement(stem: string): SupportedElementValue {
  return (STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT] ?? "wood") as SupportedElementValue;
}
function branchElement(branch: string): SupportedElementValue {
  return (BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT] ?? "wood") as SupportedElementValue;
}

function inverseGenerate(dm: SupportedElementValue): SupportedElementValue {
  return (Object.keys(GENERATES) as SupportedElementValue[]).find(
    (element) => GENERATES[element] === dm,
  ) as SupportedElementValue;
}

function pillarBranchQi(calculatedState: CalculatedStateValue, pillar: PillarKey): string {
  return (calculatedState.twelveQi[`${pillar}Branch`] ?? "").trim();
}

/** บท 4 ผู้อุปถัมภ์ = ดาวส่งเสริม(resource) + ดาวอำนาจ(power) ที่เสาปี/เดือน (ผู้ใหญ่/ปู่ย่า) */
function buildBenefactorReading(calculatedState: CalculatedStateValue): string | null {
  const dm = dayMasterElement(calculatedState);
  const resource = inverseGenerate(dm);
  const power = (Object.keys(CONTROLS) as SupportedElementValue[]).find(
    (element) => CONTROLS[element] === dm,
  ) as SupportedElementValue;

  const hits: string[] = [];
  for (const pillar of ["year", "month"] as PillarKey[]) {
    const value = calculatedState.fourPillars[pillar];
    for (const [symbol, element] of [
      [value.stem, stemElement(value.stem)],
      [value.branch, branchElement(value.branch)],
    ] as Array<[string, SupportedElementValue]>) {
      if (element === resource || element === power) {
        const role = element === resource ? "ดาวส่งเสริม (ผู้ใหญ่หนุน)" : "ดาวอำนาจ (ผู้มีอำนาจ)";
        hits.push(`${PILLAR_LABEL_TH[pillar]} ${symbol} ธาตุ${elementLabel(element)} = ${role} → ${PILLAR_CONTEXT_MAP[pillar].traditionalPerson}`);
      }
    }
  }

  const lead = `ผู้อุปถัมภ์ดูจากดาวส่งเสริม (ธาตุ${elementLabel(resource)}) และดาวอำนาจ (ธาตุ${elementLabel(power)}) โดยเฉพาะที่เสาปี/เดือน ซึ่งแทนผู้ใหญ่และปู่ย่าตระกูล`;
  if (hits.length === 0) {
    return `${lead}\n\nบนชั้นหลักไม่พบดาวส่งเสริม/อำนาจที่เสาปี-เดือนชัดเจน จึงมักต้องอาศัยความพยายามของตนเองเป็นหลัก ผู้อุปถัมภ์จะมาเป็นจังหวะตามวัยจรที่ธาตุส่งเสริมเข้ามา`;
  }
  return `${lead}\n\n${hits.join("\n")}`;
}

/** บท 6 ครอบครัว = เสาเดือน (พ่อแม่) + เสาปี (ปู่ย่า) + ปฏิกิริยาที่เกี่ยวข้อง */
function buildFamilyReading(calculatedState: CalculatedStateValue): string | null {
  const month = calculatedState.fourPillars.month;
  const year = calculatedState.fourPillars.year;
  const segments = [
    `ครอบครัวอ่านจากเสาเดือนเป็นหลัก (${PILLAR_CONTEXT_MAP.month.traditionalPerson}) และเสาปี (${PILLAR_CONTEXT_MAP.year.traditionalPerson})`,
    `เสาเดือน ${month.stem}${month.branch} ธาตุ${elementLabel(stemElement(month.stem))} เป็นฐานพ่อแม่/ครอบครัวและสภาพแวดล้อมที่เติบโตมา`,
    `เสาปี ${year.stem}${year.branch} ธาตุ${elementLabel(stemElement(year.stem))} สะท้อนรากเหง้าวงศ์ตระกูลและพื้นฐานที่ส่งต่อมา`,
  ];

  const relations = calculatedState.interactionState?.relations ?? [];
  const familyRelations = relations.filter((relation) =>
    relation.participantEntityIds?.some((id) => id.includes("year") || id.includes("month")),
  );
  if (familyRelations.length > 0) {
    segments.push(`ปฏิกิริยาที่แตะฐานครอบครัว: ${[...new Set(familyRelations.map((relation) => relation.label))].join(", ")} (ดูเป็นจังหวะกระทบความสัมพันธ์ในบ้าน)`);
  }
  return segments.join("\n\n");
}

/** บท 8 เพื่อน/ศัตรู = คู่ธาตุ (same) + 12 เชี่ยงแซ ดี→เพื่อน เสีย→ศัตรู */
function buildFriendsReading(calculatedState: CalculatedStateValue): string | null {
  const dm = dayMasterElement(calculatedState);
  const carriers: string[] = [];
  for (const pillar of ["year", "month", "hour"] as PillarKey[]) {
    const value = calculatedState.fourPillars[pillar];
    const branchIsSame = branchElement(value.branch) === dm;
    const stemIsSame = stemElement(value.stem) === dm;
    if (!branchIsSame && !stemIsSame) {
      continue;
    }
    const qi = pillarBranchQi(calculatedState, pillar);
    const verdict = GOOD_QI.has(qi) ? "เพื่อนหนุน (เชี่ยงแซดี)" : BAD_QI.has(qi) ? "คู่แข่ง/ศัตรูแย่งชิง (เชี่ยงแซเสีย)" : "เพื่อนแบบกลาง ๆ";
    carriers.push(`${PILLAR_LABEL_TH[pillar]} ${stemIsSame ? value.stem : value.branch} (คู่ธาตุ${elementLabel(dm)}${qi ? `, ${qi}` : ""}) = ${verdict}`);
  }
  const lead = "เพื่อน/ศัตรูดูจากคู่ธาตุ (ธาตุเดียวกับดิถี): คู่ธาตุที่อยู่ช่วง 12 เชี่ยงแซดีคือเพื่อนที่หนุน ถ้าเชี่ยงแซเสียคือคู่แข่งที่แย่งทรัพยากร";
  if (carriers.length === 0) {
    return `${lead}\n\nไม่พบคู่ธาตุเด่นบนชั้นหลัก เพื่อน/คู่แข่งจึงมีบทบาทไม่มากในโครงดวงหลัก แต่เข้ามาเป็นช่วงตามวัยจรที่คู่ธาตุปรากฏ`;
  }
  return `${lead}\n\n${carriers.join("\n")}`;
}

/** บท 10 ลูกน้อง/บริวาร = เสายาม + ดาวถ่ายเท (output) */
function buildSubordinateReading(calculatedState: CalculatedStateValue): string | null {
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue;
  const hour = calculatedState.fourPillars.hour;
  const qi = pillarBranchQi(calculatedState, "hour");
  return [
    `ลูกน้อง/บริวารดูจากเสายาม (${PILLAR_CONTEXT_MAP.hour.businessPerson}) ร่วมกับดาวถ่ายเท (ธาตุ${elementLabel(output)})`,
    `เสายาม ${hour.stem}${hour.branch} ธาตุ${elementLabel(stemElement(hour.stem))}${qi ? ` ช่วง ${qi}` : ""} = ฐานของบริวารและผลงานที่สร้างต่อ`,
    GOOD_QI.has(qi)
      ? "เชี่ยงแซดีที่เสายาม: บริวาร/ทีมงานมีคุณภาพ ช่วยแปลงงานเป็นผลลัพธ์ได้ดี"
      : BAD_QI.has(qi)
        ? "เชี่ยงแซเสียที่เสายาม: ต้องดูแลบริวารใกล้ชิด อาจมีปัญหาคนในทีมหรือภาระจุกจิก"
        : "บริวารทำงานได้ตามปกติ ควรมอบหมายงานที่ตรงทักษะ",
  ].join("\n\n");
}

/** บท 11 การเรียน = ดาวถ่ายเท (output) + วิชา useful element */
function buildEducationReading(calculatedState: CalculatedStateValue): string | null {
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue;
  const useful = resolveUsefulElements(calculatedState);
  return [
    `การเรียนอ่านจากดาวถ่ายเท (ธาตุ${elementLabel(output)}) ซึ่งคือการนำสมอง/ทักษะออกมาใช้ ยิ่งช่วง 12 เชี่ยงแซดียิ่งเรียนแล้วได้ใช้จริง`,
    `วิชาที่ควรเน้นคือวิชาธาตุ ${useful.join(" / ")} (useful god ของดวงนี้) เพราะช่วยแปลงความรู้เป็นความสำเร็จ ไม่ใช่เรียนเพื่อรู้เฉย ๆ`,
  ].join("\n\n");
}

function buildDerivedPersonReading(
  calculatedState: CalculatedStateValue,
  topicId: string,
): string | null {
  switch (topicId) {
    case "benefactor":
      return buildBenefactorReading(calculatedState);
    case "family":
      return buildFamilyReading(calculatedState);
    case "friends_foes":
      return buildFriendsReading(calculatedState);
    case "subordinates":
      return buildSubordinateReading(calculatedState);
    case "education":
      return buildEducationReading(calculatedState);
    default:
      return null;
  }
}

/**
 * คืนข้อความผลการทำนายภาษามนุษย์ของหัวข้อ (deterministic จาก knownlage)
 * หรือ null ถ้ายังไม่มีองค์ความรู้สำหรับหัวข้อนั้น.
 */
export function buildTopicHumanReading(
  calculatedState: CalculatedStateValue,
  topicId: string,
  rawInput?: RawInputValue,
): string | null {
  switch (topicId) {
    case "chart_foundation":
    case "talent":
      return buildPersonalityReading(calculatedState);
    case "health":
      return buildHealthReading(calculatedState);
    case "wealth_and_investment":
      return buildWealthReading(calculatedState);
    case "colors_directions":
      return buildUsefulElementReading(
        calculatedState,
        parseSource7ElementSection("2.1", 3),
        (element, value) => {
          const [color, gem, amulet] = value as string[];
          return `ธาตุ${element} (useful god): สีมงคล ${color ?? "-"}; อัญมณี ${gem ?? "-"}; วัตถุมงคล ${amulet ?? "-"}`;
        },
      );
    case "guardian_deities":
      return buildUsefulElementReading(
        calculatedState,
        parseSource7ElementSection("2.2", 2),
        (element, value) => {
          const [merit, deities] = value as string[];
          return `ธาตุ${element} (useful god): สิ่งศักดิ์สิทธิ์ ${deities ?? "-"}; การทำบุญ ${merit ?? "-"}`;
        },
      );
    case "career_potential":
      return buildUsefulElementReading(
        calculatedState,
        parseSource7Careers(),
        (element, value) => `อาชีพธาตุ${element} (useful god): ${value as string}`,
      );
    case "turning_points":
      return buildLuckCycleReading(calculatedState);
    case "love_partner":
      return buildLoveReading(calculatedState, rawInput);
    case "partnership":
      return buildPartnershipReading(calculatedState);
    case "benefactor":
    case "family":
    case "friends_foes":
    case "subordinates":
    case "education":
      return buildDerivedPersonReading(calculatedState, topicId);
    default:
      return null;
  }
}

const KNOWLEDGE_TOPIC_SOURCE: Record<string, string> = {
  chart_foundation: PERSONALITY_FILE,
  talent: PERSONALITY_FILE,
  health: "knownlage/extracted/health.txt",
  wealth_and_investment: "knownlage/extracted/wealth.txt",
  colors_directions: "knownlage/extracted/source7-enhancement.txt",
  guardian_deities: "knownlage/extracted/source7-enhancement.txt",
  career_potential: "knownlage/extracted/source7-enhancement.txt",
  turning_points: "knownlage/extracted/luck-cycle.txt",
  love_partner: "knownlage/extracted/love-family.txt",
  partnership: "knownlage/extracted/career-business.txt",
  benefactor: "engine-derived (PILLAR_CONTEXT_MAP + ปฏิกิริยาธาตุ)",
  family: "engine-derived (PILLAR_CONTEXT_MAP + interactionState)",
  friends_foes: "engine-derived (คู่ธาตุ + 12 เชี่ยงแซ)",
  subordinates: "engine-derived (เสายาม + ดาวถ่ายเท)",
  education: "engine-derived (ดาวถ่ายเท + useful element)",
};

export type TopicKnowledgeCoverage = {
  topicId: string;
  chapter: number;
  title: string;
  hasKnowledge: boolean;
  source: string | null;
};

const KNOWLEDGE_TOPIC_LABEL: Record<string, string> = {
  chart_foundation: "ตำราลักษณะนิสัย 60 แบบ (ราศีบน-ล่าง-เชี่ยงแซ)",
  talent: "ตำราลักษณะนิสัย 60 แบบ (ราศีบน-ล่าง-เชี่ยงแซ)",
  health: "ตำราสุขภาพพื้นฐาน",
  wealth_and_investment: "ตำราการเงินและการลงทุน",
  career_potential: "ตำราการเสริมดวง (Source 7 — อาชีพตามธาตุ)",
  colors_directions: "ตำราการเสริมดวง (Source 7 — สี/อัญมณี/วัตถุมงคล)",
  guardian_deities: "ตำราการเสริมดวง (Source 7 — องค์เทพ)",
  turning_points: "ตำราการทายวัยจร",
  love_partner: "ตำราความรักและความสัมพันธ์",
  partnership: "ตำราการงานและธุรกิจ",
  benefactor: "หลักปฏิกิริยาธาตุ + ตำแหน่งเสา (อ้างอิง M.docx)",
  family: "หลักปฏิกิริยาธาตุ + ตำแหน่งเสา (อ้างอิง M.docx)",
  friends_foes: "หลักปฏิกิริยาธาตุ + ตำแหน่งเสา (อ้างอิง M.docx)",
  subordinates: "หลักปฏิกิริยาธาตุ + ตำแหน่งเสา (อ้างอิง M.docx)",
  education: "หลักปฏิกิริยาธาตุ + ตำแหน่งเสา (อ้างอิง M.docx)",
};

/** ชื่อตำรา/แหล่งอ้างอิงอ่านง่ายของหัวข้อ (ไว้แสดง "อ้างอิง: ...") */
export function getTopicKnowledgeSourceLabel(topicId: string): string | null {
  return KNOWLEDGE_TOPIC_LABEL[topicId] ?? null;
}

function isTopicKnowledgeAvailable(topicId: string): boolean {
  switch (topicId) {
    case "chart_foundation":
    case "talent":
      return getPersonalityIndex() !== null;
    case "health":
      return parseHealthByElement() !== null;
    case "wealth_and_investment":
      return parseWealthByBand() !== null;
    case "colors_directions":
      return parseSource7ElementSection("2.1", 3) !== null;
    case "guardian_deities":
      return parseSource7ElementSection("2.2", 2) !== null;
    case "career_potential":
      return parseSource7Careers() !== null;
    case "turning_points":
      return parseLuckCycleByBandRole() !== null;
    case "love_partner":
      return parseLoveByGenderBand() !== null;
    case "partnership":
      return parseCareerBusinessByBand() !== null;
    case "benefactor":
    case "family":
    case "friends_foes":
    case "subordinates":
    case "education":
      return true; // derive จากกฎ engine เสมอ
    default:
      return false;
  }
}

/** สรุปว่าหัวข้อใดมี/ไม่มีองค์ความรู้ภาษามนุษย์ (ไว้รายงานผู้ใช้) */
export function getTopicKnowledgeCoverage(): TopicKnowledgeCoverage[] {
  return TOPIC_PATH.filter((topic) => topic.kind === "predict").map((topic) => {
    const hasKnowledge = isTopicKnowledgeAvailable(topic.id);

    return {
      topicId: topic.id,
      chapter: topic.chapter,
      title: topic.title,
      hasKnowledge,
      source: hasKnowledge ? (KNOWLEDGE_TOPIC_SOURCE[topic.id] ?? null) : null,
    };
  });
}
