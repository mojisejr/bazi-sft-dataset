import { MatchingAdminWorkspace } from "@/components/bazi/reading/MatchingAdminWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

// แก้ live + อ่านสดจาก DB ทุกครั้ง
export const dynamic = "force-dynamic";

export default function ReadingMatchingPage() {
  return (
    <main className="trainer-page">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "ข้อมูล Matching (คำทำนายจับคู่)",
          detail: "ซินแสแก้/เพิ่มคำทำนายที่ใช้บนหน้าจับคู่ (สมพงษ์)",
        }}
      />
      <MatchingAdminWorkspace />
    </main>
  );
}
