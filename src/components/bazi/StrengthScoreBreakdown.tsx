import type { CalculationTraceValue } from "@/lib/bazi/schema-types";

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
  title = "สมการคะแนนพลัง",
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

  const middleEntries = hasOperatorBreakdown ? qiAdjustments : hiddenContributions;

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
          <strong>{hasOperatorBreakdown ? "ตำแหน่งหลัก" : "ฤดูกาล"}</strong>
          <span>{formatSignedNumber(hasOperatorBreakdown ? visibleTotal : stageContribution)}</span>
        </span>
        <span className="strength-equation__term">
          <strong>{hasOperatorBreakdown ? "โซนเชี่ยงแซ" : "ก้านฟ้า"}</strong>
          <span>{formatSignedNumber(hasOperatorBreakdown ? qiTotal : visibleTotal)}</span>
        </span>
        <span className="strength-equation__term">
          <strong>{hasOperatorBreakdown ? "แรงปะทะ" : "ธาตุแฝง"}</strong>
          <span>{formatSignedNumber(hasOperatorBreakdown ? relationTotal : hiddenTotal)}</span>
        </span>
        <span className="strength-equation__term strength-equation__term--penalty">
          <strong>{hasOperatorBreakdown ? "แรงเสริมเก่า" : "แรงกระทบ"}</strong>
          <span>{formatSignedNumber(hasOperatorBreakdown ? 0 : -penaltyTotal)}</span>
        </span>
        <span className="strength-equation__result">
          <strong>รวม</strong>
          <span>{formatPlainNumber(score)}</span>
        </span>
      </div>

      {hasBreakdown ? (
        <div className="strength-breakdown__grid">
          <article className="strength-breakdown__panel">
            <h4>แรงจากตำแหน่งที่มองเห็น</h4>
            {visibleContributions.length > 0 ? (
              <dl className="strength-breakdown__list">
                {visibleContributions.map((entry) => (
                  <div key={`${entry.label}-${entry.symbol}`} className="strength-breakdown__row">
                    <dt>{`${entry.label} · ${entry.symbol}`}</dt>
                    <dd>{formatSignedNumber(entry.weight)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="strength-breakdown__empty">trace รอบนี้ไม่ได้ส่งน้ำหนักตำแหน่งหลักเพิ่มเข้ามา</p>
            )}
          </article>

          <article className="strength-breakdown__panel">
            <h4>{hasOperatorBreakdown ? "แรงเสริมจากโซนเชี่ยงแซ" : "แรงจากธาตุแฝง"}</h4>
            {middleEntries.length > 0 ? (
              <dl className="strength-breakdown__list">
                {middleEntries.map((entry) => (
                  <div key={`${entry.label}-${entry.symbol}`} className="strength-breakdown__row">
                    <dt>{`${entry.label} · ${entry.symbol}`}</dt>
                    <dd>{formatSignedNumber(entry.weight)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="strength-breakdown__empty">
                {hasOperatorBreakdown
                  ? "trace รอบนี้ไม่ได้ส่งโซนเชี่ยงแซที่เพิ่มคะแนนเข้ามา"
                  : "trace รอบนี้ไม่ได้ส่งธาตุแฝงที่มีผลต่อคะแนนพลังเพิ่มเข้ามา"}
              </p>
            )}
          </article>

          <article className="strength-breakdown__panel strength-breakdown__panel--wide">
            <h4>{hasOperatorBreakdown ? "แรงปะทะและตัวตั้งต้น" : "แรงหักและตัวตั้งต้น"}</h4>
            <dl className="strength-breakdown__list">
              <div className="strength-breakdown__row">
                <dt>คะแนนตั้งต้นของระบบ</dt>
                <dd>{formatPlainNumber(baseOffset)}</dd>
              </div>
              {hasOperatorBreakdown ? (
                <>
                  <div className="strength-breakdown__row">
                    <dt>น้ำหนักตำแหน่งก้านและกิ่ง</dt>
                    <dd>{formatSignedNumber(visibleTotal)}</dd>
                  </div>
                  <div className="strength-breakdown__row">
                    <dt>แรงเสริมจากโซนเชี่ยงแซ</dt>
                    <dd>{formatSignedNumber(qiTotal)}</dd>
                  </div>
                  {relationAdjustments.length > 0 ? relationAdjustments.map((entry) => (
                    <div key={`${entry.label}-${entry.symbol}`} className="strength-breakdown__row">
                      <dt>{`${entry.label} · ${entry.symbol}`}</dt>
                      <dd>{formatSignedNumber(entry.weight)}</dd>
                    </div>
                  )) : (
                    <div className="strength-breakdown__row">
                      <dt>แรงปะทะคงเหลือ</dt>
                      <dd>{formatSignedNumber(0)}</dd>
                    </div>
                  )}
                </>
              ) : (
                <>
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
                </>
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