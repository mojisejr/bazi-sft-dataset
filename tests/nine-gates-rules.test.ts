// เก้าประตู (ซินแสนุ้ย 2026-10-29): กติกาต้องตรงต้นแบบ — ผังหลอซู · ธาตุตามเลข · 開 0→9, 5→2 · ประตูตามเข็มนาฬิกา · วังกลางสะท้อนวังดิถี
import { describe, expect, it } from "vitest";
import { ELEMENT_BY_DIGIT, PALACES, displayedGate, effectiveGateStart, gateAssignments } from "@/lib/bazi/nine-gates/rules";

describe("nine-gates rules", () => {
  it("ผังหลอซู 4 9 2 / 3 5 7 / 8 1 6", () => {
    expect(PALACES.map((p) => p.number)).toEqual([4, 9, 2, 3, 5, 7, 8, 1, 6]);
  });
  it("ธาตุตามเลขดิถี", () => {
    expect(ELEMENT_BY_DIGIT[2]).toBe("ธาตุไฟ");
    expect(ELEMENT_BY_DIGIT[0]).toBe("ธาตุดิน");
    expect(ELEMENT_BY_DIGIT[9]).toBe("ธาตุทอง");
  });
  it("開: 0→วัง 9 · 5→วัง 2 · อื่นตามแต้ม", () => {
    expect(effectiveGateStart(0)).toBe(9);
    expect(effectiveGateStart(5)).toBe(2);
    expect(effectiveGateStart(6)).toBe(6);
  });
  it("วาง 8 ประตูตามเข็มนาฬิกาจากวังเริ่ม", () => {
    const a = gateAssignments(6);
    expect([6, 1, 8, 3, 4, 9, 2, 7].map((n) => a.get(n)?.gate).join("")).toBe("開休生傷杜景死驚");
    const b = gateAssignments(3);
    expect(b.get(3)?.gate).toBe("開");
    expect(b.get(4)?.gate).toBe("休");
    expect(b.get(8)?.gate).toBe("驚");
    expect(gateAssignments(null).size).toBe(0);
  });
  it("วังกลางสะท้อนประตูของวังดิถี (ดิถีอยู่กลาง → วัง 2)", () => {
    const a = gateAssignments(6);
    expect(displayedGate(a, 5, 1)?.gate).toBe("休");
    expect(displayedGate(a, 5, 5)?.gate).toBe(a.get(2)?.gate);
    expect(displayedGate(a, 5, null)).toBeUndefined();
  });
});
