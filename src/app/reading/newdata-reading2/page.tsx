import { NewdataReadingWorkspace2 } from "@/components/bazi/reading/NewdataReadingWorkspace2";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export const dynamic = "force-dynamic";

export default function NewdataReading2Page() {
  return (
    <main className="trainer-page">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "อ่านดวงทีละบท (Louise Hay)",
          detail: "15 บท ข้อมูลเดิม แต่ให้ AI โค้ชฮีลใจเล่าด้วยน้ำเสียงอบอุ่น — แก้รายบทแล้วพิมพ์ PDF",
        }}
      />
      <NewdataReadingWorkspace2 />
    </main>
  );
}
