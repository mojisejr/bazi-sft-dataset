import type {
  CalculatedStateValue,
  RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  formatBirthMoment,
  formatScore,
  pillarColumns,
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
  return (
    <article className="surface engine-column">
      <div className="section-heading">
        <div>
          <p className="section-kicker">ภาพรวมดวงจีน</p>
          <h2>โครงสร้างที่ระบบคำนวณให้</h2>
        </div>
        <p className="section-note">อ่านจากบนลงล่างเพื่อเห็นภาพรวมก่อนเข้าสู่การวิเคราะห์เชิงลึก</p>
      </div>

      <div className="identity-strip">
        <div>
          <span className="identity-label">เวลาเกิด</span>
          <strong>{formatBirthMoment(submittedInput)}</strong>
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

      {calculatedState ? (
        <div className="engine-stack">
          <section className="surface inset-card">
            <div className="section-heading section-heading--compact">
              <div>
                <p className="section-kicker">4 เสา</p>
                <h3>Four Pillars</h3>
              </div>
            </div>

            <div className="pillar-table" role="table" aria-label="Four pillars overview">
              <div className="pillar-row pillar-row--header" role="row">
                <span className="pillar-label" />
                {pillarColumns.map((column) => (
                  <span key={column.key} className="pillar-cell pillar-cell--header" role="columnheader">
                    {column.label}
                  </span>
                ))}
              </div>

              <div className="pillar-row" role="row">
                <span className="pillar-label">ก้านฟ้า</span>
                {pillarColumns.map((column) => (
                  <span key={column.key} className="pillar-cell" role="cell">
                    {calculatedState.fourPillars[column.key].stem}
                  </span>
                ))}
              </div>

              <div className="pillar-row" role="row">
                <span className="pillar-label">กิ่งดิน</span>
                {pillarColumns.map((column) => (
                  <span key={column.key} className="pillar-cell" role="cell">
                    {calculatedState.fourPillars[column.key].branch}
                  </span>
                ))}
              </div>

              <div className="pillar-row" role="row">
                <span className="pillar-label">ซ่อนธาตุ</span>
                {pillarColumns.map((column) => (
                  <span key={column.key} className="pillar-cell pillar-cell--stacked" role="cell">
                    {calculatedState.fourPillars[column.key].hiddenStems?.join(" · ") ?? "-"}
                  </span>
                ))}
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
          <h3>ตั้งข้อมูลเพื่อดูภาพรวมดวง</h3>
          <p>
            เมื่อกดคำนวณแล้ว ฝั่งนี้จะเติม 4 เสา, 10 เทพ, 12 Qi, core persona และคำเปรียบเปรยธาตุให้อ่านทันที
          </p>
        </section>
      )}
    </article>
  );
}