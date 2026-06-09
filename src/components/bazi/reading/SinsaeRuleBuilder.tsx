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
};

/**
 * สร้าง "กฎแทนคำ" (ใช้กับดวงอื่น) — 2 ทาง:
 *  1) auto-diff: เสนอคู่ match→replacement จาก systemText vs correctedText ให้เลือก/ตัดแต่ง
 *  2) กรอกมือ: คำเดิม → แก้เป็น (เว้นว่าง=ลบ) + เลือก scope บทนี้/ทุกบท
 */
export function SinsaeRuleBuilder({ topicId, systemText, correctedText, onAddRule }: Props) {
  const suggestions = useMemo(
    () => (correctedText ? suggestSubstitutions(systemText, correctedText) : []),
    [systemText, correctedText],
  );

  const [manualMatch, setManualMatch] = useState("");
  const [manualReplacement, setManualReplacement] = useState("");
  const [scope, setScope] = useState<SubstitutionRuleScope>("topic");
  const [added, setAdded] = useState<string[]>([]);

  async function submit(input: AddRuleInput, key: string) {
    if (!input.match.trim()) return;
    await onAddRule(input);
    setAdded((current) => [...current, key]);
  }

  return (
    <div className="sinsae-rule">
      <p className="sinsae-rule__title">กฎแทนคำ (นำไปใช้กับดวงอื่นที่ทายได้วลีเดียวกัน)</p>

      {suggestions.length > 0 && (
        <div className="sinsae-rule__suggestions">
          <p className="sinsae-rule__hint">เสนอจากสิ่งที่คุณแก้ — กด “บันทึกเป็นกฎ” เฉพาะวลีที่อยากให้ใช้ซ้ำ</p>
          {suggestions.map((pair, index) => {
            const key = `sg-${index}`;
            return (
              <SuggestionRow
                key={key}
                pair={pair}
                done={added.includes(key)}
                onSave={(match, replacement) =>
                  submit({ scope: "topic", topicId, match, replacement }, key)
                }
              />
            );
          })}
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
            submit(
              {
                scope,
                topicId: scope === "topic" ? topicId : undefined,
                match: manualMatch,
                replacement: manualReplacement,
              },
              `manual-${manualMatch}`,
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

function SuggestionRow({
  pair,
  done,
  onSave,
}: {
  pair: { match: string; replacement: string };
  done: boolean;
  onSave: (match: string, replacement: string) => void;
}) {
  const [match, setMatch] = useState(pair.match);
  const [replacement, setReplacement] = useState(pair.replacement);
  return (
    <div className="sinsae-rule__suggestion">
      <input value={match} onChange={(event) => setMatch(event.target.value)} aria-label="คำเดิม" />
      <span className="sinsae-rule__arrow">→</span>
      <input
        value={replacement}
        onChange={(event) => setReplacement(event.target.value)}
        aria-label="แก้เป็น"
        placeholder="(เว้นว่าง = ลบ)"
      />
      <button
        type="button"
        className="topic-card__sinsae-link"
        disabled={done || match.trim().length === 0}
        onClick={() => onSave(match, replacement)}
      >
        {done ? "บันทึกแล้ว ✓" : "บันทึกเป็นกฎ"}
      </button>
    </div>
  );
}
