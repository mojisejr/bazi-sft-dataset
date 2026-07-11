import { LoveMatchWorkspace } from "@/components/bazi/matchmaker/LoveMatchWorkspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export const metadata = {
  title: "จับคู่สมพงษ์ · ปัดหาเนื้อคู่",
  description: "ปัดซ้ายปัดขวาหาคู่ที่ดวงสมพงษ์เข้ากัน พร้อมเกรดสมพงษ์รายคู่",
};

export default function LoveMatchPage() {
  return (
    <main className="page-shell">
      <SystemHeader />
      <LoveMatchWorkspace />
    </main>
  );
}
