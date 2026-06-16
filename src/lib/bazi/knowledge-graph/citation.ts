/**
 * Citation — provenance ของ evidence → footnote [n] (dedupe ตาม ref)
 * ระบบนี้เป็นของใหม่: เดิมคำอ่านไม่มีการอ้างอิงแหล่งกลับไปยังตารางต้นทาง
 */
import type { CitationEntry, KnowledgeGraphEvidence } from "./graph-types";

/** สร้างรายการอ้างอิง (ลำดับ 1..n) จาก evidence — dedupe ตาม provenance.ref */
export function buildCitations(evidence: readonly KnowledgeGraphEvidence[]): CitationEntry[] {
  const byRef = new Map<string, CitationEntry>();
  for (const item of evidence) {
    const ref = item.provenance.ref;
    if (byRef.has(ref)) continue;
    byRef.set(ref, {
      index: byRef.size + 1,
      ref,
      sourceTable: item.provenance.sourceTable,
      sourceFile: item.provenance.sourceFile,
    });
  }
  return [...byRef.values()];
}

/** map ref → หมายเลขอ้างอิง */
export function citationIndexByRef(citations: readonly CitationEntry[]): Map<string, number> {
  return new Map(citations.map((entry) => [entry.ref, entry.index]));
}

/** ต่อท้ายคำตอบด้วยรายการอ้างอิง "[n] ตาราง (ไฟล์)" */
export function appendCitationFootnotes(answer: string, citations: readonly CitationEntry[]): string {
  if (!citations.length) return answer;
  const lines = citations.map((entry) => `[${entry.index}] ${entry.sourceTable} (${entry.sourceFile})`);
  return `${answer.trim()}\n\n— อ้างอิง —\n${lines.join("\n")}`;
}
