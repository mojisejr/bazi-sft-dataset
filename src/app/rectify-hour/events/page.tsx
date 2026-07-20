// สอบยามจากเหตุการณ์ (v2) deep link — mount hub รวมโหมดโดยเปิดแท็บ events ไว้ให้
// (#hour-rectification-engine). ลิงก์เก่าที่ชี้มาที่นี่ยังใช้ได้ และผู้ใช้สลับไปโหมดอื่นได้จากแท็บ
import { RectifyHourHub } from "@/lib/bazi/hour-rectification/ui/RectifyHourHub";

export const metadata = {
  title: "สอบยามจากเหตุการณ์ชีวิต · internal",
};

export default function RectifyHourEventsPage() {
  return (
    <main className="page-shell rectify-hour-page">
      <RectifyHourHub initialMode="events" />
    </main>
  );
}
