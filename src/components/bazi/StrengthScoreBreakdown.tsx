import { useState } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import type { CalculationTraceValue } from "@/lib/bazi/schema-types";
import {
  classifyOperatorStrengthScore,
  OPERATOR_STRENGTH_CLASS_BANDS,
} from "@/lib/bazi/constants/operator-strength";

type StrengthScoreBreakdownProps = {
  score: number;
  trace: CalculationTraceValue | undefined;
  title?: string;
  defaultDetailOpen?: boolean;
  detailMode?: "inline" | "overlay";
  detailOpen?: boolean;
  onDetailToggle?: () => void;
  detailTriggerLabel?: string;
  className?: string;
};

type StrengthContributionItem = {
  label: string;
  symbol: string;
  weight: number;
};

type StrengthPenaltyItem = {
  label: string;
  value: number;
};

type StrengthBreakdownModel = {
  hasBreakdown: boolean;
  hasOperatorBreakdown: boolean;
  baseOffset: number;
  penalties: StrengthPenaltyItem[];
  penaltyTotal: number;
  primaryFriction: StrengthContributionItem[];
  primarySupports: StrengthContributionItem[];
  qiAdjustments: StrengthContributionItem[];
  qiTotal: number;
  relationAdjustments: StrengthContributionItem[];
  relationTotal: number;
  scoreBand: ReturnType<typeof classifyOperatorStrengthScore>;
  scoreBandIndex: number;
  stageContribution: number;
  summaryCopy: string;
  visibleContributions: StrengthContributionItem[];
  visibleTotal: number;
  hiddenContributions: StrengthContributionItem[];
  hiddenTotal: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRawVariables(trace: CalculationTraceValue | undefined) {
  return trace && isRecord(trace.rawVariables) ? trace.rawVariables : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatSignedNumber(value: number, digits = 2) {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}`;
}

function formatPlainNumber(value: number, digits = 2) {
  return value.toFixed(digits);
}

function sumWeights(entries: StrengthContributionItem[]) {
  return entries.reduce((total, entry) => total + entry.weight, 0);
}

function sumPenalties(entries: StrengthPenaltyItem[]) {
  return entries.reduce((total, entry) => total + entry.value, 0);
}

function toContributionLabel(rawLabel: string, fallbackIndex: number) {
  const labels: Record<string, string> = {
    yearStem: "ก้านฟ้าปี",
    monthStem: "ก้านฟ้าเดือน",
    hourStem: "ก้านฟ้ายาม",
    yearBranch: "ราศีล่างปี",
    monthBranch: "ราศีล่างเดือน",
    dayBranch: "ราศีล่างวัน",
    hourBranch: "ราศีล่างยาม",
    yearZone: "โซนปี",
    dayMonthBranchZone: "โซนวัน-เดือน",
    hourMonthStemZone: "โซนยาม-เดือน",
    monthBranchVsDayBranchConflict: "แรงปะทะเดือน-วัน",
    dayBranchVsHourBranchConflict: "แรงปะทะวัน-ยาม",
  };

  if (labels[rawLabel]) {
    return labels[rawLabel];
  }

  const hiddenMatch = rawLabel.match(/^(year|month|day|hour)HiddenStem(\d+)$/);

  if (hiddenMatch) {
    const pillarLabels: Record<string, string> = {
      year: "ธาตุแฝงปี",
      month: "ธาตุแฝงเดือน",
      day: "ธาตุแฝงวัน",
      hour: "ธาตุแฝงยาม",
    };
    const [, pillarKey, indexText] = hiddenMatch;

    return `${pillarLabels[pillarKey] ?? "ธาตุแฝง"} ${indexText}`;
  }

  return `รายการ ${fallbackIndex + 1}`;
}

function toContributionItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as StrengthContributionItem[];
  }

  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      return [];
    }

    const weight = getNumber(entry.weight);
    const rawLabel = typeof entry.label === "string"
      ? entry.label
      : typeof entry.pillar === "string"
        ? entry.pillar
        : "";

    if (weight === null) {
      return [];
    }

    return [
      {
        label: toContributionLabel(rawLabel, index),
        symbol: typeof entry.stem === "string"
          ? entry.stem
          : typeof entry.symbol === "string"
            ? entry.symbol
            : "-",
        weight,
      },
    ];
  });
}

function toPenaltyItems(value: unknown) {
  if (!isRecord(value)) {
    return [] as StrengthPenaltyItem[];
  }

  const labels: Array<[string, string]> = [
    ["clashes", "แรงชง"],
    ["punishments", "แรงเฮ้ง"],
    ["harms", "แรงไห่"],
    ["destructions", "แรงผั่ว"],
  ];

  return labels.flatMap(([key, label]) => {
    const amount = getNumber(value[key]);

    if (amount === null || amount === 0) {
      return [];
    }

    return [{ label, value: amount }];
  });
}

function buildStrengthBreakdownModel(
  score: number,
  trace: CalculationTraceValue | undefined,
): StrengthBreakdownModel {
  const rawVariables = getRawVariables(trace);
  const visibleContributions = toContributionItems(rawVariables?.visibleContributions);
  const qiAdjustments = toContributionItems(rawVariables?.qiAdjustments);
  const relationAdjustments = toContributionItems(rawVariables?.relationAdjustments);
  const hiddenContributions = toContributionItems(rawVariables?.hiddenContributions);
  const penalties = toPenaltyItems(rawVariables?.penalties);
  const stageContribution = getNumber(rawVariables?.stageContribution) ?? 0;
  const visibleTotal = sumWeights(visibleContributions);
  const qiTotal = sumWeights(qiAdjustments);
  const relationTotal = sumWeights(relationAdjustments);
  const hiddenTotal = sumWeights(hiddenContributions);
  const penaltyTotal = sumPenalties(penalties);
  const hasOperatorBreakdown = qiAdjustments.length > 0 || relationAdjustments.length > 0;
  const baseOffset = hasOperatorBreakdown
    ? Number((score - visibleTotal - qiTotal - relationTotal).toFixed(2))
    : Number((score - stageContribution - visibleTotal - hiddenTotal + penaltyTotal).toFixed(2));
  const hasBreakdown = Boolean(rawVariables) && (
    visibleContributions.length > 0
    || qiAdjustments.length > 0
    || relationAdjustments.length > 0
    || hiddenContributions.length > 0
    || penalties.length > 0
    || stageContribution !== 0
  );
  const scoreBand = classifyOperatorStrengthScore(score);
  const scoreBandIndex = OPERATOR_STRENGTH_CLASS_BANDS.findIndex((band) => band.id === scoreBand.id);
  const primarySupports = visibleContributions.concat(qiAdjustments).slice(0, 4);
  const primaryFriction = relationAdjustments.length > 0
    ? relationAdjustments
    : penalties.map((entry) => ({
      label: entry.label,
      symbol: "-",
      weight: -entry.value,
    }));
  const summaryCopy = [
    primarySupports.length > 0
      ? `แรงหนุนเด่น ${primarySupports.length} จุด`
      : "ยังไม่พบแรงหนุนที่ต้องขยาย",
    primaryFriction.length > 0
      ? `แรงเสียดสี ${primaryFriction.length} จุด`
      : "ยังไม่พบแรงฉุดเด่น",
  ].join(" · ");

  return {
    hasBreakdown,
    hasOperatorBreakdown,
    baseOffset,
    penalties,
    penaltyTotal,
    primaryFriction,
    primarySupports,
    qiAdjustments,
    qiTotal,
    relationAdjustments,
    relationTotal,
    scoreBand,
    scoreBandIndex,
    stageContribution,
    summaryCopy,
    visibleContributions,
    visibleTotal,
    hiddenContributions,
    hiddenTotal,
  };
}

type StrengthBreakdownDetailContentProps = {
  score: number;
  trace: CalculationTraceValue | undefined;
};

export function StrengthBreakdownDetailContent({
  score,
  trace,
}: StrengthBreakdownDetailContentProps) {
  const model = buildStrengthBreakdownModel(score, trace);

  if (!model.hasBreakdown) {
    return (
      <p className="strength-breakdown__empty">
        trace ของคะแนนพลังรอบนี้ยังไม่พอสำหรับแตกเป็นสมการละเอียด แต่คะแนนรวมยังแสดงได้ตามผลคำนวณหลัก
      </p>
    );
  }

  return (
    <>
      <div className="strength-flow" aria-label="strength node flow">
        <article className="strength-flow__node">
          <span className="strength-flow__node-label">ฐานตั้งต้น</span>
          <strong>{formatPlainNumber(model.baseOffset)}</strong>
        </article>
        <span className="strength-flow__arrow" aria-hidden="true">→</span>
        <article className="strength-flow__node strength-flow__node--support">
          <span className="strength-flow__node-label">ตำแหน่งหลัก</span>
          <strong>{formatSignedNumber(model.hasOperatorBreakdown ? model.visibleTotal : model.stageContribution)}</strong>
        </article>
        <span className="strength-flow__arrow" aria-hidden="true">→</span>
        <article className="strength-flow__node strength-flow__node--support">
          <span className="strength-flow__node-label">
            {model.hasOperatorBreakdown ? "โซนเชี่ยงแซ" : "ธาตุแฝง"}
          </span>
          <strong>{formatSignedNumber(model.hasOperatorBreakdown ? model.qiTotal : model.hiddenTotal)}</strong>
        </article>
        <span className="strength-flow__arrow" aria-hidden="true">→</span>
        <article className="strength-flow__node strength-flow__node--friction">
          <span className="strength-flow__node-label">
            {model.hasOperatorBreakdown ? "แรงปะทะ" : "แรงกระทบ"}
          </span>
          <strong>{formatSignedNumber(model.hasOperatorBreakdown ? model.relationTotal : -model.penaltyTotal)}</strong>
        </article>
        <span className="strength-flow__arrow" aria-hidden="true">→</span>
        <article className="strength-flow__node strength-flow__node--result">
          <span className="strength-flow__node-label">ผลรวม</span>
          <strong>{formatPlainNumber(score)}</strong>
        </article>
      </div>

      <div className="strength-breakdown__grid strength-breakdown__grid--phase6">
        <article className="strength-breakdown__panel">
          <h4>แรงที่หนุนดิถี</h4>
          {model.primarySupports.length > 0 ? (
            <ul className="strength-breakdown__signal-list">
              {model.primarySupports.map((entry) => (
                <li key={`${entry.label}-${entry.symbol}`} className="strength-breakdown__signal">
                  <span>{`${entry.label} · ${entry.symbol}`}</span>
                  <strong>{formatSignedNumber(entry.weight)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="strength-breakdown__empty">trace รอบนี้ไม่ได้ส่งแรงหนุนที่ใช้แตกออกมาเพิ่ม</p>
          )}
        </article>

        <article className="strength-breakdown__panel">
          <h4>แรงที่ฉุดหรือเสียดสี</h4>
          {model.primaryFriction.length > 0 ? (
            <ul className="strength-breakdown__signal-list">
              {model.primaryFriction.map((entry) => (
                <li key={`${entry.label}-${entry.symbol}`} className="strength-breakdown__signal">
                  <span>{`${entry.label}${entry.symbol !== "-" ? ` · ${entry.symbol}` : ""}`}</span>
                  <strong>{formatSignedNumber(entry.weight)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="strength-breakdown__empty">รอบนี้ยังไม่พบแรงปะทะที่หักคะแนนอย่างมีนัยสำคัญ</p>
          )}
        </article>

        <article className="strength-breakdown__panel strength-breakdown__panel--wide">
          <h4>สรุปสมการที่ใช้กับรอบนี้</h4>
          <dl className="strength-breakdown__list">
            <div className="strength-breakdown__row">
              <dt>คะแนนตั้งต้นของระบบ</dt>
              <dd>{formatPlainNumber(model.baseOffset)}</dd>
            </div>
            <div className="strength-breakdown__row">
              <dt>{model.hasOperatorBreakdown ? "น้ำหนักตำแหน่งก้านและกิ่ง" : "น้ำหนักฤดูกาลและ 12 เชี่ยงแซ"}</dt>
              <dd>{formatSignedNumber(model.hasOperatorBreakdown ? model.visibleTotal : model.stageContribution)}</dd>
            </div>
            <div className="strength-breakdown__row">
              <dt>{model.hasOperatorBreakdown ? "แรงเสริมจากโซนเชี่ยงแซ" : "แรงจากธาตุแฝง"}</dt>
              <dd>{formatSignedNumber(model.hasOperatorBreakdown ? model.qiTotal : model.hiddenTotal)}</dd>
            </div>
            <div className="strength-breakdown__row">
              <dt>{model.hasOperatorBreakdown ? "แรงปะทะคงเหลือ" : "แรงชง/เฮ้ง/ไห่/ผั่ว"}</dt>
              <dd>{formatSignedNumber(model.hasOperatorBreakdown ? model.relationTotal : -model.penaltyTotal)}</dd>
            </div>
          </dl>
        </article>
      </div>
    </>
  );
}

export function StrengthScoreBreakdown({
  score,
  trace,
  title = "แผนผังกำลังดิถี",
  defaultDetailOpen = false,
  detailMode = "inline",
  detailOpen,
  onDetailToggle,
  detailTriggerLabel,
  className,
}: StrengthScoreBreakdownProps) {
  const [inlineDetailOpen, setInlineDetailOpen] = useState(defaultDetailOpen);
  const model = buildStrengthBreakdownModel(score, trace);
  const isOverlayMode = detailMode === "overlay";
  const isDetailOpen = isOverlayMode ? Boolean(detailOpen) : (detailOpen ?? inlineDetailOpen);
  const triggerLabel = detailTriggerLabel ?? (isOverlayMode ? "เปิดรายละเอียดกำลังดิถี" : "ดูรายละเอียดกำลังดิถี");

  function handleDetailToggle() {
    if (onDetailToggle) {
      onDetailToggle();
      return;
    }

    setInlineDetailOpen((current) => !current);
  }

  return (
    <Surface
      as="section"
      inset
      className={`strength-breakdown${className ? ` ${className}` : ""}`}
      aria-label={title}
      data-strength-breakdown={model.hasBreakdown ? "available" : "missing"}
      data-strength-band={model.scoreBand.id}
      data-strength-detail-open={isDetailOpen ? "true" : "false"}
    >
      <SectionHeading
        kicker="กำลังดิถี"
        title={title}
        compact
        note="อ่านระดับพลังจากแถบก่อน แล้วค่อยไล่ต้นทางของคะแนนผ่านแผนผังเดียว"
      />

      <div className="strength-meter" aria-label="ระดับกำลังดิถี 5 ระดับ">
        <div className="strength-meter__hero">
          <strong className="strength-meter__score">{formatPlainNumber(score)}</strong>
          <span className="strength-meter__label">{model.scoreBand.displayLabel}</span>
          <p className="metric-copy strength-meter__summary">{model.summaryCopy}</p>
        </div>

        <ol className="strength-meter__rail">
          {OPERATOR_STRENGTH_CLASS_BANDS.map((band, index) => {
            const isActive = band.id === model.scoreBand.id;
            const isPast = index < model.scoreBandIndex;

            return (
              <li
                key={band.id}
                className={`strength-meter__stop${isActive ? " strength-meter__stop--active" : ""}${isPast ? " strength-meter__stop--past" : ""}`}
              >
                <span className="strength-meter__stop-line" aria-hidden="true" />
                <span className="strength-meter__stop-copy">{band.label}</span>
              </li>
            );
          })}
        </ol>

        {model.hasBreakdown ? (
          <div className="strength-breakdown__actions">
            <ActionButton
              type="button"
              className="secondary-action detail-trigger-action strength-breakdown__toggle"
              aria-expanded={isOverlayMode ? undefined : isDetailOpen}
              aria-haspopup={isOverlayMode ? "dialog" : undefined}
              onClick={handleDetailToggle}
            >
              {isOverlayMode ? triggerLabel : (isDetailOpen ? "ซ่อนรายละเอียดกำลังดิถี" : triggerLabel)}
            </ActionButton>
          </div>
        ) : null}
      </div>

      {!isOverlayMode && model.hasBreakdown && isDetailOpen ? (
        <StrengthBreakdownDetailContent score={score} trace={trace} />
      ) : !model.hasBreakdown ? (
        <p className="strength-breakdown__empty">
          trace ของคะแนนพลังรอบนี้ยังไม่พอสำหรับแตกเป็นสมการละเอียด แต่คะแนนรวมยังแสดงได้ตามผลคำนวณหลัก
        </p>
      ) : null}
    </Surface>
  );
}