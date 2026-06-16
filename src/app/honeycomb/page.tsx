import { HoneycombWorkspace } from "@/components/bazi/honeycomb/HoneycombWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function HoneycombPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "เบอร์รังผึ้ง",
          detail: "เบอร์ปิรามิด (สามเหลี่ยมปาสคาล) — อ่านพลังงานเบอร์รายชั้น 11 ชั้น",
        }}
      />
      <HoneycombWorkspace />
    </main>
  );
}
