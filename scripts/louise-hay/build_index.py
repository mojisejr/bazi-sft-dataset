#!/usr/bin/env python
"""
Build the Louise Hay retrieval index from the assembled corpus.

Chunks each book into ~paragraph-sized passages (page-tagged for citation),
embeds them with Gemini `gemini-embedding-001` (reduced to 768 dims, L2-normalized
so cosine == dot product), and writes a single in-process index the chat route
loads at runtime.

Output: src/lib/louise-hay/data/louise-hay-index.json
"""
from __future__ import annotations

import json
import math
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CORPUS_DIR = HERE / "corpus"
OUT = ROOT / "src" / "lib" / "louise-hay" / "data" / "louise-hay-index.json"

EMBED_MODEL = "models/gemini-embedding-001"
EMBED_DIM = 768
TARGET_CHARS = 700          # aim for coherent, retrieval-sized Thai passages
MAX_CHARS = 1100            # hard flush ceiling


def load_key() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("GEMINI_API_KEY not found")


def chunk_book(book: dict) -> list[dict]:
    """Greedily merge page paragraphs into ~TARGET_CHARS passages, tracking page span."""
    chunks: list[dict] = []
    buf: list[str] = []
    buf_len = 0
    start_page = None
    end_page = None

    def flush():
        nonlocal buf, buf_len, start_page, end_page
        if buf:
            text = "\n\n".join(buf).strip()
            if len(text) >= 40:  # drop stray fragments
                chunks.append({"text": text, "startPage": start_page, "endPage": end_page})
        buf, buf_len, start_page, end_page = [], 0, None, None

    for page in book["pages"]:
        for para in [p.strip() for p in page["text"].split("\n\n") if p.strip()]:
            if start_page is None:
                start_page = page["page"]
            end_page = page["page"]
            buf.append(para)
            buf_len += len(para)
            if buf_len >= TARGET_CHARS:
                # overflow guard: if a single para blew past MAX, still flush
                flush()
    flush()
    return chunks


def embed(text: str, key: str, task_type: str) -> list[float]:
    url = f"https://generativelanguage.googleapis.com/v1beta/{EMBED_MODEL}:embedContent?key={key}"
    payload = {
        "model": EMBED_MODEL,
        "content": {"parts": [{"text": text}]},
        "taskType": task_type,
        "outputDimensionality": EMBED_DIM,
    }
    for attempt in range(5):
        r = requests.post(url, json=payload, timeout=60)
        if r.status_code == 200:
            v = r.json()["embedding"]["values"]
            norm = math.sqrt(sum(x * x for x in v)) or 1.0
            return [x / norm for x in v]
        if r.status_code in (429, 500, 503):
            time.sleep(2 * (attempt + 1))
            continue
        raise SystemExit(f"embed failed {r.status_code}: {r.text[:200]}")
    raise SystemExit("embed retries exhausted")


def main() -> None:
    key = load_key()
    corpus_files = sorted(CORPUS_DIR.glob("*.json"))
    if not corpus_files:
        raise SystemExit("no corpus files — run assemble_corpus.py first")

    records = []
    cid = 0
    for cf in corpus_files:
        book = json.loads(cf.read_text(encoding="utf-8"))
        book_chunks = chunk_book(book)
        print(f"{book['slug']}: {len(book_chunks)} chunks", flush=True)
        for ch in book_chunks:
            vec = embed(ch["text"], key, "RETRIEVAL_DOCUMENT")
            records.append({
                "id": f"{book['slug']}-{cid:04d}",
                "book": book["slug"],
                "title": book["title"],
                "startPage": ch["startPage"],
                "endPage": ch["endPage"],
                "text": ch["text"],
                "embedding": vec,
            })
            cid += 1
            if cid % 25 == 0:
                print(f"  embedded {cid}...", flush=True)
            time.sleep(0.15)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    index = {
        "model": EMBED_MODEL,
        "dim": EMBED_DIM,
        "normalized": True,
        "queryTaskType": "RETRIEVAL_QUERY",
        "count": len(records),
        "chunks": records,
    }
    OUT.write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(f"wrote {len(records)} chunks -> {OUT} ({size_mb:.1f} MB)", flush=True)


if __name__ == "__main__":
    main()
