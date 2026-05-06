export const REAL_CASE_1981_03_17_GOLDEN_CONTRACT = {
  input: {
    birthDate: "1981-03-17",
    birthTime: "10:22",
    gender: "male",
    province: "Bangkok",
    calendarSystem: "solar",
    timezone: "Asia/Bangkok",
  },
  fourPillars: {
    year: { stem: "辛", branch: "酉" },
    month: { stem: "辛", branch: "卯" },
    day: { stem: "甲", branch: "午" },
    hour: { stem: "己", branch: "巳" },
  },
  expectedStemInteractions: [
    { schoolLabel: "ภาคีราศีบน", labelIncludes: ["甲", "己"], status: "active" },
  ],
  expectedBranchInteractions: [
    { schoolLabel: "ชง", labelIncludes: ["卯酉"], status: "active", tier: "primary" },
    { schoolLabel: "เฮ้ง", labelIncludes: ["卯午酉"], status: "active", tier: "tertiary" },
    { schoolLabel: "ผั่ว", labelIncludes: ["甲午"], status: "active", tier: "secondary" },
  ],
  expectedMarkers: {
    visible: [
      { schoolLabel: "บุ่งเชียง/วิชาการ (文昌)", pillars: ["ยาม"] },
    ],
    absent: ["กุ้ยนั้ง", "天乙", "ขุนนาง"],
  },
  expectedElementFlow: [
    { edgeIdIncludes: "hour-stem-role", flowLabel: "โชคลาภ", flowElement: "earth", flowDirection: "outward" },
    { edgeIdIncludes: "year-stem-role", flowLabel: "พิฆาต", flowElement: "metal", flowDirection: "inward" },
  ],
} as const;

export const REAL_CASE_1993_11_24_GOLDEN_CONTRACT = {
  input: {
    birthDate: "1993-11-24",
    birthTime: "15:09",
    gender: "male",
    province: "Chiang Rai",
    calendarSystem: "solar",
    timezone: "Asia/Bangkok",
  },
  fourPillars: {
    year: { stem: "癸", branch: "酉" },
    month: { stem: "癸", branch: "亥" },
    day: { stem: "己", branch: "酉" },
    hour: { stem: "壬", branch: "申" },
  },
  dayMaster: "己",
  strengthScore: 0.25,
  expectedStageDisplays: {
    yearUpper: "แป่/แป่",
    monthUpper: "แป่/ตี้อ๋วง",
    dayLower: "เชี่ยงแซ",
    hourUpper: "หมกยก/เชี่ยงแซ",
    hourLower: "หมกยก/เชี่ยงแซ",
  },
  expectedStemInteractions: [
    { schoolLabel: "พิฆาตราศีบน", label: "ฟ้าพิฆาต 癸己", status: "active", occurrences: 2 },
  ],
  expectedBranchInteractions: [
    { schoolLabel: "ไห่", label: "ไห่ 申亥", status: "active", tier: "secondary" },
    { schoolLabel: "เฮ้ง", label: "เฮ้ง 酉酉", status: "active", tier: "tertiary" },
    { schoolLabel: "ผั่ว", label: "ผั่ว 壬申", status: "active", tier: "secondary" },
  ],
  expectedMarkers: {
    visible: [
      { schoolLabel: "ขุนนาง/อุปถัมภ์ (天乙贵人)", pillars: ["ยาม"] },
      { schoolLabel: "บุ่งเชียง/วิชาการ (文昌)", pillars: ["ปี"] },
      { schoolLabel: "บุ่งเชียง/วิชาการ (文昌)", pillars: ["วัน"] },
      { schoolLabel: "ม้าเหิน (驿马)", pillars: ["เดือน"] },
    ],
    graphVisible: [
      "กุ้ยนั้ง/อุปถัมภ์ (天乙贵人)",
      "บุ่งเชียง/วิชาการ (文昌)",
    ],
    graphHiddenOverlay: ["ม้าเหิน (驿马)"],
  },
  expectedElementFlow: [
    { edgeIdIncludes: "year-stem-role", flowLabel: "โชคลาภ", flowElement: "water", flowDirection: "outward" },
    { edgeIdIncludes: "month-stem-role", flowLabel: "โชคลาภ", flowElement: "water", flowDirection: "outward" },
    { edgeIdIncludes: "hour-branch-role", flowLabel: "ถ่ายเท", flowElement: "metal", flowDirection: "outward" },
  ],
} as const;

export type RealCaseGoldenContract =
  | typeof REAL_CASE_1981_03_17_GOLDEN_CONTRACT
  | typeof REAL_CASE_1993_11_24_GOLDEN_CONTRACT;
