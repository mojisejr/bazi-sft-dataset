"""
Local Claude proxy — แปลง Anthropic Messages API (/v1/messages) → เรียก Claude Code CLI (`claude -p`)
ใช้ subscription/auth เดิมของ Claude Code ที่ login ไว้ในเครื่อง (ไม่ต้องมี Anthropic API key แยก)

วิธีรัน (ใน terminal ที่ `claude` ใช้ได้):
    pip install fastapi uvicorn         # (ติดตั้งแล้วในเครื่องนี้)
    python scripts/local-claude-proxy.py
    # ถ้า `claude` ไม่อยู่ใน PATH ให้ตั้ง path เต็มก่อนรัน:
    #   PowerShell:  $env:CLAUDE_BIN = "C:\path\to\claude.cmd"; python scripts/local-claude-proxy.py

จากนั้นในแอป (.env): ANTHROPIC_PROXY_URL=http://localhost:4000  แล้ว restart `npm run dev`
เลือก provider "Local Claude (Anthropic)" — ช่อง API key ใส่อะไรก็ได้ (proxy ไม่ใช้ ใช้ auth ของ claude CLI)
"""

import os
import shutil
import subprocess
import sys
import tempfile

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn

CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
PORT = int(os.environ.get("LOCAL_CLAUDE_PORT", "4000"))
# timeout ต่อหนึ่งบท (claude -p รันสด อาจหลายสิบวินาที)
CALL_TIMEOUT = int(os.environ.get("LOCAL_CLAUDE_TIMEOUT", "240"))

app = FastAPI(title="Local Claude Proxy")


def _resolve_claude() -> list[str] | None:
    """หา claude binary — เลือก .exe จริงก่อน (เลี่ยง .cmd shim ที่ stdin EOF ค้างเมื่อผ่าน cmd /c)"""
    candidates: list[str] = []
    if CLAUDE_BIN and CLAUDE_BIN != "claude":
        candidates.append(CLAUDE_BIN)
    # npm global native exe (claude.cmd ชี้มาที่นี่)
    appdata = os.environ.get("APPDATA", "")
    if appdata:
        candidates.append(os.path.join(
            appdata, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe"))
    for c in candidates:
        if c and os.path.isfile(c):
            return [c]
    # fallback PATH — เอา .exe ก่อน .cmd
    for name in ("claude.exe", "claude", "claude.cmd"):
        found = shutil.which(name)
        if found:
            return [found]
    return None


def _extract_user_text(messages: list) -> str:
    parts: list[str] = []
    for msg in messages:
        if msg.get("role") != "user":
            continue
        content = msg.get("content")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    parts.append(block.get("text", ""))
    return "\n\n".join(p for p in parts if p)


@app.post("/v1/messages")
async def messages(request: Request):
    body = await request.json()
    system_text = body.get("system") or ""
    if isinstance(system_text, list):  # เผื่อ system เป็น content blocks
        system_text = "\n".join(
            b.get("text", "") for b in system_text if isinstance(b, dict)
        )
    user_text = _extract_user_text(body.get("messages", []))
    model = body.get("model") or "claude-code-local"

    claude_cmd = _resolve_claude()
    if not claude_cmd:
        return JSONResponse(
            status_code=500,
            content={"type": "error", "error": {"type": "api_error",
                     "message": f"หา claude CLI ไม่เจอ (CLAUDE_BIN={CLAUDE_BIN}) — ตั้ง env CLAUDE_BIN เป็น path เต็ม"}},
        )

    # รวม system + user เป็น prompt เดียวส่งทาง stdin — เลี่ยงปัญหา argv ยาว/มีขึ้นบรรทัดใหม่บน Windows
    combined = f"{system_text}\n\n{user_text}" if system_text.strip() else user_text

    exe = claude_cmd[0]
    base = [*claude_cmd, "-p", "--output-format", "text"]
    # .cmd/.bat บน Windows ต้องเรียกผ่าน cmd /c (subprocess shell=False เรียกตรงไม่ได้ → WinError 193)
    if os.name == "nt" and exe.lower().endswith((".cmd", ".bat")):
        cmd = ["cmd", "/c", *base]
    else:
        cmd = base

    try:
        proc = subprocess.run(
            cmd,
            input=combined,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=CALL_TIMEOUT,
            cwd=tempfile.gettempdir(),  # รันใน temp dir — กัน claude อ่าน CLAUDE.md/สำรวจ repo
        )
    except subprocess.TimeoutExpired:
        return JSONResponse(status_code=504, content={"type": "error",
            "error": {"type": "api_error", "message": "claude CLI timeout"}})
    except FileNotFoundError as exc:
        return JSONResponse(status_code=500, content={"type": "error",
            "error": {"type": "api_error", "message": f"spawn claude ล้มเหลว: {exc}"}})

    if proc.returncode != 0:
        detail = ((proc.stderr or "").strip() + " | " + (proc.stdout or "").strip()).strip(" |")
        return JSONResponse(status_code=500, content={"type": "error",
            "error": {"type": "api_error",
                      "message": f"claude CLI exit {proc.returncode}: {detail[:800] or '(no output)'}"}})

    text = (proc.stdout or "").strip()
    return {
        "id": "msg_local_claude",
        "type": "message",
        "role": "assistant",
        "model": model,
        "content": [{"type": "text", "text": text}],
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 0, "output_tokens": 0},
    }


@app.get("/health")
async def health():
    return {"ok": True, "claude": bool(_resolve_claude())}


if __name__ == "__main__":
    if not _resolve_claude():
        print(f"[warn] หา claude CLI ไม่เจอ (CLAUDE_BIN={CLAUDE_BIN}). "
              f"ตั้ง $env:CLAUDE_BIN เป็น path เต็มของ claude ก่อนรัน", file=sys.stderr)
    print(f"Local Claude proxy → http://localhost:{PORT}  (POST /v1/messages → claude -p)")
    uvicorn.run(app, host="127.0.0.1", port=PORT)
