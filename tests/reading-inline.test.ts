import { describe, expect, it } from "vitest";

import { tokenizeInline } from "@/lib/bazi/reading-inline";

describe("tokenizeInline — legacy ** / *** (กันถอย)", () => {
  it("ข้อความเปล่า → run เดียวไม่มี mark", () => {
    expect(tokenizeInline("สวัสดี")).toEqual([{ text: "สวัสดี", bold: false, red: false, color: null }]);
  });

  it("**ตัวหนา** → bold", () => {
    expect(tokenizeInline("ก **ข** ค")).toEqual([
      { text: "ก ", bold: false, red: false, color: null },
      { text: "ข", bold: true, red: false, color: null },
      { text: " ค", bold: false, red: false, color: null },
    ]);
  });

  it("***เน้นแดง*** → red (หนา+แดง)", () => {
    expect(tokenizeInline("ระวัง ***โรค*** นะ")).toEqual([
      { text: "ระวัง ", bold: false, red: false, color: null },
      { text: "โรค", bold: true, red: true, color: null },
      { text: " นะ", bold: false, red: false, color: null },
    ]);
  });
});

describe("tokenizeInline — สี [[c=..]]", () => {
  it("สี palette key → color hex", () => {
    expect(tokenizeInline("[[c=fire]]ไฟ[[/c]]")).toEqual([
      { text: "ไฟ", bold: false, red: false, color: "#cb2c2a" },
    ]);
  });

  it("สี + หนา (ซ้อนใน) → color + bold", () => {
    expect(tokenizeInline("[[c=water]]**น้ำ**[[/c]]")).toEqual([
      { text: "น้ำ", bold: true, red: false, color: "#1455a4" },
    ]);
  });

  it("6-hex ดิบใน token → color ตรง ๆ", () => {
    expect(tokenizeInline("[[c=123abc]]x[[/c]]")).toEqual([
      { text: "x", bold: false, red: false, color: "#123abc" },
    ]);
  });

  it("token สีไม่ถูกต้อง → ไม่มีสี (แยก ** ตามปกติ)", () => {
    expect(tokenizeInline("[[c=zzz]]**y**[[/c]]")).toEqual([
      { text: "y", bold: true, red: false, color: null },
    ]);
  });

  it("ข้อความผสม สี + ปกติ + หนา", () => {
    expect(tokenizeInline("ก่อน [[c=teal]]กลาง[[/c]] **ท้าย**")).toEqual([
      { text: "ก่อน ", bold: false, red: false, color: null },
      { text: "กลาง", bold: false, red: false, color: "#1f8497" },
      { text: " ", bold: false, red: false, color: null },
      { text: "ท้าย", bold: true, red: false, color: null },
    ]);
  });
});

describe("tokenizeInline — ขนาดตัวอักษร [[s=..]]", () => {
  it("ขนาดเดี่ยว → fontSize", () => {
    expect(tokenizeInline("[[s=18]]ใหญ่[[/s]]")).toEqual([
      { text: "ใหญ่", bold: false, red: false, color: null, fontSize: "18pt" },
    ]);
  });

  it("ขนาด + สี + หนา (ซ้อนใน) → fontSize + color + bold", () => {
    expect(tokenizeInline("[[s=20]][[c=fire]]**ร้อน**[[/c]][[/s]]")).toEqual([
      { text: "ร้อน", bold: true, red: false, color: "#cb2c2a", fontSize: "20pt" },
    ]);
  });

  it("ขนาด + เน้นแดง → fontSize + red", () => {
    expect(tokenizeInline("[[s=16]]***ระวัง***[[/s]]")).toEqual([
      { text: "ระวัง", bold: true, red: true, color: null, fontSize: "16pt" },
    ]);
  });

  it("ขนาดนอกช่วง (6–72) → ไม่มี fontSize", () => {
    expect(tokenizeInline("[[s=999]]x[[/s]]")).toEqual([
      { text: "x", bold: false, red: false, color: null },
    ]);
  });
});
