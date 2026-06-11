"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { PagedPreview } from "@/components/bazi/reading/PagedPreview";

/**
 * มินิพรีวิว "หน้าจริงใน PDF" ของเอกสารที่ส่งมาเป็น children (บทเดียว/บทเสริม) —
 * paged.js จัดหน้า A4 จริงแล้วย่อแสดง ให้ผู้ใช้เห็นว่า PDF แบ่งเป็นกี่หน้า/แบ่งตรงไหน
 *
 * สำคัญ: paged.js วัดด้วย getBoundingClientRect — ถ้าย่อด้วย zoom "ระหว่าง" จัดหน้า จะวัดเพี้ยน
 * (under-paginate). จึงจัดหน้าที่ scale 1:1 ก่อน แล้วค่อยใส่ zoom ย่อ "หลัง" paged.js เสร็จ
 * default = พอดีกรอบ (คอลัมน์ ÷ ความกว้าง A4) + ปุ่ม −/+ ปรับเอง
 *
 * parent ควร key ด้วย chapterId (+refresh) เพื่อให้ paged.js รันใหม่ตอนสลับบท/กดอัปเดต
 */
export function ChapterPagePreview({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // null = ยังไม่ scale (กำลัง render 1:1 ให้ paged.js วัดถูก) · number = zoom หลังเสร็จ
  const [zoom, setZoom] = useState<number | null>(null);

  // รอ paged.js เสร็จ → คำนวณ zoom พอดีกรอบ แล้วค่อยย่อ
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const done = () => Boolean(el.querySelector(".pagedjs_page")) && !el.querySelector(".ylc-preview__loading");
    let id: ReturnType<typeof setInterval> | null = null;
    const fit = () => {
      const page = el.querySelector<HTMLElement>(".pagedjs_page");
      if (!page) return;
      const pageW = page.getBoundingClientRect().width; // วัดตอน 1:1
      const colW = el.clientWidth - 8;
      setZoom(pageW > 0 ? Math.min(1, colW / pageW) : 0.32);
    };
    const tick = () => {
      if (done()) {
        fit();
        if (id) clearInterval(id);
      }
    };
    id = setInterval(tick, 300);
    const t = setTimeout(tick, 0);
    return () => {
      if (id) clearInterval(id);
      clearTimeout(t);
    };
  }, []);

  const adjust = (factor: number) => setZoom((z) => Math.min(1.5, Math.max(0.12, (z ?? 0.32) * factor)));
  const refit = () => {
    const page = ref.current?.querySelector<HTMLElement>(".pagedjs_page");
    const el = ref.current;
    if (!page || !el) return;
    const pageW = page.getBoundingClientRect().width / (zoom ?? 1); // คืนเป็น 1:1 ก่อนคำนวณ
    setZoom(pageW > 0 ? Math.min(1, (el.clientWidth - 8) / pageW) : 0.32);
  };

  return (
    <div ref={ref} className="ylc-mini-preview">
      <div className="ylc-mini-preview__zoom">
        <button type="button" onClick={() => adjust(0.85)} aria-label="ย่อ">
          −
        </button>
        <button type="button" onClick={refit}>
          พอดีกรอบ
        </button>
        <button type="button" onClick={() => adjust(1.18)} aria-label="ขยาย">
          +
        </button>
      </div>
      <div className="ylc-mini-preview__scale" style={zoom != null ? { zoom } : undefined}>
        <PagedPreview>{children}</PagedPreview>
      </div>
    </div>
  );
}
