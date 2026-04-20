import type { CalculationTraceValue } from "@/lib/bazi/schema-types";

type StrengthScoreBreakdownProps = {
  score: number;
  trace: CalculationTraceValue | undefined;
  title?: string;
};

type StrengthContributionItem = {
  label: string;
  stem: string;
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
  const visibleLabels: Record<string, string> = {
    yearStem: "ก้านฟ้าปี",
    monthStem: "ก้านฟ้าเดือน",
    hourStem: "ก้านฟ้ายาม",
  };

  if (visibleLabels[rawLabel]) {
    return visibleLabels[rawLabel];
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
        stem: typeof entry.stem === "string" ? entry.stem : "-",
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
  title = "สมการคะแนนพลัง",
}: StrengthScoreBreakdownProps) {
  const rawVariables = getRawVariables(trace);
  const visibleContributions = toContributionItems(rawVariables?.visibleContributions);
  const hiddenContributions = toContributionItems(rawVariables?.hiddenContributions);
  const penalties = toPenaltyItems(rawVariables?.penalties);
  const stageContribution = getNumber(rawVariables?.stageContribution) ?? 0;
  const visibleTotal = sumWeights(visibleContributions);
  const hiddenTotal = sumWeights(hiddenContributions);
  const penaltyTotal = sumPenalties(penalties);
  const baseOffset = Number((score - stageContribution - visibleTotal - hiddenTotal + penaltyTotal).toFixed(2));
  const hasBreakdown = Boolean(rawVariables) && (
    visibleContributions.length > 0 ||
    hiddenContributions.length > 0 ||
    penalties.length > 0 ||
    stageContribution !== 0
  );

  return (
    <section
      className="surface inset-card strength-breakdown"
      aria-label={title}
      data-strength-breakdown={hasBreakdown ? "available" : "missing"}
    >
      <div className="section-heading section-heading--compact">
        <div>
          <p className="section-kicker">Strength Score Breakdown</p>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="strength-equation" aria-label="สมการคะแนนพลัง">
        <span className="strength-equation__term">
          <strong>ฐาน</strong>
          <span>{formatPlainNumber(baseOffset)}</span>
        </span>
        <span className="strength-equation__term">
          <strong>ฤดูกาล</strong>
          <span>{formatSignedNumber(stageContribution)}</span>
        </span>
        <span className="strength-equation__term">
          <strong>ก้านฟ้า</strong>
          <span>{formatSignedNumber(visibleTotal)}</span>
        </span>
        <span className="strength-equation__term">
          <strong>ธาตุแฝง</strong>
          <span>{formatSignedNumber(hiddenTotal)}</span>
        </span>
        <span className="strength-equation__term strength-equation__term--penalty">
          <strong>แรงกระทบ</strong>
          <span>{formatSignedNumber(-penaltyTotal)}</span>
        </span>
        <span className="strength-equation__result">
          <strong>รวม</strong>
          <span>{formatPlainNumber(score)}</span>
        </span>
      </div>

      {hasBreakdown ? (
        <div className="strength-breakdown__grid">
          <article className="strength-breakdown__panel">
            <h4>แรงจากก้านฟ้าที่มองเห็น</h4>
            {visibleContributions.length > 0 ? (
              <dl className="strength-breakdown__list">
                {visibleContributions.map((entry) => (
                  <div key={`${entry.label}-${entry.stem}`} className="strength-breakdown__row">
                    <dt>{`${entry.label} · ${entry.stem}`}</dt>
                    <dd>{formatSignedNumber(entry.weight)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="strength-breakdown__empty">trace รอบนี้ไม่ได้ส่งน้ำหนักก้านฟ้าที่มองเห็นเพิ่มเข้ามา</p>
            )}
          </article>

          <article className="strength-breakdown__panel">
            <h4>แรงจากธาตุแฝง</h4>
            {hiddenContributions.length > 0 ? (
              <dl className="strength-breakdown__list">
                {hiddenContributions.map((entry) => (
                  <div key={`${entry.label}-${entry.stem}`} className="strength-breakdown__row">
                    <dt>{`${entry.label} · ${entry.stem}`}</dt>
                    <dd>{formatSignedNumber(entry.weight)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="strength-breakdown__empty">trace รอบนี้ไม่ได้ส่งธาตุแฝงที่มีผลต่อคะแนนพลังเพิ่มเข้ามา</p>
            )}
          </article>

          <article className="strength-breakdown__panel strength-breakdown__panel--wide">
            <h4>แรงหักและตัวตั้งต้น</h4>
            <dl className="strength-breakdown__list">
              <div className="strength-breakdown__row">
                <dt>คะแนนตั้งต้นของระบบ</dt>
                <dd>{formatPlainNumber(baseOffset)}</dd>
              </div>
              <div className="strength-breakdown__row">
                <dt>น้ำหนักฤดูกาลและ 12 เชี่ยงแซ</dt>
                <dd>{formatSignedNumber(stageContribution)}</dd>
              </div>
              {penalties.length > 0 ? penalties.map((entry) => (
                <div key={entry.label} className="strength-breakdown__row">
                  <dt>{entry.label}</dt>
                  <dd>{formatSignedNumber(-entry.value)}</dd>
                </div>
              )) : (
                <div className="strength-breakdown__row">
                  <dt>แรงชง/เฮ้ง/ไห่/ผั่ว</dt>
                  <dd>{formatSignedNumber(0)}</dd>
                </div>
              )}
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