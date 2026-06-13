import type { CSSProperties } from "react";

import { YANG_STEMS } from "@/lib/bazi/pillar-display";
import {
  BRANCH_TO_ELEMENT,
  ELEMENT_COLORS_TH,
  ELEMENT_LABELS_TH,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import type { PillarValue } from "@/lib/bazi/schema-types";

type ElementEn = keyof typeof ELEMENT_LABELS_TH;

/** กิ่ง (地支) ฝั่งหยาง — ใช้ตัดสิน YANG/YIN ของกิ่ง */
export const YANG_BRANCHES = new Set(["子", "寅", "辰", "午", "申", "戌"]);
/** ชื่อสัตว์นักษัตร (อังกฤษ) ของกิ่ง — โชว์ใต้กิ่งในตารางเสา */
export const BRANCH_ZODIAC_EN: Record<string, string> = {
  子: "RAT", 丑: "OX", 寅: "TIGER", 卯: "RABBIT", 辰: "DRAGON", 巳: "SNAKE",
  午: "HORSE", 未: "GOAT", 申: "MONKEY", 酉: "ROOSTER", 戌: "DOG", 亥: "PIG",
};

export function elementOfStem(stem: string): ElementEn | undefined {
  return STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];
}
export function elementOfBranch(branch: string): ElementEn | undefined {
  return BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT];
}
export function colorOf(element: ElementEn | undefined): string {
  if (!element) return "#3d4548";
  return ELEMENT_COLORS_TH[ELEMENT_LABELS_TH[element]] ?? "#3d4548";
}

export type PillarColumnData = { label: string; pillar: PillarValue | undefined };
export type ColumnHighlight = { color: string; roleLabels: string[] };

/** หนึ่งคอลัมน์เสา: หัว + cell ก้าน (อักษร+YANG FIRE) + cell กิ่ง (อักษร+ดาวแฝง+YANG DOG) */
export function PillarTableColumn({
  label,
  pillar,
  highlight,
}: {
  label: string;
  pillar: PillarValue | undefined;
  highlight?: ColumnHighlight;
}) {
  const cls = `ylc-chart-col${highlight ? " ylc-chart-col--hl" : ""}`;
  const style = highlight ? ({ "--hl": highlight.color } as CSSProperties) : undefined;

  if (!pillar) {
    return (
      <div className={cls} style={style}>
        <div className="ylc-chart-col__head">{label}</div>
        <div className="ylc-chart-col__body">—</div>
      </div>
    );
  }

  const stemEl = elementOfStem(pillar.stem);
  const branchEl = elementOfBranch(pillar.branch);
  const yyStem = YANG_STEMS.has(pillar.stem) ? "YANG" : "YIN";
  const yyBranch = YANG_BRANCHES.has(pillar.branch) ? "YANG" : "YIN";
  const hidden = pillar.hiddenStems ?? [];

  return (
    <div className={cls} style={style}>
      <div className="ylc-chart-col__head">{label}</div>
      <div className="ylc-chart-col__glyphs">
        <div className="ylc-chart-cell ylc-chart-cell--stem">
          <span className="ylc-chart-glyph" style={{ color: colorOf(stemEl) }}>{pillar.stem}</span>
          <span className="ylc-chart-en">{yyStem} {stemEl ? stemEl.toUpperCase() : ""}</span>
        </div>
        <div className="ylc-chart-cell ylc-chart-cell--branch">
          <span className="ylc-chart-glyph" style={{ color: colorOf(branchEl) }}>{pillar.branch}</span>
          {hidden.length > 0 ? (
            <span className="ylc-chart-hidden">
              {hidden.map((h, i) => (
                <span key={i} style={{ color: colorOf(elementOfStem(h)) }}>{h}</span>
              ))}
            </span>
          ) : null}
          <span className="ylc-chart-en">{yyBranch} {BRANCH_ZODIAC_EN[pillar.branch] ?? ""}</span>
        </div>
      </div>
      {highlight ? (
        <div className="ylc-chart-col__role" style={{ color: highlight.color }}>
          {highlight.roleLabels.join("/")}
        </div>
      ) : null}
    </div>
  );
}

/** ตารางเสา 5 คอลัมน์ใช้ร่วม — variant "full" (หน้าแผ่นดวง) / "chapter" (แถบกำกับบท) */
export function ChartPillarTable({
  cols,
  highlights,
  variant = "full",
}: {
  cols: PillarColumnData[];
  highlights?: Map<number, ColumnHighlight>;
  variant?: "full" | "chapter";
}) {
  return (
    <div className={`ylc-chart-grid ylc-chart-grid--${variant}`}>
      {cols.map((col, index) => (
        <PillarTableColumn
          key={index}
          label={col.label}
          pillar={col.pillar}
          highlight={highlights?.get(index)}
        />
      ))}
    </div>
  );
}
