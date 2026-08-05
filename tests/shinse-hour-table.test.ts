import { describe, expect, it } from "vitest";

import { calculateBaziStructuralState } from "@/lib/bazi/symbolic-engine";
import type { RawInputValue } from "@/lib/bazi/schema-types";

import hourTable from "./fixtures/shinse-hour-table.json";

/**
 * ตรึงระบบยามให้ตรงตาราง "ตารางตั้งดวง" ที่ซินแสส่ง (60 ชีต × 13 ช่วงเวลา, 2026-08-05)
 * ซินแสสั่ง "ใช้ระบบนี้ Fix ละ · วันนี้ เจอ ยามนี้ เอาแบบนี้เลย · อันเดิมมีเคลื่อน"
 *
 * โฟกัสหลัก: 晚子時 (23:00-23:59) ต้องได้ยาม子ของ "วันเดิม" (五鼠遁ของวันนั้น) วันไม่เคลื่อน
 * เช่น 甲午วัน → 23:00 = 甲子 (ไม่ใช่ 丙子 ของวันถัดไปแบบ default lunar-javascript)
 */

// เวลากึ่งกลางของแต่ละช่วง (นาทีที่ปลอดภัย ไม่คร่อมขอบยาม)
const TIME_BAND_SAMPLE: Record<string, { hour: number; minute: number }> = {
  "0:00-0:59": { hour: 0, minute: 30 },
  "1:00-2:59": { hour: 1, minute: 30 },
  "3:00-4:59": { hour: 3, minute: 30 },
  "5:00-6:59": { hour: 5, minute: 30 },
  "7:00-8:59": { hour: 7, minute: 30 },
  "9:00-10:59": { hour: 9, minute: 30 },
  "11:00-12:59": { hour: 11, minute: 30 },
  "13:00-14:59": { hour: 13, minute: 30 },
  "15:00-16:59": { hour: 15, minute: 30 },
  "17:00-18:59": { hour: 17, minute: 30 },
  "19:00-20:59": { hour: 19, minute: 30 },
  "21:00-22:59": { hour: 21, minute: 30 },
  "23:00-23:59": { hour: 23, minute: 30 },
};

/** วันจริง (solar) ที่ให้เสาวันตรงกับ day pillar ที่ต้องการ — คุม year/month ให้คงที่ */
const DAY_PILLAR_TO_DATE: Record<string, { date: string }> = buildDayPillarDates();

function buildDayPillarDates(): Record<string, { date: string }> {
  // ไล่วันติดต่อกัน 60 วันจากฐานที่รู้ว่าเป็น 甲子 เพื่อ map ครบ 60 กะจื่อ
  // 2024-01-01 = 甲子 (ยืนยันด้วย engine ในเทสด้านล่างอยู่แล้ว)
  const bands = (hourTable.hourPillarByDayPillar ?? {}) as Record<string, string[]>;
  const map: Record<string, { date: string }> = {};
  const base = new Date(Date.UTC(2024, 0, 1));
  const dayPillars = Object.keys(bands);
  for (let i = 0; i < dayPillars.length; i++) {
    const d = new Date(base.getTime() + i * 86_400_000);
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    map[dayPillars[i]] = { date: iso };
  }
  return map;
}

function chartFor(date: string, hour: number, minute: number) {
  const raw: RawInputValue = {
    birthDate: date,
    birthTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    gender: "male",
    province: "Bangkok",
    calendarSystem: "solar",
    timezone: "Asia/Bangkok",
  };
  return calculateBaziStructuralState(raw);
}

describe("ระบบยามตรงตาราง 'ตารางตั้งดวง' ซินแส (Fix 2026-08-05)", () => {
  const bands = (hourTable.hourPillarByDayPillar ?? {}) as Record<string, string[]>;
  const times = (hourTable.timeBands ?? []) as string[];

  it("ฐานตั้งต้น 2024-01-01 00:30 = เสาวัน 甲子", () => {
    const s = chartFor("2024-01-01", 0, 30);
    expect(`${s.fourPillars.day.stem}${s.fourPillars.day.branch}`).toBe("甲子");
  });

  it("เสาวันของทุกวันที่ตัวอย่าง map ตรงกับ day pillar ที่ตั้งใจ (คุมความถูกต้องของ fixture)", () => {
    for (const [dayPillar, { date }] of Object.entries(DAY_PILLAR_TO_DATE)) {
      const s = chartFor(date, 0, 30); // 00:30 = เสาวันไม่เคลื่อนแน่นอน
      expect(`${s.fourPillars.day.stem}${s.fourPillars.day.branch}`).toBe(dayPillar);
    }
  });

  it("ยามครบ 60 วัน × 13 ช่วงเวลา ตรงตาราง (รวม 晚子時 23:00)", () => {
    const mismatches: string[] = [];
    for (const [dayPillar, hourPillars] of Object.entries(bands)) {
      const { date } = DAY_PILLAR_TO_DATE[dayPillar];
      times.forEach((band, i) => {
        const { hour, minute } = TIME_BAND_SAMPLE[band];
        const s = chartFor(date, hour, minute);
        const got = `${s.fourPillars.hour.stem}${s.fourPillars.hour.branch}`;
        const want = hourPillars[i];
        if (got !== want) {
          mismatches.push(`วัน ${dayPillar} · ${band} → ได้ ${got} · ตาราง ${want}`);
        }
      });
    }
    expect(mismatches).toEqual([]);
  });

  it("23:00-23:59 = ยาม子 ของวันเดิม (วันไม่เคลื่อน)", () => {
    // 甲子วัน: 23:00 ต้องเป็น 甲子 (default lunar = 丙子 ของวันถัดไป)
    const s = chartFor(DAY_PILLAR_TO_DATE["甲子"].date, 23, 30);
    expect(`${s.fourPillars.hour.stem}${s.fourPillars.hour.branch}`).toBe("甲子");
    expect(`${s.fourPillars.day.stem}${s.fourPillars.day.branch}`).toBe("甲子");
  });
});
