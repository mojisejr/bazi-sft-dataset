"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { MatchingValue } from "@/db/schema";
import type { MatchingKeyKind } from "@/lib/bazi/matching-groups";

type Item = {
  itemKey: string;
  ordinal: number;
  value: MatchingValue;
  updatedBy: string | null;
  updatedAt: string | null;
};
type Group = {
  key: string;
  label: string;
  description: string;
  keyKind: MatchingKeyKind;
  sourceFile: string;
  items: Item[];
};
type ApiData = { groups?: Group[]; unavailable?: boolean; error?: { message: string } };

/** ฟอร์มแก้ค่าในหน่วยความจำ ก่อนกดบันทึก */
type Draft = { label: string; text: string; ordinal: string };

/**
 * หน้าแอดมิน Matching (คำทำนายจับคู่/สมพงษ์) — ซินแสแก้/เพิ่ม/ลบ คำทำนายได้ live
 * โครงเดียวกับ NewData (reuse CSS .newdata-admin) — overlay ทับ reference.json/sising.json
 */
export function MatchingAdminWorkspace() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newItem, setNewItem] = useState<Draft & { itemKey: string }>({
    itemKey: "",
    label: "",
    text: "",
    ordinal: "",
  });

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (token.trim()) h["x-admin-token"] = token.trim();
    return h;
  }, [token]);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/reading/matching", {
        headers: token.trim() ? { "x-admin-token": token.trim() } : {},
      });
      const body = (await res.json()) as ApiData;
      if (!res.ok) {
        setStatus(body.error?.message ?? "โหลดไม่สำเร็จ");
        return;
      }
      setGroups(body.groups ?? []);
      setUnavailable(Boolean(body.unavailable));
      setSelectedKey((prev) => prev ?? body.groups?.[0]?.key ?? null);
    } catch {
      setStatus("โหลดไม่สำเร็จ");
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = useMemo(
    () => groups?.find((g) => g.key === selectedKey) ?? null,
    [groups, selectedKey],
  );

  const draftFor = useCallback(
    (item: Item): Draft =>
      drafts[`${selectedKey}|${item.itemKey}`] ?? {
        label: item.value.label ?? "",
        text: item.value.text ?? "",
        ordinal: String(item.ordinal),
      },
    [drafts, selectedKey],
  );

  const setDraft = useCallback(
    (itemKey: string, patch: Partial<Draft>) => {
      const id = `${selectedKey}|${itemKey}`;
      setDrafts((prev) => {
        const base =
          prev[id] ??
          (() => {
            const it = selected?.items.find((i) => i.itemKey === itemKey);
            return {
              label: it?.value.label ?? "",
              text: it?.value.text ?? "",
              ordinal: String(it?.ordinal ?? 0),
            };
          })();
        return { ...prev, [id]: { ...base, ...patch } };
      });
    },
    [selectedKey, selected],
  );

  const save = useCallback(
    async (groupKey: string, itemKey: string, original: MatchingValue, draft: Draft) => {
      setStatus("กำลังบันทึก…");
      const value: MatchingValue = {
        ...original,
        text: draft.text,
        label: draft.label.trim() || undefined,
      };
      try {
        const res = await fetch("/api/reading/matching", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ groupKey, itemKey, value, ordinal: Number(draft.ordinal) || 0 }),
        });
        const body = (await res.json()) as { ok?: boolean; error?: { message: string } };
        if (res.ok) {
          setStatus(`บันทึก ${itemKey} แล้ว ✓`);
          setDrafts((prev) => {
            const next = { ...prev };
            delete next[`${groupKey}|${itemKey}`];
            return next;
          });
          await reload();
        } else {
          setStatus(body.error?.message ?? "บันทึกไม่สำเร็จ");
        }
      } catch {
        setStatus("บันทึกไม่สำเร็จ");
      }
    },
    [authHeaders, reload],
  );

  const remove = useCallback(
    async (groupKey: string, itemKey: string) => {
      if (!window.confirm(`ลบ "${itemKey}" ?`)) return;
      setStatus("กำลังลบ…");
      try {
        const res = await fetch(
          `/api/reading/matching?groupKey=${encodeURIComponent(groupKey)}&itemKey=${encodeURIComponent(itemKey)}`,
          { method: "DELETE", headers: token.trim() ? { "x-admin-token": token.trim() } : {} },
        );
        setStatus(res.ok ? `ลบ ${itemKey} แล้ว` : "ลบไม่สำเร็จ");
        if (res.ok) await reload();
      } catch {
        setStatus("ลบไม่สำเร็จ");
      }
    },
    [token, reload],
  );

  const addItem = useCallback(
    async (groupKey: string) => {
      const itemKey = newItem.itemKey.trim();
      if (!itemKey) {
        setStatus("ใส่ item_key ก่อน");
        return;
      }
      setStatus("กำลังเพิ่ม…");
      try {
        const res = await fetch("/api/reading/matching", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            groupKey,
            itemKey,
            value: { text: newItem.text, label: newItem.label.trim() || undefined },
            ordinal: Number(newItem.ordinal) || 0,
          }),
        });
        const body = (await res.json()) as { ok?: boolean; error?: { message: string } };
        if (res.ok) {
          setStatus(`เพิ่ม ${itemKey} แล้ว ✓`);
          setNewItem({ itemKey: "", label: "", text: "", ordinal: "" });
          await reload();
        } else {
          setStatus(body.error?.message ?? "เพิ่มไม่สำเร็จ");
        }
      } catch {
        setStatus("เพิ่มไม่สำเร็จ");
      }
    },
    [authHeaders, newItem, reload],
  );

  if (!groups) {
    return <p className="section-note">{status || "กำลังโหลดคำทำนาย Matching…"}</p>;
  }

  return (
    <div className="newdata-admin">
      <div className="knowledge-edit__bar">
        <p className="section-note">
          คำทำนาย Matching (จับคู่/สมพงษ์) — แก้/เพิ่ม/ลบ คำทำนายที่ใช้บนหน้าจับคู่ แก้แล้วมีผลทันที (คะแนน %/เกรด คำนวณจากตาราง ไม่แก้ที่นี่)
        </p>
        <label className="newdata-admin__token">
          admin token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="(ว่างได้ถ้าไม่ตั้ง)"
            onBlur={() => void reload()}
          />
        </label>
        {status && <span className="knowledge-edit__status">{status}</span>}
      </div>

      {unavailable && (
        <p className="section-note newdata-admin__warn">
          ⚠ ตาราง bazi_matching ยังไม่พร้อม — รัน <code>npm run db:apply:matching</code> แล้ว{" "}
          <code>npm run db:seed:matching</code> ก่อน
        </p>
      )}

      <div className="newdata-admin__body">
        <nav className="newdata-admin__groups" aria-label="กลุ่มคำทำนายจับคู่">
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`newdata-admin__group-btn${g.key === selectedKey ? " is-active" : ""}`}
              onClick={() => setSelectedKey(g.key)}
            >
              <span className="newdata-admin__group-label">{g.label}</span>
              <span className="newdata-admin__group-count">{g.items.length}</span>
            </button>
          ))}
        </nav>

        {selected && (
          <section className="newdata-admin__panel">
            <header className="newdata-admin__panel-head">
              <h2>{selected.label}</h2>
              <p className="section-note">{selected.description}</p>
              <p className="newdata-admin__meta">
                group: <code>{selected.key}</code> · keyKind: <code>{selected.keyKind}</code> · ที่มา:{" "}
                {selected.sourceFile}
              </p>
            </header>

            {selected.items.length === 0 && (
              <p className="section-note newdata-admin__empty">
                ยังไม่มีข้อมูลในกลุ่มนี้ — ซินแสเพิ่มได้ด้านล่าง (หน้าจับคู่จะใช้คำเดิมจนกว่าจะเติม)
              </p>
            )}

            <ul className="newdata-admin__items">
              {selected.items.map((item) => {
                const draft = draftFor(item);
                const dirty =
                  draft.text !== (item.value.text ?? "") ||
                  draft.label !== (item.value.label ?? "") ||
                  draft.ordinal !== String(item.ordinal);
                return (
                  <li key={item.itemKey} className="newdata-admin__item">
                    <div className="newdata-admin__item-head">
                      <span className="newdata-admin__item-key">{item.itemKey}</span>
                      <input
                        className="newdata-admin__label-input"
                        value={draft.label}
                        placeholder="ป้าย (label)"
                        onChange={(e) => setDraft(item.itemKey, { label: e.target.value })}
                      />
                      <input
                        className="newdata-admin__ord-input"
                        value={draft.ordinal}
                        inputMode="numeric"
                        title="ลำดับ"
                        onChange={(e) => setDraft(item.itemKey, { ordinal: e.target.value })}
                      />
                    </div>
                    <textarea
                      className="knowledge-edit__textarea"
                      rows={Math.min(10, Math.max(2, draft.text.split("\n").length))}
                      value={draft.text}
                      onChange={(e) => setDraft(item.itemKey, { text: e.target.value })}
                    />
                    <div className="newdata-admin__item-actions">
                      <button
                        type="button"
                        className="newdata-admin__btn newdata-admin__btn--save"
                        disabled={!dirty}
                        onClick={() => void save(selected.key, item.itemKey, item.value, draft)}
                      >
                        บันทึก
                      </button>
                      <button
                        type="button"
                        className="newdata-admin__btn newdata-admin__btn--del"
                        onClick={() => void remove(selected.key, item.itemKey)}
                      >
                        ลบ
                      </button>
                      {item.updatedBy && (
                        <span className="newdata-admin__updated">แก้โดย {item.updatedBy}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="newdata-admin__add">
              <h3>เพิ่มรายการใหม่</h3>
              <div className="newdata-admin__add-row">
                <input
                  className="newdata-admin__label-input"
                  value={newItem.itemKey}
                  placeholder="item_key (เช่น 甲 / 子 / A1 / B6 / หมกยก)"
                  onChange={(e) => setNewItem((p) => ({ ...p, itemKey: e.target.value }))}
                />
                <input
                  className="newdata-admin__label-input"
                  value={newItem.label}
                  placeholder="ป้าย (label) ไม่บังคับ"
                  onChange={(e) => setNewItem((p) => ({ ...p, label: e.target.value }))}
                />
                <input
                  className="newdata-admin__ord-input"
                  value={newItem.ordinal}
                  inputMode="numeric"
                  placeholder="ลำดับ"
                  onChange={(e) => setNewItem((p) => ({ ...p, ordinal: e.target.value }))}
                />
              </div>
              <textarea
                className="knowledge-edit__textarea"
                rows={3}
                value={newItem.text}
                placeholder="คำทำนาย…"
                onChange={(e) => setNewItem((p) => ({ ...p, text: e.target.value }))}
              />
              <button
                type="button"
                className="newdata-admin__btn newdata-admin__btn--save"
                onClick={() => void addItem(selected.key)}
              >
                + เพิ่มรายการ
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
