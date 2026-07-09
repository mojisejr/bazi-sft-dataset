"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionLink } from "@/components/bazi/primitives/Action";
import { Badge } from "@/components/bazi/primitives/Badge";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import type { ReadingSessionListItem } from "@/lib/bazi/reading-sessions";
import type { ReadingPdfVersionListItem } from "@/lib/bazi/reading-pdf-versions";
import type { ReadingSessionRevisionListItem } from "@/lib/bazi/reading-session-revisions";
import type { NewdataReadingRevisionListItem } from "@/lib/bazi/newdata-reading-revisions";

/** ดวงที่บันทึกจากหน้า "อ่าน 15 บท (NewData)" — ตาราง bazi_newdata_reading */
export type NewdataReadingHistoryItem = {
  id: string;
  clientName: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  status: string;
  updatedAt: string;
};

type ReadingHistoryWorkspaceProps = {
  records: ReadingSessionListItem[];
  versions?: ReadingPdfVersionListItem[];
  revisions?: ReadingSessionRevisionListItem[];
  newdataReadings?: NewdataReadingHistoryItem[];
  newdataRevisions?: NewdataReadingRevisionListItem[];
  unavailable?: boolean;
};

const PROVIDER_LABEL: Record<string, string> = {
  gemini: "Gemini",
  opencode: "OpenCode Zen",
  anthropic: "Local Claude",
};

const GENDER_LABEL: Record<string, string> = {
  male: "ชาย",
  female: "หญิง",
  other: "อื่น ๆ",
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
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ReadingHistoryWorkspace({
  records,
  versions = [],
  revisions = [],
  newdataReadings = [],
  newdataRevisions = [],
  unavailable = false,
}: ReadingHistoryWorkspaceProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [deletingRevisionId, setDeletingRevisionId] = useState<string | null>(null);
  const [restoringRevisionId, setRestoringRevisionId] = useState<string | null>(null);
  const [deletingNewdataId, setDeletingNewdataId] = useState<string | null>(null);
  const [togglingNewdataId, setTogglingNewdataId] = useState<string | null>(null);
  const [deletingNewdataRevisionId, setDeletingNewdataRevisionId] = useState<string | null>(null);
  const [restoringNewdataRevisionId, setRestoringNewdataRevisionId] = useState<string | null>(null);

  async function handleDeleteNewdataRevision(id: string) {
    if (typeof window !== "undefined" && !window.confirm("ลบจุดบันทึกนี้ออกจากประวัติ ?")) {
      return;
    }
    setDeletingNewdataRevisionId(id);
    try {
      const response = await fetch(`/api/reading/newdata-reading/revisions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("ลบไม่สำเร็จ");
      }
      router.refresh();
    } catch {
      setDeletingNewdataRevisionId(null);
    }
  }

  // กู้คืน NewData: ดึง edits ของจุดบันทึกนั้น แล้วเขียนทับดวงต้นทาง (เป็นการบันทึกครั้งใหม่ → มี revision ใหม่ด้วย)
  async function handleRestoreNewdataRevision(id: string, readingId: string) {
    if (
      typeof window !== "undefined"
      && !window.confirm(
        "กู้คืนงานกลับไปเป็นจุดบันทึกนี้ ?\n\nสภาพปัจจุบันจะถูกแทนที่ (สภาพปัจจุบันยังถูกเก็บเป็นจุดบันทึกก่อนหน้าอยู่ — ย้อนกลับได้)",
      )
    ) {
      return;
    }
    setRestoringNewdataRevisionId(id);
    try {
      const detailResponse = await fetch(`/api/reading/newdata-reading/revisions/${id}`);
      if (!detailResponse.ok) {
        throw new Error("โหลดจุดบันทึกไม่สำเร็จ");
      }
      const detail = await detailResponse.json();
      const saveResponse = await fetch("/api/reading/newdata-reading/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: readingId,
          clientName: detail.clientName,
          birthDate: detail.birthDate,
          birthTime: detail.birthTime,
          gender: detail.gender,
          province: detail.province,
          edits: detail.edits,
        }),
      });
      if (!saveResponse.ok) {
        throw new Error("กู้คืนไม่สำเร็จ");
      }
      router.push(`/reading/newdata-reading?session=${readingId}`);
    } catch {
      setRestoringNewdataRevisionId(null);
    }
  }

  async function handleDeleteRevision(id: string) {
    if (typeof window !== "undefined" && !window.confirm("ลบจุดบันทึกนี้ออกจากประวัติ ?")) {
      return;
    }
    setDeletingRevisionId(id);
    try {
      const response = await fetch(`/api/reading/session-revisions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("ลบไม่สำเร็จ");
      }
      router.refresh();
    } catch {
      setDeletingRevisionId(null);
    }
  }

  // กู้คืน: ดึงสแน็ปช็อตของจุดบันทึกนั้น แล้วเขียนทับ live session ของดวงต้นทาง (เป็นการบันทึกครั้งใหม่ → มี revision ใหม่ด้วย)
  async function handleRestoreRevision(id: string, sessionId: string) {
    if (
      typeof window !== "undefined"
      && !window.confirm(
        "กู้คืนงานกลับไปเป็นจุดบันทึกนี้ ?\n\nสภาพปัจจุบันจะถูกแทนที่ด้วยจุดนี้ (สภาพปัจจุบันยังถูกเก็บเป็นจุดบันทึกก่อนหน้าอยู่ — ย้อนกลับได้)",
      )
    ) {
      return;
    }
    setRestoringRevisionId(id);
    try {
      const detailResponse = await fetch(`/api/reading/session-revisions/${id}`);
      if (!detailResponse.ok) {
        throw new Error("โหลดจุดบันทึกไม่สำเร็จ");
      }
      const detail = await detailResponse.json();
      const saveResponse = await fetch("/api/reading/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          label: detail.label ?? null,
          status: detail.status,
          rawInput: detail.rawInput,
          calculatedState: detail.calculatedState,
          sessionData: detail.sessionData,
        }),
      });
      if (!saveResponse.ok) {
        throw new Error("กู้คืนไม่สำเร็จ");
      }
      router.push(`/reading?session=${sessionId}`);
    } catch {
      setRestoringRevisionId(null);
    }
  }

  // สลับสถานะ "เสร็จสิ้น" ↔ "กำลังแก้" ของดวง NewData (อ่าน 15 บท)
  async function handleToggleNewdataStatus(id: string, currentStatus: string) {
    const nextStatus = currentStatus === "done" ? "in_progress" : "done";
    setTogglingNewdataId(id);
    try {
      const response = await fetch(`/api/reading/newdata-reading/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        throw new Error("อัปเดตสถานะไม่สำเร็จ");
      }
      router.refresh();
    } catch {
      setTogglingNewdataId(null);
    }
  }

  async function handleDeleteNewdata(id: string, title: string) {
    if (typeof window !== "undefined" && !window.confirm(`ลบดวง "${title}" (อ่าน 15 บท) ?`)) {
      return;
    }
    setDeletingNewdataId(id);
    try {
      const response = await fetch(`/api/reading/newdata-reading/sessions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("ลบไม่สำเร็จ");
      }
      router.refresh();
    } catch {
      setDeletingNewdataId(null);
    }
  }

  async function handleDelete(id: string, title: string, versionCount: number) {
    // ลบ "ดวง" ไม่ลบเวอร์ชัน PDF ที่บันทึกไว้ — เวอร์ชันจะย้ายไปกลุ่ม "ไม่มีดวงต้นทาง" (ยังเปิด/แก้/ปริ้นได้)
    const message =
      versionCount > 0
        ? `ลบประวัติการดูดวง "${title}" ?\n\nดวงนี้มีเวอร์ชัน PDF ที่บันทึกไว้ ${versionCount} เวอร์ชัน — เวอร์ชันจะ "ไม่ถูกลบ" แต่จะย้ายไปกลุ่ม “เวอร์ชันที่ไม่มีดวงต้นทาง” (ยังเปิดแก้/ปริ้นได้)`
        : `ลบประวัติการดูดวง "${title}" ?`;
    if (typeof window !== "undefined" && !window.confirm(message)) {
      return;
    }
    setDeletingId(id);
    try {
      const response = await fetch(`/api/reading/sessions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("ลบไม่สำเร็จ");
      }
      router.refresh();
    } catch {
      setDeletingId(null);
    }
  }

  // สลับสถานะ "เสร็จสิ้น" ↔ "กำลังแก้" — mark ดวงว่าคำอ่านสุดท้ายพร้อมเก็บไปเทรน
  async function handleToggleStatus(id: string, currentStatus: string) {
    const nextStatus = currentStatus === "done" ? "in_progress" : "done";
    setTogglingId(id);
    try {
      const response = await fetch(`/api/reading/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        throw new Error("อัปเดตสถานะไม่สำเร็จ");
      }
      router.refresh();
    } catch {
      setTogglingId(null);
    }
  }

  async function handleDeleteVersion(id: string) {
    if (typeof window !== "undefined" && !window.confirm("ลบเวอร์ชัน PDF นี้ ?")) {
      return;
    }
    setDeletingVersionId(id);
    try {
      const response = await fetch(`/api/reading/pdf-versions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("ลบไม่สำเร็จ");
      }
      router.refresh();
    } catch {
      setDeletingVersionId(null);
    }
  }

  // จัดกลุ่มเวอร์ชัน PDF ตามดวงต้นทาง (sessionId) — เวอร์ชันที่ดวงต้นทางถูกลบไปแล้วเข้ากลุ่ม orphan
  const knownSessionIds = new Set(records.map((record) => record.id));
  const versionsBySession = new Map<string, ReadingPdfVersionListItem[]>();
  const orphanVersions: ReadingPdfVersionListItem[] = [];
  for (const version of versions) {
    if (version.sessionId && knownSessionIds.has(version.sessionId)) {
      const list = versionsBySession.get(version.sessionId) ?? [];
      list.push(version);
      versionsBySession.set(version.sessionId, list);
    } else {
      orphanVersions.push(version);
    }
  }

  // showIdentity = true สำหรับกลุ่ม orphan (ไม่มีการ์ดดวงครอบ) → ต้องบอก ใคร/วันเวลาเกิด ในตัวเวอร์ชันเอง
  function renderVersionItem(version: ReadingPdfVersionListItem, showIdentity = false) {
    const isDeleting = deletingVersionId === version.id;
    const versionTitle = version.label?.trim() || version.id.slice(0, 8);
    return (
      <li key={version.id} className="reading-history__version">
        <div className="reading-history__version-info">
          {showIdentity ? (
            <>
              <strong className="reading-history__version-who">{versionTitle}</strong>
              <span className="reading-history__version-birth">
                {formatThaiBirthMoment(version.birthDate, version.birthTime)}
                {version.dayMaster ? ` · ดิถี ${version.dayMaster}` : ""}
              </span>
            </>
          ) : null}
          <span className="reading-history__version-time">
            แก้ไข/บันทึก {formatUpdatedAt(version.createdAt)}
          </span>
          {version.versionNote?.trim() ? (
            <span className="reading-history__version-note">{version.versionNote}</span>
          ) : null}
        </div>
        <div className="reading-history__version-actions">
          <ActionLink href={`/reading?version=${version.id}`} tone="primary" className="reading-history__action">
            แก้เวอร์ชันนี้
          </ActionLink>
          <ActionLink
            href={`/reading?version=${version.id}&print=1`}
            tone="secondary"
            className="reading-history__action"
          >
            ปริ้น/PDF
          </ActionLink>
          <button
            type="button"
            className="reading-history__delete"
            disabled={isDeleting}
            onClick={() => void handleDeleteVersion(version.id)}
          >
            {isDeleting ? "กำลังลบ..." : "ลบ"}
          </button>
        </div>
      </li>
    );
  }

  // จัดกลุ่ม "ประวัติการบันทึก" (revision) ตามดวงต้นทาง — แต่ละครั้งที่กดบันทึกการดูดวงจะมีหนึ่งจุด
  const revisionsBySession = new Map<string, ReadingSessionRevisionListItem[]>();
  for (const revision of revisions) {
    const list = revisionsBySession.get(revision.sessionId) ?? [];
    list.push(revision);
    revisionsBySession.set(revision.sessionId, list);
  }

  function renderRevisionItem(revision: ReadingSessionRevisionListItem) {
    const isDeleting = deletingRevisionId === revision.id;
    const isRestoring = restoringRevisionId === revision.id;
    return (
      <li key={revision.id} className="reading-history__version">
        <div className="reading-history__version-info">
          <span className="reading-history__version-time">
            บันทึกเมื่อ {formatUpdatedAt(revision.createdAt)}
          </span>
        </div>
        <div className="reading-history__version-actions">
          <ActionLink
            href={`/reading?revision=${revision.id}`}
            tone="secondary"
            className="reading-history__action"
          >
            เปิดดู
          </ActionLink>
          <button
            type="button"
            className="reading-history__action reading-history__action--restore"
            disabled={isRestoring}
            onClick={() => void handleRestoreRevision(revision.id, revision.sessionId)}
          >
            {isRestoring ? "กำลังกู้คืน..." : "กู้คืน"}
          </button>
          <button
            type="button"
            className="reading-history__delete"
            disabled={isDeleting}
            onClick={() => void handleDeleteRevision(revision.id)}
          >
            {isDeleting ? "กำลังลบ..." : "ลบ"}
          </button>
        </div>
      </li>
    );
  }

  // จัดกลุ่ม "ประวัติการบันทึก" ของ NewData ตามดวงต้นทาง (readingId)
  const newdataRevisionsByReading = new Map<string, NewdataReadingRevisionListItem[]>();
  for (const revision of newdataRevisions) {
    const list = newdataRevisionsByReading.get(revision.readingId) ?? [];
    list.push(revision);
    newdataRevisionsByReading.set(revision.readingId, list);
  }

  function renderNewdataRevisionItem(revision: NewdataReadingRevisionListItem) {
    const isDeleting = deletingNewdataRevisionId === revision.id;
    const isRestoring = restoringNewdataRevisionId === revision.id;
    return (
      <li key={revision.id} className="reading-history__version">
        <div className="reading-history__version-info">
          <span className="reading-history__version-time">
            บันทึกเมื่อ {formatUpdatedAt(revision.createdAt)}
          </span>
        </div>
        <div className="reading-history__version-actions">
          <ActionLink
            href={`/reading/newdata-reading?revision=${revision.id}`}
            tone="secondary"
            className="reading-history__action"
          >
            เปิดดู
          </ActionLink>
          <button
            type="button"
            className="reading-history__action reading-history__action--restore"
            disabled={isRestoring}
            onClick={() => void handleRestoreNewdataRevision(revision.id, revision.readingId)}
          >
            {isRestoring ? "กำลังกู้คืน..." : "กู้คืน"}
          </button>
          <button
            type="button"
            className="reading-history__delete"
            disabled={isDeleting}
            onClick={() => void handleDeleteNewdataRevision(revision.id)}
          >
            {isDeleting ? "กำลังลบ..." : "ลบ"}
          </button>
        </div>
      </li>
    );
  }

  const inProgressCount = records.filter((record) => record.status === "in_progress").length;
  const doneCount = records.filter((record) => record.status === "done").length;

  return (
    <section className="workspace-stack">
      <Surface as="section" inset className="message-card reading-history__hero">
        <SectionHeading
          kicker="ประวัติการดูดวง"
          title="บันทึกการดูดวง — เปิดแก้ต่อ ปริ้นซ้ำ หรือฝากคนอื่นแก้"
          titleLevel="h2"
          note="ทุกครั้งที่กด ‘บันทึกการดูดวง’ ในหน้าอ่านดวง เคสนั้นจะมาอยู่ที่นี่ เปิดกลับมาแก้ต่อ ปริ้นเป็น PDF/.docx ซ้ำ หรือส่งต่อให้ซินแสคนอื่นแก้ได้จากเครื่องไหนก็ได้ที่เปิดระบบเดียวกัน"
        />
        <div className="reading-history__hero-meta">
          <Badge>ทั้งหมด {records.length}</Badge>
          <Badge tone="ai">กำลังแก้ {inProgressCount}</Badge>
          <Badge>เสร็จแล้ว {doneCount}</Badge>
          <ActionLink href="/reading" tone="primary" className="reading-history__new">
            + เริ่มดูดวงใหม่
          </ActionLink>
          {doneCount > 0 ? (
            <a
              href="/api/reading/export-done"
              download="done-readings.json"
              className="reading-history__new reading-history__export"
            >
              ⭳ ดาวน์โหลด dataset (เสร็จสิ้น {doneCount})
            </a>
          ) : null}
        </div>
      </Surface>

      {unavailable ? (
        <Surface as="section" inset className="empty-state reading-history__empty">
          <p className="section-kicker">ยังไม่พร้อมใช้งาน</p>
          <h3>ยังไม่ได้ตั้งค่าฐานข้อมูล</h3>
          <p>
            ประวัติการดูดวงจะใช้งานได้เมื่อเชื่อมต่อ DATABASE_URL แล้ว — การผูกดวงและปริ้นในหน้าอ่านดวงยังใช้ได้ตามปกติ
          </p>
        </Surface>
      ) : records.length === 0 ? (
        <Surface as="section" inset className="empty-state reading-history__empty">
          <p className="section-kicker">ยังไม่มีบันทึก</p>
          <h3>ยังไม่มีประวัติการดูดวง</h3>
          <p>
            ไปที่หน้าอ่านดวง ผูกดวงและอ่านคำทำนาย แล้วกด ‘บันทึกการดูดวง’ เคสนั้นจะมาแสดงที่นี่ให้กลับมาแก้ต่อหรือปริ้นซ้ำได้
          </p>
          <ActionLink href="/reading" tone="primary" className="reading-history__new">
            ไปหน้าอ่านดวง
          </ActionLink>
        </Surface>
      ) : (
        <Surface as="section" inset className="reading-history" aria-label="ประวัติการดูดวง">
          <div className="reading-history__list">
            {records.map((record) => {
              const title = record.label?.trim() || record.id.slice(0, 8);
              const birthMoment = formatThaiBirthMoment(record.birthDate, record.birthTime);
              const isDeleting = deletingId === record.id;
              const recordVersions = versionsBySession.get(record.id) ?? [];
              const recordRevisions = revisionsBySession.get(record.id) ?? [];

              return (
                <article key={record.id} className="reading-history__row">
                  <div className="reading-history__main">
                    <div className="reading-history__badges">
                      <Badge
                        className={
                          record.status === "done"
                            ? "reading-history__status reading-history__status--done"
                            : "reading-history__status reading-history__status--progress"
                        }
                      >
                        {record.status === "done" ? "เสร็จแล้ว" : "กำลังแก้"}
                      </Badge>
                      {GENDER_LABEL[record.gender] ? <Badge>{GENDER_LABEL[record.gender]}</Badge> : null}
                      <Badge>{PROVIDER_LABEL[record.provider] ?? record.provider}</Badge>
                    </div>

                    <div className="reading-history__identity">
                      <strong>{title}</strong>
                      {record.label?.trim() ? <span>รหัสย่อ {record.id.slice(0, 8)}</span> : null}
                      <span>{birthMoment}</span>
                      {record.dayMaster ? <span>ดิถี {record.dayMaster}</span> : null}
                    </div>
                  </div>

                  <div className="reading-history__meta">
                    <span className="reading-history__updated">
                      อัปเดตล่าสุด {formatUpdatedAt(record.updatedAt)}
                    </span>
                    <div className="reading-history__actions">
                      <ActionLink
                        href={`/reading?session=${record.id}`}
                        tone="primary"
                        className="reading-history__action"
                      >
                        เปิด/แก้ต่อ
                      </ActionLink>
                      <ActionLink
                        href={`/reading?session=${record.id}&print=1`}
                        tone="secondary"
                        className="reading-history__action"
                      >
                        ปริ้น/PDF
                      </ActionLink>
                      <button
                        type="button"
                        className={
                          record.status === "done"
                            ? "reading-history__action reading-history__toggle reading-history__toggle--reopen"
                            : "reading-history__action reading-history__toggle reading-history__toggle--done"
                        }
                        disabled={togglingId === record.id}
                        onClick={() => void handleToggleStatus(record.id, record.status)}
                      >
                        {togglingId === record.id
                          ? "กำลังบันทึก..."
                          : record.status === "done"
                            ? "กลับไปแก้ต่อ"
                            : "✓ เสร็จสิ้น"}
                      </button>
                      <button
                        type="button"
                        className="reading-history__delete"
                        disabled={isDeleting}
                        onClick={() => void handleDelete(record.id, title, recordVersions.length)}
                      >
                        {isDeleting ? "กำลังลบ..." : "ลบ"}
                      </button>
                    </div>
                  </div>

                  {recordVersions.length > 0 ? (
                    <details className="reading-history__versions" open>
                      <summary className="reading-history__versions-title">
                        เวอร์ชัน PDF ที่บันทึก ({recordVersions.length})
                      </summary>
                      <ul className="reading-history__version-list">
                        {recordVersions.map((version) => renderVersionItem(version))}
                      </ul>
                    </details>
                  ) : null}

                  {recordRevisions.length > 0 ? (
                    <details className="reading-history__versions reading-history__revisions">
                      <summary className="reading-history__versions-title">
                        ประวัติการบันทึก ({recordRevisions.length}) — ทุกครั้งที่กด ‘บันทึกการดูดวง’ เก็บไว้ย้อนดู/กู้คืนได้
                      </summary>
                      <ul className="reading-history__version-list">
                        {recordRevisions.map((revision) => renderRevisionItem(revision))}
                      </ul>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        </Surface>
      )}

      {!unavailable && newdataReadings.length > 0 ? (
        <Surface as="section" inset className="reading-history" aria-label="ประวัติอ่าน 15 บท (NewData)">
          <SectionHeading
            kicker="อ่าน 15 บท (NewData)"
            title="ดวงที่บันทึกจากหน้า ‘อ่าน 15 บท’"
            titleLevel="h3"
            note="ดวงที่กด ‘บันทึกดวงนี้’ ในหน้าอ่าน 15 บท — เปิดกลับมาแก้คำทำนายต่อ หรือปริ้น PDF ซ้ำได้"
          />
          <div className="reading-history__list">
            {newdataReadings.map((item) => {
              const title = item.clientName?.trim() || item.id.slice(0, 8);
              const birthMoment = formatThaiBirthMoment(item.birthDate, item.birthTime);
              const isDeleting = deletingNewdataId === item.id;
              const itemRevisions = newdataRevisionsByReading.get(item.id) ?? [];
              return (
                <article key={item.id} className="reading-history__row">
                  <div className="reading-history__main">
                    <div className="reading-history__badges">
                      <Badge
                        className={
                          item.status === "done"
                            ? "reading-history__status reading-history__status--done"
                            : "reading-history__status reading-history__status--progress"
                        }
                      >
                        {item.status === "done" ? "เสร็จแล้ว" : "กำลังแก้"}
                      </Badge>
                      <Badge tone="ai">อ่าน 15 บท</Badge>
                      {GENDER_LABEL[item.gender] ? <Badge>{GENDER_LABEL[item.gender]}</Badge> : null}
                    </div>
                    <div className="reading-history__identity">
                      <strong>{title}</strong>
                      <span>{birthMoment}</span>
                    </div>
                  </div>
                  <div className="reading-history__meta">
                    <span className="reading-history__updated">
                      อัปเดตล่าสุด {formatUpdatedAt(item.updatedAt)}
                    </span>
                    <div className="reading-history__actions">
                      <ActionLink
                        href={`/reading/newdata-reading?session=${item.id}`}
                        tone="primary"
                        className="reading-history__action"
                      >
                        เปิด/แก้ต่อ
                      </ActionLink>
                      <button
                        type="button"
                        className={
                          item.status === "done"
                            ? "reading-history__action reading-history__toggle reading-history__toggle--reopen"
                            : "reading-history__action reading-history__toggle reading-history__toggle--done"
                        }
                        disabled={togglingNewdataId === item.id}
                        onClick={() => void handleToggleNewdataStatus(item.id, item.status)}
                      >
                        {togglingNewdataId === item.id
                          ? "กำลังบันทึก..."
                          : item.status === "done"
                            ? "กลับไปแก้ต่อ"
                            : "✓ เสร็จสิ้น"}
                      </button>
                      <button
                        type="button"
                        className="reading-history__delete"
                        disabled={isDeleting}
                        onClick={() => void handleDeleteNewdata(item.id, title)}
                      >
                        {isDeleting ? "กำลังลบ..." : "ลบ"}
                      </button>
                    </div>
                  </div>

                  {itemRevisions.length > 0 ? (
                    <details className="reading-history__versions reading-history__revisions">
                      <summary className="reading-history__versions-title">
                        ประวัติการบันทึก ({itemRevisions.length}) — ทุกครั้งที่กด ‘บันทึกดวงนี้’ เก็บไว้ย้อนดู/กู้คืนได้
                      </summary>
                      <ul className="reading-history__version-list">
                        {itemRevisions.map((revision) => renderNewdataRevisionItem(revision))}
                      </ul>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        </Surface>
      ) : null}

      {!unavailable && orphanVersions.length > 0 ? (
        <Surface as="section" inset className="reading-history" aria-label="เวอร์ชันที่ไม่มีดวงต้นทาง">
          <SectionHeading
            kicker="เวอร์ชัน PDF"
            title="เวอร์ชันที่ไม่มีดวงต้นทาง"
            titleLevel="h3"
            note="เวอร์ชันเหล่านี้ดวงต้นทางถูกลบไปแล้ว แต่ยังเปิดแก้/ปริ้นจากสแน็ปช็อตที่บันทึกไว้ได้"
          />
          <ul className="reading-history__version-list">
            {orphanVersions.map((version) => renderVersionItem(version, true))}
          </ul>
        </Surface>
      ) : null}
    </section>
  );
}
