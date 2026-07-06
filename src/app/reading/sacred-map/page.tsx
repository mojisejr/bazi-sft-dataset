import { SacredMapAdminWorkspace } from "@/components/bazi/reading/SacredMapAdminWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export const dynamic = "force-dynamic";

export default function ReadingSacredMapPage() {
  return (
    <main className="trainer-page">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "ข้อมูล Sacred Map",
          detail: "แอดมินจัดการสถานที่ศักดิ์สิทธิ์ + ตรวจสถานที่ที่ผู้ใช้เสนอ",
        }}
      />
      <SacredMapAdminWorkspace />
    </main>
  );
}
