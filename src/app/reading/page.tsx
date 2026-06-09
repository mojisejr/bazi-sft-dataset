import { ReadingPathWorkspace } from "@/components/bazi/reading/ReadingPathWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function ReadingPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "Stepwise Path Reading",
          detail: "อ่านดวงทีละหัวข้อจาก engine truth พร้อมเลือกเรียบเรียงด้วย LLM",
        }}
      />
      <ReadingPathWorkspace />
    </main>
  );
}
