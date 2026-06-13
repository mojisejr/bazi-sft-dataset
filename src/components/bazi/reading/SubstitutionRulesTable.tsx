"use client";

import { type SubstitutionRule } from "@/lib/bazi/substitution-rules";

type Props = {
  rules: SubstitutionRule[];
  onDelete: (id: string) => void | Promise<void>;
  /** ข้อความเมื่อไม่มีกฎ */
  emptyNote?: string;
};

/**
 * ตารางกฎแทนคำ (read-only + ปุ่มลบ) — ใช้ร่วมกันระหว่างหน้า /reading (ตารางคำแก้)
 * และหน้า /reading/knowledge (กฎของบทนั้น) ผู้เรียกกรอง rules มาก่อนได้
 */
export function SubstitutionRulesTable({ rules, onDelete, emptyNote }: Props) {
  if (rules.length === 0) {
    return <p className="section-note">{emptyNote ?? "ยังไม่มีกฎ"}</p>;
  }

  return (
    <table className="topic-table reading-path__rules-table">
      <thead>
        <tr>
          <th>ใช้กับ</th>
          <th>คำเดิม</th>
          <th>แก้เป็น</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rules.map((rule) => (
          <tr key={rule.id}>
            <td>{rule.scope === "global" ? "ทุกบท" : rule.topicId}</td>
            <td>{rule.match}</td>
            <td>{rule.replacement.length === 0 ? "(ลบทิ้ง)" : rule.replacement}</td>
            <td>
              <button
                type="button"
                className="topic-card__sinsae-link topic-card__sinsae-link--danger"
                onClick={() => void onDelete(rule.id)}
              >
                ลบ
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
