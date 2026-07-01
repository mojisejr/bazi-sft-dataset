import { ManVsDayWorkspace } from "@/components/bazi/manvsday/ManVsDayWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function ManVsDayPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "ดวงกับวัน · Man Vs Day",
          detail: "ดูว่าวันนี้/วันที่เลือกเป็นอย่างไรกับดวงเจ้าของ อิงศาสตร์ปฏิทินจริง",
        }}
      />
      <ManVsDayWorkspace />
    </main>
  );
}
