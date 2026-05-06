import type {
  BaseChartDetailItemValue,
  BaseChartReactionBadgeValue,
  BaseChartReadingValue,
  BaseChartStrengthGateValue,
} from "@/lib/bazi/schema-types";

export type ReactionChamberDoctrineLane = {
  key: string;
  title: string;
  description?: string;
  readingOrder: number;
  badges: BaseChartReactionBadgeValue[];
  badgeCount: number;
  previewLabels: string[];
};

export type ReactionChamberDoctrineModel = {
  kicker: string;
  title: string;
  subtitle: string;
  summary: string;
  strengthGate?: BaseChartStrengthGateValue;
  readingOrderSteps: string[];
  legendItems: BaseChartDetailItemValue[];
  lanes: ReactionChamberDoctrineLane[];
  evidenceTitle: string;
  evidenceSummary: string;
};

function buildPreviewLabels(badges: BaseChartReactionBadgeValue[]): string[] {
  return badges
    .slice(0, 4)
    .map((badge) => badge.shortLabel ?? badge.schoolLabel ?? badge.label);
}

export function buildReactionChamberDoctrineModel(args: {
  dayMaster: string;
  reading?: BaseChartReadingValue;
  hiddenSecondaryCount?: number;
}): ReactionChamberDoctrineModel {
  const { dayMaster, reading, hiddenSecondaryCount = 0 } = args;
  const strengthGate = reading?.strengthGate;
  const readingOrderSteps = reading?.readingOrderSteps ?? [];
  const legendItems = reading?.legendItems ?? [];
  const lanes = (reading?.schoolSections ?? []).map((section) => {
    const description = section.key === "markers" && hiddenSecondaryCount > 0
      ? `${section.description ?? ""}${section.description ? " " : ""}มี semantic signal ซ่อนใน pane graph อีก ${hiddenSecondaryCount} รายการ`
      : section.description;

    return {
      key: section.key,
      title: section.title,
      description,
      readingOrder: section.readingOrder,
      badges: section.badges,
      badgeCount: section.badges.length,
      previewLabels: buildPreviewLabels(section.badges),
    } satisfies ReactionChamberDoctrineLane;
  });

  const summary = strengthGate?.summary
    ? `เริ่มจาก${strengthGate.title} แล้วค่อยอ่านบทบาท ปฏิกิริยา และ marker โดยใช้กราฟเป็นหลักฐานยืนยัน`
    : "อ่านตามลำดับหลักสำนักก่อน แล้วใช้กราฟเป็นหลักฐานยืนยันภายหลัง";
  const evidenceSummary = hiddenSecondaryCount > 0
    ? `แผนภาพนี้เป็นหลักฐานประกอบการอ่าน มี marker/semantic signal ชั้นรองซ่อนอยู่อีก ${hiddenSecondaryCount} รายการ`
    : "แผนภาพนี้เป็นหลักฐานประกอบการอ่าน ใช้ยืนยัน role, interaction และ marker หลังจากอ่าน lanes แล้ว";

  return {
    kicker: "อ่านตามหลักสำนัก",
    title: "ลำดับอ่านปฏิกิริยาของดวงนี้",
    subtitle: `ดิถี ${dayMaster}`,
    summary,
    strengthGate,
    readingOrderSteps,
    legendItems,
    lanes,
    evidenceTitle: "หลักฐานบนแผนภาพ",
    evidenceSummary,
  };
}
