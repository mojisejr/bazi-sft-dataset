import { describe, expect, test } from "vitest";

import {
  gregorianToJDN,
  jdnToGregorian,
  isAdhikamasa,
  isAdhikavara,
  thaiLunarDay,
  thaiBuddhistHolidayFor,
} from "@/lib/bazi/thai-lunar";

describe("thai-lunar — Julian Day round-trip", () => {
  test("JDN known anchors", () => {
    expect(gregorianToJDN(2000, 1, 1)).toBe(2451545);
    expect(gregorianToJDN(1963, 7, 5)).toBe(2438216);
  });
  test("round-trip 1900–2100 sample", () => {
    for (const [y, m, d] of [[1907, 2, 5], [2026, 6, 17], [2058, 12, 31], [1963, 7, 5]] as const) {
      expect(jdnToGregorian(gregorianToJDN(y, m, d))).toEqual({ year: y, month: m, day: d });
    }
  });
});

describe("thai-lunar — อธิกมาส/อธิกวาร (เทียบ suriya-go ground truth)", () => {
  test("ปีอธิกมาส (13 เดือน)", () => {
    for (const y of [2004, 2007, 2010, 2012, 2015, 2018]) expect(isAdhikamasa(y)).toBe(true);
    for (const y of [2005, 2006, 2008, 2009, 2011, 2013, 2014, 2016, 2017]) expect(isAdhikamasa(y)).toBe(false);
  });
  test("ปีอธิกวาร (เดือน 7 มี 30 วัน) — สูตรบริสุทธิ์", () => {
    for (const y of [2000, 2005, 2009, 2016]) expect(isAdhikavara(y)).toBe(true);
    for (const y of [2001, 2002, 2003, 2004, 2006, 2007, 2008, 2010, 2012, 2015]) expect(isAdhikavara(y)).toBe(false);
  });
  test("อธิกมาส/อธิกวาร ไม่เกิดพร้อมกันในปีเดียว", () => {
    for (let y = 1990; y <= 2050; y += 1) {
      expect(isAdhikamasa(y) && isAdhikavara(y)).toBe(false);
    }
  });
});

describe("thai-lunar — วันอาสาฬหบูชา (ground truth myhora/bot.or.th)", () => {
  // วันอาสาฬหบูชา = ขึ้น 15 ค่ำ เดือน 8 (เดือน 8 หลัง ปีอธิกมาส) — เทียบจาก suriya-go TestAsalhaPuja
  const ASALHA: Record<string, string> = {
    "1963-07-06": "วันอาสาฬหบูชา",
    "2010-07-26": "วันอาสาฬหบูชา",
    "2011-07-15": "วันอาสาฬหบูชา",
    "2013-07-22": "วันอาสาฬหบูชา",
    "2014-07-11": "วันอาสาฬหบูชา",
    "2015-07-30": "วันอาสาฬหบูชา",
    "2016-07-19": "วันอาสาฬหบูชา",
    "2017-07-08": "วันอาสาฬหบูชา",
    "2018-07-27": "วันอาสาฬหบูชา",
    "2019-07-16": "วันอาสาฬหบูชา",
    "2024-07-20": "วันอาสาฬหบูชา",
    "2025-07-10": "วันอาสาฬหบูชา",
  };
  for (const [date, name] of Object.entries(ASALHA)) {
    test(`อาสาฬหบูชา ${date}`, () => {
      const [y, m, d] = date.split("-").map(Number);
      expect(thaiBuddhistHolidayFor(y, m, d)).toBe(name);
      // วันถัดไปต้องเป็นวันเข้าพรรษา
      const next = jdnToGregorian(gregorianToJDN(y, m, d) + 1);
      expect(thaiBuddhistHolidayFor(next.year, next.month, next.day)).toBe("วันเข้าพรรษา");
    });
  }
});

describe("thai-lunar — ขึ้น/แรม ค่ำ + วันพระ", () => {
  test("ลอยกระทง 2558 (2015-11-25) = ขึ้น 15 ค่ำ เดือน 12", () => {
    const info = thaiLunarDay(2015, 11, 25);
    expect(info.phase).toBe("ขึ้น");
    expect(info.kham).toBe(15);
    expect(info.lunarMonth).toBe(12);
    expect(info.isWanPhra).toBe(true);
  });

  test("อาสาฬหบูชา 2015-07-30 = เพ็ญเดือน 8 หลัง (อธิกมาส)", () => {
    const info = thaiLunarDay(2015, 7, 30);
    expect(info.phase).toBe("ขึ้น");
    expect(info.kham).toBe(15);
    expect(info.lunarMonth).toBe(8);
    expect(info.isLeapMonth).toBe(true);
  });

  test("ทุกวันในปีมีข้อมูลจันทรคติ + วันพระ 46–52 วัน/ปี", () => {
    let wanPhra = 0;
    let covered = 0;
    for (let m = 1; m <= 12; m += 1) {
      const dim = new Date(Date.UTC(2026, m, 0)).getUTCDate();
      for (let d = 1; d <= dim; d += 1) {
        const info = thaiLunarDay(2026, m, d);
        if (info.kham >= 1 && info.kham <= 15) covered += 1;
        if (info.isWanPhra) wanPhra += 1;
      }
    }
    expect(covered).toBe(365);
    // ปีปกติมีวันพระ ~50 (4×12 + เศษ); ช่วงกว้างกันปีคาบเกี่ยว
    expect(wanPhra).toBeGreaterThanOrEqual(46);
    expect(wanPhra).toBeLessThanOrEqual(52);
  });

  test("kham อยู่ใน 1..15 และ phase ถูกต้องเสมอ", () => {
    for (let d = 1; d <= 31; d += 1) {
      const info = thaiLunarDay(2026, 1, d);
      expect(info.kham).toBeGreaterThanOrEqual(1);
      expect(info.kham).toBeLessThanOrEqual(15);
      expect(["ขึ้น", "แรม"]).toContain(info.phase);
    }
  });
});
