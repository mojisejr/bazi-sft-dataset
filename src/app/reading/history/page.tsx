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
  let unavailable = false;

  try {
    // โหลดดวง + เวอร์ชัน PDF ที่บันทึก พร้อมกัน (ตารางคนละตาราง แต่ unavailable ร่วมกัน)
    [records, versions] = await Promise.all([
      listReadingSessions(),
      listReadingPdfVersions(),
    ]);
  } catch {
    // ไม่มี DATABASE_URL / ตารางยังไม่พร้อม — แสดงสถานะ "ยังไม่พร้อม" แทนการพัง
    unavailable = true;
  }

  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={readingHistoryStatusCopy} />
      <ReadingHistoryWorkspace records={records} versions={versions} unavailable={unavailable} />
    </main>
  );
}
