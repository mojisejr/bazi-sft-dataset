import { afterEach, describe, expect, test, vi } from "vitest";

import { detectRelationship, fetchCompatibilityReading } from "@/features/open-webui/compatibility-bridge";
import { type RawInputValue } from "@/lib/bazi/schema-types";

const A = { birthDate: "1989-01-03", birthTime: "08:45", gender: "ชาย", province: "จันทบุรี" } as RawInputValue;
const B = { birthDate: "1992-05-05", birthTime: "12:00", gender: "หญิง", province: "จันทบุรี" } as RawInputValue;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("detectRelationship", () => {
  test("work keywords → colleague, else love", () => {
    expect(detectRelationship("หุ้นส่วนคนนี้เข้ากันไหม")).toBe("colleague");
    expect(detectRelationship("เพื่อนร่วมงานเข้ากันไหม")).toBe("colleague");
    expect(detectRelationship("แฟนเข้ากันไหม")).toBe("love");
  });
});

describe("fetchCompatibilityReading", () => {
  test("renders overall + facets from the pair engine response", async () => {
    const pair = {
      mainFacet: { label: "ความผูกพัน", percent: 76, grade: "A", ratingText: "ดีมาก", lines: [{ text: "ใกล้ชิดเข้าใจกัน" }] },
      facets: [
        { label: "ความผูกพัน", percent: 76, grade: "A", ratingText: "ดีมาก", lines: [{ text: "ใกล้ชิดเข้าใจกัน" }] },
        { label: "วาสนาคู่", percent: 45, grade: "C", ratingText: "กลางๆ", lines: [{ text: "ต้องประคอง" }] },
      ],
      comparison: { match: { love: { overallPercent: 50, overallGrade: "C+" } } },
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => pair } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const out = await fetchCompatibilityReading("http://localhost", { personA: A, personB: B, relationship: "love" });
    expect(out).toContain("50%");
    expect(out).toContain("ความผูกพัน");
    expect(out).toContain("วาสนาคู่");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost/api/bazi/pair", expect.objectContaining({ method: "POST" }));
  });

  test("returns null when the engine has no facets (caller falls back to guard)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ facets: [] }) } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchCompatibilityReading("http://localhost", { personA: A, personB: B, relationship: "love" })).toBeNull();
  });

  test("adds the assumed-time caveat when partner time is unknown", async () => {
    const pair = { facets: [{ label: "x", percent: 60, grade: "B", lines: [] }], comparison: { match: { love: { overallPercent: 60, overallGrade: "B" } } } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => pair } as unknown as Response));
    const out = await fetchCompatibilityReading("http://localhost", { personA: A, personB: B, relationship: "love", partnerTimeAssumed: true });
    expect(out).toContain("ไม่ทราบเวลาเกิดของอีกฝ่าย");
  });
});
