#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
สกัดตารางจาก knownlage/ManvsDay/ฤกษ์ยามเคี้ยงคุง.xlsx (แหล่งอ้างอิงทางการจากซินแส)
-> src/lib/bazi/data/almanac/

ผลิต:
  - stage-legend.json   : 十二長生 (A1-A12) name+score   [ใช้คำนวณ O เดือน autumn]
  - jianchu-legend.json : 建除 (C1-C12) name+score+กิจกรรม  [ใช้คำนวณ R เดือน autumn]
  - deities-good.json   : เทพดี (วันธงชัย/สมพงษ์/เทพแห่งฟ้า/เทพแห่งเดือน/ขุนพล/หมอเทพ/ลาภจากฟ้า)
  - deities-bad.json    : เทพร้าย (วันแตกวัน/เสียชีวิต/สุนัขสวรรค์/ภัยเดินทาง/เสือร้าย/โรคระบาด/โจรภาคพื้น)
       โครงสร้างเทพ: {name, activity, triggers:{month-branch: [chars]}, note}
       คีย์ = month-branch (寅..丑) -> ตัวกระตุ้น (กิ่ง/ก้านของวัน)
  - asura-detail.json   : 三煞 ต่อไตรภาคี-กิ่ง -> ทิศ + ราศี(3) + องศา (ยืนยันกฎ 三煞)

(legend B/黃道 มีอยู่แล้วใน hour-god-legend.json จากรอบก่อน)

รัน: PYTHONUTF8=1 C:/Users/ASUS/miniconda3/python.exe scripts/extract-kiang-kung-tables.py
"""
import json, os, unicodedata
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "knownlage", "ManvsDay", "ฤกษ์ยามเคี้ยงคุง.xlsx")
OUT = os.path.join(ROOT, "src", "lib", "bazi", "data", "almanac")

STEMS = set("甲乙丙丁戊己庚辛壬癸")
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
BR = set(BRANCHES)
MONTH_COLS = "寅卯辰巳午未申酉戌亥子丑"  # หัวตารางเทพดี/ร้าย คอลัมน์ C..N


def norm(s):
    if not isinstance(s, str):
        return s
    return "".join(unicodedata.normalize("NFKC", ch) if "豈" <= ch <= "﫿" else ch for ch in s).strip()


def v(ws, r, c):
    val = ws.cell(r, c).value
    return None if val is None else (val if isinstance(val, (int, float)) else norm(str(val)))


def extract_legends(wb):
    """A (長生) + C (建除) จากชีต สูตรคำนวณ rows 11-22 (B/C, H/I); กิจกรรมจาก จับหยี่เกี๋ยง."""
    ws = wb["สูตรคำนวณ"]
    stage, jianchu = {}, {}
    for r in range(11, 23):
        a_code, a_name, a_score = v(ws, r, 2), v(ws, r, 1), v(ws, r, 3)
        c_code, c_name, c_score = v(ws, r, 8), v(ws, r, 7), v(ws, r, 9)
        if a_code:
            stage[a_code] = {"name": a_name, "score": a_score}
        if c_code:
            jianchu[c_code] = {"name": c_name, "score": c_score}
    # กิจกรรมที่ควร/ห้าม ของ 建除 (จับหยี่เกี๋ยง col D=ความหมาย, E=กิจกรรม)
    wj = wb["จับหยี่เกี๋ยง"]
    for r in range(2, 14):
        code = v(wj, r, 1)
        if code in jianchu:
            jianchu[code]["meaning"] = v(wj, r, 4)
            jianchu[code]["activity"] = v(wj, r, 5)
    return stage, jianchu


def extract_deities(ws, max_rows):
    """เทพดี/เทพร้าย: หัวตาราง C..N = month-branch; เซลล์ = ตัวกระตุ้นวัน (กิ่ง/ก้าน)."""
    out = []
    for r in range(2, max_rows + 1):
        name = v(ws, r, 1)
        if not name:
            continue
        triggers = {}
        for i, mb in enumerate(MONTH_COLS):
            cell = v(ws, r, 3 + i)  # C=col3
            if isinstance(cell, str) and cell:
                # เซลล์อาจมี 2 ตัว (เช่น 亥未) -> แยกเป็น list ของอักขระ stem/branch
                chars = [ch for ch in cell if ch in STEMS or ch in BR]
                if chars:
                    triggers[mb] = chars
        if triggers:  # เก็บเฉพาะดาวที่มีข้อมูลเกณฑ์
            out.append({
                "name": name,
                "activity": v(ws, r, 2),
                "triggers": triggers,
                "note": v(ws, r, 15),
            })
    return out


def extract_asura(wb):
    ws = wb["ทิศอสูร"]
    out = []
    for r in range(2, 6):
        triad = [v(ws, r, c) for c in (1, 2, 3)]
        if all(t in BR for t in triad):
            out.append({
                "triad": triad,
                "direction": v(ws, r, 4),
                "sectors": [v(ws, r, c) for c in (5, 6, 7)],
                "degree_from": v(ws, r, 8),
                "degree_to": v(ws, r, 9),
            })
    return out


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    stage, jianchu = extract_legends(wb)
    good = extract_deities(wb["เทพดี"], 25)
    bad = extract_deities(wb["เทพร้าย"], 14)
    asura = extract_asura(wb)

    def dump(name, obj):
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
        print(f"  wrote {name}: {len(obj)} entries")

    print("Extracted from ฤกษ์ยามเคี้ยงคุง:")
    dump("stage-legend.json", stage)
    dump("jianchu-legend.json", jianchu)
    dump("deities-good.json", good)
    dump("deities-bad.json", bad)
    dump("asura-detail.json", asura)
    print("\nDeities (good):", [d["name"] for d in good])
    print("Deities (bad): ", [d["name"] for d in bad])


if __name__ == "__main__":
    main()
