import type { Metadata } from "next";

import { WhatIfExperience } from "@/components/bazi/what-if/WhatIfExperience";

const TITLE = "What If...? — โลกคู่ขนานของคุณ | Mumate";
const DESCRIPTION =
  "ถ้าวันนั้นคุณเลือกเดินตามดวงชะตา... วันนี้ชีวิตคุณจะเป็นอย่างไรในจักรวาลคู่ขนาน? กรอกวันเกิด + อาชีพ แล้วเปิดประตูมิติไปดูตัวคุณอีกเวอร์ชัน";

// OG/Twitter card — ให้ลิงก์ที่แชร์ไป FB/LINE/X ขึ้นพรีวิวสวย (ทำงานเมื่ออยู่บนโดเมนจริง ไม่ใช่ localhost)
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "Mumate",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function WhatIfPage() {
  return (
    <main className="whatif-shell">
      <WhatIfExperience />
    </main>
  );
}
