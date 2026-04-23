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
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
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

function formatAgeSnapshot(ageSnapshot: CalculatedStateValue["ageSnapshot"]) {
  if (!ageSnapshot) {
    return null;
  }

  return `อายุไทย ${ageSnapshot.thaiAge} · อายุจีน ${ageSnapshot.chineseAge} (อ้างอิง ${ageSnapshot.referenceDate})`;
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
  const staticShenSha = calculatedState
    ? calculatedState.shenSha.filter((entry) => staticDestinyLabels.has(entry.relatedPillar))
    : [];
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
  const ageSnapshotLabel = formatAgeSnapshot(calculatedState?.ageSnapshot);
  const strengthBand = calculatedState
    ? classifyOperatorStrengthScore(calculatedState.strengthScore)
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
        <div className="engine-stack operator-dashboard">
          <section className="surface inset-card operator-orbit" aria-label="operator reading orbit">
            <div className="section-heading board-heading">
              <div>
                <p className="section-kicker">ภาพรวมพร้อมอ่าน</p>
                <h2>เริ่มจากแกนดวง แล้วค่อยกางรายละเอียดที่ต้องใช้ตัดสินใจ</h2>
              </div>
              <div className="board-actions">
                <p className="section-note board-section-note">
                  หน้าอ่านหลักรอบนี้ยุบโซนรายงานเดิมออก แล้วดันลัคนา กำลังดิถี ปีจร และวัยจรขึ้นเป็นแกนกลางสำหรับซินแส
                </p>
                <button
                  type="button"
                  className="secondary-action board-print-action"
                  onClick={handlePrint}
                >
                  ตัวอย่างรายงาน (Print DNA)
                </button>
              </div>
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

            <div className="operator-orbit__core">
              <article className="surface inset-card orbit-card orbit-card--lagna">
                <div>
                  <p className="section-kicker">ลัคนา</p>
                  <h3>{formatPillarCode(calculatedState.mingGong)}</h3>
                  <p className="metric-copy">เสาหลักที่ใช้จับจังหวะการอ่านพื้นดวง</p>
                </div>
                <ExplainableNode
                  title="ลัคนา"
                  buttonLabel="ดูวิธีคำนวณลัคนา"
                  trace={calculatedState.explainable.mingGong?.trace}
                />
              </article>

              <article className="surface inset-card orbit-card orbit-card--strength">
                <div>
                  <p className="section-kicker">กำลังดิถี</p>
                  <h3>{formatScore(calculatedState.strengthScore)}</h3>
                  <p className="metric-copy">{strengthBand?.displayLabel ?? "ยังไม่จัดระดับ"}</p>
                </div>
                <ExplainableNode
                  title="กำลังดิถี"
                  buttonLabel="ดูวิธีคำนวณกำลังดิถี"
                  trace={calculatedState.explainable.strengthScore?.trace}
                />
              </article>

              <article className="surface inset-card orbit-card orbit-card--daymaster">
                <div>
                  <p className="section-kicker">ดิถี</p>
                  <h3>{calculatedState.dayMaster}</h3>
                  <p className="metric-copy">แกนที่ใช้ตีความน้ำหนักของก้านและกิ่งทั้งหมด</p>
                </div>
              </article>

              <article className="surface inset-card orbit-card orbit-card--flow">
                <div>
                  <p className="section-kicker">จังหวะที่กำลังเดิน</p>
                  <h3 data-current-luck-symbol={currentDaYunDisplay ?? undefined}>
                    {currentDaYunDisplay ?? "ยังไม่พบวัยจรปัจจุบัน"}
                  </h3>
                  <p className="metric-copy">
                    {currentDaYunPhase
                      ? `ช่วงอายุ ${formatDaYunAgeRange(currentDaYunPhase.startAge, currentDaYunPhase.endAge)} · ${formatDaYunPhaseSource(currentDaYunPhase.source)}`
                      : currentDaYun
                        ? `ช่วงอายุ ${formatDaYunAgeRange(currentDaYun.startAge, currentDaYun.endAge)}`
                        : "ยังไม่สามารถไฮไลต์รอบวัยจรของเคสนี้ได้"}
                  </p>
                </div>
                {ageSnapshotLabel ? (
                  <p className="current-luck-card__cycle">{ageSnapshotLabel}</p>
                ) : null}
              </article>
            </div>
          </section>

          <section className="surface inset-card pillar-ribbon-section" aria-label="five pillar ribbon">
            <div className="section-heading section-heading--compact">
              <div>
                <p className="section-kicker">5 เสาหลัก</p>
                <h3>ดูก้านและกิ่งก่อน โดยไม่กางธาตุแฝงให้รกสายตา</h3>
              </div>
            </div>

            <div className="pillar-ribbon">
              {staticDestinyColumns.map((column) => {
                const explainableTrace = column.key === "ming-gong"
                  ? calculatedState.explainable.mingGong?.trace
                  : undefined;

                return (
                  <article key={column.key} className="pillar-ribbon-card">
                    <div className="pillar-ribbon-card__header">
                      <span className="pillar-ribbon-card__label">{column.label}</span>
                      {explainableTrace ? (
                        <ExplainableNode
                          title="ลัคนา"
                          buttonLabel="ดูวิธีคำนวณ"
                          trace={explainableTrace}
                        />
                      ) : null}
                    </div>
                    <strong className="pillar-ribbon-card__code">{formatPillarCode(column.pillar)}</strong>
                    <div className="destiny-glyph-stack">
                      <span className="destiny-glyph destiny-glyph--stem">{column.pillar?.stem ?? "-"}</span>
                      <span className="destiny-glyph destiny-glyph--branch">{column.pillar?.branch ?? "-"}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="surface inset-card movement-panel" aria-label="movement panel">
            <div className="section-heading section-heading--compact">
              <div>
                <p className="section-kicker">การเคลื่อนของดวง</p>
                <h3>เห็นปีจรปัจจุบันและวัยจรแบบก้าวละ 5 ปีในแถบเดียวกัน</h3>
              </div>
            </div>

            <div className="movement-grid">
              <article className="annual-energy-card">
                <p className="section-kicker">ปีจร</p>
                <h4>{formatPillarCode(calculatedState.liuNian)}</h4>
                <p className="metric-copy">
                  {calculatedState.liuNian
                    ? `ก้าน ${calculatedState.liuNian.stem} · กิ่ง ${calculatedState.liuNian.branch}`
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
                <p className="section-kicker">วัยจรปัจจุบัน</p>
                <h4>{currentDaYunDisplay ?? "ยังไม่พบวัยจรปัจจุบัน"}</h4>
                <p className="metric-copy">
                  {currentDaYun
                    ? `รอบวัยจร ${formatDaYunAgeRange(currentDaYun.startAge, currentDaYun.endAge)} · ${formatDaYunCycleCode(currentDaYun)}`
                    : "ยังไม่พบรอบวัยจรของเคสนี้"}
                </p>
                {currentDaYunPhase ? (
                  <p className="current-luck-card__cycle">
                    {`ก้าวที่กำลังเดิน ${formatDaYunAgeRange(currentDaYunPhase.startAge, currentDaYunPhase.endAge)} · ${formatDaYunPhaseSource(currentDaYunPhase.source)}`}
                  </p>
                ) : null}
              </article>
            </div>

            <div className="section-heading section-heading--compact">
              <div>
                <p className="section-kicker">วัยจร 5 ปี</p>
                <h4>ไล่อ่านย้อนหลังและมองรอบปัจจุบันในแนวเดียวกัน</h4>
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
                      <span className="dayun-card__label">{entry.isCurrent ? "รอบปัจจุบัน" : "รอบทางเดิน"}</span>
                    </>
                  )}
                  <span className="dayun-card__label">{formatDaYunCycleCode(entry)}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="operator-insight-grid" aria-label="operator insight grid">
            <CorePersonaSurface
              persona={calculatedState.sixtyJiaziCorePersona}
              elementAnalysis={calculatedState.elementAnalysis}
              seasonalInteraction={calculatedState.seasonalInteraction}
              title="แกนบุคลิกพื้นฐาน"
              kicker="ภาพตีความพื้นดวง"
            />

            <StrengthScoreBreakdown
              score={calculatedState.strengthScore}
              trace={calculatedState.explainable.strengthScore?.trace}
              title="แผนผังกำลังดิถี"
            />

            <section className="surface inset-card detail-cluster">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="section-kicker">10 เทพ</p>
                  <h3>ความสัมพันธ์ที่ต้องใช้ตีความต่อ</h3>
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
            </section>

            <section className="surface inset-card detail-cluster">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="section-kicker">12 เชี่ยงแซ</p>
                  <h3>ภาวะธาตุในแต่ละเสาที่ใช้คุมจังหวะการอ่าน</h3>
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
            </section>

            <section className="surface inset-card detail-cluster detail-cluster--wide">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="section-kicker">คำเปรียบเปรยธาตุ</p>
                  <h3>ภาพเปรียบเทียบที่ช่วยสรุปโทนดวงและดาวเด่น</h3>
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

              {staticShenSha.length > 0 ? (
                <div className="transient-shen-sha-panel">
                  <div className="section-heading section-heading--compact">
                    <div>
                      <p className="section-kicker">ดาวเด่นพื้นดวง</p>
                      <h4>ดาวที่ผูกกับเสาหลักโดยตรง</h4>
                    </div>
                  </div>

                  <div className="transient-shen-sha-list">
                    {staticShenSha.map((entry) => (
                      <article
                        key={`static-${entry.relatedPillar}-${entry.starName}`}
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

              {transientShenSha.length > 0 ? (
                <div className="transient-shen-sha-panel">
                  <div className="section-heading section-heading--compact">
                    <div>
                      <p className="section-kicker">ดาวประกอบที่ต้องเห็น</p>
                      <h4>Shen Sha ที่ไม่ผูกกับเสาหลัก</h4>
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
          </section>
        </div>
      ) : (
        <section className="surface inset-card empty-state">
          <p className="section-kicker">พร้อมเริ่ม</p>
          <h3>ตั้งข้อมูลเพื่อเปิดแกนดวงและจังหวะการเดินของเคสนี้</h3>
          <p>
            เมื่อกดคำนวณแล้ว ฝั่งนี้จะดึงลัคนา กำลังดิถี ปีจร วัยจร และพื้นที่อธิบายที่ต้องใช้จริงขึ้นมาก่อน เพื่อให้ซินแสอ่านต่อได้ทันที
          </p>
        </section>
      )}
    </article>
  );
}
