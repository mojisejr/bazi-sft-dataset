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

/** เรนเดอร์ลูก (เอกสาร YLC) เป็นหน้า A4 จริงด้วย paged.js — ใช้ทั้งบนจอ (preview) และตอนพิมพ์ */
export function PagedPreview({ children }: { children: ReactNode }) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const ranRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // รัน paged.js "ครั้งเดียวต่อการ mount" — กัน re-run ตอน parent re-render (children เปลี่ยน reference
  // ทุก render) ซึ่งทำให้ paged.js เริ่มใหม่ทับ DOM เดิมที่ยังจัดหน้าไม่เสร็จ → null nextSibling/getAttribute
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const Paged = await loadPaged();
        if (cancelled || !sourceRef.current || !targetRef.current) return;
        const doc = sourceRef.current.querySelector(".ylc-doc");
        const content = (doc ?? sourceRef.current).cloneNode(true) as HTMLElement;
        targetRef.current.innerHTML = "";
        const previewer = new Paged.Previewer();
        await previewer.preview(content, [{ "/ylc/paged.css": PAGED_CSS }], targetRef.current);
        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("paged.js preview failed", err);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div ref={sourceRef} style={{ display: "none" }} aria-hidden="true">
        {children}
      </div>
      {status === "loading" ? <div className="ylc-preview__loading">กำลังจัดหน้า A4…</div> : null}
      {status === "error" ? (
        <div className="ylc-preview__loading">
          จัดหน้าไม่สำเร็จ — กดพิมพ์ผ่านเบราว์เซอร์ (Ctrl/Cmd+P) ได้โดยตรง
        </div>
      ) : null}
      <div ref={targetRef} className="ylc-paged-out" />
    </>
  );
}
