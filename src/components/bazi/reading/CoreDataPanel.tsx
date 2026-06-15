"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  BRANCH_ORDER,
  STEM_ORDER,
  STRENGTH_BANDS,
  STEM_STRENGTH_MATRIX_ID,
  TWELVE_NAKSHATRA_ID,
  SIXTY_JIAZI_ID,
} from "@/lib/bazi/knowledge/standalone-tables";

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
  entries: Entry[];
};
type OverrideData = {
  standaloneTables?: Table[];
  error?: { message: string };
};

/**
 * แท็บ "ข้อมูลหลักแบบใหม่" — ตารางอิสระ 3 ตาราง (แก้ไข + บันทึก/เผยแพร่ออนไลน์ได้)
 *  1) เมทริกซ์ 10 ราศีบน × 5 ดิถี  2) 12 นักษัตร  3) 60 กะจี่อ
 * ใช้กลไกเดิม: PUT/POST/DELETE /api/reading/doctrine-draft (surface="knowledge", entityKey=`table|{id}|{key}`)
 */
export function CoreDataPanel({ adminToken }: { adminToken: string }) {
  const [tables, setTables] = useState<Table[] | null>(null);
  const [status, setStatus] = useState("");

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
      const body = (await res.json()) as OverrideData;
      if (!res.ok) {
        setStatus(body.error?.message ?? "โหลดไม่สำเร็จ");
        return;
      }
      setTables(body.standaloneTables ?? []);
    } catch {
      setStatus("โหลดไม่สำเร็จ");
    }
  }, [adminToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveDraft = useCallback(
    async (entityKey: string, text: string) => {
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
    },
    [headers, reload],
  );

  const publish = useCallback(
    async (entityKey: string) => {
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
    },
    [headers, reload],
  );

  const discardDraft = useCallback(
    async (entityKey: string) => {
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
    },
    [adminToken, reload],
  );

  if (!tables) {
    return <p className="section-note">{status || "กำลังโหลดข้อมูลหลัก…"}</p>;
  }

  const byId = (id: string) => tables.find((table) => table.tableId === id);
  const matrix = byId(STEM_STRENGTH_MATRIX_ID);
  const nakshatra = byId(TWELVE_NAKSHATRA_ID);
  const jiazi = byId(SIXTY_JIAZI_ID);

  const cellProps = { onSave: saveDraft, onPublish: publish, onDiscard: discardDraft };

  return (
    <div className="core-data">
      <div className="knowledge-edit__bar">
        <p className="section-note">
          ตารางข้อมูลหลัก — แก้ค่าในช่องแล้วกด “บันทึกร่าง” → “เผยแพร่” (บันทึกลงฐานข้อมูลออนไลน์)
        </p>
        {status && <span className="knowledge-edit__status">{status}</span>}
      </div>

      {/* กล่อง 1: เมทริกซ์ 10 ราศีบน × 5 ดิถี */}
      {matrix && (
        <CollapsibleSection title={matrix.label} count={matrix.entries.length} defaultOpen>
          <StemBandMatrix table={matrix} cellProps={cellProps} />
        </CollapsibleSection>
      )}

      {/* กล่อง 2: 12 นักษัตร */}
      {nakshatra && (
        <CollapsibleSection title={nakshatra.label} count={nakshatra.entries.length}>
          <div className="core-data__grid">
            {nakshatra.entries.map((entry) => (
              <CoreDataCell key={entry.key} tableId={nakshatra.tableId} entry={entry} {...cellProps} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ตาราง 3: 60 กะจี่อ — จัดกลุ่มตามราศีบน (10 ก้าน) แถวละก้าน × 6 กะจื่อ (เรียงตามราศีล่าง) */}
      {jiazi && (
        <CollapsibleSection title={jiazi.label} count={jiazi.entries.length}>
          <div className="core-data__matrix-wrap">
            <table className="core-data__matrix core-data__matrix--jiazi">
              <tbody>
                {STEM_ORDER.map((stem) => {
                  const branchOrder = BRANCH_ORDER as readonly string[];
                  const cells = jiazi.entries
                    .filter((entry) => entry.key[0] === stem)
                    .sort(
                      (a, b) => branchOrder.indexOf(a.key[1]) - branchOrder.indexOf(b.key[1]),
                    );
                  return (
                    <tr key={stem}>
                      <th scope="row" className="core-data__matrix-rowhead">{stem}</th>
                      {cells.map((entry) => (
                        <td key={entry.key}>
                          <CoreDataCell tableId={jiazi.tableId} entry={entry} {...cellProps} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

/** ตาราง 2D ก้าน(10) × กำลัง(5) — ใช้ซ้ำกับกล่อง 1/5/6 (key = `{ก้าน}|{band}`) */
function StemBandMatrix({
  table,
  cellProps,
}: {
  table: Table;
  cellProps: {
    onSave: (entityKey: string, text: string) => void | Promise<void>;
    onPublish: (entityKey: string) => void | Promise<void>;
    onDiscard: (entityKey: string) => void | Promise<void>;
  };
}) {
  return (
    <div className="core-data__matrix-wrap">
      <table className="core-data__matrix">
        <thead>
          <tr>
            <th className="core-data__matrix-corner">ราศีบน \ ดิถี</th>
            {STRENGTH_BANDS.map((band) => (
              <th key={band.key}>{band.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STEM_ORDER.map((stem) => (
            <tr key={stem}>
              <th scope="row" className="core-data__matrix-rowhead">{stem}</th>
              {STRENGTH_BANDS.map((band) => {
                const key = `${stem}|${band.key}`;
                const entry = table.entries.find((item) => item.key === key);
                if (!entry) return <td key={band.key} />;
                return (
                  <td key={band.key}>
                    <CoreDataCell tableId={table.tableId} entry={entry} compact {...cellProps} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="core-data__section">
      <button
        type="button"
        className="knowledge-edit__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? "▾" : "▸"} {title}
        {count != null ? ` · ${count} ช่อง` : ""}
      </button>
      {open && children}
    </section>
  );
}

function entityKeyTable(tableId: string, key: string) {
  return `table|${tableId}|${key}`;
}

function CoreDataCell({
  tableId,
  entry,
  compact = false,
  onSave,
  onPublish,
  onDiscard,
}: {
  tableId: string;
  entry: Entry;
  compact?: boolean;
  onSave: (entityKey: string, text: string) => void | Promise<void>;
  onPublish: (entityKey: string) => void | Promise<void>;
  onDiscard: (entityKey: string) => void | Promise<void>;
}) {
  const current = entry.draft ?? entry.published ?? entry.default;
  const [value, setValue] = useState(current);
  const entityKey = entityKeyTable(tableId, entry.key);
  const hasDraft = entry.draft != null;
  const isPublishedOverride = entry.published != null;

  // sync เมื่อ reload ทำให้ค่าจาก server เปลี่ยน (เช่นหลังเผยแพร่/ทิ้งร่าง)
  useEffect(() => {
    setValue(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.draft, entry.published, entry.default]);

  return (
    <div className={`knowledge-edit__field core-data__cell${compact ? " core-data__cell--compact" : ""}`}>
      <div className="knowledge-edit__field-head">
        <span className="knowledge-edit__field-label">{entry.keyLabel || entry.key}</span>
        {hasDraft && <span className="knowledge-edit__tag knowledge-edit__tag--draft">ร่าง</span>}
        {isPublishedOverride && <span className="knowledge-edit__tag">แก้แล้ว</span>}
      </div>
      <textarea
        className="knowledge-edit__textarea"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={
          compact
            ? 2
            : Math.min(12, Math.max(3, value.split("\n").length + Math.ceil((value.length || 1) / 48)))
        }
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
