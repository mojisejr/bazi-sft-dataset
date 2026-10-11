import { LuckyDrawWorkspace, type DrawCard } from "@/components/bazi/lucky-draw/LuckyDrawWorkspace";
import { getAllCards } from "@/lib/bazi/fengshui/deck";
import enJson from "@/lib/bazi/data/fengshui-cards.en.json";

export const metadata = {
  title: "ไพ่อาถรรพ์ฮวงจุ้ย — หน้าจั่วหลังบ้าน",
};

/** หน้าหลังบ้าน: จั่วไพ่อาถรรพ์ฮวงจุ้ยเคี้ยงคุง (78 ใบ) ทีละใบ — ซินแสนุ้ย 2026-09-28 */
export default function FengshuiPage() {
  const deck: DrawCard[] = getAllCards().map((c) => ({
    no: c.no,
    name: c.name,
    imageUrl: c.imageUrl ?? null,
    fields: [
      { label: "ความหมาย", value: c.meaning },
      { label: "ข้อควรระวัง", value: c.caution },
      { label: "คำแนะนำแก้ไข", value: c.advice },
    ],
  }));
  // ฉบับอังกฤษ (ซินแสนุ้ย 2026-10-07; พี่โบตรวจสำนวน) — รูปเดียวกัน
  const byNo = new Map(getAllCards().map((c) => [c.no, c]));
  const deckEn: DrawCard[] = (enJson as { no: number; name: string; meaning: string; caution: string; advice: string }[]).map((c) => ({
    no: c.no,
    name: c.name,
    imageUrl: byNo.get(c.no)?.imageUrl ?? null,
    fields: [
      { label: "Meaning", value: c.meaning },
      { label: "Caution", value: c.caution },
      { label: "Remedy", value: c.advice },
    ],
  }));
  return (
    <main style={{ padding: "24px 16px" }}>
      <LuckyDrawWorkspace
        title="🧭 ไพ่อาถรรพ์ฮวงจุ้ยเคี้ยงคุง"
        subtitle="78 ใบ (เลข 1-78) · กดเปิดทีละใบ ไม่ซ้ำจนหมดสำรับ · หน้าหลังบ้าน"
        deck={deck}
        deckEn={deckEn}
      />
    </main>
  );
}
