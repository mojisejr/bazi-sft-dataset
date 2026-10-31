import { ScoreAuditWorkspace } from "@/components/bazi/score-audit/ScoreAuditWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function ScoreAuditPage() {
  return (
    <main className="page-shell">
      <SystemHeader statusCopy={{ tone: "ready", label: "ตรวจคะแนน", detail: "ดูที่มาของค่าพลัง 4 ด้าน และคะแนนปฏิทินรายวัน" }} />
      <ScoreAuditWorkspace />
    </main>
  );
}
