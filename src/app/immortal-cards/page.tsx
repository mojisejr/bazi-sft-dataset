import { ImmortalCardsWorkspace } from "@/components/bazi/immortal-cards/ImmortalCardsWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function ImmortalCardsPage() {
  return (
    <main className="page-shell">
      <SystemHeader statusCopy={{ tone: "ready", label: "ไพ่เทพเซียน", detail: "เซียมซี 8 เซียน (ใบเดียว) · ไพ่ออราเคิลเทพเซียน 3 ใบ 50/30/20" }} />
      <ImmortalCardsWorkspace />
    </main>
  );
}
