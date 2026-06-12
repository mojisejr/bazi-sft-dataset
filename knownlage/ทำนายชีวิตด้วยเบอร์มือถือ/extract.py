# -*- coding: utf-8 -*-
"""
Extract phone-number pair meanings (เลขพยากรณ์) from the source PDF into JSON.

Run once:  python extract.py
Requires:  pdftotext (poppler) on PATH.

Output: ../../src/lib/bazi/data/phone/phone-pair-meanings.json  (55 canonical keys)
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, "ทำนายชีวิตด้วยเบอร์มือถือ.pdf")
CLEAN = os.path.join(HERE, "_clean.txt")
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "src", "lib", "bazi", "data", "phone"))
OUT = os.path.join(OUT_DIR, "phone-pair-meanings.json")


def run_pdftotext():
    # pages 27-79 hold the 00-99 pair meanings.
    # -layout keeps the centered "คำทำนายหมายเลข NN-NN" headers on their own lines.
    subprocess.run(
        ["pdftotext", "-f", "27", "-l", "79", "-enc", "UTF-8", "-layout", PDF, CLEAN],
        check=True,
    )


def normalize(s: str) -> str:
    # pdftotext splits sara-am (ำ) into า + ํ ; rejoin it.
    s = s.replace("าํ", "ำ").replace("ํา", "ำ")
    # drop running footer / header lines
    lines = []
    for ln in s.splitlines():
        t = ln.strip()
        if not t:
            continue
        if "ครเู อก" in t and "ห น" in t:  # footer
            continue
        if re.fullmatch(r"\d+\s*\|\s*ห\s*น\s*้?\s*า.*", t):
            continue
        lines.append(t)
    return "\n".join(lines)


def canonical(nn: str) -> str:
    a, b = nn[0], nn[1]
    return a + b if a <= b else b + a


# section label -> output field. Labels are matched loosely (spaces removed).
SECTIONS = [
    ("ดา้ นความรสู้ กึ", "feeling"),
    ("ดา้ นความรู้สึก", "feeling"),
    ("ดา้ นการงาน", "work"),
    ("ดา้ นการทำ งาน", "work"),
    ("ดา้ นการทำงาน", "work"),
    ("ดา้ นการเงนิ", "money"),
    ("ดา้ นการเงิน", "money"),
    ("ดา้ นความรกั", "love"),
    ("ดา้ นความรัก", "love"),
    ("บทวเิ คราะห", "analysis"),
    ("บทวิเคราะห", "analysis"),
]


def squash(s: str) -> str:
    return re.sub(r"\s+", "", s)


def parse():
    raw = open(CLEAN, encoding="utf-8").read()
    text = normalize(raw)

    # Headers are centered lines like "คำทำนายหมายเลข 01-10" / "...-30" / "...66".
    # The LEADING digit is unreliable in OCR, but the LAST two digits are reliable,
    # so we identify the pair from the final 2 digits and canonicalize.
    # The 7 doubled-digit pairs (11,22,33,44,55,88,99) render their number as a
    # single glyph that pdftotext drops, so their headers carry no digits. They
    # appear in this fixed document order — assign them positionally.
    DOUBLES = ["11", "22", "33", "44", "55", "88", "99"]
    dq = list(DOUBLES)

    lines = text.split("\n")
    headers = []  # (line_index, key)
    for idx, ln in enumerate(lines):
        sq = squash(ln)
        if "นายหมายเลข" not in sq:
            continue
        digits = re.sub(r"[^0-9]", "", sq.split("นายหมายเลข", 1)[1])
        if len(digits) < 2:
            if dq:
                headers.append((idx, dq.pop(0)))
            continue
        nn = digits[-2:]
        headers.append((idx, canonical(nn)))

    result = {}
    for h, (line_idx, key) in enumerate(headers):
        end = headers[h + 1][0] if h + 1 < len(headers) else len(lines)
        body = "\n".join(lines[line_idx + 1:end])

        # split body into sections by "- <label>"
        # find each label position
        marks = []
        for label, field in SECTIONS:
            for m in re.finditer(r"-\s*" + re.escape(label), body):
                marks.append((m.start(), m.end(), field, label))
        marks.sort()
        if not marks:
            continue
        sect = {}
        for idx, (st, en, field, label) in enumerate(marks):
            nxt = marks[idx + 1][0] if idx + 1 < len(marks) else len(body)
            chunk = body[en:nxt].strip(" \n-")
            chunk = re.sub(r"\s*\n\s*", " ", chunk).strip()
            # drop an orphan leading combining mark (e.g. "์" left from "บทวิเคราะห์")
            chunk = re.sub(r"^[ัิ-ฺ็-๎]+\s*", "", chunk)
            chunk = re.sub(r"\s{2,}", " ", chunk).strip(" \n-")
            if field not in sect or len(chunk) > len(sect.get(field, "")):
                sect[field] = chunk
        # keep first occurrence of each canonical key (00-99 order, canonical = lower)
        if key not in result:
            result[key] = {"pair": key, **{f: sect.get(f, "") for f in ["feeling", "work", "money", "love", "analysis"]}}
    return result


def main():
    run_pdftotext()
    result = parse()
    os.makedirs(OUT_DIR, exist_ok=True)
    # report
    keys = sorted(result.keys())
    print("pairs parsed:", len(keys))
    missing_fields = {k: [f for f in ["feeling", "work", "money", "love", "analysis"] if not v[f]]
                      for k, v in result.items()}
    blanks = {k: f for k, f in missing_fields.items() if f}
    if blanks:
        print("WARNING blank fields:")
        for k, f in sorted(blanks.items()):
            print("  ", k, f)
    # expected 55 canonical keys
    expected = set()
    for a in range(10):
        for b in range(a, 10):
            expected.add(f"{a}{b}")
    miss = sorted(expected - set(keys))
    if miss:
        print("MISSING canonical keys:", miss)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2, sort_keys=True)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
