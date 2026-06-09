import { describe, expect, test } from "vitest";

import {
  chartSignatureOf,
  clearCorrection,
  readingFingerprint,
  resolveCorrection,
  saveCorrection,
  type SinsaeCorrection,
} from "@/lib/bazi/sinsae-corrections";
import type { TopicEngineReading } from "@/lib/bazi/topic-reading";

function makeReading(
  topicId: string,
  lens: string,
  relationResults: string[],
): TopicEngineReading {
  return {
    topicId,
    chapter: 1,
    title: "t",
    lens,
    table: relationResults.map((relationResult) => ({
      sourceSymbol: "x",
      pointsTo: "y",
      relationResult,
    })),
    method: [],
    prose: [],
  };
}

function makeEntry(over: Partial<SinsaeCorrection> = {}): SinsaeCorrection {
  return {
    topicId: "chart_foundation",
    fingerprint: "fp",
    chartSignature: "sig",
    original: "ของระบบ",
    corrected: "ของซินแส",
    editedAt: "2026-06-09T00:00:00.000Z",
    ...over,
  };
}

describe("sinsae-corrections fingerprint", () => {
  test("ผลความสัมพันธ์เหมือนกัน (ลำดับต่างกัน) → fingerprint ตรงกัน", () => {
    const a = makeReading("chart_foundation", "เลนส์", ["ก", "ข"]);
    const b = makeReading("chart_foundation", "เลนส์", ["ข", "ก"]);
    expect(readingFingerprint(a)).toBe(readingFingerprint(b));
  });

  test("ผลความสัมพันธ์ต่างกัน → fingerprint ต่างกัน", () => {
    const a = makeReading("chart_foundation", "เลนส์", ["ก", "ข"]);
    const b = makeReading("chart_foundation", "เลนส์", ["ก", "ค"]);
    expect(readingFingerprint(a)).not.toBe(readingFingerprint(b));
  });
});

describe("sinsae-corrections resolve", () => {
  test("exact = ดวงเดิม, similar = ดวงอื่นที่ fingerprint ตรง", () => {
    const reading = makeReading("chart_foundation", "เลนส์", ["ก", "ข"]);
    const fp = readingFingerprint(reading);
    const store = {
      chart_foundation: [
        makeEntry({ chartSignature: "sigA", fingerprint: fp, corrected: "A" }),
        makeEntry({ chartSignature: "sigB", fingerprint: fp, corrected: "B" }),
        makeEntry({ chartSignature: "sigC", fingerprint: "other", corrected: "C" }),
      ],
    };
    const match = resolveCorrection(store, "chart_foundation", reading, "sigA");
    expect(match.exact?.corrected).toBe("A");
    expect(match.similar.map((item) => item.corrected)).toEqual(["B"]);
  });

  test("save ทับ entry เดิมของ chartSignature เดียวกัน แล้ว clear เอาออก", () => {
    const sig = chartSignatureOf({ birthDate: "1988-01-01", birthTime: "08:00", gender: "male" });
    let store = saveCorrection({}, makeEntry({ chartSignature: sig, corrected: "v1" }));
    store = saveCorrection(store, makeEntry({ chartSignature: sig, corrected: "v2" }));
    expect(store.chart_foundation).toHaveLength(1);
    expect(store.chart_foundation[0].corrected).toBe("v2");

    store = clearCorrection(store, "chart_foundation", sig);
    expect(store.chart_foundation).toBeUndefined();
  });
});
