export const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";
export const DEFAULT_INPUT_TIMEZONE = "Asia/Bangkok";
export const NEAR_BOUNDARY_WINDOW_HOURS = 24;

export const MING_GONG_ZHONG_QI_BY_MONTH_BRANCH = {
  寅: "雨水",
  卯: "春分",
  辰: "谷雨",
  巳: "小满",
  午: "夏至",
  未: "大暑",
  申: "处暑",
  酉: "秋分",
  戌: "霜降",
  亥: "小雪",
  子: "冬至",
  丑: "大寒",
} as const;

export const BRANCH_ORDER = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
] as const;

export const FIVE_ELEMENT_ORDER = ["wood", "fire", "earth", "metal", "water"] as const;

export const ELEMENT_LABELS_TH = {
  wood: "ไม้",
  fire: "ไฟ",
  earth: "ดิน",
  metal: "ทอง",
  water: "น้ำ",
} as const;

export const BRANCH_LABELS_TH = {
  子: "ชวด",
  丑: "ฉลู",
  寅: "ขาล",
  卯: "เถาะ",
  辰: "มะโรง",
  巳: "มะเส็ง",
  午: "มะเมีย",
  未: "มะแม",
  申: "วอก",
  酉: "ระกา",
  戌: "จอ",
  亥: "กุน",
} as const;

export const BRANCH_TO_ELEMENT = {
  子: "water",
  丑: "earth",
  寅: "wood",
  卯: "wood",
  辰: "earth",
  巳: "fire",
  午: "fire",
  未: "earth",
  申: "metal",
  酉: "metal",
  戌: "earth",
  亥: "water",
} as const;

export const TWELVE_QI_LABELS_TH = {
  长生: "เชี่ยงแซ",
  沐浴: "หมกยก",
  冠带: "กวงตั่ว",
  临官: "ลิ่มกัว",
  帝旺: "ตี้อ๋วง",
  衰: "ซวย",
  病: "แป่",
  死: "ซี่",
  墓: "หมอ",
  绝: "เจ๊าะ",
  胎: "ทอ",
  养: "เอี้ยง",
} as const;

export const ELEMENT_COLORS_TH: Record<string, string> = {
  "ไม้": "#388659",
  "ไฟ": "#CB2C2A",
  "ดิน": "#F19953",
  "ทอง": "#5A5A5A",
  "น้ำ": "#1455A4",
};

export const ELEMENT_TH_TO_EN: Record<string, string> = {
  "ไม้": "wood",
  "ไฟ": "fire",
  "ดิน": "earth",
  "ทอง": "metal",
  "น้ำ": "water",
};

export const STEM_TO_ELEMENT = {
  甲: "wood",
  乙: "wood",
  丙: "fire",
  丁: "fire",
  戊: "earth",
  己: "earth",
  庚: "metal",
  辛: "metal",
  壬: "water",
  癸: "water",
} as const;

export const GENERATES = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
} as const;

export const CONTROLS = {
  wood: "earth",
  earth: "water",
  water: "fire",
  fire: "metal",
  metal: "wood",
} as const;

export const STEM_METAPHORS = {
  甲: "a tall tree that grows straight when the environment is clear",
  乙: "a living vine that survives by adapting and finding support",
  丙: "the sun that projects warmth and direction outward",
  丁: "a candle flame that refines, warms, and reveals details",
  戊: "a mountain ridge that stabilizes pressure and holds structure",
  己: "fertile cultivated soil that nurtures, absorbs, and organizes",
  庚: "forged metal that cuts through chaos with discipline",
  辛: "polished metal that turns precision into beauty and judgment",
  壬: "a wide river that moves power through flow and scale",
  癸: "rainfall and mist that nourish quietly and penetrate deeply",
} as const;

export const SUPPORT_ELEMENT_METAPHORS = {
  wood: "living timber and roots that keep growth moving upward",
  fire: "fire that bakes the soil into useful ground",
  earth: "earth that condenses pressure into ore and tools",
  metal: "metal that channels water into clean and directed flow",
  water: "water that feeds root systems and keeps growth flexible",
} as const;

export const MONTH_BRANCH_SEASONAL_PROFILE = {
  寅: { season: "spring", phase: "early", seasonLabel: "ต้นฤดูใบไม้ผลิ" },
  卯: { season: "spring", phase: "peak", seasonLabel: "ฤดูใบไม้ผลิ" },
  辰: { season: "spring", phase: "late", seasonLabel: "ปลายฤดูใบไม้ผลิ" },
  巳: { season: "summer", phase: "early", seasonLabel: "ต้นฤดูร้อน" },
  午: { season: "summer", phase: "peak", seasonLabel: "ฤดูร้อน" },
  未: { season: "summer", phase: "late", seasonLabel: "ปลายฤดูร้อน" },
  申: { season: "autumn", phase: "early", seasonLabel: "ต้นฤดูใบไม้ร่วง" },
  酉: { season: "autumn", phase: "peak", seasonLabel: "ฤดูใบไม้ร่วง" },
  戌: { season: "autumn", phase: "late", seasonLabel: "ปลายฤดูใบไม้ร่วง" },
  亥: { season: "winter", phase: "early", seasonLabel: "ต้นฤดูหนาว" },
  子: { season: "winter", phase: "peak", seasonLabel: "ฤดูหนาว" },
  丑: { season: "winter", phase: "late", seasonLabel: "ปลายฤดูหนาว" },
} as const;

export const DAY_MASTER_SEASONAL_NOUNS_TH = {
  甲: "ต้นไม้ใหญ่",
  乙: "เถาไม้",
  丙: "ดวงอาทิตย์",
  丁: "เปลวเทียน",
  戊: "ภูเขา",
  己: "ดินเพาะปลูก",
  庚: "โลหะดิบ",
  辛: "โลหะประณีต",
  壬: "สายน้ำใหญ่",
  癸: "สายฝน",
} as const;

export const STAGE_WEIGHTS = {
  长生: 1.75,
  沐浴: 1.35,
  冠带: 1.5,
  临官: 1.65,
  帝旺: 1.85,
  衰: 0.95,
  病: 0.75,
  死: 0.55,
  墓: 0.7,
  绝: 0.35,
  胎: 0.9,
  养: 1.1,
} as const;

export const BRANCH_HIDDEN_STEMS = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "庚", "戊"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
} as const;

export const NOBLEMAN_BRANCHES_BY_DAY_STEM = {
  甲: ["丑", "未"],
  戊: ["丑", "未"],
  乙: ["子", "申"],
  己: ["子", "申"],
  丙: ["亥", "酉"],
  丁: ["亥", "酉"],
  庚: ["午", "寅"],
  辛: ["午", "寅"],
  壬: ["卯", "巳"],
  癸: ["卯", "巳"],
} as const;

export const WEN_CHANG_BRANCH_BY_DAY_STEM = {
  甲: "巳",
  乙: "午",
  丙: "申",
  丁: "酉",
  戊: "申",
  己: "酉",
  庚: "亥",
  辛: "子",
  壬: "寅",
  癸: "卯",
} as const;

/** 天德 (เทียนเต๊ก) — เทพคุณธรรมฟ้า: ดูจากราศีล่างหลักเดือน → เป้าหมาย (เป็นก้านหรือกิ่งก็ได้) */
export const TIAN_DE_TARGET_BY_MONTH_BRANCH = {
  寅: "丁",
  卯: "申",
  辰: "壬",
  巳: "辛",
  午: "亥",
  未: "甲",
  申: "癸",
  酉: "寅",
  戌: "丙",
  亥: "乙",
  子: "巳",
  丑: "庚",
} as const;

/** 月德 (ง้วยเต๊ก) — เทพคุณธรรมเดือน: ดูจากกลุ่มไตรภาคีของราศีล่างหลักเดือน → ก้านฟ้าเป้าหมาย */
export const YUE_DE_STEM_BY_MONTH_BRANCH = {
  寅: "丙", 午: "丙", 戌: "丙",
  申: "壬", 子: "壬", 辰: "壬",
  亥: "甲", 卯: "甲", 未: "甲",
  巳: "庚", 酉: "庚", 丑: "庚",
} as const;

/** ราศีล่างคลัง (墓库) ของแต่ละธาตุ — ใช้หา "ไฉ่โข่ว" (คลังทรัพย์ = คลังของธาตุโชคลาภ) */
export const TOMB_BRANCH_BY_ELEMENT = {
  wood: "未",
  fire: "戌",
  metal: "丑",
  water: "辰",
  earth: "戌",
} as const;

export function normalizeBranchPairKey(left: string, right: string): string {
  const leftIndex = BRANCH_ORDER.indexOf(left as (typeof BRANCH_ORDER)[number]);
  const rightIndex = BRANCH_ORDER.indexOf(right as (typeof BRANCH_ORDER)[number]);

  if (leftIndex === -1 || rightIndex === -1) {
    return [left, right].sort().join("|");
  }

  return leftIndex <= rightIndex ? `${left}|${right}` : `${right}|${left}`;
}

export const BRANCH_COMBINATION_TRANSFORMS = new Map<string, string>([
  ["丑|子", "earth"], // 子|丑
  ["子|丑", "earth"],
  ["亥|寅", "wood"], // 寅|亥
  ["寅|亥", "wood"],
  ["戌|卯", "fire"], // 卯|戌
  ["卯|戌", "fire"],
  ["酉|辰", "metal"], // 辰|酉
  ["辰|酉", "metal"],
  ["申|巳", "water"], // 巳|申
  ["巳|申", "water"],
  ["未|午", "fire"], // 午|未
  ["午|未", "fire"],
]);

export const SIX_COMBINATION_PAIRS = new Set([
  "子|丑",
  "寅|亥",
  "卯|戌",
  "辰|酉",
  "巳|申",
  "午|未",
]);

export const SAN_HE_GROUPS = [
  { branches: ["申", "子", "辰"], element: "water" },
  { branches: ["亥", "卯", "未"], element: "wood" },
  { branches: ["寅", "午", "戌"], element: "fire" },
  { branches: ["巳", "酉", "丑"], element: "metal" },
] as const;

export const SAN_HUI_GROUPS = [
  { branches: ["亥", "子", "丑"], element: "water" },
  { branches: ["寅", "卯", "辰"], element: "wood" },
  { branches: ["巳", "午", "未"], element: "fire" },
  { branches: ["申", "酉", "戌"], element: "metal" },
] as const;

export const CLASH_PAIRS = new Set([
  "子|午",
  "丑|未",
  "寅|申",
  "卯|酉",
  "辰|戌",
  "巳|亥",
]);

export const HARM_PAIRS = new Set([
  "子|未",
  "丑|午",
  "寅|巳",
  "卯|辰",
  "申|亥",
  "酉|戌",
]);

// 六破: ครบ 6 คู่ ตาม docs/Mootech AI/ตารางชงเฮ้งไห่ผั่ว.docx (ตาราง破 มี 申|巳).
// หมายเหตุ: 巳|申 เป็น 六合 ด้วย (อยู่ใน SIX_COMBINATION_PAIRS) — โครงสร้าง engine เก็บทั้ง合และ破
// แยกกัน (resolveBranchInteractionEffects) จึงรายงานได้ทั้งคู่ตามจริง.
export const DESTRUCTION_PAIRS = new Set([
  "子|酉",
  "卯|午",
  "辰|丑",
  "未|戌",
  "寅|亥",
  "巳|申",
]);

export const STEM_BRANCH_DESTRUCTION_PAIRS = new Set([
  "甲|午",
  "乙|巳",
  "丙|辰",
  "丁|卯",
  "戊|寅",
  "己|丑",
  "己|亥",
  "庚|子",
  "庚|戌",
  "辛|酉",
  "壬|申",
  "癸|未",
]);

export const PUNISHMENT_PAIR_KEYS = new Set(["子|卯"]);

export const PUNISHMENT_TRIOS = [
  // พาหะ group
  ["寅", "巳", "申"],
  ["巳", "申", "亥"],
  ["申", "亥", "寅"],
  ["亥", "寅", "巳"],
  // แม่ธาตุ group
  ["子", "卯", "午"],
  ["卯", "午", "酉"],
  ["午", "酉", "子"],
  ["酉", "子", "卯"],
  // ธาตุดิน group
  ["辰", "未", "戌"],
  ["丑", "未", "戌"],
  ["戌", "丑", "辰"],
  ["丑", "辰", "未"],
] as const;

export const SELF_PUNISHMENT_BRANCHES = new Set(["辰", "午", "酉", "亥"]);

export const STAGE_POSITION_WEIGHTS = {
  year: 0.75,
  month: 1.75,
  day: 1,
  hour: 0.75,
} as const;

export const STAGE_WEIGHT_NORMALIZER = 2.5;
export const BASE_STRENGTH_OFFSET = 0.75;
export const MONTH_SEASONAL_CLASH_FACTOR = 0.6;

export const STEM_COMBINATION_TRANSFORMS = new Map<string, string>([
  ["己|甲", "土"],
  ["乙|庚", "金"],
  ["丙|辛", "水"],
  ["丁|壬", "木"],
  ["戊|癸", "火"],
]);

export const STEM_CLASH_PAIRS = new Set([
  "戊|甲",
  "壬|戊",
  "丙|壬",
  "丙|庚",
  "庚|甲",
  "乙|己",
  "己|癸",
  "丁|癸",
  "丁|辛",
  "乙|辛",
]);

export const INTERACTION_FAMILIES = [
  "combination",
  "clash",
  "harm",
  "destruction",
  "punishment",
  "stem-combination",
  "stem-clash",
] as const;

export type InteractionFamily = (typeof INTERACTION_FAMILIES)[number];

export const GENERALIZED_INTERACTION_ENTITY_TYPES = [
  "stem",
  "branch",
  "hidden-stem",
  "pillar",
  "day-master",
  "season-anchor",
] as const;

export const GENERALIZED_INTERACTION_FAMILY_KEYS = [
  "heavenly-stem-he",
  "heavenly-stem-clash",
  "earthly-branch-liu-he",
  "earthly-branch-san-he",
  "earthly-branch-ban-san-he",
  "earthly-branch-san-hui",
  "earthly-branch-fang-ju",
  "earthly-branch-clash",
  "earthly-branch-harm",
  "earthly-branch-destruction",
  "earthly-branch-punishment",
  "element-generate",
  "element-control",
] as const;

export const GENERALIZED_ELEMENT_INTERACTION_TYPES = ["generate", "control"] as const;

export const GENERALIZED_INTERACTION_OUTCOME_STATUSES = [
  "detected",
  "supported",
  "transformed",
  "blocked",
  "transit-broken",
] as const;

export const GENERALIZED_INTERACTION_DAY_MASTER_EFFECTS = [
  "beneficial",
  "harmful",
  "neutral",
] as const;

export const GENERALIZED_INTERACTION_PRECEDENCE_LEVELS = [
  "primary",
  "secondary",
  "tertiary",
] as const;

export const GENERALIZED_INTERACTION_QUALIFIER_LANES = ["twelve-qi"] as const;

export const GENERALIZED_INTERACTION_QUALIFIER_KEYS = ["twelve-qi-stage"] as const;

export const PILLAR_CONTEXT_MAP = {
  year: {
    traditionalPerson: "ปู่ย่า ตระกูล วงศ์ตระกูล",
    businessPerson: "ตลาด สังคม ชื่อเสียง อุตสาหกรรม",
    administrationRole: "ผู้บริหารระดับสูง กรรมการ ที่ปรึกษา",
    agePhase: "วัยเด็ก พื้นฐานชีวิต",
    healthZone: "หัว คอ ส่วนบนของลำตัว",
    nature: "กำเนิดภายนอก",
  },
  month: {
    traditionalPerson: "พ่อแม่ ผู้ใหญ่ในวงศ์",
    businessPerson: "เจ้านาย ผู้บังคับบัญชา องค์กร หุ้นส่วน",
    administrationRole: "ผู้บริหารระดับกลาง ผู้จัดการ แผนก",
    agePhase: "วัยรุ่น วัยทำงานตอนต้น",
    healthZone: "หน้าอก แขน ระบบหายใจ",
    nature: "ฐานรากและสภาพแวดล้อม",
  },
  day: {
    traditionalPerson: "ตัวเอง คู่ครอง",
    businessPerson: "ตัวเองในฐานะผู้ประกอบการ พันธมิตรใกล้ตัว",
    administrationRole: "ผู้ปฏิบัติงานหลัก ผู้รับผิดชอบตรง",
    agePhase: "วัยกลางคน ช่วงสร้างครอบครัว",
    healthZone: "ลำตัว หัวใจ กระเพาะ",
    nature: "แกนตัวตนและชีวิตใกล้ตัว",
  },
  hour: {
    traditionalPerson: "ลูก บริวาร ผู้ติดตาม",
    businessPerson: "ลูกน้อง ทีม ผลงาน สินค้า สิ่งที่สร้างภายหลัง",
    administrationRole: "ทีมปฏิบัติการ หน่วยงานย่อย โครงการ",
    agePhase: "วัยชรา มรดก สิ่งที่ทิ้งไว้",
    healthZone: "ขา เท้า ระบบสืบพันธุ์",
    nature: "ผลลัพธ์และสิ่งที่ส่งต่อ",
  },
} as const;

export type PillarContextKey = keyof typeof PILLAR_CONTEXT_MAP;
export type PillarContextDimension = keyof (typeof PILLAR_CONTEXT_MAP)["year"];

export const VERTICAL_CONTEXT_MAP = {
  stem: {
    natureLabel: "ฟ้ากำหนด",
    meaningThai: "สิ่งที่ภายนอกกำหนดมาให้ โอกาสที่เข้ามาหา ช่วงชะตาที่ฟ้าประทาน",
    businessLens: "เงื่อนไขตลาด แนวโน้มอุตสาหกรรม โอกาสที่เข้ามาโดยไม่ได้ตั้งใจ",
    agency: "ภายนอกกำหนด",
  },
  branch: {
    natureLabel: "แสวงหาเอง",
    meaningThai: "สิ่งที่ตัวเองสร้าง แสวงหา หรือดิ้นรนเพื่อให้ได้มา",
    businessLens: "ความพยายามของตัวเอง ทักษะ การตัดสินใจ การลงมือทำ",
    agency: "ตัวเองเป็นธง",
  },
} as const;

export type VerticalLayerKey = keyof typeof VERTICAL_CONTEXT_MAP;

export const TWELVE_QI_CONTEXT_MAP: Record<string, { labelThai: string; contextTag: string }> = {
  "长生": { labelThai: "เชี่ยงแซ", contextTag: "กำเนิดใหม่ เริ่มต้น" },
  "沐浴": { labelThai: "หมกยก", contextTag: "ล้างตัว ปรับตัว ช่วงเปราะบาง" },
  "冠带": { labelThai: "กวงตั่ว", contextTag: "เตรียมพร้อม สวมเกราะ" },
  "临官": { labelThai: "ลิ่มกัว", contextTag: "มีอำนาจ ได้ตำแหน่ง กำลังพีค" },
  "帝旺": { labelThai: "ตี้อ๋วง", contextTag: "จุดสูงสุด รุ่งเรืองเต็มที่" },
  "衰": { labelThai: "ซวย", contextTag: "เริ่มถดถอย ต้องระวัง" },
  "病": { labelThai: "แป่", contextTag: "อ่อนแอ ป่วย มีปัญหา" },
  "死": { labelThai: "ซี่", contextTag: "สิ้นสุด ดับสูญ" },
  "墓": { labelThai: "หมอ", contextTag: "ฝังจม สะสม เก็บกัก" },
  "绝": { labelThai: "เจ๊าะ", contextTag: "ขาดสาย หมดสิ้น ต่ำสุด" },
  "胎": { labelThai: "ทอ", contextTag: "เริ่มฟื้น เพาะชำ" },
  "养": { labelThai: "เอี้ยง", contextTag: "บำรุง เติบโต เสริมสร้าง" },
};

// ความหมายเต็มของ 12 เชี่ยงแซ (十二長生) — summary ใช้ต่อเข้า reading, keywords ใช้จับคู่บริบท
export const TWELVE_QI_MEANINGS_TH: Record<
  string,
  { labelThai: string; summary: string; keywords: string[] }
> = {
  "长生": {
    labelThai: "เชี่ยงแซ",
    summary: "การกำเนิดและเริ่มต้นที่เติบโตต่อเนื่อง ใฝ่เรียนรู้ พัฒนาตนเอง ริเริ่มสิ่งใหม่ และยืนหยัดด้วยกำลังของตัวเอง",
    keywords: ["กำเนิด", "เริ่มต้น", "เรียนรู้", "พัฒนา", "ริเริ่ม"],
  },
  "沐浴": {
    labelThai: "หมกยก",
    summary: "การชำระล้างสะสางให้สมบูรณ์และมีเสน่ห์ต่อเพศตรงข้าม แต่เสี่ยงลุ่มหลงมัวเมา กามคุณ อบายมุข และไสยศาสตร์",
    keywords: ["สะสาง", "เสน่หา", "ลุ่มหลง", "มัวเมา", "อบายมุข"],
  },
  "冠带": {
    labelThai: "กวงตั่ว",
    summary: "การศึกษาสำเร็จ มีความรู้ความสามารถตามหลักการ ก้าวหน้ามีชื่อเสียง และทำตามกฎระเบียบแบบแผน",
    keywords: ["การเรียน", "สำเร็จการศึกษา", "วิชาการ", "ก้าวหน้า", "ชื่อเสียง"],
  },
  "临官": {
    labelThai: "ลิ่มกัว",
    summary: "การได้ยศถาบรรดาศักดิ์ อำนาจหน้าที่สูงขึ้น มีบารมีเกียรติยศ เกี่ยวข้องกับราชการและผู้มียศศักดิ์",
    keywords: ["ยศตำแหน่ง", "อำนาจ", "บารมี", "ราชการ", "เกียรติยศ"],
  },
  "帝旺": {
    labelThai: "ตี้อ๋วง",
    summary: "อำนาจวาสนาบารมีสูงสุด เด็ดเดี่ยวกล้าหาญมีอิทธิพล แต่เสี่ยงใช้อำนาจเกินขอบเขตและหรูหราเกินจำเป็น",
    keywords: ["อำนาจสูงสุด", "บารมี", "อิทธิพล", "หรูหรา", "เกินขอบเขต"],
  },
  "衰": {
    labelThai: "ซวย",
    summary: "ความเสื่อมถอย ล่าช้า มีอุปสรรค สูญเสียเงินทอง ความทุกข์โศก ขี้บ่นเหนื่อยล้า และเรื่องของเก่า/มรดก",
    keywords: ["เสื่อมถอย", "ล่าช้า", "สูญเสีย", "ทุกข์", "ของเก่า"],
  },
  "病": {
    labelThai: "แป่",
    summary: "ความเจ็บป่วย สุขภาพอ่อนแอ เสียเงินรักษา การเดินทางไกล/ย้ายถิ่น และความเสื่อมถอยทั้งกายและทรัพย์",
    keywords: ["เจ็บป่วย", "สุขภาพ", "เดินทางไกล", "ย้ายถิ่น", "เสื่อม"],
  },
  "死": {
    labelThai: "ซี่",
    summary: "การสูญเสีย ตายจาก หมดหวัง พลัดพราก หยุดนิ่งอยู่กับที่ ขี้เกียจเบื่อหน่าย และการถูกถอดถอน",
    keywords: ["สูญเสีย", "หมดหวัง", "พลัดพราก", "หยุดนิ่ง", "ขี้เกียจ"],
  },
  "墓": {
    labelThai: "หมอ",
    summary: "การเก็บกักสะสมเป็นขุมคลัง/โกดัง การหลบซ่อนเก็บตัว ปกปิดความลับ และสิ่งที่รอการทำนุบำรุง",
    keywords: ["เก็บสะสม", "ขุมคลัง", "หลบซ่อน", "ปกปิด", "ความลับ"],
  },
  "绝": {
    labelThai: "เจ๊าะ",
    summary: "การสูญสิ้นหายนะ แตกสลายย่อยสลาย ขาดหาย ความว่างเปล่า ความรุนแรงทำลายล้าง และด้านมืด",
    keywords: ["สูญสิ้น", "หายนะ", "แตกสลาย", "ทำลายล้าง", "ด้านมืด"],
  },
  "胎": {
    labelThai: "ทอ",
    summary: "การก่อกำเนิดปฏิสนธิ เริ่มต้นใหม่ ประคบประหงมค่อยเป็นค่อยไป ระมัดระวัง บางครั้งยังไม่สมประกอบ",
    keywords: ["ก่อกำเนิด", "เริ่มต้น", "ประคบประหงม", "ค่อยเป็นค่อยไป", "ระวัง"],
  },
  "养": {
    labelThai: "เอี้ยง",
    summary: "การเลี้ยงดูบำรุงให้เติบโต ประคับประคอง ริเริ่มก่อตั้ง ค่อย ๆ เจริญ สดใสร่าเริงเหมือนเด็กน้อย",
    keywords: ["เลี้ยงดู", "บำรุง", "ก่อตั้ง", "เติบโต", "สดใส"],
  },
};

export const INTERACTION_CONTEXT_TAG: Record<string, string> = {
  "heavenly-stem-clash": "ชงฟ้า: แรงขัดแย้งจากภายนอก กระทบโดยไม่คาดฝัน",
  "earthly-branch-clash": "ชงดิน: แรงขัดแย้งจากการกระทำของตัวเอง ผลจากการตัดสินใจ",
  "earthly-branch-harm": "ไห่: แรงทำร้ายแบบซ่อนเร้น ถูกหักหลัง ถูกทำร้ายจากคนใกล้ตัว",
  "earthly-branch-destruction": "ผั่ว: ความสัมพันธ์พังทลาย ผิดหวัง เสียใจ",
  "earthly-branch-punishment": "เฮ้ง: ลงโทษ กดดัน ความเครียด",
  "earthly-branch-liu-he": "ฮะดิน: การรวมกลุ่ม พันธมิตร การสนับสนุน",
  "heavenly-stem-he": "ฮะฟ้า: ความร่วมมือจากภายนอก โอกาสที่เข้ามาเอง",
  "earthly-branch-ban-san-he": "กึ่งภาคี: การสนับสนุนบางส่วน พันธมิตรที่ยังไม่เต็มที่",
  "earthly-branch-san-he": "ภาคี: การรวมกลุ่มเต็มชุด เกิดแรงหนุนร่วมกัน",
  "earthly-branch-san-hui": "ไตรทิศ: การรวมกลุ่มตามทิศ เกิดแรงหนุนของฤดูกาลและทิศทาง",
};

export const TWELVE_QI_ADVERB_MAP: Record<string, { thai: string; meaning: string }> = {
  长生: { thai: "เติบโต", meaning: "กำลังเริ่มต้น มีพลังงานใหม่" },
  沐浴: { thai: "หมกยก", meaning: "ยังไม่มั่นคง ต้องระวัง" },
  冠带: { thai: "กวงตั่ว", meaning: "กำลังเติบโต สะสมพลัง" },
  临官: { thai: "ลิ่มกัว", meaning: "แรง มีอำนาจ จัดการได้" },
  帝旺: { thai: "ตี้อ๋วง", meaning: "รุ่งเรืองสุดขีด" },
  衰: { thai: "ซวย", meaning: "เริ่มถดถอย" },
  病: { thai: "แป่", meaning: "มีปัญหา ต้องรักษา" },
  死: { thai: "ซี่", meaning: "หมดแรง ไม่สามารถ" },
  墓: { thai: "หมอ", meaning: "ซ่อน ฝัง ต้องขุด" },
  绝: { thai: "เจ๊าะ", meaning: "ขาด ไม่มี" },
  胎: { thai: "ทอ", meaning: "กำลังเกิด ซ่อนอยู่" },
  养: { thai: "เอี้ยง", meaning: "เตรียม สะสม" },
};

export const ROLE_SUBTYPE_LABELS_TH: Record<string, { direct: string; indirect: string }> = {
  same: { direct: "คู่ (ผู้สนับสนุน)", indirect: "เปรียว (คู่แข่ง)" },
  resource: { direct: "ส่งเสริมตรง (แบบตรง)", indirect: "ส่งเสริมเฉียว (แบบเบี่ยง)" },
  output: { direct: "ถ่ายเทตรง (สร้าง)", indirect: "ถ่ายเทเฉียว (แบก)" },
  power: { direct: "ภาระหน้าที่ตรง (แบบมีระเบียบ)", indirect: "ภาระหน้าที่เฉียว (แบบกดดัน)" },
  wealth: { direct: "ลาภตรง (แบบตรง)", indirect: "ลาภเปีย (แบบเบี่ยง)" },
};

// ความหมายของแต่ละบทบาทธาตุ (ขยายตามที่ซินแสกำชับ) — power = "ภาระหน้าที่", resource = "ส่งเสริม"
export const RELATION_SEMANTIC_MEANING_TH: Record<string, string> = {
  same: "พี่น้อง/เพื่อนฝูง/คู่ค้า/คู่แข่ง",
  resource: "องค์ความรู้/ผู้หลักผู้ใหญ่/ครูบาอาจารย์/แม่/ผู้สนับสนุน",
  output: "คิด/พูด/ฟัง/เรียน/ทำงาน/เดินทาง/ลงทุน/จับจ่าย/บริวาร/ลูก(เพศหญิง)",
  power: "ภาระ/หน้าที่/ตำแหน่ง/หนี้สิน/รายจ่าย/คู่ครอง(เพศหญิง)/ลูก(เพศชาย)/คุณธรรม",
  wealth: "ทรัพย์/รายได้/ผลลัพธ์/สินค้า/พ่อ/คู่ครอง(เพศชาย)",
};

export const CONFLICT_RESOLUTION_LABELS_TH: Record<string, string> = {
  neutralized: "ชงถูกฮะแก้ (ปัญหาถูกช่วยเหลือ/บรรเทา)",
  partial: "ฮะบรรเทาชง (ปัญหาลดลงแต่ยังมี)",
  active: "ชงเต็มขั้น (ปัญหาไม่ถูกแก้)",
};

export const SHEN_SHA_COPY = {
  nobleman: {
    starName: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
    meaning: "ดาวอุปถัมภ์ ชี้จังหวะที่มีผู้ใหญ่ค้ำชู คนแนะนำ หรือแรงสนับสนุนเข้ามาช่วยเปิดทาง",
  },
  wenChang: {
    starName: "บุ่งเชียง/วิชาการ (文昌)",
    meaning: "ดาววิชาการ การคิดเชิงระบบ การเขียน การเรียนรู้ และงานที่ต้องใช้ปัญญาหรือชื่อเสียงทางความรู้",
  },
  tianDe: {
    starName: "เทียนเต๊ก (天德)",
    meaning: "ดาวคุณธรรมฟ้า ช่วยผ่อนหนักเป็นเบา มีสิ่งศักดิ์สิทธิ์/ผู้ใหญ่คุ้มครอง แคล้วคลาดจากเคราะห์",
  },
  yueDe: {
    starName: "ง้วยเต๊ก (月德)",
    meaning: "ดาวคุณธรรมเดือน เสริมเมตตาบารมี มีคนเอ็นดูช่วยเหลือ ลดทอนเรื่องร้ายให้บรรเทา",
  },
} as const;
