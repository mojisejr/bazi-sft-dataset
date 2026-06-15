#!/usr/bin/env python3
"""Extract the "ไพ่จิตวิญญาณแดนสวรรค์" deck (80 cards) into committed JSON.

Dev tool (run manually): reads knownlage/ไพ่เทพ/ไพ่จิตวิญญาณแดนสวรรค์.xlsx and
writes src/lib/bazi/data/divine-cards.json — the deterministic deck consumed by
src/lib/bazi/divine-cards/deck.ts (feature "โหมดเซียน"). Requires openpyxl.

Sheet1 columns (0-indexed):
  0 No | 1 หมวดไพ่ | 2 ชื่อไพ่ | 3 Keyword(EN) | 4 คำสำคัญ
  5 ภาพชีวิต | 6 คำทำนายแดนสวรรค์
(the "Bio" header column is only sparsely/inconsistently filled in the source, so
it is intentionally dropped.)

Usage: python scripts/extract-divine-cards.py
"""
import json
import os
import unicodedata

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "knownlage", "ไพ่เทพ", "ไพ่จิตวิญญาณแดนสวรรค์.xlsx")
OUT = os.path.join(ROOT, "src", "lib", "bazi", "data", "divine-cards.json")


def norm(value):
    if value is None:
        return ""
    return unicodedata.normalize("NFKC", str(value)).replace("ํา", "ำ").strip()


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    ws = wb["Sheet1"]
    rows = list(ws.iter_rows(values_only=True))

    cards = []
    for row in rows[1:]:
        if row[0] is None:
            continue
        try:
            no = int(float(row[0]))
        except (TypeError, ValueError):
            continue
        cards.append(
            {
                "no": no,
                "group": norm(row[1]),
                "name": norm(row[2]),
                "keywordEn": norm(row[3]),
                "keywords": norm(row[4]),
                "lifeImage": norm(row[5]),
                "prophecy": norm(row[6]),
            }
        )

    cards.sort(key=lambda c: c["no"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(cards, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"OK wrote {len(cards)} cards -> {os.path.relpath(OUT, ROOT)}")
    missing = [c["no"] for c in cards if not c["name"] or not c["prophecy"]]
    if missing:
        print(f"WARN cards missing name/prophecy: {missing}")


if __name__ == "__main__":
    main()
