import { LuckyDrawWorkspace, type DrawCard } from "@/components/bazi/lucky-draw/LuckyDrawWorkspace";
import { getAllCards } from "@/lib/bazi/fengshui/deck";

export const metadata = {
  title: "ไพ่อาถรรพ์ฮวงจุ้ย — หน้าจั่วหลังบ้าน",
};

/** หน้าหลังบ้าน: จั่วไพ่อาถรรพ์ฮวงจุ้ยเคี้ยงคุง (78 ใบ) ทีละใบ — ซินแสนุ้ย 2026-09-28 */
export default function FengshuiPage() {
  const deck: DrawCard[] = getAllCards().map((c) => ({
    no: c.no,
    name: c.name,
    fields: [
      { label: "ความหมาย", value: c.meaning },
      { label: "ข้อควรระวัง", value: c.caution },
      { label: "คำแนะนำแก้ไข", value: c.advice },
    ],
  }));
  return (
    <main style={{ padding: "24px 16px" }}>
      <LuckyDrawWorkspace
        title="🧭 ไพ่อาถรรพ์ฮวงจุ้ยเคี้ยงคุง"
        subtitle="78 ใบ (เลข 1-78) · กดเปิดทีละใบ ไม่ซ้ำจนหมดสำรับ · หน้าหลังบ้าน"
        deck={deck}
      />
    </main>
  );
}
