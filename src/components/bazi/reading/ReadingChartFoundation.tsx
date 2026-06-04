import {
  ELEMENT_LABELS_TH,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import type {
  CalculatedStateValue,
  DaYunPhaseValue,
  PillarValue,
} from "@/lib/bazi/schema-types";

type ReadingChartFoundationProps = {
  calculatedState: CalculatedStateValue;
};

type FoundationColumn = {
  key: string;
  label: string;
  pillar: PillarValue | undefined;
};

function formatGlyphWithTranslation(symbol: string | undefined, translation: string | undefined) {
  if (!symbol) {
    return "-";
  }
  return translation ? `${symbol} (${translation})` : symbol;
}

function formatAgeRange(startAge: number, endAge: number) {
  return `${startAge}-${endAge}`;
}

function getDayMasterElementLabel(dayMaster: string) {
  const element = STEM_TO_ELEMENT[dayMaster as keyof typeof STEM_TO_ELEMENT];
  return element ? ELEMENT_LABELS_TH[element] : null;
}

/**
 * พื้นดวง canonical สำหรับหน้า /reading — ใช้หน้าตาเดียวกับ pillar-ribbon
 * ในหน้าแรก (CalculatedBoard) โดย reuse CSS class เดิม แต่เป็น chip แบบ static
 * (ไม่มี overlay/router) พร้อมแถบ "ดิถี + กำลังแข็ง/อ่อน" และวัยจรแบบ 5 ปี.
 */
export function ReadingChartFoundation({ calculatedState }: ReadingChartFoundationProps) {
  const columns: FoundationColumn[] = [
    { key: "ming-gong", label: "ลัคนา", pillar: calculatedState.mingGong },
    { key: "hour", label: "ยาม", pillar: calculatedState.fourPillars.hour },
    { key: "day", label: "วัน", pillar: calculatedState.fourPillars.day },
    { key: "month", label: "เดือน", pillar: calculatedState.fourPillars.month },
    { key: "year", label: "ปี", pillar: calculatedState.fourPillars.year },
  ];

  const strengthProfile = calculatedState.dayMasterStrengthProfile;
  const dayMasterElementLabel = getDayMasterElementLabel(calculatedState.dayMaster);
  const strengthLabel = strengthProfile?.displayLabel
    ?? strengthProfile?.displayBand
    ?? strengthProfile?.strengthState
    ?? "ยังไม่ระบุกำลัง";
  // ใช้คะแนนจาก engine (strengthScore) ให้ตรงกับระดับ/ป้ายที่จัดจากคะแนนเดียวกันเสมอ
  // (profile.scoreText มาจาก lookup คนละสเกล จึงโชว์ไม่ตรงกับ displayLabel)
  const scoreText = calculatedState.strengthScore.toFixed(2);

  return (
    <section className="surface reading-foundation" aria-label="พื้นดวง">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="section-kicker">พื้นดวง</p>
          <h2>เริ่มจากโครงดวงก่อน แล้วค่อยเปิดข้อมูลรองตามลำดับ</h2>
        </div>
      </div>

      <div className="reading-foundation__identity">
        <div className="reading-foundation__identity-item">
          <span className="section-kicker">ดิถี (ตัวเรา)</span>
          <strong className="reading-foundation__day-master">
            {calculatedState.dayMaster}
            {dayMasterElementLabel ? ` · ธาตุ${dayMasterElementLabel}` : ""}
          </strong>
        </div>
        <div className="reading-foundation__identity-item">
          <span className="section-kicker">กำลังดิถี</span>
          <strong>{strengthLabel} · คะแนน {scoreText}</strong>
        </div>
      </div>

      {strengthProfile?.narrative ? (
        <p className="metric-copy reading-foundation__strength-note">{strengthProfile.narrative}</p>
      ) : null}

      <div className="pillar-ribbon">
        {columns.map((column) => (
          <article
            key={column.key}
            className={`pillar-ribbon-card${column.key === "day" ? " pillar-ribbon-card--day-master" : ""}`}
            data-pillar-key={column.key}
            data-day-master-column={column.key === "day" ? "true" : undefined}
          >
            <div className="pillar-ribbon-card__header">
              <span className="pillar-ribbon-card__label">{column.label}</span>
            </div>
            <div className="destiny-glyph-stack">
              <div className="pillar-stage-slot pillar-stage-slot--upper">
                {column.key === "day" ? (
                  <span className="pillar-day-master-tag">ดิถี</span>
                ) : column.pillar?.upperStageDisplay ? (
                  <span className="pillar-stage-chip pillar-stage-chip--upper">
                    {column.pillar.upperStageDisplay}
                  </span>
                ) : (
                  <span className="pillar-stage-slot__placeholder" aria-hidden="true" />
                )}
              </div>
              <div className="destiny-glyph-shell destiny-glyph-shell--stem">
                <span className="destiny-glyph destiny-glyph--stem">{column.pillar?.stem ?? "-"}</span>
                <span className="destiny-glyph-caption">
                  {formatGlyphWithTranslation(column.pillar?.stem, column.pillar?.stemTranslation)}
                </span>
              </div>
              <div className="pillar-stage-slot pillar-stage-slot--middle">
                {column.key !== "day" && column.pillar?.sittingStage ? (
                  <span className="pillar-stage-chip pillar-stage-chip--sitting">
                    {column.pillar.sittingStage}
                  </span>
                ) : (
                  <span className="pillar-stage-slot__placeholder" aria-hidden="true" />
                )}
              </div>
              <div className="destiny-glyph-shell destiny-glyph-shell--branch">
                <span className="destiny-glyph destiny-glyph--branch">{column.pillar?.branch ?? "-"}</span>
                <span className="destiny-glyph-caption">
                  {formatGlyphWithTranslation(column.pillar?.branch, column.pillar?.branchTranslation)}
                </span>
              </div>
              <div className="pillar-stage-slot pillar-stage-slot--lower">
                {column.pillar?.lowerStageDisplay ? (
                  <span className="pillar-stage-chip pillar-stage-chip--lower">
                    {column.pillar.lowerStageDisplay}
                  </span>
                ) : (
                  <span className="pillar-stage-slot__placeholder" aria-hidden="true" />
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="section-heading section-heading--compact reading-foundation__dayun-heading">
        <div>
          <p className="section-kicker">วัยจร (ช่วงละ 5 ปี)</p>
          <h3>ตารางวัยจร แตกเป็นครึ่งก้าน 5 ปี และครึ่งกิ่ง 5 ปี</h3>
        </div>
      </div>

      <div
        className="dayun-track"
        aria-label="ถนนวัยจร"
        data-dayun-direction={calculatedState.isForwardDirection === false ? "rtl" : "ltr"}
      >
        {[...calculatedState.daYun]
          .sort((a, b) => a.startAge - b.startAge)
          .map((entry, index) => {
            // ใช้อายุเริ่มวัยจรจริง (起运) จากข้อมูลเสา ไม่ normalize
            const phases = [entry.upperPhase, entry.lowerPhase].filter(
              (phase): phase is DaYunPhaseValue => Boolean(phase),
            );

            return (
              <article
                key={`${entry.stem}-${entry.branch}-${index}`}
                className={`dayun-card${entry.isCurrent ? " dayun-card--current" : ""}`}
              >
                <span className="dayun-card__cycle">{formatAgeRange(entry.startAge, entry.endAge)}</span>
                {phases.length > 0 ? (
                  <div className="dayun-card__phase-stack">
                    {phases.map((phase) => (
                      <section
                        key={`${index}-${phase.source}`}
                        className={`dayun-card__phase${phase.isCurrent ? " dayun-card__phase--current" : ""}`}
                      >
                        <span className="dayun-card__phase-age">
                          {formatAgeRange(phase.startAge, phase.endAge)}
                        </span>
                        <strong className="dayun-card__phase-symbol">{phase.symbol}</strong>
                        <span className="dayun-card__phase-label">
                          {phase.source === "stem" ? "ราศีบน" : "ราศีล่าง"}
                        </span>
                        {phase.twelveQiDisplay ? (
                          <span className="dynamic-luck-badge dynamic-luck-badge--phase dynamic-luck-badge--value-only">
                            <strong className="dynamic-luck-badge__value">{phase.twelveQiDisplay}</strong>
                          </span>
                        ) : null}
                      </section>
                    ))}
                  </div>
                ) : (
                  <strong className="dayun-card__code">{entry.stem}{entry.branch}</strong>
                )}
              </article>
            );
          })}
      </div>
    </section>
  );
}
