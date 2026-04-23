import type { CalculationTraceValue } from "@/lib/bazi/schema-types";
import {
  classifyOperatorStrengthScore,
  OPERATOR_STRENGTH_CLASS_BANDS,
} from "@/lib/bazi/constants/operator-strength";

type StrengthScoreBreakdownProps = {
  score: number;
  trace: CalculationTraceValue | undefined;
  title?: string;
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

export function StrengthScoreBreakdown({
  score,
  trace,
  title = "แผนผังกำลังดิถี",
}: StrengthScoreBreakdownProps) {
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

  return (
    <section
      className="surface inset-card strength-breakdown"
      aria-label={title}
      data-strength-breakdown={hasBreakdown ? "available" : "missing"}
      data-strength-band={scoreBand.id}
    >
      <div className="section-heading section-heading--compact">
        <div>
          <p className="section-kicker">กำลังดิถี</p>
          <h3>{title}</h3>
          <p className="section-note">อ่านระดับพลังจากแถบก่อน แล้วค่อยไล่ต้นทางของคะแนนผ่านแผนผังเดียว</p>
        </div>
      </div>

      <div className="strength-meter" aria-label="ระดับกำลังดิถี 5 ระดับ">
        <div className="strength-meter__hero">
          <strong className="strength-meter__score">{formatPlainNumber(score)}</strong>
          <span className="strength-meter__label">{scoreBand.displayLabel}</span>
        </div>

        <ol className="strength-meter__rail">
          {OPERATOR_STRENGTH_CLASS_BANDS.map((band, index) => {
            const isActive = band.id === scoreBand.id;
            const isPast = index < scoreBandIndex;

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
      </div>

      {hasBreakdown ? (
        <div className="strength-flow" aria-label="strength node flow">
          <article className="strength-flow__node">
            <span className="strength-flow__node-label">ฐานตั้งต้น</span>
            <strong>{formatPlainNumber(baseOffset)}</strong>
          </article>
          <span className="strength-flow__arrow" aria-hidden="true">→</span>
          <article className="strength-flow__node strength-flow__node--support">
            <span className="strength-flow__node-label">ตำแหน่งหลัก</span>
            <strong>{formatSignedNumber(hasOperatorBreakdown ? visibleTotal : stageContribution)}</strong>
          </article>
          <span className="strength-flow__arrow" aria-hidden="true">→</span>
          <article className="strength-flow__node strength-flow__node--support">
            <span className="strength-flow__node-label">
              {hasOperatorBreakdown ? "โซนเชี่ยงแซ" : "ธาตุแฝง"}
            </span>
            <strong>{formatSignedNumber(hasOperatorBreakdown ? qiTotal : hiddenTotal)}</strong>
          </article>
          <span className="strength-flow__arrow" aria-hidden="true">→</span>
          <article className="strength-flow__node strength-flow__node--friction">
            <span className="strength-flow__node-label">
              {hasOperatorBreakdown ? "แรงปะทะ" : "แรงกระทบ"}
            </span>
            <strong>{formatSignedNumber(hasOperatorBreakdown ? relationTotal : -penaltyTotal)}</strong>
          </article>
          <span className="strength-flow__arrow" aria-hidden="true">→</span>
          <article className="strength-flow__node strength-flow__node--result">
            <span className="strength-flow__node-label">ผลรวม</span>
            <strong>{formatPlainNumber(score)}</strong>
          </article>
        </div>
      ) : null}

      {hasBreakdown ? (
        <div className="strength-breakdown__grid strength-breakdown__grid--phase6">
          <article className="strength-breakdown__panel">
            <h4>แรงที่หนุนดิถี</h4>
            {primarySupports.length > 0 ? (
              <ul className="strength-breakdown__signal-list">
                {primarySupports.map((entry) => (
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
            {primaryFriction.length > 0 ? (
              <ul className="strength-breakdown__signal-list">
                {primaryFriction.map((entry) => (
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
                <dd>{formatPlainNumber(baseOffset)}</dd>
              </div>
              <div className="strength-breakdown__row">
                <dt>{hasOperatorBreakdown ? "น้ำหนักตำแหน่งก้านและกิ่ง" : "น้ำหนักฤดูกาลและ 12 เชี่ยงแซ"}</dt>
                <dd>{formatSignedNumber(hasOperatorBreakdown ? visibleTotal : stageContribution)}</dd>
              </div>
              <div className="strength-breakdown__row">
                <dt>{hasOperatorBreakdown ? "แรงเสริมจากโซนเชี่ยงแซ" : "แรงจากธาตุแฝง"}</dt>
                <dd>{formatSignedNumber(hasOperatorBreakdown ? qiTotal : hiddenTotal)}</dd>
              </div>
              <div className="strength-breakdown__row">
                <dt>{hasOperatorBreakdown ? "แรงปะทะคงเหลือ" : "แรงชง/เฮ้ง/ไห่/ผั่ว"}</dt>
                <dd>{formatSignedNumber(hasOperatorBreakdown ? relationTotal : -penaltyTotal)}</dd>
              </div>
            </dl>
          </article>
        </div>
      ) : (
        <p className="strength-breakdown__empty">
          trace ของคะแนนพลังรอบนี้ยังไม่พอสำหรับแตกเป็นสมการละเอียด แต่คะแนนรวมยังแสดงได้ตามผลคำนวณหลัก
        </p>
      )}
    </section>
  );
}