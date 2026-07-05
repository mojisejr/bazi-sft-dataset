/**
 * ทดสอบ "ตัวคัดกรองคำถาม" (pure helpers) ของ router แชทโค้ชฮีลใจ — deterministic ไม่พึ่ง LLM/network.
 * ครอบ: ดักเบอร์ / ดักเวลา / ตรวจ "ขอเลือกวัน" / pre-router (ข้าม classify) ตามเจตนา.
 */
import { describe, expect, it } from "vitest";

import {
  ageFromBirthDate,
  extractHour,
  extractPhone,
  parseRelativeDate,
  preClassify,
  recentContext,
  wantsDailyLifestyle,
  wantsDayPicker,
  wantsMonthDayScan,
} from "@/lib/louise-hay/grounding-router";

describe("extractPhone", () => {
  it("ดึงเบอร์ 10 หลักจากประโยค", () => {
    expect(extractPhone("เบอร์ 0891234567 ดีไหม")).toBe("0891234567");
  });
  it("รองรับขีด/เว้นวรรค", () => {
    expect(extractPhone("ดูเบอร์ 081-234-5678 ให้หน่อย")).toBe("0812345678");
  });
  it("ไม่มีเบอร์ → null", () => {
    expect(extractPhone("วันนี้เหนื่อยจัง")).toBeNull();
  });
  it("เลขสั้นเกินไปไม่ใช่เบอร์ → null", () => {
    expect(extractPhone("อายุ 025 ปี")).toBeNull();
  });
});

describe("extractHour", () => {
  it("04:00 → 4", () => expect(extractHour("นัด 04:00 พรุ่งนี้")).toBe(4));
  it("20.30 → 20", () => expect(extractHour("เวลา 20.30 น.")).toBe(20));
  it("ไม่มีเวลา → null", () => expect(extractHour("บอลใครชนะ")).toBeNull());
  it("ชั่วโมงเกิน 23 → null", () => expect(extractHour("เลข 45:99")).toBeNull());
});

describe("wantsDayPicker", () => {
  it("'เลือกวัน' → true", () => expect(wantsDayPicker("อยากขึ้นบ้านใหม่ เลือกวันในเดือนนี้")).toBe(true));
  it("'วันไหนดี' → true", () => expect(wantsDayPicker("แต่งงานวันไหนดี")).toBe(true));
  it("'หาฤกษ์' → true", () => expect(wantsDayPicker("หาฤกษ์เปิดร้าน")).toBe(true));
  it("ถามวันเดียว 'วันนี้ฤกษ์ดีไหม' → false", () => expect(wantsDayPicker("วันนี้ฤกษ์ดีไหม")).toBe(false));
});

describe("ageFromBirthDate (อายุจริง ณ วันนี้)", () => {
  const now = new Date("2026-07-05T03:00:00Z"); // 2026-07-05 Asia/Bangkok
  it("ยังไม่ถึงวันเกิดปีนี้ → ยังไม่บวกปี", () =>
    expect(ageFromBirthDate("1990-08-10", now)).toBe(35));
  it("ผ่านวันเกิดปีนี้แล้ว → บวกครบปี", () =>
    expect(ageFromBirthDate("1990-06-01", now)).toBe(36));
  it("วันเกิดตรงวันนี้พอดี → นับเต็มปี", () =>
    expect(ageFromBirthDate("2000-07-05", now)).toBe(26));
  it("วันเกิดผิดรูปแบบ → null", () => expect(ageFromBirthDate("bad", now)).toBeNull());
});

describe("recentContext (บริบทให้ตัวจัดหมวดเข้าใจคำถามต่อเนื่อง)", () => {
  it("ไม่มีประวัติ/ข้อความเดียว → ''", () => {
    expect(recentContext(undefined)).toBe("");
    expect(recentContext([{ role: "user", content: "hi" }])).toBe("");
  });
  it("ตัดข้อความล่าสุดออก + ติดป้ายบทบาท 'ผู้ใช้/โค้ช'", () => {
    const h: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: "ช่วยเลือกวันมงคลในเดือนนี้" },
      { role: "assistant", content: "วันที่ 5 กับ 16 ดีค่ะ" },
      { role: "user", content: "วันที่ 11 ไม่ดีหรอ" },
    ];
    const ctx = recentContext(h);
    expect(ctx).toContain("ผู้ใช้: ช่วยเลือกวันมงคลในเดือนนี้");
    expect(ctx).toContain("โค้ช: วันที่ 5 กับ 16 ดีค่ะ");
    expect(ctx).not.toContain("วันที่ 11 ไม่ดีหรอ"); // ข้อความล่าสุดไม่ถูกรวมในบริบท
  });
});

describe("wantsDailyLifestyle (คำถามใช้ชีวิตประจำวัน → ฟันธง)", () => {
  it("'กินอะไรดี' → true", () => expect(wantsDailyLifestyle("วันนี้กินอะไรดี")).toBe(true));
  it("'ใส่เสื้อสีอะไร' → true", () => expect(wantsDailyLifestyle("วันนี้ใส่เสื้อสีอะไรดี")).toBe(true));
  it("'ออกจากบ้านทิศไหน' → true", () => expect(wantsDailyLifestyle("ออกจากบ้านทิศไหนดี")).toBe(true));
  it("'ก้าวเท้าไหน' → true", () => expect(wantsDailyLifestyle("ก้าวเท้าไหนออกจากบ้านดี")).toBe(true));
  it("คำถามอารมณ์ทั่วไป → false", () => expect(wantsDailyLifestyle("วันนี้รู้สึกเหนื่อย")).toBe(false));
});

describe("wantsMonthDayScan (เดือนนี้...วันไหน เชิงโชค/ระวัง → สแกนรายวัน)", () => {
  it("'เดือนนี้มีโชควันไหน' → true", () => expect(wantsMonthDayScan("เดือนนี้ฉันจะมีโชควันไหน")).toBe(true));
  it("'เดือนนี้ต้องระวังวันไหน' → true", () => expect(wantsMonthDayScan("เดือนนี้ฉันต้องระวังวันไหน")).toBe(true));
  it("'เดือนนี้วันไหนดี' → true", () => expect(wantsMonthDayScan("เดือนนี้วันไหนดี")).toBe(true));
  it("'เดือนนี้ควรระวังอะไร' → true (ระวัง ในกรอบเดือน แม้ไม่พูด 'วันไหน')", () =>
    expect(wantsMonthDayScan("เดือนนี้ฉันควรระวังอะไร")).toBe(true));
  it("'เดือนนี้มีโชคไหม' → true", () => expect(wantsMonthDayScan("เดือนนี้มีโชคไหม")).toBe(true));
  it("กิจกรรมเจาะจง 'ขึ้นบ้านเดือนนี้วันไหนดี' → false (ใช้เลือกวันตามกิจกรรม)", () =>
    expect(wantsMonthDayScan("ขึ้นบ้านเดือนนี้วันไหนดี")).toBe(false));
  it("ถามพลังเดือนรวม 'เดือนนี้ควรทำอะไร' → false (ไม่ถามวันเจาะจง)", () =>
    expect(wantsMonthDayScan("เดือนนี้ควรทำอะไรดี")).toBe(false));
  it("ถามวันเดียว 'พรุ่งนี้ควรระวังอะไร' → false (ไม่ใช่กรอบเดือน)", () =>
    expect(wantsMonthDayScan("พรุ่งนี้ควรระวังอะไร")).toBe(false));
});

describe("parseRelativeDate", () => {
  const now = new Date("2026-07-05T03:00:00Z"); // 10:00 Asia/Bangkok = 2026-07-05
  it("'พรุ่งนี้' → +1 วัน", () => expect(parseRelativeDate("พรุ่งนี้กินอะไรดี", now)).toBe("2026-07-06"));
  it("'มะรืน' → +2 วัน", () => expect(parseRelativeDate("มะรืนใส่สีอะไร", now)).toBe("2026-07-07"));
  it("ไม่ระบุวัน → null (ใช้วันนี้)", () => expect(parseRelativeDate("กินอะไรดี", now)).toBeNull());
});

describe("preClassify (ข้าม classify LLM สำหรับเคสชัดเจน)", () => {
  it("เจอเบอร์ → phone", () => {
    expect(preClassify("เบอร์ 0891234567", "0891234567")?.route).toBe("phone");
  });
  it("'เซียมซี' → fortune", () => {
    expect(preClassify("ขอเสี่ยงเซียมซีหน่อย", null)?.route).toBe("fortune");
  });
  it("'ไพ่โหมดเซียน' → divine", () => {
    expect(preClassify("ขอไพ่โหมดเซียน", null)?.route).toBe("divine");
  });
  it("'จั่วไพ่' → card", () => {
    expect(preClassify("ขอจั่วไพ่แนะนำหน่อย", null)?.route).toBe("card");
  });
  it("ทักทายสั้น → chat", () => {
    expect(preClassify("สวัสดีค่ะ", null)?.route).toBe("chat");
  });
  it("คำถามกำกวม (การงาน) → null (ให้ LLM classify ต่อ)", () => {
    expect(preClassify("เดือนนี้การงานเป็นยังไง", null)).toBeNull();
  });
  it("pre-router ไม่คิดโทเคน classify (inTokens=0)", () => {
    expect(preClassify("ขอเซียมซี", null)?.inTokens).toBe(0);
  });
});
