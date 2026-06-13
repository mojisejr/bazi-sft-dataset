import { readFileSync } from "node:fs";
import path from "node:path";

import type { CalculatedStateValue, RawInputValue, SupportedElementValue } from "@/lib/bazi/schema-types";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { K, KC, currentAppends } from "@/lib/bazi/knowledge/knowledge-overlay-context";
import {
  resolveDisplayStemPairStage,
  resolveDisplayTwelveQiStage,
} from "@/lib/bazi/pillar-display";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import { buildOutputTransferReading } from "@/lib/bazi/output-transfer-reading";
import {
  buildAptitudeCareerBridge,
  resolveStageHeadline,
  resolveTalentAptitude,
} from "@/lib/bazi/talent-aptitude";
import {
  CHAPTER_INTRO_TH,
  CHAPTER_SUMMARY_TH,
  CHAPTER_ASPECT_TH,
  CHAPTER_HEADLINE_TH,
  ELEMENT_DEITY_BENEFIT_TH,
  buildElementClosingSimile,
  bulletizeCommaLists,
  composeParagraphs,
  humanizeConsumerProse,
  weaveNarrative,
} from "@/lib/bazi/reading-phrases";
import {
  BRANCH_HIDDEN_STEMS,
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
    // ไฟล์ต้นฉบับมี 2 ปัญหา encoding ที่ทำให้ record บางตัวถูก drop ตอน parse:
    //  1) กิ่ง 辰 เก็บเป็น CJK Compatibility Ideograph (U+F971) ไม่ match 辰 มาตรฐาน (U+8FB0)
    //     ใน EARTHLY_BRANCHES → NFKC รวมเป็น codepoint เดียวกัน
    //  2) ธาตุ "น้ำ" บางบรรทัดสะกดเป็น "น้ํา" (นิคหิต U+0E4D + สระอา U+0E32 แทนสระอำ U+0E33)
    //     ซึ่ง NFKC ไม่รวมให้ → ELEMENT_WORDS.has("น้ํา") fail ทำให้บรรทัดเชี่ยงแซธาตุน้ำหายไป
    // แก้ทั้งคู่เพื่อให้ 60 กะจื่อครบ (รวม 丁辰/壬辰 และคู่ธาตุน้ำอีก 12 ตัว)
    raw = readFileSync(path.join(KNOWLEDGE_DIR, PERSONALITY_FILE), "utf8")
      .normalize("NFKC")
      .replace(/ํา/g, "ำ");
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
export type ThaiElement = (typeof THAI_ELEMENTS)[number];
export type StrengthBand = "very-weak" | "weak" | "balanced" | "strong" | "very-strong";

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

/** 得令 — ดิถี "ถูกฤดู": ธาตุดิถีตรงกับธาตุที่ครองเดือน (月令旺, เช่น 丙 ไฟ เกิดเดือน 午/巳)
 *  ดวงถูกฤดูย่อมแกร่งกว่าคะแนนดิบ เพราะสเปกคะแนน (strength-scoring-spec) ตัด 得令(+2) ออกเพื่อกันเฟ้อทั้งระบบ */
function isSeasonalCommand(calculatedState: CalculatedStateValue): boolean {
  return branchElement(calculatedState.fourPillars.month.branch) === dayMasterElement(calculatedState);
}

function resolveStrengthBand(calculatedState: CalculatedStateValue): StrengthBand {
  try {
    const band = classifyOperatorStrengthScore(calculatedState.strengthScore).id as StrengthBand;
    // R5.2b (กฎ 得令 เฉพาะจุด): ดวง "สมดุล" ที่ถูกฤดู (月令旺) → ยก reading-band เป็น "แข็ง"
    //   ชดเชย 得令(+2) ที่ตัดจากสูตรคะแนน เฉพาะแดน balanced (ดวง weak ที่ถูกฤดูยังคง weak) —
    //   แก้ที่ band ของการอ่านเท่านั้น ไม่แตะ strengthScore/score-classifier (คง golden + ไม่ดัน global threshold)
    //   ผล: DNA3 (丙 summer 4.5) = strong → useful god ตามมา [output=ดิน, wealth=ทอง] ตรงซินแส
    if (band === "balanced" && isSeasonalCommand(calculatedState)) {
      return "strong";
    }
    return band;
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

// คะแนนขั้นต่ำที่ถือว่าดิถี "อ่อนแต่เกือบสมดุล" (upper-weak) — ใช้กับกฎ 身財両停 (leverage 財)
// weak band = (2, 3.75]; 2.5 = อยู่ครึ่งบนของโซน ใกล้ขอบ balanced พอจะรับ/ใช้ดาวลาภได้
const WEALTH_LEVERAGE_MIN_SCORE = 2.5;

// 身財両停: ดิถี "อ่อนแต่เกือบสมดุล" (band weak + คะแนนใกล้ขอบ balanced) + ดาวลาภ (財) แข็งแรง
//   → ดวงรับ 財 ได้ จึง leverage สาย 食傷→財 (ถ่ายเท→ลาภ) + 印 หนุน แทนการเสริมตัวเองล้วน (財多身弱)
//   คุมแคบ (เฉพาะ weak ที่คะแนนสูงพอ + 財 แข็ง) เพื่อไม่ให้ดวงอ่อนลึกถูกผลักไป leverage 財
function isWealthLeverageChart(calculatedState: CalculatedStateValue): boolean {
  if (resolveStrengthBand(calculatedState) !== "weak") {
    return false;
  }
  if (calculatedState.strengthScore < WEALTH_LEVERAGE_MIN_SCORE) {
    return false;
  }
  const wealth = CONTROLS[dayMasterElement(calculatedState)] as SupportedElementValue;
  return (
    calculatedState.elementAnalysis.dominantElements.includes(wealth) ||
    resolveElementStrengthLabel(calculatedState, wealth) === "strong"
  );
}

// 调候 (climate balancing): เดือนเกิดร้อน/หนาวจัด ต้องการธาตุปรับอากาศ
//  - ร้อน (巳午未) → เติม "น้ำ" ดับร้อน (เว้นดวงแข็งล้นที่ต้องระบาย ไม่ใช่เติมตัวเอง)
//  - หนาว (亥子丑) → เติม "ไฟ" ให้อุ่น (เฉพาะดวงสมดุลขึ้นไป; ดวงอ่อนยังเน้น 扶抑 หนุนตัวก่อน)
// อ้างหลักฐาน docs/r5-strength-useful-divergence-2026-06-08.md (engine 扶抑 ล้วนเดิมพลาด 调调 3/4 เคส)
const HOT_MONTH_BRANCHES = new Set(["巳", "午", "未"]);
const COLD_MONTH_BRANCHES = new Set(["亥", "子", "丑"]);

function applyTiaohou(
  useful: ThaiElement[],
  calculatedState: CalculatedStateValue,
  band: StrengthBand,
): ThaiElement[] {
  const monthBranch = calculatedState.fourPillars.month.branch;
  const out = [...useful];
  const weakLike = band === "weak" || band === "very-weak";
  const strongLike = band === "strong" || band === "very-strong";
  // ห้ามเติมธาตุปรับอากาศที่เป็น "ดาวอำนาจ (官杀)" ของดิถี (ธาตุที่พิฆาตดิถี) —
  //   เช่นดิถีไฟ น้ำ=ดาวอำนาจ การเติมน้ำหน้าร้อนคือพิฆาตดิถี ไม่ใช่ 调候 (ดิถีไฟแข็งให้ระบายด้วยถ่ายเท/ลาภ)
  const officer = (Object.keys(CONTROLS) as SupportedElementValue[]).find(
    (e) => CONTROLS[e] === dayMasterElement(calculatedState),
  ) as SupportedElementValue;
  const officerTh = elementLabel(officer);
  if (HOT_MONTH_BRANCHES.has(monthBranch) && !strongLike && officerTh !== "น้ำ" && !out.includes("น้ำ")) {
    out.push("น้ำ");
  }
  if (COLD_MONTH_BRANCHES.has(monthBranch) && !weakLike && officerTh !== "ไฟ" && !out.includes("ไฟ")) {
    out.push("ไฟ");
  }
  return out;
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
  // 身財両停 (ดู isWealthLeverageChart): อ่อนเกือบสมดุล + 財 แข็ง → leverage 財 โดยมี 印 หนุน
  const weakUseful: SupportedElementValue[] = useOfficerControl
    ? [resource, output]
    : isWealthLeverageChart(calculatedState)
      ? [wealth, resource]
      : [resource, same];

  // ดิถีอ่อน/อ่อนมาก ต้องการ 印 (ธาตุส่งเสริม) เป็นหลัก + 比劫 (คู่ธาตุ) เสริม
  // (ตำราเคี้ยงคุง: 己 อ่อนแอ → useful god = ไฟ ก่อน แล้วตามด้วยดิน)
  // ดิถีแข็ง: ระบายพลังด้วยถ่ายเท (食傷) + ลาภ (财) — 食傷生财 ทั้งคู่เป็นคุณ
  // (ตำรา: ดิถีไฟแข็งหน้าร้อน → useful god = ดิน(ถ่ายเท) + ทอง(ลาภ))
  // balanced (กึ่งแข็งกึ่งอ่อน): ใช้ตรรกะควบ 2 ฐาน (ดิถี + หลักเดือน) ตามที่ซินแซกำชับ
  // fallback เป็น [ถ่ายเท, ลาภ] ถ้าไม่มีธาตุไหนหนุนทั้งสองฐาน
  if (band === "balanced") {
    const { recommend } = resolveBalancedDualBaseCareer(calculatedState);
    const dualBase = (recommend.length > 0 ? recommend : [output, wealth]).map(elementLabel);
    return applyTiaohou([...new Set(dualBase)], calculatedState, band);
  }

  const roleMap: Record<Exclude<StrengthBand, "balanced">, SupportedElementValue[]> = {
    "very-strong": [output, wealth],
    strong: [output, wealth],
    weak: weakUseful,
    "very-weak": weakUseful,
  };

  const ordered = roleMap[band].map(elementLabel);
  return applyTiaohou([...new Set(ordered)], calculatedState, band);
}

/** [diagnostic R5] เปิดให้ script ภายนอกอ่าน useful-god ของ engine ตรง ๆ (wrapper, ไม่เปลี่ยนพฤติกรรม) */
export function getEngineUsefulElements(state: CalculatedStateValue): ThaiElement[] {
  return resolveUsefulElements(state);
}

/** [diagnostic R5] เปิดให้ script ภายนอกอ่าน strength band ของ engine (wrapper, ไม่เปลี่ยนพฤติกรรม) */
export function getEngineStrengthBand(state: CalculatedStateValue): StrengthBand {
  return resolveStrengthBand(state);
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

// อาการเมื่อ "ธาตุล้นเกิน" (อิงตำราเคี้ยงคุง: น้ำเยอะ→อ้วน/บวม + หลักปฏิกิริยา 5 ธาตุ-อวัยวะ)
export const EXCESS_HEALTH_TH: Record<ThaiElement, string> = {
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

/** การเงิน 1.4: ขุมคลัง (财库 ไฉ่โข่ว) ถูกทำลาย — `ดิถี X มี Y ในดวง จะถือว่าเก็บเงินไม่อยู่ <ผล>`
 *  → Map ดิถี(ก้าน) → [{ stem ก้านที่ทำให้รั่ว, effect }] (จาก wealth.txt) */
function parseWealthVaultDamage(): Map<string, Array<{ stem: string; effect: string }>> | null {
  const lines = readExtractedLines("wealth.txt");
  if (!lines) {
    return null;
  }
  const map = new Map<string, Array<{ stem: string; effect: string }>>();
  for (const line of lines) {
    const match = line.match(/^ดิถี\s*(\S)\s*มี\s*(\S)\s*ในดวง\s*จะถือว่า(.+)$/);
    if (!match) {
      continue;
    }
    const [, dayStem, leakStem, effect] = match;
    if (!HEAVENLY_STEMS.includes(dayStem) || !HEAVENLY_STEMS.includes(leakStem)) {
      continue;
    }
    const list = map.get(dayStem) ?? [];
    list.push({ stem: leakStem, effect: effect.trim() });
    map.set(dayStem, list);
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

/** Source7 §3.1: ตารางสัตว์มงคล key `${ดิถี}|${ราศีบนหลักเดือน}` (คอลัมน์สัตว์ = บรรทัดที่ 2 ถัดจากสี) */
function parseSource7AnimalTable(marker: string): Map<string, string> | null {
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
  let sawColor = false;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    if (/^\d+(\.\d+)?\s/.test(line)) {
      break;
    }
    if (HEAVENLY_STEMS.includes(line)) {
      dayStem = line;
      upperStems = null;
      sawColor = false;
      continue;
    }
    if (!dayStem) {
      continue;
    }
    const stemGroup = line.split(",").map((token) => token.trim()).filter((token) => HEAVENLY_STEMS.includes(token));
    if (stemGroup.length > 0 && !upperStems) {
      upperStems = stemGroup;
      sawColor = false;
      continue;
    }
    if (upperStems && !sawColor) {
      // บรรทัดแรกหลังกลุ่มราศีบน = สี (ข้าม) — บรรทัดถัดไปคือสัตว์มงคล
      sawColor = true;
      continue;
    }
    if (upperStems && sawColor) {
      for (const upper of upperStems) {
        map.set(`${dayStem}|${upper}`, line);
      }
      upperStems = null;
      sawColor = false;
    }
  }
  return map.size > 0 ? map : null;
}

/** Source7 §5: เทพประจำราศีบน (10 ราศีบน) และราศีล่าง (12 ราศีล่าง) สำหรับเทพเฉพาะดวง */
type DeityEntry = { deity: string; degree: string | null };
function parseSource7CustomDeities(): { upper: Map<string, DeityEntry>; lower: Map<string, DeityEntry> } | null {
  const lines = readExtractedLines("source7-custom.txt");
  if (!lines) {
    return null;
  }
  const upper = new Map<string, DeityEntry>();
  const lower = new Map<string, DeityEntry>();
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
    const [key, deity, degreeRaw] = line.split("|").map((part) => part.trim());
    if (!key || !deity) {
      continue;
    }
    const degree = degreeRaw && degreeRaw !== "-" ? degreeRaw : null;
    (bucket === "upper" ? upper : lower).set(key, { deity, degree });
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
export const STEM_NATURE_TH: Record<string, string> = {
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
export const ELEMENT_IMAGERY_TH: Record<ThaiElement, string> = {
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
  const nature = K("STEM_NATURE_TH", STEM_NATURE_TH)[stem] ?? `ธาตุ${elementTh}`;
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
    text += ` ท่ามกลาง${K("ELEMENT_IMAGERY_TH", ELEMENT_IMAGERY_TH)[surrounding]}ที่โดดเด่นอยู่รายรอบ`;
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

// วลีบอกกำลังดิถี โทน your life code (ใช้ในประโยคเปิดเจาะดวงของแต่ละบท)
export const BAND_OPENING_TH: Record<string, string> = {
  "very-weak": "พื้นดวงจัดเป็น “ดิถีอ่อน” พลังของดิถียังส่งมาไม่ถึงตัวเต็มที่ จึงต้องอาศัยแรงหนุนจากคนรอบข้างและการโฟกัสสิ่งที่ถนัดเพียงทางเดียวให้ลึก",
  weak: "พื้นดวงค่อนไปทาง “ดิถีอ่อน” แม้มีต้นทุนอยู่บ้างแต่ยังต้องการผู้สนับสนุน จึงควรเลือกทำสิ่งที่ถนัดให้ชัดเจน อย่ากระจายแรงหลายทางพร้อมกัน",
  balanced: "พื้นดวงอยู่ในสภาวะค่อนข้างสมดุล ปรับตัวได้หลากหลายและเดินหน้าตามแผนได้อย่างมั่นคง",
  strong: "พื้นดวงจัดเป็น “ดิถีแข็ง” มีต้นทุนชีวิตที่หนักแน่น เหมาะกับการลงมือทำด้วยตนเอง แต่ควรหาทางระบายพลังออกเป็นผลงาน",
  "very-strong": "พื้นดวงจัดเป็น “ดิถีแข็ง” มีพลังแรงกล้า เหมาะกับการเป็นผู้นำและลุยเต็มที่ แต่ต้องหาช่องทางระบายพลังให้สมดุล",
};

/**
 * ประโยคเปิด "เจาะดวงนี้" ต่อจาก intro คอนเซ็ปต์ (ทุกบท) — โทน your life code
 * (พาดหัวบท + ภาพดิถี + ขั้ว + กำลัง + แกนของบท) ประกอบจากข้อเท็จจริงที่ engine มีอยู่แล้ว ไม่เพิ่ม claim ใหม่
 */
function buildChapterOpening(
  calculatedState: CalculatedStateValue,
  topicId: string,
): string | null {
  const headline = K("CHAPTER_HEADLINE_TH", CHAPTER_HEADLINE_TH)[topicId];
  if (!headline) {
    return null;
  }
  // บทพื้นฐานชะตา: ภาพดิถี (imagery) ในเนื้อหาทำหน้าที่นำอยู่แล้ว — เปิดด้วยพาดหัวเท่านั้น
  if (topicId === "chart_foundation") {
    return headline;
  }
  const stem = calculatedState.dayMaster;
  const elementTh = elementLabel(dayMasterElement(calculatedState));
  const polarity = YANG_STEM_SET.has(stem) ? "หยาง" : "หยิน";
  const nature = K("STEM_NATURE_TH", STEM_NATURE_TH)[stem] ?? `ธาตุ${elementTh}`;
  const bandClause = K("BAND_OPENING_TH", BAND_OPENING_TH)[resolveStrengthBand(calculatedState)];
  const aspect = K("CHAPTER_ASPECT_TH", CHAPTER_ASPECT_TH)[topicId];
  if (!bandClause || !aspect) {
    return headline;
  }
  // คงรูปแบบ "${elementTh}พลัง${polarity}" (ไม่มีคำว่า ธาตุ นำหน้า) เพื่อไม่ชนการเรียงลำดับ useful god ในเนื้อหา
  return `${headline} — สำหรับเรื่อง${aspect}ของดวงนี้ ต้องเริ่มจากดิถีประจำตัวคือ ${stem} ${nature} (${elementTh}พลัง${polarity}) ${bandClause} จากจุดนี้จึงค่อยพิจารณารายละเอียดต่อไปนี้`;
}

// ───────── ความสัมพันธ์ในผังดวงตามตำราเคี้ยงคุง (ผั่ว/ชง) → คำทำนายเชิงลึก ─────────
// อ้างอิง knownlage/extracted/kheangkhung-reference.txt
//  - การผั่ว (破) = คู่ "ราศีบน(ก้าน)×ราศีล่าง(กิ่ง)" เฉพาะคู่ ในเสาเดียวกัน (บรรทัด 633-646)
//    ตีความตาม "หลักที่ผั่วตก": ปี=วงศ์ตระกูล/วัยต้น, เดือน=การงาน/ผู้ใหญ่, วัน=คู่ครอง/ตัวตน, ยาม=บุตร/บั้นปลาย
export const PO_PILLAR_MEANING_TH: Record<string, string> = {
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
export const CHONG_POSITION_TH: Record<"year-month" | "month-day" | "day-hour", string> = {
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
export const HENG_PAIR_MEANING_TH: Record<string, string> = {
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
    const meaning = K("PO_PILLAR_MEANING_TH", PO_PILLAR_MEANING_TH)[`${p[key].stem}${p[key].branch}`];
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
      notes.push(`การชง (冲) ${p[a].branch}-${p[b].branch} — ${K("CHONG_POSITION_TH", CHONG_POSITION_TH)[label]}`);
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

  // การไห่ (害) — ระบุ "ตำแหน่งเสา" ที่ไห่กัน แล้วแปลเป็นคู่ความสัมพันธ์ (ตามคำกำชับซินแซ)
  // เช่น 申(ยาม)↔亥(เดือน) = ไห่กันระหว่างลูก/บริวาร/supplier กับพ่อแม่/ครอบครัว
  const pillarKeysOfBranch = (branch: string): PillarKey[] =>
    (["year", "month", "day", "hour"] as const).filter((k) => p[k].branch === branch);
  for (const [a, b] of HAI_PAIRS) {
    if (!hasPair(a, b)) {
      continue;
    }
    const aKeys = pillarKeysOfBranch(a);
    const bKeys = pillarKeysOfBranch(b);
    const where = [...aKeys, ...bKeys].map((k) => PILLAR_LABEL_TH[k]).join("-");
    const whoA = aKeys.map((k) => PILLAR_CONTEXT_MAP[k].traditionalPerson).join("/");
    const whoB = bKeys.map((k) => PILLAR_CONTEXT_MAP[k].traditionalPerson).join("/");
    notes.push(
      `การไห่ (害) ${a}${b} (ที่${where}): ไห่กันระหว่าง “${whoA}” กับ “${whoB}” — มักให้ร้าย ประชดประชัน นินทาว่าร้ายกัน หรือถูกกล่าวหาให้ได้รับความเสียหายจากคนใกล้ตัว/คู่ค้า หากรุนแรงอาจลุกลามเป็นคดีความ`,
    );
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
  const poDay = K("PO_PILLAR_MEANING_TH", PO_PILLAR_MEANING_TH)[`${p.day.stem}${p.day.branch}`];
  if (poDay) {
    notes.push(`การผั่ว (破) ที่เสาวัน (เรือนคู่ครอง) ${p.day.stem}${p.day.branch}: ${poDay} — สะท้อนปมที่ต้องระวังในชีวิตคู่`);
  }
  if (BRANCH_OPPOSITE[p.day.branch] === p.hour.branch) {
    notes.push(`การชง (冲) ${p.day.branch}-${p.hour.branch} — ${K("CHONG_POSITION_TH", CHONG_POSITION_TH)["day-hour"]}`);
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
    return `การชง (冲) ${p.year.branch}-${p.month.branch} — ${K("CHONG_POSITION_TH", CHONG_POSITION_TH)["year-month"]}`;
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

/**
 * เวอร์ชัน flatten ของ ELEMENT_TEMPER_TH สำหรับตัวแก้องค์ความรู้ (key = "ธาตุ|temper")
 * — เป็น default ใน catalog; การอ่านจริงใช้ KC("ELEMENT_TEMPER_TH", fallback, ธาตุ, temper)
 */
export const ELEMENT_TEMPER_FLAT_TH: Record<string, string> = Object.fromEntries(
  Object.entries(ELEMENT_TEMPER_TH).flatMap(([element, byTemper]) =>
    Object.entries(byTemper).map(([temper, text]) => [`${element}|${temper}`, text]),
  ),
);

/** อ่านนิสัยตามธาตุ×temper ผ่าน overlay (แก้ออนไลน์ได้รายช่อง) */
function temperText(element: ThaiElement, temper: ElementTemper): string {
  return KC("ELEMENT_TEMPER_TH", ELEMENT_TEMPER_TH[element]?.[temper] ?? "", element, temper);
}

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
  // เรียบเรียงคีย์เวิร์ดให้เป็นร้อยแก้วลื่นแบบ 1.docx โดยคงเนื้อคีย์เวิร์ดและ marker เดิม
  // (คง substring "ดิถี <ก้าน>" และ "ราศีล่างวัน <กิ่ง>" ไว้ตามที่ test/ซินแซใช้อ่าน)
  const segments = [
    imagery,
    stemText ? `ลักษณะเด่นของคนดิถี ${calculatedState.dayMaster} คือ ${stemText}` : null,
    record?.branchText
      ? `ราศีล่างวัน ${calculatedState.fourPillars.day.branch} ยังสะท้อนว่าเป็นคนที่${record.branchText}`
      : null,
    record?.elementText
      ? `ในแง่ของธาตุ ${record.elementLabel} ${record.qiLabel}${qiKeyword ? ` (แก่นเชี่ยงแซ: ${qiKeyword})` : ""} บ่งบอกว่า${record.elementText}`
      : null,
  ].filter((segment): segment is string => Boolean(segment));

  // อุปนิสัยตามธาตุดิถี × กำลัง (ถูกฤดู/มากเกิน/น้อยเกิน) ตามตำราเคี้ยงคุง
  const dmElement = elementLabel(dayMasterElement(calculatedState));
  if (ELEMENT_TEMPER_TH[dmElement]) {
    const temper = resolveElementTemper(resolveStrengthBand(calculatedState));
    // หัวข้อย่อยแบบ gptCase: ถูกฤดู = นิสัยเด่น, ล้น/พร่อง = สิ่งที่ควรระวัง
    const temperHead = temper === "balanced" ? "นิสัยเด่นประจำธาตุดิถี" : "สิ่งที่ควรระวัง";
    segments.push(`${temperHead}:\n${temperText(dmElement, temper)}`);
  }

  // นิสัยที่ควรเสริมเพื่อหนุนดวง = คุณธรรมประจำธาตุที่ดวงต้องการ (useful god) — เลียนโครง your life code
  const usefulVirtues = resolveUsefulElements(calculatedState)
    .map((element) => (K("RESOURCE_VIRTUE_TH", RESOURCE_VIRTUE_TH)[element] ? `ธาตุ${element} — ${K("RESOURCE_VIRTUE_TH", RESOURCE_VIRTUE_TH)[element]}` : null))
    .filter((line): line is string => Boolean(line));
  if (usefulVirtues.length > 0) {
    segments.push(`นิสัยที่ควรพัฒนาเพื่อเสริมดวง (ตามธาตุที่ดวงต้องการ):\n${usefulVirtues.map((line) => `• ${line}`).join("\n")}`);
  }

  // ความสัมพันธ์ในผังดวง (ผั่ว/ชง) ตามตำราเคี้ยงคุง — เสริมคำทำนายเชิงลึกถ้าตรวจพบ
  const relationNotes = buildNatalRelationNotes(calculatedState);
  if (relationNotes.length > 0) {
    segments.push(`ความสัมพันธ์เด่นในผังดวง:\n${relationNotes.join("\n")}`);
  }

  return segments.length > 0 ? segments.join("\n\n") : null;
}

/**
 * หัวข้อย่อยของบท 1 "พื้นฐานดวงชะตา" ตาม docs/ทายดวง 15 หัวข้อ.docx (master spec)
 * ใช้เป็น "หัวกล่อง (box)" — ซินแสแก้เฉพาะเนื้อในแต่ละกล่องได้ง่าย
 */
const CHART_FOUNDATION_SUBTOPICS = {
  basis: "ดิถีอะไร เกิดถูกฤดู นั่งถูกที่ อ่อนมาก/อ่อน/สมดุล/แข็ง/แข็งไป",
  lowerBranch: "ทายนิสัยจากราศีล่างหลักวัน",
  upperLower: "ทายนิสัยจากราศีบนหลักวัน/ราศีล่างหลักวัน (ระบบนับอิม + 12 เชี่ยงแซ)",
  transfer: "ทายนิสัยจาก ดิถี → การกระทำ (ธาตุถ่ายเท) → ผลลัพธ์ (ธาตุโชคลาภ)",
  caution: "สิ่งพึงระวัง",
  advice: "ข้อเสนอแนะ (จิตวิทยา พฤติกรรมแก้ไข)",
} as const;

/** ป้ายกำลังดิถีตามถ้อยคำใน docx (อ่อนมาก/อ่อน/สมดุล/แข็ง/แข็งไป) */
const STRENGTH_BAND_LABEL_TH: Record<string, string> = {
  "very-weak": "อ่อนมาก (อ่อนเกินไป)",
  weak: "อ่อน",
  balanced: "สมดุล",
  strong: "แข็ง",
  "very-strong": "แข็งไป (แข็งมาก)",
};

/**
 * ประกอบกล่อง (box) markdown: [[box=หัวข้อย่อย]] + เนื้อใน (คั่นด้วยบรรทัดว่าง) — คืน "" ถ้าไม่มีเนื้อหา
 * เนื้อในขึ้นต้นด้วย "ชื่อหัวข้อย่อย" เป็นย่อหน้าแรกเสมอ เพื่อให้ซินแสเห็น/แก้หัวข้อได้ตอนแก้กล่อง
 * และให้หัวข้อติดไปกับข้อความล้วนตอน export PDF/Word (การ์ดยังโชว์หัวสีน้ำเงินจาก [[box=...]] ด้วย)
 */
function readingBox(title: string, paragraphs: Array<string | null | undefined>): string {
  const body = paragraphs
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join("\n\n");
  // ชื่อหัวข้อเป็น **ตัวหนา** — tokenizer กลางตัวเดียวทำให้หนาทั้งการ์ด/กล่องแก้/PDF/Word
  return body ? `[[box=${title}]]\n**${title}**\n\n${body}\n[[/box]]` : "";
}

/**
 * บท 1 (พื้นฐานดวงชะตา) ฉบับ "กล่อง" ตาม docs/ทายดวง 15 หัวข้อ.docx — engine เติมเนื้อหาแต่ละหัวข้อย่อย
 * reuse ชิ้นส่วนเดียวกับ buildPersonalityReading/buildSpeechReading เพื่อคง marker/ข้อเท็จจริงเดิม
 * (เนื้อหาในกล่องเป็น markdown subset เดิม → ซินแสแก้/PDF/Word ใช้ต่อได้)
 */
function buildChartFoundationBoxes(calculatedState: CalculatedStateValue): string | null {
  const dayStem = calculatedState.dayMaster;
  const dayBranch = calculatedState.fourPillars.day.branch;
  const monthBranch = calculatedState.fourPillars.month.branch;
  const dmElement = dayMasterElement(calculatedState);
  const dmElementTh = elementLabel(dmElement);
  const band = resolveStrengthBand(calculatedState);

  const index = getPersonalityIndex();
  const record = index?.byStemBranch.get(`${dayStem}|${dayBranch}`);
  const normalizeQi = (label: string) => label.replace(/เซี่ยงแซ/g, "เชี่ยงแซ");
  const qiKeyword = record?.qiLabel
    ? Object.values(TWELVE_QI_CONTEXT_MAP).find((entry) => entry.labelThai === normalizeQi(record.qiLabel))
        ?.contextTag
    : undefined;
  const stemText = record?.stemText || index?.stemText.get(dayStem) || "";

  // ── กล่อง 1: ดิถี / เกิดถูกฤดู / นั่งถูกที่ / กำลัง (ตอบครบ 4 ส่วนตามหัวข้อ, แต่ละส่วนเป็นย่อหน้า) ──
  const season = SEASON_BY_BRANCH[monthBranch];
  const seasonTh = season ? SEASON_LABEL_TH[season] : "";
  const monthElTh = elementLabel(branchElement(monthBranch));
  const seasonLine = isSeasonalCommand(calculatedState)
    ? `เกิดถูกฤดู — ธาตุดิถี (${dmElementTh}) ตรงกับธาตุที่ครองเดือนเกิด (${monthBranch}${seasonTh ? ` ${seasonTh}` : ""}) ดิถีจึงได้กำลังหนุนจากฤดูกาล มีพื้นฐานแข็งแรงกว่าคะแนนดิบ`
    : `เกิดไม่ถูกฤดู — เดือนเกิด (${monthBranch}${seasonTh ? ` ${seasonTh}` : ""}) เป็นธาตุ${monthElTh} ไม่ใช่ธาตุดิถี (${dmElementTh}) ดิถีจึงไม่ได้แรงหนุนจากฤดู ต้องอาศัยรากฐานและตัวช่วยอื่นมาเสริม`;
  const selfSeat = resolveDisplayTwelveQiStage(dayStem, dayBranch);
  const seatVerdict = RISING_QI.has(selfSeat)
    ? "นั่งถูกที่ (มีรากฐานหนุน ดิถีตั้งมั่น)"
    : FALLING_QI.has(selfSeat)
      ? "นั่งผิดที่ (ขาดรากฐาน ดิถีอ่อนแรงลง)"
      : "นั่งระดับกลาง (รากฐานพอมีแต่ไม่เด่น)";
  const box1 = readingBox(CHART_FOUNDATION_SUBTOPICS.basis, [
    // ย่อหน้านำ: ภาพดิถี×ฤดู (imagery) — คงสำนวนเอกสาร (เพชรพลอย/ฤดู/บรรยากาศธาตุรอบตัว)
    buildDayMasterImagery(calculatedState),
    seasonLine,
    `นั่งถูกที่หรือไม่ — ดิถี ${dayStem} นั่งบนราศีล่างวัน ${dayBranch} ตกเชี่ยงแซ ${selfSeat} → ${seatVerdict}`,
    `กำลังดิถีโดยรวม: ${STRENGTH_BAND_LABEL_TH[band] ?? band}`,
  ]);

  // ── กล่อง 2: นิสัยจากราศีล่างหลักวัน ──
  const box2 = readingBox(CHART_FOUNDATION_SUBTOPICS.lowerBranch, [
    record?.branchText ? `ราศีล่างวัน ${dayBranch} สะท้อนว่าเป็นคนที่${record.branchText}` : null,
  ]);

  // ── กล่อง 3: นิสัยจากราศีบน + ล่าง (อิม + 12 เชี่ยงแซ) ──
  const temper = resolveElementTemper(band);
  const hasTemper = Boolean(ELEMENT_TEMPER_TH[dmElementTh]);
  const box3 = readingBox(CHART_FOUNDATION_SUBTOPICS.upperLower, [
    stemText ? `ลักษณะเด่นของคนดิถี ${dayStem} คือ ${stemText}` : null,
    record?.elementText
      ? `ในแง่ของธาตุ ${record.elementLabel} ${record.qiLabel}${qiKeyword ? ` (แก่นเชี่ยงแซ: ${qiKeyword})` : ""} บ่งบอกว่า${record.elementText}`
      : null,
    temper === "balanced" && hasTemper
      ? `นิสัยเด่นประจำธาตุดิถี: ${temperText(dmElementTh, "balanced")}`
      : null,
  ]);

  // ── กล่อง 4: ดิถี → การกระทำ(ถ่ายเท) → ผลลัพธ์(โชคลาภ) — อธิบายสายโซ่ + แต่ละหลักเป็นย่อหน้า ──
  const transfer = buildOutputTransferReading(calculatedState);
  const outputElTh = elementLabel(GENERATES[dmElement] as SupportedElementValue);
  const wealthElTh = elementLabel(CONTROLS[dmElement] as SupportedElementValue);
  const carrying = transfer.pillars.filter((pillar) => pillar.carriesOutputElement);
  const transferPillars = (carrying.length > 0 ? carrying : transfer.pillars).map(
    (pillar) => `${pillar.context} (ธาตุถ่ายเทตกเชี่ยงแซ ${pillar.stageThai}): ${pillar.speech}`,
  );
  const box4 = readingBox(CHART_FOUNDATION_SUBTOPICS.transfer, [
    `อ่านเป็นสายโซ่: ดิถี (ธาตุ${dmElementTh}) → การกระทำ/สิ่งที่ลงมือ (ธาตุถ่ายเท ${outputElTh}) → ผลลัพธ์/โชคลาภ (ธาตุ${wealthElTh}) — ธาตุถ่ายเทคือวิธีที่ดิถีแสดงออกและลงมือ ส่วนธาตุโชคลาภคือผลที่ได้กลับคืนมา`,
    ...transferPillars,
  ]);

  // ── กล่อง 5: สิ่งพึงระวัง (temper ล้น/พร่อง + ความสัมพันธ์ผั่ว/ชง แต่ละรายการเป็นย่อหน้า) ──
  const relationNotes = buildNatalRelationNotes(calculatedState);
  const box5 = readingBox(CHART_FOUNDATION_SUBTOPICS.caution, [
    temper !== "balanced" && hasTemper
      ? `สิ่งที่ควรระวังตามกำลังธาตุดิถี: ${temperText(dmElementTh, temper)}`
      : null,
    ...relationNotes,
  ]);

  // ── กล่อง 6: ข้อเสนอแนะ (คุณธรรมตามธาตุที่ดวงต้องการ แต่ละธาตุเป็นย่อหน้า + บทสรุป) ──
  const virtues = resolveUsefulElements(calculatedState)
    .map((element) =>
      K("RESOURCE_VIRTUE_TH", RESOURCE_VIRTUE_TH)[element]
        ? `ธาตุ${element} — ${K("RESOURCE_VIRTUE_TH", RESOURCE_VIRTUE_TH)[element]}`
        : null,
    )
    .filter((line): line is string => Boolean(line));
  const box6 = readingBox(CHART_FOUNDATION_SUBTOPICS.advice, [
    virtues.length > 0 ? "นิสัยที่ควรพัฒนาเพื่อเสริมดวง (ตามธาตุที่ดวงต้องการ):" : null,
    ...virtues,
    buildChapterAdvice(calculatedState, "chart_foundation"),
  ]);

  const boxes = [box1, box2, box3, box4, box5, box6].filter((box) => box.length > 0);
  return boxes.length > 0 ? boxes.join("\n\n") : null;
}

/** มิติพฤติกรรม→อาการ ตามธาตุดิถี (นิสัยที่มักนำไปสู่ปัญหาสุขภาพ) — เลียนโครง your life code */
export const ELEMENT_HEALTH_BEHAVIOR_TH: Record<ThaiElement, string> = {
  "ไม้": "ในเชิงพฤติกรรม คนดิถีไม้มักคิดมาก แบกความรับผิดชอบ และกดดันตัวเองเรื่องอุดมการณ์ ทำให้เครียดสะสม ตึงคอบ่าไหล่ และกระทบตับกับเส้นเอ็นได้ง่าย ควรหาทางผ่อนคลายและไม่หักโหมเกินไป",
  "ไฟ": "ในเชิงพฤติกรรม คนดิถีไฟมักใจร้อน อารมณ์ขึ้นลงไว และตื่นตัวตลอดเวลา ทำให้นอนไม่พอ ใจสั่น และกระทบหัวใจกับความดันได้ง่าย ควรฝึกสงบใจและพักผ่อนให้เป็นเวลา",
  "ดิน": "ในเชิงพฤติกรรม คนดิถีดินมักครุ่นคิดและเก็บความกังวลไว้ในใจ ชอบแบกเรื่องของคนอื่น ทำให้กระเพาะ ม้าม และระบบย่อยอาหารแปรปรวน ควรรู้จักปล่อยวางและกินอาหารเป็นเวลา",
  "ทอง": "ในเชิงพฤติกรรม คนดิถีทองมักเคร่งเครียดกับความสมบูรณ์แบบและกฎเกณฑ์ จนเก็บกดอารมณ์ ทำให้ปอด ลำไส้ และผิวหนังอ่อนไหว ควรหัดระบายความรู้สึกและอยู่ในที่อากาศถ่ายเท",
  "น้ำ": "ในเชิงพฤติกรรม คนดิถีน้ำมักใช้ความคิดหนักและเก็บความรู้สึกไว้ภายใน คิดเยอะจนเครียดและอ่อนเพลีย กระทบไต ระบบขับถ่าย และฮอร์โมน ควรพักสมองและไม่ครุ่นคิดเกินพอดี",
};

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
      segments.push(`ธาตุ${element}มากเกินไป: ${K("EXCESS_HEALTH_TH", EXCESS_HEALTH_TH)[element]}`);
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
  // (2c) มิติพฤติกรรม→อาการ ตามธาตุดิถี (เลียนโครง your life code: นิสัยนำไปสู่อาการ)
  const behavior = K("ELEMENT_HEALTH_BEHAVIOR_TH", ELEMENT_HEALTH_BEHAVIOR_TH)[
    elementLabel(dayMasterElement(calculatedState))
  ];
  if (behavior) {
    segments.push(behavior);
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
export const WEALTH_SOURCE_TH: Record<PillarKey, string> = {
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

/** กลุ่มของย่อหน้าโชคลาภ → ใช้จัดกล่อง (box) บท 3: เนื้อหลัก / สิ่งพึงระวัง / ข้อเสนอแนะ
 *  timing = จังหวะการเงินตามวัย (อายุ/ปีชง) — คงไว้ใน prose แต่ "ตัดออกจากกล่อง" (ซินแสสั่ง: เรื่องอายุไปบท 12) */
type WealthSegmentGroup = "main" | "caution" | "advice" | "timing";
type WealthSegment = { text: string; group: WealthSegmentGroup };

/**
 * เก็บย่อหน้าคำทำนายโชคลาภพร้อม "tag กลุ่ม" ตามลำดับเดิม — ใช้ร่วมกัน 2 ทาง:
 *  prose path (buildWealthReading) = ต่อ text ตามลำดับเดิมเป๊ะ (output ไม่เปลี่ยน → test เดิมเขียว)
 *  box path (buildWealthBoxes) = แยกเข้ากล่องตามหัวข้อย่อย docx (เนื้อหลัก/ระวัง/เสนอแนะ)
 */
function collectWealthSegments(calculatedState: CalculatedStateValue): WealthSegment[] {
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
    sources.add(K("WEALTH_SOURCE_TH", WEALTH_SOURCE_TH)[pillar]);
    for (const c of cells) {
      const meaning = K("QI_WEALTH_TH", QI_WEALTH_TH)[c.primaryQi];
      if (!meaning) {
        continue;
      }
      const amp =
        selfSeatQi && selfSeatQi !== c.primaryQi
          ? ` ขยายด้วยเซียงแซ ${selfSeatQi} (~20%)`
          : selfSeatQi
            ? ` (ตัวแรกซ้อนตัวขยายเป็น ${selfSeatQi} เหมือนกัน ยิ่งตอกย้ำแนวโน้มนี้)`
            : "";
      // กรณีพิเศษ (ตามคำกำชับซินแซ): ทอ ที่ขยายด้วย ตี้อ๋วง = ต่อยอดลาภเป็นการลงทุนกองทุน/หุ้นกลุ่มธาตุลาภ
      const comboNote =
        c.primaryQi === "ทอ" && selfSeatQi === "ตี้อ๋วง"
          ? " หรือต่อยอดด้วยการลงทุนกองทุนรวม/หุ้นในกลุ่มธาตุลาภ เทคโนโลยี และพลังงาน"
          : "";
      positionWealthLines.push(
        `• ${K("WEALTH_SOURCE_TH", WEALTH_SOURCE_TH)[pillar]} ${c.place} ${c.symbol} → ${c.primaryQi} (~80%)${amp} / ${WEALTH_VISIBILITY[pillar]}: ${meaning}${comboNote}`,
      );
    }
  }

  const segments: WealthSegment[] = [];
  const push = (text: string, group: WealthSegmentGroup = "main") =>
    segments.push({ text, group });

  // (1) กำลังดาวลาภ
  if (wealthStrength === "strong") {
    push(`ดวงนี้ดาวโชคลาภ (ธาตุ${wealthLabel}) แข็งแรง มีโอกาสและช่องทางการเงินที่ดีอยู่ในดวง`);
  } else if (wealthStrength === "weak" || wealthStrength === "missing") {
    push(`ดาวโชคลาภ (ธาตุ${wealthLabel}) ไม่เด่น โอกาสการเงินมักต้องสร้างขึ้นเองเป็นจังหวะ มากกว่าจะลอยมาเอง`);
  } else {
    push(`ดาวโชคลาภ (ธาตุ${wealthLabel}) มีกำลังปานกลาง ค่อย ๆ สะสมได้ตามความสม่ำเสมอ`);
  }

  // (1a) จังหวะการเงิน ณ ปัจจุบัน (YLC style) — ผูกอายุจริง + ปี/เดือนชง
  // group "timing" → คงใน prose แต่ตัดออกจากกล่อง (ซินแสสั่ง: เรื่องช่วงอายุไปอยู่บท 12)
  const wealthTiming = buildCurrentTimingLines(calculatedState);
  if (wealthTiming.length > 0) {
    push(`จังหวะการเงินตามวัย (ดูช่วงที่กำลังเดินและจังหวะที่ต้องระวัง):\n${wealthTiming.join("\n")}`, "timing");
  }

  // (1b) Market Target ตามที่ซินแซกำชับ = ผสมธาตุ "ราศีบนปี + ราศีล่างปี" เป็นกลุ่มลูกค้า
  //   ถ้าเซี่ยงแซเสาปี "ดี" → ทายกลุ่มลูกค้านั้นตรง ๆ; ถ้า "เสีย" → พลิกหาด้านดีของกลุ่มนั้นมาทาย
  const yearStemEl = elementLabel(stemElement(calculatedState.fourPillars.year.stem));
  const yearBranchEl = elementLabel(branchElement(calculatedState.fourPillars.year.branch));
  const yearMarketQi = resolveDisplayTwelveQiStage(
    calculatedState.fourPillars.year.stem,
    calculatedState.fourPillars.year.branch,
  );
  const marketGroups =
    yearStemEl === yearBranchEl
      ? `กลุ่มธาตุ${yearBranchEl} — ${K("YEAR_CUSTOMER_TH", YEAR_CUSTOMER_TH)[yearBranchEl] ?? "กลุ่มคนรอบตัวและสังคมภายนอก"}`
      : `กลุ่มธาตุ${yearStemEl} (${K("YEAR_CUSTOMER_TH", YEAR_CUSTOMER_TH)[yearStemEl] ?? "กลุ่มคนรอบตัว"}) ผสมกับกลุ่มธาตุ${yearBranchEl} (${K("YEAR_CUSTOMER_TH", YEAR_CUSTOMER_TH)[yearBranchEl] ?? "กลุ่มสังคมภายนอก"})`;
  const marketTone = BAD_QI.has(yearMarketQi)
    ? `เสาปีขึ้นเชี่ยงแซ ${yearMarketQi} (สภาวะไม่เด่น) — ให้ดึง “ด้านดี” ของลูกค้ากลุ่มนี้มาทำตลาด`
    : GOOD_QI.has(yearMarketQi)
      ? `เสาปีขึ้นเชี่ยงแซ ${yearMarketQi} (สภาวะดี) — ทายกลุ่มลูกค้านี้ได้ตรง ๆ เต็มที่`
      : `เสาปีขึ้นเชี่ยงแซ ${yearMarketQi}`;
  push(
    `แหล่งโชคลาภที่แท้จริง / กลุ่มลูกค้าที่นำเงินเข้าหาดวงนี้ (Market Target — ผสมธาตุราศีบนปี ${calculatedState.fourPillars.year.stem} + ราศีล่างปี ${calculatedState.fourPillars.year.branch}): ${marketGroups} — ${marketTone}`,
  );

  // (2) ที่ทรัพย์ปรากฏในดวง (ตำแหน่งดาวลาภ) + อ่านแต่ละตำแหน่งตาม 12 เชี่ยงแซ
  if (sources.size > 0) {
    const header = `ที่ทรัพย์ปรากฏในดวง (ดาวลาภ ธาตุ${wealthLabel}) ที่ ${[...sources].join(" และ ")} — อ่านความหมายแต่ละตำแหน่ง:`;
    push(positionWealthLines.length > 0 ? `${header}\n${positionWealthLines.join("\n")}` : `ดาวลาภปรากฏที่ ${[...sources].join(" และ ")}`);
  } else {
    // (2b) ไม่มีธาตุลาภโผล่เป็นตัวหลัก → ดูลาภแฝง: น้ำแฝงในกิ่ง + ไฉ่โข่ว + วัยจร
    const hiddenWealthPillars = (["year", "month", "day", "hour"] as PillarKey[]).filter((pillar) => {
      const branch = calculatedState.fourPillars[pillar].branch;
      const hidden = BRANCH_HIDDEN_STEMS[branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [];
      return hidden.some((stem) => stemElement(stem) === wealth);
    });
    const where = hiddenWealthPillars.map((pillar) => PILLAR_LABEL_TH[pillar]).join(" และ ");
    push(
      `ดวงนี้ไม่มีธาตุลาภ (ธาตุ${wealthLabel}) โผล่เป็นตัวหลัก จึงดู “ลาภแฝง” แทน${
        where ? ` — มีธาตุลาภแฝงอยู่ในกิ่งที่${where} (ราศีแฝง) ลาภจึงมาแบบไม่เปิดเผย ค่อย ๆ สะสม` : ""
      }`,
    );
    push(
      "*สำคัญ: ดิถีกึ่งแข็งกึ่งอ่อนที่ไม่มีธาตุลาภในดวง ความร่ำรวยจะอยู่ที่ “วัยจร” เป็นหลัก — ช่วงวัยจรที่ดาวลาภเข้ามาดี = รวยขึ้นชัดเจน; ระหว่างที่ยังไม่มีลาภเข้า ถ้าขยันทำงาน (ดาวถ่ายเท) ก็ยังมีกินมีใช้เสมอ มากน้อยขึ้นกับจังหวะวัยจร",
    );
  }

  // (3) ลักษณะลาภผล — ดิถีอ่อน=รายได้สะสมต่อเนื่อง (passive); ดิถี"แข็งมาก"(従强 印比ครอบงำ ไม่มีดาวลาภเด่น)
  // ก็เน้น passive เช่นกัน (your life code: สิริกัญญา 壬แข็งมาก → passive income); ดิถีแข็ง/สมดุล=คว้าเงินก้อน
  const passiveIncomeStyle = dmWeak || band === "very-strong";
  push(
    passiveIncomeStyle
      ? "ลักษณะลาภผล: เด่นเรื่องรายได้แบบสะสมต่อเนื่อง (passive income) เช่น ค่าเช่า เงินเดือน ค่าคอมมิชชัน หรือรายได้ประจำหลายทางรวมกัน เริ่มทีละน้อยแล้วทบเป็นก้อนใหญ่ มากกว่าการเสี่ยงเงินก้อนครั้งเดียว"
      : "ลักษณะลาภผล: เหมาะกับการคว้าเงินก้อนจากการลงทุนหรือธุรกิจที่ลงมือทำเอง กล้าตัดสินใจในจังหวะที่มั่นใจ",
  );

  // (4) ดิถีอ่อน → ต้องพยายามมากกว่าจะคว้าโอกาสเป็นผล + โฟกัสสิ่งที่ถนัดที่สุด + เหมาะงานนายหน้า/ตัวกลาง
  // (จัดเป็น "สิ่งพึงระวัง" ในกล่อง box — ความเสี่ยงจมทุน/เป็นหนี้ของดิถีอ่อน)
  if (dmWeak) {
    push(
      "แต่เพราะดิถีอ่อน จึงต้องใช้แรงกาย แรงใจ และความพยายามมากกว่าคนอื่นในการเปลี่ยนโอกาสให้กลายเป็นผลลัพธ์จริง — เงื่อนไขสำคัญคือต้องโฟกัสสิ่งที่ตนถนัดและเชี่ยวชาญที่สุดเพียงทางเดียว ไม่ทำหลายอย่างพร้อมกัน",
      "caution",
    );
    push(
      "ด้วยดิถีอ่อน เหมาะกับงานนายหน้า ตัวกลาง หรือเชื่อมโยงคนเข้าหากัน ที่ใช้ทุนต่ำมากกว่าการสต๊อกสินค้าก้อนใหญ่ เพราะการลงทุนหนักในสินค้าเสี่ยงจมทุนหรือเป็นหนี้ได้ง่าย",
      "caution",
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
    push(
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
      push(
        `ดวงนี้มี “ไฉ่โข่ว” (财库 คลังทรัพย์ธาตุ${wealthLabel}) ที่${where} — มีดวงเก็บสะสมทรัพย์เป็นกอบเป็นกำ มีคลังเงินไว้ใช้ยามจำเป็น` +
          (opened
            ? ` และคลังนี้ถูกชง (${vaultBranch}-${opener}) = “เปิดคลัง” ทรัพย์ที่สะสมไว้จะได้นำออกมาใช้จริงเป็นช่วง ๆ`
            : ` คลังนี้จะเปิดให้ใช้ทรัพย์เต็มที่เมื่อมีปีจร/วัยจรกิ่ง ${opener} เข้ามาชงเปิดคลัง`),
      );
    }
  }

  // (4b-3) การเงิน 1.4: ขุมคลังถูกทำลาย — ถ้ามีก้าน "ตัวรั่ว" ของดิถีอยู่ในผัง (ก้านเห็น หรือราศีแฝง) → เก็บเงินไม่อยู่
  const vaultDamage = parseWealthVaultDamage();
  const damageList = vaultDamage?.get(calculatedState.dayMaster);
  if (damageList && damageList.length > 0) {
    const chartStems = new Set<string>();
    for (const pillar of ["year", "month", "day", "hour"] as PillarKey[]) {
      const value = calculatedState.fourPillars[pillar];
      chartStems.add(value.stem);
      for (const hidden of BRANCH_HIDDEN_STEMS[value.branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? []) {
        chartStems.add(hidden);
      }
    }
    const hits = damageList.filter((entry) => chartStems.has(entry.stem));
    for (const hit of hits) {
      // ผั่วไฉ่โข่ว (破财库 คลังทรัพย์ถูกทำลาย) = แก่นของ "สิ่งพึงระวัง" บท 3
      push(`ขุมคลังถูกทำลาย (มีก้าน ${hit.stem} ในผัง): ${hit.effect} — ควรวางระบบเก็บออม/กันรายจ่ายให้รัดกุมเป็นพิเศษ`, "caution");
    }
  }

  // (4c) ลูกค้า/รายได้จากคนรุ่นน้อง — ดาวถ่ายเท (食傷) สร้างลาภ (食傷生财) เมื่อมีดาวถ่ายเทในดวง
  const output = GENERATES[dm] as SupportedElementValue;
  const hasOutput = (["year", "month", "day", "hour"] as PillarKey[]).some((pillar) => {
    const value = calculatedState.fourPillars[pillar];
    return stemElement(value.stem) === output || branchElement(value.branch) === output;
  });
  if (hasOutput) {
    push(
      "ช่องทางลาภเด่นแบบ “ดาวถ่ายเทสร้างลาภ” (食傷生财) คือใช้ทักษะ/บริการดึงเงิน กลุ่มลูกค้าที่นำทรัพย์เข้ามามักเป็นคนอายุน้อยกว่า รุ่นน้อง หรือผู้ที่ต้องการการดูแลเอาใจใส่",
    );
  }

  // (5) ช่วง "ช่วงวัยแห่งโชคลาภ" (อายุ/ช่วงเวลา) ถูกตัดออกจากบทนี้ตามคำกำชับซินแซ
  //     เรื่องจังหวะอายุไปอยู่รวมในบท 12 (Key Turning Points) แล้ว

  // (6) แนบหลักการตามตำรา (wealth.txt) ถ้ามี
  const bookLine = parseWealthByBand()?.get(band);
  if (bookLine) {
    push(`หลักการตามตำรา: ${bookLine}`);
  }

  return segments;
}

function buildWealthReading(calculatedState: CalculatedStateValue): string | null {
  const segments = collectWealthSegments(calculatedState);
  return segments.length > 0 ? segments.map((segment) => segment.text).join("\n\n") : null;
}

/**
 * หัวข้อย่อยของบท 3 "โชคลาภที่ถูกทาง" ตาม docs/ทายดวง 15 หัวข้อ.docx
 * 3 กล่อง: ทายโชคลาภ (ดิถี→ถ่ายเท→โชคลาภ + 12 เชี่ยงแซ) / สิ่งพึงระวัง (ผั่วไฉ่โข่ว) / ข้อเสนอแนะ
 */
const WEALTH_SUBTOPICS = {
  fortune: "ทายโชคลาภ (ดิถี → ธาตุถ่ายเท → ธาตุโชคลาภ)",
  caution: "สิ่งพึงระวัง (ผั่วไฉ่โข่ว / กึ่งผั่วไฉ่โข่ว)",
  advice: "ข้อเสนอแนะ (เพิ่มเงินเก็บ ลดรายจ่าย)",
} as const;

/**
 * บท 3 (โชคลาภ) ฉบับ "กล่อง" ตาม docs/ทายดวง 15 หัวข้อ.docx — reuse collectWealthSegments เดิม
 * (ข้อเท็จจริง/ลำดับคงเดิม) จัดเข้า 3 กล่อง: เนื้อหลัก (นำด้วยสายโซ่ธาตุ) / สิ่งพึงระวัง / ข้อเสนอแนะ
 */
function buildWealthBoxes(calculatedState: CalculatedStateValue): string | null {
  const segments = collectWealthSegments(calculatedState);
  if (segments.length === 0) {
    return null;
  }
  const pick = (group: WealthSegmentGroup) =>
    segments.filter((segment) => segment.group === group).map((segment) => segment.text);

  const dm = dayMasterElement(calculatedState);
  const dmElementTh = elementLabel(dm);
  const outputElTh = elementLabel(GENERATES[dm] as SupportedElementValue);
  const wealthElTh = elementLabel(CONTROLS[dm] as SupportedElementValue);
  // ย่อหน้านำกล่องแรก = สายโซ่ธาตุตามชื่อหัวข้อย่อย docx (ดิถี → ถ่ายเท → โชคลาภ)
  const chainLead = `อ่านโชคลาภเป็นสายโซ่: ดิถี (ธาตุ${dmElementTh}) → การกระทำ/สิ่งที่ลงมือ (ธาตุถ่ายเท ${outputElTh}) → ผลลัพธ์/โชคลาภ (ธาตุ${wealthElTh}) — ดูว่าธาตุโชคลาภปรากฏที่ตำแหน่งใดในผัง แล้วอ่านความหมายตาม 12 เชี่ยงแซของแต่ละตำแหน่ง`;

  // ในกล่อง: ตัดเลข % กำกับ (~80%/~20%) ออกให้อ่านกระชับ (ซินแสสั่ง) — pick("main") ไม่รวม timing แล้ว
  const stripPercent = (text: string) => text.replace(/\s*\(~\d+%\)/g, "");
  const fortuneBox = readingBox(WEALTH_SUBTOPICS.fortune, [chainLead, ...pick("main").map(stripPercent)]);
  const cautionBox = readingBox(WEALTH_SUBTOPICS.caution, pick("caution"));
  const adviceBox = readingBox(WEALTH_SUBTOPICS.advice, [
    ...pick("advice"),
    buildChapterAdvice(calculatedState, "wealth_and_investment"),
  ]);

  const boxes = [fortuneBox, cautionBox, adviceBox].filter((box) => box.length > 0);
  return boxes.length > 0 ? boxes.join("\n\n") : null;
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
    // ขึ้นต้น "- " เพื่อให้ renderMarkdown (PDF) และ markdownParagraphs (docx) จัดเป็น bullet ทีละช่วงอายุ
    return `- อายุ ${ageRange} ปี (พ.ศ. ${beRange} / ค.ศ. ${yearRange}, ${RELATION_ROLE_SHORT[first.role]}${qiText}): ${verdict}`;
  });

  // ย่อหน้านำ + บรรทัดว่าง แล้วตามด้วยลิสต์ (แต่ละ bullet คั่นด้วย \n เดี่ยว — อยู่ในบล็อกลิสต์เดียวกัน)
  return `${lead}\n\n${lines.join("\n")}`;
}

// ความหมายของเสาในตารางเส้นขีดวัยจร (8 ตัว) — วัยจรเทียบทีละตัวตามความหมายของเสา
const DAYUN_DIMENSION_TH: Record<PillarKey, string> = {
  year: "ลูกค้า/สังคม/ผู้ใหญ่",
  month: "การงาน/พ่อแม่/ธุรกิจ",
  day: "ภาพรวมตัวเองและคู่",
  hour: "สิ่งที่ทำ/บริวาร/รุ่นน้อง",
};

export const QI_TIER_OUTCOME_TH: Record<QiTier, string> = {
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
    lines.push(`${DAYUN_DIMENSION_TH[pillar]} (${parts.join(", ")}): ${K("QI_TIER_OUTCOME_TH", QI_TIER_OUTCOME_TH)[worstTier]}`);
  }
  return lines.length > 0
    ? `เจาะวัยจรปัจจุบัน (${daYunStem}${current.branch}) เทียบทีละตัวอักษรในผังตามความหมายของเสา:\n${lines.join("\n")}`
    : "";
}

// แปลงเกรดวัยจร ([ยุคทอง]/[โอกาสมาพร้อมภาระ]/[เฝ้าระวัง]/[จังหวะดี]) เป็นไอคอนดาว 4 ระดับ
// (ตามคำกำชับซินแซ): ⭐⭐⭐ ยุคทอง · ⭐⭐ โอกาสมาพร้อมภาระ/จังหวะดี · ⭐ เฝ้าระวัง · ◇ ช่วงทั่วไป
const LUCK_GRADE_STARS: Record<string, string> = {
  "ยุคทอง": "⭐⭐⭐",
  "โอกาสมาพร้อมภาระ": "⭐⭐",
  "จังหวะดี": "⭐⭐",
  "เฝ้าระวัง": "⭐",
};
function luckGradeToStars(verdict: string): string {
  const matched = verdict.match(/^\[([^\]]+)\]\s*/);
  if (matched && LUCK_GRADE_STARS[matched[1]]) {
    return `${LUCK_GRADE_STARS[matched[1]]} ${verdict.slice(matched[0].length)}`;
  }
  // ไม่มี tag = ช่วงทั่วไป/ทุ่มแรงไม่เป็นชิ้นเป็นอัน
  return `◇ ${verdict}`;
}

// ราศีล่าง → ชื่อเดือนนักษัตร + เดือนสากลโดยประมาณ (ใช้เตือน "เดือนชง" ประจำปี)
const BRANCH_MONTH_TH: Record<string, string> = {
  寅: "ขาล (ราวกุมภาพันธ์)", 卯: "เถาะ (ราวมีนาคม)", 辰: "มะโรง (ราวเมษายน)",
  巳: "มะเส็ง (ราวพฤษภาคม)", 午: "มะเมีย (ราวมิถุนายน)", 未: "มะแม (ราวกรกฎาคม)",
  申: "วอก (ราวสิงหาคม)", 酉: "ระกา (ราวกันยายน)", 戌: "จอ (ราวตุลาคม)",
  亥: "กุน (ราวพฤศจิกายน)", 子: "ชวด (ราวธันวาคม)", 丑: "ฉลู (ราวมกราคม)",
};

/**
 * จังหวะเวลาผูกกับ "ปัจจุบัน" (YLC style) — อายุจริง + ปีชง + เดือนชง
 * deterministic: อายุ/ปีจรมาจาก calculatedState (ageSnapshot.referenceDate + liuNianSeries)
 * ไม่พึ่งวัน-เวลาเครื่อง → รันซ้ำได้ผลเดิม
 */
function buildCurrentTimingLines(calculatedState: CalculatedStateValue): string[] {
  const out: string[] = [];
  const age = calculatedState.ageSnapshot?.chineseAge;
  const current = findCurrentDaYunPhase(calculatedState);
  // (a) อายุปัจจุบัน + วัยจรที่กำลังเดิน
  if (age && current) {
    const dm = dayMasterElement(calculatedState);
    const band = resolveStrengthBand(calculatedState);
    const role = resolveRelationRole(dm, current.element);
    const startAge = Number.parseInt(current.ageRange, 10);
    const verdict = buildLuckPhaseVerdict(band, role, current.qi, Number.isNaN(startAge) ? undefined : startAge);
    out.push(
      `ปัจจุบันคุณอายุ ${age} ปี (นับแบบจีน) กำลังเดินวัยจร ${current.symbol} (ธาตุ${elementLabel(current.element)} เป็น${RELATION_ROLE_SHORT[role]}${current.qi ? ` → ${current.qi}` : ""}): ${luckGradeToStars(verdict)}`,
    );
  }
  // (b) ปีชง/ฮะ — สแกนปีจร 20 ปีข้างหน้า เทียบกิ่งหลักวัน (จำกัด 3 ปีใกล้สุด)
  const dayBranch = calculatedState.fourPillars.day.branch;
  const clashBranch = BRANCH_OPPOSITE[dayBranch];
  const harmPair = HAI_PAIRS.find(([a, b]) => a === dayBranch || b === dayBranch);
  const harmBranch = harmPair ? (harmPair[0] === dayBranch ? harmPair[1] : harmPair[0]) : undefined;
  const clashYears = (calculatedState.liuNianSeries ?? [])
    .filter((y) => y.branch === clashBranch || y.branch === harmBranch)
    .slice(0, 3);
  for (const y of clashYears) {
    const kind = y.branch === clashBranch ? "ชง (冲)" : "ฮะ/ให้ร้าย (害)";
    out.push(
      `ปี พ.ศ. ${y.year + 543} (อายุ ${y.age} ปี) เป็นจังหวะ ${kind} กับหลักวัน (${y.branch}-${dayBranch}) — ควรระวังการเงิน การตัดสินใจเสี่ยง และความขัดแย้งเป็นพิเศษ`,
    );
  }
  // (c) เดือนชงประจำปี (เกิดซ้ำทุกปี)
  if (clashBranch && BRANCH_MONTH_TH[clashBranch]) {
    out.push(
      `เดือนนักษัตร${BRANCH_MONTH_TH[clashBranch]} ของทุกปี เป็นจังหวะปะทะ (ชง) กับหลักวัน ควรระมัดระวังการเงินและการตัดสินใจในช่วงนี้`,
    );
  }
  return out;
}

function buildLuckCycleReading(calculatedState: CalculatedStateValue): string | null {
  // ทายตั้งแต่ "วัยจรแรก" จนถึงบั้นปลาย — ตามคำกำชับซินแซ (เดิมเริ่มที่ช่วงปัจจุบัน)
  const rows = buildRelationshipLinesMapping(calculatedState);
  if (rows.length === 0) {
    return null;
  }
  const current = findCurrentDaYunPhase(calculatedState);

  const lead =
    "วิเคราะห์จังหวะชีวิตตั้งแต่วัยจรแรกจนถึงบั้นปลาย โดยดูบทบาทธาตุของวัยจรควบคู่สภาวะ 12 เชี่ยงแซเทียบดิถี — เกรดแต่ละช่วง: ⭐⭐⭐ ยุคทอง (รุกเต็มที่) · ⭐⭐ โอกาสมาพร้อมภาระ (รุกแต่ต้องหาคนช่วย) · ⭐ เฝ้าระวัง (ตั้งรับ) · ◇ ช่วงทั่วไป";

  const lines = rows.map((row) => {
    const tag = current && row.ageRange === current.ageRange ? " ◆ ช่วงปัจจุบัน" : "";
    return `อายุ ${row.ageRange}${tag} (${row.symbol} — ${row.relationLine}): ${luckGradeToStars(row.deepNote)}`;
  });

  // ปีจรปัจจุบัน (liu nian) — เน้นจังหวะของ "ปีนี้" ทับบนภาพวัยจร
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
    liuNianLine = `ปีจรปัจจุบัน (${liuNian.stem}${liuNian.branch} ธาตุ${elementLabel(lnElement)} เป็น${lnRole}${lnQi ? ` → ${lnQi}` : ""}): ${luckGradeToStars(lnVerdict)}`;
  }

  // จังหวะปัจจุบัน (อายุจริง + ปี/เดือนชง) + พยากรณ์ปีจรรายปี 20 ปีข้างหน้า (YLC style)
  const timing = buildCurrentTimingLines(calculatedState);
  const timingBlock = timing.length > 0 ? `จังหวะ ณ ปัจจุบัน:\n${timing.join("\n")}` : "";
  const yearly = buildLiuNianYearlyForecast(calculatedState);

  return [lead, timingBlock, ...lines, liuNianLine, yearly].filter(Boolean).join("\n\n");
}

// ───────── Rev6: ตารางวิเคราะห์เส้นขีดความสัมพันธ์ หมวดวัยจร (Relationship Lines Mapping, อ้างอิงตำราเคี้ยงคุง) ─────────

export type RelationshipLineRow = {
  ageRange: string;
  symbol: string;
  /** เส้นขีดที่ทำงาน เช่น "ถ่ายเท → เชี่ยงแซ" */
  relationLine: string;
  /** คำอธิบายดี-ร้ายเชิงลึก (บทบาทธาตุ × 12 เชี่ยงแซ × ดิถีแข็ง-อ่อน × วัย) */
  deepNote: string;
  /** true = ขึ้นหน้าใหม่ก่อนแถวนี้ในตารางบทเสริม (PDF/Word/พรีวิว) — ต้องตรงกับ TopicCard.RelationshipLineRow */
  pageBreakBefore?: boolean;
};

const RELATION_ROLE_SHORT: Record<RelationRole, string> = {
  "คู่ธาตุ": "คู่ธาตุ",
  "ธาตุถ่ายเท": "ถ่ายเท",
  "ธาตุพิฆาต": "ลาภ (ดิถีพิฆาต)",
  "พิฆาตธาตุ": "อำนาจ (พิฆาตดิถี)",
  "ธาตุส่งเสริม": "ส่งเสริม",
};

// ───────── คำอธิบายดี-ร้ายเชิงลึก = บทบาทธาตุ × คุณภาพ 12 เชี่ยงแซ × ดิถีแข็ง-อ่อน ─────────
// อ้างตำราเคี้ยงคุง: "คิดดิถีแข็งอ่อน ควบคู่ปฏิกิริยา (12 เชี่ยงแซ) เสมอ"

/** ผลลัพธ์ดี/ร้ายของบทบาทธาตุวัยจร (วัยทำงาน) — ใช้เจาะจง verdict ตาม role ของแต่ละช่วง */
type RoleOutcome = { good: string; bad: string };
const ROLE_OUTCOME_TH: Record<RelationRole, RoleOutcome> = {
  "คู่ธาตุ": {
    good: "เพื่อน พี่น้อง หุ้นส่วน และคนรอบตัวคอยหนุนและร่วมมือ",
    bad: "คนรอบตัวกลายเป็นภาระหรือแย่งทรัพยากร",
  },
  "ธาตุส่งเสริม": {
    good: "ผู้ใหญ่ ความรู้ และแรงหนุนหลังเข้ามาเสริมกำลัง",
    bad: "ผู้ใหญ่และที่พึ่งอ่อนแรงหรือหายไป",
  },
  "ธาตุถ่ายเท": {
    good: "ผลงาน ทักษะ และความคิดได้แสดงออกเด่นชัด",
    bad: "ทุ่มแรงกับงานจนเหนื่อยล้า ผลไม่เป็นชิ้นเป็นอัน",
  },
  "ธาตุพิฆาต": {
    good: "โอกาสโชคลาภและทรัพย์สินไหลเข้า",
    bad: "รายจ่ายและการสูญเสียทรัพย์ตามมา เก็บไม่อยู่",
  },
  "พิฆาตธาตุ": {
    good: "หน้าที่ ตำแหน่ง และความรับผิดชอบก้าวหน้า",
    bad: "แรงกดดันและภาระหน้าที่หนักขึ้น",
  },
};

// วัยเรียน (ไม่เกิน 20 ปี): การงาน/ถ่ายเท = "การเรียน", โชคลาภ = "เรื่องผลการเรียน" (อ้างตำราเคี้ยงคุง)
const SCHOOL_AGE_MAX = 20;
const ROLE_OUTCOME_SCHOOL_TH: Record<RelationRole, RoleOutcome> = {
  "คู่ธาตุ": {
    good: "เพื่อนและกลุ่มเรียนคอยช่วยเหลือกัน",
    bad: "เพื่อนพากันเขวหรือดึงให้เสียการเรียน",
  },
  "ธาตุส่งเสริม": {
    good: "ครู ความรู้ และผู้ใหญ่หนุนการเรียน",
    bad: "ขาดที่ปรึกษาและแรงหนุนด้านการเรียน",
  },
  "ธาตุถ่ายเท": {
    good: "การเรียนและการฝึกทักษะก้าวหน้าเห็นผล",
    bad: "การเรียนหนักแต่ผลไม่นิ่ง เหนื่อยล้า",
  },
  "ธาตุพิฆาต": {
    good: "ผลการเรียนและโอกาสทางการศึกษาไปได้ดี",
    bad: "ผลการเรียนสะดุด ต้องตั้งใจให้สม่ำเสมอ",
  },
  "พิฆาตธาตุ": {
    good: "มีวินัยและรับมือการสอบได้ดี",
    bad: "แรงกดดันจากการเรียนและการสอบหนัก",
  },
};

/** flatten role×{good,bad} → "role|good"/"role|bad" สำหรับ catalog (อ่านจริงผ่าน roleOutcome) */
function flattenRoleOutcome(table: Record<RelationRole, RoleOutcome>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(table).flatMap(([role, outcome]) => [
      [`${role}|good`, outcome.good],
      [`${role}|bad`, outcome.bad],
    ]),
  );
}
export const ROLE_OUTCOME_FLAT_TH = flattenRoleOutcome(ROLE_OUTCOME_TH);
export const ROLE_OUTCOME_SCHOOL_FLAT_TH = flattenRoleOutcome(ROLE_OUTCOME_SCHOOL_TH);

/** อ่าน RoleOutcome ผ่าน overlay (แก้ดี/ร้ายได้รายช่อง) — tableId แยกตามวัยเรียน/วัยทำงาน */
function roleOutcome(isSchool: boolean, role: RelationRole): RoleOutcome {
  const tableId = isSchool ? "ROLE_OUTCOME_SCHOOL_TH" : "ROLE_OUTCOME_TH";
  const base = (isSchool ? ROLE_OUTCOME_SCHOOL_TH : ROLE_OUTCOME_TH)[role];
  return {
    good: KC(tableId, base?.good ?? "", role, "good"),
    bad: KC(tableId, base?.bad ?? "", role, "bad"),
  };
}

type QiTier = "rising" | "transitional" | "falling";

// 12 เชี่ยงแซ — น้ำหนัก 3 ระดับ ตามที่ซินแซกำชับ:
//  ตัวดี (~80-90% บวก): เชี่ยงแซ กวงตั่ว ลิ่มกัว ตี้อ๋วง
//  ตัวกลาง 50/50 (ทายทั้งบวก-ลบ): หมกยก แป่ + ทอ เอี๊ยง หมอ (ผันผวน/เปลี่ยนผ่าน)
//  ตัวเสีย (~80% ลบ): ซวย ซี่ เจ๊าะ — โดย "เจ๊าะ/ซวย" น่ากลัวสุด (โรคเรื้อรัง/เสียหนัก = ดอกจัน 3 ดอก)
const RISING_QI = new Set(["เชี่ยงแซ", "กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง"]);
const FALLING_QI = new Set(["ซวย", "ซี่", "เจ๊าะ"]);
// เซ็งแซเสียขั้นรุนแรง — ทำเครื่องหมายดอกจันเตือนเป็นพิเศษ (โรคเรื้อรัง/ความเสียหายยืดเยื้อ)
const SEVERE_QI = new Set(["เจ๊าะ", "ซวย"]);

function classifyQiTier(qi: string): QiTier {
  if (RISING_QI.has(qi)) {
    return "rising";
  }
  if (FALLING_QI.has(qi)) {
    return "falling";
  }
  return "transitional"; // หมกยก, แป่ (50/50), ทอ, เอี๊ยง, หมอ
}

/** เครื่องหมายเตือนระดับความรุนแรงของเซ็งแซ (ดอกจัน 3 ดอก = เจ๊าะ/ซวย) */
function qiSeverityMark(qi: string): string {
  return SEVERE_QI.has(qi) ? " ***" : "";
}

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

// ผลลัพธ์ดี-ร้ายราย "บทบาทธาตุ" (B): frame ตาม effect×tier แล้วเสียบ good/bad ของ role นั้น
// (A): ไม่พูดซ้ำสภาวะ qi — ปล่อยให้คอลัมน์ relationLine แสดง qi ส่วน deepNote โฟกัสความหมายดี-ร้าย
const VERDICT_FRAME: Record<
  "support" | "drain" | "neutral",
  Record<QiTier, (o: RoleOutcome) => string>
> = {
  support: {
    rising: (o) => `[ยุคทอง] ${o.good}อย่างเต็มที่ ดิถีมีกำลัง ควรรุกและคว้าโอกาสให้สุด`,
    transitional: (o) => `${o.good} แต่ยังไม่นิ่ง ต้องประคองและเลือกที่พึ่งให้ดี`,
    falling: (o) => `[เฝ้าระวัง] ${o.bad} ต้องพึ่งตัวเองและตั้งรับ`,
  },
  drain: {
    rising: (o) => `[โอกาสมาพร้อมภาระ] ${o.good} แต่ดึงพลังดิถีให้เหนื่อยล้า ควรหาคนช่วยแบ่งเบา`,
    transitional: (o) => `${o.bad} คุมผลลัพธ์ให้เป็นชิ้นเป็นอันได้ยาก`,
    falling: (o) => `[เฝ้าระวัง] ${o.bad} เสี่ยงสุขภาพ/การเงินสะดุด ควรชะลอ`,
  },
  neutral: {
    rising: (o) => `[จังหวะดี] ${o.good} เดินหน้าตามแผนได้ ผลตอบแทนสมเหตุผล`,
    transitional: (o) => `${o.good}สลับกับอุปสรรค ควรยืดหยุ่นตามสถานการณ์`,
    falling: () => `ชะลอตัว ควรระมัดระวังและรักษาฐานเดิมเอาไว้`,
  },
};

/** คำอธิบายดี-ร้ายเชิงลึกของวัยจรหนึ่งช่วง (deterministic, ตามตำรา · A: ไม่ซ้ำ qi-state · B: เจาะจงราย role)
 *  startAge < 20 → ตีความบทบาทธาตุเป็นบริบท "การเรียน" (การงาน/โชคลาภ = เรื่องการเรียน)
 *  คิดราย "ช่วงในตัวเอง" ไม่สะสมข้ามวัยจร (ไม่ข้ามปี) */
function buildLuckPhaseVerdict(
  band: StrengthBand,
  role: RelationRole,
  qi: string,
  startAge = Number.POSITIVE_INFINITY,
): string {
  const outcome = roleOutcome(startAge < SCHOOL_AGE_MAX, role);
  const tier = classifyQiTier(qi);
  const verdict = VERDICT_FRAME[resolveRoleEffect(band, role)][tier](outcome);
  // เจ๊าะ/ซวย = เซ็งแซเสียขั้นรุนแรง → เตือนเรื่องโรคเรื้อรัง/ความเสียหายยืดเยื้อเป็นพิเศษ
  const severe = SEVERE_QI.has(qi)
    ? ` ${qiSeverityMark(qi).trim()} ระวังเป็นพิเศษ: ${qi}เป็นเซ็งแซเสียขั้นรุนแรง ปัญหามักเรื้อรัง/ยืดเยื้อและแก้ยาก`
    : "";
  return `${verdict}${severe}`;
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
  /** ถ้อยคำสำหรับวัยผู้ใหญ่ตอนปลาย (>= elderMinAge) — เช่น เรื่องคู่ ไม่ทายคนใหม่ */
  elder?: TimingLabels;
  /** เกณฑ์อายุที่เริ่มใช้ elder labels (default ELDER_AGE_MIN=55; งาน/หุ้นส่วนใช้ RETIREMENT_AGE=60) */
  elderMinAge?: number;
};

// วัยผู้ใหญ่ตอนปลาย: เลย 55 ปีไม่ทาย "มีคนใหม่" แต่ทาย "ดูแลคู่เดิม/ประคองกัน" (ตามคำกำชับซินแซ)
const ELDER_AGE_MIN = 55;
// วัยเกษียณ: เลย 60 ปีตัดเรื่องการงาน/ลงทุน เน้นสุขภาพ
const RETIREMENT_AGE = 60;

function formatTimingLine(
  phase: DaYunPhaseInfo,
  labels: TimingLabels,
  opts: TimingOptions,
): string {
  const useYouth = opts.youth && phase.startAge < SCHOOL_AGE_MAX;
  const useElder = opts.elder && phase.startAge >= (opts.elderMinAge ?? ELDER_AGE_MIN);
  const text = useElder
    ? opts.elder![phase.tier]
    : useYouth
      ? opts.youth![phase.tier]
      : labels[phase.tier];
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

  // ชั้นวิเคราะห์ดาวคู่ครอง (ตำราเคี้ยงคุง บทความรัก): ดิถีแข็ง-อ่อน × กำลังดาวคู่ครอง × จานคู่ (ราศีล่างหลักวัน)
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
    ? `ดาวคู่ครอง (ธาตุ${spouseLabel}) ปรากฏหลายตำแหน่งในดวง (${spouseCount} จุด) — มีโอกาสพบคนรักหรือมีผู้เข้ามาชอบได้บ่อยและมีตัวเลือกมาก ${gender === "male" ? "ฝ่ายชายมักมีผู้เข้ามาหลายคน" : "มักมีผู้เข้ามาจีบหลายคน"} ควรเลือกให้รอบคอบและระวังความสัมพันธ์ซับซ้อน เพราะธาตุคู่ครองมากต้องระวังเรื่องเจ้าชู้/มือที่สาม ควรรักษาศีลข้อ 3 และความซื่อสัตย์ต่อคู่ไว้ให้มั่น`
    : "";

  // ดิถีแข็ง/อ่อน × การประคองคู่ (ตามคำกำชับซินแซ): ดิถีอ่อนมักตามใจคู่มากเกินไป, ดิถีแข็งมักไม่ค่อยตามใจ
  const accommodateLine = dmWeak
    ? "ด้วยดิถีอ่อน มักเป็นฝ่ายยอมตามใจคู่มากเกินไปจนเสียจุดยืนของตัวเอง ควรรักษาความเป็นตัวเองและความมั่นใจไว้ให้สมดุล"
    : band === "strong" || band === "very-strong"
      ? "ด้วยดิถีแข็ง มักไม่ค่อยยอมตามใจคู่ ควรเปิดใจประนีประนอมและรับฟังอีกฝ่ายให้มากขึ้น ความสัมพันธ์จะราบรื่นกว่าเดิม"
      : "";

  // "ช่วงอายุที่เด่นเรื่องคู่/ความรัก" (ช่วงเวลา/วัยจร) ถูกตัดออกจากบทนี้ตามคำกำชับซินแซ
  // — เรื่องจังหวะอายุไปอยู่รวมในบท 12 (Key Turning Points) แล้ว

  const spouseRelationBlock = buildSpouseRelationNotes(calculatedState);
  const spouseRelationLine = spouseRelationBlock.length > 0 ? spouseRelationBlock.join("\n") : "";

  // คำทำนายคู่รักตามตำรา (คู่สมพงษ์ความรัก: 12เชี่ยงแซความรัก) ตามเซียงแซจานคู่ (ราศีล่างหลักวัน)
  const loverVerdict = parseCareerRelationVerdicts()?.get("lover")?.get(seatQi);
  const loverLine = loverVerdict ? `ลักษณะคู่รักตามตำรา (เซียงแซจานคู่ ${seatQi}): ${loverVerdict}` : "";

  return [base, dayPillarLine, dynamic, abundanceLine, accommodateLine, seat, loverLine, spouseRelationLine]
    .filter(Boolean)
    .join("\n\n");
}

/** บท 14 สี/ทิศ = สีตาม useful god + สีที่ควรเลี่ยง (officer) + สีกระเป๋า/รถ + ทิศมงคล */
/** สรรพคุณของสีตามธาตุ (ใช้ขยายลิสต์สีให้เป็นเหตุผล ไม่ใช่แค่รายชื่อสี) — เลียนโครง your life code */
export const ELEMENT_COLOR_BENEFIT_TH: Record<ThaiElement, string> = {
  "ไม้": "เสริมการเติบโต การเรียนรู้ การสื่อสาร และความเด็ดขาดในการตัดสินใจ",
  "ไฟ": "ดึงดูดโชคลาภ เสริมชื่อเสียง บารมี และความสำเร็จ",
  "ดิน": "เสริมความมั่นคง หนักแน่นน่าเชื่อถือ และการสะสมทรัพย์",
  "ทอง": "เสริมระเบียบวินัย ความเด็ดขาด การเงิน และการตัดสินใจ",
  "น้ำ": "เสริมสติปัญญา ไหวพริบ การเจรจา และการหมุนเวียนโอกาสใหม่ ๆ",
};

// รูปทรงสัญลักษณ์มงคลตาม 5 ธาตุ (อู่สิง: ไม้=ทรงสูง/แท่ง, ไฟ=สามเหลี่ยม, ดิน=สี่เหลี่ยมจัตุรัส, ทอง=วงกลม/วงรี, น้ำ=ทรงโค้งคลื่น)
export const ELEMENT_SHAPE_TH: Record<ThaiElement, string> = {
  "ไม้": "ทรงสูงโปร่ง/เสาแท่ง",
  "ไฟ": "สามเหลี่ยม/ทรงแหลม",
  "ดิน": "สี่เหลี่ยมจัตุรัส/ทรงเตี้ยหนา",
  "ทอง": "วงกลม/วงรี",
  "น้ำ": "ทรงโค้งมน/ลายคลื่น",
};

function buildColorsReading(calculatedState: CalculatedStateValue): string | null {
  const section = parseSource7ElementSection("2.1", 3);
  if (!section) {
    return null;
  }
  // เสริมดวง = ธาตุปรับดวง (เสริมดิถี+ลาภ เลี่ยงถ่ายเทที่ดูดดิถี) ไม่ใช่ useful-god ที่อาจดึงธาตุถ่ายเท
  const adjust = resolveAdjustElements(calculatedState).map(elementLabel);
  const adjustWithColor = adjust.filter((element) => section.has(element));

  const lines = adjustWithColor.map((element) => {
    const [color, gem, amulet] = section.get(element)!;
    const benefit = K("ELEMENT_COLOR_BENEFIT_TH", ELEMENT_COLOR_BENEFIT_TH)[element];
    return `ธาตุ${element} (เสริมดวง): สีมงคล ${color ?? "-"}; อัญมณี ${gem ?? "-"}; วัตถุมงคล ${amulet ?? "-"}${benefit ? ` — ช่วย${benefit}` : ""}`;
  });

  const adjustColors = adjustWithColor
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
  } else if (adjustColors.length > 0) {
    extras.push(`สีกระเป๋าสตางค์ / อุปกรณ์ทำมาหากิน (มือถือ โน้ตบุ๊ก แท็บเล็ต): เน้นสีธาตุ${adjustWithColor[0]} (${adjustColors[0]})`);
  }
  if (carColor) {
    extras.push(`สีรถยนต์ / ของเคลื่อนไหวได้ — เทียบดิถี ${dayStem} กับราศีบนหลักยาม ${hourStem}: ${carColor}`);
  } else {
    // fallback สีรถ: ยึด "ธาตุส่งเสริม" (印 = ธาตุที่หล่อเลี้ยงดิถี) ไม่ใช่ useful god ทุกตัว (เช่นไม่เอาคู่ธาตุ)
    const resourceTh = elementLabel(inverseGenerate(dayMasterElement(calculatedState)));
    const resourceColor = section.get(resourceTh)?.[0];
    if (resourceColor) {
      extras.push(`สีรถยนต์ / ของเคลื่อนไหวได้: เน้นสีธาตุ${resourceTh} (${resourceColor}) ตามธาตุส่งเสริมดวง`);
    } else if (adjustColors.length > 0) {
      extras.push(`สีรถยนต์: ${adjustColors.join(" / ")}`);
    }
  }
  extras.push(`ทิศมงคล: ${adjustWithColor.map((element) => K("ELEMENT_DIRECTION_TH", ELEMENT_DIRECTION_TH)[element]).join(" และ ")}`);

  // สัตว์มงคล (Source7 §3.1 ตาราง ดิถี×ราศีบนหลักเดือน — คอลัมน์สัตว์มงคล)
  const animalTable = parseSource7AnimalTable("3.1");
  const luckyAnimals = animalTable?.get(`${dayStem}|${monthStem}`);
  if (luckyAnimals) {
    extras.push(`สัตว์มงคล (เทียบดิถี ${dayStem} กับราศีบนหลักเดือน ${monthStem}): ${luckyAnimals}`);
  }

  // สัญลักษณ์/รูปทรงมงคล (อู่สิง): ดาวลาภ (財) = ด้านการเงิน, ดาวส่งเสริม (印) = ด้านคนสนับสนุน
  const wealthTh = elementLabel(CONTROLS[dayMasterElement(calculatedState)] as SupportedElementValue);
  const resourceShapeTh = elementLabel(inverseGenerate(dayMasterElement(calculatedState)));
  extras.push(
    `สัญลักษณ์/รูปทรงมงคล: ${K("ELEMENT_SHAPE_TH", ELEMENT_SHAPE_TH)[wealthTh]} (ธาตุ${wealthTh} = ดาวลาภ ด้านการเงิน), ${K("ELEMENT_SHAPE_TH", ELEMENT_SHAPE_TH)[resourceShapeTh]} (ธาตุ${resourceShapeTh} = ดาวส่งเสริม ด้านคนสนับสนุน)`,
  );

  // lead-clause นำกลุ่มลิสต์สี (YLC style) — เกริ่นจาก fact เดิม (สมดุลดิถี) ไม่เจาะจงชื่อธาตุเพื่อไม่ชนลำดับ test
  const colorsLead = lines.length > 0
    ? "สีและของมงคลของดวงนี้เลือกจากธาตุที่ช่วยเสริมสมดุลดิถี เพื่อหนุนกำลังดวงและดึงดูดสิ่งดี ๆ โดยมีรายละเอียดดังนี้:"
    : null;

  return [colorsLead, ...lines, avoid, ...extras].filter(Boolean).join("\n\n");
}

// เชี่ยงแซดีตาม Source7 §5 (custom เทพ) — กว้างกว่า GOOD_QI: รวม หมอ/ทอ/เอี้ยง ด้วย
const GOOD_QI_ENHANCE = new Set(["เชี่ยงแซ", "กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง", "หมอ", "ทอ", "เอี้ยง"]);

/** สิ่งที่เทพประจำตัวอักษร "หนุน" ตามบทบาทธาตุของตัวอักษรนั้นเทียบดิถี */
export const DEITY_ROLE_BENEFIT_TH: Record<RelationRole, string> = {
  "คู่ธาตุ": "หนุนเรื่องเพื่อน พี่น้อง หุ้นส่วน และคนรอบตัว",
  "ธาตุส่งเสริม": "หนุนเรื่องผู้ใหญ่อุปถัมภ์ สุขภาพ การเรียนรู้ และแรงสนับสนุน",
  "ธาตุถ่ายเท": "หนุนเรื่องการเจรจา การทำงาน และการแสดงผลงาน",
  "ธาตุพิฆาต": "หนุนเรื่องโชคลาภ การลงทุน และทรัพย์สิน",
  "พิฆาตธาตุ": "หนุนเรื่องอำนาจ ตำแหน่งหน้าที่ และการงาน",
};

// ───────── บท 15 สิ่งศักดิ์สิทธิ์เฉพาะดวง (custom) — เกณฑ์แก้ดวงด้วยธาตุปรับดวง × เชี่ยงแซ ─────────
const STEMS_OF_ELEMENT: Record<SupportedElementValue, readonly string[]> = {
  wood: ["甲", "乙"], fire: ["丙", "丁"], earth: ["戊", "己"], metal: ["庚", "辛"], water: ["壬", "癸"],
};
const BRANCHES_OF_ELEMENT: Record<SupportedElementValue, readonly string[]> = {
  wood: ["寅", "卯"], fire: ["巳", "午"], earth: ["辰", "戌", "丑", "未"], metal: ["申", "酉"], water: ["子", "亥"],
};
// เชี่ยงแซตัวดี (ใช้ได้เสมอ) / ตัวเสีย (ห้ามใช้ ข้ามตำแหน่ง) ตามสเปกเกณฑ์แก้ดวง
const ADJUST_GOOD_QI = new Set(["เชี่ยงแซ", "กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง", "หมอ", "ทอ", "เอี้ยง"]);
const ADJUST_FORBIDDEN_QI = new Set(["เจ๊าะ", "ซวย"]);
// เชี่ยงแซแบบมีเงื่อนไข: ใช้ได้เฉพาะเมื่อตัวอักษรที่เทียบมีบทบาทธาตุที่กำหนด
const SI_ALLOWED_ROLES = new Set<RelationRole>(["คู่ธาตุ", "ธาตุส่งเสริม"]);
const MUKYOK_PAE_ALLOWED_ROLES = new Set<RelationRole>(["คู่ธาตุ", "ธาตุส่งเสริม", "ธาตุพิฆาต"]);

// ทิศเสริมดวง (fallback) ตามธาตุที่ต้องการ — ตามสเปก (ไม้/ดิน/ทอง; ดินมี 2 ทิศ)
const ELEMENT_DIRECTION_TH_FALLBACK: Partial<Record<SupportedElementValue, string>> = {
  wood: "ทิศตะวันออกเฉียงใต้ (สุ่ง 巽)",
  earth: "ทิศตะวันตกเฉียงใต้ (คุง 坤) หรือทิศตะวันออกเฉียงเหนือ (กึ่ง 艮)",
  metal: "ทิศตะวันตกเฉียงเหนือ (เคี้ยง 乾)",
};

/** ธาตุปรับดวงตามเกณฑ์แก้ดวง (ตามกำลังดิถี) */
function resolveAdjustElements(calculatedState: CalculatedStateValue): SupportedElementValue[] {
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue; // ถ่ายเท
  const wealth = CONTROLS[dm] as SupportedElementValue; // โชคลาภ
  const resource = (Object.keys(GENERATES) as SupportedElementValue[]).find(
    (e) => GENERATES[e] === dm,
  ) as SupportedElementValue; // ส่งเสริม
  const band = resolveStrengthBand(calculatedState);
  if (band === "very-strong") {
    return [output];
  }
  if (band === "strong") {
    return [output, wealth];
  }
  // 身財両停 (อ่อนเกือบสมดุล + 財 แข็ง): leverage ครบสาย 食傷(ถ่ายเท)+財(ลาภ)+印(ส่งเสริม)+คู่ธาตุ
  //   = ทุกธาตุที่เป็นคุณ เว้นเฉพาะ officer (พิฆาตดิถี) → สี/ทิศครอบคลุมทั้งไม้/ไฟ/ทอง/น้ำ
  if (isWealthLeverageChart(calculatedState)) {
    return [resource, dm, wealth, output];
  }
  // balanced (กึ่งแข็งกึ่งอ่อน) → เอนไปทางเสริม: ส่งเสริม (印 ทำให้ดิถีแข็ง = หลัก) + คู่ธาตุ + ลาภ
  //   ตัด "ถ่ายเท (output)" ออก เพราะดูดดิถีให้อ่อนลง — คนกึ่งแข็งกึ่งอ่อนพออ่อนเมื่อทำงานหนัก
  // weak / very-weak → ใช้ตรรกะเดียวกัน (ส่งเสริมนำ + คู่ธาตุ + ลาภ)
  return [resource, dm, wealth];
}

/** บท15 §5: เลือก "ธาตุปรับดวง" ตามเกณฑ์แก้ดวง (band) — ต่างจาก resolveAdjustElements (สี §2.1) ที่จูนแยก
 *  แข็งมาก → ถ่ายเท; แข็ง/สมดุล → ถ่ายเท+โชคลาภ; อ่อน/อ่อนมาก → คู่ธาตุ+ส่งเสริม */
function resolveDeityAdjustElements(calculatedState: CalculatedStateValue): SupportedElementValue[] {
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue; // ถ่ายเท
  const wealth = CONTROLS[dm] as SupportedElementValue; // โชคลาภ
  const resource = inverseGenerate(dm); // ส่งเสริม
  const band = resolveStrengthBand(calculatedState);
  if (band === "very-strong") {
    return [output];
  }
  if (band === "strong" || band === "balanced") {
    return [output, wealth];
  }
  // 身財両停 (อ่อนเกือบสมดุล + 財 แข็ง): องค์เทพนำด้วยสาย 財(ลาภ)+印(ส่งเสริม)+食傷(ถ่ายเท)
  if (isWealthLeverageChart(calculatedState)) {
    return [wealth, resource, output];
  }
  // R5.2c: weak/very-weak ให้ "ส่งเสริม (印)" นำ แล้วคู่ธาตุ (比劫) — ดวงอ่อนควรบูชาเทพ "ธาตุที่หนุนตัว" เป็นองค์หลัก
  //   ซินแสยืนยันดวง M (己 อ่อน): เทพหลัก = "เทพเตาไฟ" (ไฟ=ส่งเสริม) ไม่ใช่เทพธาตุดิถีเอง (ดิน)
  //   สอดคล้องลำดับ resolveUsefulElements (印 นำ) + resolveAdjustElements สี (resource นำ)
  return [resource, dm]; // weak / very-weak: ส่งเสริม + คู่ธาตุ (ไม่รวมลาภ ตามสเปก)
}

// R5.2c+: น้ำหนักเชี่ยงแซ "ดี" สำหรับ rank องค์เทพในธาตุเดียวกัน (เลือกองค์เดียวเจาะจง)
//   ยิ่งตัวอักษรขึ้นเชี่ยงแซแกร่งกับดวง → ยิ่งควรเป็น "องค์หลัก" (ตี้อ๋วง/ลิ่มกัว/เชี่ยงแซ = สูงสุด)
const ADJUST_QI_WEIGHT: Record<string, number> = {
  "ตี้อ๋วง": 6, // 帝旺
  "ลิ่มกัว": 5, // 临官
  "เชี่ยงแซ": 5, // 长生
  "กวงตั่ว": 4, // 冠带
  "เอี้ยง": 2, // 养
  "ทอ": 2, // 胎
  "หมอ": 2, // 墓
};

/** ตัวอักษร candidate (ราศีบน/ล่าง ของธาตุปรับดวง) ขึ้นเชี่ยงแซดีแค่ไหน — รวมน้ำหนักเทียบดวงทั้ง 8 ตัวรายตำแหน่ง
 *  คะแนน 0 = ใช้ไม่ได้ (เดิม isAdjustCharUsable คืน false) · คะแนนสูง = องค์หลักที่เจาะจงกว่า */
function scoreAdjustChar(
  subjectStem: string,
  calculatedState: CalculatedStateValue,
): number {
  const dmEl = dayMasterElement(calculatedState);
  let score = 0;
  for (const pillar of ["year", "month", "day", "hour"] as PillarKey[]) {
    const { stem, branch } = calculatedState.fourPillars[pillar];
    const targets: Array<{ qi: string; role: RelationRole }> = [
      { qi: resolveDisplayStemPairStage(subjectStem, stem), role: resolveRelationRole(dmEl, stemElement(stem)) },
      { qi: resolveDisplayTwelveQiStage(subjectStem, branch), role: resolveRelationRole(dmEl, branchElement(branch)) },
    ];
    for (const { qi, role } of targets) {
      if (ADJUST_FORBIDDEN_QI.has(qi)) {
        continue; // เจ๊าะ/ซวย ข้ามตำแหน่งนี้
      }
      if (ADJUST_GOOD_QI.has(qi)) {
        score += ADJUST_QI_WEIGHT[qi] ?? 1;
        continue;
      }
      if (qi === "ซี่" && SI_ALLOWED_ROLES.has(role)) {
        score += 1;
        continue;
      }
      if ((qi === "หมกยก" || qi === "แป่") && MUKYOK_PAE_ALLOWED_ROLES.has(role)) {
        score += 1;
      }
    }
  }
  return score;
}

/** ตัวอักษร candidate "ใช้ได้" ไหม — คงพฤติกรรมเดิม (คะแนน > 0) */
function isAdjustCharUsable(
  subjectStem: string,
  calculatedState: CalculatedStateValue,
): boolean {
  return scoreAdjustChar(subjectStem, calculatedState) > 0;
}

/** Source7 §5 + เกณฑ์แก้ดวง: เลือก "ธาตุปรับดวง" → ตัวอักษร (ราศีบน/ล่าง) ที่ผ่านเชี่ยงแซ → องค์เทพ+องศา
 *  ถ้าไม่มีตัวอักษรที่ใช้ได้ → fallback เป็นทิศเสริมดวงตามธาตุที่ต้องการ */
function buildCustomDeities(calculatedState: CalculatedStateValue): string[] {
  const tables = parseSource7CustomDeities();
  if (!tables) {
    return [];
  }
  const dmEl = dayMasterElement(calculatedState);
  const adjustElements = resolveDeityAdjustElements(calculatedState);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const element of adjustElements) {
    const benefit = K("DEITY_ROLE_BENEFIT_TH", DEITY_ROLE_BENEFIT_TH)[resolveRelationRole(dmEl, element)];
    const elLabel = elementLabel(element);
    // R5.2c+: รวม candidate ราศีบน+ล่าง ของธาตุนี้ แล้ว rank ด้วยคะแนนเชี่ยงแซ → "องค์เดียวเจาะจง"
    //   (เช่น ดวง M: 丁 ขึ้น 长生 ที่ 酉 คะแนนสูงกว่า 丙 ที่ไม่มีเชี่ยงแซดี → เทพเตาไฟนำเทพสุริยัน ตรงซินแส)
    const candidates: Array<{ line: string; deity: string; score: number; order: number }> = [];
    let order = 0;
    // ราศีบน (stem) ของธาตุปรับดวง
    for (const stem of STEMS_OF_ELEMENT[element]) {
      const entry = tables.upper.get(stem);
      if (!entry) {
        continue;
      }
      const score = scoreAdjustChar(stem, calculatedState);
      if (score > 0) {
        candidates.push({
          line: `ธาตุ${elLabel} (ราศีบน ${stem}): ${entry.deity}${entry.degree ? ` — องศา ${entry.degree}°` : ""} — ${benefit}`,
          deity: entry.deity,
          score,
          order: order++,
        });
      }
    }
    // ราศีล่าง (branch) ของธาตุปรับดวง — ใช้ราศีแฝงพลังแท้ (本气) เป็นตัวคิดเชี่ยงแซ
    for (const branch of BRANCHES_OF_ELEMENT[element]) {
      const subjectStem = (BRANCH_HIDDEN_STEMS[branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [])[0] ?? "";
      const entry = tables.lower.get(branch);
      if (!entry || !subjectStem) {
        continue;
      }
      const score = scoreAdjustChar(subjectStem, calculatedState);
      if (score > 0) {
        candidates.push({
          line: `ธาตุ${elLabel} (ราศีล่าง ${branch}): ${entry.deity}${entry.degree ? ` — องศา ${entry.degree}°` : ""} — ${benefit}`,
          deity: entry.deity,
          score,
          order: order++,
        });
      }
    }
    // rank: คะแนนเชี่ยงแซมากก่อน, เสมอ → คงลำดับตำราเดิม (stable) เพื่อ deterministic
    candidates.sort((a, b) => (b.score - a.score) || (a.order - b.order));
    for (const candidate of candidates) {
      if (!seen.has(candidate.deity)) {
        seen.add(candidate.deity);
        out.push(candidate.line);
      }
    }
  }

  // fallback: ไม่มีตัวอักษรเชี่ยงแซดีที่ใช้ได้ → แนะนำทิศเสริมดวงตามธาตุที่ต้องการ
  if (out.length === 0) {
    for (const element of adjustElements) {
      const dir = ELEMENT_DIRECTION_TH_FALLBACK[element];
      if (dir) {
        out.push(`ไม่มีตัวอักษรเชี่ยงแซดีที่ใช้เสริมดวงได้ — ให้เสริมธาตุ${elementLabel(element)}ด้วยทิศมงคล: ${dir}`);
      }
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
      const benefit = K("ELEMENT_DEITY_BENEFIT_TH", ELEMENT_DEITY_BENEFIT_TH)[element];
      return `ธาตุ${element} (useful god): สิ่งศักดิ์สิทธิ์ ${deities ?? "-"}${benefit ? ` (ช่วยเรื่อง: ${benefit})` : ""}; การทำบุญ ${merit ?? "-"}`;
    });
  if (elementLines.length === 0) {
    return null;
  }

  const custom = buildCustomDeities(calculatedState);
  const blocks: string[] = [];
  if (custom.length > 0) {
    // ตามคำกำชับซินแซ: เทียบเชี่ยงแซตัวอักษรทั้งผัง (custom ถูก rank ด้วยคะแนนเชี่ยงแซแล้ว)
    // แล้วเลือก "ดีที่สุด 2 องค์" เท่านั้น — 1 หลัก + 1 รอง (ไม่ไล่ทั้ง 8 ตัว)
    const [primary, secondary] = custom;
    const lines = [
      `องค์หลักที่ควรบูชา (ดีที่สุดจากการเทียบเชี่ยงแซทั้งผัง): ${primary.replace(/^ธาตุ/, "ธาตุ")}`,
    ];
    if (secondary) {
      lines.push(`องค์รอง (บูชาประกอบได้): ${secondary.replace(/^ธาตุ/, "ธาตุ")}`);
    }
    blocks.push(
      `สิ่งศักดิ์สิทธิ์เฉพาะดวง (เทียบเชี่ยงแซตัวอักษรทั้งผัง แล้วเลือกดีที่สุด 2 องค์ — 1 หลัก + 1 รอง):\n${lines.join("\n")}`,
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

  // ลำดับความสำคัญ useful god (ตามที่ซินแซกำชับ): ธาตุส่งเสริม (印 = ธาตุก่อเกิดดิถี) = อันดับ 1 ดีที่สุด,
  // คู่ธาตุ (比 = ธาตุเดียวกับดิถี) = อันดับ 2 รองลงมา ช่วยเสริมกำลังดิถีโดยตรงเท่านั้น
  const resourceTh = elementLabel(inverseGenerate(dm));
  const companionTh = elementLabel(dm);
  const usefulRank = (element: string): string =>
    element === resourceTh
      ? " — อันดับ 1 (ธาตุส่งเสริมหลัก ดีที่สุด เลือกก่อนเพราะหนุนดิถีได้เต็มที่)"
      : element === companionTh
        ? " — อันดับ 2 (รองลงมา ดีกับดิถีโดยตรงอย่างเดียว)"
        : "";
  const lists = resolveUsefulElements(calculatedState)
    .map((element) => (careers.has(element) ? `อาชีพธาตุ${element} (useful god)${usefulRank(element)}: ${careers.get(element)!}` : null))
    .filter((segment): segment is string => Boolean(segment));
  // lead-clause นำกลุ่มลิสต์อาชีพ (YLC style) — เกริ่นจาก fact เดิม (useful god) ไม่เจาะจงชื่อธาตุเพื่อไม่ชนลำดับ test
  const careerLead = lists.length > 0
    ? (lists.length > 1
        ? "สายอาชีพที่เป็นคุณกับดวงนี้คือสายงานที่เป็นธาตุส่งเสริมดิถี (useful god) ซึ่งจะดึงศักยภาพออกมาเป็นรายได้ได้เต็มที่ — แนะนำให้ทุ่มน้ำหนักราว 70% ไปที่กลุ่มอาชีพหลัก (อันดับ 1) และอีกราว 30% ที่กลุ่มเสริม (อันดับ 2) ดังนี้:"
        : "สายอาชีพที่เป็นคุณกับดวงนี้คือสายงานที่เป็นธาตุส่งเสริมดิถี (useful god) ซึ่งจะดึงศักยภาพออกมาเป็นรายได้ได้เต็มที่ ดังนี้:")
    : null;

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
  const marketLine = K("QI_MARKET_TH", QI_MARKET_TH)[yearQi]
    ? `กลุ่มลูกค้า/ตลาดเป้าหมาย (Target/Market — ดูเชี่ยงแซเสาปี ${yearPillar.stem}${yearPillar.branch} → ${yearQi}): ${K("QI_MARKET_TH", QI_MARKET_TH)[yearQi]}`
    : "";

  // กลุ่มลูกค้า/ตลาด จากเสาปี (เสริมตามธาตุ = สังคม/ฐานคนรอบตัว)
  const yearElement = elementLabel(branchElement(calculatedState.fourPillars.year.branch));
  const customer = `กลุ่มลูกค้าตามธาตุเสาปี (ธาตุ${yearElement}): ${K("YEAR_CUSTOMER_TH", YEAR_CUSTOMER_TH)[yearElement]}`;

  // กลุ่มที่ "นำเงินเข้า" จากดาวลาภ (财 = ธาตุที่ดิถีพิฆาต) — ตลาดที่ยอมจ่ายให้ดวงนี้จริง
  const wealthLabel = elementLabel(CONTROLS[dm] as SupportedElementValue);
  const wealthCustomer = wealthLabel !== yearElement
    ? `กลุ่มที่นำเงินเข้าหาดวงนี้ได้ดี (ดูจากดาวลาภ ธาตุ${wealthLabel}): ${K("YEAR_CUSTOMER_TH", YEAR_CUSTOMER_TH)[wealthLabel]}`
    : "";

  // ช่องทางสื่อสาร/การตลาด จากดาวถ่ายเท (食傷 = วิธีที่ดวงแสดงออก)
  const outputChannel = `ช่องทางที่ดวงนี้สื่อสารและทำการตลาดได้เป็นธรรมชาติ (ดาวถ่ายเท ธาตุ${elementLabel(output)}): ${K("OUTPUT_CHANNEL_TH", OUTPUT_CHANNEL_TH)[elementLabel(output)]}`;

  // พรสวรรค์ → แนวอาชีพ: ดาวถ่ายเทตกเชี่ยงแซตัวใด (12 เซี่ยงแซ × ธาตุถ่ายเท) แล้วชี้สายงานที่ควรไปแสดงออก
  const talentTransfer = buildOutputTransferReading(calculatedState);
  const talentPillar =
    talentTransfer.pillars.find((pillar) => pillar.carriesOutputElement) ??
    talentTransfer.pillars.find((pillar) => pillar.pillarKey === "day");
  const aptitudeBridge = talentPillar
    ? buildAptitudeCareerBridge(talentPillar.stageChinese, output)
    : null;

  // หมายเหตุ "ขาดก้านธาตุหนุน" และ "วิธีแก้เคล็ดถ้าเลี่ยงสายต้องห้ามไม่ได้" ถูกตัดออกจากบทนี้
  // ตามคำกำชับซินแซ — ย้ายไปอยู่ในบทแก้ดวง (บท 14/15) บทนี้ให้ "สิ่งที่ควรระวัง" เหลือแค่อาชีพที่ไม่ถูกดวง

  return [frame, moneyWay, aptitudeBridge, careerLead, ...lists, avoid, drainAvoid, marketLine, customer, wealthCustomer, outputChannel]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * หัวข้อย่อยของบท 2 "อาชีพ / ธุรกิจ ที่ควรทำ และไม่ควรทำ" ตาม docs/ทายดวง 15 หัวข้อ.docx
 * โครง: กล่องแรกบรรยายภาพรวมดิถี/แนวทางหาเงิน แล้วตามด้วยอาชีพควรทำ (อันดับ 1-3 แล้วแต่ธาตุ)
 * และไม่ควรทำ (อันดับ 1-2 แล้วแต่ธาตุ) — แต่ละหัวข้อย่อย = หนึ่งกล่องให้ซินแสแก้ง่าย
 */
const CAREER_SUBTOPICS = {
  basis: "ภาพรวมดิถีกับแนวทางการงาน",
  do1: "อาชีพ/ธุรกิจ ที่ควรทำ อันดับ 1",
  do2: "อาชีพ/ธุรกิจ ที่ควรทำ อันดับ 2",
  do3: "อาชีพ/ธุรกิจ ที่ควรทำ อันดับ 3 (บางคนมี)",
  avoid1: "อาชีพ/ธุรกิจ ที่ไม่ควรทำ อันดับ 1",
  avoid2: "อาชีพ/ธุรกิจ ที่ไม่ควรทำ อันดับ 2 (บางคนมี)",
} as const;

/** เหตุผลว่าทำไมอาชีพสายธาตุนี้เป็นคุณกับดวง (อิงบทบาทธาตุเทียบดิถี) */
function careerElementRole(element: ThaiElement, dm: SupportedElementValue): string {
  const resourceTh = elementLabel(inverseGenerate(dm));
  const companionTh = elementLabel(dm);
  const outputTh = elementLabel(GENERATES[dm] as SupportedElementValue);
  const wealthTh = elementLabel(CONTROLS[dm] as SupportedElementValue);
  if (element === resourceTh)
    return "ธาตุส่งเสริมดิถี (印) หนุนกำลังดวงได้เต็มที่ จึงเป็นสายงานที่ดีที่สุด";
  if (element === companionTh)
    return "คู่ธาตุดิถี (比) ช่วยเสริมกำลังดวงโดยตรง เหมาะเป็นสายงานรอง";
  if (element === outputTh)
    return "ดาวถ่ายเท (食傷) ได้ใช้ทักษะและความถนัดแปลงเป็นรายได้";
  if (element === wealthTh)
    return "ดาวลาภ (财) ที่ดิถีกำกับได้ = ทรัพย์เข้าหาดวงโดยตรง";
  return "ธาตุที่เป็นคุณกับดวง";
}

/**
 * บท 2 (อาชีพ/ธุรกิจ) ฉบับ "กล่อง" ตาม docs/ทายดวง 15 หัวข้อ.docx — reuse ชิ้นส่วนเดียวกับ
 * buildCareerReading (frame/moneyWay/useful-god/officer/drain) เพื่อคงข้อเท็จจริงเดิม
 * แต่จัดเป็นกล่องตามหัวข้อย่อย: ภาพรวม → ควรทำ 1-3 → ไม่ควรทำ 1-2 (จำนวนกล่องแล้วแต่ธาตุของดวง)
 */
function buildCareerBoxes(calculatedState: CalculatedStateValue): string | null {
  const careers = parseSource7Careers();
  if (!careers) {
    return null;
  }
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue;
  const band = resolveStrengthBand(calculatedState);
  const dmWeak = band === "weak" || band === "very-weak";
  const dmStrong = band === "strong" || band === "very-strong";

  // ── กล่อง 1: ภาพรวมดิถี + วิธีหาเงิน + พรสวรรค์→งาน + กลุ่มลูกค้า/ช่องทาง (บรรยายดิถี) ──
  const frame = dmWeak
    ? "ด้วยกำลังดิถีที่ไม่มากนัก ดวงนี้ไม่เหมาะกับการลุยเดี่ยวแบกทุกอย่างไว้คนเดียว ควรใช้ทักษะและความถนัด (ดาวถ่ายเท) เป็นเครื่องมือหาเงิน และทำงานในระบบที่มีคนช่วยซัพพอร์ต"
    : dmStrong
      ? "ด้วยกำลังดิถีที่เข้มแข็ง ดวงนี้ลงมือทำเองได้เต็มที่ ควรเลือกงานที่ได้ระบายพลังออกมาเป็นผลงานและทรัพย์อย่างต่อเนื่อง"
      : "ด้วยสภาวะดิถีที่กึ่งแข็งกึ่งอ่อน ดวงนี้เลือกอาชีพแบบ “ควบ 2 ฐาน” คือธาตุที่หนุนทั้งกำลังดิถีและหลักเดือนไปพร้อมกัน จะมั่นคงที่สุด";
  const moneyWay = `วิธีหาเงินที่ถนัดที่สุดคือการใช้ “ดาวถ่ายเท” (ธาตุ${elementLabel(output)}) แปลงความรู้และทักษะให้กลายเป็นรายได้ มากกว่าการลงแรงกายแลกเงิน`;

  const talentTransfer = buildOutputTransferReading(calculatedState);
  const talentPillar =
    talentTransfer.pillars.find((pillar) => pillar.carriesOutputElement) ??
    talentTransfer.pillars.find((pillar) => pillar.pillarKey === "day");
  const aptitudeBridge = talentPillar
    ? buildAptitudeCareerBridge(talentPillar.stageChinese, output)
    : null;

  const yearPillar = calculatedState.fourPillars.year;
  const yearQi = resolveDisplayTwelveQiStage(yearPillar.stem, yearPillar.branch);
  const marketLine = K("QI_MARKET_TH", QI_MARKET_TH)[yearQi]
    ? `กลุ่มลูกค้า/ตลาดเป้าหมาย (Target/Market — ดูเชี่ยงแซเสาปี ${yearPillar.stem}${yearPillar.branch} → ${yearQi}): ${K("QI_MARKET_TH", QI_MARKET_TH)[yearQi]}`
    : "";
  const yearElement = elementLabel(branchElement(calculatedState.fourPillars.year.branch));
  const customer = `กลุ่มลูกค้าตามธาตุเสาปี (ธาตุ${yearElement}): ${K("YEAR_CUSTOMER_TH", YEAR_CUSTOMER_TH)[yearElement]}`;
  const wealthLabel = elementLabel(CONTROLS[dm] as SupportedElementValue);
  const wealthCustomer = wealthLabel !== yearElement
    ? `กลุ่มที่นำเงินเข้าหาดวงนี้ได้ดี (ดูจากดาวลาภ ธาตุ${wealthLabel}): ${K("YEAR_CUSTOMER_TH", YEAR_CUSTOMER_TH)[wealthLabel]}`
    : "";
  const outputChannel = `ช่องทางที่ดวงนี้สื่อสารและทำการตลาดได้เป็นธรรมชาติ (ดาวถ่ายเท ธาตุ${elementLabel(output)}): ${K("OUTPUT_CHANNEL_TH", OUTPUT_CHANNEL_TH)[elementLabel(output)]}`;

  const box1 = readingBox(CAREER_SUBTOPICS.basis, [
    frame,
    moneyWay,
    aptitudeBridge,
    marketLine,
    customer,
    wealthCustomer,
    outputChannel,
  ]);

  // ── กล่องอาชีพ "ควรทำ" (อันดับ 1-3 ตามจำนวนธาตุที่เป็นคุณกับดวง) ──
  const doTitles = [CAREER_SUBTOPICS.do1, CAREER_SUBTOPICS.do2, CAREER_SUBTOPICS.do3];
  const doBoxes = resolveUsefulElements(calculatedState)
    .slice(0, 3)
    .map((element, idx) => {
      const desc = careers.get(element);
      if (!desc) {
        return "";
      }
      return readingBox(doTitles[idx], [
        `อาชีพธาตุ${element} (useful god) — ${careerElementRole(element, dm)}`,
        desc,
      ]);
    });

  // ── กล่องอาชีพ "ไม่ควรทำ" อันดับ 1 = ธาตุที่พิฆาตดิถี (官杀) กดดัน/บั่นทอนกำลังดวง ──
  const avoidTh = elementLabel(resolveOfficerElement(dm));
  const avoidBox1 = readingBox(CAREER_SUBTOPICS.avoid1, [
    `สายงานธาตุ${avoidTh} เป็นธาตุที่พิฆาตดิถี กดดันและบั่นทอนกำลังของดวง จึงควรเลี่ยงเป็นอันดับแรก`,
    careers.get(avoidTh) ?? null,
  ]);

  // ── กล่องอาชีพ "ไม่ควรทำ" อันดับ 2 (บางคนมี) = ดาวถ่ายเทที่ดูดกำลังดิถีกึ่งแข็งกึ่งอ่อน ──
  const drainTh = band === "balanced"
    ? elementLabel(resolveBalancedDualBaseCareer(calculatedState).drain)
    : null;
  const avoidBox2 = drainTh && drainTh !== avoidTh
    ? readingBox(CAREER_SUBTOPICS.avoid2, [
        `สายงานธาตุ${drainTh} (ดาวถ่ายเท) จะดูดกำลังดิถีที่ก้ำกึ่งอยู่แล้วให้อ่อนลง ทำให้ฐานไม่แน่น`,
        careers.get(drainTh) ?? null,
      ])
    : "";

  const boxes = [box1, ...doBoxes, avoidBox1, avoidBox2].filter((box) => box.length > 0);
  return boxes.length > 0 ? boxes.join("\n\n") : null;
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

  // คำทำนายหุ้นส่วน/เพื่อนร่วมงานตามตำรา (คู่สมพงษ์การงาน) ตาม 12 เชี่ยงแซที่ราศีล่างวัน
  const partnerVerdict = parseCareerRelationVerdicts()?.get("partner")?.get(dayQi);
  const partnerVerdictLine = partnerVerdict ? `คำทำนายหุ้นส่วน/เพื่อนร่วมงานตามตำรา (เซียงแซ ${dayQi}): ${partnerVerdict}` : null;

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
  }, {
    elderMinAge: RETIREMENT_AGE,
    // เลยวัยเกษียณ (>= 60): ตัดการรุกเรื่องหุ้นส่วน/ลงทุนใหม่ เน้นสุขภาพและรักษาฐานเดิม
    elder: {
      rising: "วัยเกษียณ ไม่จำเป็นต้องรุกหาหุ้นส่วน/ลงทุนใหม่ ให้เน้นสุขภาพและส่งต่อกิจการที่มีอยู่",
      transitional: "วัยเกษียณ หากจะร่วมงานให้เป็นที่ปรึกษามากกว่าลงเงิน เน้นดูแลสุขภาพเป็นหลัก",
      falling: "วัยเกษียณ ควรเลี่ยงการร่วมทุนใหม่ เน้นรักษาสุขภาพและความมั่นคงที่มีอยู่",
    },
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
  return [seatVerdict, partnerVerdictLine, stance, `แนวทางทำธุรกิจ/หุ้นส่วน: ${verdict}`, partner, sanheNote, timingBlock, backerBlock, capitalBlock].filter(Boolean).join("\n\n");
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
export const YEAR_CUSTOMER_TH: Record<ThaiElement, string> = {
  "ไม้": "คนรักการเรียนรู้ สายการศึกษา สื่อ สิ่งพิมพ์ งานสร้างสรรค์ และคนที่ใส่ใจสิ่งแวดล้อม",
  "ไฟ": "คนมีชื่อเสียง สายความงาม บันเทิง การตลาด และกลุ่มที่ตัดสินใจซื้อด้วยอารมณ์",
  "ดิน": "คนมั่นคง สายอสังหาฯ เกษตร ราชการท้องถิ่น และครอบครัวที่เน้นความยั่งยืน",
  "ทอง": "คนมีระเบียบและอำนาจ ข้าราชการ บุคคลในเครื่องแบบ สายการเงิน เทคโนโลยี และผู้มีตำแหน่ง",
  "น้ำ": "คนเคลื่อนไหวตลอด สายค้าขาย บริการ ท่องเที่ยว ขนส่ง และลูกค้าออนไลน์",
};

/** ช่องทางสื่อสาร/การตลาดตามธาตุของดาวถ่ายเท (食傷 = วิธีที่ดวงแสดงออก) */
export const OUTPUT_CHANNEL_TH: Record<ThaiElement, string> = {
  "ไม้": "งานเขียน คอนเทนต์ความรู้ คอร์ส/สัมมนา และสื่อสิ่งพิมพ์ที่ให้สาระ",
  "ไฟ": "วิดีโอ ไลฟ์ ภาพลักษณ์ การพูดบนเวที และการตลาดที่กระตุ้นอารมณ์/แรงบันดาลใจ",
  "ดิน": "การบอกต่อแบบปากต่อปาก ความน่าเชื่อถือ ของจริงจับต้องได้ และฐานลูกค้าประจำที่ดูแลระยะยาว",
  "ทอง": "ระบบ แบรนด์ที่คมชัด ข้อมูล/ตัวเลขชัดเจน และช่องทางที่ดูพรีเมียมมีมาตรฐาน",
  "น้ำ": "โซเชียลมีเดีย การสื่อสารแบบลื่นไหล เครือข่าย และช่องทางออนไลน์ที่กระจายตัวเร็ว",
};

/** Target/Market ตาม 12 เชี่ยงแซของเสาปี (ราศีบน-vs-ล่าง) — ตามวิธีทายที่ซินแซกำชับ
 * เช่น แป่ = ลูกค้าทางไกล/ออนไลน์ + สุขภาพ + ของทันสมัย */
export const QI_MARKET_TH: Record<string, string> = {
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
export const QI_WEALTH_TH: Record<string, string> = {
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
  "ทอ": "รายได้ประจำที่ได้ทีละน้อยแต่ยาวนานสม่ำเสมอ ค่อย ๆ สะสมจากน้อยไปมาก (เก็บเล็กผสมน้อย)",
  "เอี้ยง": "ลาภจากการบำรุงดูแลระยะยาว รายได้ต่อเนื่องแบบสมาชิก/ซับสคริปชัน",
};

/** ทิศมงคลตามธาตุ (useful god → ทิศ) */
export const ELEMENT_DIRECTION_TH: Record<ThaiElement, string> = {
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
  const cultivate = `แนวทางสร้างผู้อุปถัมภ์: สั่งสมบารมีด้วยคุณธรรมประจำธาตุส่งเสริม (ธาตุ${elementLabel(resource)}) — ${K("RESOURCE_VIRTUE_TH", RESOURCE_VIRTUE_TH)[elementLabel(resource)]} ยิ่งบ่มเพาะสิ่งเหล่านี้ ดาวส่งเสริมยิ่งแข็ง ผู้ใหญ่และโอกาสจะเข้ามาเองตามจังหวะ`;

  const lead = `ผู้อุปถัมภ์ดูจากดาวส่งเสริม (ธาตุ${elementLabel(resource)}) และดาวอำนาจ-ตำแหน่ง (ธาตุ${elementLabel(power)}) โดยเฉพาะที่เสาปี/เดือน ซึ่งแทนผู้ใหญ่และปู่ย่าตระกูล`;
  // "ใครคือผู้อุปถัมภ์" — แปลธาตุส่งเสริม/อำนาจเป็นกลุ่มคน (อ้างตารางหลักชิง + เทียบ your life code)
  const benefactorTypes = `กลุ่มผู้อุปถัมภ์ที่หนุนดวงนี้: ${K("FAMILY_KINSHIP_TH", FAMILY_KINSHIP_TH)["ธาตุส่งเสริม"]} (ผู้ให้กำเนิดและครูบาอาจารย์ที่คอยเกื้อหนุน มักเป็นผู้ใหญ่ใจดีหรือผู้ให้ที่มีความเป็นแม่) รวมถึงผู้ใหญ่ในสายงานหรือเจ้านายที่เปิดโอกาส (ดาวอำนาจ-ตำแหน่ง ธาตุ${elementLabel(power)}) คุณมักได้แรงหนุนผ่านความเมตตาและการชี้แนะ มากกว่าการต้องแก่งแย่งแข่งขันด้วยตนเอง`;
  if (hits.length === 0) {
    return `${lead}\n\n${benefactorTypes}\n\nบนชั้นหลักไม่พบดาวส่งเสริม/อำนาจที่เสาปี-เดือนชัดเจน จึงมักต้องอาศัยความพยายามของตนเองเป็นหลัก ผู้อุปถัมภ์จะมาเป็นจังหวะตามวัยจรที่ธาตุส่งเสริมเข้ามา\n\n${cultivate}`;
  }
  return `${lead}\n\n${benefactorTypes}\n\n${hits.join("\n")}\n\n${cultivate}`;
}

/**
 * หัวข้อย่อยของบท 4 "ผู้อุปถัมภ์ที่พร้อมช่วยเหลือคือใคร" ตาม docs/ทายดวง 15 หัวข้อ.docx
 * 4 กล่องตามบทบาทธาตุ (印 ส่งเสริม / 比 คู่ธาตุ / 食傷 ถ่ายเท-บริวาร / 财 โชคลาภ-ลูกค้า)
 * แต่ละกล่อง: เชี่ยงแซดีไหม + อยู่ตรงไหน + คือใคร + ลักษณะอย่างไร
 */
const BENEFACTOR_SUBTOPICS = {
  resource: "ธาตุส่งเสริม (印) — เชี่ยงแซดี อยู่ตรงไหน คือใคร ลักษณะอย่างไร",
  companion: "คู่ธาตุ (比) — เชี่ยงแซดี อยู่ตรงไหน คือใคร ลักษณะอย่างไร",
  output: "ธาตุถ่ายเท/บริวาร (食傷) — เชี่ยงแซดี อยู่ตรงไหน คือใคร ลักษณะอย่างไร",
  wealth: "ธาตุโชคลาภ/ลูกค้า (财) — อยู่ตรงไหน คือใคร ลักษณะอย่างไร",
} as const;

/** "คือใคร" ของแต่ละบทบาทธาตุในบริบทผู้อุปถัมภ์ (อิงตารางหลักชิง + บริบทคนช่วยเหลือ) */
export const BENEFACTOR_PERSON_TH: Record<"resource" | "companion" | "output" | "wealth", string> = {
  resource: "ผู้อุปถัมภ์ ผู้ใหญ่ ครูบาอาจารย์ และเจ้านาย/นายทุนที่เปิดโอกาสและคอยให้ความรู้-แรงหนุน",
  companion: "เพื่อน พี่น้อง และหุ้นส่วนรุ่นเดียวกันที่เคียงข้างคอยช่วยเหลือแบ่งเบา",
  output: "ลูกน้อง บริวาร ลูกศิษย์ และคนรุ่นน้องที่ลงแรงทำงานสร้างผลงานให้",
  wealth: "ลูกค้า ผู้จ่ายเงิน และกลุ่มคนที่นำทรัพย์เข้ามาหาดวงนี้",
};

/**
 * บท 4 (ผู้อุปถัมภ์) ฉบับ "กล่อง" ตาม docs/ทายดวง 15 หัวข้อ.docx — 4 บทบาทธาตุ
 * reuse primitive เดิม: ปฏิกิริยา 5 ธาตุ + 12 เชี่ยงแซ (GOOD_QI/BAD_QI) + ELEMENT_TEMPER_TH (ลักษณะคนตามธาตุ)
 */
function buildBenefactorBoxes(calculatedState: CalculatedStateValue): string | null {
  const dm = dayMasterElement(calculatedState);
  const roles: Array<{
    key: keyof typeof BENEFACTOR_SUBTOPICS;
    element: SupportedElementValue;
  }> = [
    { key: "resource", element: inverseGenerate(dm) },
    { key: "companion", element: dm },
    { key: "output", element: GENERATES[dm] as SupportedElementValue },
    { key: "wealth", element: CONTROLS[dm] as SupportedElementValue },
  ];

  const boxes = roles.map(({ key, element }) => {
    const elTh = elementLabel(element);
    // อยู่ตรงไหน + เชี่ยงแซ: สแกนทั้ง 4 เสาหาตำแหน่งที่ธาตุนี้ปรากฏ (ราศีบน/ล่าง) แล้วอ่าน 12 เชี่ยงแซ self-seat
    const positions: string[] = [];
    for (const pillar of ["year", "month", "day", "hour"] as PillarKey[]) {
      const value = calculatedState.fourPillars[pillar];
      const places: string[] = [];
      if (stemElement(value.stem) === element) places.push(`ราศีบน ${value.stem}`);
      if (branchElement(value.branch) === element) places.push(`ราศีล่าง ${value.branch}`);
      if (places.length === 0) continue;
      const qi = resolveDisplayTwelveQiStage(value.stem, value.branch);
      const verdict = GOOD_QI.has(qi)
        ? "เชี่ยงแซดี (มีพลังหนุนเต็มที่ คนกลุ่มนี้ช่วยได้จริง)"
        : BAD_QI.has(qi)
          ? "เชี่ยงแซเสีย (อ่อนแรง ต้องประคอง หรือช่วยได้ไม่เต็มที่)"
          : "เชี่ยงแซระดับกลาง (พอมีบทบาทแต่ไม่เด่น)";
      positions.push(`${PILLAR_LABEL_TH[pillar]} (${places.join(" + ")}) ตกเชี่ยงแซ ${qi} → ${verdict}`);
    }
    const whereLine = positions.length > 0
      ? `อยู่ตรงไหน (ธาตุ${elTh}):`
      : `อยู่ตรงไหน: ธาตุ${elTh}ไม่ปรากฏเด่นในผังหลัก — คนกลุ่มนี้มักเข้ามาเป็นจังหวะช่วงวัยจรที่ธาตุ${elTh}เด่นขึ้น`;
    const trait = ELEMENT_TEMPER_TH[elTh]?.balanced;
    return readingBox(BENEFACTOR_SUBTOPICS[key], [
      whereLine,
      ...positions,
      `คือใคร: ${K("BENEFACTOR_PERSON_TH", BENEFACTOR_PERSON_TH)[key]}`,
      trait ? `ลักษณะอย่างไร: คนกลุ่มนี้มักมีคุณสมบัติแบบธาตุ${elTh} — ${trait}` : null,
    ]);
  });

  const filtered = boxes.filter((box) => box.length > 0);
  return filtered.length > 0 ? filtered.join("\n\n") : null;
}

/** คุณธรรมประจำธาตุ (五常) ที่ใช้บ่มเพาะดาวส่งเสริม (印) เพื่อเรียกบารมี/ผู้อุปถัมภ์ */
export const RESOURCE_VIRTUE_TH: Record<ThaiElement, string> = {
  "ไม้": "เมตตากรุณา (仁) ช่วยเหลือเกื้อกูล ใจกว้าง และใฝ่เรียนรู้พัฒนาตน",
  "ไฟ": "มีมารยาทสัมมาคารวะ (礼) อ่อนน้อมต่อผู้ใหญ่ ให้ความรู้/สั่งสอน ปฏิบัติธรรม และนั่งสมาธิ",
  "ดิน": "ซื่อสัตย์รักษาคำพูด (信) หนักแน่นน่าเชื่อถือ และกตัญญูต่อผู้มีพระคุณ",
  "ทอง": "เที่ยงธรรมมีหลักการ (义) รับผิดชอบ มีวินัย และยึดความถูกต้องเป็นที่ตั้ง",
  "น้ำ": "ใฝ่ปัญญา (智) หมั่นศึกษาหาความรู้ ยืดหยุ่น และมองการณ์ไกล",
};

/** ความหมายของครอบครัว/ผู้ใหญ่ในบ้านตาม 12 เซียงแซ (self-seat ของเสา) — มีคำแปล ไม่ใช่แค่ชื่อสภาวะ */
export const QI_FAMILY_TH: Record<string, string> = {
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
/** วงศาคณาญาติจากปฏิกิริยาธาตุ (ตารางหลักชิง 六亲) — เทียบธาตุเทียบดิถี → ญาติที่ธาตุนั้นแทน */
export const FAMILY_KINSHIP_TH: Record<RelationRole, string> = {
  "คู่ธาตุ": "ตัวเรา พี่น้อง (ชาย/หญิง)",
  "ธาตุถ่ายเท": "คุณย่า คุณตา ลูกศิษย์ (+ ลูก ถ้าเป็นดวงหญิง)",
  "ธาตุส่งเสริม": "คุณแม่ คุณปู่ ครู/อาจารย์", // กำเนิดธาตุ (印)
  "ธาตุพิฆาต": "คุณพ่อ (+ ภรรยา ถ้าเป็นดวงชาย)", // ธาตุที่ดิถีพิฆาต (财)
  "พิฆาตธาตุ": "คุณยาย นักบวช (+ สามี ถ้าดวงหญิง / ลูก ถ้าดวงชาย)", // ธาตุที่พิฆาตดิถี (官杀)
};

/** บล็อก "วงศาคณาญาติตามปฏิกิริยาธาตุ" — 5 ธาตุเทียบดิถี → ญาติ + ธาตุนั้นปรากฏในดวงหรือไม่ (เด่น/ห่าง) */
function buildKinshipByElementLines(calculatedState: CalculatedStateValue): string[] {
  const dm = dayMasterElement(calculatedState);
  const total = calculatedState.elementAnalysis.totalCounts;
  // เรียงตามตารางหลักชิง: คู่ธาตุ, ส่งเสริม, ลาภ(พิฆาต), ถ่ายเท, อำนาจ(พิฆาตธาตุ)
  const elements: SupportedElementValue[] = [
    dm,
    inverseGenerate(dm),
    CONTROLS[dm] as SupportedElementValue,
    GENERATES[dm] as SupportedElementValue,
    resolveOfficerElement(dm),
  ];
  return elements.map((element) => {
    const role = resolveRelationRole(dm, element);
    const present = (total[element] ?? 0) > 0;
    const note = present
      ? "มีในดวง — สายญาตินี้มีบทบาท/ผูกพันชัด"
      : "ไม่ปรากฏในดวง — สายญาตินี้มักห่างเหินหรือมีบทบาทน้อย";
    return `• ${role} (ธาตุ${elementLabel(element)}) = ${K("FAMILY_KINSHIP_TH", FAMILY_KINSHIP_TH)[role]} → ${note}`;
  });
}

function buildFamilyReading(calculatedState: CalculatedStateValue): string | null {
  const month = calculatedState.fourPillars.month;
  const year = calculatedState.fourPillars.year;
  const monthQi = resolveDisplayTwelveQiStage(month.stem, month.branch); // self-seat ของเสาพ่อแม่
  const yearQi = resolveDisplayTwelveQiStage(year.stem, year.branch); // self-seat ของเสาปู่ย่าตายาย

  const segments = [
    `ครอบครัวอ่านจากเสาเดือนเป็นหลัก (พ่อแม่) และเสาปี (ปู่ย่าตายาย/วงศ์ตระกูล)`,
    // ภาพรวมพ่อแม่จาก self-seat เสาเดือน
    `เสาเดือน ${month.stem}${month.branch} (${monthQi}): ${K("QI_FAMILY_TH", QI_FAMILY_TH)[monthQi] ?? "บรรยากาศพ่อแม่/ครอบครัวตามจังหวะของเสานี้"}`,
    // พ่อ = ราศีบนหลักเดือน (ก้าน = บทบาทที่แสดงออก/นำ); แม่ = ราศีล่างหลักเดือน (กิ่ง = ฐานหลักภายในบ้าน)
    `พ่อ (ราศีบนหลักเดือน ${month.stem} ธาตุ${elementLabel(stemElement(month.stem))}): เป็นบทบาทที่แสดงออกและขับเคลื่อนบ้าน มักขยันและเป็นผู้นำทิศทางของครอบครัว`,
    `แม่ (ราศีล่างหลักเดือน ${month.branch} ธาตุ${elementLabel(branchElement(month.branch))}): เป็นฐานหลักภายในบ้าน มักมีอำนาจในการดูแลและตัดสินเรื่องในครอบครัว`,
    // ปู่ย่าตายาย/รากเหง้าจาก self-seat เสาปี
    `เสาปี ${year.stem}${year.branch} (${yearQi}): ${K("QI_FAMILY_TH", QI_FAMILY_TH)[yearQi] ?? "รากเหง้าวงศ์ตระกูลที่ส่งต่อมา"} — สะท้อนพื้นฐานและสิ่งที่บรรพบุรุษส่งต่อให้`,
  ];
  // วงศาคณาญาติตามปฏิกิริยาธาตุ (六亲 ตารางหลักชิง) — แม่นกว่าการดูตำแหน่งเสาอย่างเดียว
  segments.push(
    `วงศาคณาญาติตามปฏิกิริยาธาตุ (เทียบดิถี ${calculatedState.dayMaster} ธาตุ${elementLabel(dayMasterElement(calculatedState))}):\n${buildKinshipByElementLines(calculatedState).join("\n")}`,
  );
  const familyChong = buildFamilyChongNote(calculatedState);
  if (familyChong) {
    segments.push(familyChong);
  }
  return segments.join("\n\n");
}

/** บท 8 เพื่อน/ศัตรู = คู่ธาตุ (same) + 12 เชี่ยงแซ ดี→เพื่อน เสีย→ศัตรู */
// ตำแหน่งเสา → กลุ่มคนที่เกี่ยวข้องในบท "เพื่อน/ศัตรู" (ใช้ตำแหน่งทาย ตามวิธีซินแซ)
export const FRIEND_POSITION_TH: Record<PillarKey, string> = {
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
    const who = K("FRIEND_POSITION_TH", FRIEND_POSITION_TH)[pillar];
    const verdict = kind === "friend"
      ? `มิตรแท้/ผู้สนับสนุน — ${who} (ธาตุ${element}) เข้ามาหนุน`
      : kind === "foe"
        ? `ระวังเป็นคู่แข่ง/ศัตรู — แรงเสียดทานจาก${who} (ธาตุ${element})`
        : `${who} (ธาตุ${element}) แบบที่ต้องคอยประคองและเคลียร์ปัญหา (ดี-ร้ายปนกัน)`;
    return `${PILLAR_LABEL_TH[pillar]} ${char} (${qi}) = ${verdict}`;
  });
  // ข้อสังเกตเรื่อง "ผลประโยชน์เมื่อร่วมงานกับเพื่อน" ตามกำลังดิถี (เลียนโครง your life code)
  const band = resolveStrengthBand(calculatedState);
  const insight =
    band === "very-strong" || band === "strong"
      ? "ข้อสังเกตเรื่องผลประโยชน์: ดิถีแข็งมีพลังพอจะเป็นฝ่ายนำและให้ เมื่อร่วมงานกับเพื่อน คุณมักได้ชื่อเสียง การยอมรับ และภาพลักษณ์ ส่วนเพื่อนมักได้ผลประโยชน์ทางการเงินมากกว่า — ไม่ใช่เสียเปรียบ แต่สะท้อนว่าจุดแข็งของคุณคือบารมีมากกว่าตัวเงินตรง ๆ ควรตกลงเรื่องผลตอบแทนให้ชัดก่อนเริ่มงาน"
      : band === "very-weak" || band === "weak"
        ? "ข้อสังเกตเรื่องผลประโยชน์: ดิถีอ่อนได้เพื่อน/พันธมิตรเป็นแรงหนุนสำคัญที่ช่วยแบกภาระและเปิดโอกาส ควรเลือกคบคนที่เติมพลังและจุดที่ดวงขาดจริง ๆ แล้วตอบแทนน้ำใจอย่างสม่ำเสมอ มิตรภาพจะกลายเป็นทุนชีวิตที่ยั่งยืน"
        : "ข้อสังเกตเรื่องผลประโยชน์: ดิถีสมดุลให้-รับกับเพื่อนได้พอ ๆ กัน ความสัมพันธ์จะยืนยาวเมื่อรักษาสมดุลของผลประโยชน์และน้ำใจให้เท่าเทียม";
  if (lines.length === 0) {
    return `${lead}\n\nผังหลักไม่มีตำแหน่งเด่นด้านมิตร/ศัตรูชัดเจน เพื่อนและคู่แข่งจึงเข้ามาเป็นช่วงตามวัยจร\n\n${insight}`;
  }
  return `${lead}\n\n${lines.join("\n")}\n\n${insight}`;
}

/** บท 10 ลูกน้อง/บริวาร = เสายาม (ฐานบริวาร) + ดาวถ่ายเท (output) อ่านตาม 12 เชี่ยงแซ ดีคือดี เสียคือเสีย */
/** career-relations.txt: คำทำนาย 12 เชี่ยงแซ ราย relation (employee/partner/boss) จากคู่สมพงษ์การงาน */
function parseCareerRelationVerdicts(): Map<string, Map<string, string>> | null {
  const lines = readExtractedLines("career-relations.txt");
  if (!lines) {
    return null;
  }
  const map = new Map<string, Map<string, string>>();
  for (const line of lines) {
    const match = line.match(/^\[(\w+)\]\s*([^|]+?)\s*\|\s*(.+)$/);
    if (!match) {
      continue;
    }
    const [, relation, qi, verdict] = match;
    if (!map.has(relation)) {
      map.set(relation, new Map());
    }
    map.get(relation)!.set(qi.trim(), verdict.trim());
  }
  return map.size > 0 ? map : null;
}

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

  // (3) คำทำนายบริวารตามตำรา (คู่สมพงษ์การงาน: ลูกน้อง>ตัวเรา) ตาม 12 เชี่ยงแซที่เสายาม
  const empVerdict = parseCareerRelationVerdicts()?.get("employee")?.get(qi);
  const empLine = empVerdict ? `คำทำนายบริวารตามตำรา (เซียงแซ ${qi}): ${empVerdict}` : null;

  return [
    `ลูกน้อง/บริวารดูจากเสายาม (${PILLAR_CONTEXT_MAP.hour.businessPerson}) ร่วมกับดาวถ่ายเท (ธาตุ${elementLabel(output)}) อ่านตาม 12 เชี่ยงแซ ดีคือดี เสียคือเสีย`,
    // บรรทัดฐานเป็นกลาง (ไม่ตัดสินดี/ร้ายเอง) — คุณภาพอ่านจากเซียงแซในบรรทัดถัดไป กันขัดแย้งเมื่อเซียงแซไม่ดี
    `เสายาม ${hour.stem}${hour.branch} ธาตุ${elementLabel(stemElement(hour.stem))}${qi ? ` (เซียงแซ ${qi})` : ""} = ฐานของลูกน้อง/บริวารและผลงาน — คุณภาพอ่านจากเซียงแซดังนี้:`,
    hourVerdict,
    empLine,
    ...outputLines,
  ].filter(Boolean).join("\n\n");
}

/** คณะ/สาขา/คอสตามธาตุ (สรุปจาก "อาชีพของธาตุต่างเทียบการเรียนคณะ สาขา คอสเรียน") — แนะนำสายเรียนจริง */
export const FACULTY_BY_ELEMENT_TH: Record<ThaiElement, string> = {
  "ดิน": "วิศวกรรมโยธา/สำรวจ, ภูมิสถาปัตย์(จัดสรรที่ดิน), ธุรกิจอสังหาริมทรัพย์, วัสดุศาสตร์/ธรณีวิทยา/วิศวกรรมเซรามิก, สัตวแพทย์/สัตวศาสตร์-ปฐพีวิทยา-เกษตร, ทันตแพทย์/ออร์โธปิดิกส์ (ฟัน-กระดูก-ผิวหนัง); ปวช.ช่างก่อสร้าง-โยธา; คอสอสังหาฯ/ประเมินราคา/เครื่องหนัง",
  "ทอง": "วิศวกรรมโลหการ/เครื่องกล/ยานยนต์/อุตสาหการ/ไฟฟ้า-อิเล็กทรอนิกส์/เหมืองแร่, วิทยาการคอมพิวเตอร์, อัญมณีวิทยา/ออกแบบเครื่องประดับ, นิติศาสตร์-รัฐศาสตร์, รร.นายร้อย/นายเรือ/ตำรวจ; ปวช.ช่างยนต์-กลโรงงาน-เชื่อมโลหะ; คอส CNC/ซ่อมอิเล็กทรอนิกส์/ตัดขนสัตว์(กรรไกร-ของมีคม)",
  "น้ำ": "พาณิชยศาสตร์-บัญชี/บริหารธุรกิจ/เศรษฐศาสตร์ (การเงิน-การบัญชี), โลจิสติกส์-ซัพพลายเชน, การท่องเที่ยว-โรงแรม, วิทยาศาสตร์ทางทะเล/ประมง; สายค้าขาย-บริการ-ขนส่ง-นายหน้า/affiliate-ลูกค้าออนไลน์-อาบน้ำ/สปาสัตว์เลี้ยง",
  "ไม้": "ครุศาสตร์/ศึกษาศาสตร์(พัฒนาหลักสูตร/สื่อ), อักษรศาสตร์-ศิลปศาสตร์-มนุษยศาสตร์(ภาษา/นักเขียน/นักแปล), นิเทศ-วารสารศาสตร์(การพิมพ์), เกษตร-วนศาสตร์, แพทย์แผนไทย/เภสัช(สมุนไพร), สังคมสงเคราะห์ศาสตร์, ออกแบบ/สถาปัตย์งานไม้, วิศวกรรมปิโตรเลียม(เชื้อเพลิงชีวมวล)",
  "ไฟ": "แพทย์/พยาบาล/เภสัชศาสตร์, วิทยาศาสตร์เครื่องสำอาง, ทัศนมาตรศาสตร์(สายตา/แว่น), ครุศาสตร์(ครู/ติวเตอร์/นักวิชาการ), นิเทศ-ศิลปกรรม(สื่อ/ภาพ/ดีไซน์), สถาปัตยกรรม(งานออกแบบอาคาร), วิศวกรรมไฟฟ้า/พลังงาน/ปิโตรเลียม(เชื้อเพลิง-ความร้อน), โหราศาสตร์-ที่ปรึกษา-นักวางกลยุทธ์-นักการตลาด; คอส Content Creator/Storytelling, Social Media Marketing",
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

  // Step 6.2: ระดับ/แนวการศึกษาตามเชี่ยงแซของ "ดาวถ่ายเท" (食神 ตัวแทน) รายหลัก
  // ยกหลักที่มีดาวถ่ายเทปรากฏจริงก่อน (เด่นที่สุด) แล้วตามด้วยหลักที่เหลือ
  const transfer = buildOutputTransferReading(calculatedState);
  const orderedPillars =
    transfer.pillars.filter((pillar) => pillar.carriesOutputElement).length > 0
      ? [
          ...transfer.pillars.filter((pillar) => pillar.carriesOutputElement),
          ...transfer.pillars.filter((pillar) => !pillar.carriesOutputElement),
        ]
      : transfer.pillars;
  const stageLines = orderedPillars.map(
    (pillar) => `${pillar.context} (ดาวถ่ายเทตกเชี่ยงแซ ${pillar.stageThai}) = ${pillar.education}`,
  );
  segments.push(`ระดับและแนวการศึกษาตามเชี่ยงแซของดาวถ่ายเทรายหลัก (Step 6.2):\n${stageLines.join("\n")}`);

  // แนะนำคณะ/สาขา/คอสจริงตามธาตุที่ดวงต้องการ (useful god)
  segments.push(
    `ควรเรียนสายที่ตรงกับธาตุที่ดวงต้องการ (useful god: ${useful.join(" / ")}) เพื่อแปลงความรู้เป็นรายได้:`,
  );
  for (const el of useful) {
    if (K("FACULTY_BY_ELEMENT_TH", FACULTY_BY_ELEMENT_TH)[el]) {
      segments.push(`• สายธาตุ${el} — ${K("FACULTY_BY_ELEMENT_TH", FACULTY_BY_ELEMENT_TH)[el]}`);
    }
  }

  return segments.join("\n\n");
}

/** บท 16 การพูด = ดาวถ่ายเท (output/食傷) ตกเชี่ยงแซรายหลัก → ลักษณะการพูด/การฟัง (Step 6.2) */
function buildSpeechReading(calculatedState: CalculatedStateValue): string | null {
  const transfer = buildOutputTransferReading(calculatedState);

  const segments: string[] = [
    `การพูดและการสื่อสารอ่านจาก "ดาวถ่ายเท" (ธาตุ${transfer.outputElementLabelThai}) ` +
      `ว่าตกสภาวะ 12 เชี่ยงแซตัวใดในแต่ละหลัก เชี่ยงแซดีจะสื่อสารได้น่าเชื่อถือ ส่วนเชี่ยงแซเสียมักพูดพลาดหรือสื่อสารติดขัด`,
  ];

  // จุดที่ดาวถ่ายเทปรากฏจริงในดวง = ลักษณะการพูดที่เด่นชัดที่สุด ยกขึ้นก่อน
  const carrying = transfer.pillars.filter((pillar) => pillar.carriesOutputElement);
  const ordered = carrying.length > 0 ? carrying : transfer.pillars;

  const lines = ordered.map(
    (pillar) =>
      `${pillar.context} (ดาวถ่ายเทตกเชี่ยงแซ ${pillar.stageThai}) = ${pillar.speech}`,
  );
  segments.push(lines.join("\n"));

  return segments.join("\n\n");
}

/** บท 5 พรสวรรค์ = ดาวถ่ายเท (output) + สภาวะ 12 เชี่ยงแซ (ทักษะ/วิเคราะห์/สื่อสาร ไม่ใช่บุคลิกทั่วไป) */
/** ชนิดดาวถ่ายเท: 食神 (พ้องขั้วดิถี = นุ่มนวล/ประณีต) หรือ 傷官 (ต่างขั้ว = เฉียบคม/วาทศิลป์) */
export const OUTPUT_STAR_TALENT_TH = {
  eating: "พรสวรรค์แบบ “ดาวถ่ายเทพ้องขั้ว (食神)” — ถ่ายทอดอย่างนุ่มนวลมีรสนิยม สร้างผลงานประณีตและต่อเนื่อง เด่นงานสอน ดูแล บริการ อาหาร ศิลปะ และการทำให้คนรอบข้างสบายใจ",
  hurting: "พรสวรรค์แบบ “ดาวถ่ายเทต่างขั้ว (傷官)” — เฉียบคมและมีวาทศิลป์ เด่นเรื่องการพูด โน้มน้าว นำเสนอ แสดงออก คิดนอกกรอบและสร้างสรรค์สิ่งใหม่ (ควรระวังความหยิ่งในความสามารถและคำพูดที่ตรงเกินไป)",
} as const;

/** ความหมายพรสวรรค์ตาม 12 เซียงแซ — อ่านเชิงบวก (ศักยภาพ/ความถนัด) สั้นกระชับ */
export const QI_TALENT_POS_TH: Record<string, string> = {
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
    // รูปแบบพลังของความสามารถ (12 เซี่ยงแซ) + ทิศทางที่ควรไปแสดงออก (ธาตุถ่ายเท) — อ่านผสานกันเสมอ
    const stageTalent = K("QI_TALENT_POS_TH", QI_TALENT_POS_TH)[qi] ?? "ใช้ทักษะได้ดีตามจังหวะที่เหมาะ";
    const aptitude = resolveTalentAptitude(qi, output);
    const meaning = aptitude ? `${stageTalent} — โดดเด่นด้าน${aptitude}` : stageTalent;
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

  // Step 6.2: มิติวาทศิลป์/การสื่อสาร — ดาวถ่ายเทตกเชี่ยงแซตัวใดที่หลักซึ่งปรากฏจริง
  // (เป็นพรสวรรค์การพูด/ถ่ายทอด ส่วนรายละเอียดเต็มอยู่ในบทการพูด)
  const transfer = buildOutputTransferReading(calculatedState);
  const carrying = transfer.pillars.filter((pillar) => pillar.carriesOutputElement);
  const speechPillar = carrying[0] ?? transfer.pillars.find((pillar) => pillar.pillarKey === "day");
  // รูปแบบพลังของความสามารถ (เซี่ยงแซ) ผสานทิศทางตามธาตุถ่ายเท — เป็นประโยคนำของบท
  const patternHeadline = speechPillar ? resolveStageHeadline(speechPillar.stageChinese) : null;
  const patternAptitude = speechPillar
    ? resolveTalentAptitude(speechPillar.stageChinese, output)
    : null;
  const patternLine =
    patternHeadline && patternAptitude
      ? `รูปแบบพลังพรสวรรค์ (เซี่ยงแซ ${speechPillar!.stageThai}): เป็น “${patternHeadline}” และเมื่อผสานกับธาตุถ่ายเท (ธาตุ${elementLabel(output)}) ความถนัดจะออกแนว${patternAptitude}`
      : null;
  const communicationLine = speechPillar
    ? `วาทศิลป์/การสื่อสาร (ดาวถ่ายเทตกเชี่ยงแซ ${speechPillar.stageThai}): ${speechPillar.speech}`
    : null;

  if (hits.length === 0 && typeLines.length === 0) {
    // ไม่มีดาวถ่ายเทในผัง = "เก่งแต่ไม่โชว์" (ตามตำราลักษณะนิสัย + เทียบ your life code)
    const outLabel = elementLabel(output);
    const talentTiming = findTimingByElement(calculatedState, output, {
      rising: "พรสวรรค์เปล่งประกายชัด ได้แสดงผลงานและเป็นที่ยอมรับ",
      falling: "พรสวรรค์ยังไม่ได้ใช้เต็มที่ ควรสะสมและฝึกฝนรอจังหวะ",
      transitional: "เริ่มได้ลองใช้ความสามารถ แต่ยังไม่นิ่ง ค่อย ๆ ปรับ",
    });
    const segments = [
      patternLine,
      `ดวงนี้ไม่มี “ดาวถ่ายเท” (ธาตุ${outLabel}) ปรากฏเด่นในผัง จึงจัดเป็นกลุ่ม “เก่งแต่ไม่ค่อยแสดงออก” — เป็นคนมีความรู้และความสามารถสูงแต่ไม่ชอบโอ้อวด หลายคนมักไม่รู้ศักยภาพที่แท้จริงของคุณ จนกว่าจะได้ร่วมงานหรือพูดคุยกันอย่างจริงจัง`,
      `พรสวรรค์ที่แท้จริงคือการเรียนรู้เชิงลึกและการหยั่งรู้ด้วยตนเอง เมื่อสนใจเรื่องใดมักศึกษาจนเข้าใจถึงแก่นและต่อยอดเป็นคุณค่าใหม่ได้ ศักยภาพสูงสุดจะเปล่งออกเมื่อนำความรู้ไปถ่ายทอด แบ่งปัน หรือวางระบบให้ผู้อื่นได้ใช้ประโยชน์`,
      communicationLine,
      talentTiming.length > 0
        ? `ช่วงวัยที่พรสวรรค์ (ดาวถ่ายเท ธาตุ${outLabel}) จะได้แสดงออกตามวัยจร:\n${talentTiming.join("\n")}`
        : null,
    ].filter((segment): segment is string => Boolean(segment));
    return segments.join("\n\n");
  }
  return [
    ...(patternLine ? [patternLine] : []),
    ...typeLines,
    ...hits,
    ...(communicationLine ? [communicationLine] : []),
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

// ───────── โครงกล่อง (box) ทุกบท ตาม docs/ทายดวง 15 หัวข้อ.docx ─────────
// ทุกบทเริ่มด้วย "กล่องเกริ่นนำ" (คอนเซ็ปต์บท + พาดหัวดิถีสไตล์ YLC) แล้วตามด้วยกล่องหัวข้อย่อย
// บทที่หัวข้อย่อยแม็พจาก prose เดิมได้ → ใช้ spec จัดย่อหน้าเข้ากล่อง (prose path ไม่แตะ)

const INTRO_BOX_TITLE = "เกริ่นนำ";

/** กล่องเกริ่นนำของบท = คอนเซ็ปต์บท (CHAPTER_INTRO_TH) + พาดหัวดิถีสไตล์ YLC (buildChapterOpening) */
function buildIntroBox(calculatedState: CalculatedStateValue, topicId: string): string {
  return readingBox(INTRO_BOX_TITLE, [
    K("CHAPTER_INTRO_TH", CHAPTER_INTRO_TH)[topicId],
    buildChapterOpening(calculatedState, topicId),
  ]);
}

/** spec จัดย่อหน้า prose เข้ากล่องตามหัวข้อย่อย docx — rule แรกที่ match ชนะ, ไม่ match → กล่อง main */
type TopicBoxSpec = {
  /** หัวกล่องแรก (รับย่อหน้าที่ไม่เข้า rule ไหน) */
  main: string;
  rules: Array<{ title: string; match: RegExp }>;
  /** ย่อหน้าที่ตัดออกจากกล่อง (คงใน prose) เช่น บล็อกช่วงอายุที่ย้ายไปบท 12 */
  exclude?: RegExp;
  /** หัวกล่องข้อเสนอแนะปิดท้าย (default "ข้อเสนอแนะ") */
  adviceTitle?: string;
};

/** จัดย่อหน้าของ prose body เข้ากล่องตาม spec + ปิดด้วยกล่องข้อเสนอแนะ (chapter advice) */
function buildBoxesFromBody(
  calculatedState: CalculatedStateValue,
  topicId: string,
  body: string,
  spec: TopicBoxSpec,
): string | null {
  const paragraphs = body.split("\n\n").map((part) => part.trim()).filter((part) => part.length > 0);
  if (paragraphs.length === 0) {
    return null;
  }
  const buckets = new Map<string, string[]>();
  buckets.set(spec.main, []);
  for (const rule of spec.rules) {
    if (!buckets.has(rule.title)) {
      buckets.set(rule.title, []);
    }
  }
  for (const paragraph of paragraphs) {
    if (spec.exclude?.test(paragraph)) {
      continue;
    }
    const rule = spec.rules.find((entry) => entry.match.test(paragraph));
    buckets.get(rule ? rule.title : spec.main)!.push(paragraph);
  }
  // กล่องข้อเสนอแนะ: ถ้าชื่อชนกับกล่องที่มีอยู่ (เช่นบทสุขภาพ) ให้รวมเข้ากล่องเดิมแทนเปิดกล่องใหม่
  const adviceTitle = spec.adviceTitle ?? "ข้อเสนอแนะ";
  const advice = buildChapterAdvice(calculatedState, topicId);
  const boxes: string[] = [];
  if (buckets.has(adviceTitle)) {
    buckets.get(adviceTitle)!.push(advice);
  }
  for (const [title, parts] of buckets.entries()) {
    boxes.push(readingBox(title, parts));
  }
  if (!buckets.has(adviceTitle)) {
    boxes.push(readingBox(adviceTitle, [advice]));
  }
  const filtered = boxes.filter((box) => box.length > 0);
  return filtered.length > 0 ? filtered.join("\n\n") : null;
}

/** spec รายบท (หัวข้อย่อยตาม docx) สำหรับบทที่จัดกล่องจาก prose เดิม */
const TOPIC_BOX_SPECS: Record<string, TopicBoxSpec> = {
  talent: {
    main: "พรสวรรค์จากดาวถ่ายเท (ดิถี → การกระทำ → ผลลัพธ์)",
    rules: [{ title: "วาทศิลป์/การสื่อสาร", match: /^วาทศิลป์\/การสื่อสาร/ }],
    adviceTitle: "ข้อเสนอแนะ (พรสวรรค์นำไปใช้ในอาชีพ/ธุรกิจที่ควรทำ)",
  },
  family: {
    main: "ภาพรวมครอบครัวและวงศาคณาญาติ",
    rules: [
      { title: "ลักษณะหลักปี (ปู่ย่าตายาย บรรพบุรุษ)", match: /^เสาปี / },
      { title: "ลักษณะหลักเดือน (ครอบครัวพ่อแม่ที่ให้กำเนิด)", match: /^เสาเดือน / },
      { title: "ลักษณะพ่อ (ราศีบนหลักเดือน)", match: /^พ่อ \(/ },
      { title: "ลักษณะแม่ (ราศีล่างหลักเดือน)", match: /^แม่ \(/ },
      { title: "สิ่งพึงระวัง", match: /^การชง \(冲\)/ },
    ],
    adviceTitle: "ข้อเสนอแนะ (จิตวิทยา พฤติกรรมแก้ไข)",
  },
  love_partner: {
    main: "ลักษณะชีวิตคู่ตามพื้นดวง",
    rules: [
      { title: "คู่ครองมีลักษณะอย่างไร", match: /^ลักษณะคู่ครอง \(ตารางหลักวัน|^ลักษณะคู่รักตามตำรา/ },
      { title: "มีคู่ครองที่เหมาะสมหรือไม่", match: /ปรากฏหลายตำแหน่งในดวง/ },
      { title: "สิ่งที่ควรระวัง", match: /^การผั่ว \(破\)|^การชง \(冲\)/ },
    ],
    adviceTitle: "ข้อเสนอแนะ (จิตวิทยา พฤติกรรมแก้ไข)",
  },
  partnership: {
    main: "ลักษณะหุ้นส่วนตามพื้นดวง",
    rules: [
      { title: "ลักษณะมีส่วนในการหา/รักษา/ยักยอก/ทรัพย์", match: /^แนวทางทำธุรกิจ\/หุ้นส่วน:/ },
      { title: "ควรมี/ไม่มี ถ้ามีแล้วบริหารจัดการอย่างไร", match: /^ราศีล่างหลักวัน|^คำทำนายหุ้นส่วน/ },
    ],
    // บล็อกช่วงอายุ (วัยจร) ตัดออกจากกล่อง — เรื่องจังหวะอายุรวมที่บท 12 (คงใน prose เดิม)
    exclude: /^ช่วงอายุที่/,
  },
  subordinates: {
    main: "ลักษณะบริวารตามพื้นดวง",
    rules: [
      { title: "ลักษณะมีส่วนในการหา/รักษา/ยักยอก/ทรัพย์", match: /\(ดาวถ่ายเทธาตุ/ },
      { title: "ควรมี/ไม่มี ถ้ามีแล้วบริหารจัดการอย่างไร", match: /^คำทำนายบริวารตามตำรา/ },
    ],
  },
  education: {
    main: "วิธี/ทักษะที่ทำให้โชคลาภเพิ่มพูน หน้าที่การงานก้าวหน้า",
    rules: [
      { title: "เรียนวิชาตามอาชีพถูกดวง", match: /^ควรเรียนสายที่ตรงกับธาตุ|^• สายธาตุ/ },
    ],
  },
  health: {
    main: "โรคจากปฏิกิริยาในพื้นดวง/วัยจร (เจ๊าะ/ผั่ว/ชง และตำแหน่งสภาวะตก)",
    rules: [
      { title: "โรคจากธาตุที่น้อยเกินไป/ธาตุที่มากเกินไป", match: /^ธาตุ.+(อ่อนแอ|มากเกินไป):/ },
      {
        title: "ข้อเสนอแนะการดูแลและการรักษา",
        match: /^แนวทางดูแล:|^ในเชิงพฤติกรรม/,
      },
    ],
    adviceTitle: "ข้อเสนอแนะการดูแลและการรักษา",
  },
  colors_directions: {
    main: "เสื้อผ้าเครื่องแต่งกาย / สีมงคลประจำดวง",
    rules: [
      { title: "โทรศัพท์ โน้ตบุ๊ก แท็บเล็ต เครื่องมือหาเงิน", match: /^สีกระเป๋าสตางค์/ },
      { title: "รถยนต์", match: /^สีรถยนต์/ },
      { title: "ทิศมงคล", match: /^ทิศมงคล:/ },
    ],
  },
  guardian_deities: {
    main: "องค์เทพคุ้มครองดวงชะตา",
    rules: [{ title: "ทำบุญเสริมดวง", match: /^สิ่งศักดิ์สิทธิ์ตามธาตุที่ดวงต้องการ/ }],
  },
};

/** หัวข้อย่อยบท 8 (เพื่อน/ศัตรู) ตาม docx — จัดกล่องจาก scanPositionRelations ตรง ๆ (มิตร/ศัตรูแยกกล่อง) */
function buildFriendsFoesBoxes(calculatedState: CalculatedStateValue): string | null {
  const lead =
    "เพื่อน/ศัตรูดูจาก “ตัวอักษรในผัง” ที่ขึ้น 12 เชี่ยงแซ — ตำแหน่งที่ขึ้นเชี่ยงแซดีคือมิตรแท้/ผู้สนับสนุน ส่วนตำแหน่งที่เชี่ยงแซเสีย (ซวย/ซี่/เจ๊าะ) คือคู่แข่ง/ศัตรู และทายตามความหมายของเสานั้น";
  const scan = scanPositionRelations(calculatedState);
  const lineOf = ({ pillar, char, element, qi, kind }: ReturnType<typeof scanPositionRelations>[number]) => {
    const who = K("FRIEND_POSITION_TH", FRIEND_POSITION_TH)[pillar];
    const verdict = kind === "friend"
      ? `มิตรแท้/ผู้สนับสนุน — ${who} (ธาตุ${element}) เข้ามาหนุน`
      : kind === "foe"
        ? `ระวังเป็นคู่แข่ง/ศัตรู — แรงเสียดทานจาก${who} (ธาตุ${element})`
        : `${who} (ธาตุ${element}) แบบที่ต้องคอยประคองและเคลียร์ปัญหา (ดี-ร้ายปนกัน)`;
    return `${PILLAR_LABEL_TH[pillar]} ${char} (${qi}) = ${verdict}`;
  };
  const friendLines = scan.filter((entry) => entry.kind === "friend").map(lineOf);
  const foeLines = scan.filter((entry) => entry.kind !== "friend").map(lineOf);

  const band = resolveStrengthBand(calculatedState);
  const insight =
    band === "very-strong" || band === "strong"
      ? "ข้อสังเกตเรื่องผลประโยชน์: ดิถีแข็งมีพลังพอจะเป็นฝ่ายนำและให้ เมื่อร่วมงานกับเพื่อน คุณมักได้ชื่อเสียง การยอมรับ และภาพลักษณ์ ส่วนเพื่อนมักได้ผลประโยชน์ทางการเงินมากกว่า — ไม่ใช่เสียเปรียบ แต่สะท้อนว่าจุดแข็งของคุณคือบารมีมากกว่าตัวเงินตรง ๆ ควรตกลงเรื่องผลตอบแทนให้ชัดก่อนเริ่มงาน"
      : band === "very-weak" || band === "weak"
        ? "ข้อสังเกตเรื่องผลประโยชน์: ดิถีอ่อนได้เพื่อน/พันธมิตรเป็นแรงหนุนสำคัญที่ช่วยแบกภาระและเปิดโอกาส ควรเลือกคบคนที่เติมพลังและจุดที่ดวงขาดจริง ๆ แล้วตอบแทนน้ำใจอย่างสม่ำเสมอ มิตรภาพจะกลายเป็นทุนชีวิตที่ยั่งยืน"
        : "ข้อสังเกตเรื่องผลประโยชน์: ดิถีสมดุลให้-รับกับเพื่อนได้พอ ๆ กัน ความสัมพันธ์จะยืนยาวเมื่อรักษาสมดุลของผลประโยชน์และน้ำใจให้เท่าเทียม";

  const boxes = [
    readingBox("มิตรแท้ มีใครบ้าง ลักษณะอย่างไร", [
      lead,
      ...(friendLines.length > 0
        ? friendLines
        : ["ผังหลักไม่มีตำแหน่งมิตรเด่นชัดเจน เพื่อนผู้สนับสนุนจึงเข้ามาเป็นช่วงตามวัยจร"]),
    ]),
    readingBox("สิ่งที่ควรระวัง/ข้อเสนอแนะเกี่ยวกับมิตรแท้", [insight]),
    readingBox("ศัตรู มีใครบ้าง ลักษณะอย่างไร", [
      ...(foeLines.length > 0
        ? foeLines
        : ["ผังหลักไม่มีตำแหน่งศัตรู/คู่แข่งเด่นชัดเจน แรงเสียดทานมักมาเป็นช่วงตามวัยจร"]),
    ]),
    readingBox("สิ่งที่ควรระวัง/ข้อเสนอแนะเกี่ยวกับศัตรู", [
      buildChapterAdvice(calculatedState, "friends_foes"),
    ]),
  ].filter((box) => box.length > 0);
  return boxes.length > 0 ? boxes.join("\n\n") : null;
}

/**
 * บท 12 (วัยจร) ฉบับ "กล่อง" — ลิสต์ช่วงอายุ 16 วัยจร (แทนตารางเสริมท้ายเอกสารที่ถูกถอดออก)
 * แต่ละช่วง = อายุ/สัญลักษณ์/ปฏิกิริยา → 12 เชี่ยงแซ/คำทำนายเชิงลึก (ข้อมูลเดียวกับตารางเดิม)
 */
function buildTurningPointsBoxes(calculatedState: CalculatedStateValue): string | null {
  const rows = buildRelationshipLinesMapping(calculatedState);
  if (rows.length === 0) {
    return null;
  }
  const current = findCurrentDaYunPhase(calculatedState);
  const lead =
    "วิเคราะห์จังหวะชีวิตตั้งแต่วัยจรแรกจนถึงบั้นปลาย โดยดูบทบาทธาตุของวัยจรควบคู่สภาวะ 12 เชี่ยงแซเทียบดิถี — เกรดแต่ละช่วง: ⭐⭐⭐ ยุคทอง (รุกเต็มที่) · ⭐⭐ โอกาสมาพร้อมภาระ (รุกแต่ต้องหาคนช่วย) · ⭐ เฝ้าระวัง (ตั้งรับ) · ◇ ช่วงทั่วไป";
  const lines = rows.map((row) => {
    const tag = current && row.ageRange === current.ageRange ? " ◆ ช่วงปัจจุบัน" : "";
    return `อายุ ${row.ageRange}${tag} (${row.symbol} — ${row.relationLine}): ${luckGradeToStars(row.deepNote)}`;
  });

  // ปีจรปัจจุบัน (liu nian) + จังหวะปัจจุบัน + พยากรณ์รายปี — โครงเดียวกับ buildLuckCycleReading
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
    liuNianLine = `ปีจรปัจจุบัน (${liuNian.stem}${liuNian.branch} ธาตุ${elementLabel(lnElement)} เป็น${lnRole}${lnQi ? ` → ${lnQi}` : ""}): ${luckGradeToStars(lnVerdict)}`;
  }
  const timing = buildCurrentTimingLines(calculatedState);
  const timingBlock = timing.length > 0 ? `จังหวะ ณ ปัจจุบัน:\n${timing.join("\n")}` : "";
  const yearly = buildLiuNianYearlyForecast(calculatedState);

  const boxes = [
    readingBox("ลิสต์ช่วงอายุ 16 วัยจร (ช่วงอายุ/ปฏิกิริยา/12 เชี่ยงแซ/คำทำนาย)", [lead, ...lines]),
    readingBox("ปีจรปัจจุบันและพยากรณ์รายปี", [liuNianLine, timingBlock, yearly]),
    readingBox("ข้อเสนอแนะ", [buildChapterAdvice(calculatedState, "turning_points")]),
  ].filter((box) => box.length > 0);
  return boxes.length > 0 ? boxes.join("\n\n") : null;
}

/** dispatcher กล่องทุกบท: บทที่มี builder เฉพาะ → ใช้ตัวนั้น, บทที่เหลือ → จัดกล่องจาก prose ตาม spec */
function buildTopicBoxes(
  calculatedState: CalculatedStateValue,
  topicId: string,
  rawInput?: RawInputValue,
): string | null {
  switch (topicId) {
    case "chart_foundation":
      return buildChartFoundationBoxes(calculatedState);
    case "career_potential":
      return buildCareerBoxes(calculatedState);
    case "wealth_and_investment":
      return buildWealthBoxes(calculatedState);
    case "benefactor":
      return buildBenefactorBoxes(calculatedState);
    case "friends_foes":
      return buildFriendsFoesBoxes(calculatedState);
    case "turning_points":
      return buildTurningPointsBoxes(calculatedState);
    default: {
      const spec = TOPIC_BOX_SPECS[topicId];
      if (!spec) {
        return null;
      }
      const body = buildTopicReadingBody(calculatedState, topicId, rawInput);
      if (body == null) {
        return null;
      }
      return buildBoxesFromBody(calculatedState, topicId, body, spec);
    }
  }
}

/** ย่อหน้าปิดท้าย = บทสรุปเฉพาะของบทนั้น (ไม่ซ้ำกันทุกบท) */
function buildChapterAdvice(_calculatedState: CalculatedStateValue, topicId: string): string {
  return K("CHAPTER_SUMMARY_TH", CHAPTER_SUMMARY_TH)[topicId] ?? "";
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
  // technical/export/editor = กล่อง (true); consumer render = ร้อยแก้วล้วน (false, กัน scaffolding "→")
  useBoxFormat = true,
): string | null {
  // ฉบับ "กล่อง" ทุกบท ตาม docs/ทายดวง 15 หัวข้อ.docx — เริ่มด้วยกล่องเกริ่นนำ (คอนเซ็ปต์บท +
  // พาดหัวดิถี YLC แก้ได้) แล้วตามด้วยกล่องหัวข้อย่อย ปิดท้ายภาพเปรียบนอกกล่อง
  if (useBoxFormat) {
    const boxes = buildTopicBoxes(calculatedState, topicId, rawInput);
    if (boxes != null) {
      const composed = composeParagraphs([
        buildIntroBox(calculatedState, topicId),
        boxes,
        buildElementClosingSimile(elementLabel(dayMasterElement(calculatedState)), topicId),
      ]);
      return [composed, ...currentAppends(topicId)].filter((part) => part.trim().length > 0).join("\n\n");
    }
  }

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
  // เรียบเรียง body ให้ลื่นด้วยคำเชื่อมหมุนเวียน (deterministic) — ไม่แตะข้อเท็จจริง/marker
  // Q2a: แตก comma-dump ลิสต์อาชีพเป็นบุลเลตก่อน แล้วค่อยร้อยคำเชื่อม (อ่านลื่นแบบ YLC, คง marker/ลำดับ)
  const wovenBody = weaveNarrative(bulletizeCommaLists(body.split("\n\n"))).join("\n\n");
  // ประโยคเปิดเจาะดวง (พาดหัวสไตล์ your life code + ภาพดิถี/กำลัง)
  const opening = buildChapterOpening(calculatedState, topicId);
  // ประโยคปิดเชิงเปรียบผูกธาตุดิถี (closing simile) — ต่อจาก "สรุป:" เพื่อคง assertion เดิม
  const closing = buildElementClosingSimile(
    elementLabel(dayMasterElement(calculatedState)),
    topicId,
  );
  const composed = composeParagraphs([
    K("CHAPTER_INTRO_TH", CHAPTER_INTRO_TH)[topicId],
    opening,
    wovenBody,
    buildChapterAdvice(calculatedState, topicId),
    closing,
  ]);
  // เฟส 2: ต่อย่อหน้าความรู้ที่ซินแสเพิ่มออนไลน์ (always-on ต่อบท) — ถ้าไม่มี ผลเท่าเดิม
  return [composed, ...currentAppends(topicId)].filter((part) => part.trim().length > 0).join("\n\n");
}

/**
 * คำทำนายฉบับ "ผู้บริโภค" (consumer render) — ร้อยแก้วอ่านง่ายแบบ gptCase output
 * = technical render (buildTopicHumanReading) ที่ถอด scaffolding เทคนิคออกแล้ว (deterministic, ไม่พึ่ง LLM)
 * technical render เดิมไม่เปลี่ยน → test ที่ผูก marker คงผ่าน
 */
export function buildTopicConsumerReading(
  calculatedState: CalculatedStateValue,
  topicId: string,
  rawInput?: RawInputValue,
): string | null {
  // consumer render = ร้อยแก้วผู้บริโภคล้วน → ใช้ฉบับ "ไม่กล่อง" (useBoxFormat=false) แล้วถอด scaffolding
  // (กล่องเป็นของ technical/export/editor; consumer ต้องสะอาดไม่มี "→"/หัวกล่อง)
  const technical = buildTopicHumanReading(calculatedState, topicId, rawInput, false);
  return technical == null ? null : humanizeConsumerProse(technical);
}

/**
 * ข้อความ "ตำรา (knownlage) ตรง ๆ" ของหัวข้อ = body deterministic ก่อนเรียบเรียง
 * (ไม่ใส่ intro/ประโยคเปิดเจาะดวง/คำเชื่อม/ภาพเปรียบ) — ใช้แสดงในส่วน "คำอ่าน" ของการ์ด
 * คืนเป็นรายย่อหน้า หรือ null ถ้าไม่มีองค์ความรู้ (เช่น ความรักที่ต้องมีเพศ)
 */
export function getTopicKnownlageExcerpt(
  calculatedState: CalculatedStateValue,
  topicId: string,
  rawInput?: RawInputValue,
): string[] | null {
  let body = buildTopicReadingBody(calculatedState, topicId, rawInput);
  if (body == null) {
    if (KHEANGKHUNG_FALLBACK_EXCLUDE.has(topicId)) {
      return null;
    }
    body = buildKheangkhungFallback(topicId);
    if (body == null) {
      return null;
    }
  }
  return body
    .split("\n\n")
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function buildTopicReadingBody(
  calculatedState: CalculatedStateValue,
  topicId: string,
  rawInput?: RawInputValue,
): string | null {
  switch (topicId) {
    case "chart_foundation": {
      // ฉบับซินแสปรับ: รวมบท "การพูด/การสื่อสาร" (ตามธาตุถ่ายเท) เข้ากับบทพื้นฐานดวงชะตา
      const personality = buildPersonalityReading(calculatedState);
      const speech = buildSpeechReading(calculatedState);
      return [personality, speech].filter((part): part is string => Boolean(part)).join("\n\n") || null;
    }
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
    case "speech":
      return buildSpeechReading(calculatedState);
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
  benefactor: "หลักปฏิกิริยาธาตุ + ตำแหน่งเสา (ตำราโหราศาสตร์เคี้ยงคุง)",
  family: "หลักปฏิกิริยาธาตุ + ตำแหน่งเสา (ตำราโหราศาสตร์เคี้ยงคุง)",
  friends_foes: "หลักปฏิกิริยาธาตุ + ตำแหน่งเสา (ตำราโหราศาสตร์เคี้ยงคุง)",
  subordinates: "หลักปฏิกิริยาธาตุ + ตำแหน่งเสา (ตำราโหราศาสตร์เคี้ยงคุง)",
  education: "หลักปฏิกิริยาธาตุ + ตำแหน่งเสา (ตำราโหราศาสตร์เคี้ยงคุง)",
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
    case "speech":
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
