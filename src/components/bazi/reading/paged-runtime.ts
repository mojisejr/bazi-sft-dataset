"use client";

/**
 * Runtime ของ paged.js ใช้ร่วมกัน (PagedPreview + ตัวนับจำนวนหน้า) — กันโหลด/นิยามซ้ำ
 *
 * PAGED_CSS: กฎ @page (A4 จริง) ส่งตรงให้ paged.js แบบ { href: cssText } เพื่อไม่ให้มันดึง/ลบ
 *   stylesheet ของแอป. สไตล์ภาพอื่น ๆ มาจาก ylc-pdf.css ที่ cascade ปกติ
 */
export const PAGED_CSS = `
@page { size: A4; margin: 0; }
@page ylc-text {
  margin: 24mm 18mm 22mm;
  background-image: url("/ylc/watermark.png");
  background-repeat: no-repeat;
  background-position: center 52%;
  background-size: 150mm;
  @bottom-center {
    content: "";
    background-image: url("/ylc/logo-footer.png");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 38mm auto;
  }
}
@page ylc-full { margin: 0; }
.ylc-sheet--content { page: ylc-text; }
.ylc-sheet--image, .ylc-sheet--chart { page: ylc-full; }
.ylc-sheet + .ylc-sheet { break-before: page; }
`;

export type PagedGlobal = {
  Previewer: new () => {
    preview: (
      content: Node | string,
      stylesheets: Array<string | Record<string, string>>,
      renderTo: Element,
    ) => Promise<unknown>;
  };
};

/**
 * โหลด paged.js (UMD prebuilt) ผ่าน <script> แทนการ bundle — source ของ paged.js
 * เข้ากันไม่ได้กับ Turbopack/webpack (error "contains.call is not a function")
 */
/**
 * รอฟอนต์ YLC (Sarabun/Display) โหลดจริงก่อนให้ paged.js วัดความสูง — กันจัดหน้าเพี้ยน
 * (ถ้าวัดตอนฟอนต์ fallback ยังอยู่ ความสูงต่างกัน → จำนวนหน้าไม่นิ่ง 25↔45)
 */
export async function ensureYlcFontsLoaded(timeoutMs = 4000): Promise<void> {
  const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  try {
    await Promise.race([
      Promise.all([
        fonts.load('400 14.5pt "YLC Sarabun"'),
        fonts.load('700 14.5pt "YLC Sarabun"'),
        fonts.load('700 18pt "YLC Display"'),
      ]).then(() => fonts.ready),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    /* ignore — ปล่อยให้ paged.js ทำต่อแม้ฟอนต์โหลดไม่ครบ */
  }
}

export function loadPaged(): Promise<PagedGlobal> {
  const w = window as unknown as { Paged?: PagedGlobal };
  if (w.Paged) return Promise.resolve(w.Paged);
  return new Promise((resolve, reject) => {
    const id = "ylc-pagedjs-script";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => (w.Paged ? resolve(w.Paged) : reject(new Error("paged.js missing"))));
      existing.addEventListener("error", () => reject(new Error("load paged.js failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    // ?v= bust cache หลัง patch ไฟล์ (เพิ่มเลขทุกครั้งที่ patch paged.js ใหม่)
    s.src = "/ylc/paged.js?v=ylc-patch1";
    s.onload = () => (w.Paged ? resolve(w.Paged) : reject(new Error("paged.js missing")));
    s.onerror = () => reject(new Error("load paged.js failed"));
    document.head.appendChild(s);
  });
}
