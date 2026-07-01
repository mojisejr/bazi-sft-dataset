import { OracleCardsWorkspace } from "@/components/bazi/oracle-cards/OracleCardsWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function OracleCardsPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "ไพ่ออราเคิลเคี้ยงคุง",
          detail: "ไพ่ออราเคิลเคี้ยงคุง — จั่ว/เลือก 3 ใบ ทำนายตามหลักน้ำหนัก",
        }}
      />
      <OracleCardsWorkspace />
    </main>
  );
}
