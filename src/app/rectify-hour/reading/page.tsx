// สอบยามจากคำทำนาย (v3) deep link — mount hub รวมโหมดโดยเปิดแท็บ reading ไว้ให้
// (#hour-rectification-engine). ผู้ใช้สลับไปโหมดอื่นได้จากแท็บ
import { RectifyHourHub } from "@/lib/bazi/hour-rectification/ui/RectifyHourHub";

export const metadata = {
  title: "สอบยามจากคำทำนาย · internal",
};

export default function RectifyHourReadingPage() {
  return (
    <main className="page-shell rectify-hour-page">
      <RectifyHourHub initialMode="reading" />
    </main>
  );
}
