import { readFileSync } from "node:fs";
import path from "node:path";

import type { CalculatedStateValue, RawInputValue, SupportedElementValue } from "@/lib/bazi/schema-types";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import {
  resolveDisplayStemPairStage,
  resolveDisplayTwelveQiStage,
} from "@/lib/bazi/pillar-display";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import {
  CHAPTER_INTRO_TH,
  CHAPTER_SUMMARY_TH,
  ELEMENT_DEITY_BENEFIT_TH,
  ELEMENT_SYMBOL_TH,
  composeParagraphs,
} from "@/lib/bazi/reading-phrases";
import {
  BRANCH_TO_ELEMENT,
  CONTROLS,
  ELEMENT_LABELS_TH,
  GENERATES,
  PILLAR_CONTEXT_MAP,
  STEM_TO_ELEMENT,
  TWELVE_QI_CONTEXT_MAP,
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

/**
 * ดวงกึ่งแข็งกึ่งอ่อน (balanced): เลือกอาชีพแบบ "ควบ 2 ฐาน" — ธาตุที่เป็นคุณทั้ง
 * ฐานดิถี (เสริมกำลังดิถี = คู่ธาตุ/ส่งเสริม) และฐานหลักเดือน (เสริมราศีบนหลักเดือน
 * = ธาตุเดียวกัน หรือ ธาตุที่ก่อเกิดราศีบนหลักเดือน). ตามที่ซินแซกำชับ: เริ่มจากดิถีแข็ง-อ่อนก่อน
 * แล้วดูว่าเหลือธาตุไหนที่หนุนทั้ง 2 ฐาน เช่น 戊 (ดินกึ่งแข็ง) หลักเดือนราศีบนเป็นทอง →
 * ทำอาชีพธาตุดิน (อสังหา) ได้ เพราะดินหนุนดิถี+ก่อเกิดทอง; แต่ธาตุทอง (ถ่ายเท) จะดูดดิถีอ่อนลง
 *
 * คืน { recommend: ธาตุที่หนุนทั้งคู่ (ลาภที่หนุนเดือนตาม), drain: ธาตุถ่ายเทที่ดูดกำลังดิถี }
 */
function resolveBalancedDualBaseCareer(calculatedState: CalculatedStateValue): {
  recommend: SupportedElementValue[];
  drain: SupportedElementValue;
} {
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue; // ถ่ายเท → ดูดกำลังดิถี
  const wealth = CONTROLS[dm] as SupportedElementValue; // ลาภ
  const resource = (Object.keys(GENERATES) as SupportedElementValue[]).find(
    (element) => GENERATES[element] === dm,
  ) as SupportedElementValue; // ส่งเสริม

  const monthElement = stemElement(calculatedState.fourPillars.month.stem); // ราศีบนหลักเดือน
  const benefitsMonth = (element: SupportedElementValue) =>
    element === monthElement || GENERATES[element] === monthElement;

  // ฐานดิถี: ธาตุที่ทำให้ดิถีแข็งขึ้น (คู่ธาตุ=dm / ส่งเสริม=resource)
  const strengthenDm: SupportedElementValue[] = [dm, resource];
  // หนุนทั้ง 2 ฐาน = เสริมดิถี และ เป็นคุณกับหลักเดือน
  const both = strengthenDm.filter(benefitsMonth);
  // ลาภที่ยังหนุนหลักเดือนด้วย → ใส่ต่อท้าย (ทำอาชีพโชคลาภได้ถ้าไม่ขัดเดือน)
  const wealthIfMonthOk = benefitsMonth(wealth) ? [wealth] : [];

  const recommend = [...new Set([...both, ...wealthIfMonthOk])];
  return { recommend, drain: output };
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
  const officer = (Object.keys(CONTROLS) as SupportedElementValue[]).find(
    (element) => CONTROLS[element] === dm,
  ) as SupportedElementValue; // ดาวอำนาจ (杀 = ธาตุที่พิฆาตดิถี)

  const band = resolveStrengthBand(calculatedState);

  // 病药/食傷制杀: ดิถีอ่อน + ดาวอำนาจ (杀) ล้นเกินเป็นภัย → ใช้ "ดาวถ่ายเท" (output) คุมอำนาจแทนคู่ธาตุ
  // (output ของดิถีควบคุม officer เสมอตามวงจร 5 ธาตุ เช่น ทอง→น้ำ และน้ำดับไฟ=officer ของทอง)
  // เงื่อนไข: ต้องไม่ใช้เมื่อ output เองก็ล้นเกินอยู่แล้ว (มิฉะนั้นยิ่งทำให้ดิถีรั่ว/อ่อนลง)
  const isExcess = (element: SupportedElementValue) =>
    calculatedState.elementAnalysis.dominantElements.includes(element) ||
    resolveElementStrengthLabel(calculatedState, element) === "strong";
  const useOfficerControl = isExcess(officer) && !isExcess(output);
  // ดิถีอ่อนมาตรฐาน: ส่งเสริม (印) + คู่ธาตุ (比劫); ถ้าดาวอำนาจล้น → ใช้ถ่ายเทคุมอำนาจ (食傷制杀)
  const weakUseful: SupportedElementValue[] = useOfficerControl ? [resource, output] : [resource, same];

  // ดิถีอ่อน/อ่อนมาก ต้องการ 印 (ธาตุส่งเสริม) เป็นหลัก + 比劫 (คู่ธาตุ) เสริม
  // (ตำรา M.docx: 己 อ่อนแอ → useful god = ไฟ ก่อน แล้วตามด้วยดิน)
  // ดิถีแข็ง: ระบายพลังด้วยถ่ายเท (食傷) + ลาภ (财) — 食傷生财 ทั้งคู่เป็นคุณ
  // (ตำรา: ดิถีไฟแข็งหน้าร้อน → useful god = ดิน(ถ่ายเท) + ทอง(ลาภ))
  // balanced (กึ่งแข็งกึ่งอ่อน): ใช้ตรรกะควบ 2 ฐาน (ดิถี + หลักเดือน) ตามที่ซินแซกำชับ
  // fallback เป็น [ถ่ายเท, ลาภ] ถ้าไม่มีธาตุไหนหนุนทั้งสองฐาน
  if (band === "balanced") {
    const { recommend } = resolveBalancedDualBaseCareer(calculatedState);
    const dualBase = (recommend.length > 0 ? recommend : [output, wealth]).map(elementLabel);
    return [...new Set(dualBase)];
  }

  const roleMap: Record<Exclude<StrengthBand, "balanced">, SupportedElementValue[]> = {
    "very-strong": [output, wealth],
    strong: [output, wealth],
    weak: weakUseful,
    "very-weak": weakUseful,
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

/** ธาตุที่ล้นเกิน/มีกำลังมากในดวง (ป้ายไทย) — ใช้กับสุขภาพ (ธาตุที่มากเกินกดทับร่างกาย) */
function resolveExcessElements(calculatedState: CalculatedStateValue): ThaiElement[] {
  const labels = new Set<ThaiElement>();
  for (const element of calculatedState.elementAnalysis.dominantElements) {
    labels.add(elementLabel(element));
  }
  for (const entry of calculatedState.elementAnalysis.elementStrengths) {
    if (entry.strength === "strong") {
      labels.add(elementLabel(entry.element));
    }
  }
  return [...labels];
}

// อาการเมื่อ "ธาตุล้นเกิน" (อิงตำรา M.docx บท 13: น้ำเยอะ→อ้วน/บวม + หลักปฏิกิริยา 5 ธาตุ-อวัยวะ)
const EXCESS_HEALTH_TH: Record<ThaiElement, string> = {
  "น้ำ": "อ้วนง่าย บวมน้ำ ระบบขับถ่าย/ไตและกระเพาะปัสสาวะทำงานหนัก",
  "ไฟ": "ร้อนใน อักเสบง่าย นอนไม่หลับ ใจสั่น ความดันแกว่ง",
  "ไม้": "ตับ-ถุงน้ำดีตึงเครียด ปวดหัว ระบบประสาทและอารมณ์ตึง",
  "ทอง": "ระบบหายใจ/ปอด ลำไส้ใหญ่ ผิวแห้ง ภูมิแพ้",
  "ดิน": "ระบบย่อยอาหาร กระเพาะ/ม้าม ท้องอืดแน่น น้ำหนักสะสม",
};

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

/** Source7 §3.1/§3.2: ตารางสีของใช้ — key `${ดิถี}|${ราศีบนอ้างอิง}` → สีที่แนะนำ
 * §3.1 (กระเป๋า/มือถือ) = ดิถี × ราศีบนหลักเดือน (4 บรรทัด/แถว: ดิถี, ราศีบน, สี, สัตว์)
 * §3.2 (รถ/ของเคลื่อนไหวได้) = ดิถี × ราศีบนหลักยาม (3 บรรทัด/แถว: ดิถี, ราศีบน, สี)
 */
function parseSource7ColorTable(marker: string): Map<string, string> | null {
  const lines = readExtractedLines("source7-enhancement.txt");
  if (!lines) {
    return null;
  }
  const start = lines.findIndex((line) => line.startsWith(marker));
  if (start === -1) {
    return null;
  }
  const map = new Map<string, string>();
  let dayStem: string | null = null;
  let upperStems: string[] | null = null;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    // เริ่ม section ถัดไป → จบ
    if (/^\d+(\.\d+)?\s/.test(line)) {
      break;
    }
    if (HEAVENLY_STEMS.includes(line)) {
      dayStem = line;
      upperStems = null;
      continue;
    }
    if (!dayStem) {
      continue;
    }
    // บรรทัดกลุ่มราศีบน เช่น "甲, 乙"
    const stemGroup = line.split(",").map((token) => token.trim()).filter((token) => HEAVENLY_STEMS.includes(token));
    if (stemGroup.length > 0 && !upperStems) {
      upperStems = stemGroup;
      continue;
    }
    // บรรทัดถัดมา = สีที่แนะนำ (บรรทัดแรกหลังกลุ่มราศีบน)
    if (upperStems) {
      for (const upper of upperStems) {
        map.set(`${dayStem}|${upper}`, line);
      }
      upperStems = null;
    }
  }
  return map.size > 0 ? map : null;
}

/** Source7 §5: เทพประจำราศีบน (10 ราศีบน) และราศีล่าง (12 ราศีล่าง) สำหรับเทพเฉพาะดวง */
function parseSource7CustomDeities(): { upper: Map<string, string>; lower: Map<string, string> } | null {
  const lines = readExtractedLines("source7-custom.txt");
  if (!lines) {
    return null;
  }
  const upper = new Map<string, string>();
  const lower = new Map<string, string>();
  let bucket: "upper" | "lower" | null = null;
  for (const line of lines) {
    if (line.startsWith("# DEITY_UPPER")) {
      bucket = "upper";
      continue;
    }
    if (line.startsWith("# DEITY_LOWER")) {
      bucket = "lower";
      continue;
    }
    if (!bucket || line.startsWith("#")) {
      continue;
    }
    const [key, deity] = line.split("|").map((part) => part.trim());
    if (!key || !deity) {
      continue;
    }
    (bucket === "upper" ? upper : lower).set(key, deity);
  }
  return upper.size > 0 || lower.size > 0 ? { upper, lower } : null;
}

/** love-day-pillar.txt: `${ดิถี}|${ราศีล่างวัน}` → {qi, คู่ครอง, ปฏิกิริยา} (sheet หลักวันเท่านั้น) */
function parseLoveDayPillar(): Map<string, { qi: string; spouse: string; reaction: string }> | null {
  const lines = readExtractedLines("love-day-pillar.txt");
  if (!lines) {
    return null;
  }
  const map = new Map<string, { qi: string; spouse: string; reaction: string }>();
  for (const line of lines) {
    if (!line || line.startsWith("#")) {
      continue;
    }
    const [head, spouse, reaction] = line.split("|").map((part) => part.trim());
    const tokens = head.split(/\s+/);
    if (tokens.length < 3) {
      continue;
    }
    const [stem, branch, qi] = tokens;
    if (!HEAVENLY_STEMS.includes(stem) || !EARTHLY_BRANCHES.includes(branch)) {
      continue;
    }
    map.set(`${stem}|${branch}`, {
      qi,
      spouse: (spouse ?? "").replace(/[/\s]+$/, ""),
      reaction: (reaction ?? "").replace(/[/\s]+$/, ""),
    });
  }
  return map.size > 0 ? map : null;
}

// ───────── ตำราโหราศาสตร์เคี้ยงคุง — reference พื้นฐาน (fallback เมื่อหัวข้อไม่มีองค์ความรู้เฉพาะ) ─────────

/** คำค้นต่อหัวข้อ สำหรับดึง excerpt จากตำราเคี้ยงคุงเป็น fallback */
const KHEANGKHUNG_TOPIC_KEYWORDS: Record<string, string[]> = {
  chart_foundation: ["ดิถี", "ลักษณะ", "นิสัย"],
  career_potential: ["การงาน", "อาชีพ"],
  wealth_and_investment: ["โชคลาภ", "ทรัพย์"],
  benefactor: ["ผู้ใหญ่", "อุปถัมภ์", "สนับสนุน"],
  talent: ["พรสวรรค์", "ความสามารถ", "ถ่ายเท"],
  family: ["ครอบครัว", "บิดามารดา", "พ่อแม่"],
  love_partner: ["คู่ครอง", "ความรัก"],
  friends_foes: ["เพื่อน", "มิตร"],
  partnership: ["หุ้นส่วน", "ร่วม"],
  subordinates: ["บริวาร", "ลูกน้อง"],
  education: ["เรียน", "ศึกษา"],
  turning_points: ["วัยจร", "ปีจร"],
  health: ["สุขภาพ", "โรค", "ร่างกาย"],
  colors_directions: ["สี", "ทิศ"],
  guardian_deities: ["เทพ", "สิ่งศักดิ์สิทธิ์", "ไหว้"],
};

/** ค้นบรรทัดเนื้อหาในตำราเคี้ยงคุงที่ตรงคำค้น (เนื้อยาวพอ ไม่ใช่หัวข้อ) → คืน excerpt สูงสุด limit บรรทัด */
export function findKheangkhungReference(keywords: string[], limit = 2): string | null {
  const lines = readExtractedLines("kheangkhung-reference.txt");
  if (!lines || keywords.length === 0) {
    return null;
  }
  const matched: string[] = [];
  for (const line of lines) {
    if (line.length < 24 || line.startsWith("#")) {
      continue;
    }
    if (keywords.some((keyword) => line.includes(keyword))) {
      matched.push(line);
      if (matched.length >= limit) {
        break;
      }
    }
  }
  return matched.length > 0 ? matched.join("\n") : null;
}

/** fallback ข้อความหัวข้อจากตำราเคี้ยงคุง เมื่อ builder หลักไม่มีองค์ความรู้ (คืน null ถ้าไม่พบ) */
function buildKheangkhungFallback(topicId: string): string | null {
  const keywords = KHEANGKHUNG_TOPIC_KEYWORDS[topicId];
  if (!keywords) {
    return null;
  }
  const excerpt = findKheangkhungReference(keywords, 2);
  return excerpt ? `อ้างอิงตำราโหราศาสตร์เคี้ยงคุง (พื้นฐาน):\n${excerpt}` : null;
}

/** หัวข้อที่ null = "ขาด input" (ไม่ใช่ขาดความรู้) จึงไม่ fallback (เช่น ความรักต้องมีเพศ) */
const KHEANGKHUNG_FALLBACK_EXCLUDE = new Set(["love_partner"]);

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

// ───────── P2: imagery ตามดิถี × ฤดู (调候 穷通宝鉴 style) เปิดบทพื้นฐานชะตา ─────────

const YANG_STEM_SET = new Set(["甲", "丙", "戊", "庚", "壬"]);
const YANG_BRANCH_SET = new Set(["子", "寅", "辰", "午", "申", "戌"]);

// ภาพธรรมชาติของ 10 ดิถี (ตามตำราดวงจีน)
const STEM_NATURE_TH: Record<string, string> = {
  "甲": "ต้นไม้ใหญ่ที่หยัดยืนทอดกิ่งก้านสู่ฟ้า",
  "乙": "ไม้ดอกไม้เลื้อยที่อ่อนช้อยแต่เหนียวแน่น",
  "丙": "ดวงอาทิตย์ที่ส่องสว่างแผ่ความอบอุ่น",
  "丁": "ดวงไฟและแสงเทียนที่ให้ความสว่างอบอุ่น",
  "戊": "ภูเขาหินใหญ่ที่มั่นคงหนักแน่น",
  "己": "ผืนดินไร่นาที่หล่อเลี้ยงสรรพสิ่ง",
  "庚": "โลหะดิบและขวานเหล็กที่แข็งแกร่งคมกล้า",
  "辛": "เพชรพลอยและทองรูปพรรณอันล้ำค่า",
  "壬": "ทะเลกว้างและแม่น้ำใหญ่ที่ไหลเชี่ยว",
  "癸": "สายฝนและน้ำค้างที่ชุ่มเย็นหล่อเลี้ยง",
};

// ภาพของธาตุที่ "ล้อมรอบ" ในดวง
const ELEMENT_IMAGERY_TH: Record<ThaiElement, string> = {
  "ไม้": "ป่าไม้ที่เติบโตหนาแน่น",
  "ไฟ": "เปลวไฟและความร้อนที่แผดเผา",
  "ดิน": "ภูผาและผืนดินที่หนาแน่น",
  "ทอง": "โลหะและของแข็งที่คมกล้า",
  "น้ำ": "สายน้ำและความชุ่มชื้น",
};

const SEASON_BY_BRANCH: Record<string, "spring" | "summer" | "autumn" | "winter"> = {
  "寅": "spring", "卯": "spring", "辰": "spring",
  "巳": "summer", "午": "summer", "未": "summer",
  "申": "autumn", "酉": "autumn", "戌": "autumn",
  "亥": "winter", "子": "winter", "丑": "winter",
};

const SEASON_LABEL_TH: Record<"spring" | "summer" | "autumn" | "winter", string> = {
  spring: "ฤดูใบไม้ผลิ อากาศอบอุ่นกำลังฟื้นตัว",
  summer: "ฤดูร้อน ความร้อนแรงกล้า",
  autumn: "ฤดูใบไม้ร่วง อากาศเย็นและโลหะแกร่ง",
  winter: "ฤดูหนาว อากาศหนาวเย็นและมืดมิด",
};

/** ประโยคเปิดบทพื้นฐานชะตา = ภาพดิถี × ฤดู × ธาตุที่ล้อมรอบ × สมดุล (ปรับด้วย useful god) */
function buildDayMasterImagery(calculatedState: CalculatedStateValue): string {
  const stem = calculatedState.dayMaster;
  const element = dayMasterElement(calculatedState);
  const elementTh = elementLabel(element);
  const polarity = YANG_STEM_SET.has(stem) ? "หยาง" : "หยิน";
  const nature = STEM_NATURE_TH[stem] ?? `ธาตุ${elementTh}`;
  const season = SEASON_BY_BRANCH[calculatedState.fourPillars.month.branch];
  const band = resolveStrengthBand(calculatedState);
  const useful = resolveUsefulElements(calculatedState);

  let text = `ดิถีประจำตัวของคุณคือ ${nature} (${stem} ธาตุ${elementTh}พลัง${polarity})`;
  if (season) {
    text += ` เกิดใน${SEASON_LABEL_TH[season]}`;
  }

  // ธาตุที่ล้อมรอบเด่นที่สุด (ไม่ใช่ธาตุดิถีเอง) → บรรยากาศของดวง
  const surrounding = calculatedState.elementAnalysis.dominantElements
    .map((value) => elementLabel(value))
    .find((label) => label !== elementTh);
  if (surrounding) {
    text += ` ท่ามกลาง${ELEMENT_IMAGERY_TH[surrounding]}ที่โดดเด่นอยู่รายรอบ`;
  }

  // สมดุลตามกำลังดิถี — ยึด band รวม (ให้สอดคล้องกับย่อหน้าคำแนะนำและคำว่าดิถีแข็ง/อ่อน)
  const weakLike = band === "very-weak" || band === "weak";
  const strongLike = band === "very-strong" || band === "strong";
  if (weakLike) {
    text += " ทว่ากำลังของดิถียังไม่มากนัก จึงต้องการแรงหนุนมาเสริมให้แข็งแกร่ง";
  } else if (strongLike) {
    text += " ดิถีมีกำลังแรงกล้า (ธาตุดิถีค่อนข้างล้น) จึงต้องการช่องทางระบายเพื่อไม่ให้พลังล้นเกินจนเสียสมดุล";
  } else {
    text += " ดิถีอยู่ในสภาวะค่อนข้างสมดุล";
  }

  if (useful.length > 0) {
    text += ` เมื่อได้ธาตุ${useful.join("และ")}มาช่วยปรับสมดุล ดวงจะเปล่งคุณค่าและส่งผลดีได้เต็มที่`;
  }
  return text;
}

// ───────── ความสัมพันธ์ในผังดวงตามตำราเคี้ยงคุง (ผั่ว/ชง) → คำทำนายเชิงลึก ─────────
// อ้างอิง knownlage/extracted/kheangkhung-reference.txt
//  - การผั่ว (破) = คู่ "ราศีบน(ก้าน)×ราศีล่าง(กิ่ง)" เฉพาะคู่ ในเสาเดียวกัน (บรรทัด 633-646)
//    ตีความตาม "หลักที่ผั่วตก": ปี=วงศ์ตระกูล/วัยต้น, เดือน=การงาน/ผู้ใหญ่, วัน=คู่ครอง/ตัวตน, ยาม=บุตร/บั้นปลาย
const PO_PILLAR_MEANING_TH: Record<string, string> = {
  "甲午": "การลงทุนหรือการเรียน รวมถึงการช่วยเหลือสนับสนุนผู้อื่น มักย้อนกลับมาทำให้ตัวเองเสียหาย ไม่เป็นไปตามที่คาดหวัง",
  "乙巳": "ความลุ่มหลงเที่ยวเตร่หรือการแสดงออกที่มัวเมา หากทุ่มเทมากเกินไปจะนำมาซึ่งความเสียหาย",
  "丙辰": "มักทุ่มเทใช้จ่ายเพื่อตำแหน่ง ศักดิ์ศรี หรือการศึกษามากกว่าปกติ จนเกิดความเสียหายทางการเงิน",
  "丁卯": "ผู้ใหญ่หรือผู้สนับสนุนมักไม่มีกำลังพอหรืออยู่ห่างไกล และบางครั้งเข้ามาช่วยเพื่อหวังผลประโยชน์ ทำให้เสียหาย",
  "戊寅": "เป็นตำแหน่งที่ต้องแบกรับภาระ ตรากตรำลำบากในช่วงต้น แล้วจึงค่อยสบายและสำเร็จได้ดีในภายหลัง",
  "己丑": "มักสูญเสียทางการเงินอยู่เรื่อย ๆ เก็บเงินไม่ค่อยอยู่",
  "己亥": "เก็บสะสมเงินทองให้เป็นกอบเป็นกำได้ยาก เพราะลาภผลมักมีเหตุให้เสียหายไป",
  "庚子": "ช่วยเหลือผู้อื่นแล้วมักไม่เกิดผลดีกับตัวเอง เหมือนปิดทองหลังพระ การลงทุนเสี่ยงเสียเปรียบหรือจมทุน",
  "庚戌": "คนที่เข้ามาช่วยเหลือหรือสนับสนุน กลับกลายเป็นต้นเหตุให้เราเดือดร้อนเสียหาย",
  "辛酉": "มีการแก่งแย่งชิงดีไม่ยอมกัน คู่ครองมักวางอำนาจเอาเปรียบ หุ้นส่วนชอบทำข้ามหน้าข้ามตา",
  "壬申": "กว่าจะได้ผู้ช่วยเหลือที่ดีต้องดิ้นรนต่อสู้อย่างลำบาก แต่สุดท้ายจะได้พบผู้ที่ช่วยให้ประสบความสำเร็จ",
  "癸未": "มักมีภาระเรื่องการเงินและหนี้สินมาก เสี่ยงเสียหายทางการเงิน",
};

// ผลการชง (冲) ของราศีล่างที่อยู่ติดกัน ตามตำแหน่งเสา (บรรทัด 549-552)
const CHONG_POSITION_TH: Record<"year-month" | "month-day" | "day-hour", string> = {
  "year-month": "ปีชงเดือน: มักต้องย้ายถิ่นฐานหรือแยกจากครอบครัว ไม่ได้ทำงานกับครอบครัว เปลี่ยนงานบ่อย หรือทำงานไกลบ้าน",
  "month-day": "เดือนชงวัน: มักขาดความเชื่อมั่นในตัวเอง มีปัญหาเรื่องคู่ครอง ครอบครัวไม่ค่อยสงบหรือไม่ได้อยู่พร้อมหน้ากัน",
  "day-hour": "วันชงยาม: มักมีความขัดแย้งหรือเข้มงวดกับคู่ครองและบุตร ความสัมพันธ์กับลูกไม่ค่อยราบรื่น",
};

// คู่ราศีล่างที่ชงกัน (ตรงข้ามในวง 12 นักษัตร)
const BRANCH_OPPOSITE: Record<string, string> = {
  子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅",
  卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳",
};

// การไห่ (害) 6 คู่ — ราศีล่างใส่ร้าย/ให้ร้ายกัน (บรรทัด 571-577)
const HAI_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["子", "未"], ["丑", "午"], ["寅", "巳"], ["卯", "辰"], ["申", "亥"], ["酉", "戌"],
];
const HAI_MEANING_TH =
  "มีเกณฑ์ถูกใส่ร้าย นินทาว่าร้าย หรือถูกกล่าวหาให้ได้รับความเสียหายจากคนใกล้ตัว หากรุนแรงอาจลุกลามเป็นคดีความ";

// การภาคี (六合) 6 คู่ — ราศีล่างจับคู่เป็นมิตร สมพงษ์ (บรรทัด 511-516)
const LIUHE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["子", "丑"], ["寅", "亥"], ["卯", "戌"], ["辰", "酉"], ["巳", "申"], ["午", "未"],
];
const LIUHE_MEANING_TH =
  "มีคู่มิตรสมพงษ์ในดวง คนรอบตัว/บริวาร/สังคมมักถูกชะตาและร่วมมือกันได้ดี ช่วยพลิกสถานการณ์ร้ายให้กลายเป็นดี";

// ไตรภาคี (三合) 4 กลุ่ม — รวมกลุ่มมีพลัง ร่วมทุน/ทีม/หุ้นส่วน (บรรทัด 707-710)
const SANHE_GROUPS: ReadonlyArray<{ branches: readonly string[]; element: string }> = [
  { branches: ["寅", "午", "戌"], element: "ไฟ" },
  { branches: ["巳", "酉", "丑"], element: "ทอง" },
  { branches: ["申", "子", "辰"], element: "น้ำ" },
  { branches: ["亥", "卯", "未"], element: "ไม้" },
];

// การเฮ้ง (刑) — เบียดเบียน อุปสรรค โต้เถียง (บรรทัด 578-619)
//  自刑 = เบียดเบียนตนเอง ; 三刑กลุ่มพาหะ = เรื่องเดินทาง ; 三刑กลุ่มดิน = เรื่องการเงิน ; 子卯 = ไร้มารยาท
const SELF_HENG_BRANCHES = new Set(["辰", "午", "酉", "亥"]);
const SELF_HENG_MEANING_TH =
  "เบียดเบียนตนเอง มักอึดอัดกังวล คิดมาก ไม่ค่อยไว้ใจใคร และบางครั้งกล่าวโทษหรือทำร้ายตัวเอง";
const HENG_PAIR_MEANING_TH: Record<string, string> = {
  "寅申": "เรื่องการเดินทาง/โยกย้ายมีอุปสรรค เสี่ยงอุบัติเหตุ และมีปากเสียงตัดไมตรีกันแบบไร้เยื่อใย",
  "巳申": "เรื่องการเดินทาง/โยกย้ายมีอุปสรรค เสี่ยงอุบัติเหตุ และมีปากเสียงตัดไมตรีกันแบบไร้เยื่อใย",
  "寅巳": "เรื่องการเดินทาง/โยกย้ายมีอุปสรรค เสี่ยงอุบัติเหตุ และมีปากเสียงตัดไมตรีกันแบบไร้เยื่อใย",
  "丑戌": "ถืออำนาจข่มเหงกัน เรื่องทรัพย์สิน/การเงินมีปัญหา และระบบย่อยอาหารต้องระวัง",
  "戌未": "ถืออำนาจข่มเหงกัน เรื่องทรัพย์สิน/การเงินมีปัญหา และระบบย่อยอาหารต้องระวัง",
  "丑未": "ถืออำนาจข่มเหงกัน เรื่องทรัพย์สิน/การเงินมีปัญหา และระบบย่อยอาหารต้องระวัง",
  "子卯": "ไม่ค่อยมีสัมมาคารวะ มักกระทบกระทั่งกันโดยไม่เกรงใจผู้หลักผู้ใหญ่",
};

const BRANCH_ORDER = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const orderedBranchPair = (a: string, b: string) =>
  BRANCH_ORDER.indexOf(a) <= BRANCH_ORDER.indexOf(b) ? `${a}${b}` : `${b}${a}`;

// วงจรก่อเกิด (生) ป้ายไทย: ไม้→ไฟ→ดิน→ทอง→น้ำ→ไม้
const THAI_GENERATES: Record<string, string> = {
  "ไม้": "ไฟ", "ไฟ": "ดิน", "ดิน": "ทอง", "ทอง": "น้ำ", "น้ำ": "ไม้",
};

// การภาคีราศีบน (天干五合) — ก้านฟ้าจับคู่แปรธาตุ (บรรทัด 472-484)
//  key = คู่ก้าน (เรียงไม่สำคัญ เก็บทั้งสองทิศ) → ธาตุที่แปร
const STEM_COMBINE: Record<string, string> = {
  "甲己": "ดิน", "己甲": "ดิน",
  "乙庚": "ทอง", "庚乙": "ทอง",
  "丙辛": "น้ำ", "辛丙": "น้ำ",
  "丁壬": "ไม้", "壬丁": "ไม้",
  "戊癸": "ไฟ", "癸戊": "ไฟ",
};

/** คำทำนายความสัมพันธ์ในผังดวง (ผั่ว ก้าน×กิ่งในเสาเดียวกัน + ชงระหว่างเสาที่ติดกัน) ตามตำราเคี้ยงคุง */
function buildNatalRelationNotes(calculatedState: CalculatedStateValue): string[] {
  const p = calculatedState.fourPillars;
  const notes: string[] = [];

  // การผั่ว: ก้าน×กิ่ง ในเสาเดียวกัน ตีความตามหลักที่ตก
  for (const key of ["year", "month", "day", "hour"] as const) {
    const meaning = PO_PILLAR_MEANING_TH[`${p[key].stem}${p[key].branch}`];
    if (meaning) {
      notes.push(`การผั่ว (破) ที่${PILLAR_LABEL_TH[key]} ${p[key].stem}${p[key].branch}: ${meaning}`);
    }
  }

  // การชง: ราศีล่างเสาที่ติดกันเป็นคู่ตรงข้าม
  const adjacents: Array<["year-month" | "month-day" | "day-hour", PillarKey, PillarKey]> = [
    ["year-month", "year", "month"],
    ["month-day", "month", "day"],
    ["day-hour", "day", "hour"],
  ];
  for (const [label, a, b] of adjacents) {
    if (BRANCH_OPPOSITE[p[a].branch] === p[b].branch) {
      notes.push(`การชง (冲) ${p[a].branch}-${p[b].branch} — ${CHONG_POSITION_TH[label]}`);
    }
  }

  // การภาคีราศีบน (天干五合): ก้านฟ้าเสาที่ติดกันจับคู่แปรธาตุ (ต้องอยู่ติดกัน)
  //  แปรสำเร็จหรือไม่ขึ้นกับฤดู (ราศีล่างหลักเดือน) — ถ้าธาตุเดือนตรง/ก่อเกิดธาตุที่แปร = แปรเด่น
  const monthBranchElement = elementLabel(branchElement(p.month.branch));
  for (const [, a, b] of adjacents) {
    const transformed = STEM_COMBINE[`${p[a].stem}${p[b].stem}`];
    if (!transformed) {
      continue;
    }
    const seasonSupports =
      monthBranchElement === transformed || THAI_GENERATES[monthBranchElement] === transformed;
    notes.push(
      `การภาคีราศีบน (天干合) ${p[a].stem}${p[b].stem} (แปรเป็นธาตุ${transformed}): มีแรงดึงดูดถูกชะตากับคนรอบตัว บุคลิกและพฤติกรรมปรับเปลี่ยนตามคน/งาน/สังคมที่เข้ามา` +
        (seasonSupports
          ? ` — ฤดู (หลักเดือนธาตุ${monthBranchElement}) เอื้อให้แปรเป็นธาตุ${transformed}สำเร็จ ช่วยพลิกดวงให้ดีขึ้นถ้าธาตุ${transformed}เป็นคุณกับดิถี`
          : ` — แต่ฤดู (หลักเดือนธาตุ${monthBranchElement}) ไม่เอื้อ จึงเป็นเพียงความสนิทสนมเหนี่ยวรั้งกัน ยังไม่แปรธาตุเต็มที่`),
    );
  }

  // คู่ราศีล่างทั้งหมดในผัง (ใช้ตรวจ ไห่/เฮ้ง/ภาคี แบบไม่อิงตำแหน่ง)
  const branches = (["year", "month", "day", "hour"] as const).map((k) => p[k].branch);
  const pairKeys = new Set<string>();
  for (let i = 0; i < branches.length; i += 1) {
    for (let j = i + 1; j < branches.length; j += 1) {
      pairKeys.add(orderedBranchPair(branches[i], branches[j]));
    }
  }
  const hasPair = (a: string, b: string) => pairKeys.has(orderedBranchPair(a, b));

  // การภาคี (六合) — คู่มิตรสมพงษ์ (รายงานครั้งเดียวถ้าพบ)
  if (LIUHE_PAIRS.some(([a, b]) => hasPair(a, b))) {
    const found = LIUHE_PAIRS.filter(([a, b]) => hasPair(a, b)).map(([a, b]) => `${a}${b}`).join(", ");
    notes.push(`การภาคี (六合) ${found}: ${LIUHE_MEANING_TH}`);
  }

  // ไตรภาคี (三合) — ครบ 3 ตัวในกลุ่มเดียว
  for (const group of SANHE_GROUPS) {
    if (group.branches.every((b) => branches.includes(b))) {
      notes.push(
        `ไตรภาคี (三合) ${group.branches.join("")} (ธาตุ${group.element}): รวมพลังเป็นกลุ่มก้อน เด่นเรื่องการร่วมมือ ทำงานเป็นทีม หุ้นส่วน และโครงการใหญ่ — เป็นคุณถ้าธาตุ${group.element}เป็นประโยชน์กับดิถี`,
      );
    }
  }

  // การไห่ (害)
  for (const [a, b] of HAI_PAIRS) {
    if (hasPair(a, b)) {
      notes.push(`การไห่ (害) ${a}${b}: ${HAI_MEANING_TH}`);
    }
  }

  // การเฮ้ง (刑): จื่อเฮ้ง (ราศีเดียวซ้ำ) + คู่เฮ้ง
  for (const branch of SELF_HENG_BRANCHES) {
    if (branches.filter((x) => x === branch).length >= 2) {
      notes.push(`การเฮ้งตนเอง (自刑) ${branch}${branch}: ${SELF_HENG_MEANING_TH}`);
    }
  }
  const reportedHeng = new Set<string>();
  for (const [pair, meaning] of Object.entries(HENG_PAIR_MEANING_TH)) {
    const [a, b] = [pair[0], pair[1]];
    const key = orderedBranchPair(a, b);
    if (hasPair(a, b) && !reportedHeng.has(key)) {
      reportedHeng.add(key);
      notes.push(`การเฮ้ง (刑) ${a}${b}: ${meaning}`);
    }
  }

  return notes;
}

/** บทคู่ครอง: ผั่วที่เสาวัน (เรือนคู่ครอง) + วันชงยาม → ผลต่อความสัมพันธ์คู่ครอง */
function buildSpouseRelationNotes(calculatedState: CalculatedStateValue): string[] {
  const p = calculatedState.fourPillars;
  const notes: string[] = [];
  const poDay = PO_PILLAR_MEANING_TH[`${p.day.stem}${p.day.branch}`];
  if (poDay) {
    notes.push(`การผั่ว (破) ที่เสาวัน (เรือนคู่ครอง) ${p.day.stem}${p.day.branch}: ${poDay} — สะท้อนปมที่ต้องระวังในชีวิตคู่`);
  }
  if (BRANCH_OPPOSITE[p.day.branch] === p.hour.branch) {
    notes.push(`การชง (冲) ${p.day.branch}-${p.hour.branch} — ${CHONG_POSITION_TH["day-hour"]}`);
  }
  return notes;
}

/** บทหุ้นส่วน: ไตรภาคี (三合) ในผัง = พลังรวมกลุ่ม/ทีม เหมาะร่วมทุน */
function buildPartnershipSanheNote(calculatedState: CalculatedStateValue): string | null {
  const branches = (["year", "month", "day", "hour"] as const).map(
    (k) => calculatedState.fourPillars[k].branch,
  );
  const group = SANHE_GROUPS.find((g) => g.branches.every((b) => branches.includes(b)));
  if (!group) {
    return null;
  }
  return `ดวงนี้มีไตรภาคี (三合) ${group.branches.join("")} (ธาตุ${group.element}) — มีพลังรวมกลุ่มสูง เหมาะกับการร่วมทุน ทำงานเป็นทีม และหุ้นส่วนที่สามัคคีสนับสนุนกัน ${group.element === elementLabel(CONTROLS[dayMasterElement(calculatedState)] as SupportedElementValue) ? "โดยเฉพาะเมื่อรวมกลุ่มเพื่อหาลาภผล" : "ยิ่งถ้าธาตุที่แปรเป็นคุณกับดิถีจะยิ่งส่งเสริม"}`;
}

/** บทครอบครัว: ปีชงเดือน (ฐานบรรพบุรุษ/พ่อแม่) */
function buildFamilyChongNote(calculatedState: CalculatedStateValue): string | null {
  const p = calculatedState.fourPillars;
  if (BRANCH_OPPOSITE[p.year.branch] === p.month.branch) {
    return `การชง (冲) ${p.year.branch}-${p.month.branch} — ${CHONG_POSITION_TH["year-month"]}`;
  }
  return null;
}

// อุปนิสัยตามธาตุดิถี × กำลัง (ตำราเคี้ยงคุง บรรทัด 76-115): ถูกฤดู / มากเกิน / น้อยเกิน
type ElementTemper = "balanced" | "excess" | "deficient";
const ELEMENT_TEMPER_TH: Record<ThaiElement, Record<ElementTemper, string>> = {
  "ดิน": {
    balanced: "ดินที่ถูกฤดู — เป็นคนซื่อสัตย์ หนักแน่น มีสัจจะรักษาคำพูด สุขุมรอบคอบ มั่นคง เชื่อมั่นในตนเอง น่าเชื่อถือ ใจกว้าง กตัญญู ปากกับใจตรงกัน",
    excess: "ดินที่แน่นและแข็งเกินไป — มักมีสติปัญญาน้อย ไม่ค่อยขยัน ชอบสบาย ไร้มารยาท พูดจาไม่สุภาพ เสียงดัง",
    deficient: "ดินที่น้อยหรือเหลวเกินไป — เสี่ยงเป็นคนไม่มีศักดิ์ศรี ไม่รักษาคำพูด เห็นแก่ตัว ไม่มีเครดิต พูดไม่ตรงกับใจ",
  },
  "ทอง": {
    balanced: "ทองที่ถูกฤดู — เป็นคนเฉียบขาด มีเหตุมีผล ชอบความถูกต้องและยุติธรรม ไม่คดโกง ไม่คิดมาก",
    excess: "ทองที่มากและแข็งเกินไป — มักก้าวร้าว ชอบใช้อำนาจ อารมณ์รุนแรง เหี้ยมโหด หูเบา",
    deficient: "ทองที่น้อยและอ่อนเกินไป — มักขาดความมั่นใจ ไม่เด็ดขาด ย้ำคิดย้ำทำ ไม่สนใจเกียรติยศศักดิ์ศรี",
  },
  "น้ำ": {
    balanced: "น้ำที่ถูกฤดู — แจ่มใสไม่ขุ่นมัว ใจถึงใจใหญ่ มีสติปัญญาเป็นเยี่ยม คล่องแคล่วว่องไว รู้ผิดชอบชั่วดี ความรู้สึกไว ชอบวางแผน",
    excess: "น้ำที่มากเกินไป — มักมีเล่ห์เหลี่ยมมาก เจ้าเล่ห์ กล้าได้กล้าเสียจนเกินเหตุ เปลี่ยนใจง่าย ใจรวนเร ชอบหาเรื่อง",
    deficient: "น้ำที่น้อยเกินไป — มักอ่อนไหวง่าย ใจแคบ ใจไม่ถึง ไม่มั่นใจในตนเอง ขี้ระแวง เฉื่อยชา",
  },
  "ไม้": {
    balanced: "ไม้ที่ถูกฤดู — เป็นคนใจบุญ ทำความดี มีเมตตา ขี้สงสาร ชอบช่วยเหลือผู้อื่น มุ่งมั่นสูง กระตือรือร้น ขยัน รักศักดิ์ศรี",
    excess: "ไม้ที่มากเกินไป — มักแข็งกระด้าง เอาแต่ใจ ไม่ก้มหัวให้ใคร ยึดความคิดตนเองเป็นใหญ่ ดื้อด้าน ยอมหักไม่ยอมงอ",
    deficient: "ไม้ที่น้อยเกินไป — มักขาดความมั่นใจ ขี้อิจฉา ขาดคุณธรรม ไร้เมตตา อ่อนไหวง่าย ไม่ขยัน",
  },
  "ไฟ": {
    balanced: "ไฟที่ถูกฤดู — มองโลกในแง่ดี มีมารยาท รักพวกพ้องเพื่อนฝูง ใจกว้างเปิดเผย ตรงไปตรงมา สุจริต มีน้ำใจ มีปัญญา",
    excess: "ไฟที่มากเกินไป — มักอารมณ์ร้อน ขี้โมโห มุทะลุ ชอบอวดศักดา เกเร หาเรื่องทะเลาะ",
    deficient: "ไฟที่น้อยเกินไป — มักขี้อิจฉา ไม่กล้าเปิดเผย ไร้น้ำใจ ไม่เสมอต้นเสมอปลาย คบเพื่อนยาก",
  },
};

function resolveElementTemper(band: StrengthBand): ElementTemper {
  if (band === "strong" || band === "very-strong") {
    return "excess";
  }
  if (band === "weak" || band === "very-weak") {
    return "deficient";
  }
  return "balanced";
}

function buildPersonalityReading(calculatedState: CalculatedStateValue): string | null {
  const imagery = buildDayMasterImagery(calculatedState);
  const index = getPersonalityIndex();
  const record = index?.byStemBranch.get(
    `${calculatedState.dayMaster}|${calculatedState.fourPillars.day.branch}`,
  );
  // keyword 12 เชี่ยงแซ (เช่น เชี่ยงแซ = กำเนิดใหม่/พัฒนา) — ตามคำกำชับซินแซให้เน้นแก่นของเชี่ยงแซ
  // (normalize สะกด เซี่ยงแซ/เชี่ยงแซ ที่ต่างกันระหว่างไฟล์นิสัยกับ constants)
  const normalizeQi = (label: string) => label.replace(/เซี่ยงแซ/g, "เชี่ยงแซ");
  const qiKeyword = record?.qiLabel
    ? Object.values(TWELVE_QI_CONTEXT_MAP).find(
        (entry) => entry.labelThai === normalizeQi(record.qiLabel),
      )?.contextTag
    : undefined;
  // fallback: ถ้าไม่มี record ของคู่ ก้าน|กิ่ง (เช่น 甲辰 ที่ขาดในไฟล์ 60 กะจื่อ)
  // ให้ใช้นิสัยระดับ "ก้านดิถี" แทน เพื่อให้บท 1 มีนิสัยพื้นฐานเสมอ ไม่เหลือแค่ภาพเปรียบ
  const stemText = record?.stemText || index?.stemText.get(calculatedState.dayMaster) || "";
  const segments = [
    imagery,
    stemText ? `ดิถี ${calculatedState.dayMaster}: ${stemText}` : null,
    record?.branchText ? `ราศีล่างวัน ${calculatedState.fourPillars.day.branch}: ${record.branchText}` : null,
    record?.elementText
      ? `${record.elementLabel} ${record.qiLabel}${qiKeyword ? ` (แก่นเชี่ยงแซ: ${qiKeyword})` : ""}: ${record.elementText}`
      : null,
  ].filter((segment): segment is string => Boolean(segment));

  // อุปนิสัยตามธาตุดิถี × กำลัง (ถูกฤดู/มากเกิน/น้อยเกิน) ตามตำราเคี้ยงคุง
  const dmTemper = ELEMENT_TEMPER_TH[elementLabel(dayMasterElement(calculatedState))];
  if (dmTemper) {
    segments.push(dmTemper[resolveElementTemper(resolveStrengthBand(calculatedState))]);
  }

  // ความสัมพันธ์ในผังดวง (ผั่ว/ชง) ตามตำราเคี้ยงคุง — เสริมคำทำนายเชิงลึกถ้าตรวจพบ
  const relationNotes = buildNatalRelationNotes(calculatedState);
  if (relationNotes.length > 0) {
    segments.push(`ความสัมพันธ์เด่นในผังดวง:\n${relationNotes.join("\n")}`);
  }

  return segments.length > 0 ? segments.join("\n\n") : null;
}

function buildHealthReading(calculatedState: CalculatedStateValue): string | null {
  const map = parseHealthByElement();
  if (!map) {
    return null;
  }
  // (1) ธาตุที่อ่อนแอ → อวัยวะตามตำรา health.txt
  const segments = resolveWeakElements(calculatedState)
    .map((element) => (map.has(element) ? `ธาตุ${element}อ่อนแอ: ${map.get(element)}` : null))
    .filter((segment): segment is string => Boolean(segment));

  // (2) ธาตุที่ล้นเกิน → กดทับร่างกาย (เช่น น้ำเยอะ → อ้วน/บวมน้ำ) — ตำรากำชับให้ดูควบคู่กับธาตุที่ขาด
  const weakSet = new Set(resolveWeakElements(calculatedState));
  for (const element of resolveExcessElements(calculatedState)) {
    if (!weakSet.has(element)) {
      segments.push(`ธาตุ${element}มากเกินไป: ${EXCESS_HEALTH_TH[element]}`);
    }
  }

  // (2b) ตำแหน่งที่ 12 เชี่ยงแซตกหนัก (เจ๊าะ=สูญสิ้น / ซวย=ถดถอย) → ธาตุ/อวัยวะตำแหน่งนั้นต้องระวัง
  const BAD_HEALTH_QI = new Set(["เจ๊าะ", "ซวย"]);
  for (const pillar of ["year", "month", "day", "hour"] as PillarKey[]) {
    const value = calculatedState.fourPillars[pillar];
    const posQi = resolveDisplayTwelveQiStage(value.stem, value.branch);
    if (!BAD_HEALTH_QI.has(posQi)) {
      continue;
    }
    const organElement = elementLabel(branchElement(value.branch));
    const organ = map.get(organElement);
    segments.push(
      `${PILLAR_LABEL_TH[pillar]} (${value.stem}${value.branch} → ${posQi}) สภาวะตก ระวังสุขภาพด้านธาตุ${organElement}${organ ? `: ${organ}` : ""}`,
    );
  }

  if (segments.length === 0) {
    return null;
  }
  // (3) ช่วงอายุที่ควรระวังสุขภาพ = วัยจรที่ 12 เชี่ยงแซตก (เจ๊าะ/ซี่/แป่/ซวย/หมอ)
  const cautionAges = buildDaYunPhaseInfos(calculatedState)
    .filter((phase) => phase.tier === "falling")
    .map((phase) => `อายุ ${phase.ageRange} (${phase.symbol} → ${phase.qi})`);
  if (cautionAges.length > 0) {
    segments.push(`ช่วงอายุที่ควรใส่ใจสุขภาพเป็นพิเศษ (วัยจรสภาวะอ่อนแรง/ถดถอย): ${cautionAges.join(", ")}`);
  }
  // (4) วิธีแก้ = เสริมธาตุที่ดวงต้องการ (useful god) ตามตำรา
  const useful = resolveUsefulElements(calculatedState);
  if (useful.length > 0) {
    segments.push(`แนวทางดูแล: ปรับสมดุลด้วยธาตุที่ดวงต้องการ (${useful.join(" / ")}) เพื่อพยุงดิถีและลดผลของธาตุที่ล้นเกิน`);
  }
  return segments.join("\n\n");
}

// ตำแหน่งดาวลาภ (财) บอก "แหล่ง" ของโชคลาภ (อ้างอิง 1.docx บท 3)
const WEALTH_SOURCE_TH: Record<PillarKey, string> = {
  year: "หลักปี (เชื่อมกับสังคม/คนภายนอก และมรดก-รากฐานจากครอบครัว ปู่ย่าตายาย)",
  month: "หลักเดือน (จากหน้าที่การงานและผู้ใหญ่รอบตัว)",
  day: "หลักวัน (จากตัวเองและคู่ครอง)",
  hour: "หลักยาม (จากลูกน้อง บริวาร ผลงาน และช่วงบั้นปลาย)",
};

/** บท 3 โชคลาภ = ตำแหน่งดาวลาภ (财) × กำลังดาวลาภ × ดิถีแข็ง-อ่อน */
// ไฉ่โข่ว (财库 คลังทรัพย์) ตามตำราเคี้ยงคุง = กิ่ง "คลังดิน" ที่เก็บธาตุลาภของดิถี (บรรทัด 1087-1294)
//  หากกิ่งคลังนี้อยู่ในผัง = มีคลังทรัพย์; เมื่อถูกชง (เปิดคลัง) ทรัพย์ที่สะสมจะได้นำออกมาใช้ (บรรทัด 541)
//  (己 ตกหล่นในตำรา เติมเป็น 辰 ตามหลักเดียวกับ 戊: ดิถีดิน ลาภ=น้ำ คลังน้ำ=辰)
const WEALTH_VAULT_BRANCH_BY_DAY_STEM: Record<string, string> = {
  甲: "辰", 乙: "辰", 丙: "丑", 丁: "丑", 戊: "辰", 己: "辰",
  庚: "未", 辛: "未", 壬: "戌", 癸: "戌",
};

function buildWealthReading(calculatedState: CalculatedStateValue): string | null {
  const dm = dayMasterElement(calculatedState);
  const wealth = CONTROLS[dm] as SupportedElementValue; // ดาวลาภ = ธาตุที่ดิถีพิฆาต
  const wealthLabel = elementLabel(wealth);
  const band = resolveStrengthBand(calculatedState);
  const dmWeak = band === "weak" || band === "very-weak";
  const wealthStrength = resolveElementStrengthLabel(calculatedState, wealth);

  // หาตำแหน่งที่ดาวลาภปรากฏ (ราศีบน/ล่าง ทั้ง 4 เสา) แล้วสรุปเป็น "แหล่งโชคลาภ"
  // + อ่านความหมายตาม 12 เชี่ยงแซของแต่ละตำแหน่ง (วิธีทายซินแซ: โชคลาภหลายทาง อ่านทีละตำแหน่ง)
  // ความชัดเจนของโชคลาภตามตำแหน่งเสา: ปี/เดือน = ชั้นนอก เห็นชัด/เปิดเผย; วัน/ยาม = ชั้นใน แอบซ่อน/ไม่ชัด
  const WEALTH_VISIBILITY: Record<PillarKey, string> = {
    year: "เห็นชัด",
    month: "เห็นชัด",
    day: "แอบซ่อน ไม่ชัดเจน",
    hour: "แอบซ่อน ไม่ชัดเจน",
  };
  // อ่านแต่ละตำแหน่งดาวลาภด้วย 2 เซียงแซ:
  //  ตัวแรก (~80%) = เซียงแซเทียบดิถี — ช่องก้าน: ก้านตำแหน่ง×กิ่งวัน / ช่องกิ่ง: ก้านวัน×กิ่งตำแหน่ง
  //  ตัวหลัง (~20%) = self-seat (自坐) ก้านเสานั้น×กิ่งเสานั้น → "ขยาย/เสริมแรง" แนวโน้มของตัวแรก
  const dayStem = calculatedState.fourPillars.day.stem;
  const dayBranch = calculatedState.fourPillars.day.branch;
  const sources = new Set<string>();
  const positionWealthLines: string[] = [];
  for (const pillar of ["year", "month", "day", "hour"] as PillarKey[]) {
    const value = calculatedState.fourPillars[pillar];
    const selfSeatQi = resolveDisplayTwelveQiStage(value.stem, value.branch); // 自坐 = ตัวขยาย
    const cells: Array<{ symbol: string; place: string; primaryQi: string }> = [];
    if (stemElement(value.stem) === wealth) {
      cells.push({ symbol: value.stem, place: "ราศีบน", primaryQi: resolveDisplayTwelveQiStage(value.stem, dayBranch) });
    }
    if (branchElement(value.branch) === wealth) {
      cells.push({ symbol: value.branch, place: "ราศีล่าง", primaryQi: resolveDisplayTwelveQiStage(dayStem, value.branch) });
    }
    if (cells.length === 0) {
      continue;
    }
    sources.add(WEALTH_SOURCE_TH[pillar]);
    for (const c of cells) {
      const meaning = QI_WEALTH_TH[c.primaryQi];
      if (!meaning) {
        continue;
      }
      const amp =
        selfSeatQi && selfSeatQi !== c.primaryQi
          ? ` ขยายด้วยเซียงแซ ${selfSeatQi} (~20%)`
          : selfSeatQi
            ? ` (ตัวแรกซ้อนตัวขยายเป็น ${selfSeatQi} เหมือนกัน ยิ่งตอกย้ำแนวโน้มนี้)`
            : "";
      positionWealthLines.push(
        `• ${WEALTH_SOURCE_TH[pillar]} ${c.place} ${c.symbol} → ${c.primaryQi} (~80%)${amp} / ${WEALTH_VISIBILITY[pillar]}: ${meaning}`,
      );
    }
  }

  const segments: string[] = [];

  // (1) กำลังดาวลาภ
  if (wealthStrength === "strong") {
    segments.push(`ดวงนี้ดาวโชคลาภ (ธาตุ${wealthLabel}) แข็งแรง มีโอกาสและช่องทางการเงินที่ดีอยู่ในดวง`);
  } else if (wealthStrength === "weak" || wealthStrength === "missing") {
    segments.push(`ดาวโชคลาภ (ธาตุ${wealthLabel}) ไม่เด่น โอกาสการเงินมักต้องสร้างขึ้นเองเป็นจังหวะ มากกว่าจะลอยมาเอง`);
  } else {
    segments.push(`ดาวโชคลาภ (ธาตุ${wealthLabel}) มีกำลังปานกลาง ค่อย ๆ สะสมได้ตามความสม่ำเสมอ`);
  }

  // (2) แหล่งโชคลาภตามตำแหน่งเสา + อ่านแต่ละตำแหน่งตาม 12 เชี่ยงแซ
  if (sources.size > 0) {
    const header = `โชคลาภปรากฏหลายทาง ที่ ${[...sources].join(" และ ")} — อ่านความหมายแต่ละตำแหน่ง:`;
    segments.push(positionWealthLines.length > 0 ? `${header}\n${positionWealthLines.join("\n")}` : `โชคลาภปรากฏที่ ${[...sources].join(" และ ")}`);
  }

  // (3) ลักษณะลาภผล — ดิถีแข็งคว้าเงินก้อน, ดิถีอ่อนเด่นรายได้สะสมต่อเนื่อง (passive)
  segments.push(
    dmWeak
      ? "ลักษณะลาภผล: เด่นเรื่องรายได้แบบสะสมต่อเนื่อง (passive income) เช่น ค่าเช่า เงินเดือน ค่าคอมมิชชัน หรือรายได้ประจำหลายทางรวมกัน เริ่มทีละน้อยแล้วทบเป็นก้อนใหญ่ มากกว่าการเสี่ยงเงินก้อนครั้งเดียว"
      : "ลักษณะลาภผล: เหมาะกับการคว้าเงินก้อนจากการลงทุนหรือธุรกิจที่ลงมือทำเอง กล้าตัดสินใจในจังหวะที่มั่นใจ",
  );

  // (4) ดิถีอ่อน → ต้องพยายามมากกว่าจะคว้าโอกาสเป็นผล + โฟกัสสิ่งที่ถนัดที่สุด + เหมาะงานนายหน้า/ตัวกลาง
  if (dmWeak) {
    segments.push(
      "แต่เพราะดิถีอ่อน จึงต้องใช้แรงกาย แรงใจ และความพยายามมากกว่าคนอื่นในการเปลี่ยนโอกาสให้กลายเป็นผลลัพธ์จริง — เงื่อนไขสำคัญคือต้องโฟกัสสิ่งที่ตนถนัดและเชี่ยวชาญที่สุดเพียงทางเดียว ไม่ทำหลายอย่างพร้อมกัน",
    );
    segments.push(
      "ด้วยดิถีอ่อน เหมาะกับงานนายหน้า ตัวกลาง หรือเชื่อมโยงคนเข้าหากัน ที่ใช้ทุนต่ำมากกว่าการสต๊อกสินค้าก้อนใหญ่ เพราะการลงทุนหนักในสินค้าเสี่ยงจมทุนหรือเป็นหนี้ได้ง่าย",
    );
  }

  // (4b) มรดก/ทรัพย์สินเก่า — ดาวลาภหรือดาวส่งเสริม (印) อยู่เสาปี/เดือน (ฐานบรรพบุรุษ/ผู้ใหญ่)
  const resource = inverseGenerate(dm);
  const ancestralWealth = (["year", "month"] as PillarKey[]).some((pillar) => {
    const value = calculatedState.fourPillars[pillar];
    const elems = [stemElement(value.stem), branchElement(value.branch)];
    return elems.includes(wealth) || elems.includes(resource);
  });
  if (ancestralWealth) {
    segments.push(
      "มีเกณฑ์ได้รับทรัพย์จากมรดก ทรัพย์สินเก่า หรือสิ่งสะสมที่มูลค่าเพิ่มตามเวลา (เช่น บ้าน ที่ดิน ของเก่า) โดยเฉพาะเมื่อเข้าสู่วัยกลางคน",
    );
  }

  // (4b-2) ไฉ่โข่ว (财库 คลังทรัพย์) — กิ่งคลังที่เก็บธาตุลาภของดิถี ปรากฏในผัง
  const vaultBranch = WEALTH_VAULT_BRANCH_BY_DAY_STEM[calculatedState.dayMaster];
  if (vaultBranch) {
    const vaultPillars = (["year", "month", "day", "hour"] as PillarKey[]).filter(
      (pillar) => calculatedState.fourPillars[pillar].branch === vaultBranch,
    );
    if (vaultPillars.length > 0) {
      const where = vaultPillars.map((pillar) => PILLAR_LABEL_TH[pillar]).join(" และ ");
      // คลังเปิดเมื่อถูกชง = มีกิ่งตรงข้ามของกิ่งคลังอยู่ในผัง
      const opener = BRANCH_OPPOSITE[vaultBranch];
      const opened = (["year", "month", "day", "hour"] as PillarKey[]).some(
        (pillar) => calculatedState.fourPillars[pillar].branch === opener,
      );
      segments.push(
        `ดวงนี้มี “ไฉ่โข่ว” (财库 คลังทรัพย์ธาตุ${wealthLabel}) ที่${where} — มีดวงเก็บสะสมทรัพย์เป็นกอบเป็นกำ มีคลังเงินไว้ใช้ยามจำเป็น` +
          (opened
            ? ` และคลังนี้ถูกชง (${vaultBranch}-${opener}) = “เปิดคลัง” ทรัพย์ที่สะสมไว้จะได้นำออกมาใช้จริงเป็นช่วง ๆ`
            : ` คลังนี้จะเปิดให้ใช้ทรัพย์เต็มที่เมื่อมีปีจร/วัยจรกิ่ง ${opener} เข้ามาชงเปิดคลัง`),
      );
    }
  }

  // (4c) ลูกค้า/รายได้จากคนรุ่นน้อง — ดาวถ่ายเท (食傷) สร้างลาภ (食傷生财) เมื่อมีดาวถ่ายเทในดวง
  const output = GENERATES[dm] as SupportedElementValue;
  const hasOutput = (["year", "month", "day", "hour"] as PillarKey[]).some((pillar) => {
    const value = calculatedState.fourPillars[pillar];
    return stemElement(value.stem) === output || branchElement(value.branch) === output;
  });
  if (hasOutput) {
    segments.push(
      "ช่องทางลาภเด่นแบบ “ดาวถ่ายเทสร้างลาภ” (食傷生财) คือใช้ทักษะ/บริการดึงเงิน กลุ่มลูกค้าที่นำทรัพย์เข้ามามักเป็นคนอายุน้อยกว่า รุ่นน้อง หรือผู้ที่ต้องการการดูแลเอาใจใส่",
    );
  }

  // (5) ช่วงวัยแห่งโชคลาภ = ช่วงที่ดาวลาภ (财) เข้าวัยจร — วัยเด็ก (<20) ตีเป็นเรื่องการเรียน/สอบ
  const wealthTiming = findTimingByElement(
    calculatedState,
    wealth,
    {
      rising: "ช่วงเปิดโชคลาภ การเงินไหลเข้าดี เหมาะขยายงานหรือลงทุนตามกำลัง",
      transitional: "โชคลาภเข้ามาแต่ผันผวน ควรเก็บออมและคุมรายจ่าย",
      falling: "ระวังการเงินรั่วไหล ไม่ควรเสี่ยงลงทุนก้อนใหญ่",
    },
    {
      youth: {
        rising: "วัยเรียนช่วงรุ่ง มีโอกาสสอบติดโรงเรียน/มหาวิทยาลัยชั้นนำ หรือได้ทุนการศึกษา",
        transitional: "การเรียนมีจังหวะขึ้นลง ควรตั้งใจสม่ำเสมอเพื่อผลสอบที่ดี",
        falling: "ระวังเรื่องการเรียน/การสอบ อาจสอบไม่ติดหรือผลไม่เป็นไปตามหวัง ต้องทุ่มเทเป็นพิเศษ",
      },
    },
  );
  if (wealthTiming.length > 0) {
    segments.push(`ช่วงวัยแห่งโชคลาภ (ดาวลาภธาตุ${wealthLabel} เข้าวัยจร):\n${wealthTiming.join("\n")}`);
  }

  // (6) แนบหลักการตามตำรา (wealth.txt) ถ้ามี
  const bookLine = parseWealthByBand()?.get(band);
  if (bookLine) {
    segments.push(`หลักการตามตำรา: ${bookLine}`);
  }

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

type CurrentPhase = { symbol: string; element: SupportedElementValue; ageRange: string; qi: string };

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
        return {
          symbol: phase.symbol,
          element: element as SupportedElementValue,
          ageRange,
          qi: (phase.twelveQiDisplay ?? "").trim(),
        };
      }
    }
  }
  return null;
}

/** คำเรียกระดับช่วงตามสภาวะ 12 เชี่ยงแซ (ใช้ย่อเมื่อช่วงกินหลายปี) */
const QI_TIER_LABEL_TH: Record<QiTier, string> = {
  rising: "ช่วงพลังขึ้น",
  transitional: "ช่วงผันผวน/ปรับตัว",
  falling: "ช่วงพลังถดถอย",
};

/**
 * พยากรณ์ปีจร (liu nian) รายปีแบบเต็ม (P-B) — กรอบ 20 ปีข้างหน้า
 * คิดบทบาทธาตุของแต่ละปีเทียบดิถี + 12 เชี่ยงแซ แล้วจับกลุ่มปีที่คุณภาพคล้ายกันเป็นช่วง
 * (เช่น "อายุ 48-52 ดาวลาภเข้าช่วงรุ่ง → โอกาสเห็นเงินก้อน")
 */
function buildLiuNianYearlyForecast(calculatedState: CalculatedStateValue): string | null {
  const series = calculatedState.liuNianSeries ?? [];
  if (series.length === 0) {
    return null;
  }
  const dm = dayMasterElement(calculatedState);
  const band = resolveStrengthBand(calculatedState);

  type YearInfo = {
    year: number;
    age: number;
    stem: string;
    branch: string;
    qi: string;
    role: RelationRole;
    tier: QiTier;
  };
  const enriched: YearInfo[] = series.map((entry) => {
    const qi = (entry.twelveQiDisplay ?? "").trim();
    return {
      year: entry.year,
      age: entry.age,
      stem: entry.stem,
      branch: entry.branch,
      qi,
      role: resolveRelationRole(dm, stemElement(entry.stem)),
      tier: classifyQiTier(qi),
    };
  });

  // จับกลุ่มปีต่อเนื่องที่มีบทบาทธาตุ + ระดับ 12 เชี่ยงแซเดียวกัน
  const groups: YearInfo[][] = [];
  for (const info of enriched) {
    const current = groups[groups.length - 1];
    const last = current?.[current.length - 1];
    if (current && last && current[0].role === info.role && current[0].tier === info.tier && info.age === last.age + 1) {
      current.push(info);
    } else {
      groups.push([info]);
    }
  }

  const lead =
    "พยากรณ์ปีจร (เลี่ยงนี้ / liu nian) รายปีในกรอบ 20 ปีข้างหน้า — ดูบทบาทธาตุของแต่ละปีเทียบดิถีและสภาวะ 12 เชี่ยงแซ แล้วรวมปีที่คุณภาพใกล้กันเป็นช่วงเพื่อให้เห็นจังหวะชัด";

  const lines = groups.map((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    const ageRange = first.age === last.age ? `${first.age}` : `${first.age}-${last.age}`;
    const yearRange =
      first.year === last.year ? `${first.year}` : `${first.year}-${last.year}`;
    const beRange =
      first.year === last.year ? `${first.year + 543}` : `${first.year + 543}-${last.year + 543}`;
    const qiText =
      group.length === 1
        ? first.qi
          ? ` → ${first.qi}`
          : ""
        : ` → ${QI_TIER_LABEL_TH[first.tier]}`;
    const verdict = buildLuckPhaseVerdict(band, first.role, first.qi, first.age);
    return `อายุ ${ageRange} ปี (พ.ศ. ${beRange} / ค.ศ. ${yearRange}, ${RELATION_ROLE_SHORT[first.role]}${qiText}): ${verdict}`;
  });

  return [lead, ...lines].join("\n");
}

// ความหมายของเสาในตารางเส้นขีดวัยจร (8 ตัว) — วัยจรเทียบทีละตัวตามความหมายของเสา
const DAYUN_DIMENSION_TH: Record<PillarKey, string> = {
  year: "ลูกค้า/สังคม/ผู้ใหญ่",
  month: "การงาน/พ่อแม่/ธุรกิจ",
  day: "ภาพรวมตัวเองและคู่",
  hour: "สิ่งที่ทำ/บริวาร/รุ่นน้อง",
};

const QI_TIER_OUTCOME_TH: Record<QiTier, string> = {
  rising: "ส่งเสริม รุ่งเรืองขึ้น",
  transitional: "ผันผวน ต้องประคอง",
  falling: "อ่อนแรง ถดถอย ระวังสะดุด",
};

/** บทเสริม "8 ตัว": วัยจรปัจจุบันเทียบทีละตัวอักษรในผัง → 12 เชี่ยงแซ ทายตามความหมายของเสา */
function buildDaYunCharacterBreakdown(calculatedState: CalculatedStateValue): string {
  const current = calculatedState.daYun.find((pillar) => pillar.isCurrent);
  if (!current) {
    return "";
  }
  const daYunStem = current.stem;
  const lines: string[] = [];
  for (const pillar of ["day", "month", "year", "hour"] as PillarKey[]) {
    const value = calculatedState.fourPillars[pillar];
    const stemQi = resolveDisplayStemPairStage(daYunStem, value.stem);
    const branchQi = resolveDisplayTwelveQiStage(daYunStem, value.branch);
    const parts = [
      stemQi ? `${value.stem}→${stemQi}` : "",
      branchQi ? `${value.branch}→${branchQi}` : "",
    ].filter(Boolean);
    const worstTier = [stemQi, branchQi]
      .filter(Boolean)
      .map(classifyQiTier)
      .sort((a, b) => (a === "falling" ? -1 : b === "falling" ? 1 : 0))[0] ?? "transitional";
    lines.push(`${DAYUN_DIMENSION_TH[pillar]} (${parts.join(", ")}): ${QI_TIER_OUTCOME_TH[worstTier]}`);
  }
  return lines.length > 0
    ? `เจาะวัยจรปัจจุบัน (${daYunStem}${current.branch}) เทียบทีละตัวอักษรในผังตามความหมายของเสา:\n${lines.join("\n")}`
    : "";
}

function buildLuckCycleReading(calculatedState: CalculatedStateValue): string | null {
  // เจาะลึกช่วงปัจจุบัน + ราว 20 ปีข้างหน้า (4 ช่วง 5 ปี) — ใช้ deepNote จากตารางวัยจรที่คิดครบ 3 มิติแล้ว
  const rows = buildRelationshipLinesMapping(calculatedState);
  if (rows.length === 0) {
    return null;
  }
  const current = findCurrentDaYunPhase(calculatedState);
  let startIndex = current ? rows.findIndex((row) => row.ageRange === current.ageRange) : 0;
  if (startIndex < 0) {
    startIndex = 0;
  }
  const window = rows.slice(startIndex, startIndex + 4);

  const lead = current
    ? `วิเคราะห์จังหวะชีวิตเจาะลึกตั้งแต่ช่วงปัจจุบัน (อายุ ${current.ageRange}) ต่อเนื่องไปอีกราว 20 ปีข้างหน้า โดยดูบทบาทธาตุของวัยจรควบคู่สภาวะ 12 เชี่ยงแซเทียบดิถี`
    : "วิเคราะห์จังหวะชีวิตตามวัยจรช่วงละ 5 ปี โดยดูบทบาทธาตุควบคู่สภาวะ 12 เชี่ยงแซเทียบดิถี";

  const lines = window.map((row) => {
    const tag = current && row.ageRange === current.ageRange ? " ◆ ช่วงปัจจุบัน" : "";
    return `อายุ ${row.ageRange}${tag} (${row.symbol} — ${row.relationLine}): ${row.deepNote}`;
  });

  // ปีจรปัจจุบัน (liu nian) — เน้นจังหวะของ "ปีนี้" ทับบนภาพวัยจร 10 ปี
  const liuNian = calculatedState.liuNian;
  let liuNianLine = "";
  if (liuNian) {
    const band = resolveStrengthBand(calculatedState);
    const dm = dayMasterElement(calculatedState);
    const lnElement = stemElement(liuNian.stem);
    const lnRole = resolveRelationRole(dm, lnElement);
    const lnQi = ((calculatedState.twelveQi as Record<string, string>).currentLiuNianBranch ?? "").trim();
    const curAge = current ? Number.parseInt(current.ageRange, 10) : undefined;
    const lnVerdict = buildLuckPhaseVerdict(band, lnRole, lnQi, Number.isNaN(curAge as number) ? undefined : curAge);
    liuNianLine = `ปีจรปัจจุบัน (${liuNian.stem}${liuNian.branch} ธาตุ${elementLabel(lnElement)} เป็น${lnRole}${lnQi ? ` → ${lnQi}` : ""}): ${lnVerdict}`;
  }

  // บท 12 อ่านสั้น: ช่วงวัยจร (บทบาทธาตุ เช่น ลาภ + 12 เซียงแซ เช่น หมกยก) + ปีจรปัจจุบันเท่านั้น
  // (ตัดบทเสริม 8 ตัว + พยากรณ์รายปี 20 ปี ออกตามคำกำชับให้สั้น — ยังมีตารางวัยจรเต็มในบทเสริมหลังบท 15)
  return [lead, ...lines, liuNianLine].filter(Boolean).join("\n\n");
}

// ───────── Rev6: ตารางวิเคราะห์เส้นขีดความสัมพันธ์ หมวดวัยจร (Relationship Lines Mapping, อ้างอิง M.docx บทเสริม) ─────────

export type RelationshipLineRow = {
  ageRange: string;
  symbol: string;
  /** เส้นขีดที่ทำงาน เช่น "ถ่ายเท → เชี่ยงแซ" */
  relationLine: string;
  /** คำอธิบายดี-ร้ายเชิงลึก (บทบาทธาตุ × 12 เชี่ยงแซ × ดิถีแข็ง-อ่อน × วัย) */
  deepNote: string;
};

const RELATION_ROLE_SHORT: Record<RelationRole, string> = {
  "คู่ธาตุ": "คู่ธาตุ",
  "ธาตุถ่ายเท": "ถ่ายเท",
  "ธาตุพิฆาต": "ลาภ (ดิถีพิฆาต)",
  "พิฆาตธาตุ": "อำนาจ (พิฆาตดิถี)",
  "ธาตุส่งเสริม": "ส่งเสริม",
};

// ───────── คำอธิบายดี-ร้ายเชิงลึก = บทบาทธาตุ × คุณภาพ 12 เชี่ยงแซ × ดิถีแข็ง-อ่อน ─────────
// อ้างตำรา M.docx บทเสริม: "คิดดิถีแข็งอ่อน ควบคู่ปฏิกิริยา (12 เชี่ยงแซ) เสมอ"

/** สิ่งที่ "เข้ามา" ตามบทบาทธาตุของวัยจร (วัยทำงาน) */
const ROLE_INFLOW_TH: Record<RelationRole, string> = {
  "คู่ธาตุ": "เพื่อน พี่น้อง หุ้นส่วน หรือคนรอบตัว (คู่ธาตุ)",
  "ธาตุส่งเสริม": "ผู้ใหญ่อุปถัมภ์ ความรู้ และแรงหนุนหลัง (ธาตุส่งเสริม)",
  "ธาตุถ่ายเท": "การใช้ทักษะ ความคิด และผลงาน (ธาตุถ่ายเท)",
  "ธาตุพิฆาต": "โอกาสด้านโชคลาภและทรัพย์สิน (ธาตุลาภ)",
  "พิฆาตธาตุ": "ภาระ หน้าที่ อำนาจ และแรงกดดัน (ธาตุอำนาจ)",
};

// วัยเรียน (ไม่เกิน 20 ปี): การงาน/ถ่ายเท = "การเรียน", โชคลาภ = "เรื่องผลการเรียน" (อ้างตำรา M.docx)
const SCHOOL_AGE_MAX = 20;
const ROLE_INFLOW_SCHOOL_TH: Record<RelationRole, string> = {
  "คู่ธาตุ": "เพื่อนและกลุ่มเรียน (คู่ธาตุ)",
  "ธาตุส่งเสริม": "ครู ความรู้ และผู้ใหญ่ที่สนับสนุนการเรียน (ธาตุส่งเสริม)",
  "ธาตุถ่ายเท": "การเรียนและการฝึกฝนทักษะ (ถ่ายเท = การเรียนในวัยนี้)",
  "ธาตุพิฆาต": "ผลการเรียนและโอกาสทางการศึกษา (ลาภ = เรื่องการเรียนในวัยนี้)",
  "พิฆาตธาตุ": "วินัย กฎระเบียบ และแรงกดดันจากการสอบ/การเรียน (ธาตุอำนาจ)",
};

type QiTier = "rising" | "transitional" | "falling";

// 12 เชี่ยงแซ ตาม "นิยามเชี่ยงแซ" ตำราเคี้ยงคุง (บรรทัด 2012-2027)
//  ตัวดี (พลังขึ้น): เชี่ยงแซ กวงตั่ว ลิ่มกัว ตี้อ๋วง
//  ตัวเสีย (พลังลง): หมกยก ซวย แป่ ซี่ เจ๊าะ
//  ตัวกลาง (ผันผวน/เปลี่ยนผ่าน): ทอ เอี๊ยง หมอ
const RISING_QI = new Set(["เชี่ยงแซ", "กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง"]);
const FALLING_QI = new Set(["หมกยก", "ซวย", "แป่", "ซี่", "เจ๊าะ"]);

function classifyQiTier(qi: string): QiTier {
  if (RISING_QI.has(qi)) {
    return "rising";
  }
  if (FALLING_QI.has(qi)) {
    return "falling";
  }
  return "transitional"; // ทอ, เอี๊ยง, หมอ
}

const QI_MANIFEST_TH: Record<QiTier, string> = {
  rising: "ที่กำลังเติบโตรุ่งเรือง",
  transitional: "ที่ยังผันผวนไม่นิ่ง",
  falling: "ที่อ่อนแรงถดถอย",
};

const SUPPORTIVE_ROLES = new Set<RelationRole>(["คู่ธาตุ", "ธาตุส่งเสริม"]);

/** ธาตุวัยจรเป็น "ตัวช่วย" หรือ "ตัวดูดพลัง" ของดิถี ขึ้นกับดิถีแข็ง-อ่อน */
function resolveRoleEffect(band: StrengthBand, role: RelationRole): "support" | "drain" | "neutral" {
  const isSupportive = SUPPORTIVE_ROLES.has(role);
  if (band === "very-weak" || band === "weak") {
    return isSupportive ? "support" : "drain";
  }
  if (band === "very-strong" || band === "strong") {
    return isSupportive ? "drain" : "support";
  }
  return "neutral"; // balanced
}

// ผลลัพธ์ดี-ร้าย = (ตัวช่วย/ตัวดูดพลัง/สมดุล) × (รุ่ง/ผันผวน/ถดถอย)
const VERDICT_MATRIX: Record<"support" | "drain" | "neutral", Record<QiTier, string>> = {
  support: {
    rising: "[ยุคทอง] เป็นช่วงได้รับการสนับสนุนเต็มที่ ดิถีมีกำลัง ควรรุกและคว้าโอกาสให้สุด",
    transitional: "ตัวช่วยมีเข้ามาแต่ยังไม่นิ่ง ต้องประคองและเลือกที่พึ่งให้ดี",
    falling: "[เฝ้าระวัง] ตัวช่วยอ่อนแรงหรือกลายเป็นภาระ ต้องพึ่งตัวเองและตั้งรับ",
  },
  drain: {
    rising: "[โอกาสมาพร้อมภาระ] มีโอกาสและผลงานเด่นชัด แต่ดึงพลังดิถีให้เหนื่อยล้า ควรหาคนช่วยแบ่งเบา",
    transitional: "เหนื่อยใจกับความผันผวน คุมผลลัพธ์ให้เป็นชิ้นเป็นอันได้ยาก",
    falling: "[เฝ้าระวัง] ทั้งเสียพลังและไม่เกิดผล เสี่ยงสุขภาพ/การเงินสะดุด ควรชะลอ",
  },
  neutral: {
    rising: "[จังหวะดี] เดินหน้าตามแผนได้ ผลตอบแทนสมเหตุผล",
    transitional: "ผันผวนปานกลาง ควรยืดหยุ่นตามสถานการณ์",
    falling: "ชะลอตัว ควรระมัดระวังและรักษาฐานเดิมเอาไว้",
  },
};

/** คำอธิบายดี-ร้ายเชิงลึกของวัยจรหนึ่งช่วง (deterministic, ตามตำรา)
 *  startAge < 20 → ตีความบทบาทธาตุเป็นบริบท "การเรียน" (การงาน/โชคลาภ = เรื่องการเรียน) */
function buildLuckPhaseVerdict(
  band: StrengthBand,
  role: RelationRole,
  qi: string,
  startAge = Number.POSITIVE_INFINITY,
): string {
  const inflow = startAge < SCHOOL_AGE_MAX ? ROLE_INFLOW_SCHOOL_TH[role] : ROLE_INFLOW_TH[role];
  const tier = classifyQiTier(qi);
  const manifest = QI_MANIFEST_TH[tier];
  const verdict = VERDICT_MATRIX[resolveRoleEffect(band, role)][tier];
  return `${inflow} เข้ามาในสภาวะ${manifest} (${qi || "—"}) — ${verdict}`;
}

/** ข้อมูลโครงสร้างของแต่ละเฟสวัยจร (5 ปี) — ใช้ร่วมกันทั้งตารางวัยจร/บท12/ช่วงคู่/ช่วงหุ้นส่วน */
type DaYunPhaseInfo = {
  startAge: number;
  ageRange: string;
  symbol: string;
  place: string;
  element: SupportedElementValue;
  role: RelationRole;
  qi: string;
  tier: QiTier;
};

function buildDaYunPhaseInfos(calculatedState: CalculatedStateValue): DaYunPhaseInfo[] {
  const dm = dayMasterElement(calculatedState);
  const pillars = [...calculatedState.daYun].sort((a, b) => a.startAge - b.startAge);
  const infos: DaYunPhaseInfo[] = [];
  pillars.forEach((pillar) => {
    // ใช้อายุเริ่มวัยจรจริง (起运) จาก phase.startAge/endAge ไม่ normalize เป็น 5/15/25
    const raw: Array<{ symbol: string; place: string; element: SupportedElementValue; startAge: number; ageRange: string; qi: string }> = [];
    if (pillar.upperPhase) {
      raw.push({
        symbol: pillar.upperPhase.symbol,
        place: "ราศีบน",
        element: stemElement(pillar.upperPhase.symbol),
        startAge: pillar.upperPhase.startAge,
        ageRange: `${pillar.upperPhase.startAge}-${pillar.upperPhase.endAge} ปี`,
        qi: (pillar.upperPhase.twelveQiDisplay ?? "").trim(),
      });
    }
    if (pillar.lowerPhase) {
      raw.push({
        symbol: pillar.lowerPhase.symbol,
        place: "ราศีล่าง",
        element: branchElement(pillar.lowerPhase.symbol),
        startAge: pillar.lowerPhase.startAge,
        ageRange: `${pillar.lowerPhase.startAge}-${pillar.lowerPhase.endAge} ปี`,
        qi: (pillar.lowerPhase.twelveQiDisplay ?? "").trim(),
      });
    }
    for (const phase of raw) {
      infos.push({
        ...phase,
        role: resolveRelationRole(dm, phase.element),
        tier: classifyQiTier(phase.qi),
      });
    }
  });
  return infos;
}

/** ป้าย "ปฏิกิริยา" คู่ธาตุ/ถ่ายเท/โชคลาภ/พิฆาต/ส่งเสริม (จากบทบาทธาตุวัยจรเทียบดิถี) */
const RELATION_ROLE_REACTION: Record<RelationRole, string> = {
  "คู่ธาตุ": "คู่ธาตุ",
  "ธาตุถ่ายเท": "ถ่ายเท",
  "ธาตุพิฆาต": "โชคลาภ",
  "พิฆาตธาตุ": "พิฆาต",
  "ธาตุส่งเสริม": "ส่งเสริม",
};

/** ป้าย "ปฏิกิริยา" ของช่วงวัยจรหนึ่งเทียบดิถี (จากตัวอักษรก้าน/กิ่งของช่วงนั้น) */
export function resolveDaYunReaction(
  calculatedState: CalculatedStateValue,
  symbol: string,
  source: "stem" | "branch",
): string {
  const dm = dayMasterElement(calculatedState);
  const element = source === "stem" ? stemElement(symbol) : branchElement(symbol);
  return RELATION_ROLE_REACTION[resolveRelationRole(dm, element)];
}

/** แถวตารางวัยจร (ช่วงละ 5 ปี) พร้อมคอลัมน์ "ปฏิกิริยา" — ใช้ใน doc export */
export type DaYunTableRow = {
  ageRange: string;
  symbol: string;
  place: string;
  qi: string;
  reaction: string;
};

export function buildDaYunTableRows(calculatedState: CalculatedStateValue): DaYunTableRow[] {
  return buildDaYunPhaseInfos(calculatedState).map((phase) => ({
    ageRange: phase.ageRange,
    symbol: phase.symbol,
    place: phase.place,
    qi: phase.qi,
    reaction: RELATION_ROLE_REACTION[phase.role],
  }));
}

/** ทุกเฟสวัยจร (5 ปี, normalize 5-9) → เส้นขีด + คำอธิบายดี-ร้าย */
export function buildRelationshipLinesMapping(
  calculatedState: CalculatedStateValue,
): RelationshipLineRow[] {
  const band = resolveStrengthBand(calculatedState);
  return buildDaYunPhaseInfos(calculatedState).map((phase) => ({
    ageRange: phase.ageRange,
    symbol: phase.symbol,
    relationLine: `${RELATION_ROLE_SHORT[phase.role]}${phase.qi ? ` → ${phase.qi}` : ""}`,
    deepNote: buildLuckPhaseVerdict(band, phase.role, phase.qi, phase.startAge),
  }));
}

type TimingLabels = { rising: string; falling: string; transitional: string };
type TimingOptions = {
  /** ข้ามช่วงอายุที่น้อยกว่าค่านี้ (เช่น เรื่องคู่ ไม่ดูวัยเด็ก < 20) */
  minAge?: number;
  /** ถ้อยคำสำหรับวัยเรียน (< 20 ปี) — ใช้ตีความเป็นเรื่องการเรียน/สอบแทน */
  youth?: TimingLabels;
};

function formatTimingLine(
  phase: DaYunPhaseInfo,
  labels: TimingLabels,
  opts: TimingOptions,
): string {
  const useYouth = opts.youth && phase.startAge < SCHOOL_AGE_MAX;
  const text = useYouth ? opts.youth![phase.tier] : labels[phase.tier];
  return `อายุ ${phase.ageRange} (${phase.symbol} → ${phase.qi || "—"}): ${text}`;
}

/** ช่วงอายุที่ "ธาตุเป้าหมาย" (เช่น ดาวคู่ครอง/ดาวลาภ) เข้ามาในวัยจร พร้อมคุณภาพช่วง */
function findTimingByElement(
  calculatedState: CalculatedStateValue,
  targetElement: SupportedElementValue,
  labels: TimingLabels,
  opts: TimingOptions = {},
): string[] {
  return buildDaYunPhaseInfos(calculatedState)
    .filter((phase) => phase.element === targetElement)
    .filter((phase) => opts.minAge == null || phase.startAge >= opts.minAge)
    .map((phase) => formatTimingLine(phase, labels, opts));
}

/** ช่วงอายุที่ "บทบาทธาตุเป้าหมาย" (เช่น คู่ธาตุ=หุ้นส่วน) เด่นในวัยจร */
function findTimingByRole(
  calculatedState: CalculatedStateValue,
  targetRole: RelationRole,
  labels: TimingLabels,
  opts: TimingOptions = {},
): string[] {
  return buildDaYunPhaseInfos(calculatedState)
    .filter((phase) => phase.role === targetRole)
    .filter((phase) => opts.minAge == null || phase.startAge >= opts.minAge)
    .map((phase) => formatTimingLine(phase, labels, opts));
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

/** ระดับกำลังของธาตุหนึ่งในดวง (สำหรับวิเคราะห์ดาวคู่ครอง) */
function resolveElementStrengthLabel(
  calculatedState: CalculatedStateValue,
  element: SupportedElementValue,
): "strong" | "balanced" | "weak" | "missing" {
  if (calculatedState.elementAnalysis.dominantElements.includes(element)) {
    return "strong";
  }
  if (calculatedState.elementAnalysis.missingElements.includes(element)) {
    return "missing";
  }
  return (
    calculatedState.elementAnalysis.elementStrengths.find((entry) => entry.element === element)
      ?.strength ?? "balanced"
  );
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
  const band = resolveStrengthBand(calculatedState);
  const base = map.get(`${gender}|${band}`);

  // ชั้นวิเคราะห์ดาวคู่ครอง (M.docx บท 7): ดิถีแข็ง-อ่อน × กำลังดาวคู่ครอง × จานคู่ (ราศีล่างหลักวัน)
  const dm = dayMasterElement(calculatedState);
  // ชาย: คู่ครอง = ดาวลาภ (ธาตุที่ดิถีพิฆาต); หญิง: คู่ครอง = ดาวอำนาจ (ธาตุที่พิฆาตดิถี)
  const spouse = (gender === "male"
    ? (CONTROLS[dm] as SupportedElementValue)
    : ((Object.keys(CONTROLS) as SupportedElementValue[]).find(
        (element) => CONTROLS[element] === dm,
      ) as SupportedElementValue));
  const spouseStrength = resolveElementStrengthLabel(calculatedState, spouse);
  const dmWeak = band === "weak" || band === "very-weak";
  const spouseLabel = elementLabel(spouse);

  let dynamic: string;
  if (dmWeak && spouseStrength === "strong") {
    dynamic = gender === "male"
      ? `ดิถีอ่อนแต่ดาวคู่ครอง (ธาตุ${spouseLabel}) มีกำลังมาก มักดึงดูดคู่ที่เก่ง ขยัน หรือหาเงินเก่ง แต่เพราะกำลังดิถีน้อยกว่า อาจรู้สึกถูกกดดันหรือต้องตามใจอีกฝ่าย`
      : `ดิถีอ่อนแต่ดาวคู่ครอง (ธาตุ${spouseLabel}) มีกำลังมาก มักได้คู่ที่มีอำนาจ/บทบาทสูง ต้องระวังถูกครอบงำ ควรเลือกคู่ที่ส่งเสริมไม่กดทับ`;
  } else if (!dmWeak && (spouseStrength === "weak" || spouseStrength === "missing")) {
    dynamic = `ดิถีมีกำลังแต่ดาวคู่ครอง (ธาตุ${spouseLabel}) อ่อน เรื่องคู่จึงต้องเป็นฝ่ายเลือกและรุกเอง คู่ที่เหมาะคือคนที่เสริมจุดที่ดวงขาด`;
  } else {
    dynamic = `ดาวคู่ครอง (ธาตุ${spouseLabel}) กำลัง${spouseStrength === "strong" ? "เด่น" : spouseStrength === "missing" ? "ขาด" : "ปานกลาง"} ให้ดูจังหวะวัยจรที่กระทบธาตุคู่ครองเพื่อจับช่วงเริ่ม/ปรับความสัมพันธ์`;
  }

  const dayBranch = calculatedState.fourPillars.day.branch;

  // ตารางหลักวัน (ความรัก: หลักวันเท่านั้น) — ดิถี×ราศีล่างวัน → คำทำนายคู่ครองตรงตามตำรา
  const dayPillarTable = parseLoveDayPillar();
  const dayPillarVerdict = dayPillarTable?.get(`${calculatedState.dayMaster}|${dayBranch}`);
  const dayPillarLine = dayPillarVerdict
    ? `ลักษณะคู่ครอง (ตารางหลักวัน ${calculatedState.dayMaster}${dayBranch} → ${dayPillarVerdict.qi}): ${dayPillarVerdict.spouse}${dayPillarVerdict.reaction && dayPillarVerdict.reaction !== "-" ? ` — ${dayPillarVerdict.reaction}` : ""}`
    : "";

  const seatQi = pillarBranchQi(calculatedState, "day");
  const seat = `จานคู่ (ราศีล่างหลักวัน ${dayBranch}${seatQi ? ` → ${seatQi}` : ""}): ${
    GOOD_QI.has(seatQi)
      ? "ช่วงที่คู่ส่งเสริมและความสัมพันธ์ราบรื่น"
      : BAD_QI.has(seatQi)
        ? "สัญญาณจุดเปลี่ยน/ช่วงต้องระวังเรื่องคู่"
        : "ขึ้นกับวัยจรที่เข้ามากระทบ"
  }`;

  // จำนวนตำแหน่งที่ดาวคู่ครองปรากฏ — มากตำแหน่ง = โอกาสพบคนรักหลายคน/มีตัวเลือกมาก
  const spouseCount = (["year", "month", "day", "hour"] as PillarKey[]).reduce((n, p) => {
    const v = calculatedState.fourPillars[p];
    return n + (stemElement(v.stem) === spouse ? 1 : 0) + (branchElement(v.branch) === spouse ? 1 : 0);
  }, 0);
  const abundanceLine = spouseCount >= 3
    ? `ดาวคู่ครอง (ธาตุ${spouseLabel}) ปรากฏหลายตำแหน่งในดวง (${spouseCount} จุด) — มีโอกาสพบคนรักหรือมีผู้เข้ามาชอบได้บ่อยและมีตัวเลือกมาก ${gender === "male" ? "ฝ่ายชายมักมีผู้เข้ามาหลายคน" : "มักมีผู้เข้ามาจีบหลายคน"} ควรเลือกให้รอบคอบและระวังความสัมพันธ์ซับซ้อน`
    : "";

  // ช่วงอายุที่ดาวคู่ครอง (ธาตุspouse) เข้ามาในวัยจร → จังหวะเรื่องคู่ (ก่อน 20 = รักในวัยเรียน)
  const spouseTiming = findTimingByElement(
    calculatedState,
    spouse,
    {
      rising: "ช่วงเด่นเรื่องความรัก มีโอกาสพบคู่หรือพัฒนาความสัมพันธ์ให้จริงจัง",
      transitional: "เรื่องคู่เข้ามาแต่ยังไม่นิ่ง ควรค่อย ๆ ดูใจ",
      falling: "ระวังเรื่องคู่ ความสัมพันธ์อาจสะดุดหรือมีบททดสอบ",
    },
    {
      youth: {
        rising: "วัยเรียนช่วงนี้มีเสน่ห์ มีคนเข้ามาชอบ เป็นรักในวัยเรียนที่สดใส",
        transitional: "วัยเรียนมีความรู้สึกดี ๆ เข้ามาแต่ยังไม่จริงจัง เป็นรักในวัยเรียน",
        falling: "วัยเรียนอาจมีรักที่สะดุดหรือผิดหวังเล็ก ๆ เป็นบทเรียนความรักช่วงเรียน",
      },
    },
  );
  const timingBlock = spouseTiming.length > 0
    ? `ช่วงอายุที่เด่นเรื่องคู่/ความรัก (ดาวคู่ครองธาตุ${spouseLabel} เข้าวัยจร — ก่อน 20 ปีตีเป็นรักในวัยเรียน):\n${spouseTiming.join("\n")}`
    : "";

  const spouseRelationBlock = buildSpouseRelationNotes(calculatedState);
  const spouseRelationLine = spouseRelationBlock.length > 0 ? spouseRelationBlock.join("\n") : "";

  return [base, dayPillarLine, dynamic, abundanceLine, seat, spouseRelationLine, timingBlock]
    .filter(Boolean)
    .join("\n\n");
}

/** บท 14 สี/ทิศ = สีตาม useful god + สีที่ควรเลี่ยง (officer) + สีกระเป๋า/รถ + ทิศมงคล */
function buildColorsReading(calculatedState: CalculatedStateValue): string | null {
  const section = parseSource7ElementSection("2.1", 3);
  if (!section) {
    return null;
  }
  const useful = resolveUsefulElements(calculatedState);
  const usefulWithColor = useful.filter((element) => section.has(element));

  const lines = usefulWithColor.map((element) => {
    const [color, gem, amulet] = section.get(element)!;
    return `ธาตุ${element} (useful god): สีมงคล ${color ?? "-"}; อัญมณี ${gem ?? "-"}; วัตถุมงคล ${amulet ?? "-"}`;
  });

  const usefulColors = usefulWithColor
    .map((element) => section.get(element)![0])
    .filter((color): color is string => Boolean(color));

  // สีที่ควรเลี่ยง = สีของธาตุพิฆาตดิถี (officer)
  const officerTh = elementLabel(resolveOfficerElement(dayMasterElement(calculatedState)));
  const avoidColor = section.get(officerTh)?.[0];
  const avoid = `สีที่ควรเลี่ยง: สีธาตุ${officerTh}${avoidColor ? ` (${avoidColor})` : ""} เพราะเป็นธาตุที่พิฆาตและกดดันดิถี`;

  const extras: string[] = [];
  // สีของใช้เฉพาะเจาะจง — Source7 §3.1 (กระเป๋า=ดิถี×ราศีบนเดือน), §3.2 (รถ=ดิถี×ราศีบนยาม)
  const dayStem = calculatedState.dayMaster;
  const monthStem = calculatedState.fourPillars.month.stem;
  const hourStem = calculatedState.fourPillars.hour.stem;
  const bagTable = parseSource7ColorTable("3.1");
  const carTable = parseSource7ColorTable("3.2");
  const bagColor = bagTable?.get(`${dayStem}|${monthStem}`);
  const carColor = carTable?.get(`${dayStem}|${hourStem}`);
  if (bagColor) {
    extras.push(`สีกระเป๋าสตางค์ / อุปกรณ์ทำมาหากิน (มือถือ โน้ตบุ๊ก แท็บเล็ต) — เทียบดิถี ${dayStem} กับราศีบนหลักเดือน ${monthStem}: ${bagColor}`);
  } else if (usefulColors.length > 0) {
    extras.push(`สีกระเป๋าสตางค์ / อุปกรณ์ทำมาหากิน (มือถือ โน้ตบุ๊ก แท็บเล็ต): เน้นสีธาตุ${usefulWithColor[0]} (${usefulColors[0]})`);
  }
  if (carColor) {
    extras.push(`สีรถยนต์ / ของเคลื่อนไหวได้ — เทียบดิถี ${dayStem} กับราศีบนหลักยาม ${hourStem}: ${carColor}`);
  } else {
    // fallback สีรถ: ยึด "ธาตุส่งเสริม" (印 = ธาตุที่หล่อเลี้ยงดิถี) ไม่ใช่ useful god ทุกตัว (เช่นไม่เอาคู่ธาตุ)
    const resourceTh = elementLabel(inverseGenerate(dayMasterElement(calculatedState)));
    const resourceColor = section.get(resourceTh)?.[0];
    if (resourceColor) {
      extras.push(`สีรถยนต์ / ของเคลื่อนไหวได้: เน้นสีธาตุ${resourceTh} (${resourceColor}) ตามธาตุส่งเสริมดวง`);
    } else if (usefulColors.length > 0) {
      extras.push(`สีรถยนต์: ${usefulColors.join(" / ")}`);
    }
  }
  extras.push(`ทิศมงคล: ${usefulWithColor.map((element) => ELEMENT_DIRECTION_TH[element]).join(" และ ")}`);

  const symbols = usefulWithColor
    .map((element) => ELEMENT_SYMBOL_TH[element])
    .filter((symbol): symbol is string => Boolean(symbol));
  if (symbols.length > 0) {
    extras.push(`สัญลักษณ์มงคล: ${symbols.join(", ")}`);
  }

  return [...lines, avoid, ...extras].filter(Boolean).join("\n\n");
}

// เชี่ยงแซดีตาม Source7 §5 (custom เทพ) — กว้างกว่า GOOD_QI: รวม หมอ/ทอ/เอี้ยง ด้วย
const GOOD_QI_ENHANCE = new Set(["เชี่ยงแซ", "กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง", "หมอ", "ทอ", "เอี้ยง"]);

/** สิ่งที่เทพประจำตัวอักษร "หนุน" ตามบทบาทธาตุของตัวอักษรนั้นเทียบดิถี */
const DEITY_ROLE_BENEFIT_TH: Record<RelationRole, string> = {
  "คู่ธาตุ": "หนุนเรื่องเพื่อน พี่น้อง หุ้นส่วน และคนรอบตัว",
  "ธาตุส่งเสริม": "หนุนเรื่องผู้ใหญ่อุปถัมภ์ สุขภาพ การเรียนรู้ และแรงสนับสนุน",
  "ธาตุถ่ายเท": "หนุนเรื่องการเจรจา การทำงาน และการแสดงผลงาน",
  "ธาตุพิฆาต": "หนุนเรื่องโชคลาภ การลงทุน และทรัพย์สิน",
  "พิฆาตธาตุ": "หนุนเรื่องอำนาจ ตำแหน่งหน้าที่ และการงาน",
};

/** Source7 §5: เทพเฉพาะดวง — วน 8 ตัวอักษร (ราศีบน-ล่าง 4 เสา) ที่ขึ้นเชี่ยงแซดี → เทพประจำตัวอักษรนั้น
 *  + ความหมายเพิ่มตามบทบาทธาตุ (ผู้ใหญ่/สุขภาพ/เจรจา-ทำงาน/ลงทุน/โชคลาภ) */
function buildCustomDeities(calculatedState: CalculatedStateValue): string[] {
  const tables = parseSource7CustomDeities();
  if (!tables) {
    return [];
  }
  const dmStem = calculatedState.dayMaster;
  const dmEl = dayMasterElement(calculatedState);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const pillar of ["year", "month", "day", "hour"] as PillarKey[]) {
    const { stem, branch } = calculatedState.fourPillars[pillar];
    // ราศีบน (stem): เชี่ยงแซเทียบดิถี-กับ-ราศีบน
    const stemQi = resolveDisplayStemPairStage(dmStem, stem);
    const stemDeity = tables.upper.get(stem);
    if (stemDeity && GOOD_QI_ENHANCE.has(stemQi) && !seen.has(stemDeity)) {
      seen.add(stemDeity);
      const benefit = DEITY_ROLE_BENEFIT_TH[resolveRelationRole(dmEl, stemElement(stem))];
      out.push(`ราศีบน${PILLAR_LABEL_TH[pillar]} ${stem} (${stemQi}): ${stemDeity} — ${benefit}`);
    }
    // ราศีล่าง (branch): ใช้ 12 เชี่ยงแซที่ engine คำนวณไว้ของกิ่งเสานั้น
    const branchQi = pillarBranchQi(calculatedState, pillar)
      || resolveDisplayTwelveQiStage(dmStem, branch);
    const branchDeity = tables.lower.get(branch);
    if (branchDeity && GOOD_QI_ENHANCE.has(branchQi) && !seen.has(branchDeity)) {
      seen.add(branchDeity);
      const benefit = DEITY_ROLE_BENEFIT_TH[resolveRelationRole(dmEl, branchElement(branch))];
      out.push(`ราศีล่าง${PILLAR_LABEL_TH[pillar]} ${branch} (${branchQi}): ${branchDeity} — ${benefit}`);
    }
  }
  return out;
}

/** บท 15 องค์เทพ = เทพเฉพาะดวง (8 ตัวอักษรเชี่ยงแซดี, Source7 §5) นำ + สิ่งศักดิ์สิทธิ์ตาม useful god */
function buildDeitiesReading(calculatedState: CalculatedStateValue): string | null {
  const section = parseSource7ElementSection("2.2", 2);
  if (!section) {
    return null;
  }
  const elementLines = resolveUsefulElements(calculatedState)
    .filter((element) => section.has(element))
    .map((element) => {
      const [merit, deities] = section.get(element)!;
      const benefit = ELEMENT_DEITY_BENEFIT_TH[element];
      return `ธาตุ${element} (useful god): สิ่งศักดิ์สิทธิ์ ${deities ?? "-"}${benefit ? ` (ช่วยเรื่อง: ${benefit})` : ""}; การทำบุญ ${merit ?? "-"}`;
    });
  if (elementLines.length === 0) {
    return null;
  }

  const custom = buildCustomDeities(calculatedState);
  const blocks: string[] = [];
  if (custom.length > 0) {
    blocks.push(
      `เทพคุ้มครองดวงเฉพาะดวง (เลือกจากตัวอักษรในผังที่ขึ้นเชี่ยงแซดี):\n${custom.join("\n")}`,
    );
  }
  blocks.push(`สิ่งศักดิ์สิทธิ์ตามธาตุที่ดวงต้องการ (useful god):\n${elementLines.join("\n\n")}`);
  return blocks.join("\n\n");
}

/** บท 2 อาชีพ = กรอบ (ดิถีแข็ง-อ่อน + ดาวถ่ายเท=วิธีหาเงิน) + สายงานตามธาตุที่ดวงต้องการ */
function buildCareerReading(calculatedState: CalculatedStateValue): string | null {
  const careers = parseSource7Careers();
  if (!careers) {
    return null;
  }
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue;
  const band = resolveStrengthBand(calculatedState);
  const dmWeak = band === "weak" || band === "very-weak";
  const dmStrong = band === "strong" || band === "very-strong";

  const frame = dmWeak
    ? "ด้วยกำลังดิถีที่ไม่มากนัก ดวงนี้ไม่เหมาะกับการลุยเดี่ยวแบกทุกอย่างไว้คนเดียว ควรใช้ทักษะและความถนัด (ดาวถ่ายเท) เป็นเครื่องมือหาเงิน และทำงานในระบบที่มีคนช่วยซัพพอร์ต"
    : dmStrong
      ? "ด้วยกำลังดิถีที่เข้มแข็ง ดวงนี้ลงมือทำเองได้เต็มที่ ควรเลือกงานที่ได้ระบายพลังออกมาเป็นผลงานและทรัพย์อย่างต่อเนื่อง"
      : "ด้วยสภาวะดิถีที่กึ่งแข็งกึ่งอ่อน ดวงนี้เลือกอาชีพแบบ “ควบ 2 ฐาน” คือธาตุที่หนุนทั้งกำลังดิถีและหลักเดือนไปพร้อมกัน จะมั่นคงที่สุด";
  const moneyWay = `วิธีหาเงินที่ถนัดที่สุดคือการใช้ “ดาวถ่ายเท” (ธาตุ${elementLabel(output)}) แปลงความรู้และทักษะให้กลายเป็นรายได้ มากกว่าการลงแรงกายแลกเงิน`;

  const lists = resolveUsefulElements(calculatedState)
    .map((element) => (careers.has(element) ? `อาชีพธาตุ${element} (useful god): ${careers.get(element)!}` : null))
    .filter((segment): segment is string => Boolean(segment));

  // อาชีพที่ควรเลี่ยง = ธาตุพิฆาตดิถี (officer) ซึ่งกดดัน/บั่นทอนกำลังดวง
  const officer = resolveOfficerElement(dm);
  const avoidTh = elementLabel(officer);
  const avoid = careers.has(avoidTh)
    ? `อาชีพที่ควรเลี่ยง (ธาตุ${avoidTh} = ธาตุที่พิฆาตดิถี): ${careers.get(avoidTh)!}`
    : `อาชีพที่ควรเลี่ยงคือสายงานธาตุ${avoidTh} ซึ่งเป็นธาตุที่กดดันและบั่นทอนกำลังของดวง`;

  // balanced (กึ่งแข็งกึ่งอ่อน): เตือนธาตุถ่ายเทที่ดูดกำลังดิถีให้อ่อนลง (เช่น ดิน 戊 ไม่ควรทำอาชีพธาตุทอง)
  const drainTh = band === "balanced"
    ? elementLabel(resolveBalancedDualBaseCareer(calculatedState).drain)
    : null;
  const drainAvoid = drainTh && drainTh !== avoidTh
    ? `อีกสายที่ไม่ค่อยเหมาะคืออาชีพธาตุ${drainTh} (ดาวถ่ายเท) เพราะจะดูดกำลังดิถีที่ก้ำกึ่งอยู่แล้วให้อ่อนลง ทำให้ฐานไม่แน่น`
    : null;

  // Target/Market — วิธีทายที่ซินแซกำชับ: ดู 12 เชี่ยงแซของเสาปี (ราศีบน-vs-ล่าง)
  const yearPillar = calculatedState.fourPillars.year;
  const yearQi = resolveDisplayTwelveQiStage(yearPillar.stem, yearPillar.branch);
  const marketLine = QI_MARKET_TH[yearQi]
    ? `กลุ่มลูกค้า/ตลาดเป้าหมาย (Target/Market — ดูเชี่ยงแซเสาปี ${yearPillar.stem}${yearPillar.branch} → ${yearQi}): ${QI_MARKET_TH[yearQi]}`
    : "";

  // กลุ่มลูกค้า/ตลาด จากเสาปี (เสริมตามธาตุ = สังคม/ฐานคนรอบตัว)
  const yearElement = elementLabel(branchElement(calculatedState.fourPillars.year.branch));
  const customer = `กลุ่มลูกค้าตามธาตุเสาปี (ธาตุ${yearElement}): ${YEAR_CUSTOMER_TH[yearElement]}`;

  // กลุ่มที่ "นำเงินเข้า" จากดาวลาภ (财 = ธาตุที่ดิถีพิฆาต) — ตลาดที่ยอมจ่ายให้ดวงนี้จริง
  const wealthLabel = elementLabel(CONTROLS[dm] as SupportedElementValue);
  const wealthCustomer = wealthLabel !== yearElement
    ? `กลุ่มที่นำเงินเข้าหาดวงนี้ได้ดี (ดูจากดาวลาภ ธาตุ${wealthLabel}): ${YEAR_CUSTOMER_TH[wealthLabel]}`
    : "";

  // ช่องทางสื่อสาร/การตลาด จากดาวถ่ายเท (食傷 = วิธีที่ดวงแสดงออก)
  const outputChannel = `ช่องทางที่ดวงนี้สื่อสารและทำการตลาดได้เป็นธรรมชาติ (ดาวถ่ายเท ธาตุ${elementLabel(output)}): ${OUTPUT_CHANNEL_TH[elementLabel(output)]}`;

  return [frame, moneyWay, ...lists, avoid, drainAvoid, marketLine, customer, wealthCustomer, outputChannel]
    .filter(Boolean)
    .join("\n\n");
}

function buildPartnershipReading(calculatedState: CalculatedStateValue): string | null {
  const map = parseCareerBusinessByBand();
  if (!map) {
    return null;
  }
  const band = resolveStrengthBand(calculatedState);
  const verdict = map.get(band);
  if (!verdict) {
    return null;
  }
  const dmWeak = band === "weak" || band === "very-weak";

  // ราศีล่างวัน × 12 เชี่ยงแซ → "ควรมีหุ้นส่วนหรือไม่" (วิธีเดียวกับบท8: ดีมีได้ เสียมีไม่ได้)
  const dayBranch = calculatedState.fourPillars.day.branch;
  const dayQi = pillarBranchQi(calculatedState, "day");
  const seatVerdict = GOOD_QI_ENHANCE.has(dayQi)
    ? `ราศีล่างหลักวัน ${dayBranch} (${dayQi}) ขึ้นเชี่ยงแซดี → มีหุ้นส่วน/ผู้ร่วมงานได้ และมักได้คนที่ส่งเสริมกัน`
    : FOE_QI.has(dayQi)
      ? `ราศีล่างหลักวัน ${dayBranch} (${dayQi}) ขึ้นเชี่ยงแซเสีย → ควรระวังการมีหุ้นส่วน เสี่ยงขัดแย้งหรือถูกทิ้งภาระ ทำเองหรือจ้างเป็นงาน ๆ จะปลอดภัยกว่า`
      : `ราศีล่างหลักวัน ${dayBranch}${dayQi ? ` (${dayQi})` : ""} อยู่ระดับกลาง → มีหุ้นส่วนได้แต่ต้องเลือกและตกลงบทบาทให้ชัด`;

  const stance = dmWeak
    ? "ด้วยกำลังดิถีที่ไม่มากนัก การมีหุ้นส่วนที่ไว้ใจได้จะช่วยแบ่งเบาภาระและเติมกำลังในส่วนที่ขาด ทำให้ธุรกิจเดินได้ไกลกว่าการลุยลำพัง โดยเฉพาะคนที่เป็นผู้ใหญ่กว่าหรือเป็นพี่เลี้ยงคอยชี้แนะ"
    : "ด้วยกำลังดิถีที่เข้มแข็ง คุณรันงานเองได้คล่อง การมีหุ้นส่วนควรเลือกเฉพาะคนที่เติมส่วนที่ขาดจริง ๆ ไม่จำเป็นต้องมีก็ได้";
  const useful = resolveUsefulElements(calculatedState);
  const partner = useful.length > 0
    ? `หุ้นส่วนที่เข้ากันได้ดีคือคนที่มีคุณสมบัติแบบธาตุ${useful.join("หรือ")} ซึ่งช่วยเสริมจุดที่ดวงต้องการ`
    : "";
  // ช่วงอายุที่คู่ธาตุ (เพื่อน/หุ้นส่วน/คนร่วมงาน) เด่นในวัยจร
  const partnerTiming = findTimingByRole(calculatedState, "คู่ธาตุ", {
    rising: "ช่วงเด่นเรื่องหุ้นส่วน/ร่วมงาน มีโอกาสได้พันธมิตรดีและเงินก้อนจากการร่วมมือ",
    transitional: "มีคนเข้ามาร่วมงานแต่ยังไม่นิ่ง ควรตกลงบทบาทให้ชัด",
    falling: "ระวังเรื่องหุ้นส่วน อาจมีความขัดแย้งหรือถูกทิ้งภาระ",
  });
  const timingBlock = partnerTiming.length > 0
    ? `ช่วงอายุที่เด่นเรื่องหุ้นส่วน/ผู้ร่วมงาน (คู่ธาตุเข้าวัยจร):\n${partnerTiming.join("\n")}`
    : "";
  // ดิถีอ่อน: หุ้นส่วนที่ดีคือผู้ใหญ่มีทุน/บารมี (ดาวส่งเสริม 印) — เพิ่มช่วงดาวส่งเสริมเข้าวัยจร
  const backerTiming = dmWeak
    ? findTimingByRole(calculatedState, "ธาตุส่งเสริม", {
        rising: "ช่วงได้ผู้ใหญ่/นายทุนหนุน เหมาะหาหุ้นส่วนที่มีบารมีและทุนหนามาร่วม",
        transitional: "มีผู้ใหญ่เข้ามาช่วยแต่ยังไม่แน่นอน ควรประคองความสัมพันธ์",
        falling: "ตัวช่วยจากผู้ใหญ่แผ่วลง ควรพึ่งตัวเองและรอบคอบเรื่องการร่วมทุน",
      })
    : [];
  const backerBlock = backerTiming.length > 0
    ? `ช่วงอายุที่มีผู้ใหญ่/นายทุนหนุนเรื่องหุ้นส่วน (ดาวส่งเสริมเข้าวัยจร):\n${backerTiming.join("\n")}`
    : "";
  // ช่วงดาวลาภ (财) เข้าวัยจร = จังหวะได้ทุน/เงินก้อนจากการร่วมลงทุน (ตำรา: หุ้นส่วนเงินก้อนดูที่ดาวลาภรุ่ง ไม่ใช่แค่คู่ธาตุ)
  const wealthElement = CONTROLS[dayMasterElement(calculatedState)] as SupportedElementValue;
  const capitalTiming = findTimingByElement(calculatedState, wealthElement, {
    rising: "จังหวะได้เงินทุน/เงินก้อนจากการร่วมลงทุนหรือดึงพันธมิตรที่มีทุน",
    transitional: "มีดีลร่วมทุนเข้ามาแต่ยังไม่นิ่ง ควรตรวจเงื่อนไขให้รอบคอบก่อนลงนาม",
    falling: "ระวังการร่วมทุน/เงินก้อน อาจไม่คืนทุนตามคาด ควรชะลอ",
  }, { minAge: SCHOOL_AGE_MAX });
  const capitalBlock = capitalTiming.length > 0
    ? `ช่วงอายุที่เด่นเรื่องทุน/เงินก้อนจากการร่วมมือ (ดาวลาภเข้าวัยจร):\n${capitalTiming.join("\n")}`
    : "";
  const sanheNote = buildPartnershipSanheNote(calculatedState);
  return [seatVerdict, stance, `แนวทางทำธุรกิจ/หุ้นส่วน: ${verdict}`, partner, sanheNote, timingBlock, backerBlock, capitalBlock].filter(Boolean).join("\n\n");
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
// หมายเหตุ: หมกยก (沐浴) ไม่นับเป็นเชี่ยงแซดี — ตำราถือว่าเป็นสภาวะผันผวน/ไม่นิ่ง (จัดเป็นกลาง)
const GOOD_QI = new Set(["เชี่ยงแซ", "กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง"]);
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

/** ดาวอำนาจ (officer = ธาตุที่พิฆาตดิถี) — ใช้เป็น "ธาตุต้องห้าม" ในบทอาชีพ/สี */
function resolveOfficerElement(dm: SupportedElementValue): SupportedElementValue {
  return (Object.keys(CONTROLS) as SupportedElementValue[]).find(
    (element) => CONTROLS[element] === dm,
  ) as SupportedElementValue;
}

/** กลุ่มลูกค้า/ตลาด ตามธาตุของเสาปี (เสาปี = Target Market ตามตำรา) */
const YEAR_CUSTOMER_TH: Record<ThaiElement, string> = {
  "ไม้": "คนรักการเรียนรู้ สายการศึกษา สื่อ สิ่งพิมพ์ งานสร้างสรรค์ และคนที่ใส่ใจสิ่งแวดล้อม",
  "ไฟ": "คนมีชื่อเสียง สายความงาม บันเทิง การตลาด และกลุ่มที่ตัดสินใจซื้อด้วยอารมณ์",
  "ดิน": "คนมั่นคง สายอสังหาฯ เกษตร ราชการท้องถิ่น และครอบครัวที่เน้นความยั่งยืน",
  "ทอง": "คนมีระเบียบและอำนาจ ข้าราชการ บุคคลในเครื่องแบบ สายการเงิน เทคโนโลยี และผู้มีตำแหน่ง",
  "น้ำ": "คนเคลื่อนไหวตลอด สายค้าขาย บริการ ท่องเที่ยว ขนส่ง และลูกค้าออนไลน์",
};

/** ช่องทางสื่อสาร/การตลาดตามธาตุของดาวถ่ายเท (食傷 = วิธีที่ดวงแสดงออก) */
const OUTPUT_CHANNEL_TH: Record<ThaiElement, string> = {
  "ไม้": "งานเขียน คอนเทนต์ความรู้ คอร์ส/สัมมนา และสื่อสิ่งพิมพ์ที่ให้สาระ",
  "ไฟ": "วิดีโอ ไลฟ์ ภาพลักษณ์ การพูดบนเวที และการตลาดที่กระตุ้นอารมณ์/แรงบันดาลใจ",
  "ดิน": "การบอกต่อแบบปากต่อปาก ความน่าเชื่อถือ ของจริงจับต้องได้ และฐานลูกค้าประจำที่ดูแลระยะยาว",
  "ทอง": "ระบบ แบรนด์ที่คมชัด ข้อมูล/ตัวเลขชัดเจน และช่องทางที่ดูพรีเมียมมีมาตรฐาน",
  "น้ำ": "โซเชียลมีเดีย การสื่อสารแบบลื่นไหล เครือข่าย และช่องทางออนไลน์ที่กระจายตัวเร็ว",
};

/** Target/Market ตาม 12 เชี่ยงแซของเสาปี (ราศีบน-vs-ล่าง) — ตามวิธีทายที่ซินแซกำชับ
 * เช่น แป่ = ลูกค้าทางไกล/ออนไลน์ + สุขภาพ + ของทันสมัย */
const QI_MARKET_TH: Record<string, string> = {
  "เชี่ยงแซ": "ลูกค้ากลุ่มใหม่ ตลาดเกิดใหม่ที่ขยายฐานเพิ่มได้เรื่อย ๆ (upscale ได้ต่อเนื่อง)",
  "หมกยก": "ลูกค้าสายไลฟ์สไตล์ ความงาม บริการที่ต้องคอยดูแลปรับจูน กลุ่มที่เปลี่ยนรสนิยมบ่อย",
  "กวงตั่ว": "ลูกค้าที่ซื้อด้วยภาพลักษณ์/แบรนด์/ความน่าเชื่อถือ กลุ่มที่ใส่ใจสถานะ",
  "ลิ่มกัว": "ลูกค้าองค์กร ราชการ ผู้มีตำแหน่ง และกลุ่มที่ต้องการมาตรฐาน/สัญญาเป็นทางการ",
  "ตี้อ๋วง": "ตลาดใหญ่ กำลังซื้อสูง ขยายสเกลได้มาก เหมาะลุยตลาดหลัก/ลูกค้ารายใหญ่",
  "ซวย": "ลูกค้ากลุ่มที่ต้องประคองดูแลต่อเนื่อง ตลาดเริ่มอิ่มตัว เน้นรักษาฐานเดิม",
  "แป่": "ลูกค้าทางไกล/ออนไลน์/ต่างถิ่น รวมถึงกลุ่มสุขภาพ-คนป่วย และสินค้าทันสมัย/เทคโนโลยี/แฟชั่น",
  "ซี่": "ลูกค้ากลุ่มเฉพาะ (นิช) ตลาดนิ่ง เน้นสินค้าจำเป็นหรือของที่ขาดไม่ได้",
  "หมอ": "ลูกค้ากลุ่มสะสม คลังสินค้า ของเก่า อสังหาฯ และธุรกิจที่เก็บกักมูลค่าไว้ยาว ๆ",
  "เจ๊าะ": "ลูกค้าเปลี่ยนหน้าบ่อย ตลาดผันผวน ต้องหากลุ่มใหม่และปรับตัวเสมอ",
  "ทอ": "ลูกค้ากลุ่มเริ่มต้น/บ่มเพาะ ธุรกิจค่อย ๆ โตจากเล็กไปใหญ่ เก็บทีละนิด",
  "เอี้ยง": "ลูกค้ากลุ่มที่ต้องบำรุงดูแลระยะยาว เช่น สมาชิก ซับสคริปชัน หรือบริการต่อเนื่อง",
};

/** ลักษณะลาภผลตาม 12 เชี่ยงแซของตำแหน่งที่ดาวลาภปรากฏ — โชคลาภหลายทาง อ่านตามแต่ละตำแหน่ง */
const QI_WEALTH_TH: Record<string, string> = {
  "เชี่ยงแซ": "โชคลาภสายใหม่ที่ค่อย ๆ โตและต่อยอดเพิ่มได้เรื่อย ๆ",
  "หมกยก": "เงินที่มาจากบริการ/เสน่ห์ แต่ไม่นิ่ง ต้องคอยปรับจูนและดูแล",
  "กวงตั่ว": "ลาภจากภาพลักษณ์ ชื่อเสียง และความน่าเชื่อถือที่สั่งสมไว้",
  "ลิ่มกัว": "ลาภจากตำแหน่ง อำนาจหน้าที่ หรือดีลที่เป็นทางการ",
  "ตี้อ๋วง": "ลาภก้อนใหญ่ในจังหวะรุ่ง กำลังซื้อสูง ขยายได้มาก",
  "ซวย": "ลาภที่เริ่มแผ่ว ต้องประคอง ระวังรายจ่ายกัดกร่อน",
  "แป่": "ลาภจากทางไกล/ออนไลน์ หรือจากการแก้ปัญหา/ดูแลคนป่วย มักมาแบบเงินหมุน",
  "ซี่": "ลาภเฉพาะทาง ตลาดนิ่ง ต้องเจาะกลุ่มที่จำเป็นจริง",
  "หมอ": "ลาภแบบสะสม เก็บกักเป็นคลัง/ทรัพย์สินเก่า ค่อย ๆ เพิ่มมูลค่า",
  "เจ๊าะ": "ลาภผันผวน ได้มาเสียไป ต้องหาแหล่งใหม่อยู่เสมอ",
  "ทอ": "ลาภเริ่มต้นเล็ก ๆ ค่อยสะสมจากน้อยไปมาก (เก็บเล็กผสมน้อย)",
  "เอี้ยง": "ลาภจากการบำรุงดูแลระยะยาว รายได้ต่อเนื่องแบบสมาชิก/ซับสคริปชัน",
};

/** ทิศมงคลตามธาตุ (useful god → ทิศ) */
const ELEMENT_DIRECTION_TH: Record<ThaiElement, string> = {
  "ไม้": "ทิศตะวันออก",
  "ไฟ": "ทิศใต้",
  "ดิน": "ทิศตะวันตกเฉียงใต้และตะวันออกเฉียงเหนือ",
  "ทอง": "ทิศตะวันตก",
  "น้ำ": "ทิศเหนือ",
};

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
        // ดาวอำนาจ (官杀) อ่านเป็น "ตำแหน่ง/สายงาน" ที่หนุนดวง (เหมาะแนวมนุษย์เงินเดือน) ไม่ใช่อำนาจดิบ
        const role =
          element === resource
            ? "ดาวส่งเสริม (ผู้ใหญ่/ความรู้หนุนหลัง)"
            : "ดาวอำนาจ-ตำแหน่ง (โอกาสจากสายงาน/ตำแหน่งหน้าที่ เหมาะแนวมนุษย์เงินเดือนหรือทำงานในระบบ)";
        hits.push(`${PILLAR_LABEL_TH[pillar]} ${symbol} ธาตุ${elementLabel(element)} = ${role} → ${PILLAR_CONTEXT_MAP[pillar].traditionalPerson}`);
      }
    }
  }

  // แนวทางเรียกผู้อุปถัมภ์ = สร้างบารมีด้วย "คุณธรรมประจำธาตุส่งเสริม" (印 = สิ่งที่หล่อเลี้ยงดิถี)
  const cultivate = `แนวทางสร้างผู้อุปถัมภ์: สั่งสมบารมีด้วยคุณธรรมประจำธาตุส่งเสริม (ธาตุ${elementLabel(resource)}) — ${RESOURCE_VIRTUE_TH[elementLabel(resource)]} ยิ่งบ่มเพาะสิ่งเหล่านี้ ดาวส่งเสริมยิ่งแข็ง ผู้ใหญ่และโอกาสจะเข้ามาเองตามจังหวะ`;

  const lead = `ผู้อุปถัมภ์ดูจากดาวส่งเสริม (ธาตุ${elementLabel(resource)}) และดาวอำนาจ-ตำแหน่ง (ธาตุ${elementLabel(power)}) โดยเฉพาะที่เสาปี/เดือน ซึ่งแทนผู้ใหญ่และปู่ย่าตระกูล`;
  if (hits.length === 0) {
    return `${lead}\n\nบนชั้นหลักไม่พบดาวส่งเสริม/อำนาจที่เสาปี-เดือนชัดเจน จึงมักต้องอาศัยความพยายามของตนเองเป็นหลัก ผู้อุปถัมภ์จะมาเป็นจังหวะตามวัยจรที่ธาตุส่งเสริมเข้ามา\n\n${cultivate}`;
  }
  return `${lead}\n\n${hits.join("\n")}\n\n${cultivate}`;
}

/** คุณธรรมประจำธาตุ (五常) ที่ใช้บ่มเพาะดาวส่งเสริม (印) เพื่อเรียกบารมี/ผู้อุปถัมภ์ */
const RESOURCE_VIRTUE_TH: Record<ThaiElement, string> = {
  "ไม้": "เมตตากรุณา (仁) ช่วยเหลือเกื้อกูล ใจกว้าง และใฝ่เรียนรู้พัฒนาตน",
  "ไฟ": "มีมารยาทสัมมาคารวะ (礼) อ่อนน้อมต่อผู้ใหญ่ ให้ความรู้/สั่งสอน ปฏิบัติธรรม และนั่งสมาธิ",
  "ดิน": "ซื่อสัตย์รักษาคำพูด (信) หนักแน่นน่าเชื่อถือ และกตัญญูต่อผู้มีพระคุณ",
  "ทอง": "เที่ยงธรรมมีหลักการ (义) รับผิดชอบ มีวินัย และยึดความถูกต้องเป็นที่ตั้ง",
  "น้ำ": "ใฝ่ปัญญา (智) หมั่นศึกษาหาความรู้ ยืดหยุ่น และมองการณ์ไกล",
};

/** ความหมายของครอบครัว/ผู้ใหญ่ในบ้านตาม 12 เซียงแซ (self-seat ของเสา) — มีคำแปล ไม่ใช่แค่ชื่อสภาวะ */
const QI_FAMILY_TH: Record<string, string> = {
  "เชี่ยงแซ": "ครอบครัวที่ค่อย ๆ เติบโตและส่งต่อสิ่งดีให้รุ่นต่อไป บรรยากาศหนุนการเรียนรู้และพัฒนา",
  "หมกยก": "ครอบครัวมีรสนิยม รักสวยรักงาม แต่บรรยากาศและอารมณ์ในบ้านแปรปรวนได้ง่าย",
  "กวงตั่ว": "ครอบครัวมีหน้ามีตา ใส่ใจภาพลักษณ์และเกียรติของวงศ์ตระกูล",
  "ลิ่มกัว": "ครอบครัวมีระเบียบวินัย ยึดหน้าที่การงาน/ตำแหน่งเป็นหลักของบ้าน",
  "ตี้อ๋วง": "ผู้ใหญ่ในบ้านมีพลังและบารมีสูง มีอำนาจและใช้อารมณ์-ความเด็ดขาดนำบ้าน (หรือพ่อแม่พัฒนาตัวจนรุ่งเรืองถึงจุดสูงสุด)",
  "ซวย": "ผู้ใหญ่ในบ้านเริ่มผ่อนแรง ต้องการการดูแลและประคองมากขึ้น",
  "แป่": "บ้านมีภาระดูแลสุขภาพผู้ใหญ่ ต้องเอาใจใส่เรื่องกายและใจของคนในครอบครัว",
  "ซี่": "ครอบครัวเงียบสงบ ต่างคนต่างพื้นที่ ผูกพันแบบไม่แสดงออกตรง ๆ",
  "หมอ": "ครอบครัวสะสมทรัพย์/มรดกเก็บไว้ส่งต่อ เน้นความมั่นคงและการสืบทอดระยะยาว",
  "เจ๊าะ": "ความสัมพันธ์ในบ้านมีจังหวะห่าง-ขาด ต้องหมั่นประคองความเชื่อมโยงไว้",
  "ทอ": "ครอบครัวอยู่ช่วงตั้งต้น/เปลี่ยนผ่าน มีสมาชิกใหม่หรือการเริ่มต้นรอบใหม่",
  "เอี้ยง": "ครอบครัวเน้นการบ่มเพาะดูแลกันต่อเนื่อง อบอุ่นแบบค่อยเป็นค่อยไป",
};

/** บท 6 ครอบครัว = เสาเดือน (พ่อแม่) + เสาปี (ปู่ย่า) อ่านตาม 12 เซียงแซ พร้อมคำแปล (พ่อ=ราศีบน แม่=ราศีล่าง) */
function buildFamilyReading(calculatedState: CalculatedStateValue): string | null {
  const month = calculatedState.fourPillars.month;
  const year = calculatedState.fourPillars.year;
  const monthQi = resolveDisplayTwelveQiStage(month.stem, month.branch); // self-seat ของเสาพ่อแม่
  const yearQi = resolveDisplayTwelveQiStage(year.stem, year.branch); // self-seat ของเสาปู่ย่าตายาย

  const segments = [
    `ครอบครัวอ่านจากเสาเดือนเป็นหลัก (พ่อแม่) และเสาปี (ปู่ย่าตายาย/วงศ์ตระกูล)`,
    // ภาพรวมพ่อแม่จาก self-seat เสาเดือน
    `เสาเดือน ${month.stem}${month.branch} (${monthQi}): ${QI_FAMILY_TH[monthQi] ?? "บรรยากาศพ่อแม่/ครอบครัวตามจังหวะของเสานี้"}`,
    // พ่อ = ราศีบนหลักเดือน (ก้าน = บทบาทที่แสดงออก/นำ); แม่ = ราศีล่างหลักเดือน (กิ่ง = ฐานหลักภายในบ้าน)
    `พ่อ (ราศีบนหลักเดือน ${month.stem} ธาตุ${elementLabel(stemElement(month.stem))}): เป็นบทบาทที่แสดงออกและขับเคลื่อนบ้าน มักขยันและเป็นผู้นำทิศทางของครอบครัว`,
    `แม่ (ราศีล่างหลักเดือน ${month.branch} ธาตุ${elementLabel(branchElement(month.branch))}): เป็นฐานหลักภายในบ้าน มักมีอำนาจในการดูแลและตัดสินเรื่องในครอบครัว`,
    // ปู่ย่าตายาย/รากเหง้าจาก self-seat เสาปี
    `เสาปี ${year.stem}${year.branch} (${yearQi}): ${QI_FAMILY_TH[yearQi] ?? "รากเหง้าวงศ์ตระกูลที่ส่งต่อมา"} — สะท้อนพื้นฐานและสิ่งที่บรรพบุรุษส่งต่อให้`,
  ];
  const familyChong = buildFamilyChongNote(calculatedState);
  if (familyChong) {
    segments.push(familyChong);
  }
  return segments.join("\n\n");
}

/** บท 8 เพื่อน/ศัตรู = คู่ธาตุ (same) + 12 เชี่ยงแซ ดี→เพื่อน เสีย→ศัตรู */
// ตำแหน่งเสา → กลุ่มคนที่เกี่ยวข้องในบท "เพื่อน/ศัตรู" (ใช้ตำแหน่งทาย ตามวิธีซินแซ)
const FRIEND_POSITION_TH: Record<PillarKey, string> = {
  year: "คนในสังคม/เพื่อนร่วมรุ่น/วงกว้างภายนอก",
  month: "พี่น้อง เพื่อนร่วมงาน และคนแวดล้อมการงาน",
  day: "คู่ครองและคนใกล้ชิดที่สุด",
  hour: "ลูกน้อง รุ่นน้อง และบริวาร",
};

// 12 เชี่ยงแซเสีย (ศัตรู) และ 50/50 (ต้องประคอง) ตาม Source/ซินแซ
const FOE_QI = new Set(["ซวย", "ซี่", "เจ๊าะ"]);
const MIXED_QI = new Set(["หมกยก", "แป่"]);

/** อ่าน 7 ตัวอักษรที่เหลือ (ยกเว้นดิถี) ตาม 12 เชี่ยงแซ → มิตร/ศัตรู/ต้องประคอง ตามความหมายของเสา */
function scanPositionRelations(
  calculatedState: CalculatedStateValue,
): Array<{ pillar: PillarKey; char: string; element: string; qi: string; kind: "friend" | "foe" | "manage" }> {
  const dmStem = calculatedState.dayMaster;
  const out: Array<{ pillar: PillarKey; char: string; element: string; qi: string; kind: "friend" | "foe" | "manage" }> = [];
  const positions: Array<{ pillar: PillarKey; layer: "stem" | "branch" }> = [
    { pillar: "year", layer: "stem" },
    { pillar: "year", layer: "branch" },
    { pillar: "month", layer: "stem" },
    { pillar: "month", layer: "branch" },
    { pillar: "day", layer: "branch" }, // ราศีล่างวัน (ข้ามราศีบนวัน = ดิถีเอง)
    { pillar: "hour", layer: "stem" },
    { pillar: "hour", layer: "branch" },
  ];
  for (const { pillar, layer } of positions) {
    const value = calculatedState.fourPillars[pillar];
    const char = layer === "stem" ? value.stem : value.branch;
    const element = elementLabel(layer === "stem" ? stemElement(char) : branchElement(char));
    const qi = layer === "branch"
      ? pillarBranchQi(calculatedState, pillar)
      : resolveDisplayStemPairStage(dmStem, char);
    if (!qi) {
      continue;
    }
    const kind = GOOD_QI_ENHANCE.has(qi) ? "friend" : FOE_QI.has(qi) ? "foe" : MIXED_QI.has(qi) ? "manage" : null;
    if (kind) {
      out.push({ pillar, char, element, qi, kind });
    }
  }
  return out;
}

function buildFriendsReading(calculatedState: CalculatedStateValue): string | null {
  const lead =
    "เพื่อน/ศัตรูดูจาก “ตัวอักษรในผัง” ที่ขึ้น 12 เชี่ยงแซ — ตำแหน่งที่ขึ้นเชี่ยงแซดีคือมิตรแท้/ผู้สนับสนุน ส่วนตำแหน่งที่เชี่ยงแซเสีย (ซวย/ซี่/เจ๊าะ) คือคู่แข่ง/ศัตรู และทายตามความหมายของเสานั้น";
  const scan = scanPositionRelations(calculatedState);
  const lines = scan.map(({ pillar, char, element, qi, kind }) => {
    const who = FRIEND_POSITION_TH[pillar];
    const verdict = kind === "friend"
      ? `มิตรแท้/ผู้สนับสนุน — ${who} (ธาตุ${element}) เข้ามาหนุน`
      : kind === "foe"
        ? `ระวังเป็นคู่แข่ง/ศัตรู — แรงเสียดทานจาก${who} (ธาตุ${element})`
        : `${who} (ธาตุ${element}) แบบที่ต้องคอยประคองและเคลียร์ปัญหา (ดี-ร้ายปนกัน)`;
    return `${PILLAR_LABEL_TH[pillar]} ${char} (${qi}) = ${verdict}`;
  });
  if (lines.length === 0) {
    return `${lead}\n\nผังหลักไม่มีตำแหน่งเด่นด้านมิตร/ศัตรูชัดเจน เพื่อนและคู่แข่งจึงเข้ามาเป็นช่วงตามวัยจร`;
  }
  return `${lead}\n\n${lines.join("\n")}`;
}

/** บท 10 ลูกน้อง/บริวาร = เสายาม (ฐานบริวาร) + ดาวถ่ายเท (output) อ่านตาม 12 เชี่ยงแซ ดีคือดี เสียคือเสีย */
function buildSubordinateReading(calculatedState: CalculatedStateValue): string | null {
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue;
  const hour = calculatedState.fourPillars.hour;
  const qi = pillarBranchQi(calculatedState, "hour");

  // (1) ฐานบริวารหลัก = เสายาม
  const hourVerdict = GOOD_QI_ENHANCE.has(qi)
    ? "เชี่ยงแซดีที่เสายาม: บริวาร/ทีมงานมีคุณภาพ ช่วยแปลงงานเป็นผลลัพธ์ได้ดี"
    : FOE_QI.has(qi)
      ? "เชี่ยงแซเสียที่เสายาม: ต้องดูแลบริวารใกล้ชิด อาจมีปัญหาคนในทีมหรือภาระจุกจิก"
      : MIXED_QI.has(qi)
        ? "เชี่ยงแซ50/50 ที่เสายาม: บริวารแบบที่ต้องคอยขัดเกลาและประคอง เหนื่อยกับการดูแลคน (เหมือนน้ำขุ่นที่ต้องกรองก่อนใช้)"
        : "บริวารทำงานได้ตามจังหวะ ควรมอบหมายงานที่ตรงทักษะ";

  // (2) ดาวถ่ายเท (output) ตามตำแหน่ง = ลูกน้อง/ผลงาน อ่านตาม 12 เชี่ยงแซ (ไม่รวมเสาวัน = ตัวเอง/คู่)
  const outputLines: string[] = [];
  for (const pillar of ["year", "month", "hour"] as PillarKey[]) {
    const value = calculatedState.fourPillars[pillar];
    if (branchElement(value.branch) !== output && stemElement(value.stem) !== output) {
      continue;
    }
    const oqi = pillarBranchQi(calculatedState, pillar);
    const tone = GOOD_QI_ENHANCE.has(oqi)
      ? "ลูกน้อง/ผลงานช่วงนี้เดินได้ดี ส่งต่อเป็นผลลัพธ์ได้"
      : FOE_QI.has(oqi)
        ? "ลูกน้อง/ผลงานติดขัด ต้องคุมใกล้ชิด"
        : "ลูกน้อง/ผลงานต้องคอยประคองและขัดเกลา";
    outputLines.push(`${PILLAR_LABEL_TH[pillar]} (ดาวถ่ายเทธาตุ${elementLabel(output)}${oqi ? `, ${oqi}` : ""}) = ${tone}`);
  }

  return [
    `ลูกน้อง/บริวารดูจากเสายาม (${PILLAR_CONTEXT_MAP.hour.businessPerson}) ร่วมกับดาวถ่ายเท (ธาตุ${elementLabel(output)}) อ่านตาม 12 เชี่ยงแซ ดีคือดี เสียคือเสีย`,
    // บรรทัดฐานเป็นกลาง (ไม่ตัดสินดี/ร้ายเอง) — คุณภาพอ่านจากเซียงแซในบรรทัดถัดไป กันขัดแย้งเมื่อเซียงแซไม่ดี
    `เสายาม ${hour.stem}${hour.branch} ธาตุ${elementLabel(stemElement(hour.stem))}${qi ? ` (เซียงแซ ${qi})` : ""} = ฐานของลูกน้อง/บริวารและผลงาน — คุณภาพอ่านจากเซียงแซดังนี้:`,
    hourVerdict,
    ...outputLines,
  ].join("\n\n");
}

/** คณะ/สาขา/คอสตามธาตุ (สรุปจาก "อาชีพของธาตุต่างเทียบการเรียนคณะ สาขา คอสเรียน") — แนะนำสายเรียนจริง */
const FACULTY_BY_ELEMENT_TH: Record<ThaiElement, string> = {
  "ดิน": "วิศวกรรมโยธา/สำรวจ, สถาปัตยกรรม/ภูมิสถาปัตย์, ธุรกิจอสังหาริมทรัพย์, วัสดุศาสตร์/ธรณีวิทยา/วิศวกรรมเหมืองแร่-เซรามิก, สัตวแพทย์/สัตวศาสตร์-ปฐพีวิทยา-เกษตร, ทันตแพทย์/ออร์โธปิดิกส์ (ฟัน-กระดูก-ผิวหนัง); ปวช.ช่างก่อสร้าง-โยธา; คอสอสังหาฯ/ประเมินราคา/เครื่องหนัง",
  "ทอง": "วิศวกรรมโลหการ/เครื่องกล/ยานยนต์/อุตสาหการ/ไฟฟ้า-อิเล็กทรอนิกส์, วิทยาการคอมพิวเตอร์, อัญมณีวิทยา/ออกแบบเครื่องประดับ, นิติศาสตร์-รัฐศาสตร์, รร.นายร้อย/นายเรือ/ตำรวจ, การเงิน; ปวช.ช่างยนต์-กลโรงงาน-เชื่อมโลหะ; คอส CNC/ซ่อมอิเล็กทรอนิกส์",
  "น้ำ": "พาณิชยศาสตร์-บัญชี/บริหารธุรกิจ/เศรษฐศาสตร์, โลจิสติกส์-ซัพพลายเชน, การท่องเที่ยว-โรงแรม, นิเทศศาสตร์(การตลาด/ออนไลน์), วิทยาศาสตร์ทางทะเล/ประมง; สายค้าขาย-บริการ-ขนส่ง-ลูกค้าออนไลน์",
  "ไม้": "ครุศาสตร์/ศึกษาศาสตร์(พัฒนาหลักสูตร/สื่อ), อักษรศาสตร์-ศิลปศาสตร์-มนุษยศาสตร์(ภาษา/นักเขียน/นักแปล), นิเทศ-วารสารศาสตร์(การพิมพ์), เกษตร-วนศาสตร์, แพทย์แผนไทย/เภสัช(สมุนไพร), สังคมสงเคราะห์ศาสตร์, ออกแบบ/สถาปัตย์งานไม้",
  "ไฟ": "แพทย์/พยาบาล/เภสัชศาสตร์, วิทยาศาสตร์เครื่องสำอาง, ทัศนมาตรศาสตร์(สายตา/แว่น), ครุศาสตร์(ครู/ติวเตอร์/นักวิชาการ), นิเทศ-ศิลปกรรม(สื่อ/ภาพ/ดีไซน์), วิศวกรรมไฟฟ้า/พลังงาน, โหราศาสตร์-ที่ปรึกษา-นักวางกลยุทธ์",
};

/** บท 11 การเรียน = ดาวถ่ายเท (output) อ่านตาม 12 เซียงแซ (ดี=เรียนได้ใช้) + แนะนำคณะ/วิชาตามธาตุ useful */
function buildEducationReading(calculatedState: CalculatedStateValue): string | null {
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue;
  const outputLabel = elementLabel(output);
  const useful = resolveUsefulElements(calculatedState);

  const segments: string[] = [
    `การเรียนอ่านจาก "ดาวถ่ายเท" (ธาตุ${outputLabel}) = การนำสมอง/ทักษะออกมาใช้ ยิ่ง 12 เซียงแซดี ยิ่งเรียนตรงสายแล้วได้ใช้หาเงินจริง ถ้าเซียงแซไม่ดี มักเรียนแล้วไม่ได้ใช้สายตรง ต้องไปหาเงินตามแนวของเซียงแซนั้นแทน`,
  ];

  // อ่านเซียงแซของดาวถ่ายเทตามตำแหน่ง (self-seat) → เรียนแล้วได้ใช้/ไม่ได้ใช้
  const outLines: string[] = [];
  for (const pillar of ["year", "month", "day", "hour"] as PillarKey[]) {
    const value = calculatedState.fourPillars[pillar];
    if (stemElement(value.stem) !== output && branchElement(value.branch) !== output) {
      continue;
    }
    const qi = resolveDisplayTwelveQiStage(value.stem, value.branch);
    const verdict = GOOD_QI_ENHANCE.has(qi)
      ? "เรียนตรงสายแล้วได้ใช้ทำมาหากินจริง แปลงความรู้เป็นรายได้ได้ดี"
      : qi === "ซวย" || qi === "เจ๊าะ"
        ? "เรียนแล้วมักไม่ได้ใช้สายตรง (เซียงแซนี้แก้ยากที่สุด) ควรปรับไปหาเงินตามแนวของเซียงแซนี้แทนการฝืนสายเดิม"
        : FOE_QI.has(qi)
          ? "เรียนแล้วได้ใช้ไม่เต็มที่ ต้องหาเวที/จังหวะที่ใช่จึงจะแปลงเป็นรายได้"
          : "เรียนแล้วได้ใช้ตามจังหวะ ควรเลือกสายที่ถนัดและฝึกต่อเนื่อง";
    outLines.push(`${PILLAR_LABEL_TH[pillar]} (ดาวถ่ายเท ธาตุ${outputLabel}, ${qi}) = ${verdict}`);
  }
  if (outLines.length > 0) {
    segments.push(outLines.join("\n"));
  }

  // แนะนำคณะ/สาขา/คอสจริงตามธาตุที่ดวงต้องการ (useful god)
  segments.push(
    `ควรเรียนสายที่ตรงกับธาตุที่ดวงต้องการ (useful god: ${useful.join(" / ")}) เพื่อแปลงความรู้เป็นรายได้:`,
  );
  for (const el of useful) {
    if (FACULTY_BY_ELEMENT_TH[el]) {
      segments.push(`• สายธาตุ${el} — ${FACULTY_BY_ELEMENT_TH[el]}`);
    }
  }

  return segments.join("\n\n");
}

/** บท 5 พรสวรรค์ = ดาวถ่ายเท (output) + สภาวะ 12 เชี่ยงแซ (ทักษะ/วิเคราะห์/สื่อสาร ไม่ใช่บุคลิกทั่วไป) */
/** ชนิดดาวถ่ายเท: 食神 (พ้องขั้วดิถี = นุ่มนวล/ประณีต) หรือ 傷官 (ต่างขั้ว = เฉียบคม/วาทศิลป์) */
const OUTPUT_STAR_TALENT_TH = {
  eating: "พรสวรรค์แบบ “ดาวถ่ายเทพ้องขั้ว (食神)” — ถ่ายทอดอย่างนุ่มนวลมีรสนิยม สร้างผลงานประณีตและต่อเนื่อง เด่นงานสอน ดูแล บริการ อาหาร ศิลปะ และการทำให้คนรอบข้างสบายใจ",
  hurting: "พรสวรรค์แบบ “ดาวถ่ายเทต่างขั้ว (傷官)” — เฉียบคมและมีวาทศิลป์ เด่นเรื่องการพูด โน้มน้าว นำเสนอ แสดงออก คิดนอกกรอบและสร้างสรรค์สิ่งใหม่ (ควรระวังความหยิ่งในความสามารถและคำพูดที่ตรงเกินไป)",
} as const;

/** ความหมายพรสวรรค์ตาม 12 เซียงแซ — อ่านเชิงบวก (ศักยภาพ/ความถนัด) สั้นกระชับ */
const QI_TALENT_POS_TH: Record<string, string> = {
  "เชี่ยงแซ": "เรียนรู้ไว ต่อยอดทักษะได้เรื่อย ๆ เก่งงานริเริ่มและพัฒนาสิ่งใหม่",
  "หมกยก": "ไวต่อรสนิยมและอารมณ์คน เก่งงานสื่อสาร นำเสนอ ศิลปะ และเสน่ห์การพูด",
  "กวงตั่ว": "ทักษะที่สั่งสมจนมีชื่อเสียง เก่งสร้างภาพลักษณ์และผลงานที่ได้รับการยอมรับ",
  "ลิ่มกัว": "ความเชี่ยวชาญระดับมืออาชีพ พร้อมรับงานใหญ่และบทบาทที่มีความรับผิดชอบ",
  "ตี้อ๋วง": "พลังความสามารถเต็มเปี่ยม โดดเด่นจนเป็นผู้นำ/ตัวจริงในสายงานนั้น",
  "ซวย": "ความประณีตลึกซึ้ง เก่งงานละเอียดและงานที่ต้องใช้ประสบการณ์กลั่นกรอง",
  "แป่": "เข้าใจปัญหาคนได้ลึก เก่งวิเคราะห์ ให้คำปรึกษา การสอน และแก้ปัญหาเฉพาะทาง",
  "ซี่": "สมาธิจดจ่อสูง เชี่ยวชาญเจาะลึกเฉพาะทางจนเป็นผู้รู้จริง",
  "หมอ": "เก่งสะสม รวบรวม และจัดเก็บความรู้ เด่นงานวิจัย คลังข้อมูล และงานเชิงลึก",
  "เจ๊าะ": "คิดแหวกแนวสุดขั้ว เก่งพลิกสถานการณ์และสร้างสรรค์สิ่งที่ไม่มีใครทำ",
  "ทอ": "เต็มไปด้วยไอเดียตั้งต้น เก่งบ่มเพาะโปรเจกต์และมองเห็นโอกาสใหม่",
  "เอี้ยง": "เก่งดูแลบ่มเพาะต่อเนื่อง สร้างผลงานที่ค่อย ๆ โตอย่างยั่งยืน",
};

function buildTalentReading(calculatedState: CalculatedStateValue): string | null {
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue;
  const dmYang = YANG_STEM_SET.has(calculatedState.dayMaster);

  const hits: string[] = [];
  let sawEating = false;
  let sawHurting = false;
  for (const pillar of ["year", "month", "day", "hour"] as PillarKey[]) {
    const value = calculatedState.fourPillars[pillar];
    const onStem = stemElement(value.stem) === output;
    const onBranch = branchElement(value.branch) === output;
    if (!onStem && !onBranch) {
      continue;
    }
    if (onStem) {
      if (YANG_STEM_SET.has(value.stem) === dmYang) sawEating = true;
      else sawHurting = true;
    }
    if (onBranch) {
      if (YANG_BRANCH_SET.has(value.branch) === dmYang) sawEating = true;
      else sawHurting = true;
    }
    // qi ตามตำแหน่ง: กิ่งใช้ 12 เซียงแซที่ engine คำนวณ (pillarBranchQi), ก้านใช้คู่ดิถี-ราศีบน
    const qi = onBranch
      ? pillarBranchQi(calculatedState, pillar)
      : resolveDisplayStemPairStage(calculatedState.dayMaster, value.stem);
    const meaning = QI_TALENT_POS_TH[qi] ?? "ใช้ทักษะได้ดีตามจังหวะที่เหมาะ";
    const cell = onStem && onBranch ? `${value.stem}${value.branch}` : onStem ? value.stem : value.branch;
    hits.push(`${PILLAR_LABEL_TH[pillar]} ${cell} (ดาวถ่ายเท ธาตุ${elementLabel(output)}${qi ? `, ${qi}` : ""}): ${meaning}`);
  }

  // ชนิดพรสวรรค์ตามขั้วดาวถ่ายเท — เป็นหัวใจของบท (สรุปสั้น ไม่มีน้ำ)
  const typeLines: string[] = [];
  if (sawHurting) {
    typeLines.push(OUTPUT_STAR_TALENT_TH.hurting);
  }
  if (sawEating) {
    typeLines.push(OUTPUT_STAR_TALENT_TH.eating);
  }

  if (hits.length === 0 && typeLines.length === 0) {
    return `พรสวรรค์เด่นจะแสดงออกเป็นช่วงตามวัยจรที่ดาวถ่ายเท (ธาตุ${elementLabel(output)}) เข้ามา`;
  }
  return [...typeLines, ...hits].join("\n\n");
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

/** ย่อหน้าปิดท้าย = บทสรุปเฉพาะของบทนั้น (ไม่ซ้ำกันทุกบท) */
function buildChapterAdvice(_calculatedState: CalculatedStateValue, topicId: string): string {
  return CHAPTER_SUMMARY_TH[topicId] ?? "";
}

/**
 * คืนข้อความผลการทำนายภาษามนุษย์ของหัวข้อ (deterministic จาก knownlage + คลังถ้อยคำ)
 * ห่อด้วย intro (คอนเซ็ปต์) + เนื้อหา engine + advice (คำแนะนำ) ให้เป็นร้อยแก้วเรียบเรียง
 * หรือ null ถ้ายังไม่มีองค์ความรู้สำหรับหัวข้อนั้น.
 */
export function buildTopicHumanReading(
  calculatedState: CalculatedStateValue,
  topicId: string,
  rawInput?: RawInputValue,
): string | null {
  let body = buildTopicReadingBody(calculatedState, topicId, rawInput);
  if (body == null) {
    // fallback: ดึงพื้นฐานจากตำราเคี้ยงคุง (ยกเว้นหัวข้อที่ null เพราะขาด input เช่น ความรักต้องมีเพศ)
    if (KHEANGKHUNG_FALLBACK_EXCLUDE.has(topicId)) {
      return null;
    }
    body = buildKheangkhungFallback(topicId);
    if (body == null) {
      return null;
    }
  }
  return composeParagraphs([
    CHAPTER_INTRO_TH[topicId],
    body,
    buildChapterAdvice(calculatedState, topicId),
  ]);
}

function buildTopicReadingBody(
  calculatedState: CalculatedStateValue,
  topicId: string,
  rawInput?: RawInputValue,
): string | null {
  switch (topicId) {
    case "chart_foundation":
      return buildPersonalityReading(calculatedState);
    case "talent":
      return buildTalentReading(calculatedState);
    case "health":
      return buildHealthReading(calculatedState);
    case "wealth_and_investment":
      return buildWealthReading(calculatedState);
    case "colors_directions":
      return buildColorsReading(calculatedState);
    case "guardian_deities":
      return buildDeitiesReading(calculatedState);
    case "career_potential":
      return buildCareerReading(calculatedState);
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
