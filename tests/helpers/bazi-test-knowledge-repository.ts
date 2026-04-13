import type { BaziKnowledgeRepository } from "@/lib/bazi/symbolic-engine";

export function createTestKnowledgeRepository(): BaziKnowledgeRepository {
  const stages = new Map<string, Awaited<ReturnType<BaziKnowledgeRepository["findTwelveQiStage"]>>>(
    [
      ["戊|卯", { stageNameChinese: "沐浴", stageNameThai: "หมกยก", dayMaster: "戊", branch: "卯" }],
      ["戊|丑", { stageNameChinese: "养", stageNameThai: "เอี้ยง", dayMaster: "戊", branch: "丑" }],
      ["戊|戌", { stageNameChinese: "墓", stageNameThai: "หมอ", dayMaster: "戊", branch: "戌" }],
      ["戊|申", { stageNameChinese: "病", stageNameThai: "แป่", dayMaster: "戊", branch: "申" }],
      ["戊|辰", { stageNameChinese: "冠带", stageNameThai: "กวงตั่ว", dayMaster: "戊", branch: "辰" }],
      ["戊|寅", { stageNameChinese: "长生", stageNameThai: "เชี่ยงแซ", dayMaster: "戊", branch: "寅" }],
      ["己|申", { stageNameChinese: "沐浴", stageNameThai: "หมกยก", dayMaster: "己", branch: "申" }],
      ["己|巳", { stageNameChinese: "帝旺", stageNameThai: "ตี้อ๋วง", dayMaster: "己", branch: "巳" }],
      ["己|未", { stageNameChinese: "冠带", stageNameThai: "กวงตั่ว", dayMaster: "己", branch: "未" }],
    ] as const,
  );

  const personas = new Map<string, Awaited<ReturnType<BaziKnowledgeRepository["findSixtyJiaziPersona"]>>>(
    [
      [
        "戊|戌",
        {
          dayMasterChinese: "戊",
          branchChinese: "戌",
          elementTone: "earth",
          twelveQiLabel: "墓",
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
          combinedNarrative: "Builds influence patiently, then turns preparation into visible results when timing opens.",
        },
      ],
    ] as const,
  );

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
    async findTwelveQiStage(dayMasterChinese, branchChinese) {
      return stages.get(`${dayMasterChinese}|${branchChinese}`) ?? null;
    },
    async findSixtyJiaziPersona(dayMasterChinese, branchChinese) {
      return personas.get(`${dayMasterChinese}|${branchChinese}`) ?? null;
    },
  };
}