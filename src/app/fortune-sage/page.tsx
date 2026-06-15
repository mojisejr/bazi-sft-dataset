import { FortuneSageWorkspace } from "@/components/bazi/fortune-sage/FortuneSageWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function FortuneSagePage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "เซียนเสี่ยงทาย",
          detail: "เสี่ยงทายสไตล์เซียมซี — สุ่ม 1 ใน 60 หัวเซี่ยงแซ ตอบตามนั้น",
        }}
      />
      <FortuneSageWorkspace />
    </main>
  );
}
