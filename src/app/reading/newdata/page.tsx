import { NewdataAdminWorkspace } from "@/components/bazi/reading/NewdataAdminWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

// แก้ live + อ่านสดจาก DB ทุกครั้ง
export const dynamic = "force-dynamic";

export default function ReadingNewdataPage() {
  return (
    <main className="trainer-page">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "ข้อมูลหลักแบบใหม่ (NewData)",
          detail: "ซินแสแก้/เพิ่มคำอ่านชุดใหม่ที่ engine ใช้ทาย 15 บท",
        }}
      />
      <NewdataAdminWorkspace />
    </main>
  );
}
