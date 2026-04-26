import type { BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";

export function createTestKnowledgeRepository(): BaziKnowledgeRepository {
  const matrixHeader = [
    "",
    "",
    "",
    "",
    "",
    "",
    "ม1",
    "甲",
    "2ฟ",
    "乙",
    "ฟ3",
    "丙",
    "ฟ4",
    "丁",
    "ด5",
    "戊",
    "ด6",
    "己",
    "ท7",
    "庚",
    "ท8",
    "辛",
    "น9",
    "壬",
    "น10",
    "癸",
  ];

  const personas = new Map<string, Awaited<ReturnType<BaziKnowledgeRepository["findSixtyJiaziPersona"]>>>(
    [
      [
        "戊|戌",
        {
          dayMasterChinese: "戊",
          branchChinese: "戌",
          elementTone: "earth",
          twelveQiLabel: "墓",
          dayMasterNarrative: null,
          branchNarrative: null,
          combinedNarrative: "Acts like a stabilizer under pressure and becomes more useful when responsibility increases.",
        },
      ],
      [
        "己|巳",
        {
          dayMasterChinese: "己",
          branchChinese: "巳",
          elementTone: "fire",
          twelveQiLabel: "帝旺",
          dayMasterNarrative: null,
          branchNarrative: null,
          combinedNarrative: "Builds influence patiently, then turns preparation into visible results when timing opens.",
        },
      ],
    ] as const,
  );

  const dayMasterStrengthProfiles = new Map<string, Awaited<ReturnType<BaziKnowledgeRepository["findDayMasterStrengthProfile"]>>>([
    [
      "己|อ่อนแอ",
      {
        dayMaster: "己",
        strengthState: "อ่อนแอ",
        sourceState: "อ่อนแอ",
        lookupState: "อ่อนแอ",
        narrative: "ดิถีดินหยินกำลังอ่อน ต้องอาศัยแรงหนุนและจังหวะที่ค่อยเป็นค่อยไปจึงจะออกผลดี",
        qiLabel: "帝旺",
        scoreText: "3.75",
      },
    ],
    [
      "戊|แข็งแรง/สมดุล",
      {
        dayMaster: "戊",
        strengthState: "แข็งแรง/สมดุล",
        sourceState: "แข็งแรง/สมดุล",
        lookupState: "แข็งแรง/สมดุล",
        narrative: "ดิถีดินหยางค่อนข้างสมดุล รับทั้งภาระและโอกาสได้เมื่อบริบทไม่เหวี่ยงเกินไป",
        qiLabel: "养",
        scoreText: "4.50",
      },
    ],
  ]);

  const matrices = {
    love: [
      {
        domain: "love" as const,
        sourceVariant: "คู่สมพงษ์(ความรัก) - 12เชี่ยงแซความรัก",
        pairKey: "12เชี่ยงแซความรัก",
        rowOrder: 1,
        code: "ม1",
        label: "甲",
        scoreText: null,
        narrative: null,
        rawCells: matrixHeader,
      },
      {
        domain: "love" as const,
        sourceVariant: "คู่สมพงษ์(ความรัก) - 12เชี่ยงแซความรัก",
        pairKey: "12เชี่ยงแซความรัก",
        rowOrder: 2,
        code: "A4",
        label: "ลิ่มกัว",
        scoreText: "100",
        narrative: "เป็นคนรักที่มีบทบาทหน้าที่สำคัญ หรือมีตำแหน่งในหน้าที่การงาน",
        rawCells: [
          "A4", "ลิ่มกัว", "100", "เป็นคนรักที่มีบทบาทหน้าที่สำคัญ หรือมีตำแหน่งในหน้าที่การงาน", "", "",
          "3", "寅", "4", "卯", "6", "巳", "7", "午", "6", "巳", "7", "午", "9", "申", "10", "酉", "12", "亥", "1", "子",
        ],
      },
      {
        domain: "love" as const,
        sourceVariant: "คู่สมพงษ์(ความรัก) - 12เชี่ยงแซความรัก",
        pairKey: "12เชี่ยงแซความรัก",
        rowOrder: 3,
        code: "A5",
        label: "ตี้อ๋วง",
        scoreText: "110",
        narrative: "เป็นคนรักที่บางครั้งอาจควบคุมมากไป หรือใช้อำนาจในความสัมพันธ์เกินพอดี",
        rawCells: [
          "A5", "ตี้อ๋วง", "110", "เป็นคนรักที่บางครั้งอาจควบคุมมากไป หรือใช้อำนาจในความสัมพันธ์เกินพอดี", "", "",
          "4", "卯", "3", "寅", "7", "午", "6", "巳", "7", "午", "6", "巳", "10", "酉", "9", "申", "1", "子", "12", "亥",
        ],
      },
    ],
    work: [
      {
        domain: "work" as const,
        sourceVariant: "คู่สมพงษ์(การงาน) - 12เชี่ยงแซการงาน",
        pairKey: "12เชี่ยงแซการงาน",
        rowOrder: 1,
        code: "ม1",
        label: "甲",
        scoreText: null,
        narrative: null,
        rawCells: matrixHeader,
      },
      {
        domain: "work" as const,
        sourceVariant: "คู่สมพงษ์(การงาน) - 12เชี่ยงแซการงาน",
        pairKey: "12เชี่ยงแซการงาน",
        rowOrder: 2,
        code: "B3",
        label: "กวงตั่ว",
        scoreText: "90",
        narrative: "เป็นคู่ร่วมงานที่เข้าใจกันดี วางระบบและบทบาทได้ชัด",
        rawCells: [
          "B3", "กวงตั่ว", "90", "เป็นคู่ร่วมงานที่เข้าใจกันดี วางระบบและบทบาทได้ชัด", "", "",
          "2", "丑", "5", "辰", "5", "辰", "8", "未", "5", "辰", "8", "未", "8", "未", "11", "戌", "11", "戌", "2", "丑",
        ],
      },
      {
        domain: "work" as const,
        sourceVariant: "คู่สมพงษ์(การงาน) - 12เชี่ยงแซการงาน",
        pairKey: "12เชี่ยงแซการงาน",
        rowOrder: 3,
        code: "B4",
        label: "ลิ่มกัว",
        scoreText: "100",
        narrative: "เป็นคู่ร่วมงานที่ผลักกันขึ้นตำแหน่งและทำให้งานเด่นชัด",
        rawCells: [
          "B4", "ลิ่มกัว", "100", "เป็นคู่ร่วมงานที่ผลักกันขึ้นตำแหน่งและทำให้งานเด่นชัด", "", "",
          "3", "寅", "4", "卯", "6", "巳", "7", "午", "6", "巳", "10", "酉", "9", "申", "10", "酉", "12", "亥", "1", "子",
        ],
      },
    ],
  };

  return {
    async findSolarTermBoundaryContext(birthAtHongKong) {
      if (birthAtHongKong.startsWith("2024-02-04")) {
        return {
          previous: {
            label: "2024-02-03-rain-water",
            solarTermName: "大寒",
            boundaryAt: "2024-01-20 22:07:00",
          },
          next: {
            label: "2024-02-04-start-of-spring",
            solarTermName: "立春",
            boundaryAt: "2024-02-04 16:27:07",
          },
        };
      }

      return {
        previous: {
          label: "1992-08-07-start-of-autumn",
          solarTermName: "立秋",
          boundaryAt: "1992-08-07 09:00:00",
        },
        next: {
          label: "1992-08-23-limit-of-heat",
          solarTermName: "处暑",
          boundaryAt: "1992-08-23 04:00:00",
        },
      };
    },
    async findSixtyJiaziPersona(dayMasterChinese, branchChinese) {
      return personas.get(`${dayMasterChinese}|${branchChinese}`) ?? null;
    },
    async findDayMasterStrengthProfile(dayMasterChinese, strengthState) {
      return dayMasterStrengthProfiles.get(`${dayMasterChinese}|${strengthState}`) ?? null;
    },
    async findDomainMatrixRows(domain) {
      return matrices[domain];
    },
  };
}