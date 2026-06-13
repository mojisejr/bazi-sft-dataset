"use client";

import { ensureYlcFontsLoaded, loadPaged, PAGED_CSS } from "@/components/bazi/reading/paged-runtime";

export type ReadingPageCount = {
  /** จำนวนหน้า A4 ทั้งเอกสาร (= จำนวน .pagedjs_page) */
  total: number;
  /** จำนวนหน้าต่อบท (key = topicId หรือ "appendix") */
  perChapter: Record<string, number>;
};

/**
 * นับจำนวนหน้า A4 จริงจาก paged.js — ตรงกับ PDF/"ดูหน้าจริง"
 * รับ source = DOM ที่ render ReadingPrintDocument (default, มี data-ch-start ต่อบท) ไว้แล้ว (ซ่อน)
 * clone เนื้อหา → paged.js จัดหน้าใน container นอกจอ → นับ .pagedjs_page + map บท→หน้า
 *
 * paged.js บน branch นี้ช้า/อาจค้างบางดวง → มี timeout; เรียกแบบ on-demand เท่านั้น
 */
export async function countReadingPages(
  source: HTMLElement,
  { timeoutMs = 25000 }: { timeoutMs?: number } = {},
): Promise<ReadingPageCount> {
  const Paged = await loadPaged();
  await ensureYlcFontsLoaded(); // กันจำนวนหน้าเพี้ยนจากฟอนต์ยังไม่โหลด
  const doc = source.querySelector(".ylc-doc") ?? source;
  const content = doc.cloneNode(true) as HTMLElement;

  const target = document.createElement("div");
  // นอกจอแต่ "มองเห็น" + ไม่กำหนด width (ให้ paged.js ใช้ความกว้าง A4 จาก @page เหมือน PagedPreview จริง
  // มิฉะนั้นวัด source ผิดความกว้าง → จัดหน้าเพี้ยน เคยได้ 45 แทน 25). fixed = ไม่กวน document flow
  target.style.cssText = "position:fixed;left:-10000px;top:0;background:#fff;z-index:-1";
  document.body.appendChild(target);

  try {
    const previewer = new Paged.Previewer();
    await Promise.race([
      previewer.preview(content, [{ "/ylc/paged.css": PAGED_CSS }], target),
      new Promise((_, reject) => setTimeout(() => reject(new Error("paged.js timeout")), timeoutMs)),
    ]);

    const pages = Array.from(target.querySelectorAll(".pagedjs_page"));
    const total = pages.length;

    // หาหน้าที่แต่ละบท "เริ่ม" (data-ch-start) — paged.js clone attribute ไปทุกหน้าที่บทกินต่อ
    // จึงต้องเก็บเฉพาะ "ครั้งแรก" ของแต่ละ id (หน้าเริ่มจริง) มิฉะนั้นบทยาวจะถูกนับเป็น 1 หน้าเสมอ
    const starts: Array<{ id: string; page: number }> = [];
    const seen = new Set<string>();
    pages.forEach((pg, i) => {
      pg.querySelectorAll<HTMLElement>("[data-ch-start]").forEach((el) => {
        const id = el.getAttribute("data-ch-start");
        if (id && !seen.has(id)) {
          seen.add(id);
          starts.push({ id, page: i });
        }
      });
    });
    const perChapter: Record<string, number> = {};
    for (let k = 0; k < starts.length; k++) {
      const nextPage = k + 1 < starts.length ? starts[k + 1].page : total;
      perChapter[starts[k].id] = Math.max(1, nextPage - starts[k].page);
    }

    return { total, perChapter };
  } finally {
    target.remove();
  }
}
