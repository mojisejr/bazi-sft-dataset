"use client";

import { useMemo, useState } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import {
  suggestSubstitutions,
  type SubstitutionRuleScope,
} from "@/lib/bazi/substitution-rules";

export type AddRuleInput = {
  scope: SubstitutionRuleScope;
  topicId?: string;
  match: string;
  replacement: string;
};

type Props = {
  topicId: string;
  /** ผลทายของระบบ (ก่อนซินแสแก้) — ใช้ diff หาวลีที่เปลี่ยน */
  systemText: string;
  /** คำที่ซินแสแก้ (ถ้ามี) — ใช้ diff คู่กับ systemText */
  correctedText: string | null;
  onAddRule: (input: AddRuleInput) => void | Promise<void>;
  /** บันทึกหลายกฎพร้อมกัน (ปุ่ม "บันทึกเป็นกฎทั้งหมด") — ถ้าไม่ส่งจะซ่อนปุ่ม */
  onAddRules?: (inputs: AddRuleInput[]) => void | Promise<void>;
};

type SuggestionRowState = { match: string; replacement: string; saved: boolean };

/**
 * สร้าง "กฎแทนคำ" (ใช้กับดวงอื่น) — 2 ทาง:
 *  1) auto-diff: เสนอคู่ match→replacement จาก systemText vs correctedText ให้เลือก/ตัดแต่ง
 *     + ปุ่ม "บันทึกเป็นกฎทั้งหมด" บันทึกทุกแถวที่ยังไม่ได้บันทึกในครั้งเดียว
 *  2) กรอกมือ: คำเดิม → แก้เป็น (เว้นว่าง=ลบ) + เลือก scope บทนี้/ทุกบท
 */
export function SinsaeRuleBuilder({ topicId, systemText, correctedText, onAddRule, onAddRules }: Props) {
  const suggestions = useMemo(
    () => (correctedText ? suggestSubstitutions(systemText, correctedText) : []),
    [systemText, correctedText],
  );

  // ยก state ของแถว suggestion ขึ้นมาที่ parent เพื่ออ่านค่าที่ซินแสแก้ inline ได้ (จำเป็นต่อ "บันทึกทั้งหมด")
  // รีเซ็ตแถวเมื่อ suggestions เปลี่ยน — ทำตอน render ตามแนวทาง "you might not need an effect" (เลี่ยง setState ใน effect)
  const [rows, setRows] = useState<SuggestionRowState[]>(() =>
    suggestions.map((pair) => ({ ...pair, saved: false })),
  );
  const [prevSuggestions, setPrevSuggestions] = useState(suggestions);
  if (suggestions !== prevSuggestions) {
    setPrevSuggestions(suggestions);
    setRows(suggestions.map((pair) => ({ ...pair, saved: false })));
  }

  const [manualMatch, setManualMatch] = useState("");
  const [manualReplacement, setManualReplacement] = useState("");
  const [scope, setScope] = useState<SubstitutionRuleScope>("topic");

  function updateRow(index: number, patch: Partial<SuggestionRowState>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function saveOne(index: number) {
    const row = rows[index];
    if (!row || !row.match.trim() || row.saved) return;
    await onAddRule({ scope: "topic", topicId, match: row.match, replacement: row.replacement });
    updateRow(index, { saved: true });
  }

  const pendingCount = rows.filter((row) => !row.saved && row.match.trim().length > 0).length;

  async function saveAll() {
    const pending = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !row.saved && row.match.trim().length > 0);
    if (pending.length === 0) return;
    const inputs: AddRuleInput[] = pending.map(({ row }) => ({
      scope: "topic",
      topicId,
      match: row.match,
      replacement: row.replacement,
    }));
    if (onAddRules) {
      await onAddRules(inputs);
    } else {
      for (const input of inputs) await onAddRule(input);
    }
    setRows((current) =>
      current.map((row) => (!row.saved && row.match.trim().length > 0 ? { ...row, saved: true } : row)),
    );
  }

  return (
    <div className="sinsae-rule">
      <p className="sinsae-rule__title">กฎแทนคำ (นำไปใช้กับดวงอื่นที่ทายได้วลีเดียวกัน)</p>

      {rows.length > 0 && (
        <div className="sinsae-rule__suggestions">
          <div className="sinsae-rule__suggestions-head">
            <p className="sinsae-rule__hint">เสนอจากสิ่งที่คุณแก้ — กด “บันทึกเป็นกฎ” เฉพาะวลีที่อยากให้ใช้ซ้ำ</p>
            <button
              type="button"
              className="topic-card__sinsae-link topic-card__sinsae-link--all"
              disabled={pendingCount === 0}
              onClick={() => void saveAll()}
            >
              บันทึกเป็นกฎทั้งหมด{pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          </div>
          {rows.map((row, index) => (
            <div className="sinsae-rule__suggestion" key={`sg-${index}`}>
              <input
                value={row.match}
                onChange={(event) => updateRow(index, { match: event.target.value })}
                aria-label="คำเดิม"
              />
              <span className="sinsae-rule__arrow">→</span>
              <input
                value={row.replacement}
                onChange={(event) => updateRow(index, { replacement: event.target.value })}
                aria-label="แก้เป็น"
                placeholder="(เว้นว่าง = ลบ)"
              />
              <button
                type="button"
                className="topic-card__sinsae-link"
                disabled={row.saved || row.match.trim().length === 0}
                onClick={() => void saveOne(index)}
              >
                {row.saved ? "บันทึกแล้ว ✓" : "บันทึกเป็นกฎ"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="sinsae-rule__manual">
        <label className="sinsae-rule__field">
          <span>คำเดิม (จากระบบ)</span>
          <input value={manualMatch} onChange={(event) => setManualMatch(event.target.value)} />
        </label>
        <label className="sinsae-rule__field">
          <span>แก้เป็น (เว้นว่าง = ลบทิ้ง)</span>
          <input
            value={manualReplacement}
            onChange={(event) => setManualReplacement(event.target.value)}
          />
        </label>
        <label className="sinsae-rule__field sinsae-rule__field--scope">
          <span>ใช้กับ</span>
          <select value={scope} onChange={(event) => setScope(event.target.value as SubstitutionRuleScope)}>
            <option value="topic">บทนี้</option>
            <option value="global">ทุกบท</option>
          </select>
        </label>
        <ActionButton
          tone="secondary"
          type="button"
          disabled={manualMatch.trim().length === 0}
          onClick={() =>
            void Promise.resolve(
              onAddRule({
                scope,
                topicId: scope === "topic" ? topicId : undefined,
                match: manualMatch,
                replacement: manualReplacement,
              }),
            ).then(() => {
              setManualMatch("");
              setManualReplacement("");
            })
          }
        >
          เพิ่มกฎ
        </ActionButton>
      </div>
    </div>
  );
}
