import { DivineCardsWorkspace } from "@/components/bazi/divine-cards/DivineCardsWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function DivineCardsPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "โหมดเซียน",
          detail: "ไพ่จิตวิญญาณแดนสวรรค์ — จั่ว/เลือก 3 ใบ ทำนายตามหลักน้ำหนัก",
        }}
      />
      <DivineCardsWorkspace />
    </main>
  );
}
