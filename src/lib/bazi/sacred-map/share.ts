"use client";

import { googleMapsLink, type SacredLocationDto } from "./constants";

/**
 * แชร์สถานที่ — ลำดับ fallback:
 *   1) LIFF shareTargetPicker (ถ้าอยู่ใน LINE + ตั้ง NEXT_PUBLIC_LIFF_ID)
 *   2) Web Share API (มือถือทั่วไป)
 *   3) คัดลอกลิงก์ลง clipboard
 * คืนข้อความสถานะสั้น ๆ ให้ UI โชว์.
 */
export async function shareLocation(loc: SacredLocationDto): Promise<string> {
  const mapUrl = googleMapsLink(loc);
  const lines = [
    `📍 ${loc.name}`,
    loc.deity ? `🙏 ${loc.deity}` : "",
    loc.province ? `${loc.province}` : "",
    loc.direction ? `ทิศมงคล: ${loc.direction}` : "",
    mapUrl,
  ].filter(Boolean);
  const text = lines.join("\n");

  // 1) LIFF
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (liffId) {
    try {
      const liff = (await import("@line/liff")).default as unknown as {
        init: (c: { liffId: string }) => Promise<void>;
        isApiAvailable: (name: string) => boolean;
        shareTargetPicker: (messages: Array<{ type: string; text: string }>) => Promise<unknown>;
      };
      await liff.init({ liffId });
      if (liff.isApiAvailable("shareTargetPicker")) {
        await liff.shareTargetPicker([{ type: "text", text }]);
        return "แชร์ผ่าน LINE แล้ว";
      }
    } catch {
      /* ตกไป fallback */
    }
  }

  // 2) Web Share
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: loc.name, text, url: mapUrl });
      return "แชร์แล้ว";
    } catch {
      /* ผู้ใช้ยกเลิก/ไม่รองรับ → ตกไป clipboard */
    }
  }

  // 3) Clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return "คัดลอกลิงก์แล้ว";
    } catch {
      /* เงียบ */
    }
  }
  return "แชร์ไม่สำเร็จ";
}
