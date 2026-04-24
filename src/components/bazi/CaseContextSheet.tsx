type CaseContextAnchor = {
  label: string;
  value: string;
};

type CaseContextSheetProps = {
  customerName?: string | null;
  recordId: string;
  birthMoment: string;
  province?: string;
  intentDomain: string;
  campaignLabel?: string | null;
  queueStateLabel: string;
  lineageSummary: string;
  sourceRow?: number | null;
  caseNote?: string | null;
  staleReason?: string | null;
  truthAnchors?: CaseContextAnchor[];
  summaryNote?: string;
};

export function CaseContextSheet({
  customerName,
  recordId,
  birthMoment,
  province,
  intentDomain,
  campaignLabel,
  queueStateLabel,
  lineageSummary,
  sourceRow,
  caseNote,
  staleReason,
  truthAnchors = [],
  summaryNote,
}: CaseContextSheetProps) {
  return (
    <div className="workspace-stack">
      <section className="surface inset-card proof-summary-card">
        <div>
          <p className="section-kicker">ข้อมูลเคส</p>
          <h3>ภาพรวมที่ควรอ่านก่อนทำงานต่อ</h3>
        </div>

        <dl className="pending-metadata-list proof-meta-list">
          {customerName ? (
            <div className="pending-metadata-row">
              <dt>ชื่อลูกค้า</dt>
              <dd>{customerName}</dd>
            </div>
          ) : null}
          <div className="pending-metadata-row">
            <dt>วันเวลาเกิด</dt>
            <dd>{birthMoment}</dd>
          </div>
          {province ? (
            <div className="pending-metadata-row">
              <dt>จังหวัดเกิด</dt>
              <dd>{province}</dd>
            </div>
          ) : null}
          <div className="pending-metadata-row">
            <dt>ขอบเขตคำถาม</dt>
            <dd>{intentDomain}</dd>
          </div>
          <div className="pending-metadata-row">
            <dt>รหัสรายการ</dt>
            <dd>{recordId}</dd>
          </div>
          {campaignLabel ? (
            <div className="pending-metadata-row">
              <dt>campaign</dt>
              <dd>{campaignLabel}</dd>
            </div>
          ) : null}
          <div className="pending-metadata-row">
            <dt>สถานะคิว</dt>
            <dd>{queueStateLabel}</dd>
          </div>
          <div className="pending-metadata-row">
            <dt>lineage</dt>
            <dd>{lineageSummary}</dd>
          </div>
          {typeof sourceRow === "number" ? (
            <div className="pending-metadata-row">
              <dt>แถวจากไฟล์ต้นทาง</dt>
              <dd>{sourceRow}</dd>
            </div>
          ) : null}
          {caseNote ? (
            <div className="pending-metadata-row">
              <dt>หมายเหตุเคส</dt>
              <dd>{caseNote}</dd>
            </div>
          ) : null}
          {staleReason ? (
            <div className="pending-metadata-row">
              <dt>เหตุผลที่ต้องตรวจซ้ำ</dt>
              <dd>{staleReason}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {truthAnchors.length > 0 ? (
        <section className="surface inset-card proof-summary-card">
          <div>
            <p className="section-kicker">Quick Truth Anchors</p>
            <h3>ค่าหลักที่ควรถือไว้ก่อนกลับไปอ่านงานต่อ</h3>
          </div>

          <div className={truthAnchors.length === 3 ? "proof-pill-strip proof-pill-strip--review" : "proof-pill-strip"}>
            {truthAnchors.map((anchor) => (
              <div key={anchor.label} className="proof-pill-chip">
                <span>{anchor.label}</span>
                <strong>{anchor.value}</strong>
              </div>
            ))}
          </div>

          {summaryNote ? <p className="metric-copy">{summaryNote}</p> : null}
        </section>
      ) : null}
    </div>
  );
}