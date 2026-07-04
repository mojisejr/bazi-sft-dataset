/**
 * ทดสอบ "ตัวคัดกรองคำถาม" (pure helpers) ของ router แชทโค้ชฮีลใจ — deterministic ไม่พึ่ง LLM/network.
 * ครอบ: ดักเบอร์ / ดักเวลา / ตรวจ "ขอเลือกวัน" / pre-router (ข้าม classify) ตามเจตนา.
 */
import { describe, expect, it } from "vitest";

import {
  extractHour,
  extractPhone,
  preClassify,
  wantsDayPicker,
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
