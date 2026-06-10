"use client";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import type { RelationshipLineRow } from "@/components/bazi/reading/TopicCard";

type RelationshipLinesEditorProps = {
  rows: RelationshipLineRow[];
  onChange: (rows: RelationshipLineRow[]) => void;
  /** กด gen ช่อง "คำอธิบายดี-ร้ายเชิงลึก" ทั้งตารางด้วย LLM */
  onGenerateDeepNotes: () => void;
  /** กำลัง gen อยู่ (ปิดปุ่ม + แสดงสถานะ) */
  generating: boolean;
  /** พร้อม gen ไหม (มี API key/provider แล้ว) — ปิดปุ่มถ้ายังไม่พร้อม */
  canGenerate: boolean;
};

/**
 * บทเสริม (ต่อจากบทที่ 15): ตารางวิเคราะห์เส้นขีดความสัมพันธ์ หมวดช่วงอายุ/วัยจร
 * แก้ไขได้ทุกช่อง (ซินแสปรับถ้อยคำเอง) + ปุ่ม gen ช่อง "คำอธิบายดี-ร้ายเชิงลึก" ด้วย LLM
 * ค่าที่แก้ถูกเก็บใน workspace state → บันทึกลง DB และพิมพ์ลง PDF/.docx ตามที่แก้
 */
export function RelationshipLinesEditor({
  rows,
  onChange,
  onGenerateDeepNotes,
  generating,
  canGenerate,
}: RelationshipLinesEditorProps) {
  function updateCell(index: number, field: keyof RelationshipLineRow, value: string) {
    onChange(rows.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)));
  }

  return (
    <section className="surface reading-path__appendix" aria-label="บทเสริม">
      <SectionHeading
        kicker="บทเสริม (ต่อจากบทที่ 15)"
        title="ตารางวิเคราะห์เส้นขีดความสัมพันธ์ — หมวดช่วงอายุและวัยจร"
        titleLevel="h2"
        note="ประเมินตามดิถีและสภาวะวัยจรแต่ละช่วง 5 ปี (บทบาทธาตุ × 12 เชี่ยงแซ × กำลังดิถี) — แก้ไขถ้อยคำได้ทุกช่อง แล้วกดบันทึกการดูดวงเพื่อเก็บลงประวัติ"
        actions={
          <ActionButton
            tone="primary"
            type="button"
            disabled={generating || !canGenerate || rows.length === 0}
            onClick={onGenerateDeepNotes}
          >
            {generating ? "กำลัง gen คำอธิบาย..." : "✨ Gen คำอธิบายดี-ร้ายเชิงลึก (LLM)"}
          </ActionButton>
        }
      />
      {!canGenerate && (
        <p className="section-note">
          เลือกค่าย LLM และกรอก API key ด้านบน (หรือใช้ Local Claude) ก่อนจึงจะ gen คำอธิบายได้ —
          ระหว่างนี้ยังพิมพ์แก้คำในตารางเองได้
        </p>
      )}
      <table className="topic-table reading-path__appendix-table">
        <thead>
          <tr>
            <th>ช่วงอายุ</th>
            <th>เสาวัยจร</th>
            <th>เส้นขีดที่ทำงาน</th>
            <th>คำอธิบายดี-ร้ายเชิงลึก</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.ageRange}-${index}`}>
              <td>
                <input
                  className="reading-path__cell-input reading-path__cell-input--narrow"
                  value={row.ageRange}
                  aria-label={`ช่วงอายุ แถวที่ ${index + 1}`}
                  onChange={(event) => updateCell(index, "ageRange", event.target.value)}
                />
              </td>
              <td>
                <input
                  className="reading-path__cell-input reading-path__cell-input--narrow"
                  value={row.symbol}
                  aria-label={`เสาวัยจร แถวที่ ${index + 1}`}
                  onChange={(event) => updateCell(index, "symbol", event.target.value)}
                />
              </td>
              <td>
                <input
                  className="reading-path__cell-input"
                  value={row.relationLine}
                  aria-label={`เส้นขีดที่ทำงาน แถวที่ ${index + 1}`}
                  onChange={(event) => updateCell(index, "relationLine", event.target.value)}
                />
              </td>
              <td>
                <textarea
                  className="reading-path__cell-textarea"
                  value={row.deepNote}
                  rows={2}
                  aria-label={`คำอธิบายดี-ร้ายเชิงลึก แถวที่ ${index + 1}`}
                  onChange={(event) => updateCell(index, "deepNote", event.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
