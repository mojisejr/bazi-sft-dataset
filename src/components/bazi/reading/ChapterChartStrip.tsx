import { ChartPillarTable, type ColumnHighlight } from "@/components/bazi/reading/ChartPillarTable";
import {
  BRANCH_TO_ELEMENT,
  CONTROLS,
  ELEMENT_COLORS_TH,
  ELEMENT_LABELS_TH,
  GENERATES,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import { TOPIC_PATH, type TopicRelationKey } from "@/lib/bazi/topic-path";
import type { CalculatedStateValue, PillarValue } from "@/lib/bazi/schema-types";

type ElementEn = keyof typeof ELEMENT_LABELS_TH;

const ROLE_LABEL_TH: Record<TopicRelationKey, string> = {
  same: "คู่ธาตุ",
  resource: "ธาตุส่งเสริม",
  output: "ดาวถ่ายเท",
  power: "อำนาจ",
  wealth: "โชคลาภ",
};

function elementOf(symbol: string): ElementEn | undefined {
  return (STEM_TO_ELEMENT[symbol as keyof typeof STEM_TO_ELEMENT]
    ?? BRANCH_TO_ELEMENT[symbol as keyof typeof BRANCH_TO_ELEMENT]) as ElementEn | undefined;
}
function colorOf(element: ElementEn | undefined): string {
  if (!element) return "#3d4548";
  return ELEMENT_COLORS_TH[ELEMENT_LABELS_TH[element]] ?? "#3d4548";
}

/** ธาตุเป้าหมายของแต่ละบทบาท เทียบดิถี (dmEl) */
function targetElement(dmEl: ElementEn, role: TopicRelationKey): ElementEn {
  switch (role) {
    case "same":
      return dmEl;
    case "output":
      return GENERATES[dmEl] as ElementEn;
    case "wealth":
      return CONTROLS[dmEl] as ElementEn;
    case "resource": // ธาตุที่ก่อเกิดดิถี (inverse generate)
      return (Object.keys(GENERATES) as ElementEn[]).find((e) => GENERATES[e] === dmEl) ?? dmEl;
    case "power": // ธาตุที่พิฆาตดิถี (inverse control)
      return (Object.keys(CONTROLS) as ElementEn[]).find((e) => CONTROLS[e] === dmEl) ?? dmEl;
  }
}

type Col = { key: string; label: string; pillar: PillarValue | undefined };

export type ChapterAnnotation = {
  cols: Col[];
  /** index คอลัมน์ที่ถูกเน้น → {color, roles} */
  highlights: Map<number, ColumnHighlight>;
  caption: string;
};

/** สร้าง spec ผังดวงกำกับของบท จาก relationKeys (deterministic, client-safe) */
export function buildChapterAnnotation(
  calculatedState: CalculatedStateValue,
  topicId: string,
): ChapterAnnotation | null {
  const topic = TOPIC_PATH.find((t) => t.id === topicId);
  if (!topic || topic.relationKeys.length === 0) return null;
  const dmEl = elementOf(calculatedState.dayMaster);
  if (!dmEl) return null;

  const cols: Col[] = [
    { key: "mingGong", label: "ลัคนา", pillar: calculatedState.mingGong },
    { key: "hour", label: "ยาม", pillar: calculatedState.fourPillars.hour },
    { key: "day", label: "ดิถี", pillar: calculatedState.fourPillars.day },
    { key: "month", label: "เดือน", pillar: calculatedState.fourPillars.month },
    { key: "year", label: "ปี", pillar: calculatedState.fourPillars.year },
  ];

  const highlights = new Map<number, ColumnHighlight>();
  const targets: string[] = [];

  for (const role of topic.relationKeys) {
    const tEl = targetElement(dmEl, role);
    targets.push(`${ROLE_LABEL_TH[role]} (ธาตุ${ELEMENT_LABELS_TH[tEl]})`);
    const color = colorOf(tEl);
    cols.forEach((col, index) => {
      if (index === 2 || !col.pillar) return; // ข้ามดิถีเอง
      const matched = elementOf(col.pillar.stem) === tEl || elementOf(col.pillar.branch) === tEl;
      if (!matched) return;
      const existing = highlights.get(index);
      if (existing) {
        if (!existing.roleLabels.includes(ROLE_LABEL_TH[role])) existing.roleLabels.push(ROLE_LABEL_TH[role]);
      } else {
        highlights.set(index, { color, roleLabels: [ROLE_LABEL_TH[role]] });
      }
    });
  }

  const caption = `บทนี้อ่านจาก ${targets.join(" · ")} — วงสีล้อมรอบตำแหน่งที่เกี่ยวข้องในผัง (เทียบดิถี ${calculatedState.dayMaster})`;

  return { cols, highlights, caption };
}

/** ตารางผังดวงกำกับบท — ตารางเสาเต็ม + วงสีล้อมรอบเสาที่บทนั้นอ้าง (ไม่มีลูกศร) */
export function ChapterChartStrip({ annotation, uid = "" }: { annotation: ChapterAnnotation; uid?: string }) {
  const { cols, highlights, caption } = annotation;
  void uid;

  return (
    <figure className="ylc-cstrip">
      <ChartPillarTable cols={cols} highlights={highlights} variant="chapter" />
      <figcaption className="ylc-cstrip__caption">{caption}</figcaption>
    </figure>
  );
}
