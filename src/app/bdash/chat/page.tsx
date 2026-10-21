// /bdash/chat — แชตถามอะไร (mumate-bdash-v2-001). การ์ดหัวข้อแชตมาใน slice 4 หลังเก็บข้อมูลได้ 2-3 สัปดาห์
// (mate_ai_chat_meta เริ่มบันทึกหัวข้อตั้งแต่ slice 1 — ไม่มีข้อความที่ถาม). หน้านี้มีไว้ให้เมนูครบ 5 ตั้งแต่ตอนนี้.
import { PEOPLE_FROM } from "@/lib/bdash/features";
import { thDate } from "@/lib/bdash/view";

import { bdashMetadata, BdashShell, openBdash, type SearchParams } from "../_ui/shell";

export const dynamic = "force-dynamic";
export const metadata = bdashMetadata;

export default async function BdashChat({ searchParams }: { searchParams: SearchParams }) {
  const range = await openBdash(searchParams);
  return (
    <BdashShell active="chat" range={range} at={null}>
      <section className="bd-card">
        <h3>คนถามแชตเรื่องอะไรกัน</h3>
        <p className="bd-hint">
          ระบบเริ่มเก็บหัวข้อของแต่ละคำถามแล้วตั้งแต่ {thDate(PEOPLE_FROM)} (เก็บแค่หัวข้อ ไม่เก็บข้อความที่ถาม) · การ์ดนี้จะขึ้นเมื่อมีข้อมูลพอให้เห็นแนวโน้ม ราว 2-3 สัปดาห์
        </p>
      </section>
    </BdashShell>
  );
}
