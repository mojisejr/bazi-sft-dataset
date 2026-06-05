#!/usr/bin/env python3
"""Extract structured Bazi source data from docs/ originals into knownlage/extracted/*.txt.

Dev tool (run manually): regenerates the deterministic knowledge files consumed by
src/lib/bazi/topic-knowledge.ts. Requires python-docx and openpyxl.

Outputs:
  - knownlage/extracted/love-day-pillar.txt   (from ความรัก xlsx, sheet "หลักวันเท่านั้น")
  - knownlage/extracted/source7-custom.txt     (deity tables 6/7 from Source7 docx §5)
  - knownlage/extracted/kheangkhung-reference.txt (ตำราเคี้ยงคุง full text, fallback ref)
"""
import os
import re

import docx
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
OUT = os.path.join(ROOT, "knownlage", "extracted")

STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]


def write(name, lines):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"wrote {name}: {len(lines)} lines")


def extract_love_day_pillar():
    """Pair each day-stem verdict row (A) with its branch/12-qi/spouse row (B).

    Day pillars obey stem-branch parity (yang stem -> yang branch), so the 6 rows
    listed per stem are exactly the valid (dayStem, dayBranch) day pillars.
    """
    wb = openpyxl.load_workbook(
        os.path.join(DOCS, "ความรัก (หลักวัน ราศีบน-ล่าง).xlsx"),
        read_only=True, data_only=True,
    )
    ws = wb["หลักวันเท่านั้น"]
    rows = []
    for row in ws.iter_rows(values_only=True):
        cells = [str(c).strip() for c in row if c is not None and str(c).strip()]
        if cells:
            rows.append(cells)

    out = [
        "# love day-pillar verdicts (source: ความรัก หลักวันเท่านั้น)",
        "# format: STEM BRANCH QI | spouseText | reactionText",
    ]
    pending_stem = None
    pending_reaction = None
    for cells in rows:
        # A-row: <elem-code> <stem> <num> <reactionText>  (stem is cells[1])
        if len(cells) >= 4 and cells[1] in STEMS and re.match(r"^\d+(\.\d+)?$", cells[2]):
            pending_stem = cells[1]
            pending_reaction = cells[3]
            continue
        # B-row: <num> <branch> <qi> <spouseText>
        if len(cells) >= 4 and cells[1] in BRANCHES and pending_stem:
            branch, qi, spouse = cells[1], cells[2], cells[3]
            out.append(f"{pending_stem} {branch} {qi} | {spouse} | {pending_reaction or '-'}")
            pending_stem = None
            pending_reaction = None
    return out


def extract_source7_custom():
    d = docx.Document(os.path.join(DOCS, "Source7_ การเสริมดวง.docx"))
    out = ["# Source7 §5 custom guardian deities by chart character"]

    # Table 6: ราศีบน (heavenly stem) -> deities ; Table 7: ราศีล่าง (branch) -> deities
    def emit(table, header, keyset):
        out.append(header)
        for r in table.rows[1:]:
            cells = [c.text.strip() for c in r.cells]
            if len(cells) >= 2 and cells[0] in keyset and cells[1]:
                out.append(f"{cells[0]} | {cells[1]}")

    emit(d.tables[6], "# DEITY_UPPER", set(STEMS))
    emit(d.tables[7], "# DEITY_LOWER", set(BRANCHES))
    return out


def extract_kheangkhung():
    d = docx.Document(os.path.join(DOCS, "ตำราโหราศาสตร์เคี้ยงคุง.docx"))
    out = ["# ตำราโหราศาสตร์เคี้ยงคุง (foundational reference, fallback)"]
    for p in d.paragraphs:
        t = p.text.strip()
        if t:
            out.append(t)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    write("love-day-pillar.txt", extract_love_day_pillar())
    write("source7-custom.txt", extract_source7_custom())
    write("kheangkhung-reference.txt", extract_kheangkhung())


if __name__ == "__main__":
    main()
