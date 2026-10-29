import { NineGatesWorkspace } from "@/components/bazi/nine-gates/NineGatesWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function NineGatesPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "เก้าประตู เปิดชะตา",
          detail: "ทอยดิถี/ตำแหน่ง/開 ตามผังหลอซู แล้วเปิดไพ่ 9 ประตู (ซินแสนุ้ย · layer 1)",
        }}
      />
      <NineGatesWorkspace />
    </main>
  );
}
