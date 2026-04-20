import type {
  CalculatedStateValue,
  DaYunPhaseValue,
  DaYunPillarValue,
  PillarValue,
  RawInputValue,
  ShenShaValue,
} from "@/lib/bazi/schema-types";
import { CorePersonaSurface } from "@/components/bazi/CorePersonaSurface";
import { ExplainableNode } from "@/components/bazi/ExplainableNode";
import { StrengthScoreBreakdown } from "@/components/bazi/StrengthScoreBreakdown";
import {
  formatScore,
  formatThaiBirthMoment,
  tenGodRows,
  twelveQiRows,
} from "@/lib/bazi/trainer-workspace";

type CalculatedBoardProps = {
  submittedInput: RawInputValue | null;
  calculatedState: CalculatedStateValue | null;
};

type StaticDestinyColumn = {
  key: string;
  label: string;
  englishLabel: string;
  relatedPillar: string;
  pillar: PillarValue | undefined;
};

function formatPillarCode(pillar: PillarValue | undefined) {
  if (!pillar) {
    return "-";
  }

  return `${pillar.stem}${pillar.branch}`;
}

function formatDaYunAgeRange(startAge: number, endAge: number) {
  return `${startAge}-${endAge}`;
}

function formatDaYunCycleCode(entry: DaYunPillarValue) {
  return `${entry.stem}${entry.branch}`;
}

function formatDaYunPhaseSource(source: DaYunPhaseValue["source"]) {
  return source === "stem" ? "ราศีบน" : "ราศีล่าง";
}

function resolveCurrentDaYunPhase(entry: DaYunPillarValue | null) {
  if (!entry) {
    return null;
  }

  if (entry.currentPhase === "upper" && entry.upperPhase) {
    return entry.upperPhase;
  }

  if (entry.currentPhase === "lower" && entry.lowerPhase) {
    return entry.lowerPhase;
  }

  if (entry.upperPhase?.isCurrent) {
    return entry.upperPhase;
  }

  if (entry.lowerPhase?.isCurrent) {
    return entry.lowerPhase;
  }

  return null;
}

function getRelatedShenShaEntries(
  entries: ShenShaValue[],
  relatedPillar: string,
) {
  return entries.filter((entry) => entry.relatedPillar === relatedPillar);
}

export function CalculatedBoard({
  submittedInput,
  calculatedState,
}: CalculatedBoardProps) {
  function handlePrint() {
    window.print();
  }

  const staticDestinyColumns: StaticDestinyColumn[] = calculatedState
    ? [
        {
          key: "ming-gong",
          label: "ลัคนา",
          englishLabel: "Ming Gong",
          relatedPillar: "ลัคนา",
          pillar: calculatedState.mingGong,
        },
        {
          key: "hour",
          label: "ยาม",
          englishLabel: "Hour",
          relatedPillar: "ยาม",
          pillar: calculatedState.fourPillars.hour,
        },
        {
          key: "day",
          label: "วัน",
          englishLabel: "Day",
          relatedPillar: "วัน",
          pillar: calculatedState.fourPillars.day,
        },
        {
          key: "month",
          label: "เดือน",
          englishLabel: "Month",
          relatedPillar: "เดือน",
          pillar: calculatedState.fourPillars.month,
        },
        {
          key: "year",
          label: "ปี",
          englishLabel: "Year",
          relatedPillar: "ปี",
          pillar: calculatedState.fourPillars.year,
        },
      ]
    : [];
  const staticDestinyLabels = new Set(
    staticDestinyColumns.map((column) => column.relatedPillar),
  );
  const transientShenSha = calculatedState
    ? calculatedState.shenSha.filter(
        (entry) => !staticDestinyLabels.has(entry.relatedPillar),
      )
    : [];
  const liuNianShenSha = calculatedState
    ? getRelatedShenShaEntries(calculatedState.shenSha, "ปีจร")
    : [];
  const currentDaYun = calculatedState?.daYun.find((entry) => entry.isCurrent) ?? null;
  const currentDaYunPhase = resolveCurrentDaYunPhase(currentDaYun);
  const daYunTrackEntries = calculatedState ? [...calculatedState.daYun].reverse() : [];
  const currentDaYunDisplay = currentDaYunPhase
    ? currentDaYunPhase.symbol
    : currentDaYun
      ? formatDaYunCycleCode(currentDaYun)
      : null;

  return (
    <article className="surface engine-column">
      <header className="print-report-header">
        <p className="section-kicker">Bazi DNA Report</p>
        <h2>ผังดวงจีน 4 เสา</h2>
        <p className="print-summary-note">
          {submittedInput
            ? `${formatThaiBirthMoment(submittedInput)} • ${submittedInput.province}`
            : "รอข้อมูลตั้งต้น"}
        </p>
      </header>

      <div className="section-heading board-heading">
        <div>
          <p className="section-kicker">ภาพรวมดวงจีน</p>
          <h2>แยกชะตากำเนิด วัยจร และบทวิเคราะห์ให้อ่านจบในหน้าเดียว</h2>
        </div>
        <div className="board-actions">
          <p className="section-note board-section-note">
            phase นี้กางข้อมูลที่ซินแสต้องใช้ทันทีให้ครบทั้ง Ming Gong, Da Yun, Liu Nian และ Shen Sha โดยไม่ต้องคิดต่อในหัว
          </p>
          {calculatedState ? (
            <button
              type="button"
              className="secondary-action board-print-action"
              onClick={handlePrint}
            >
              ตัวอย่างรายงาน (Print DNA)
            </button>
          ) : null}
        </div>
      </div>

      {calculatedState ? (
        <div className="engine-stack">
          <section className="surface inset-card report-zone" aria-label="static destiny zone">
            <div className="zone-heading">
              <div>
                <p className="section-kicker">โซนที่ 1</p>
                <h3>Static Destiny</h3>
              </div>
              <p className="section-note zone-note">
                ชะตากำเนิดถูกกางเป็น 5 เสาให้อ่านตามรูปแบบ DNA report โดยรวมลัคนา ธาตุแฝง และดาวพื้นฐานไว้ในคอลัมน์เดียวกัน
              </p>
            </div>

            <div className="identity-strip identity-strip--compact">
              <div>
                <span className="identity-label">วันเวลาเกิด</span>
                <strong>{formatThaiBirthMoment(submittedInput)}</strong>
              </div>
              <div>
                <span className="identity-label">เพศ</span>
                <strong>{submittedInput?.gender ?? "รอข้อมูล"}</strong>
              </div>
              <div>
                <span className="identity-label">จังหวัด</span>
                <strong>{submittedInput?.province ?? "รอข้อมูล"}</strong>
              </div>
              <div>
                <span className="identity-label">เขตเวลา</span>
                <strong>{submittedInput?.timezone ?? "Asia/Bangkok"}</strong>
              </div>
            </div>

            <div className="destiny-pillar-grid">
              {staticDestinyColumns.map((column) => {
                const stars = getRelatedShenShaEntries(
                  calculatedState.shenSha,
                  column.relatedPillar,
                );
                const explainableTrace = column.key === "ming-gong"
                  ? calculatedState.explainable.mingGong?.trace
                  : undefined;

                return (
                  <article key={column.key} className="destiny-pillar-card">
                    <header className="destiny-pillar-card__header">
                      <span className="destiny-pillar-card__label">{column.label}</span>
                      <span className="destiny-pillar-card__english">
                        {column.englishLabel}
                      </span>
                      <ExplainableNode
                        title="ลัคนา (Ming Gong)"
                        buttonLabel="ดูวิธีคำนวณลัคนา"
                        trace={explainableTrace}
                      />
                    </header>

                    <div className="destiny-glyph-stack">
                      <span className="destiny-glyph destiny-glyph--stem">
                        {column.pillar?.stem ?? "-"}
                      </span>
                      <span className="destiny-glyph destiny-glyph--branch">
                        {column.pillar?.branch ?? "-"}
                      </span>
                    </div>

                    <dl className="pillar-metadata-list">
                      <div className="pillar-metadata-row">
                        <dt>รหัสเสา</dt>
                        <dd>{formatPillarCode(column.pillar)}</dd>
                      </div>
                      <div className="pillar-metadata-row">
                        <dt>ธาตุแฝง</dt>
                        <dd>{column.pillar?.hiddenStems?.join(" · ") ?? "-"}</dd>
                      </div>
                    </dl>

                    <div className="shen-sha-cluster">
                      {stars.length > 0 ? (
                        stars.map((entry) => (
                          <article
                            key={`${column.key}-${entry.starName}-${entry.relatedPillar}`}
                            className="shen-sha-chip"
                            title={entry.meaning}
                          >
                            <strong>{entry.starName}</strong>
                            <span>{entry.meaning}</span>
                          </article>
                        ))
                      ) : (
                        <span className="shen-sha-empty">ยังไม่มีดาวเด่นในเสานี้</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="surface inset-card report-zone" aria-label="dynamic luck zone">
            <div className="zone-heading">
              <div>
                <p className="section-kicker">โซนที่ 2</p>
                <h3>Dynamic Luck</h3>
              </div>
              <p className="section-note zone-note">
                ปีจรปัจจุบันและทางเดินวัยจรถูกยกขึ้นมาไว้ด้านหน้า เพื่อให้ตอบหัวข้อ Annual Star Energy และ Major Luck Cycles ได้ทันที
              </p>
            </div>

            <div className="dynamic-luck-grid">
              <article className="annual-energy-card">
                <p className="section-kicker">ปีจรปัจจุบัน</p>
                <h4>{formatPillarCode(calculatedState.liuNian)}</h4>
                <p className="metric-copy">
                  {calculatedState.liuNian
                    ? `Stem ${calculatedState.liuNian.stem} / Branch ${calculatedState.liuNian.branch}`
                    : "ยังไม่มีปีจรสำหรับเคสนี้"}
                </p>
                <div className="shen-sha-cluster shen-sha-cluster--compact">
                  {liuNianShenSha.length > 0 ? (
                    liuNianShenSha.map((entry) => (
                      <article
                        key={`liu-nian-${entry.starName}`}
                        className="shen-sha-chip"
                        title={entry.meaning}
                      >
                        <strong>{entry.starName}</strong>
                        <span>{entry.meaning}</span>
                      </article>
                    ))
                  ) : (
                    <span className="shen-sha-empty">ยังไม่มีดาวจรเพิ่มเติม</span>
                  )}
                </div>
              </article>

              <article className="current-luck-card">
                <p className="section-kicker">วัยจรที่กำลังเดินอยู่</p>
                <h4 data-current-luck-symbol={currentDaYunDisplay ?? undefined}>
                  {currentDaYunDisplay ?? "ยังไม่พบวัยจรปัจจุบัน"}
                </h4>
                <p className="metric-copy">
                  {currentDaYunPhase
                    ? `ช่วงอายุ ${formatDaYunAgeRange(currentDaYunPhase.startAge, currentDaYunPhase.endAge)} · ${formatDaYunPhaseSource(currentDaYunPhase.source)}`
                    : currentDaYun
                      ? `ช่วงอายุ ${formatDaYunAgeRange(currentDaYun.startAge, currentDaYun.endAge)}`
                      : "ยังไม่สามารถไฮไลต์รอบวัยจรของเคสนี้ได้"}
                </p>
                {currentDaYun ? (
                  <p className="current-luck-card__cycle">
                    {`รอบวัยจร ${formatDaYunAgeRange(currentDaYun.startAge, currentDaYun.endAge)} · ${formatDaYunCycleCode(currentDaYun)}`}
                  </p>
                ) : null}
              </article>
            </div>

            <div className="dayun-section">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="section-kicker">Major Luck Cycles</p>
                  <h4>วัยจร 10 ปี</h4>
                </div>
              </div>

              <div className="dayun-track" aria-label="Da Yun track" data-dayun-direction="rtl">
                {daYunTrackEntries.map((entry) => (
                  <article
                    key={`${entry.startAge}-${entry.endAge}-${entry.stem}-${entry.branch}`}
                    className={`dayun-card${entry.isCurrent ? " dayun-card--current" : ""}`}
                  >
                    <span className="dayun-card__cycle">
                      {formatDaYunAgeRange(entry.startAge, entry.endAge)}
                    </span>
                    {entry.upperPhase && entry.lowerPhase ? (
                      <div className="dayun-card__phase-stack">
                        {[entry.upperPhase, entry.lowerPhase].map((phase) => (
                          <section
                            key={`${entry.startAge}-${entry.endAge}-${phase.source}`}
                            className={`dayun-card__phase${phase.isCurrent ? " dayun-card__phase--current" : ""}`}
                          >
                            <span className="dayun-card__phase-age">
                              {formatDaYunAgeRange(phase.startAge, phase.endAge)}
                            </span>
                            <strong className="dayun-card__phase-symbol">{phase.symbol}</strong>
                            <span className="dayun-card__phase-label">
                              {formatDaYunPhaseSource(phase.source)}
                            </span>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <>
                        <strong className="dayun-card__code">{formatDaYunCycleCode(entry)}</strong>
                        <span className="dayun-card__label">
                          {entry.isCurrent ? "วัยจรปัจจุบัน" : "ทางเดิน 10 ปี"}
                        </span>
                      </>
                    )}
                    <span className="dayun-card__label">
                      {entry.isCurrent
                        ? `รอบปัจจุบัน · ${formatDaYunCycleCode(entry)}`
                        : formatDaYunCycleCode(entry)}
                    </span>
                  </article>
                ))}
              </div>
            </div>

            {transientShenSha.length > 0 ? (
              <div className="transient-shen-sha-panel">
                <div className="section-heading section-heading--compact">
                  <div>
                    <p className="section-kicker">ดาวจรเสริม</p>
                    <h4>Transient Shen Sha</h4>
                  </div>
                </div>

                <div className="transient-shen-sha-list">
                  {transientShenSha.map((entry) => (
                    <article
                      key={`transient-${entry.relatedPillar}-${entry.starName}`}
                      className="transient-shen-sha-card"
                    >
                      <strong>{entry.starName}</strong>
                      <span>{entry.relatedPillar}</span>
                      <p>{entry.meaning}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="surface inset-card report-zone" aria-label="deep analysis zone">
            <div className="zone-heading">
              <div>
                <p className="section-kicker">โซนที่ 3</p>
                <h3>Deep Analysis</h3>
              </div>
              <p className="section-note zone-note">
                คงแกน Day Master, Strength Score, Ten Gods, Twelve Qi และ persona เดิมไว้เป็นพื้นที่ตีความเชิงลึกต่อจาก 2 โซนบน
              </p>
            </div>

            <section className="spotlight-grid">
              <div className="surface inset-card highlight-card">
                <p className="section-kicker">หัวใจดวง</p>
                <h3>{calculatedState.dayMaster}</h3>
                <p className="metric-copy">Day Master</p>
              </div>

              <div className="surface inset-card highlight-card">
                <p className="section-kicker">คะแนนพลัง</p>
                <h3>{formatScore(calculatedState.strengthScore)}</h3>
                <p className="metric-copy">Strength Score</p>
                <ExplainableNode
                  title="คะแนนพลัง (Strength Score)"
                  buttonLabel="ดูวิธีคำนวณคะแนนพลัง"
                  trace={calculatedState.explainable.strengthScore?.trace}
                />
              </div>

            </section>

            <CorePersonaSurface persona={calculatedState.sixtyJiaziCorePersona} />

            <StrengthScoreBreakdown
              score={calculatedState.strengthScore}
              trace={calculatedState.explainable.strengthScore?.trace}
            />

            <section className="detail-grid">
              <div className="surface inset-card">
                <div className="section-heading section-heading--compact">
                  <div>
                    <p className="section-kicker">10 เทพ</p>
                    <h3>Ten Gods</h3>
                  </div>
                </div>

                <dl className="detail-list">
                  {tenGodRows.map((item) => (
                    <div key={item.key} className="detail-list-row">
                      <dt>{item.label}</dt>
                      <dd>{calculatedState.tenGods[item.key] ?? "-"}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="surface inset-card">
                <div className="section-heading section-heading--compact">
                  <div>
                    <p className="section-kicker">12 Qi</p>
                    <h3>Twelve Qi</h3>
                  </div>
                </div>

                <dl className="detail-list">
                  {twelveQiRows.map((item) => (
                    <div key={item.key} className="detail-list-row">
                      <dt>{item.label}</dt>
                      <dd>{calculatedState.twelveQi[item.key] ?? "-"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <section className="surface inset-card">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="section-kicker">คำเปรียบเปรยธาตุ</p>
                  <h3>Element Metaphors</h3>
                </div>
              </div>

              <div className="metaphor-list">
                {calculatedState.elementMetaphors.map((item) => (
                  <article key={`${item.element}-${item.metaphor}`} className="metaphor-card">
                    <strong>{item.element}</strong>
                    <p>{item.metaphor}</p>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </div>
      ) : (
        <section className="surface inset-card empty-state">
          <p className="section-kicker">พร้อมเริ่ม</p>
          <h3>ตั้งข้อมูลเพื่อเปิด 3 โซนของรายงานให้ครบ</h3>
          <p>
            เมื่อกดคำนวณแล้ว ฝั่งนี้จะกาง Static Destiny, Dynamic Luck และ Deep Analysis ให้ครบในหน้าเดียวเพื่อให้ซินแสอ่านและ annotate ต่อได้ทันที
          </p>
        </section>
      )}
    </article>
  );
}
