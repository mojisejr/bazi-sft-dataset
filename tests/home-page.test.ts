import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { getResetActionCopy, shouldConfirmSessionReset } from "@/app/page";

// หมายเหตุ: หน้า main เป็น navigation hub (การ์ดลิงก์) แล้ว — ฟอร์มคำนวณดวงย้ายไปหน้า /reading
// เทสต์ที่เคย SSR-render เครื่องคำนวณ/คิวบนหน้าแรกถูกถอดออก (UI นั้นไม่อยู่บนหน้า main แล้ว)
// ที่เหลือเป็นเทสต์ของ pure helper ที่ re-export ผ่าน @/app/page.
describe("BaziTrainerWorkspace", () => {
  test("requires confirmation only for active unfinished dataset sessions", () => {
    expect(shouldConfirmSessionReset(null, null)).toBe(false);
    expect(shouldConfirmSessionReset("record-1", "draft")).toBe(true);
    expect(shouldConfirmSessionReset("record-1", "reviewed")).toBe(false);
    expect(shouldConfirmSessionReset("record-1", "rejected")).toBe(false);
  });

  test("switches reset copy after annotation is reviewed", () => {
    expect(getResetActionCopy(null)).toEqual({
      label: "ล้างข้อมูลเพื่อผูกดวงใหม่",
      detail:
        "หากต้องการคำนวณดวงใหม่ ต้องรีเซ็ต session นี้ก่อน เพื่อกันข้อมูลปนกันระหว่าง record",
      tone: "secondary",
    });

    expect(getResetActionCopy("reviewed")).toEqual({
      label: "ผูกดวงใหม่",
      detail: "งานชุดนี้ถูกปิดแล้ว หากต้องการอ่านดวงใหม่ให้เริ่มรอบใหม่จากปุ่มนี้",
      tone: "primary",
    });

    expect(getResetActionCopy("rejected")).toEqual({
      label: "ผูกดวงใหม่",
      detail: "งานชุดนี้ถูกปิดแล้ว หากต้องการอ่านดวงใหม่ให้เริ่มรอบใหม่จากปุ่มนี้",
      tone: "primary",
    });
  });
});
