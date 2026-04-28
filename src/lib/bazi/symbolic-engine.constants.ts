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

export const PEACH_BLOSSOM_BRANCH_BY_GROUP = {
  申: "酉",
  子: "酉",
  辰: "酉",
  寅: "卯",
  午: "卯",
  戌: "卯",
  巳: "午",
  酉: "午",
  丑: "午",
  亥: "子",
  卯: "子",
  未: "子",
} as const;

export const TRAVELING_HORSE_BRANCH_BY_GROUP = {
  申: "寅",
  子: "寅",
  辰: "寅",
  寅: "申",
  午: "申",
  戌: "申",
  巳: "亥",
  酉: "亥",
  丑: "亥",
  亥: "巳",
  卯: "巳",
  未: "巳",
} as const;

export const SIX_COMBINATION_PAIRS = new Set([
  "子|丑",
  "寅|亥",
  "卯|戌",
  "辰|酉",
  "巳|申",
  "午|未",
]);

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

export const DESTRUCTION_PAIRS = new Set([
  "子|酉",
  "卯|午",
  "辰|丑",
  "未|戌",
  "寅|亥",
]);

export const PUNISHMENT_PAIR_KEYS = new Set(["子|卯"]);

export const PUNISHMENT_TRIOS = [
  ["丑", "未", "戌"],
  ["寅", "巳", "申"],
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

export const SHEN_SHA_COPY = {
  nobleman: {
    starName: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
    meaning: "ดาวอุปถัมภ์ ชี้จังหวะที่มีผู้ใหญ่ค้ำชู คนแนะนำ หรือแรงสนับสนุนเข้ามาช่วยเปิดทาง",
  },
  peachBlossom: {
    starName: "ดอกท้อ (桃花)",
    meaning: "ดาวเสน่ห์และแรงดึงดูด ชี้พลังด้านภาพลักษณ์ สังคม ความนิยม และความสัมพันธ์",
  },
  wenChang: {
    starName: "บุ่งเชียง/วิชาการ (文昌)",
    meaning: "ดาววิชาการ การคิดเชิงระบบ การเขียน การเรียนรู้ และงานที่ต้องใช้ปัญญาหรือชื่อเสียงทางความรู้",
  },
  travelingHorse: {
    starName: "ม้าเหิน (驿马)",
    meaning: "ดาวการเคลื่อนไหว การเดินทาง การโยกย้าย และโอกาสที่เกิดจากการเปลี่ยนจังหวะชีวิตหรือสถานที่",
  },
} as const;