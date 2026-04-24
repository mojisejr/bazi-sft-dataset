import { useState } from "react";

import type {
  CalculatedStateValue,
  DaYunPhaseValue,
  DaYunPillarValue,
  PillarValue,
  ShenShaValue,
} from "@/lib/bazi/schema-types";
import { CorePersonaSurface } from "@/components/bazi/CorePersonaSurface";
import { ExplainableNode } from "@/components/bazi/ExplainableNode";
import { StrengthScoreBreakdown } from "@/components/bazi/StrengthScoreBreakdown";
import {
  tenGodRows,
  twelveQiRows,
} from "@/lib/bazi/trainer-workspace";

type CalculatedBoardProps = {
  calculatedState: CalculatedStateValue | null;
};

type StaticDestinyColumn = {
  key: string;
  label: string;
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

export function CalculatedBoard({ calculatedState }: CalculatedBoardProps) {
  const [isLuckTimelineOpen, setIsLuckTimelineOpen] = useState(false);

  function handlePrint() {
    window.print();
  }

  const staticDestinyColumns: StaticDestinyColumn[] = calculatedState
    ? [
        {
          key: "ming-gong",
          label: "ลัคนา",
          relatedPillar: "ลัคนา",
          pillar: calculatedState.mingGong,
        },
        {
          key: "hour",
          label: "ยาม",
          relatedPillar: "ยาม",
          pillar: calculatedState.fourPillars.hour,
        },
        {
          key: "day",
          label: "วัน",
          relatedPillar: "วัน",
          pillar: calculatedState.fourPillars.day,
        },
        {
          key: "month",
          label: "เดือน",
          relatedPillar: "เดือน",
          pillar: calculatedState.fourPillars.month,
        },
        {
          key: "year",
          label: "ปี",
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

  return (
    <article className="surface engine-column">
      {calculatedState ? (
        <div className="engine-stack reading-canvas">
          <div className="section-heading board-heading reading-toolbar">
            <div>
              <p className="section-kicker">ภาพรวมดวงจีน</p>
              <h2>อ่านจาก 5 เสาหลักก่อน แล้วค่อยไล่กำลังดิถี วัยจร และแกนบุคลิก</h2>
            </div>
            <div className="board-actions">
              <p className="section-note board-section-note">
                หน้าอ่านหลักต้องจบได้โดยไม่ต้องวิ่งไล่เก็บข้อมูลซ้ำหลายกล่อง
              </p>
              <button
                type="button"
                className="secondary-action board-print-action"
                onClick={handlePrint}
              >
                พิมพ์รายงาน
              </button>
            </div>
          </div>

          <section className="surface inset-card pillar-ribbon-section" aria-label="five pillar strip" data-reading-block="B">
            <div className="section-heading section-heading--compact">
              <div>
                <p className="section-kicker">5 เสาหลัก</p>
                <h3>เริ่มจากโครงดวงก่อน แล้วค่อยเปิดข้อมูลรองตามลำดับ</h3>
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

          <div className="reading-primary-grid">
            <StrengthScoreBreakdown
              score={calculatedState.strengthScore}
              trace={calculatedState.explainable.strengthScore?.trace}
              title="แผนผังกำลังดิถี"
            />

            <section
              className="surface inset-card movement-panel"
              aria-label="luck module"
              data-reading-block="D"
              data-luck-timeline-open={isLuckTimelineOpen ? "true" : "false"}
            >
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="section-kicker">วัยจร</p>
                  <h3>ดูรอบหลัก ก้าวปัจจุบัน และปีจรในโมดูลเดียว</h3>
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
                  <p className="section-kicker">รอบหลัก</p>
                  <h4 data-current-luck-symbol={currentDaYunDisplay ?? undefined}>
                    {currentDaYunDisplay ?? "ยังไม่พบวัยจรปัจจุบัน"}
                  </h4>
                  <p className="metric-copy">
                    {currentDaYun
                      ? `รอบวัยจร ${formatDaYunAgeRange(currentDaYun.startAge, currentDaYun.endAge)} · ${formatDaYunCycleCode(currentDaYun)}`
                      : "ยังไม่พบรอบวัยจรของเคสนี้"}
                  </p>
                  {currentDaYunPhase ? (
                    <p className="current-luck-card__cycle">
                      {`ก้าวปัจจุบัน ${formatDaYunAgeRange(currentDaYunPhase.startAge, currentDaYunPhase.endAge)} · ${formatDaYunPhaseSource(currentDaYunPhase.source)}`}
                    </p>
                  ) : null}
                  {ageSnapshotLabel ? (
                    <p className="current-luck-card__cycle">{ageSnapshotLabel}</p>
                  ) : null}
                </article>
              </div>

              <div className="movement-panel__actions">
                <button
                  type="button"
                  className="secondary-action movement-panel__toggle"
                  aria-expanded={isLuckTimelineOpen}
                  onClick={() => setIsLuckTimelineOpen((current) => !current)}
                >
                  {isLuckTimelineOpen ? "ซ่อน timeline วัยจร" : "ดู timeline วัยจร"}
                </button>
              </div>

              {isLuckTimelineOpen ? (
                <>
                  <div className="section-heading section-heading--compact">
                    <div>
                      <p className="section-kicker">timeline วัยจร</p>
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
                </>
              ) : null}
            </section>
          </div>

          <div className="reading-secondary-grid">
            <CorePersonaSurface
              persona={calculatedState.sixtyJiaziCorePersona}
              elementAnalysis={calculatedState.elementAnalysis}
              seasonalInteraction={calculatedState.seasonalInteraction}
              title="แกนบุคลิกพื้นฐาน"
              kicker="ภาพตีความพื้นดวง"
            />

            <section className="surface inset-card reference-shelf" aria-label="reference shelf" data-reading-block="F">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="section-kicker">ข้อมูลอ้างอิงเพิ่มเติม</p>
                  <h3>เปิดเมื่ออยากเช็กข้อมูลเชิงลึก ไม่จำเป็นต้องอ่านก่อนทุกครั้ง</h3>
                </div>
              </div>

              <div className="reference-shelf__grid">
                <section className="detail-cluster detail-cluster--nested">
                  <div className="section-heading section-heading--compact">
                    <div>
                      <p className="section-kicker">10 เทพ</p>
                      <h4>ความสัมพันธ์ที่ต้องใช้ตีความต่อ</h4>
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

                <section className="detail-cluster detail-cluster--nested">
                  <div className="section-heading section-heading--compact">
                    <div>
                      <p className="section-kicker">12 เชี่ยงแซ</p>
                      <h4>ภาวะธาตุในแต่ละเสาที่ใช้คุมจังหวะการอ่าน</h4>
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

                <section className="detail-cluster detail-cluster--nested detail-cluster--wide">
                  <div className="section-heading section-heading--compact">
                    <div>
                      <p className="section-kicker">ดาวเด่นและคำเปรียบเปรย</p>
                      <h4>ใช้เมื่ออยากตรวจข้อมูลเสริมของเสาหลักและดาวประกอบ</h4>
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
              </div>
            </section>
          </div>
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
