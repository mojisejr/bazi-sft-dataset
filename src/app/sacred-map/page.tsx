import { SacredMapWorkspace } from "@/components/bazi/sacred-map/SacredMapWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function SacredMapPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "แผนที่สถานที่ศักดิ์สิทธิ์",
          detail: "Sacred Map — ค้นหาสถานที่ไหว้เทพ/ขอพร กรองตามธาตุและเรื่องที่ขอ",
        }}
      />
      <SacredMapWorkspace />
    </main>
  );
}
