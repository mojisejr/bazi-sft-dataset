"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * กฎ @page (paged.js) — แบ่งเอกสารเป็นหน้า A4 จริง เกินหน้าก็ขึ้นหน้าใหม่
 * ส่งเป็น stylesheet ตรง ๆ ให้ paged.js (รูปแบบ { href: cssText }) เพื่อไม่ให้มันไปดึง/ลบ
 * stylesheet ของแอป. สไตล์ภาพอื่น ๆ มาจาก ylc-pdf.css ที่ cascade ปกติ
 */
const PAGED_CSS = `
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

type PagedGlobal = {
  Previewer: new () => {
    preview: (
      content: Node | string,
      stylesheets: Array<string | Record<string, string>>,
      renderTo: Element,
    ) => Promise<unknown>;
  };
};

/**
 * โหลด paged.js (UMD prebuilt) ผ่าน <script> แทนการ bundle — เพราะ source ของ paged.js
 * เข้ากันไม่ได้กับ Turbopack/webpack (error "contains.call is not a function")
 */
function loadPaged(): Promise<PagedGlobal> {
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
    s.src = "/ylc/paged.js";
    s.onload = () => (w.Paged ? resolve(w.Paged) : reject(new Error("paged.js missing")));
    s.onerror = () => reject(new Error("load paged.js failed"));
    document.head.appendChild(s);
  });
}

/**
 * รอ "ฟอนต์ + รูปในเอกสาร" ให้พร้อมก่อนปล่อยให้ paged.js วัด/จัดหน้า
 * สำคัญตอนเปิด preview บนหน้าที่เพิ่งโหลด (เช่น เปิดจากประวัติ ?print=1) — ถ้า layout ยังไม่นิ่ง
 * paged.js อาจวัดความสูงเพี้ยนแล้วจัดหน้านานผิดปกติ/ค้าง. มี timeout กันรอ asset ที่ไม่มีจริง
 */
async function waitForAssets(root: HTMLElement, timeoutMs = 6000): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
  if (fonts?.ready) {
    tasks.push(Promise.resolve(fonts.ready).catch(() => undefined));
  }

  for (const img of Array.from(root.querySelectorAll("img"))) {
    if (img.complete && img.naturalWidth > 0) continue;
    tasks.push(
      new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      }),
    );
  }

  if (tasks.length === 0) return;

  await Promise.race([
    Promise.all(tasks),
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}

/** เรนเดอร์ลูก (เอกสาร YLC) เป็นหน้า A4 จริงด้วย paged.js — ใช้ทั้งบนจอ (preview) และตอนพิมพ์ */
export function PagedPreview({ children }: { children: ReactNode }) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const ranRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // โชว์คำแนะนำเพิ่มเมื่อจัดหน้านานผิดปกติ (ไม่ล้มงาน — ปล่อยให้ paged.js ทำต่อ)
  const [slow, setSlow] = useState(false);

  // รัน paged.js "ครั้งเดียวจริง ๆ" ต่อ mount
  //  - ranRef กันรันซ้อน: ถ้า paged.js 2 รอบทำงานทับ DOM เดียวกัน (StrictMode mount→unmount→mount
  //    หรือ re-render) มันจะอ่าน node ที่อีกรอบลบไปแล้ว → "Cannot read properties of null (getAttribute)"
  //  - ห้ามใช้ flag cancelled มายกเลิก run นี้: StrictMode cleanup จะ set cancelled ก่อน run จะเริ่มจริง
  //    → run ถูกยกเลิก + ranRef บล็อก run ถัดไป = ค้าง "กำลังจัดหน้า A4…" ตลอด.
  //    ปล่อยให้ run เดียวทำจนจบ (setState หลัง unmount เป็น no-op ใน React 18/19 อยู่แล้ว)
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const slowTimer = setTimeout(() => setSlow(true), 25000);
    (async () => {
      try {
        const Paged = await loadPaged();
        if (!sourceRef.current || !targetRef.current) return;
        // รอฟอนต์/รูปให้นิ่งก่อน เพื่อให้ paged.js วัดหน้าได้ถูกต้องและไม่ค้างตอน cold start
        await waitForAssets(sourceRef.current);
        if (!sourceRef.current || !targetRef.current) return;
        const doc = sourceRef.current.querySelector(".ylc-doc");
        const content = (doc ?? sourceRef.current).cloneNode(true) as HTMLElement;
        targetRef.current.innerHTML = "";
        const previewer = new Paged.Previewer();
        await previewer.preview(content, [{ "/ylc/paged.css": PAGED_CSS }], targetRef.current);
        setStatus("ready");
      } catch (err) {
        console.error("paged.js preview failed", err);
        setStatus("error");
      } finally {
        clearTimeout(slowTimer);
      }
    })();
  }, []);

  return (
    <>
      <div ref={sourceRef} style={{ display: "none" }} aria-hidden="true">
        {children}
      </div>
      {status === "loading" ? (
        <div className="ylc-preview__loading">
          กำลังจัดหน้า A4…
          {slow ? (
            <div className="ylc-preview__loading-sub">
              ใช้เวลานานกว่าปกติ — ถ้าค้าง ลองปิดหน้าต่างนี้แล้วกด “ดาวน์โหลด .docx” แทน
            </div>
          ) : null}
        </div>
      ) : null}
      {status === "error" ? (
        <div className="ylc-preview__loading">
          จัดหน้าไม่สำเร็จ — กดพิมพ์ผ่านเบราว์เซอร์ (Ctrl/Cmd+P) ได้โดยตรง
        </div>
      ) : null}
      <div ref={targetRef} className="ylc-paged-out" />
    </>
  );
}
