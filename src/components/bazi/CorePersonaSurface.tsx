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
};

export function CorePersonaSurface({
  persona,
  elementAnalysis,
  seasonalInteraction,
  title = "แกนบุคลิกพื้นฐาน",
  kicker = "60 Jiazi Core Persona",
}: CorePersonaSurfaceProps) {
  const dominantElements = elementAnalysis?.dominantElements ?? [];
  const missingElements = elementAnalysis?.missingElements ?? [];
  const totalCounts = elementAnalysis?.totalCounts;
  const elementStrengthMap = new Map(
    (elementAnalysis?.elementStrengths ?? []).map((strength) => [strength.element, strength]),
  );
  const localizedPrecedenceNotes = persona?.precedenceNoteSignals?.length
    ? localizeContextRuleNotes(persona.precedenceNoteSignals, persona.precedenceNotes)
    : (persona?.precedenceNotes ?? []);

  return (
    <section
      className="surface inset-card core-persona"
      data-core-persona={persona ? "available" : "missing"}
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

      {(persona?.elementTone || persona?.twelveQiLabel || dominantElements.length > 0) ? (
        <div className="core-persona__chips">
          {persona?.elementTone ? (
            <span className="core-persona__chip">{`โทนธาตุ ${persona.elementTone}`}</span>
          ) : null}
          {persona?.twelveQiLabel ? (
            <span className="core-persona__chip">{`12 เชี่ยงแซ ${persona.twelveQiLabel}`}</span>
          ) : null}
          {dominantElements.map((element) => (
            <span key={element} className="core-persona__chip">{`ธาตุนำ ${ELEMENT_LABELS_TH[element]}`}</span>
          ))}
        </div>
      ) : null}

      {totalCounts ? (
        <article className="core-persona__panel" data-element-analysis="available">
          <h4>ดุลธาตุและกำลังธาตุ</h4>
          <div className="core-persona__element-grid">
            {FIVE_ELEMENT_ORDER.map((element) => {
              const elementStrength = elementStrengthMap.get(element);

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
            <p>{`ธาตุนำ: ${dominantElements.length > 0 ? dominantElements.map((element) => ELEMENT_LABELS_TH[element]).join(" · ") : "ยังไม่ชัด"}`}</p>
            <p>{`ธาตุขาด: ${missingElements.length > 0 ? missingElements.map((element) => ELEMENT_LABELS_TH[element]).join(" · ") : "ไม่มี"}`}</p>
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
          {localizedPrecedenceNotes.length ? (
            <ul className="core-persona__list">
              {localizedPrecedenceNotes.map((note, index) => (
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
    </section>
  );
}