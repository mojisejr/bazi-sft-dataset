"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionLink } from "@/components/bazi/primitives/Action";
import { Badge } from "@/components/bazi/primitives/Badge";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import type { ReadingSessionListItem } from "@/lib/bazi/reading-sessions";

type ReadingHistoryWorkspaceProps = {
  records: ReadingSessionListItem[];
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
  unavailable = false,
}: ReadingHistoryWorkspaceProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string, title: string) {
    if (typeof window !== "undefined" && !window.confirm(`ลบประวัติการดูดวง "${title}" ?`)) {
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
                        onClick={() => void handleDelete(record.id, title)}
                      >
                        {isDeleting ? "กำลังลบ..." : "ลบ"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Surface>
      )}
    </section>
  );
}
