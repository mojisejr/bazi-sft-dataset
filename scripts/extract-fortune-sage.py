#!/usr/bin/env python3
"""Extract the "เซียนเสี่ยงทาย" table (60 หัวเซี่ยงแซ / กะจื่อ) into committed JSON.

Dev tool (run manually): reads knownlage/เซียนเสี่ยงทาย/เซียนเสี่ยงทาย.xlsx and
writes src/lib/bazi/data/fortune-sage.json — the deterministic deck consumed by
src/lib/bazi/fortune-sage/deck.ts (feature "เซียนเสี่ยงทาย"). Requires openpyxl.

Sheet1 columns (0-indexed):
  0 ลำดับ | 1 ราศีบนหลักวัน | 2 ราศีล่างหลักวัน | 3 หนับอิม | 4 นิสัยและพฤติกรรม
  5 การงาน | 6 การเงิน | 7 สุขภาพ | 8 ความรัก | 9 ครอบครัว | 10 องค์เทพ

รูปไพ่เก็บเป็น public URL ใน field `imageUrl` (อัปโหลดด้วย scripts/import-fortune-sage-images.ts)
— สคริปต์นี้จะ merge `imageUrl` เดิมจาก JSON ที่มีอยู่ตาม `no` ไม่ให้ลิงก์หายตอนรีเจน.

Usage: python scripts/extract-fortune-sage.py
"""
import json
import os

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "knownlage", "เซียนเสี่ยงทาย", "เซียนเสี่ยงทาย.xlsx")
OUT = os.path.join(ROOT, "src", "lib", "bazi", "data", "fortune-sage.json")


def clean(value):
    if value is None:
        return ""
    # ข้อความบางช่อง (เช่น นิสัยและพฤติกรรม) มีแท็บค้างท้ายจำนวนมาก
    return str(value).replace("\t", " ").strip()


def main():
    # carry over imageUrl เดิม (ถ้ามี) ตาม no — กันลิงก์หายตอนรีเจน
    prev_image = {}
    if os.path.exists(OUT):
        try:
            with open(OUT, encoding="utf-8") as fh:
                for item in json.load(fh):
                    if item.get("imageUrl"):
                        prev_image[item["no"]] = item["imageUrl"]
        except (ValueError, OSError):
            pass

    wb = openpyxl.load_workbook(SRC, data_only=True)
    ws = wb["Sheet1"]

    sticks = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] is None:
            continue
        try:
            no = int(float(row[0]))
        except (TypeError, ValueError):
            continue
        stem = clean(row[1])
        branch = clean(row[2])
        sticks.append(
            {
                "no": no,
                "stem": stem,
                "branch": branch,
                "pillar": stem + branch,
                "nayin": clean(row[3]),
                "personality": clean(row[4]),
                "deity": clean(row[10]),
                "topics": {
                    "career": clean(row[5]),
                    "finance": clean(row[6]),
                    "health": clean(row[7]),
                    "love": clean(row[8]),
                    "family": clean(row[9]),
                },
                "imageUrl": prev_image.get(no),
            }
        )

    sticks.sort(key=lambda s: s["no"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(sticks, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"OK wrote {len(sticks)} sticks -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
