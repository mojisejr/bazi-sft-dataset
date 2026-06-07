# -*- coding: utf-8 -*-
"""
Extract the two "12 เชี่ยงแซ" knowledge docx into Markdown so the hybrid-retrieval
twelve_qi_cycle dictionary can pull excerpts from them.

The dictionary spec (src/lib/bazi/dictionaries/twelve-qi-cycle.ts) references:
  - "ตาราง 12 เชี่ยงแซ/ตาราง 12 เชี่ยงแซ.md"
  - "ระบบ 12 เชี่ยงแซ 十二長生.md"
relative to the distilled corpus root. The external corpus is not always present,
so we also write a repo-local mirror under knownlage/distilled/<relativePath> which
hybrid-retrieval falls back to when the external corpus file is missing.

Run:  python scripts/extract-twelve-qi-docx.py
"""
import os
import sys
import unicodedata

import docx  # python-docx

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(REPO_ROOT, "knownlage")
OUT_DIR = os.path.join(REPO_ROOT, "knownlage", "distilled")

# docx file (under knownlage/)  ->  relative md path expected by the dictionary
JOBS = [
    ("ตาราง 12 เชี่ยงแซ.docx", "ตาราง 12 เชี่ยงแซ/ตาราง 12 เชี่ยงแซ.md"),
    ("ระบบ 12 เชี่ยงแซ 十二長生.docx", "ระบบ 12 เชี่ยงแซ 十二長生.md"),
]


def norm(text):
    # U+F971 (辰 compatibility) -> U+8FB0 ; recombine สระอำ ที่สะกดเพี้ยน
    return unicodedata.normalize("NFKC", text or "").replace("ํา", "ำ")


def table_to_md(table):
    lines = []
    for r, row in enumerate(table.rows):
        cells = [norm(c.text).replace("\n", " ").replace("|", "/").strip() for c in row.cells]
        lines.append("| " + " | ".join(cells) + " |")
        if r == 0:
            lines.append("| " + " | ".join(["---"] * len(cells)) + " |")
    return "\n".join(lines)


def iter_block_items(doc):
    """Yield paragraphs and tables in document order."""
    from docx.document import Document as _Doc
    from docx.oxml.table import CT_Tbl
    from docx.oxml.text.paragraph import CT_P
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    parent_elm = doc.element.body
    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, doc)
        elif isinstance(child, CT_Tbl):
            yield Table(child, doc)


def convert(doc):
    out = []
    for block in iter_block_items(doc):
        if block.__class__.__name__ == "Paragraph":
            text = norm(block.text).strip()
            if text:
                out.append(text)
        else:  # Table
            md = table_to_md(block)
            if md.strip():
                out.append("")
                out.append(md)
                out.append("")
    return "\n".join(out).strip() + "\n"


def main():
    for docx_name, rel_md in JOBS:
        src = os.path.join(SRC_DIR, docx_name)
        if not os.path.exists(src):
            print(f"SKIP missing: {src}", file=sys.stderr)
            continue
        doc = docx.Document(src)
        md = convert(doc)
        dst = os.path.join(OUT_DIR, rel_md)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"wrote {dst}  ({len(md)} chars)")


if __name__ == "__main__":
    main()
