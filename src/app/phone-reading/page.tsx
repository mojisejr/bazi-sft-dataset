import { PhoneReadingWorkspace } from "@/components/bazi/phone/PhoneReadingWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export default function PhoneReadingPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "ทำนายชีวิตด้วยเบอร์มือถือ · เลขพยากรณ์",
          detail: "ใส่เบอร์มือถือ อ่านคำทำนายจากคู่เลขติดกันตามตำราเลขพยากรณ์ ครูเอก",
        }}
      />
      <PhoneReadingWorkspace />
    </main>
  );
}
