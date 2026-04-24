import Link from "next/link";

import type { PendingDraftDatasetRecord } from "@/lib/bazi/dataset-records";

type PendingDraftQueueProps = {
  records: PendingDraftDatasetRecord[];
  returnToPath?: string;
  campaignLabel?: string;
};

function getReviewStateCopy(state: PendingDraftDatasetRecord["reviewState"]) {
  switch (state) {
    case "stale":
      return "ต้องตรวจซ้ำ";
    case "needs-reproof":
      return "ต้อง re-proof";
    case "superseded":
      return "ถูกแทนแล้ว";
    default:
      return "active";
  }
}

function getLineageCopy(record: PendingDraftDatasetRecord) {
  if (record.supersedesRecordId) {
    return "revision ใหม่จากเคสเดิม";
  }

  if (record.latestEffectiveRecordId && record.latestEffectiveRecordId !== record.id) {
    return "มีเป้าหมายตรวจตัวล่าสุดแล้ว";
  }

  return "ต้นฉบับของคิวรอบนี้";
}

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

export function PendingDraftQueue({
  records,
  returnToPath = "/pending",
  campaignLabel,
}: PendingDraftQueueProps) {
  const activeCount = records.filter((record) => !record.reviewState || record.reviewState === "active").length;
  const staleCount = records.filter((record) => record.reviewState === "stale").length;
  const reproofCount = records.filter((record) => record.reviewState === "needs-reproof").length;

  return (
    <section className="workspace-stack">
      <section className="surface inset-card message-card pending-hero-card">
        <p className="section-kicker">Phase 4</p>
        <h2>Pending Queue สำหรับรอตรวจทาน</h2>
        <p>
          หน้านี้ดึง draft records จากฐานข้อมูลโดยตรง เพื่อให้ซินแสเห็นกองงาน active,
          ตรวจ state ของคิว และเปิดเข้า proof ของเป้าหมายล่าสุดได้ทันที
        </p>
        <div className="pending-hero-card__meta">
          <span className="pending-badge pending-badge--domain">
            {campaignLabel ? `campaign ${campaignLabel}` : "ทุก campaign ที่ยัง active"}
          </span>
          <span className="pending-badge pending-badge--ai">active {activeCount}</span>
          <span className="pending-badge pending-badge--domain">ต้องตรวจซ้ำ {staleCount}</span>
          <span className="pending-badge pending-badge--domain">ต้อง re-proof {reproofCount}</span>
        </div>
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
        <section className="surface inset-card pending-list" aria-label="draft pending queue">
          <div className="pending-list__header">
            <div>
              <p className="section-kicker">Draft Queue</p>
              <h3>เลือกเคสแล้วเข้าไปตรวจได้ทันที</h3>
            </div>
            <p className="pending-list__summary">
              {campaignLabel
                ? `กำลังเปิดคิว ${campaignLabel} อยู่ มี ${records.length} เคสพร้อมตรวจ`
                : `ตอนนี้มี ${records.length} เคสในคิวรอตรวจ`}
            </p>
          </div>

          <div className="pending-list__table-head" aria-hidden="true">
            <span>เคส</span>
            <span>วันเวลาเกิด</span>
            <span>ขอบเขต</span>
            <span>อัปเดตล่าสุด</span>
            <span>เปิดตรวจ</span>
          </div>

          <div className="pending-list__rows">
          {records.map((record) => (
            <article key={record.id} className="pending-row">
              <div className="pending-row__case">
                <div className="pending-row__badges">
                  <span className="pending-badge pending-badge--ai">
                    {getAnnotatorBadge(record.annotatorId)}
                  </span>
                  <span className="pending-badge pending-badge--domain">
                    {record.intentDomain}
                  </span>
                  <span className="pending-badge pending-badge--domain">
                    {getReviewStateCopy(record.reviewState)}
                  </span>
                  {record.queueBatchId ? (
                    <span className="pending-badge pending-badge--domain">{record.queueBatchId}</span>
                  ) : null}
                </div>

                <div className="pending-row__identity">
                  <strong>{record.customerName ?? record.id.slice(0, 8)}</strong>
                  {record.customerName ? <span>Record Key {record.id.slice(0, 8)}</span> : null}
                  <span>Record ID {record.id}</span>
                  <span>{getLineageCopy(record)}</span>
                  {record.sourceRow ? <span>แถวที่ {record.sourceRow} จากไฟล์ต้นทาง</span> : null}
                  {record.caseNote ? <span>หมายเหตุเคส: {record.caseNote}</span> : null}
                  {record.staleReason ? <span>เหตุผลที่ต้องตรวจซ้ำ: {record.staleReason}</span> : null}
                </div>
              </div>

              <div className="pending-row__birth">{formatThaiBirthMoment(record.birthDate, record.birthTime)}</div>

              <div className="pending-row__scope">
                <strong>ดิถี {record.dayMaster}</strong>
                <span>{record.intentDomain}</span>
              </div>

              <div className="pending-row__updated">{formatUpdatedAt(record.updatedAt)}</div>

              <div className="pending-row__action">
                <Link
                  className="secondary-action pending-link"
                  href={{
                    pathname: `/proof/${record.id}`,
                    query: {
                      returnTo: returnToPath,
                    },
                  }}
                >
                  ตรวจเคส
                </Link>
              </div>
            </article>
          ))}
          </div>
        </section>
      )}
    </section>
  );
}