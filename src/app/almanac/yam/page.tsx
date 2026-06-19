import { HourCheckWorkspace } from "@/components/bazi/almanac/HourCheckWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export const metadata = {
  title: "ตรวจยาม (จับยาม) | Bazi Trainer",
  description: "ตรวจคุณภาพยาม (黃道) รายชั่วโมงของวันที่เลือก — วิชาจับยาม แยกจากปฏิทินรายเดือน",
};

export default function YamPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "ตรวจยาม (จับยาม)",
          detail: "เลือกวัน + เวลา แล้วดูคุณภาพยาม (黃道) ของชั่วโมงนั้น",
        }}
      />
      <HourCheckWorkspace />
    </main>
  );
}
