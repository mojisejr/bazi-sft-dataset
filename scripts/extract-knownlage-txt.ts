/**
 * แตกไฟล์ .docx ใน knownlage/ → ข้อความล้วน knownlage/extracted/<slug>.txt
 * เพื่อให้ topic-knowledge.ts อ่าน knowledge ตอน runtime ได้ (ไม่ต้องพึ่ง docx parser)
 *
 * ใช้ unzip + python ที่มีในเครื่อง (docx = zip; เนื้อหาอยู่ word/document.xml)
 *   bun run scripts/extract-knownlage-txt.ts   (หรือ tsx)
 *
 * หมายเหตุ: ไฟล์ txt ที่ได้ถูก commit ไว้แล้ว สคริปต์นี้ไว้ re-generate เมื่อ docx อัปเดต
 */
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const KNOWLEDGE_DIR = path.resolve(process.cwd(), "knownlage");
const OUT_DIR = path.join(KNOWLEDGE_DIR, "extracted");

const TARGETS: Array<{ docx: string; out: string }> = [
  { docx: "สุขภาพ(พื้นฐาน).docx", out: "health.txt" },
  { docx: "Source7_ การเสริมดวง.docx", out: "source7-enhancement.txt" },
  { docx: "การเงินและการลงทุน.docx", out: "wealth.txt" },
  { docx: "การทายวัยจร.docx", out: "luck-cycle.txt" },
  { docx: "ความรักและความสัมพันธ์.docx", out: "love-family.txt" },
  { docx: "การงานและธุรกิจ.docx", out: "career-business.txt" },
];

const PY = [
  "import sys,re,html",
  "t=sys.stdin.read()",
  "t=re.sub(r'</w:p>','\\n',t)",
  "t=re.sub(r'<[^>]+>','',t)",
  "print(html.unescape(t))",
].join(";");

function extract(docx: string, out: string) {
  const inPath = path.join(KNOWLEDGE_DIR, docx);
  const outPath = path.join(OUT_DIR, out);
  execSync(`unzip -p "${inPath}" word/document.xml | python -c "${PY}" > "${outPath}"`, {
    shell: "/bin/bash",
    stdio: "inherit",
  });
  console.log(`extracted: ${docx} -> extracted/${out}`);
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const target of TARGETS) {
    extract(target.docx, target.out);
  }
}

main();
