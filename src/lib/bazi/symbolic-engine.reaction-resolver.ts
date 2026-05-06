import type { BaseChartReactionSemanticValue } from "@/lib/bazi/schema-types";

export type ReactionFlowCategory = "output" | "wealth" | "power" | "resource" | "companion";

type RoleSemanticDefinition = {
  schoolLabel: string;
  meaningShort: string;
  schoolKey: string;
  summary: string;
  flowCategory: ReactionFlowCategory;
  flowCycleType: "generating" | "controlling" | "neutral";
  flowDirection: "outward" | "inward" | "none";
  flowLabel: string;
};

type InteractionSemanticDefinition = {
  schoolKey: string;
  summary: string;
  displayLabel?: string;
};

type MarkerSemanticDefinition = {
  schoolKey: string;
  summary: string;
  overlayTier: "visible" | "secondary";
  displayLabel?: string;
};

const ROLE_SEMANTICS: Record<string, RoleSemanticDefinition> = {
  比肩: {
    schoolLabel: "ปี่เกียง",
    meaningShort: "พวกเดียวกัน การช่วยเหลือและการแย่งแรงกันของคนระดับเดียวกัน",
    schoolKey: "companion",
    summary: "พลังคู่ธาตุระดับเดียวกัน ช่วยกันได้แต่ก็แย่งแรงกันได้",
    flowCategory: "companion",
    flowCycleType: "neutral",
    flowDirection: "none",
    flowLabel: "คู่ธาตุ",
  },
  劫财: {
    schoolLabel: "เกี๊ยบไช้",
    meaningShort: "คู่ธาตุต่างพลัง แรงแข่ง แรงแชร์ทรัพยากร และคู่แข่งใกล้ตัว",
    schoolKey: "companion",
    summary: "พลังคู่ธาตุต่างขั้วที่แชร์หรือแย่งทรัพยากรใกล้ตัว",
    flowCategory: "companion",
    flowCycleType: "neutral",
    flowDirection: "none",
    flowLabel: "คู่ธาตุ",
  },
  食神: {
    schoolLabel: "เจี้ยซิ้ง",
    meaningShort: "แรงถ่ายเท การแสดงออก ผลงาน การพูด และสิ่งที่เราปล่อยออกไป",
    schoolKey: "output",
    summary: "พลังถ่ายเทที่เปลี่ยนแรงในตัวให้ออกเป็นผลงานหรือการแสดงออก",
    flowCategory: "output",
    flowCycleType: "generating",
    flowDirection: "outward",
    flowLabel: "ถ่ายเท",
  },
  伤官: {
    schoolLabel: "เซียกัว",
    meaningShort: "แรงถ่ายเทต่างพลัง ความคิดคม การแสดงออกแรง และแรงท้าทายกรอบ",
    schoolKey: "output",
    summary: "พลังถ่ายเทต่างขั้วที่คม ชัด และพร้อมท้าทายกรอบเดิม",
    flowCategory: "output",
    flowCycleType: "generating",
    flowDirection: "outward",
    flowLabel: "ถ่ายเท",
  },
  偏财: {
    schoolLabel: "เพียงไช้",
    meaningShort: "ลาภแบบพลิกเร็ว โอกาส เงินหมุน และผลประโยชน์ที่จับฉวย",
    schoolKey: "wealth",
    summary: "พลังลาภฉวย โอกาสเร็ว และเงินหมุนที่ต้องจับจังหวะ",
    flowCategory: "wealth",
    flowCycleType: "controlling",
    flowDirection: "outward",
    flowLabel: "โชคลาภ",
  },
  正财: {
    schoolLabel: "เจี้ยไช้",
    meaningShort: "ลาภที่เป็นระบบ การเงิน ทรัพย์ และผลประโยชน์ที่ต้องรักษา",
    schoolKey: "wealth",
    summary: "พลังลาภที่เป็นระบบ เน้นทรัพย์สินและการรักษาฐานะ",
    flowCategory: "wealth",
    flowCycleType: "controlling",
    flowDirection: "outward",
    flowLabel: "โชคลาภ",
  },
  偏印: {
    schoolLabel: "เพียงอิ่ง",
    meaningShort: "แรงหนุนเชิงเฉพาะทาง การคิด การศึกษา และแรงอุปถัมภ์แบบไม่ตรงเส้น",
    schoolKey: "resource",
    summary: "พลังทรัพยากรเฉพาะทางที่หนุนผ่านความคิดและการอุปถัมภ์ทางอ้อม",
    flowCategory: "resource",
    flowCycleType: "generating",
    flowDirection: "inward",
    flowLabel: "ส่งเสริม",
  },
  正印: {
    schoolLabel: "เจี้ยอิ่ง",
    meaningShort: "แรงหนุนตรง ผู้ใหญ่ ครู อุปถัมภ์ และความชอบธรรม",
    schoolKey: "resource",
    summary: "พลังหนุนตรงจากผู้ใหญ่ ครู และความชอบธรรมที่ค้ำชูดิถี",
    flowCategory: "resource",
    flowCycleType: "generating",
    flowDirection: "inward",
    flowLabel: "ส่งเสริม",
  },
  七杀: {
    schoolLabel: "ชิกสัวะ",
    meaningShort: "แรงกด แรงเสี่ยง และอำนาจกดดันที่ต้องรับมืออย่างมีวินัย",
    schoolKey: "power",
    summary: "พลังอำนาจกดดันที่บังคับให้ดิถีต้องมีวินัยและระวังความเสี่ยง",
    flowCategory: "power",
    flowCycleType: "controlling",
    flowDirection: "inward",
    flowLabel: "พิฆาต",
  },
  正官: {
    schoolLabel: "เจี้ยกัว",
    meaningShort: "หน้าที่ ระเบียบ กติกา ตำแหน่ง และความรับผิดชอบที่ต้องถือไว้",
    schoolKey: "power",
    summary: "พลังอำนาจเชิงระเบียบ หน้าที่ และความรับผิดชอบที่เข้ามาคุมดิถี",
    flowCategory: "power",
    flowCycleType: "controlling",
    flowDirection: "inward",
    flowLabel: "พิฆาต",
  },
};

const INTERACTION_SEMANTICS: Record<string, InteractionSemanticDefinition> = {
  pakhee: {
    schoolKey: "pakhee",
    summary: "คู่ที่ดึงเข้าหากัน มีแรงร่วมมือ และอาจแปรธาตุเมื่อบริบทเอื้อ",
  },
  chong: {
    schoolKey: "chong",
    summary: "แรงปะทะโดยตรงที่ทำให้เกิดการเปลี่ยนแปลงหรือเสียสมดุลเดิม",
  },
  hai: {
    schoolKey: "hai",
    summary: "แรงให้ร้าย กล่าวหา หรือบั่นทอนความสัมพันธ์ในฐานที่เกี่ยวข้อง",
  },
  pua: {
    schoolKey: "pua",
    summary: "แรงรั่ว แตก หรือเสียหายในจุดที่สัมพันธ์กัน",
  },
  heng: {
    schoolKey: "heng",
    summary: "แรงเบียดเบียน อึดอัด หรือทำร้ายกันในกฎของราศีล่าง",
  },
  "sam-heng": {
    schoolKey: "sam-heng",
    summary: "แรงซำเฮ้งแบบสามฐานที่ทำให้เกิดการเบียดเบียน วุ่นวาย และโต้เถียงกันหนักขึ้น",
    displayLabel: "ซำเฮ้ง",
  },
  "faa-pakhee": {
    schoolKey: "faa-pakhee",
    summary: "ภาคีของราศีบนที่ร่วมมือกันและอาจเบนแรงไปหาธาตุปลายทาง",
  },
  "faa-phikat": {
    schoolKey: "faa-phikat",
    summary: "พิฆาตของราศีบนที่ทำร้ายกันโดยตรงในชั้นฟ้า",
  },
};

const MARKER_SEMANTICS: Record<string, MarkerSemanticDefinition> = {
  nobleman: {
    schoolKey: "nobleman",
    summary: "แรงอุปถัมภ์ ผู้ใหญ่ช่วยเหลือ หรือมีคนค้ำชู",
    displayLabel: "กุ้ยนั้ง/อุปถัมภ์ (天乙贵人)",
    overlayTier: "visible",
  },
  wenchang: {
    schoolKey: "wenchang",
    summary: "แรงของความคิด การเรียน การเขียน หรือชื่อเสียงจากความรู้",
    displayLabel: "บุ่งเชียง/วิชาการ (文昌)",
    overlayTier: "visible",
  },
  generic: {
    schoolKey: "marker-generic",
    summary: "marker ใช้เป็นชั้นเสริมหลังจากอ่าน role และ interaction หลักแล้ว",
    overlayTier: "secondary",
  },
};

export function resolveRoleSemantic(tenGod: string): RoleSemanticDefinition | null {
  return ROLE_SEMANTICS[tenGod] ?? null;
}

export function resolveInteractionSemantic(args: {
  kind: "combination" | "clash" | "harm" | "destruction" | "punishment";
  isStemLevel?: boolean;
  participantCount?: number;
}): BaseChartReactionSemanticValue {
  const { kind, isStemLevel = false, participantCount = 0 } = args;
  const key = isStemLevel
    ? (kind === "combination" ? "faa-pakhee" : "faa-phikat")
    : (kind === "punishment" && participantCount >= 3
      ? "sam-heng"
      : kind === "combination"
        ? "pakhee"
        : kind === "clash"
          ? "chong"
          : kind === "harm"
            ? "hai"
            : kind === "destruction"
              ? "pua"
              : "heng");
  const definition = INTERACTION_SEMANTICS[key];

  return {
    kind: "interaction",
    schoolKey: definition.schoolKey,
    summary: definition.summary,
    displayLabel: definition.displayLabel,
    sourceKind: "interaction-outcome",
  };
}

export function resolveMarkerSemantic(starName: string): BaseChartReactionSemanticValue {
  const text = starName.trim();
  const definition = text.includes("天乙") || text.includes("ขุนนาง") || text.includes("กุ้ยนั้ง")
    ? MARKER_SEMANTICS.nobleman
    : text.includes("文昌") || text.includes("บุ่งเชียง") || text.includes("วิชาการ")
      ? MARKER_SEMANTICS.wenchang
      : MARKER_SEMANTICS.generic;

  return {
    kind: "marker",
    schoolKey: definition.schoolKey,
    summary: definition.summary,
    sourceKind: "canonical-marker",
    overlayTier: definition.overlayTier,
    displayLabel: definition.displayLabel ?? text,
    schoolLabel: text,
  };
}

export function resolveSchoolEdgeClass(schoolKey: string | undefined): string {
  return schoolKey ? `school-${schoolKey}` : "";
}
