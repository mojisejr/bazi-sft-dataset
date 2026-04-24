"use client";

import { useState } from "react";

import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import {
  getElementStrengthBadges,
  localizeContextRuleNotes,
} from "@/lib/bazi/context-dictionary";
import { ELEMENT_LABELS_TH, FIVE_ELEMENT_ORDER } from "@/lib/bazi/symbolic-engine.constants";

type CorePersonaSurfaceProps = {
  persona: CalculatedStateValue["sixtyJiaziCorePersona"];
  elementAnalysis?: CalculatedStateValue["elementAnalysis"];
  seasonalInteraction?: CalculatedStateValue["seasonalInteraction"];
  title?: string;
  kicker?: string;
  defaultDetailsOpen?: boolean;
  enableDetailToggle?: boolean;
  detailMode?: "inline" | "overlay";
  detailOpen?: boolean;
  onDetailToggle?: () => void;
  detailTriggerLabel?: string;
};

type CorePersonaDetailContentProps = {
  persona: CalculatedStateValue["sixtyJiaziCorePersona"];
  elementAnalysis?: CalculatedStateValue["elementAnalysis"];
};

function buildCorePersonaDetailModel(
  persona: CalculatedStateValue["sixtyJiaziCorePersona"],
  elementAnalysis?: CalculatedStateValue["elementAnalysis"],
) {
  const dominantElements = elementAnalysis?.dominantElements ?? [];
  const missingElements = elementAnalysis?.missingElements ?? [];
  const totalCounts = elementAnalysis?.totalCounts;
  const elementStrengthMap = new Map(
    (elementAnalysis?.elementStrengths ?? []).map((strength) => [strength.element, strength]),
  );
  const localizedPrecedenceNotes = persona?.precedenceNoteSignals?.length
    ? localizeContextRuleNotes(persona.precedenceNoteSignals, persona.precedenceNotes)
    : (persona?.precedenceNotes ?? []);
  const hasDetailSections = Boolean(
    totalCounts
    || persona?.semanticNotes.length
    || localizedPrecedenceNotes.length,
  );

  return {
    dominantElements,
    elementStrengthMap,
    hasDetailSections,
    localizedPrecedenceNotes,
    missingElements,
    totalCounts,
  };
}

export function CorePersonaDetailContent({
  persona,
  elementAnalysis,
}: CorePersonaDetailContentProps) {
  const model = buildCorePersonaDetailModel(persona, elementAnalysis);
  const totalCounts = model.totalCounts;

  return (
    <>
      {totalCounts ? (
        <article className="core-persona__panel" data-element-analysis="available">
          <h4>ดุลธาตุและกำลังธาตุ</h4>
          <div className="core-persona__element-grid">
            {FIVE_ELEMENT_ORDER.map((element) => {
              const elementStrength = model.elementStrengthMap.get(element);

              return (
                <div key={element} className="core-persona__element-card">
                  <div className="core-persona__element-card-header">
                    <span>{ELEMENT_LABELS_TH[element]}</span>
                    <strong>{totalCounts[element]}</strong>
                  </div>
                  {elementStrength ? (
                    <div className="core-persona__strength-badges" data-element-strengths="available">
                      {getElementStrengthBadges(elementStrength).map((badge) => (
                        <span
                          key={`${element}-${badge}`}
                          className={`core-persona__strength-badge core-persona__strength-badge--${elementStrength.strength}`}
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="core-persona__analysis-summary">
            <p>{`ธาตุนำ: ${model.dominantElements.length > 0 ? model.dominantElements.map((element) => ELEMENT_LABELS_TH[element]).join(" · ") : "ยังไม่ชัด"}`}</p>
            <p>{`ธาตุขาด: ${model.missingElements.length > 0 ? model.missingElements.map((element) => ELEMENT_LABELS_TH[element]).join(" · ") : "ไม่มี"}`}</p>
          </div>
        </article>
      ) : (
        <article className="core-persona__panel" data-element-analysis="missing">
          <h4>ดุลธาตุและกำลังธาตุ</h4>
          <p className="core-persona__empty">รอบนี้ engine ยังไม่ได้สรุปการกระจายธาตุเข้ามา</p>
        </article>
      )}

      <div className="core-persona__grid">
        <article className="core-persona__panel">
          <h4>สัญญาณหลักของบุคลิก</h4>
          {persona?.semanticNotes.length ? (
            <ul className="core-persona__list">
              {persona.semanticNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p className="core-persona__empty">
              engine รอบนี้ยังไม่ได้ส่ง semantic notes เพิ่มเติมจาก canonical persona
            </p>
          )}
        </article>

        <article className="core-persona__panel">
          <h4>หมายเหตุเชิงกฎและบริบท</h4>
          {model.localizedPrecedenceNotes.length ? (
            <ul className="core-persona__list">
              {model.localizedPrecedenceNotes.map((note, index) => (
                <li key={`${index}-${note}`}>{note}</li>
              ))}
            </ul>
          ) : (
            <p className="core-persona__empty">
              ไม่มี precedence note เพิ่มเติมจาก canonical source ในรอบนี้
            </p>
          )}
        </article>
      </div>
    </>
  );
}

export function CorePersonaSurface({
  persona,
  elementAnalysis,
  seasonalInteraction,
  title = "แกนบุคลิกพื้นฐาน",
  kicker = "60 Jiazi Core Persona",
  defaultDetailsOpen = false,
  enableDetailToggle = true,
  detailMode = "inline",
  detailOpen,
  onDetailToggle,
  detailTriggerLabel,
}: CorePersonaSurfaceProps) {
  const [inlineDetailOpen, setInlineDetailOpen] = useState(defaultDetailsOpen);
  const model = buildCorePersonaDetailModel(persona, elementAnalysis);
  const isOverlayMode = detailMode === "overlay";
  const isDetailVisible = !enableDetailToggle
    ? true
    : (isOverlayMode ? Boolean(detailOpen) : (detailOpen ?? inlineDetailOpen));
  const showDetailedPanels = enableDetailToggle ? (!isOverlayMode && isDetailVisible) : true;
  const triggerLabel = detailTriggerLabel ?? (isOverlayMode ? "เปิดบริบทธาตุ" : "ดูรายละเอียดธาตุและบริบท");

  function handleDetailToggle() {
    if (onDetailToggle) {
      onDetailToggle();
      return;
    }

    setInlineDetailOpen((current) => !current);
  }

  return (
    <section
      className="surface inset-card core-persona"
      data-core-persona={persona ? "available" : "missing"}
      data-core-persona-detail-open={isDetailVisible ? "true" : "false"}
    >
      <div className="section-heading section-heading--compact">
        <div>
          <p className="section-kicker">{kicker}</p>
          <h3>{title}</h3>
        </div>
      </div>

      {seasonalInteraction ? (
        <article className="core-persona__seasonal" data-seasonal-metaphor="available">
          <p className="core-persona__eyebrow">อุปมาเชิงฤดูกาล</p>
          <h4>{seasonalInteraction.metaphor}</h4>
          <p className="core-persona__seasonal-copy">
            {`ดิถี ${seasonalInteraction.dayMasterStem} เจอเดือน ${seasonalInteraction.monthBranch} ใน${seasonalInteraction.seasonLabel}`}
          </p>
        </article>
      ) : (
        <article className="core-persona__seasonal" data-seasonal-metaphor="missing">
          <p className="core-persona__eyebrow">อุปมาเชิงฤดูกาล</p>
          <p className="core-persona__empty">รอบนี้ engine ยังไม่ได้ส่ง seasonal interaction เข้ามา</p>
        </article>
      )}

      {persona ? (
        <div className="core-persona__hero">
          <p className="core-persona__code">{persona.code}</p>
          <p className="core-persona__narrative">{persona.narrative}</p>
        </div>
      ) : (
        <p className="core-persona__empty">
          รอบนี้ engine ยังไม่ส่ง core persona เข้ามา จึงยังไม่สามารถเปิดกล่องนิสัยพื้นฐานให้ได้
        </p>
      )}

      {(persona?.elementTone || persona?.twelveQiLabel || model.dominantElements.length > 0) ? (
        <div className="core-persona__chips">
          {persona?.elementTone ? (
            <span className="core-persona__chip">{`โทนธาตุ ${persona.elementTone}`}</span>
          ) : null}
          {persona?.twelveQiLabel ? (
            <span className="core-persona__chip">{`12 เชี่ยงแซ ${persona.twelveQiLabel}`}</span>
          ) : null}
          {model.dominantElements.map((element) => (
            <span key={element} className="core-persona__chip">{`ธาตุนำ ${ELEMENT_LABELS_TH[element]}`}</span>
          ))}
        </div>
      ) : null}

      {model.hasDetailSections && enableDetailToggle ? (
        <div className="core-persona__actions">
          <button
            type="button"
            className="secondary-action core-persona__toggle"
            aria-expanded={isOverlayMode ? undefined : showDetailedPanels}
            aria-haspopup={isOverlayMode ? "dialog" : undefined}
            onClick={handleDetailToggle}
          >
            {isOverlayMode ? triggerLabel : (showDetailedPanels ? "ซ่อนรายละเอียดธาตุและบริบท" : triggerLabel)}
          </button>
        </div>
      ) : null}

      {showDetailedPanels ? (
        <CorePersonaDetailContent persona={persona} elementAnalysis={elementAnalysis} />
      ) : null}
    </section>
  );
}