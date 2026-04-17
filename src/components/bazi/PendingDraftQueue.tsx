import Link from "next/link";

import type { PendingDraftDatasetRecord } from "@/lib/bazi/dataset-records";

type PendingDraftQueueProps = {
  records: PendingDraftDatasetRecord[];
};

function formatThaiBirthMoment(birthDate: string, birthTime: string) {
  const [yearText = "", monthText = "", dayText = ""] = birthDate.split("-");
  const [hourText = "", minuteText = ""] = birthTime.split(":");
  const monthNumber = Number(monthText);
  const dayNumber = Number(dayText);
  const yearNumber = Number(yearText);
  const fallbackDate = `${birthDate} ${birthTime}`.trim();

  if (
    !Number.isFinite(monthNumber)
    || !Number.isFinite(dayNumber)
    || !Number.isFinite(yearNumber)
  ) {
    return fallbackDate;
  }

  const thaiMonth = new Intl.DateTimeFormat("th-TH", { month: "long" }).format(
    new Date(Date.UTC(2026, monthNumber - 1, 1)),
  );
  const buddhistYear = yearNumber + 543;
  const thaiTime = hourText && minuteText ? `${hourText}.${minuteText}` : birthTime;

  return `เกิดวันที่ ${dayNumber} ${thaiMonth} พ.ศ.${buddhistYear} เวลา ${thaiTime} น.`;
}

function formatUpdatedAt(timestamp: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getAnnotatorBadge(annotatorId: string | null) {
  if (annotatorId?.startsWith("agent_")) {
    return "AI Generated";
  }

  return "Draft Record";
}

export function PendingDraftQueue({ records }: PendingDraftQueueProps) {
  return (
    <section className="workspace-stack">
      <section className="surface inset-card message-card pending-hero-card">
        <p className="section-kicker">Phase 4</p>
        <h2>Pending Queue สำหรับรอตรวจทาน</h2>
        <p>
          หน้านี้ดึง draft records จากฐานข้อมูลโดยตรง เพื่อให้ซินแสเลือกเคสที่ AI สร้างไว้แล้ว
          แล้วค่อยเปิดเข้าสู่ proofing workspace ใน phase ถัดไป
        </p>
      </section>

      {records.length === 0 ? (
        <section className="surface inset-card empty-state pending-empty-state">
          <p className="section-kicker">Draft Queue</p>
          <h3>ยังไม่มี draft record ในคิว</h3>
          <p>
            เมื่อ script generation และ import เข้ามาเป็น `draft` แล้ว รายการจะมาโผล่ที่หน้านี้ทันที
          </p>
        </section>
      ) : (
        <section className="pending-grid" aria-label="draft pending queue">
          {records.map((record) => (
            <article key={record.id} className="surface inset-card pending-card">
              <div className="pending-card__badges">
                <span className="pending-badge pending-badge--ai">
                  {getAnnotatorBadge(record.annotatorId)}
                </span>
                <span className="pending-badge pending-badge--domain">
                  {record.intentDomain}
                </span>
              </div>

              <div className="pending-card__header">
                <div>
                  <p className="section-kicker">Draft Record</p>
                  <h3>{record.id.slice(0, 8)}</h3>
                </div>
                <strong className="pending-day-master">ดิถี {record.dayMaster}</strong>
              </div>

              <dl className="pending-metadata-list">
                <div className="pending-metadata-row">
                  <dt>วันเวลาเกิด</dt>
                  <dd>{formatThaiBirthMoment(record.birthDate, record.birthTime)}</dd>
                </div>
                <div className="pending-metadata-row">
                  <dt>Record ID</dt>
                  <dd>{record.id}</dd>
                </div>
                <div className="pending-metadata-row">
                  <dt>อัปเดตล่าสุด</dt>
                  <dd>{formatUpdatedAt(record.updatedAt)}</dd>
                </div>
              </dl>

              <div className="pending-card__actions">
                <Link className="secondary-action pending-link" href={`/proof/${record.id}`}>
                  เปิด proofing hook
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}