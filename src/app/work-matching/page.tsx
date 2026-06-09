import { WorkMatchingWorkspace } from "@/components/bazi/pair/WorkMatchingWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function WorkMatchingPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "เปรียบเทียบการงาน · คู่สมพงษ์",
          detail: "กรอกเรา + หุ้นส่วน/ลูกน้อง สูงสุด 3 คน แล้วจัดอันดับว่าใครเข้ากับเราดีที่สุด",
        }}
      />
      <WorkMatchingWorkspace />
    </main>
  );
}
