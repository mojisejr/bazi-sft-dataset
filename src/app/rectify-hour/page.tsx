// สอบยาม (Hour Rectification) — flow เดียวถามต่อเนื่อง (#hour-rectification-engine).
// รวมทุกชั้นในชุดคำถามเดียว: ช่วงของวัน → เหตุการณ์ชีวิต → คำถามจากคำทำนาย → รวมคะแนน
// (ตามซินแส: ไม่แยกโหมดให้ผู้ใช้เลือกเอง) — lane เดิม v1/v2/v3 ยังเข้าถึงได้ผ่าน deep link
// /rectify-hour/events และ /rectify-hour/reading (หน้า hub แบบแท็บ)
import { RectifyCombinedExperience } from "@/lib/bazi/hour-rectification/ui/RectifyCombinedExperience";

export const metadata = {
  title: "สอบยาม (Hour Rectification) · internal",
};

export default function RectifyHourPage() {
  return (
    <main className="page-shell rectify-hour-page">
      <RectifyCombinedExperience />
    </main>
  );
}
