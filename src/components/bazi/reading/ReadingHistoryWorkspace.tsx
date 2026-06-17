"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionLink } from "@/components/bazi/primitives/Action";
import { Badge } from "@/components/bazi/primitives/Badge";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import type { ReadingSessionListItem } from "@/lib/bazi/reading-sessions";
import type { ReadingPdfVersionListItem } from "@/lib/bazi/reading-pdf-versions";

type ReadingHistoryWorkspaceProps = {
  records: ReadingSessionListItem[];
  versions?: ReadingPdfVersionListItem[];
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
  unavailable = false,
}: ReadingHistoryWorkspaceProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);

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
                        className="reading-history__delete"
                        disabled={isDeleting}
                        onClick={() => void handleDelete(record.id, title, recordVersions.length)}
                      >
                        {isDeleting ? "กำลังลบ..." : "ลบ"}
                      </button>
                    </div>
                  </div>

                  {recordVersions.length > 0 ? (
                    <div className="reading-history__versions">
                      <span className="reading-history__versions-title">
                        เวอร์ชัน PDF ที่บันทึก ({recordVersions.length})
                      </span>
                      <ul className="reading-history__version-list">
                        {recordVersions.map((version) => renderVersionItem(version))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </Surface>
      )}

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
