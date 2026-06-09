import { PairMatchingWorkspace } from "@/components/bazi/pair/PairMatchingWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function PairMatchingPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "เปรียบเทียบคู่รัก 2 คน · คู่สมพงษ์",
          detail: "จับคู่หลักวันแบบแม่นตามตำรา ด้านความรัก พร้อมเรียบเรียงด้วย LLM",
        }}
      />
      <PairMatchingWorkspace />
    </main>
  );
}
