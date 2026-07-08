/**
 * แคมเปญ "What If" — คำนวณ "อาชีพที่ฟ้าลิขิต"
 *
 * เส้นทางหลัก: computeDestinyFromChart — ใช้ดวง 4 เสาจริงจาก engine (วัน/เดือน/ปี+เวลา+เพศ)
 *   แล้วเดินตาราง B ของ NewData (ดิถีธาตุ × กำลังดิถี × ธาตุราศีบนหลักเดือน → ธาตุที่ควรทำ)
 *   เหมือนบทอาชีพใน /reading/newdata-reading ทุกประการ — จากนั้นหยิบอาชีพ aspirational
 *   จาก pool ของธาตุนั้น (deterministic: hash ดวง+อาชีพปัจจุบัน)
 *
 * เส้นทางสำรอง: computeDestiny — ใช้แค่ปีเกิด (เสาปี 60 กะจื่อ) เมื่อ engine/DB ล่ม
 *   เพื่อให้แคมเปญไม่ตายกลางงาน
 *
 * pure function — ไม่แตะ DB/LLM
 */
import {
  doElementsTh,
  elementThOfStem,
  type CareerBand,
  type ElementTh as CareerElementTh,
} from "@/lib/bazi/constants/career-finance-table";

export type WhatIfElement = "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ";
export type WhatIfPolarity = "หยาง" | "ยิน";

export type WhatIfDestiny = {
  /** ปีเกิด ค.ศ. ที่ใช้คำนวณ */
  yearCe: number;
  /** ธาตุประจำปีเกิด (จากราศีบนของเสาปี) */
  element: WhatIfElement;
  polarity: WhatIfPolarity;
  /** ปีนักษัตรไทย เช่น "มะโรง" */
  animal: string;
  /** คำเรียกรวม เช่น "ไฟหยาง ปีมะโรง" */
  ganzhiLabel: string;
  /** อาชีพที่ฟ้าลิขิต (ไทย — โชว์ผู้ใช้/เล่านิทาน) */
  destinedCareer: string;
  /** อาชีพภาษาอังกฤษ + ฉาก/พร็อพ — ป้อน Imagen (อ่านไทยไม่ออก) */
  destinedCareerEn: string;
  /** เหตุผลเชิงดวง (สั้น ๆ) ว่าทำไมธาตุนี้ถึงชี้ไปอาชีพนี้ */
  careerReason: string;
};

const STEM_ELEMENTS: { element: WhatIfElement; polarity: WhatIfPolarity }[] = [
  { element: "ไม้", polarity: "หยาง" }, // 甲
  { element: "ไม้", polarity: "ยิน" }, // 乙
  { element: "ไฟ", polarity: "หยาง" }, // 丙
  { element: "ไฟ", polarity: "ยิน" }, // 丁
  { element: "ดิน", polarity: "หยาง" }, // 戊
  { element: "ดิน", polarity: "ยิน" }, // 己
  { element: "ทอง", polarity: "หยาง" }, // 庚
  { element: "ทอง", polarity: "ยิน" }, // 辛
  { element: "น้ำ", polarity: "หยาง" }, // 壬
  { element: "น้ำ", polarity: "ยิน" }, // 癸
];

const ANIMALS = [
  "ชวด", "ฉลู", "ขาล", "เถาะ", "มะโรง", "มะเส็ง",
  "มะเมีย", "มะแม", "วอก", "ระกา", "จอ", "กุน",
];

/** ลักษณะพลังของแต่ละธาตุ×ขั้ว — ใช้ประกอบเหตุผล + ป้อน LLM */
const ELEMENT_TRAITS: Record<WhatIfElement, Record<WhatIfPolarity, string>> = {
  ไม้: {
    หยาง: "พลังของต้นไม้ใหญ่ — เติบโตไม่หยุด ชอบสร้างสิ่งใหม่ และเป็นที่พึ่งให้คนรอบตัว",
    ยิน: "พลังของไม้เลื้อยดอกไม้ — ยืดหยุ่น มีสุนทรียะ ละเอียดอ่อนกับความรู้สึกของผู้คน",
  },
  ไฟ: {
    หยาง: "พลังของดวงอาทิตย์ — โดดเด่น มีเสน่ห์ดึงดูด เกิดมาเพื่อยืนอยู่กลางแสงไฟ",
    ยิน: "พลังของเปลวเทียน — อบอุ่น ลึกซึ้ง จุดประกายความคิดให้คนอื่นทีละคนอย่างมีความหมาย",
  },
  ดิน: {
    หยาง: "พลังของภูเขา — หนักแน่น น่าเชื่อถือ สร้างรากฐานใหญ่ที่คนนับพันพึ่งพิงได้",
    ยิน: "พลังของผืนดินอุดม — โอบอุ้ม บ่มเพาะ เปลี่ยนสิ่งเล็ก ๆ ให้งอกงามเป็นผลผลิต",
  },
  ทอง: {
    หยาง: "พลังของดาบทองคำ — เฉียบคม กล้าตัดสินใจ เกิดมาเพื่อนำทัพและพิชิตเป้าหมายใหญ่",
    ยิน: "พลังของอัญมณี — ประณีต มีรสนิยม เปลี่ยนรายละเอียดเล็ก ๆ ให้กลายเป็นของล้ำค่า",
  },
  น้ำ: {
    หยาง: "พลังของมหาสมุทร — กว้างไกล เชื่อมโยงผู้คนข้ามพรมแดน ไหลไปได้ทุกที่ที่มีโอกาส",
    ยิน: "พลังของสายหมอกและน้ำค้าง — ลุ่มลึก ญาณทัศน์แม่น อ่านใจคนและกระแสโลกได้ก่อนใคร",
  },
};

/** อาชีพ 1 ตัวใน pool — th โชว์ผู้ใช้/เล่านิทาน · en ป้อน Imagen (อ่านไทยไม่ออก) */
export type CareerEntry = { th: string; en: string };

/** กลุ่มอาชีพในฝันตามธาตุ×ขั้ว — โทน aspirational (สำหรับโลกคู่ขนาน) */
const CAREER_POOLS: Record<WhatIfElement, Record<WhatIfPolarity, CareerEntry[]>> = {
  ไม้: {
    หยาง: [
      { th: "ผู้ก่อตั้งสตาร์ทอัพเพื่อสิ่งแวดล้อมระดับภูมิภาค", en: "eco-startup founder and green-tech visionary" },
      { th: "สถาปนิกผู้ออกแบบเมืองสีเขียวแห่งอนาคต", en: "architect designing futuristic green cities, holding blueprints" },
      { th: "เจ้าของแบรนด์สุขภาพออร์แกนิกที่ส่งออกทั่วเอเชีย", en: "organic wellness brand owner surrounded by natural products" },
      { th: "ผู้อำนวยการมูลนิธิเพื่อการศึกษาที่เปลี่ยนชีวิตเด็กนับหมื่น", en: "education foundation director inspiring children" },
      { th: "นักพัฒนาอสังหาริมทรัพย์แนวรักษ์โลกเจ้าของโครงการดัง", en: "eco-friendly real-estate developer with a city model" },
    ],
    ยิน: [
      { th: "นักเขียนเจ้าของหนังสือขายดีติดอันดับประเทศ", en: "best-selling author holding a book and pen" },
      { th: "ฟลอริสต์และดีไซเนอร์งานดอกไม้ระดับอินเตอร์", en: "international florist artist holding a beautiful bouquet" },
      { th: "นักบำบัดด้วยธรรมชาติเจ้าของรีทรีตชื่อดัง", en: "nature-healing therapist and wellness retreat owner with herbs" },
      { th: "ครีเอทีฟไดเรกเตอร์แบรนด์ไลฟ์สไตล์ที่คนรุ่นใหม่หลงรัก", en: "creative director of a trendy lifestyle brand" },
      { th: "เจ้าของคาเฟ่และสวนพฤกษศาสตร์ที่คนต่อคิวทั้งปี", en: "botanical garden cafe owner holding a coffee cup among plants" },
    ],
  },
  ไฟ: {
    หยาง: [
      { th: "พิธีกรและครีเอเตอร์ชื่อดังผู้มีผู้ติดตามหลักล้าน", en: "famous TV host and content creator holding a microphone" },
      { th: "ผู้กำกับภาพยนตร์ที่ผลงานฉายในเทศกาลระดับโลก", en: "film director with a clapperboard and camera" },
      { th: "เชฟเจ้าของร้านมิชลินสตาร์", en: "michelin-star chef in chef whites holding a pan with flames" },
      { th: "นักพูดสร้างแรงบันดาลใจที่เวทีใหญ่ทั่วเอเชียต้องจอง", en: "charismatic motivational speaker on stage with a headset mic" },
      { th: "ผู้บริหารค่ายบันเทิงผู้ปั้นศิลปินแถวหน้า", en: "entertainment label executive in a stylish suit" },
    ],
    ยิน: [
      { th: "นักแต่งเพลงเจ้าของรางวัลระดับประเทศ", en: "award-winning songwriter with a guitar and musical notes" },
      { th: "นักจิตวิทยาและไลฟ์โค้ชที่คิวยาวข้ามปี", en: "warm psychologist life-coach with a notebook" },
      { th: "ช่างภาพสารคดีที่ผลงานจัดแสดงในแกลเลอรีต่างประเทศ", en: "documentary photographer holding a professional camera" },
      { th: "อาจารย์ผู้สร้างคอร์สเรียนออนไลน์ที่เปลี่ยนชีวิตผู้เรียนนับแสน", en: "beloved online educator teaching with a tablet" },
      { th: "นักออกแบบแสงและประสบการณ์อีเวนต์ระดับเวิลด์คลาส", en: "world-class stage lighting and event designer" },
    ],
  },
  ดิน: {
    หยาง: [
      { th: "นักพัฒนาอสังหาริมทรัพย์เจ้าของตึกกลางเมือง", en: "property tycoon in a suit with a skyscraper model" },
      { th: "ซีอีโอบริษัทก่อสร้างที่สร้างแลนด์มาร์กของประเทศ", en: "construction company CEO with hard hat and blueprints" },
      { th: "เจ้าของเชนโรงแรมบูทีกที่นักท่องเที่ยวทั่วโลกตามหา", en: "boutique hotel chain owner welcoming guests" },
      { th: "นักลงทุนที่ดินและฟาร์มอัจฉริยะรายใหญ่", en: "smart-farm investor with drone and fresh produce" },
      { th: "ผู้ว่าการนิคมธุรกิจผู้ปลุกปั้นเศรษฐกิจทั้งภูมิภาค", en: "business-district governor visionary leader" },
    ],
    ยิน: [
      { th: "เจ้าของแบรนด์อาหารโฮมเมดที่ขยายเป็นแฟรนไชส์ทั่วประเทศ", en: "homemade food franchise owner in an apron holding dishes" },
      { th: "นักโภชนาการเจ้าของคลินิกสุขภาพองค์รวมชื่อดัง", en: "famous nutritionist holding healthy food" },
      { th: "ผู้เชี่ยวชาญฮวงจุ้ยและการจัดพื้นที่ที่ซีอีโอไว้วางใจ", en: "feng-shui master consultant with a luopan compass" },
      { th: "เจ้าของฟาร์มสเตย์ออร์แกนิกที่จองเต็มทุกฤดูกาล", en: "organic farm-stay owner in a straw hat with vegetables" },
      { th: "ผู้บริหารกองทุนอสังหาฯ ที่นักลงทุนเชื่อมือที่สุด", en: "trusted real-estate fund manager in a suit" },
    ],
  },
  ทอง: {
    หยาง: [
      { th: "ซีอีโอบริษัทเทคโนโลยีที่ IPO สำเร็จ", en: "tech company CEO in a sleek suit with holographic screens" },
      { th: "ศัลยแพทย์มือหนึ่งของโรงพยาบาลชั้นนำ", en: "top surgeon in surgical scrubs, confident and precise" },
      { th: "นักกฎหมายหุ้นส่วนบริษัทที่ปรึกษาระดับอินเตอร์", en: "elite lawyer partner in a sharp suit with law books" },
      { th: "นายพลฝ่ายกลยุทธ์ขององค์กรระดับประเทศ", en: "strategic executive general in a commanding suit" },
      { th: "วิศวกรการบินผู้อยู่เบื้องหลังโครงการอวกาศ", en: "aerospace engineer with rocket model and tools" },
    ],
    ยิน: [
      { th: "ดีไซเนอร์เครื่องประดับเจ้าของแบรนด์ที่ดาราจองคิว", en: "luxury jewelry designer holding sparkling gems" },
      { th: "วาณิชธนากรผู้ปิดดีลพันล้าน", en: "investment banker closing billion-baht deals, elegant suit" },
      { th: "นักออกแบบผลิตภัณฑ์ที่คว้ารางวัล Red Dot", en: "award-winning product designer with sleek gadget prototypes" },
      { th: "ทันตแพทย์ความงามเจ้าของคลินิกหรูใจกลางเมือง", en: "cosmetic dentist in a white coat at a luxury clinic" },
      { th: "นักสะสมและผู้ประเมินงานศิลปะที่วงการเชื่อถือ", en: "refined art appraiser and collector with a magnifying glass" },
    ],
  },
  น้ำ: {
    หยาง: [
      { th: "นักธุรกิจส่งออกผู้เชื่อมตลาดไทยสู่ตลาดโลก", en: "global export businessman with cargo ships and a world map" },
      { th: "กัปตันสายการบินอินเตอร์ผู้เดินทางรอบโลก", en: "airline captain in pilot uniform with captain's hat" },
      { th: "ผู้ประกาศข่าวและคอลัมนิสต์ที่คนทั้งประเทศรู้จัก", en: "famous news anchor at a desk with a microphone" },
      { th: "เจ้าของบริษัทโลจิสติกส์ที่ครองเส้นทางอาเซียน", en: "logistics company owner with delivery fleet" },
      { th: "นักการทูตผู้แทนประเทศบนเวทีนานาชาติ", en: "distinguished diplomat in formal attire with flags" },
    ],
    ยิน: [
      { th: "นักวิเคราะห์การลงทุนที่กองทุนใหญ่ต้องฟัง", en: "sharp investment analyst with financial charts" },
      { th: "นักเขียนบทซีรีส์ที่สตรีมมิงระดับโลกซื้อลิขสิทธิ์", en: "hit series screenwriter with script pages and laptop" },
      { th: "นักวิจัยและนักอนาคตศาสตร์ที่องค์กรระดับโลกจ้างเป็นที่ปรึกษา", en: "futurist researcher with holographic data displays" },
      { th: "ซอมเมอลิเยร์และผู้เชี่ยวชาญชา-ไวน์ระดับเอเชีย", en: "elegant sommelier wine and tea expert holding a wine glass" },
      { th: "นักดาราศาสตร์ผู้ค้นพบสิ่งใหม่ให้วงการวิทยาศาสตร์", en: "astronomer with a telescope under the stars" },
    ],
  },
};

/** แปลงปี พ.ศ. → ค.ศ. อัตโนมัติ (ถ้าเลขเกิน 2400 ถือว่าเป็น พ.ศ.) */
export function toCeYear(year: number): number {
  return year > 2400 ? year - 543 : year;
}

/** hash แบบ deterministic (djb2) — ให้ผลเท่าเดิมทุกครั้งสำหรับ input เดิม */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return Math.abs(h | 0);
}

/** เทียบหยาบ ๆ ว่าอาชีพตามดวง "ซ้ำกับงานปัจจุบัน" ไหม (กันผลลัพธ์จืด) */
function overlapsCurrentJob(career: string, currentJob: string): boolean {
  const clean = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const a = clean(career);
  const b = clean(currentJob);
  if (b.length < 3) return false;
  return a.includes(b) || b.includes(a);
}

/** คำนวณอาชีพที่ฟ้าลิขิตจากปีเกิด (รับได้ทั้ง พ.ศ./ค.ศ.) + อาชีพปัจจุบัน */
export function computeDestiny(birthYear: number, currentJob: string): WhatIfDestiny {
  const yearCe = toCeYear(birthYear);
  const stemIdx = ((yearCe - 4) % 10 + 10) % 10;
  const branchIdx = ((yearCe - 4) % 12 + 12) % 12;
  const { element, polarity } = STEM_ELEMENTS[stemIdx]!;
  const animal = ANIMALS[branchIdx]!;

  const pool = CAREER_POOLS[element][polarity];
  let pick = hashString(`${yearCe}|${currentJob.trim().toLowerCase()}`) % pool.length;
  // ถ้าดันตรงกับงานปัจจุบัน เลื่อนไปตัวถัดไปในกลุ่ม (ยัง deterministic)
  for (let i = 0; i < pool.length && overlapsCurrentJob(pool[pick]!.th, currentJob); i++) {
    pick = (pick + 1) % pool.length;
  }

  return {
    yearCe,
    element,
    polarity,
    animal,
    ganzhiLabel: `ธาตุ${element}${polarity} · ปี${animal}`,
    destinedCareer: pool[pick]!.th,
    destinedCareerEn: pool[pick]!.en,
    careerReason: ELEMENT_TRAITS[element][polarity],
  };
}

// ── เส้นทางหลัก: จากดวง 4 เสาจริง (ตาราง B ของ NewData) ────────────────────

/** ราศีบนหยาง 5 ตัว (甲丙戊庚壬) — ที่เหลือเป็นยิน */
const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);

const BAND_TH: Record<CareerBand, string> = {
  weak: "ดวงอ่อน",
  balanced: "ดวงสมดุล/แข็งแรง",
  veryStrong: "ดวงแข็งมาก",
};

export type ChartDestinyInput = {
  /** ราศีบนหลักวัน (ดิถี) ฮั่นจื้อ เช่น "戊" */
  dayStem: string;
  /** ราศีบนหลักเดือน ฮั่นจื้อ */
  monthStem: string;
  /** กำลังดิถี 3 band (จาก seasonalCareerBand — ปรับเกิดถูกฤดูแล้ว) */
  band: CareerBand;
  /** ปีเกิด (พ.ศ./ค.ศ. ได้ทั้งคู่) — ใช้หานักษัตร + hash */
  birthYear: number;
  currentJob: string;
};

export type ChartDestiny = WhatIfDestiny & {
  /** ธาตุที่ควรทำ เรียงลำดับจากตาราง B — [0] คือธาตุของ destinedCareer */
  doElements: CareerElementTh[];
  /** ธาตุดิถี (ตัวตน) — ต่างจาก element ซึ่งเป็นธาตุอาชีพที่ควรทำ */
  dayElement: CareerElementTh;
  bandLabel: string;
};

/**
 * คำนวณอาชีพฟ้าลิขิตจากดวงจริง: ตาราง B (ดิถี×กำลัง×ธาตุเดือน) → ธาตุที่ควรทำอันดับ 1
 * → หยิบอาชีพจาก pool ของธาตุนั้น (ขั้วตามดิถี) · คืน null ถ้าก้านไม่รู้จัก (ให้ caller fallback)
 */
export function computeDestinyFromChart(input: ChartDestinyInput): ChartDestiny | null {
  const dayElement = elementThOfStem(input.dayStem);
  const monthElement = elementThOfStem(input.monthStem);
  if (!dayElement || !monthElement) return null;

  const doElements = doElementsTh(dayElement, input.band, monthElement);
  const destinedElement = doElements[0] ?? dayElement;
  const polarity: WhatIfPolarity = YANG_STEMS.has(input.dayStem.normalize("NFC")) ? "หยาง" : "ยิน";

  const yearCe = toCeYear(input.birthYear);
  const branchIdx = ((yearCe - 4) % 12 + 12) % 12;
  const animal = ANIMALS[branchIdx]!;

  const pool = CAREER_POOLS[destinedElement][polarity];
  let pick = hashString(`${yearCe}|${input.dayStem}|${input.monthStem}|${input.currentJob.trim().toLowerCase()}`) % pool.length;
  for (let i = 0; i < pool.length && overlapsCurrentJob(pool[pick]!.th, input.currentJob); i++) {
    pick = (pick + 1) % pool.length;
  }

  const bandLabel = BAND_TH[input.band];
  return {
    yearCe,
    element: destinedElement,
    polarity,
    animal,
    dayElement,
    doElements,
    bandLabel,
    ganzhiLabel: `ดิถีธาตุ${dayElement} · ${bandLabel} · ปี${animal}`,
    destinedCareer: pool[pick]!.th,
    destinedCareerEn: pool[pick]!.en,
    careerReason:
      `ดวงของคุณคือดิถีธาตุ${dayElement} ${bandLabel} เกิดเดือนธาตุ${monthElement} — ` +
      `ตำราชี้ว่าธาตุที่หนุนเส้นทางอาชีพของคุณคือ "ธาตุ${destinedElement}" · ` +
      ELEMENT_TRAITS[destinedElement][polarity],
  };
}
