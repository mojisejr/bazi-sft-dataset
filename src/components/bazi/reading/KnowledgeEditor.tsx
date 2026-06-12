"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";

type Entry = {
  key: string;
  keyLabel: string;
  default: string;
  published: string | null;
  draft: string | null;
};
type Table = {
  tableId: string;
  label: string;
  keyKind: "topic" | "element" | "qi" | "role";
  entries: Entry[];
};
type AppendState = { published: string[]; draft: string[] };
type OverrideData = { tables: Table[]; appends: Record<string, AppendState> };

type Props = { topicId: string; adminToken: string };

const SAMPLE_RAW_INPUT = {
  birthDate: "1990-01-01",
  birthTime: "12:00",
  gender: "male" as const,
  province: "Bangkok",
  calendarSystem: "solar" as const,
  timezone: "Asia/Bangkok",
};

function entityKeyTable(tableId: string, key: string) {
  return `table|${tableId}|${key}`;
}
function entityKeyAppend(topicId: string, ordinal: number) {
  return `append|${topicId}|${ordinal}`;
}

/**
 * ตัวแก้องค์ความรู้ออนไลน์ (เฟส 2) — แก้ค่าตาราง/กรอบบท + ย่อหน้าเพิ่มเติม
 * draft → preview → publish ผ่าน /api/reading/doctrine-draft (surface="knowledge")
 */
export function KnowledgeEditor({ topicId, adminToken }: Props) {
  const [data, setData] = useState<OverrideData | null>(null);
  const [status, setStatus] = useState<string>("");
  const [preview, setPreview] = useState<string | null>(null);
  const [showConditionTables, setShowConditionTables] = useState(false);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (adminToken.trim()) h["x-admin-token"] = adminToken.trim();
    return h;
  }, [adminToken]);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/reading/knowledge-override", {
        headers: adminToken.trim() ? { "x-admin-token": adminToken.trim() } : {},
      });
      const body = (await res.json()) as OverrideData & { error?: { message: string } };
      if (!res.ok) {
        setStatus(body.error?.message ?? "โหลดไม่สำเร็จ");
        return;
      }
      setData(body);
    } catch {
      setStatus("โหลดไม่สำเร็จ");
    }
  }, [adminToken]);

  useEffect(() => {
    let active = true;
    void fetch("/api/reading/knowledge-override", {
      headers: adminToken.trim() ? { "x-admin-token": adminToken.trim() } : {},
    })
      .then((res) => res.json())
      .then((body: OverrideData & { error?: { message: string } }) => {
        if (!active) return;
        if (body && Array.isArray(body.tables)) setData(body);
        else setStatus(body?.error?.message ?? "โหลดไม่สำเร็จ");
      })
      .catch(() => {
        if (active) setStatus("โหลดไม่สำเร็จ");
      });
    return () => {
      active = false;
    };
  }, [adminToken]);

  async function saveDraft(entityKey: string, text: string) {
    setStatus("กำลังบันทึกร่าง…");
    try {
      const res = await fetch("/api/reading/doctrine-draft", {
        method: "PUT",
        headers,
        body: JSON.stringify({ surface: "knowledge", entityKey, value: { text } }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: { message: string } };
      setStatus(res.ok ? "บันทึกร่างแล้ว ✓" : (body.error?.message ?? "บันทึกร่างไม่สำเร็จ"));
      if (res.ok) await reload();
    } catch {
      setStatus("บันทึกร่างไม่สำเร็จ");
    }
  }

  async function publish(entityKey: string) {
    setStatus("กำลังเผยแพร่…");
    try {
      const res = await fetch("/api/reading/doctrine-draft", {
        method: "POST",
        headers,
        body: JSON.stringify({ surface: "knowledge", entityKey }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: { message: string } };
      setStatus(res.ok ? "เผยแพร่แล้ว ✓" : (body.error?.message ?? "เผยแพร่ไม่สำเร็จ"));
      if (res.ok) await reload();
    } catch {
      setStatus("เผยแพร่ไม่สำเร็จ");
    }
  }

  async function discardDraft(entityKey: string) {
    try {
      const res = await fetch(
        `/api/reading/doctrine-draft?surface=knowledge&key=${encodeURIComponent(entityKey)}`,
        { method: "DELETE", headers: adminToken.trim() ? { "x-admin-token": adminToken.trim() } : {} },
      );
      setStatus(res.ok ? "ทิ้งร่างแล้ว" : "ทิ้งร่างไม่สำเร็จ");
      if (res.ok) await reload();
    } catch {
      setStatus("ทิ้งร่างไม่สำเร็จ");
    }
  }

  async function runPreview() {
    setStatus("กำลังพรีวิว (ดวงตัวอย่าง)…");
    setPreview(null);
    try {
      const res = await fetch("/api/reading/topic?preview=1", {
        method: "POST",
        headers,
        body: JSON.stringify({ topicId, mode: "engine", rawInput: SAMPLE_RAW_INPUT }),
      });
      const body = (await res.json()) as { humanReading?: string; error?: { message: string } };
      if (!res.ok) {
        setStatus(body.error?.message ?? "พรีวิวไม่สำเร็จ");
        return;
      }
      setPreview(body.humanReading ?? "(ว่าง)");
      setStatus("พรีวิวด้วยดวงตัวอย่าง (เกิด 1990-01-01 12:00 ชาย) — รวมร่างที่ยังไม่เผยแพร่");
    } catch {
      setStatus("พรีวิวไม่สำเร็จ");
    }
  }

  if (!data) {
    return <p className="section-note">{status || "กำลังโหลดตัวแก้องค์ความรู้…"}</p>;
  }

  const topicTables = data.tables.filter((table) => table.keyKind === "topic");
  const conditionTables = data.tables.filter((table) => table.keyKind !== "topic");
  const appendState = data.appends[topicId] ?? { published: [], draft: [] };

  return (
    <div className="knowledge-edit">
      <div className="knowledge-edit__bar">
        <ActionButton tone="secondary" type="button" onClick={() => void runPreview()}>
          พรีวิว (ดวงตัวอย่าง)
        </ActionButton>
        {status && <span className="knowledge-edit__status">{status}</span>}
      </div>

      {preview != null && (
        <pre className="knowledge-edit__preview">{preview}</pre>
      )}

      {/* กรอบบทของบทนี้ */}
      <h3 className="knowledge-edit__group">กรอบบทนี้</h3>
      {topicTables.map((table) => {
        const entry = table.entries.find((item) => item.key === topicId);
        if (!entry) return null;
        return (
          <FieldRow
            key={table.tableId}
            label={table.label}
            entityKey={entityKeyTable(table.tableId, topicId)}
            entry={entry}
            onSave={saveDraft}
            onPublish={publish}
            onDiscard={discardDraft}
          />
        );
      })}

      {/* ย่อหน้าความรู้เพิ่มเติม (always-on ต่อบท) */}
      <h3 className="knowledge-edit__group">ย่อหน้าความรู้เพิ่มเติม (ต่อท้ายบทนี้ทุกดวง)</h3>
      <AppendEditor
        topicId={topicId}
        state={appendState}
        onSave={saveDraft}
        onPublish={publish}
        onDiscard={discardDraft}
      />

      {/* ตารางความรู้ตามเงื่อนไขดวง (มีผลทุกบท) */}
      <button
        type="button"
        className="knowledge-edit__toggle"
        onClick={() => setShowConditionTables((value) => !value)}
      >
        {showConditionTables ? "▾" : "▸"} ตารางความรู้ตามเงื่อนไขดวง (แก้แล้วมีผลทุกบทที่เข้าเงื่อนไข)
      </button>
      {showConditionTables &&
        conditionTables.map((table) => (
          <div key={table.tableId} className="knowledge-edit__table">
            <h4 className="knowledge-edit__table-title">{table.label}</h4>
            {table.entries.map((entry) => (
              <FieldRow
                key={entry.key}
                label={entry.keyLabel}
                entityKey={entityKeyTable(table.tableId, entry.key)}
                entry={entry}
                onSave={saveDraft}
                onPublish={publish}
                onDiscard={discardDraft}
              />
            ))}
          </div>
        ))}
    </div>
  );
}

function FieldRow({
  label,
  entityKey,
  entry,
  onSave,
  onPublish,
  onDiscard,
}: {
  label: string;
  entityKey: string;
  entry: Entry;
  onSave: (entityKey: string, text: string) => void | Promise<void>;
  onPublish: (entityKey: string) => void | Promise<void>;
  onDiscard: (entityKey: string) => void | Promise<void>;
}) {
  const current = entry.draft ?? entry.published ?? entry.default;
  const [value, setValue] = useState(current);
  const hasDraft = entry.draft != null;
  const isPublishedOverride = entry.published != null;

  return (
    <div className="knowledge-edit__field">
      <div className="knowledge-edit__field-head">
        <span className="knowledge-edit__field-label">{label}</span>
        {hasDraft && <span className="knowledge-edit__tag knowledge-edit__tag--draft">ร่าง</span>}
        {isPublishedOverride && <span className="knowledge-edit__tag">แก้แล้ว</span>}
      </div>
      <textarea
        className="knowledge-edit__textarea"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={Math.min(8, Math.max(2, Math.ceil(value.length / 60)))}
      />
      <div className="knowledge-edit__actions">
        <button type="button" className="topic-card__sinsae-link" onClick={() => void onSave(entityKey, value)}>
          บันทึกร่าง
        </button>
        <button type="button" className="topic-card__sinsae-link" onClick={() => void onPublish(entityKey)}>
          เผยแพร่
        </button>
        {hasDraft && (
          <button
            type="button"
            className="topic-card__sinsae-link topic-card__sinsae-link--danger"
            onClick={() => void onDiscard(entityKey)}
          >
            ทิ้งร่าง
          </button>
        )}
        <button
          type="button"
          className="topic-card__sinsae-link"
          onClick={() => setValue(entry.default)}
          title="คืนค่าในกล่องเป็นค่าตั้งต้น (ยังไม่บันทึก)"
        >
          คืนค่าตั้งต้น
        </button>
      </div>
    </div>
  );
}

function AppendEditor({
  topicId,
  state,
  onSave,
  onPublish,
  onDiscard,
}: {
  topicId: string;
  state: AppendState;
  onSave: (entityKey: string, text: string) => void | Promise<void>;
  onPublish: (entityKey: string) => void | Promise<void>;
  onDiscard: (entityKey: string) => void | Promise<void>;
}) {
  // รวมจำนวนช่อง = มากกว่าระหว่าง published/draft + 1 ช่องว่างให้เพิ่มใหม่
  const count = Math.max(state.published.length, state.draft.length);
  const rows = Array.from({ length: count + 1 }, (_, index) => {
    const ordinal = index + 1;
    const value = state.draft[index] ?? state.published[index] ?? "";
    return { ordinal, value, hasDraft: state.draft[index] != null };
  });

  return (
    <div className="knowledge-edit__appends">
      {rows.map((row) => (
        <AppendRow
          key={row.ordinal}
          entityKey={entityKeyAppend(topicId, row.ordinal)}
          initial={row.value}
          ordinal={row.ordinal}
          hasDraft={row.hasDraft}
          onSave={onSave}
          onPublish={onPublish}
          onDiscard={onDiscard}
        />
      ))}
    </div>
  );
}

function AppendRow({
  entityKey,
  initial,
  ordinal,
  hasDraft,
  onSave,
  onPublish,
  onDiscard,
}: {
  entityKey: string;
  initial: string;
  ordinal: number;
  hasDraft: boolean;
  onSave: (entityKey: string, text: string) => void | Promise<void>;
  onPublish: (entityKey: string) => void | Promise<void>;
  onDiscard: (entityKey: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="knowledge-edit__field">
      <div className="knowledge-edit__field-head">
        <span className="knowledge-edit__field-label">ย่อหน้า #{ordinal}</span>
        {hasDraft && <span className="knowledge-edit__tag knowledge-edit__tag--draft">ร่าง</span>}
      </div>
      <textarea
        className="knowledge-edit__textarea"
        value={value}
        placeholder="พิมพ์ย่อหน้าความรู้ใหม่ที่จะต่อท้ายบทนี้…"
        onChange={(event) => setValue(event.target.value)}
        rows={Math.min(8, Math.max(2, Math.ceil((value.length || 1) / 60)))}
      />
      <div className="knowledge-edit__actions">
        <button type="button" className="topic-card__sinsae-link" onClick={() => void onSave(entityKey, value)}>
          บันทึกร่าง
        </button>
        <button type="button" className="topic-card__sinsae-link" onClick={() => void onPublish(entityKey)}>
          เผยแพร่
        </button>
        {hasDraft && (
          <button
            type="button"
            className="topic-card__sinsae-link topic-card__sinsae-link--danger"
            onClick={() => void onDiscard(entityKey)}
          >
            ทิ้งร่าง
          </button>
        )}
      </div>
    </div>
  );
}
