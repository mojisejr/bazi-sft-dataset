#!/usr/bin/env python
"""
Fold the per-page OCR text (scripts/louise-hay/ocr-out/<slug>/pNNN.txt) into one
clean corpus JSON per book at scripts/louise-hay/corpus/<slug>.json.

Drops [BLANK] pages and any pages that still hold an OCR error marker, tidies
whitespace, and records the page number so retrieval can cite it.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
OCR_DIR = HERE / "ocr-out"
CORPUS_DIR = HERE / "corpus"
ERR_PREFIX = "[[OCR_ERROR"

# Titles confirmed from the scanned cover/title pages (Thai NANMEEBOOKS editions).
BOOKS = {
    "power": {
        "title": "พลังแห่งการรักตัวเอง",
        "titleEn": "The Power Is Within You",
        "source": "01.LouiseHayThepowerIsWithinU.pdf",
    },
    "book03": {
        "title": "",  # filled from OCR page 1 if left blank
        "titleEn": "",
        "source": "03LH.pdf",
    },
    "book05": {
        "title": "",
        "titleEn": "",
        "source": "05LH.pdf",
    },
}


def clean(text: str) -> str:
    text = text.replace("\r\n", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def guess_title(first_text: str) -> str:
    lines = [ln.strip() for ln in first_text.splitlines() if ln.strip()]
    # skip publisher / author lines, take the first Thai-looking line
    for ln in lines:
        if re.search(r"[ก-๙]", ln) and "NANMEE" not in ln.upper():
            return ln
    return lines[0] if lines else ""


def main() -> None:
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    for slug, meta in BOOKS.items():
        book_dir = OCR_DIR / slug
        if not book_dir.exists():
            print(f"[skip] no OCR for {slug}")
            continue
        pages = []
        first_text = ""
        for f in sorted(book_dir.glob("p*.txt")):
            raw = f.read_text(encoding="utf-8").strip()
            if not raw or raw == "[BLANK]" or raw.startswith(ERR_PREFIX):
                continue
            page_no = int(re.search(r"p(\d+)", f.stem).group(1))
            body = clean(raw)
            if not first_text:
                first_text = body
            pages.append({"page": page_no, "text": body})

        title = meta["title"] or guess_title(first_text)
        out = {
            "slug": slug,
            "title": title,
            "titleEn": meta["titleEn"],
            "source": meta["source"],
            "pageCount": len(pages),
            "pages": pages,
        }
        dst = CORPUS_DIR / f"{slug}.json"
        dst.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        chars = sum(len(p["text"]) for p in pages)
        print(f"{slug}: title={title!r} pages={len(pages)} chars={chars} -> {dst.name}")


if __name__ == "__main__":
    main()
