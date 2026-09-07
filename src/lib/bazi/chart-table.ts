/**
 * ตารางดวงจีน (Figma 720:32490 §"ตารางดวงจีน") — ก้อนข้อมูลที่จอผลสมพงษ์ (คู่รัก/เพื่อนร่วมงาน) และ partner B2B
 * ใช้วาด: สี่เสา + ลัคนา (ก้าน/กิ่ง + ธาตุของแต่ละตัว + นักษัตร), วัยจร (ทศวรรษละ 1 ช่อง), ปีจร 100 ปีนับจากปีเกิด.
 *
 * ทำที่ engine ที่เดียว (ไม่ให้ FE คำนวณก้านกิ่งเอง) — pair-match แนบไว้ที่ persons.a/b.chart,
 * work แนบไว้ที่ comparison.charts { self, candidates[] }.
 */
import type { CalculatedStateValue as BaziStatePayload } from "@/lib/bazi/schema-types";
import {
  BRANCH_LABELS_TH,
  BRANCH_TO_ELEMENT,
  ELEMENT_LABELS_TH,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import { ANNUAL_BRANCHES, ANNUAL_STEMS } from "@/lib/bazi/annual-ganzhi";

export type ChartPillar = {
  stem: string;
  branch: string;
  /** ธาตุของก้าน (ไทย) — ใช้ลงสีตัวก้าน */
  stemElement: string;
  /** ธาตุของกิ่ง (ไทย) — ใช้ลงสีตัวกิ่ง */
  branchElement: string;
  /** นักษัตรของกิ่ง (ชวด…กุน) */
  animal: string;
};

export type ChartDaYun = ChartPillar & {
  startAge: number;
  endAge: number;
  /** "1–10" ตามที่การ์ดโชว์ */
  ageRange: string;
};

export type ChartLiuNian = ChartPillar & {
  /** ค.ศ. */
  year: number;
  /** พ.ศ. */
  yearBE: number;
  /** อายุแบบนับปีเกิดเป็น 1 (ปีเกิด = 1) */
  age: number;
};

export type ChartTable = {
  /** ค.ศ. YYYY-MM-DD ของเจ้าของดวง */
  birthDate: string;
  /** HH:mm หรือ null ถ้าไม่ทราบเวลา (ผู้เรียกส่ง timeKnown มาเอง) */
  birthTime: string | null;
  /** ธาตุดิถี (ไทย) */
  dayElement: string;
  pillars: {
    year: ChartPillar;
    month: ChartPillar;
    day: ChartPillar;
    hour: ChartPillar;
    /** ลัคนา (命宮) — null ถ้า engine ไม่มีให้ */
    ascendant: ChartPillar | null;
  };
  daYun: ChartDaYun[];
  /** ปีจร 15 ปีนับจากปีปัจจุบัน (ผู้ใช้เคาะ 2026-09-07: ไม่เอา 100 ปีจากปีเกิด) — อายุนับปีเกิด = 1 */
  liuNian: ChartLiuNian[];
};

const nfkc = (s: string) => (s ?? "").normalize("NFKC").trim();

function elementThOf(map: Record<string, string>, symbol: string): string {
  const key = map[nfkc(symbol) as keyof typeof map];
  return key ? (ELEMENT_LABELS_TH as Record<string, string>)[key] ?? "" : "";
}

export function chartPillarOf(stem: string, branch: string): ChartPillar {
  const s = nfkc(stem);
  const b = nfkc(branch);
  return {
    stem: s,
    branch: b,
    stemElement: elementThOf(STEM_TO_ELEMENT as Record<string, string>, s),
    branchElement: elementThOf(BRANCH_TO_ELEMENT as Record<string, string>, b),
    animal: (BRANCH_LABELS_TH as Record<string, string>)[b] ?? "",
  };
}

/** ก้านกิ่งของปี ค.ศ. ใด ๆ — 1984 = 甲子 (ปฏิทินจีนตามปี ไม่ตัดที่ลี่ชุน: ตารางปีจรใช้แบบปีเต็มเหมือน public-calc) */
export function ganzhiOfYear(year: number): { stem: string; branch: string } {
  const i = ((year - 1984) % 60 + 60) % 60;
  return { stem: ANNUAL_STEMS[i % 10], branch: ANNUAL_BRANCHES[i % 12] };
}

/** ปีจรโชว์กี่ปีนับจากปีปัจจุบัน (ผู้ใช้: 10–15 ปีพอ) */
export const LIU_NIAN_YEARS = 15;

export function buildChartTable(
  state: BaziStatePayload,
  raw: { birthDate: string; birthTime?: string | null },
  /** ปีปัจจุบัน (ค.ศ.) — ฉีดได้เพื่อเทสต์; ค่าเริ่มต้น = ปีนี้ */
  nowYear: number = new Date().getFullYear(),
): ChartTable {
  const fp = state.fourPillars;
  const birthYear = Number(String(raw.birthDate).slice(0, 4));

  // วัยจร: ทศวรรษละ 1 ช่อง = ก้านจาก upperPhase + กิ่งจาก lowerPhase (ช่วงอายุ = จากต้น upper ถึงท้าย lower)
  const daYun: ChartDaYun[] = [...(state.daYun ?? [])]
    .filter((p) => p.upperPhase && p.lowerPhase)
    .sort((a, b) => (a.upperPhase!.startAge ?? 0) - (b.upperPhase!.startAge ?? 0))
    .map((p) => {
      const startAge = p.upperPhase!.startAge;
      const endAge = p.lowerPhase!.endAge;
      return {
        ...chartPillarOf(p.upperPhase!.symbol, p.lowerPhase!.symbol),
        startAge,
        endAge,
        ageRange: `${startAge}–${endAge}`,
      };
    });

  // ปีจร: เริ่มปีปัจจุบัน 15 ปี (ผู้ใช้เคาะ 2026-09-07) — อายุ = ปี − ปีเกิด + 1 (ปีเกิด = 1)
  const liuNian: ChartLiuNian[] = Number.isFinite(birthYear)
    ? Array.from({ length: LIU_NIAN_YEARS }, (_, k) => {
        const year = nowYear + k;
        const gz = ganzhiOfYear(year);
        return { ...chartPillarOf(gz.stem, gz.branch), year, yearBE: year + 543, age: year - birthYear + 1 };
      })
    : [];

  const day = chartPillarOf(fp.day.stem, fp.day.branch);
  return {
    birthDate: String(raw.birthDate),
    birthTime: raw.birthTime ?? null,
    dayElement: day.stemElement,
    pillars: {
      year: chartPillarOf(fp.year.stem, fp.year.branch),
      month: chartPillarOf(fp.month.stem, fp.month.branch),
      day,
      hour: chartPillarOf(fp.hour.stem, fp.hour.branch),
      ascendant: state.mingGong ? chartPillarOf(state.mingGong.stem, state.mingGong.branch) : null,
    },
    daYun,
    liuNian,
  };
}
