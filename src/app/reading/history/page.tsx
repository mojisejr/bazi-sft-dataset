import { ReadingHistoryWorkspace } from "@/components/bazi/reading/ReadingHistoryWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";
import {
  listReadingSessions,
  type ReadingSessionListItem,
} from "@/lib/bazi/reading-sessions";
import {
  listReadingPdfVersions,
  type ReadingPdfVersionListItem,
} from "@/lib/bazi/reading-pdf-versions";
import {
  listReadingSessionRevisions,
  type ReadingSessionRevisionListItem,
} from "@/lib/bazi/reading-session-revisions";
import { createDbNewdataReadingRepository } from "@/lib/bazi/newdata-reading-repository";
import type { NewdataReadingHistoryItem } from "@/components/bazi/reading/ReadingHistoryWorkspace";

// ดึงข้อมูลสดเสมอ (กัน static cache) + ให้ router.refresh() หลังลบเห็นผลทันที
export const dynamic = "force-dynamic";

const readingHistoryStatusCopy = {
  tone: "ready",
  label: "ประวัติการดูดวง",
  detail: "บันทึกการดูดวงที่ทำค้างไว้ — เปิดแก้ต่อ ปริ้นซ้ำ หรือฝากคนอื่นแก้",
} as const;

export default async function ReadingHistoryPage() {
  let records: ReadingSessionListItem[] = [];
  let versions: ReadingPdfVersionListItem[] = [];
  let revisions: ReadingSessionRevisionListItem[] = [];
  let newdataReadings: NewdataReadingHistoryItem[] = [];
  let unavailable = false;

  try {
    // โหลดดวง + เวอร์ชัน PDF + ประวัติการบันทึก + ดวง "อ่าน 15 บท (NewData)" พร้อมกัน (คนละตาราง แต่ unavailable ร่วมกัน)
    const [sessions, pdfVersions, sessionRevisions, newdataRows] = await Promise.all([
      listReadingSessions(),
      listReadingPdfVersions(),
      listReadingSessionRevisions(),
      createDbNewdataReadingRepository().list(),
    ]);
    records = sessions;
    versions = pdfVersions;
    revisions = sessionRevisions;
    newdataReadings = newdataRows.map((row) => ({
      id: row.id,
      clientName: row.clientName,
      birthDate: row.birthDate,
      birthTime: row.birthTime,
      gender: row.gender,
      updatedAt: row.updatedAt.toISOString(),
    }));
  } catch {
    // ไม่มี DATABASE_URL / ตารางยังไม่พร้อม — แสดงสถานะ "ยังไม่พร้อม" แทนการพัง
    unavailable = true;
  }

  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={readingHistoryStatusCopy} />
      <ReadingHistoryWorkspace
        records={records}
        versions={versions}
        revisions={revisions}
        newdataReadings={newdataReadings}
        unavailable={unavailable}
      />
    </main>
  );
}
