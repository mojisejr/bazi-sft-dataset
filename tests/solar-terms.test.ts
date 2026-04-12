import { describe, expect, test } from "vitest";

import {
  SOLAR_TERM_ORDER,
  buildGeneratedSolarTermRows,
  buildGregorianYearSolarTerms,
  buildSolarTermSnapshots,
} from "@/lib/bazi/solar-terms";

describe("buildGregorianYearSolarTerms", () => {
  test("returns a complete ordered set of 24 solar terms for a gregorian year", () => {
    const terms = buildGregorianYearSolarTerms(2024);

    expect(terms).toHaveLength(24);
    expect(terms.map((entry) => entry.name)).toEqual(SOLAR_TERM_ORDER);
    expect(terms[0]?.boundaryAtLocal).toBe("2024-01-06 04:49:22");
    expect(terms[23]?.boundaryAtLocal).toBe("2024-12-21 17:20:35");
  });

  test("keeps a full 24-term set even when winter solstice falls at the end of the year", () => {
    const terms = buildGregorianYearSolarTerms(2050);

    expect(terms).toHaveLength(24);
    expect(terms[23]?.name).toBe("冬至");
    expect(terms[23]?.boundaryAtLocal).toBe("2050-12-22 00:38:48");
  });
});

describe("buildSolarTermSnapshots", () => {
  test("matches the pinned boundary snapshots for verification years", () => {
    expect(buildSolarTermSnapshots([2000, 2024, 2025, 2050], ["立春", "春分", "夏至", "秋分", "冬至"])).toEqual([
      {
        year: 2000,
        values: {
          立春: "2000-02-04 20:40:24",
          春分: "2000-03-20 15:35:15",
          夏至: "2000-06-21 09:47:43",
          秋分: "2000-09-23 01:27:35",
          冬至: "2000-12-21 21:37:26",
        },
      },
      {
        year: 2024,
        values: {
          立春: "2024-02-04 16:27:07",
          春分: "2024-03-20 11:06:25",
          夏至: "2024-06-21 04:51:00",
          秋分: "2024-09-22 20:43:42",
          冬至: "2024-12-21 17:20:35",
        },
      },
      {
        year: 2025,
        values: {
          立春: "2025-02-03 22:10:28",
          春分: "2025-03-20 17:01:29",
          夏至: "2025-06-21 10:42:16",
          秋分: "2025-09-23 02:19:20",
          冬至: "2025-12-21 23:03:05",
        },
      },
      {
        year: 2050,
        values: {
          立春: "2050-02-03 23:43:54",
          春分: "2050-03-20 18:19:43",
          夏至: "2050-06-21 11:33:08",
          秋分: "2050-09-23 03:28:39",
          冬至: "2050-12-22 00:38:48",
        },
      },
    ]);
  });
});

describe("buildGeneratedSolarTermRows", () => {
  test("builds the full 1900-2100 seed payload", () => {
    const rows = buildGeneratedSolarTermRows();

    expect(rows).toHaveLength(4824);
    expect(rows[0]).toMatchObject({
      sourcePath: "generated:lunar-javascript",
      solarTermName: "小寒",
      boundaryAt: "1900-01-06 02:03:57",
    });
    expect(rows[rows.length - 1]).toMatchObject({
      solarTermName: "冬至",
    });
    expect(rows.every((row) => row.metadata.timezone === "Asia/Hong_Kong")).toBe(true);
  });
});