#!/usr/bin/env python3
"""Extract the "ไพ่ออราเคิลเคี้ยงคุง" deck (120 cards) into committed JSON.

Dev tool (run manually): reads knownlage/ไพ่ออราเคิลเคี้ยงคุง/ไพ่ออราเคิลเคี้ยงคุง.xlsx
and writes src/lib/bazi/data/oracle-cards.json — the deterministic deck consumed by
src/lib/bazi/oracle-cards/deck.ts (feature "ไพ่ออราเคิลเคี้ยงคุง"). Requires openpyxl.

Sheet columns (0-indexed):
  0 cardnumber | 1 filename (=ชื่อไพ่) | 2 Keyword | 3 meaning | 4 Book1 | 5 Book2
  6 Person | 7 Work | 8 Wealth | 9 Love | 10 Health | 11 disease | 12 Family
  13 location | 14 Direction | 15 Element | 16 Color | 17 Form | 18 occupation
  19 God | 20 Animal

The 15 aspect columns (6..20) are kept under `aspects` and fed to the LLM as
supplementary context; core reading text = meaning + book1.

Usage: python scripts/extract-oracle-cards.py
"""
import glob
import json
import os
import unicodedata

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_GLOB = os.path.join(ROOT, "knownlage", "**", "ไพ่ออราเคิล*.xlsx")
OUT = os.path.join(ROOT, "src", "lib", "bazi", "data", "oracle-cards.json")

# aspect column index -> json key
ASPECTS = {
    6: "person",
    7: "work",
    8: "wealth",
    9: "love",
    10: "health",
    11: "disease",
    12: "family",
    13: "location",
    14: "direction",
    15: "element",
    16: "color",
    17: "form",
    18: "occupation",
    19: "god",
    20: "animal",
}


def norm(value):
    if value is None:
        return ""
    return unicodedata.normalize("NFKC", str(value)).replace("ํา", "ำ").strip()


def main():
    matches = glob.glob(SRC_GLOB, recursive=True)
    if not matches:
        raise SystemExit("ไม่พบไฟล์ ไพ่ออราเคิล*.xlsx ใน knownlage/")
    src = matches[0]
    wb = openpyxl.load_workbook(src, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))

    cards = []
    for row in rows[1:]:
        if row[0] is None:
            continue
        try:
            no = int(float(row[0]))
        except (TypeError, ValueError):
            continue
        aspects = {}
        for idx, key in ASPECTS.items():
            val = norm(row[idx]) if idx < len(row) else ""
            if val:
                aspects[key] = val
        cards.append(
            {
                "no": no,
                "name": norm(row[1]),
                "keyword": norm(row[2]),
                "meaning": norm(row[3]),
                "book1": norm(row[4]),
                "book2": norm(row[5]) if len(row) > 5 else "",
                "aspects": aspects,
            }
        )

    cards.sort(key=lambda c: c["no"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(cards, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"OK wrote {len(cards)} cards -> {os.path.relpath(OUT, ROOT)}")
    missing = [c["no"] for c in cards if not c["name"] or not c["book1"]]
    if missing:
        print(f"WARN cards missing name/book1: {missing}")


if __name__ == "__main__":
    main()
