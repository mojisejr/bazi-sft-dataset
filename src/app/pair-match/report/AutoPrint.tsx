"use client";

import { useEffect } from "react";

/** แถบปุ่มพิมพ์ของหน้า report + สั่งพิมพ์อัตโนมัติเมื่อเปิดด้วย ?print=1. */
export function AutoPrint({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    // หน่วงให้ฟอนต์/เลย์เอาต์เสร็จก่อนเปิด dialog พิมพ์
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <div className="pair-report-toolbar">
      <button type="button" onClick={() => window.print()}>
        🖨️ บันทึกเป็น PDF / พิมพ์
      </button>
    </div>
  );
}
