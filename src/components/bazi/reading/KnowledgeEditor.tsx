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
type KeyKind = "topic" | "element" | "qi" | "role" | "stem" | "ganzhi" | "pillar" | "raw";
type Table = {
  tableId: string;
  label: string;
  keyKind: KeyKind;
  entries: Entry[];
};

/** หัวข้อหมวดตามชนิดคีย์ (จัดกลุ่มตารางเงื่อนไขให้หาง่าย) */
const KEY_KIND_GROUP_TH: Record<KeyKind, string> = {
  topic: "ตามบท",
  element: "ตามธาตุ (ไม้/ไฟ/ดิน/ทอง/น้ำ)",
  qi: "ตาม 12 เชี่ยงแซ",
  role: "ตามบทบาทธาตุ (คู่/ส่งเสริม/ถ่ายเท/พิฆาต/ลาภ)",
  stem: "ตามราศีบน (10 ก้าน)",
  ganzhi: "ตาม 60 กะจื่อ (ก้าน-กิ่ง)",
  pillar: "ตามตำแหน่งเสา (ปี/เดือน/วัน/ยาม)",
  raw: "อื่น ๆ / คีย์เฉพาะ",
};
const KEY_KIND_ORDER: KeyKind[] = ["element", "qi", "role", "stem", "pillar", "ganzhi", "raw"];
type AppendState = { published: string[]; draft: string[] };
type RegistryLine = {
  kind: "logic" | "sourcefocus";
  ordinal: number;
  default: string;
  published: string | null;
  draft: string | null;
};
type RegistryTopic = {
  topicId: string;
  thaiLabel: string;
  annotationDimension: string;
  logicRules: RegistryLine[];
  sourceFocus: RegistryLine[];
};
type OverrideData = {
  tables: Table[];
  appends: Record<string, AppendState>;
  registry: RegistryTopic[];
};

/**
 * registryTopicIds = registry topic ids ของบท (จาก dimension bridge) ที่จะให้แก้ logic/source
 * section: "chapter" = แก้คำรายบท (intro/สรุป/logic/append) · "condition" = ตารางตามดวง (ข้ามบท)
 */
type Props = {
  topicId: string;
  adminToken: string;
  registryTopicIds?: string[];
  section?: "chapter" | "condition";
};

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
function entityKeyRegistry(kind: "logic" | "sourcefocus", topicId: string, ordinal: number) {
  return `${kind}|${topicId}|${ordinal}`;
}

/**
 * ตัวแก้องค์ความรู้ออนไลน์ (เฟส 2) — แก้ค่าตาราง/กรอบบท + ย่อหน้าเพิ่มเติม
 * draft → preview → publish ผ่าน /api/reading/doctrine-draft (surface="knowledge")
 */
export function KnowledgeEditor({
  topicId,
  adminToken,
  registryTopicIds = [],
  section = "chapter",
}: Props) {
  const [data, setData] = useState<OverrideData | null>(null);
  const [status, setStatus] = useState<string>("");
  const [preview, setPreview] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");

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
  const registrySet = new Set(registryTopicIds);
  const registryTopics = (data.registry ?? []).filter((entry) => registrySet.has(entry.topicId));
  // ตารางตามดวง: กรองด้วยคำค้น (ชื่อตาราง หรือ ข้อความในช่อง) แล้วจัดกลุ่มตาม keyKind
  const query = tableSearch.trim().toLowerCase();
  const filteredConditionTables = query
    ? conditionTables
        .map((table) => {
          if (table.label.toLowerCase().includes(query)) return table;
          const entries = table.entries.filter(
            (entry) =>
              entry.key.toLowerCase().includes(query) ||
              entry.keyLabel.toLowerCase().includes(query) ||
              (entry.draft ?? entry.published ?? entry.default).toLowerCase().includes(query),
          );
          return entries.length > 0 ? { ...table, entries } : null;
        })
        .filter((table): table is Table => table !== null)
    : conditionTables;
  const conditionTablesByKind = new Map<KeyKind, Table[]>();
  for (const table of filteredConditionTables) {
    const bucket = conditionTablesByKind.get(table.keyKind) ?? [];
    bucket.push(table);
    conditionTablesByKind.set(table.keyKind, bucket);
  }

  // โหมด "ตารางตามดวง" — ไม่ผูกกับบท แสดงทุกตามเงื่อนไข จัดกลุ่ม + ค้นหา
  if (section === "condition") {
    return (
      <div className="knowledge-edit">
        <div className="knowledge-edit__bar">
          <input
            className="knowledge__search"
            placeholder="ค้นหาตาราง/คำในช่อง…"
            value={tableSearch}
            onChange={(event) => setTableSearch(event.target.value)}
            aria-label="ค้นหาตารางตามดวง"
          />
          {status && <span className="knowledge-edit__status">{status}</span>}
        </div>
        <p className="section-note">
          ตารางคำทำนายที่มีผล “ทุกบทที่เข้าเงื่อนไข” (ตามธาตุ/เชี่ยงแซ/บทบาท/ตำแหน่งเสา ฯลฯ) —
          แก้แล้วเผยแพร่มีผลกับทุกดวงที่ทายได้เงื่อนไขนั้น
        </p>
        {KEY_KIND_ORDER.filter((kind) => conditionTablesByKind.has(kind)).map((kind) => (
          <ConditionGroup
            key={kind}
            title={KEY_KIND_GROUP_TH[kind]}
            tables={conditionTablesByKind.get(kind) ?? []}
            defaultOpen={query.length > 0}
            onSave={saveDraft}
            onPublish={publish}
            onDiscard={discardDraft}
          />
        ))}
        {conditionTablesByKind.size === 0 && (
          <p className="section-note">ไม่พบตารางที่ตรงกับ “{tableSearch}”</p>
        )}
      </div>
    );
  }

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

      {/* องค์ความรู้แกน: หลักการซินแส + แหล่งอ้างอิง (ป้อนเข้า prompt ของ engine) */}
      {registryTopics.length > 0 && (
        <>
          <h3 className="knowledge-edit__group">
            หลักการซินแส + แหล่งอ้างอิง (มีผลกับคำทำนายใหม่ทันทีที่เผยแพร่)
          </h3>
          {registryTopics.map((topic) => (
            <div key={topic.topicId} className="knowledge-edit__table">
              <h4 className="knowledge-edit__table-title">{topic.thaiLabel}</h4>
              {topic.logicRules.map((line) => (
                <FieldRow
                  key={`logic-${line.ordinal}`}
                  label={`หลักการซินแส #${line.ordinal}`}
                  entityKey={entityKeyRegistry("logic", topic.topicId, line.ordinal)}
                  entry={{
                    key: String(line.ordinal),
                    keyLabel: "",
                    default: line.default,
                    published: line.published,
                    draft: line.draft,
                  }}
                  onSave={saveDraft}
                  onPublish={publish}
                  onDiscard={discardDraft}
                />
              ))}
              {topic.sourceFocus.map((line) => (
                <FieldRow
                  key={`focus-${line.ordinal}`}
                  label={`โฟกัสแหล่งอ้างอิง #${line.ordinal}`}
                  entityKey={entityKeyRegistry("sourcefocus", topic.topicId, line.ordinal)}
                  entry={{
                    key: String(line.ordinal),
                    keyLabel: "",
                    default: line.default,
                    published: line.published,
                    draft: line.draft,
                  }}
                  onSave={saveDraft}
                  onPublish={publish}
                  onDiscard={discardDraft}
                />
              ))}
            </div>
          ))}
        </>
      )}

      {/* ย่อหน้าความรู้เพิ่มเติม (always-on ต่อบท) */}
      <h3 className="knowledge-edit__group">ย่อหน้าความรู้เพิ่มเติม (ต่อท้ายบทนี้ทุกดวง)</h3>
      <AppendEditor
        topicId={topicId}
        state={appendState}
        onSave={saveDraft}
        onPublish={publish}
        onDiscard={discardDraft}
      />
    </div>
  );
}

function ConditionGroup({
  title,
  tables,
  defaultOpen = false,
  onSave,
  onPublish,
  onDiscard,
}: {
  title: string;
  tables: Table[];
  defaultOpen?: boolean;
  onSave: (entityKey: string, text: string) => void | Promise<void>;
  onPublish: (entityKey: string) => void | Promise<void>;
  onDiscard: (entityKey: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const fieldCount = tables.reduce((sum, table) => sum + table.entries.length, 0);
  return (
    <div className="knowledge-edit__group-section">
      <button
        type="button"
        className="knowledge-edit__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? "▾" : "▸"} {title} · {tables.length} ตาราง ({fieldCount} ช่อง)
      </button>
      {open &&
        tables.map((table) => (
          <div key={table.tableId} className="knowledge-edit__table">
            <h4 className="knowledge-edit__table-title">{table.label}</h4>
            {table.entries.map((entry) => (
              <FieldRow
                key={entry.key}
                label={entry.keyLabel || entry.key}
                entityKey={entityKeyTable(table.tableId, entry.key)}
                entry={entry}
                onSave={onSave}
                onPublish={onPublish}
                onDiscard={onDiscard}
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
