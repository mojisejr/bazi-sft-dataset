import { NewdataReadingWorkspace } from "@/components/bazi/reading/NewdataReadingWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export const dynamic = "force-dynamic";

export default function NewdataReadingPage() {
  return (
    <main className="trainer-page">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "อ่านดวงทีละบท (NewData)",
          detail: "15 บท ขับด้วยคำอ่านชุดใหม่ของซินแส — แก้รายบทแล้วพิมพ์ PDF",
        }}
      />
      <NewdataReadingWorkspace />
    </main>
  );
}
