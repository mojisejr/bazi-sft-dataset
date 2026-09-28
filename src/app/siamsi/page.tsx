import { LuckyDrawWorkspace, type DrawCard } from "@/components/bazi/lucky-draw/LuckyDrawWorkspace";
import { getAllCards } from "@/lib/bazi/siamsi-kiangkung/deck";

export const metadata = {
  title: "ไพ่เซียมซีเคี้ยงคุง — หน้าจั่วหลังบ้าน",
};

/** หน้าหลังบ้าน: จั่วไพ่เซียมซีเคี้ยงคุง (80 ใบ) ทีละใบ — ซินแสนุ้ย 2026-09-28 */
export default function SiamsiPage() {
  const deck: DrawCard[] = getAllCards().map((c) => ({
    no: c.no,
    name: c.name,
    fields: [
      { label: "แก่นของไพ่", value: c.theme },
      { label: "สถานการณ์", value: c.situation },
      { label: "ข้อควรระวัง", value: c.caution },
      { label: "คำแนะนำ", value: c.advice },
    ],
  }));
  return (
    <main style={{ padding: "24px 16px" }}>
      <LuckyDrawWorkspace
        title="🎴 ไพ่เซียมซีเคี้ยงคุง"
        subtitle="80 ใบ (เลข 1-80) · กดเปิดทีละใบ ไม่ซ้ำจนหมดสำรับ · หน้าหลังบ้าน"
        deck={deck}
        accent="#2e7d5b"
      />
    </main>
  );
}
