/**
 * สร้าง "คำอธิษฐาน" (บทขอพร) จากคลัง 8 ประตู + 10 เทพ (ตาม Google Sheet ของซินแส) —
 * เลือกประตู/เทพ "ตามเรื่องที่ขอ" แล้วเสริมด้วยประตู/เทพที่ตรง "ธาตุเสริมดวง (用神)" ของผู้ใช้
 * นำ blessing (ประโยคพร) มาเรียงเป็นข้อ ๆ ห่อด้วยหัว (สถานที่/วันเวลา/องค์เทพ) + ปิดท้าย สาธุ.
 *
 * pure/deterministic — ไม่เรียก network/LLM. โหลดดวง (用神) ทำที่ route แล้วส่ง favorableElements เข้ามา.
 */
import type { ElementTh } from "@/lib/bazi/constants/career-finance-table";
import catalog from "./prayer-catalog.json";

export type PrayerTopic = "love" | "wealth" | "career" | "health" | "study" | "fixluck" | "general";

type Entry = {
  no: number;
  cn: string;
  translit: string;
  thName?: string;
  element: string;
  direction?: string;
  keywords: string;
  blessing: string;
  ward?: boolean;
};

const GATES = catalog.gates as Entry[];
const GODS = catalog.gods as Entry[];

const GATE_BY_CN = new Map(GATES.map((g) => [g.cn, g]));
const GOD_BY_CN = new Map(GODS.map((g) => [g.cn, g]));

export const PRAYER_TOPIC_TITLE: Record<PrayerTopic, string> = {
  love: "ขอพรความรักและคู่บารมี",
  wealth: "ขอพรความมั่งคั่งและโชคลาภ",
  career: "ขอพรความสำเร็จในหน้าที่การงาน",
  health: "ขอพรสุขภาพและการเยียวยา",
  study: "ขอพรการเรียนและสติปัญญา",
  fixluck: "ขอพรเปิดทางชีวิตและสะเดาะเคราะห์",
  general: "ขอพรชีวิตรุ่งเรืองรอบด้าน",
};

/** ประตู/เทพหลักของแต่ละเรื่องที่ขอ (เลือกด้านบวกที่ตรงประเด็น) */
const TOPIC_MAP: Record<PrayerTopic, { gates: string[]; gods: string[] }> = {
  love: { gates: ["休", "開"], gods: ["合", "符"] },
  wealth: { gates: ["生", "開"], gods: ["地", "符"] },
  career: { gates: ["開", "生", "景"], gods: ["天", "符"] },
  health: { gates: ["生", "休"], gods: ["陳", "地"] },
  study: { gates: ["杜", "開"], gods: ["天", "雀"] },
  fixluck: { gates: ["開", "死"], gods: ["符"] },
  general: { gates: ["開", "生", "休"], gods: ["符", "天", "合"] },
};

const THAI_NUM = ["๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙", "๑๐", "๑๑", "๑๒"];
function thaiOrdinal(i: number): string {
  return THAI_NUM[i] ?? String(i + 1);
}

export type BuildPrayerInput = {
  topic: PrayerTopic;
  /** ธาตุเสริมดวง (用神) ของผู้ใช้ — ใช้เสริมประตู/เทพที่ตรงธาตุ (ไม่มีก็ได้) */
  favorableElements?: ElementTh[];
  /** ชื่อสถานที่ศักดิ์สิทธิ์ (ถ้าขอ ณ ที่ใดที่หนึ่ง) */
  placeName?: string;
  /** องค์เทพที่อัญเชิญ (ถ้ามี) */
  deity?: string;
  /** วันเวลา (ข้อความไทย เช่น "วันเสาร์ที่ ๑๔ กุมภาพันธ์ ๒๕๖๙") */
  dateTimeLabel?: string;
  /** จำกัดจำนวนข้อพร (ค่าเริ่มต้น 5) */
  maxWishes?: number;
};

export type BuiltPrayer = {
  title: string;
  text: string;
  /** ประตู/เทพที่ถูกใช้ (ไว้โชว์ badge/debug) */
  used: { gates: string[]; gods: string[] };
  favorableElements: ElementTh[];
};

/** ดึง entry ตามลำดับ cn ที่ให้ (ข้ามที่ไม่พบ) */
function pick(cns: string[], from: Map<string, Entry>): Entry[] {
  return cns.map((cn) => from.get(cn)).filter((e): e is Entry => Boolean(e));
}

/**
 * สร้างบทอธิษฐาน: ประตู/เทพหลักตามเรื่อง → เสริมด้วยตัวที่ตรงธาตุเสริมดวง (用神) →
 * เอา blessing มาเรียงเป็นข้อ (ตัด ward ออกจากพรหลัก ยกเว้นเรื่องสะเดาะเคราะห์).
 */
export function buildPrayer(input: BuildPrayerInput): BuiltPrayer {
  const fav = input.favorableElements ?? [];
  const map = TOPIC_MAP[input.topic] ?? TOPIC_MAP.general;
  const maxWishes = input.maxWishes ?? 5;

  const gates = pick(map.gates, GATE_BY_CN);
  const gods = pick(map.gods, GOD_BY_CN);

  // เสริม "ตามธาตุเสริมดวง": ประตู/เทพด้านบวก (ไม่ใช่ ward) ที่ธาตุตรงกับ用神 และยังไม่ถูกเลือก
  if (fav.length) {
    const favSet = new Set<string>(fav);
    for (const g of GATES) {
      if (!g.ward && favSet.has(g.element) && !gates.includes(g)) gates.push(g);
    }
    for (const g of GODS) {
      if (!g.ward && favSet.has(g.element) && !gods.includes(g)) gods.push(g);
    }
  }

  // เรื่องสะเดาะเคราะห์ → คงพรกันภัย (ward) ไว้ได้; เรื่องอื่นตัด ward ทิ้ง (พรควรเป็นด้านบวก)
  const keepWard = input.topic === "fixluck";
  const ordered = [...gates, ...gods].filter((e) => keepWard || !e.ward);

  // dedup blessing + จำกัดจำนวนข้อ
  const seen = new Set<string>();
  const blessings: Entry[] = [];
  for (const e of ordered) {
    if (seen.has(e.cn) || blessings.some((b) => b.blessing === e.blessing)) continue;
    seen.add(e.cn);
    blessings.push(e);
    if (blessings.length >= maxWishes) break;
  }

  const title = PRAYER_TOPIC_TITLE[input.topic] ?? PRAYER_TOPIC_TITLE.general;

  // ── ประกอบข้อความ ──
  const header: string[] = [`คำอธิษฐาน${title}`];
  if (input.placeName) header.push(`ณ ${input.placeName}`);
  if (input.dateTimeLabel) header.push(input.dateTimeLabel);

  const invite = input.deity
    ? `เรียนเชิญ${input.deity} โปรดเมตตารับฟังคำอธิษฐานของข้าพเจ้า`
    : "เรียนเชิญสิ่งศักดิ์สิทธิ์ ณ ที่แห่งนี้ โปรดเมตตารับฟังคำอธิษฐานของข้าพเจ้า";

  const favLine = fav.length
    ? ` ด้วยพลังธาตุ${fav.join("และธาตุ")}อันเป็นธาตุเสริมดวงชะตาของข้าพเจ้า`
    : "";
  const intro =
    `ข้าพเจ้า (ระบุชื่อ-นามสกุล) ขอตั้งจิตอธิษฐานต่อสิ่งศักดิ์สิทธิ์${favLine} ` +
    "โปรดเมตตาประทานพรและเปิดทางนำพาความสุขความเจริญมาสู่ชีวิตของข้าพเจ้า ผ่านคำอธิษฐานดังนี้";

  const wishes = blessings.map((e, i) => `${thaiOrdinal(i)}. ${e.blessing}`);

  const closing =
    "ขอสิ่งศักดิ์สิทธิ์โปรดรับฟังและเมตตาประทานพรให้ข้าพเจ้าสมหวังในทุกประการโดยเร็ววันด้วยเทอญ สาธุ สาธุ สาธุ";

  const text = [header.join("\n"), invite, intro, wishes.join("\n\n"), closing].join("\n\n");

  return {
    title,
    text,
    used: { gates: gates.map((g) => g.cn), gods: gods.map((g) => g.cn) },
    favorableElements: fav,
  };
}
