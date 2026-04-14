import type {
  CalculatedStateValue,
  RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  formatScore,
  formatThaiBirthMoment,
  reportPillarColumns,
  tenGodRows,
  twelveQiRows,
} from "@/lib/bazi/trainer-workspace";

type CalculatedBoardProps = {
  submittedInput: RawInputValue | null;
  calculatedState: CalculatedStateValue | null;
};

export function CalculatedBoard({
  submittedInput,
  calculatedState,
}: CalculatedBoardProps) {
  function handlePrint() {
    window.print();
  }

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
          <h2>จัดผังให้อ่านตามลำดับเดียวกับใบรายงานอ้างอิง</h2>
        </div>
        <div className="board-actions">
          <p className="section-note board-section-note">
            เริ่มจากแผง 4 เสาแบบ classic ก่อน แล้วค่อยไล่ธาตุแฝง 10 เทพ และจังหวะพลัง
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
          <section className="surface inset-card classic-report" aria-label="classic bazi report">
            <div className="classic-report__header">
              <p className="classic-report__summary">{formatThaiBirthMoment(submittedInput)}</p>
              <div className="identity-strip identity-strip--compact">
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
            </div>

            <div className="classic-report__body">
              <aside className="classic-report__aside">
                <span className="classic-report__aside-kicker">ลัคนา</span>
                <strong>{submittedInput?.gender === "male" ? "ชาย" : submittedInput?.gender === "female" ? "หญิง" : "อื่นๆ"}</strong>
                <p>เรียงหลักเวลาไว้ซ้ายสุดตาม pattern ของใบรายงานอ้างอิง เพื่อลดการอ่านสลับคอลัมน์</p>
              </aside>

              <div className="classic-pillars" role="table" aria-label="Four pillars overview">
                <div className="classic-pillars__labels" role="row">
                  {reportPillarColumns.map((column) => (
                    <span key={column.key} className="classic-pillars__label" role="columnheader">
                      {column.label}
                    </span>
                  ))}
                </div>

                <div className="classic-pillars__row classic-pillars__row--stems" role="row">
                  {reportPillarColumns.map((column) => (
                    <span key={column.key} className="classic-pillars__glyph" role="cell">
                      {calculatedState.fourPillars[column.key].stem}
                    </span>
                  ))}
                </div>

                <div className="classic-pillars__row classic-pillars__row--branches" role="row">
                  {reportPillarColumns.map((column) => (
                    <span key={column.key} className="classic-pillars__glyph" role="cell">
                      {calculatedState.fourPillars[column.key].branch}
                    </span>
                  ))}
                </div>

                <div className="classic-pillars__hidden" role="row">
                  {reportPillarColumns.map((column) => (
                    <span key={column.key} className="classic-pillars__hidden-cell" role="cell">
                      <span className="classic-pillars__hidden-label">ธาตุแฝง</span>
                      <strong>{calculatedState.fourPillars[column.key].hiddenStems?.join(" · ") ?? "-"}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

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
            </div>

            <div className="surface inset-card highlight-card highlight-card--wide">
              <p className="section-kicker">60 Jiazi Core Persona</p>
              <h3>{calculatedState.sixtyJiaziCorePersona?.code ?? "ยังไม่มี narrative เฉพาะ"}</h3>
              <p className="metric-copy">
                {calculatedState.sixtyJiaziCorePersona?.narrative ??
                  "ผลรอบนี้ยังไม่มีคำบรรยายเพิ่มเติมจากคลัง canonical"}
              </p>
            </div>
          </section>

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
        </div>
      ) : (
        <section className="surface inset-card empty-state">
          <p className="section-kicker">พร้อมเริ่ม</p>
          <h3>ตั้งข้อมูลเพื่อดูผังดวงแบบ classic</h3>
          <p>
            เมื่อกดคำนวณแล้ว ฝั่งนี้จะเรียง 4 เสาแบบ เวลา-วัน-เดือน-ปี ก่อน แล้วค่อยเติม 10 เทพ, 12 Qi และภาพรวมอื่นให้อ่านต่อทันที
          </p>
        </section>
      )}
    </article>
  );
}
