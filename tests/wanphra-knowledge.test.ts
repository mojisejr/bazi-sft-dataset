// วันพระในแชท (ซินแสนุ้ย 2026-10-27): คำนวณจริงจากปฏิทินจันทรคติ ไม่ให้ LLM แต่ง — ตรงวันสำคัญปี 2569 ที่ประกาศ
import { describe, expect, it } from "vitest";
import { isWanPhraQuestion, wanPhraKnowledge, wanPhraYear } from "@/lib/bazi/wanphra-knowledge";

describe("wanphra knowledge", () => {
  it("จับคำถามวันพระ · ไม่จับคำถามอื่น", () => {
    expect(isWanPhraQuestion("ขอปฏิทินที่ระบุเฉพาะวันพระปี 2569")).toBe(true);
    expect(isWanPhraQuestion("วันโกนเดือนนี้วันไหน")).toBe(true);
    expect(isWanPhraQuestion("งานปีนี้เป็นยังไง")).toBe(false);
    expect(wanPhraKnowledge("งานปีนี้เป็นยังไง")).toBeNull();
  });

  it("ปีจาก พ.ศ./ค.ศ./ปีปัจจุบัน", () => {
    expect(wanPhraYear("วันพระปี 2569")).toBe(2026);
    expect(wanPhraYear("วันพระ 2027")).toBe(2027);
    expect(wanPhraYear("วันพระเดือนนี้", new Date("2026-12-31T20:00:00Z"))).toBe(2027);
  });

  it("2569 ตรงวันสำคัญที่ประกาศ: มาฆะ 3 มี.ค. · วิสาขะ 31 พ.ค. · อาสาฬหะ 29 ก.ค. (ขึ้น 15 ค่ำ)", () => {
    const k = wanPhraKnowledge("ขอวันพระปี 2569")!;
    expect(k).toContain("พ.ศ. 2569");
    expect(k).toMatch(/มีนาคม: 3 \(ขึ้น 15 ค่ำ วันพระใหญ่ · [^)]*มาฆ/);
    expect(k).toMatch(/พฤษภาคม: .*31 \(ขึ้น 15 ค่ำ วันพระใหญ่ · [^)]*วิสาข/);
    expect(k).toMatch(/กรกฎาคม: .*29 \(ขึ้น 15 ค่ำ วันพระใหญ่ · [^)]*อาสาฬห/);
    expect(k).toContain("มกราคม: 3 (ขึ้น 15 ค่ำ วันพระใหญ่), 11 (แรม 8 ค่ำ), 18 (แรม 15 ค่ำ วันพระใหญ่), 26 (ขึ้น 8 ค่ำ)");
  });

  it("ถามเดือนเดียว → แค่เดือนนั้น", () => {
    const k = wanPhraKnowledge("วันพระเดือนพฤศจิกายน 2569")!;
    expect(k).toContain("พฤศจิกายน:");
    expect(k).not.toContain("มกราคม:");
  });
});
