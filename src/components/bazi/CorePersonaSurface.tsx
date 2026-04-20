import type { CalculatedStateValue } from "@/lib/bazi/schema-types";

type CorePersonaSurfaceProps = {
  persona: CalculatedStateValue["sixtyJiaziCorePersona"];
  title?: string;
  kicker?: string;
};

export function CorePersonaSurface({
  persona,
  title = "แกนบุคลิกพื้นฐาน",
  kicker = "60 Jiazi Core Persona",
}: CorePersonaSurfaceProps) {
  if (!persona) {
    return (
      <section className="surface inset-card core-persona" data-core-persona="missing">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="section-kicker">{kicker}</p>
            <h3>{title}</h3>
          </div>
        </div>

        <p className="core-persona__empty">
          รอบนี้ engine ยังไม่ส่ง core persona เข้ามา จึงยังไม่สามารถเปิดกล่องนิสัยพื้นฐานให้ได้
        </p>
      </section>
    );
  }

  return (
    <section className="surface inset-card core-persona" data-core-persona="available">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="section-kicker">{kicker}</p>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="core-persona__hero">
        <p className="core-persona__code">{persona.code}</p>
        <p className="core-persona__narrative">{persona.narrative}</p>
      </div>

      {persona.elementTone || persona.twelveQiLabel ? (
        <div className="core-persona__chips">
          {persona.elementTone ? (
            <span className="core-persona__chip">{`โทนธาตุ ${persona.elementTone}`}</span>
          ) : null}
          {persona.twelveQiLabel ? (
            <span className="core-persona__chip">{`12 เชี่ยงแซ ${persona.twelveQiLabel}`}</span>
          ) : null}
        </div>
      ) : null}

      <div className="core-persona__grid">
        <article className="core-persona__panel">
          <h4>สัญญาณหลักของบุคลิก</h4>
          {persona.semanticNotes.length > 0 ? (
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
          {persona.precedenceNotes.length > 0 ? (
            <ul className="core-persona__list">
              {persona.precedenceNotes.map((note) => (
                <li key={note}>{note}</li>
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