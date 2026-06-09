import type { CSSProperties } from "react";

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
  highlights: Map<number, { color: string; roleLabels: string[] }>;
  /** ลูกศรจากดิถี (index 2) ไปคอลัมน์เป้าหมาย */
  arrows: { to: number; color: string }[];
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

  const highlights = new Map<number, { color: string; roleLabels: string[] }>();
  const arrowSet = new Map<number, string>();
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
      if (!arrowSet.has(index)) arrowSet.set(index, color);
    });
  }

  const arrows = [...arrowSet.entries()].map(([to, color]) => ({ to, color }));
  const caption = `บทนี้อ่านจาก ${targets.join(" · ")} — ลูกศรชี้จากดิถี (${calculatedState.dayMaster}) ไปยังตำแหน่งที่เกี่ยวข้องในผัง`;

  return { cols, highlights, arrows, caption };
}

/** แถบผังดวงย่อพร้อมวงแหวนสี + ลูกศร SVG ชี้ก้าน/กิ่งที่บทนั้นอ้าง */
export function ChapterChartStrip({ annotation, uid = "" }: { annotation: ChapterAnnotation; uid?: string }) {
  const { cols, highlights, arrows, caption } = annotation;
  const colCount = cols.length;
  const centerX = (i: number) => ((i + 0.5) / colCount) * 100;
  const dayX = centerX(2);
  const markerId = (to: number) => `ylc-arw-${uid}-${to}`;

  return (
    <figure className="ylc-cstrip">
      <div className="ylc-cstrip__grid">
        {arrows.length > 0 ? (
          <svg className="ylc-cstrip__arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              {arrows.map((a) => (
                <marker key={a.to} id={markerId(a.to)} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill={a.color} />
                </marker>
              ))}
            </defs>
            {arrows.map((a) => {
              const tx = centerX(a.to);
              const midX = (dayX + tx) / 2;
              return (
                <path
                  key={a.to}
                  d={`M ${dayX} 70 Q ${midX} 99 ${tx} 72`}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="1.4"
                  markerEnd={`url(#${markerId(a.to)})`}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
        ) : null}
        {cols.map((col, index) => {
          const hl = highlights.get(index);
          const isDay = index === 2;
          return (
            <div
              key={col.key}
              className={`ylc-cstrip__col${isDay ? " ylc-cstrip__col--day" : ""}${hl ? " ylc-cstrip__col--hl" : ""}`}
              style={hl ? ({ "--hl": hl.color } as CSSProperties) : undefined}
            >
              <span className="ylc-cstrip__label">{col.label}</span>
              <span className="ylc-cstrip__stem" style={{ color: colorOf(elementOf(col.pillar?.stem ?? "")) }}>
                {col.pillar?.stem ?? "—"}
              </span>
              <span className="ylc-cstrip__branch" style={{ color: colorOf(elementOf(col.pillar?.branch ?? "")) }}>
                {col.pillar?.branch ?? "—"}
              </span>
              {hl ? <span className="ylc-cstrip__role" style={{ color: hl.color }}>{hl.roleLabels.join("/")}</span> : null}
            </div>
          );
        })}
      </div>
      <figcaption className="ylc-cstrip__caption">{caption}</figcaption>
    </figure>
  );
}
