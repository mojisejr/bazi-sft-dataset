#!/usr/bin/env python
"""
OCR the Louise Hay (Thai translation) scanned books into searchable text.

The source PDFs live in "Louise Hay/". Five files map to three unique books
(01==02, 03==04 by content), all image-only scans (no text layer), so we render
each page and OCR it with Gemini vision.

Output: one plain-text file per page under scripts/louise-hay/ocr-out/<slug>/pNNN.txt
(resumable — an existing non-empty, non-error file is skipped). Run
assemble_corpus.py afterwards to fold the pages into a single JSON corpus.

Usage:
  python scripts/louise-hay/ocr_books.py                 # all books, all pages
  python scripts/louise-hay/ocr_books.py --only power    # one book slug
  python scripts/louise-hay/ocr_books.py --pages 1-3     # first 3 pages (testing)
"""
from __future__ import annotations

import argparse
import base64
import os
import sys
import time
from pathlib import Path

import fitz  # PyMuPDF
import requests

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "Louise Hay"
OUT_DIR = Path(__file__).resolve().parent / "ocr-out"

MODEL = "gemini-2.5-flash"
RENDER_DPI = 200
ERR_PREFIX = "[[OCR_ERROR"

# slug -> source pdf (deduped: 02/04 are byte-identical copies of 01/03).
BOOKS = {
    "power": "01.LouiseHayThepowerIsWithinU.pdf",
    "book03": "03LH.pdf",
    "book05": "05LH.pdf",
}

OCR_PROMPT = (
    "You are a precise OCR engine for scanned Thai-language books.\n"
    "Transcribe ALL text on this page EXACTLY as printed, in reading order.\n"
    "Rules:\n"
    "- Output the Thai (and any English) text verbatim. Do not translate, summarize, "
    "correct, or add anything.\n"
    "- Preserve paragraph breaks with blank lines. Put a heading on its own line.\n"
    "- Ignore page decorations, running headers/footers, and standalone page numbers.\n"
    "- If the page has no readable body text (cover art, blank, only a page number), "
    "output exactly: [BLANK]\n"
    "- Return ONLY the transcription, with no commentary or code fences."
)


def load_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key.strip()
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("GEMINI_API_KEY not found in env or .env")


def ocr_image(png_bytes: bytes, api_key: str) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{MODEL}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": OCR_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": base64.b64encode(png_bytes).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 4096},
    }
    last_err = ""
    for attempt in range(5):
        try:
            r = requests.post(url, json=payload, timeout=120)
            if r.status_code == 200:
                data = r.json()
                cands = data.get("candidates", [])
                if not cands:
                    return "[BLANK]"
                parts = cands[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts).strip()
                return text or "[BLANK]"
            if r.status_code in (429, 500, 503):
                last_err = f"{r.status_code}"
                time.sleep(2 * (attempt + 1))
                continue
            return f"{ERR_PREFIX} http={r.status_code} {r.text[:200]}]]"
        except requests.RequestException as exc:  # network hiccup
            last_err = str(exc)
            time.sleep(2 * (attempt + 1))
    return f"{ERR_PREFIX} exhausted last={last_err}]]"


def parse_pages_arg(arg: str | None, page_count: int) -> range:
    if not arg:
        return range(page_count)
    if "-" in arg:
        a, b = arg.split("-", 1)
        return range(int(a) - 1, min(int(b), page_count))
    n = int(arg)
    return range(n - 1, min(n, page_count))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="slug to process (power|book03|book05)")
    ap.add_argument("--pages", help="1-based page range e.g. 1-3")
    args = ap.parse_args()

    api_key = load_api_key()
    books = {args.only: BOOKS[args.only]} if args.only else BOOKS

    for slug, fname in books.items():
        pdf_path = SRC_DIR / fname
        if not pdf_path.exists():
            print(f"[skip] missing {pdf_path}")
            continue
        doc = fitz.open(pdf_path)
        out = OUT_DIR / slug
        out.mkdir(parents=True, exist_ok=True)
        mat = fitz.Matrix(RENDER_DPI / 72, RENDER_DPI / 72)
        pages = parse_pages_arg(args.pages, doc.page_count)
        print(f"=== {slug} ({fname}) {doc.page_count} pages; processing {len(pages)} ===", flush=True)
        for p in pages:
            dst = out / f"p{p + 1:03d}.txt"
            if dst.exists():
                existing = dst.read_text(encoding="utf-8").strip()
                if existing and not existing.startswith(ERR_PREFIX):
                    print(f"  p{p + 1:03d} skip (done, {len(existing)} chars)", flush=True)
                    continue
            png = doc[p].get_pixmap(matrix=mat).tobytes("png")
            text = ocr_image(png, api_key)
            dst.write_text(text, encoding="utf-8")
            flag = " ERROR" if text.startswith(ERR_PREFIX) else ""
            print(f"  p{p + 1:03d} -> {len(text)} chars{flag}", flush=True)
            time.sleep(0.4)
        doc.close()

    print("done.", flush=True)


if __name__ == "__main__":
    main()
