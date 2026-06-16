import { AlmanacWorkspace } from "@/components/bazi/almanac/AlmanacWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export const metadata = {
  title: "ปฏิทินโหราศาสตร์ | Bazi Trainer",
  description: "ปฏิทินโหราศาสตร์รายวัน (ดิถีจีน) รองรับทุกปี อดีต/อนาคต + ดาวน์โหลด Excel",
};

export default function AlmanacPage() {
  return (
    <main className="page-shell">
      <SystemHeader
        statusCopy={{
          tone: "ready",
          label: "ปฏิทินโหราศาสตร์",
          detail: "ดิถีรายวัน เสาวัน/เดือน/ปี + ดิถี เทพ สีมงคล ทิศ — เลือกได้ทุกปี และโหลดเป็น Excel",
        }}
      />
      <AlmanacWorkspace />
    </main>
  );
}
