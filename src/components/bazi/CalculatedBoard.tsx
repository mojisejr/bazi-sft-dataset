import { useState } from "react";
import { useRouter } from "next/navigation";

import type {
  BaseChartDetailItemValue,
  CalculatedStateValue,
  DaYunPhaseValue,
  DaYunPillarValue,
  PillarValue,
  ShenShaValue,
} from "@/lib/bazi/schema-types";
import { CorePersonaDetailContent, CorePersonaSurface } from "@/components/bazi/CorePersonaSurface";
import { CompatibilitySurface } from "@/components/bazi/CompatibilitySurface";
import { DetailOverlay } from "@/components/bazi/DetailOverlay";
import { ExplainableNode } from "@/components/bazi/ExplainableNode";
import { StrengthBreakdownDetailContent, StrengthScoreBreakdown } from "@/components/bazi/StrengthScoreBreakdown";

type CalculatedBoardProps = {
  calculatedState: CalculatedStateValue | null;
};

type ReadingDetailPanel = "strength" | "luck" | "persona" | null;

type StaticDestinyColumn = {
  key: string;
  label: string;
  relatedPillar: string;
  pillar: PillarValue | undefined;
};

type DynamicLuckBadgeItem = {
  key: string;
  label?: string;
  value: string;
};

type RouteDetail = {
  kicker: string;
  title: string;
  summary: string;
  explanation: string;
  details: BaseChartDetailItemValue[];
};

function formatPillarCode(pillar: PillarValue | undefined) {
  if (!pillar) {
    return "-";
  }

  return `${pillar.stem}${pillar.branch}`;
}

function formatGlyphWithTranslation(symbol: string | undefined, translation: string | undefined) {
  if (!symbol) {
    return "-";
  }

  return translation ? `${symbol} (${translation})` : symbol;
}

function hasVisibleTopStage(pillar: PillarValue | undefined) {
  return Boolean(pillar?.upperStageDisplay);
}

function hasVisibleSittingStage(pillar: PillarValue | undefined) {
  return Boolean(pillar?.sittingStage);
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

function buildDynamicLuckBadges(
  pillar: Pick<PillarValue, "upperStageDisplay" | "lowerStageDisplay"> | Pick<DaYunPillarValue, "upperStageDisplay" | "lowerStageDisplay"> | undefined,
  keyPrefix: string,
  options?: {
    sources?: Array<DaYunPhaseValue["source"]>;
    includeLabels?: boolean;
  },
): DynamicLuckBadgeItem[] {
  const includeLabels = options?.includeLabels ?? true;
  const items: DynamicLuckBadgeItem[] = [];

  if (pillar?.upperStageDisplay && (!options?.sources || options.sources.includes("stem"))) {
    items.push({
      key: `${keyPrefix}-upper`,
      label: includeLabels ? "ราศีบน" : undefined,
      value: pillar.upperStageDisplay,
    });
  }

  if (pillar?.lowerStageDisplay && (!options?.sources || options.sources.includes("branch"))) {
    items.push({
      key: `${keyPrefix}-lower`,
      label: includeLabels ? "ราศีล่าง" : undefined,
      value: pillar.lowerStageDisplay,
    });
  }

  return items;
}

function buildDaYunPhaseBadges(
  phase: DaYunPhaseValue | undefined,
  keyPrefix: string,
): DynamicLuckBadgeItem[] {
  if (!phase?.twelveQiDisplay) {
    return [];
  }

  return [{
    key: `${keyPrefix}-${phase.source}`,
    value: phase.twelveQiDisplay,
  }];
}

function buildRouteDetail(
  columnLabel: string,
  stageLabel: string,
  value: string,
  pillar: PillarValue | undefined,
): RouteDetail {
  return {
    kicker: "route",
    title: `${columnLabel} · ${stageLabel}`,
    summary: `${stageLabel}ของ${columnLabel}แสดงค่า ${value}`,
    explanation: "ชั้น route ใช้บอกคุณภาพของเส้นทางในพื้นดวงก่อนอ่านบทบาทต่อดิถีและปฏิกิริยาระหว่างตัวในดวง",
    details: [
      { label: "ฐาน", value: columnLabel },
      { label: "ชั้น", value: stageLabel },
      { label: "ค่า", value },
      { label: "เสา", value: pillar ? `${pillar.stem}${pillar.branch}` : "-" },
    ],
  };
}

function ReactionDetailContent({
  explanation,
  details,
}: {
  explanation: string;
  details: BaseChartDetailItemValue[];
}) {
  return (
    <section className="base-chart-detail-sheet">
      <p className="metric-copy">{explanation}</p>
      <dl className="base-chart-detail-list">
        {details.map((detail) => (
          <div key={`${detail.label}-${detail.value}`} className="base-chart-detail-list__row">
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function CalculatedBoard({ calculatedState }: CalculatedBoardProps) {
  const router = useRouter();
  const [activeDetailPanel, setActiveDetailPanel] = useState<ReadingDetailPanel>(null);
  const [activeRouteDetail, setActiveRouteDetail] = useState<RouteDetail | null>(null);

  function handlePrint() {
    window.print();
  }

  function handleOpenReactionChamber() {
    if (!calculatedState) {
      return;
    }
    router.push("/reaction-chamber");
  }

  function closeAllDetailPanels() {
    setActiveDetailPanel(null);
    setActiveRouteDetail(null);
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
  const liuNianBadges = buildDynamicLuckBadges(calculatedState?.liuNian, "liu-nian");
  const currentDaYunBadges = buildDynamicLuckBadges(currentDaYun ?? undefined, "current-dayun", {
    sources: currentDaYunPhase ? [currentDaYunPhase.source] : undefined,
    includeLabels: false,
  });
  const ageSnapshotLabel = formatAgeSnapshot(calculatedState?.ageSnapshot);
  const isStrengthDetailOpen = activeDetailPanel === "strength";
  const isLuckDetailOpen = activeDetailPanel === "luck";
  const isPersonaDetailOpen = activeDetailPanel === "persona";
  const detailOverlayMeta = activeRouteDetail
      ? {
        kicker: activeRouteDetail.kicker,
        title: activeRouteDetail.title,
        summary: activeRouteDetail.summary,
      }
      : activeDetailPanel === "strength"
        ? {
          kicker: "กำลังดิถี",
          title: "รายละเอียดกำลังดิถี",
          summary: calculatedState ? `คะแนน ${calculatedState.strengthScore.toFixed(2)} • เปิดสมการและแรงหนุน/แรงเสียดสีในชั้นเดียว` : undefined,
        }
        : activeDetailPanel === "luck"
          ? {
            kicker: "ถนนชีวิต",
            title: "ถนนชีวิต",
            summary: currentDaYun
              ? `ช่วงที่กำลังเดิน ${formatDaYunCycleCode(currentDaYun)} • ก้าวปัจจุบัน ${currentDaYunDisplay ?? "ยังไม่พบ"}`
              : "เปิดรายละเอียดช่วงที่กำลังเดิน ก้าวปัจจุบัน และช่วงทางเดินในชั้นเดียว",
          }
          : activeDetailPanel === "persona"
            ? {
              kicker: "บริบทธาตุ",
              title: "บริบทธาตุและบุคลิก",
              summary: calculatedState?.dayMasterStrengthProfile
                ? `${calculatedState.dayMasterStrengthProfile.displayLabel ?? calculatedState.dayMasterStrengthProfile.displayBand ?? calculatedState.dayMasterStrengthProfile.strengthState} • เปิดดุลธาตุและหมายเหตุเชิงกฎในชั้นแยก`
                : "เปิดรายละเอียดธาตุและหมายเหตุเชิงกฎในชั้นแยก",
            }
            : null;

  return (
    <article className="surface engine-column">
      {calculatedState ? (
        <div className="engine-stack reading-canvas">
          <div className="section-heading board-heading reading-toolbar">
            <div>
              <p className="section-kicker">ภาพรวมดวงจีน</p>
              <h2>อ่านจากพื้นดวงก่อน แล้วค่อยไล่กำลังดิถี วัยจร และแกนบุคลิก</h2>
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
            <div className="section-heading section-heading--compact pillar-ribbon-section__header">
              <div>
                <p className="section-kicker">พื้นดวง</p>
                <h3>เริ่มจากโครงดวงก่อน แล้วค่อยเปิดข้อมูลรองตามลำดับ</h3>
              </div>
            </div>

            <div className="pillar-ribbon">
              {staticDestinyColumns.map((column) => {
                const explainableTrace = column.key === "ming-gong"
                  ? calculatedState.explainable.mingGong?.trace
                  : undefined;

                return (
                  <article
                    key={column.key}
                    className={`pillar-ribbon-card${column.key === "day" ? " pillar-ribbon-card--day-master" : ""}`}
                    data-pillar-key={column.key}
                    data-day-master-column={column.key === "day" ? "true" : undefined}
                  >
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
                    <div className="destiny-glyph-stack">
                      <div className="pillar-stage-slot pillar-stage-slot--upper">
                        {column.key === "day" ? (
                          <span className="pillar-day-master-tag">ดิถี</span>
                        ) : hasVisibleTopStage(column.pillar) ? (
                          <button
                            type="button"
                            className="pillar-stage-chip pillar-stage-chip--upper pillar-stage-chip-button"
                            onClick={() => setActiveRouteDetail(buildRouteDetail(column.label, "ชั้นบน", column.pillar?.upperStageDisplay ?? "-", column.pillar))}
                          >
                            {column.pillar?.upperStageDisplay}
                          </button>
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
                        {column.key === "day" ? (
                          <span className="pillar-stage-slot__placeholder" aria-hidden="true" />
                        ) : hasVisibleSittingStage(column.pillar) ? (
                          <button
                            type="button"
                            className="pillar-stage-chip pillar-stage-chip--sitting pillar-stage-chip-button"
                            aria-label={`${column.label} เชี่ยงแซกลาง`}
                            onClick={() => setActiveRouteDetail(buildRouteDetail(column.label, "ชั้นกลาง", column.pillar?.sittingStage ?? "-", column.pillar))}
                          >
                            {column.pillar?.sittingStage}
                          </button>
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
                          <button
                            type="button"
                            className="pillar-stage-chip pillar-stage-chip--lower pillar-stage-chip-button"
                            onClick={() => setActiveRouteDetail(buildRouteDetail(column.label, "ชั้นล่าง", column.pillar?.lowerStageDisplay ?? "-", column.pillar))}
                          >
                            {column.pillar.lowerStageDisplay}
                          </button>
                        ) : (
                          <span className="pillar-stage-slot__placeholder" aria-hidden="true" />
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="pillar-ribbon-section__actions">
              <button
                type="button"
                className="secondary-action detail-trigger-action pillar-ribbon-section__cta"
                onClick={handleOpenReactionChamber}
              >
                เปิดแผนภาพปฏิกิริยา
                <span className="pillar-ribbon-section__cta-arrow" aria-hidden>→</span>
              </button>
            </div>
          </section>

          <div className="reading-primary-grid">
            <StrengthScoreBreakdown
              score={calculatedState.strengthScore}
              trace={calculatedState.explainable.strengthScore?.trace}
              title="แผนผังกำลังดิถี"
              detailMode="overlay"
              detailOpen={isStrengthDetailOpen}
              onDetailToggle={() => setActiveDetailPanel("strength")}
              detailTriggerLabel="เปิดรายละเอียดกำลังดิถี"
              className="strength-breakdown--compact"
            />

            <section
              className="surface inset-card movement-panel"
              aria-label="luck module"
              data-reading-block="D"
              data-luck-timeline-open={isLuckDetailOpen ? "true" : "false"}
            >
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="section-kicker">วัยจร</p>
                  <h3>ดูช่วงที่กำลังเดิน ก้าวปัจจุบัน และปีจรบนถนนชีวิตเดียว</h3>
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
                  {liuNianBadges.length > 0 ? (
                    <div className="dynamic-luck-badge-list" aria-label="ปีจร 12 เชี่ยงแซ">
                      {liuNianBadges.map((badge) => (
                        <article key={badge.key} className="dynamic-luck-badge">
                          <span className="dynamic-luck-badge__label">{badge.label}</span>
                          <strong className="dynamic-luck-badge__value">{badge.value}</strong>
                        </article>
                      ))}
                    </div>
                  ) : null}
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
                  <p className="section-kicker">ช่วงที่กำลังเดิน</p>
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
                  {currentDaYunBadges.length > 0 ? (
                    <div className="dynamic-luck-badge-list" aria-label="รอบหลัก 12 เชี่ยงแซ">
                      {currentDaYunBadges.map((badge) => (
                        <article key={badge.key} className={`dynamic-luck-badge${badge.label ? "" : " dynamic-luck-badge--value-only"}`}>
                          {badge.label ? <span className="dynamic-luck-badge__label">{badge.label}</span> : null}
                          <strong className="dynamic-luck-badge__value">{badge.value}</strong>
                        </article>
                      ))}
                    </div>
                  ) : null}
                  {ageSnapshotLabel ? (
                    <p className="current-luck-card__cycle">{ageSnapshotLabel}</p>
                  ) : null}
                </article>
              </div>

              <div className="movement-panel__actions">
                <button
                  type="button"
                  className="secondary-action detail-trigger-action movement-panel__toggle"
                  aria-haspopup="dialog"
                  onClick={() => setActiveDetailPanel("luck")}
                >
                  เปิดถนนชีวิต
                </button>
              </div>
            </section>
          </div>

          <CorePersonaSurface
            dayMasterStrengthProfile={calculatedState.dayMasterStrengthProfile}
            persona={calculatedState.sixtyJiaziCorePersona}
            twelveQi={calculatedState.twelveQi}
            elementAnalysis={calculatedState.elementAnalysis}
            title="แกนบุคลิกพื้นฐาน"
            kicker="ภาพตีความพื้นดวง"
            detailMode="overlay"
            detailOpen={isPersonaDetailOpen}
            onDetailToggle={() => setActiveDetailPanel("persona")}
            detailTriggerLabel="เปิดบริบทธาตุ"
          />

          <CompatibilitySurface
            profiles={calculatedState.compatibilityMatrixProfiles}
          />

          <DetailOverlay
            isOpen={activeDetailPanel !== null || activeRouteDetail !== null}
            title={detailOverlayMeta?.title ?? "รายละเอียดเพิ่มเติม"}
            kicker={detailOverlayMeta?.kicker}
            summary={detailOverlayMeta?.summary}
            onClose={closeAllDetailPanels}
          >
            {activeRouteDetail ? (
              <ReactionDetailContent
                explanation={activeRouteDetail.explanation}
                details={activeRouteDetail.details}
              />
            ) : null}

            {activeDetailPanel === "strength" ? (
              <StrengthBreakdownDetailContent
                score={calculatedState.strengthScore}
                trace={calculatedState.explainable.strengthScore?.trace}
              />
            ) : null}

            {activeDetailPanel === "luck" ? (
              <>
                <div className="movement-grid">
                  <article className="annual-energy-card">
                    <p className="section-kicker">ปีจร</p>
                    <h4>{formatPillarCode(calculatedState.liuNian)}</h4>
                    <p className="metric-copy">
                      {calculatedState.liuNian
                        ? `ก้าน ${calculatedState.liuNian.stem} · กิ่ง ${calculatedState.liuNian.branch}`
                        : "ยังไม่มีปีจรสำหรับเคสนี้"}
                    </p>
                    {liuNianBadges.length > 0 ? (
                      <div className="dynamic-luck-badge-list" aria-label="ปีจร 12 เชี่ยงแซ">
                        {liuNianBadges.map((badge) => (
                          <article key={`overlay-${badge.key}`} className="dynamic-luck-badge">
                            {badge.label ? <span className="dynamic-luck-badge__label">{badge.label}</span> : null}
                            <strong className="dynamic-luck-badge__value">{badge.value}</strong>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    <div className="shen-sha-cluster shen-sha-cluster--compact">
                      {liuNianShenSha.length > 0 ? (
                        liuNianShenSha.map((entry) => (
                          <article
                            key={`overlay-liu-nian-${entry.starName}`}
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
                    <p className="section-kicker">ช่วงที่กำลังเดิน</p>
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
                    {currentDaYunBadges.length > 0 ? (
                      <div className="dynamic-luck-badge-list" aria-label="รอบหลัก 12 เชี่ยงแซ">
                        {currentDaYunBadges.map((badge) => (
                            <article key={`overlay-${badge.key}`} className={`dynamic-luck-badge${badge.label ? "" : " dynamic-luck-badge--value-only"}`}>
                              {badge.label ? <span className="dynamic-luck-badge__label">{badge.label}</span> : null}
                            <strong className="dynamic-luck-badge__value">{badge.value}</strong>
                          </article>
                        ))}
                      </div>
                    ) : null}
                    {ageSnapshotLabel ? (
                      <p className="current-luck-card__cycle">{ageSnapshotLabel}</p>
                    ) : null}
                  </article>
                </div>

                <div className="dayun-track" aria-label="Da Yun track" data-dayun-direction={calculatedState?.isForwardDirection === false ? "rtl" : "ltr"}>
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
                              {buildDaYunPhaseBadges(phase, `${entry.startAge}-${entry.endAge}`).map((badge) => (
                                <article key={badge.key} className="dynamic-luck-badge dynamic-luck-badge--phase dynamic-luck-badge--value-only">
                                  {badge.label ? <span className="dynamic-luck-badge__label">{badge.label}</span> : null}
                                  <strong className="dynamic-luck-badge__value">{badge.value}</strong>
                                </article>
                              ))}
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

            {activeDetailPanel === "persona" ? (
              <CorePersonaDetailContent
                persona={calculatedState.sixtyJiaziCorePersona}
                elementAnalysis={calculatedState.elementAnalysis}
              />
            ) : null}
          </DetailOverlay>
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
