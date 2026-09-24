import { TarotWorkspace } from "@/components/bazi/tarot/TarotWorkspace";

export const metadata = {
  title: "ไพ่ทาโรต์วิถีเต๋า — หน้าเทสต์ภายใน",
};

/** หน้าเทสต์ภายในของฟีเจอร์ไพ่ทาโรต์วิถีเต๋า (ยังไม่ผูกแชท — ซินแสนุ้ย 2026-09-24) */
export default function TarotPage() {
  return (
    <main style={{ padding: "24px 16px" }}>
      <TarotWorkspace />
    </main>
  );
}
