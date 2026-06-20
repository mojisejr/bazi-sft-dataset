"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { PagedPreview } from "@/components/bazi/reading/PagedPreview";
import { ReadingEditPanel } from "@/components/bazi/reading/ReadingEditPanel";
import {
  ReadingPrintDocument,
  type PrintChapter,
} from "@/components/bazi/reading/ReadingPrintDocument";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

type ReadingBox = { title: string; body: string };
type ChapterView = {
  id: string;
  chapter: number;
  title: string;
  intro: string | null;
  defined: boolean;
  hasContent: boolean;
  boxes: ReadingBox[];
};
type ReadingData = {
  rawInput?: RawInputValue;
  calculatedState?: CalculatedStateValue;
  chapters?: ChapterView[];
  error?: string;
};
/** override ต่อบท: กล่อง (เพิ่ม/ลบ/แก้) + ชื่อบท — เก็บเฉพาะบทที่ซินแสแก้ */
type Edits = { boxes: Record<string, ReadingBox[]>; titles: Record<string, string> };

const EMPTY_EDITS: Edits = { boxes: {}, titles: {} };

const PILLAR_LABELS: Array<["year" | "month" | "day" | "hour", string]> = [
  ["year", "ปี"],
  ["month", "เดือน"],
  ["day", "วัน (ดิถี)"],
  ["hour", "ยาม"],
];

function sameBoxes(a: ReadingBox[], b: ReadingBox[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** กล่อง → markdown สำหรับ PDF (หัวข้อ = **ตัวหนา** ให้ ReadingPrintDocument เก็บหัวข้อไว้) */
function boxesToBoldMarkdown(boxes: ReadingBox[]): string {
  return boxes
    .map((b) => [b.title ? `**${b.title}**` : "", b.body].filter(Boolean).join("\n\n"))
    .join("\n\n")
    .trim();
}
/** กล่อง → markdown รูปกล่อง [[box=]] สำหรับ ChapterEditor (โชว์กล่องจริง round-trip ได้) */
function boxesToBoxMarkdown(boxes: ReadingBox[]): string {
  return boxes.map((b) => `[[box=${b.title}]]\n${b.body}\n[[/box]]`).join("\n");
}
/** markdown ([[box=]] หรือ **หัวข้อ** เดี่ยว) → กล่อง — ใช้ตอน ChapterEditor บันทึก */
function parseBoxMarkdown(md: string): ReadingBox[] {
  const lines = md.replace(/\r/g, "").split("\n");
  const boxes: Array<{ title: string; body: string[] }> = [];
  const appendBody = (line: string) => {
    if (boxes.length === 0) boxes.push({ title: "", body: [] });
    boxes[boxes.length - 1].body.push(line);
  };
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const boxOpen = t.match(/^\[\[box=(.*)\]\]$/);
    if (boxOpen) {
      boxes.push({ title: boxOpen[1].trim(), body: [] });
      i++;
      while (i < lines.length && lines[i].trim() !== "[[/box]]") {
        boxes[boxes.length - 1].body.push(lines[i]);
        i++;
      }
      continue;
    }
    if (t === "[[/box]]") continue;
    const boldOnly = t.match(/^\*\*(.+?)\*\*$/);
    if (boldOnly) {
      boxes.push({ title: boldOnly[1].trim(), body: [] });
      continue;
    }
    if (!t) {
      if (boxes.length) boxes[boxes.length - 1].body.push("");
      continue;
    }
    appendBody(lines[i]);
  }
  return boxes.map((b) => ({ title: b.title, body: b.body.join("\n").trim() }));
}

/**
 * Tab "อ่านดวงทีละบท (NewData)" — คำทายจาก NewData, แก้เป็นกล่อง (เพิ่ม/ลบ) ได้ทั้งหน้าจอและในตัวอย่าง PDF
 * PDF ดีไซน์เดียวกับหน้าดูดวงหลัก · บันทึก/โหลดดวงข้ามเครื่อง (DB)
 */
export function NewdataReadingWorkspace() {
  const [birthDate, setBirthDate] = useState("1988-05-15");
  const [birthTime, setBirthTime] = useState("14:30");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [province, setProvince] = useState("กรุงเทพมหานคร");
  const [clientName, setClientName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ReadingData | null>(null);
  const [edits, setEdits] = useState<Edits>(EMPTY_EDITS);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [editMode, setEditMode] = useState(false);

  type SavedItem = { id: string; clientName: string | null; birthDate: string; birthTime: string; gender: string; updatedAt: string };
  const [savedList, setSavedList] = useState<SavedItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("");

  const persist = useCallback((key: string | null, next: Edits) => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* localStorage เต็ม/ปิด */
    }
  }, []);

  type BirthInput = { birthDate: string; birthTime: string; gender: "male" | "female"; province: string };

  const runReading = useCallback(
    async (input: BirthInput, editsOverride?: Edits) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/reading/newdata-reading", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        const body = (await res.json()) as ReadingData;
        if (!res.ok) {
          setError(body.error ?? "คำนวณไม่สำเร็จ");
          setData(null);
          return;
        }
        setData(body);
        const key = `newdata-reading:${input.birthDate}:${input.birthTime}:${input.gender}`;
        setStorageKey(key);
        let saved: Edits = EMPTY_EDITS;
        if (editsOverride) {
          saved = { boxes: editsOverride.boxes ?? {}, titles: editsOverride.titles ?? {} };
          persist(key, saved);
        } else {
          try {
            const raw = JSON.parse(localStorage.getItem(key) ?? "{}") as Partial<Edits>;
            saved = { boxes: raw.boxes ?? {}, titles: raw.titles ?? {} };
          } catch {
            saved = EMPTY_EDITS;
          }
        }
        setEdits(saved);
      } catch {
        setError("เชื่อมต่อไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [persist],
  );

  const submit = useCallback(() => {
    setSessionId(null);
    return runReading({ birthDate, birthTime, gender, province });
  }, [runReading, birthDate, birthTime, gender, province]);

  const boxesOf = useCallback(
    (ch: ChapterView) => edits.boxes[ch.id] ?? ch.boxes,
    [edits],
  );
  const titleOf = useCallback((ch: ChapterView) => edits.titles[ch.id] ?? ch.title, [edits]);

  /** ตั้งกล่องของบท — เท่ากับต้นฉบับ = ลบ override */
  const setBoxes = useCallback(
    (ch: ChapterView, next: ReadingBox[]) => {
      setEdits((prev) => {
        const boxes = { ...prev.boxes };
        if (sameBoxes(next, ch.boxes)) delete boxes[ch.id];
        else boxes[ch.id] = next;
        const out = { ...prev, boxes };
        persist(storageKey, out);
        return out;
      });
    },
    [persist, storageKey],
  );
  const updateBox = useCallback(
    (ch: ChapterView, idx: number, field: "title" | "body", value: string) =>
      setBoxes(ch, boxesOf(ch).map((b, i) => (i === idx ? { ...b, [field]: value } : b))),
    [boxesOf, setBoxes],
  );
  const addBox = useCallback(
    (ch: ChapterView) => setBoxes(ch, [...boxesOf(ch), { title: "", body: "" }]),
    [boxesOf, setBoxes],
  );
  const removeBox = useCallback(
    (ch: ChapterView, idx: number) => {
      const box = boxesOf(ch)[idx];
      if (!window.confirm(`ลบกล่อง "${box?.title || "ไม่มีหัวข้อ"}" ?`)) return;
      setBoxes(ch, boxesOf(ch).filter((_, i) => i !== idx));
    },
    [boxesOf, setBoxes],
  );
  const moveBox = useCallback(
    (ch: ChapterView, idx: number, dir: -1 | 1) => {
      const arr = [...boxesOf(ch)];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      setBoxes(ch, arr);
    },
    [boxesOf, setBoxes],
  );
  const setTitle = useCallback(
    (chapterId: string, title: string) => {
      setEdits((prev) => {
        const titles = { ...prev.titles };
        if (!title.trim()) delete titles[chapterId];
        else titles[chapterId] = title;
        const out = { ...prev, titles };
        persist(storageKey, out);
        return out;
      });
    },
    [persist, storageKey],
  );
  const revertChapter = useCallback(
    (chapterId: string) => {
      setEdits((prev) => {
        const boxes = { ...prev.boxes };
        const titles = { ...prev.titles };
        delete boxes[chapterId];
        delete titles[chapterId];
        const out = { boxes, titles };
        persist(storageKey, out);
        return out;
      });
    },
    [persist, storageKey],
  );
  const clearAll = useCallback(() => {
    if (!window.confirm("ล้างคำที่แก้ทั้งหมด กลับไปใช้ต้นฉบับ NewData?")) return;
    setEdits(EMPTY_EDITS);
    persist(storageKey, EMPTY_EDITS);
  }, [persist, storageKey]);

  // ── DB ──
  const reloadSavedList = useCallback(async () => {
    try {
      const res = await fetch("/api/reading/newdata-reading/sessions");
      const body = (await res.json()) as { items?: SavedItem[] };
      setSavedList(body.items ?? []);
    } catch {
      /* best-effort */
    }
  }, []);
  useEffect(() => {
    void reloadSavedList();
  }, [reloadSavedList]);

  const saveReading = useCallback(async () => {
    setSaveStatus("กำลังบันทึก…");
    try {
      const res = await fetch("/api/reading/newdata-reading/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: sessionId, clientName, birthDate, birthTime, gender, province, edits }),
      });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        setSaveStatus(body.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setSessionId(body.id);
      setSaveStatus(`บันทึกแล้ว ✓ (${clientName || "ไม่ระบุชื่อ"})`);
      await reloadSavedList();
    } catch {
      setSaveStatus("บันทึกไม่สำเร็จ");
    }
  }, [sessionId, clientName, birthDate, birthTime, gender, province, edits, reloadSavedList]);

  const loadSession = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/reading/newdata-reading/sessions/${id}`);
        const body = (await res.json()) as {
          reading?: { clientName: string | null; birthDate: string; birthTime: string; gender: string; province: string | null; edits: Partial<Edits> };
          error?: string;
        };
        if (!res.ok || !body.reading) {
          setSaveStatus(body.error ?? "โหลดไม่สำเร็จ");
          return;
        }
        const r = body.reading;
        const g = r.gender === "female" ? "female" : "male";
        setClientName(r.clientName ?? "");
        setBirthDate(r.birthDate);
        setBirthTime(r.birthTime);
        setGender(g);
        setProvince(r.province ?? "");
        setSessionId(id);
        setSaveStatus(`เปิดดวง "${r.clientName || r.birthDate}" แล้ว`);
        await runReading(
          { birthDate: r.birthDate, birthTime: r.birthTime, gender: g, province: r.province ?? "" },
          { boxes: r.edits.boxes ?? {}, titles: r.edits.titles ?? {} },
        );
      } catch {
        setSaveStatus("โหลดไม่สำเร็จ");
      }
    },
    [runReading],
  );
  const deleteSession = useCallback(
    async (id: string) => {
      if (!window.confirm("ลบดวงที่บันทึกนี้?")) return;
      try {
        await fetch(`/api/reading/newdata-reading/sessions/${id}`, { method: "DELETE" });
        if (sessionId === id) setSessionId(null);
        await reloadSavedList();
      } catch {
        /* ignore */
      }
    },
    [sessionId, reloadSavedList],
  );

  // ── เนื้อหา ──
  const editedCount = useMemo(
    () => new Set([...Object.keys(edits.boxes), ...Object.keys(edits.titles)]).size,
    [edits],
  );
  const pillars = data?.calculatedState?.fourPillars;
  const summary = useMemo(() => {
    if (!data?.chapters) return null;
    return { got: data.chapters.filter((c) => c.hasContent).length, total: data.chapters.length };
  }, [data]);

  // PDF (หัวข้อ = ตัวหนา, คงไว้ในเอกสาร)
  const printChapters: PrintChapter[] = useMemo(() => {
    if (!data?.chapters) return [];
    return data.chapters.map((ch) => {
      const text = boxesToBoldMarkdown(edits.boxes[ch.id] ?? ch.boxes);
      return { chapter: ch.chapter, title: edits.titles[ch.id] ?? ch.title, id: ch.id, text: text || null };
    });
  }, [data, edits]);
  // ChapterEditor (รูปกล่อง [[box=]] เพื่อให้แก้เป็นกล่องในตัวอย่าง PDF ได้)
  const editChapters: PrintChapter[] = useMemo(() => {
    if (!data?.chapters) return [];
    return data.chapters.map((ch) => {
      const text = boxesToBoxMarkdown(edits.boxes[ch.id] ?? ch.boxes);
      return { chapter: ch.chapter, title: edits.titles[ch.id] ?? ch.title, id: ch.id, text: text || null };
    });
  }, [data, edits]);

  const pdfContentKey = useMemo(
    () => printChapters.map((c) => `${c.id}:${c.title}:${c.text ?? ""}`).join("|"),
    [printChapters],
  );

  function handlePrintYlc() {
    if (typeof window === "undefined") return;
    document.body.classList.add("ylc-printing");
    const cleanup = () => {
      document.body.classList.remove("ylc-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  return (
    <div className="newdata-reading">
      <form
        className="newdata-reading__form no-print"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label>
          ชื่อเจ้าของดวง
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="(ไม่บังคับ)" />
        </label>
        <label>
          วันเกิด
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
        </label>
        <label>
          เวลาเกิด
          <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} required />
        </label>
        <label>
          เพศ
          <select value={gender} onChange={(e) => setGender(e.target.value as "male" | "female")}>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
          </select>
        </label>
        <label>
          จังหวัด
          <input value={province} onChange={(e) => setProvince(e.target.value)} />
        </label>
        <button type="submit" className="newdata-reading__btn" disabled={loading}>
          {loading ? "กำลังคำนวณ…" : "อ่านดวง 15 บท"}
        </button>
        {data && (
          <button
            type="button"
            className="newdata-reading__btn newdata-reading__btn--print"
            onClick={() => {
              setEditMode(false);
              setShowPreview(true);
            }}
          >
            🖨 ดู/พิมพ์ PDF
          </button>
        )}
        {data && (
          <button type="button" className="newdata-reading__btn newdata-reading__btn--save" onClick={() => void saveReading()}>
            💾 {sessionId ? "บันทึกทับ" : "บันทึกดวงนี้"}
          </button>
        )}
        {editedCount > 0 && (
          <button type="button" className="newdata-reading__btn newdata-reading__btn--ghost" onClick={clearAll}>
            ล้างที่แก้ ({editedCount})
          </button>
        )}
        {saveStatus && <span className="newdata-reading__savestatus">{saveStatus}</span>}
      </form>

      {savedList.length > 0 && (
        <details className="newdata-reading__saved no-print">
          <summary>ดวงที่บันทึกไว้ ({savedList.length})</summary>
          <ul>
            {savedList.map((s) => (
              <li key={s.id} className={s.id === sessionId ? "is-current" : ""}>
                <button type="button" className="newdata-reading__saved-load" onClick={() => void loadSession(s.id)}>
                  {s.clientName || "(ไม่ระบุชื่อ)"} · {s.birthDate} {s.birthTime} · {s.gender === "female" ? "หญิง" : "ชาย"}
                </button>
                <button type="button" className="newdata-reading__saved-del" title="ลบ" onClick={() => void deleteSession(s.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="newdata-reading__error no-print">{error}</p>}

      {data && (
        <article className="newdata-reading__doc ylc-prose">
          <header className="newdata-reading__cover">
            <p className="newdata-reading__kicker">ถอดรหัสดวงชะตา · ฉบับ NewData</p>
            <h1>{clientName || "เจ้าของดวงชะตา"}</h1>
            <p className="newdata-reading__birth">
              เกิด {data.rawInput?.birthDate} {data.rawInput?.birthTime} · {gender === "male" ? "ชาย" : "หญิง"}
              {data.calculatedState?.dayMaster ? ` · ดิถี ${data.calculatedState.dayMaster}` : ""}
            </p>
            {pillars && (
              <table className="newdata-reading__pillars">
                <thead>
                  <tr>
                    {PILLAR_LABELS.map(([, label]) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {PILLAR_LABELS.map(([pos]) => (
                      <td key={pos}>{pillars[pos]?.stem}</td>
                    ))}
                  </tr>
                  <tr>
                    {PILLAR_LABELS.map(([pos]) => (
                      <td key={pos}>{pillars[pos]?.branch}</td>
                    ))}
                  </tr>
                  <tr className="newdata-reading__pillars-stage">
                    {PILLAR_LABELS.map(([pos]) => (
                      <td key={pos}>{pillars[pos]?.lowerStagePrimary ?? pillars[pos]?.lookingStage ?? "—"}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}
            {summary && (
              <p className="newdata-reading__summary no-print">
                บทที่มีคำทายจาก NewData: {summary.got}/{summary.total} · แก้กล่องได้ในหน้านี้ (เพิ่ม/ลบ/พิมพ์) แล้วกด “ดู/พิมพ์ PDF”
              </p>
            )}
          </header>

          {data.chapters?.map((ch) => {
            const status = !ch.defined
              ? { cls: "is-empty", label: "ยังไม่มีข้อมูล" }
              : ch.hasContent
                ? { cls: "is-ok", label: "✓" }
                : { cls: "is-nomatch", label: "ดวงนี้ไม่เข้าเงื่อนไข" };
            const boxes = boxesOf(ch);
            const edited = edits.boxes[ch.id] !== undefined || edits.titles[ch.id] !== undefined;
            return (
              <section key={ch.id} className={`newdata-reading__chapter ${status.cls}`}>
                <h2 className="newdata-reading__chapter-title">
                  <span className="newdata-reading__chapter-no">บทที่ {ch.chapter}</span>
                  <input
                    className="newdata-reading__title-input"
                    value={titleOf(ch)}
                    aria-label="ชื่อบท (แก้ได้)"
                    onChange={(e) => setTitle(ch.id, e.target.value)}
                  />
                  {edited && <span className="newdata-reading__badge no-print is-edited">✎ แก้แล้ว</span>}
                  <span className={`newdata-reading__badge no-print ${status.cls}`}>{status.label}</span>
                </h2>

                <div className="newdata-reading__boxes no-print">
                  {boxes.map((box, idx) => (
                    <section key={idx} className="ylc-box newdata-reading__editbox">
                      <div className="newdata-reading__editbox-head">
                        <input
                          className="newdata-reading__box-title"
                          value={box.title}
                          placeholder="หัวข้อกล่อง (เว้นว่างได้)"
                          onChange={(e) => updateBox(ch, idx, "title", e.target.value)}
                        />
                        <div className="newdata-reading__box-tools">
                          <button type="button" title="ย้ายขึ้น" disabled={idx === 0} onClick={() => moveBox(ch, idx, -1)}>
                            ↑
                          </button>
                          <button type="button" title="ย้ายลง" disabled={idx === boxes.length - 1} onClick={() => moveBox(ch, idx, 1)}>
                            ↓
                          </button>
                          <button type="button" className="newdata-reading__box-del" title="ลบกล่อง" onClick={() => removeBox(ch, idx)}>
                            ลบ
                          </button>
                        </div>
                      </div>
                      <textarea
                        className="newdata-reading__box-body"
                        value={box.body}
                        rows={Math.min(12, Math.max(2, box.body.split("\n").length + 1))}
                        placeholder="(รอซินแสเติมคำทำนาย)"
                        onChange={(e) => updateBox(ch, idx, "body", e.target.value)}
                      />
                    </section>
                  ))}
                  <div className="newdata-reading__box-actions">
                    <button type="button" className="newdata-reading__box-add" onClick={() => addBox(ch)}>
                      ＋ เพิ่มกล่อง
                    </button>
                    {edited && (
                      <button type="button" className="newdata-reading__revert" onClick={() => revertChapter(ch.id)}>
                        ↺ คืนค่าต้นฉบับบทนี้
                      </button>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </article>
      )}

      {showPreview && data?.rawInput && data?.calculatedState && typeof document !== "undefined"
        ? createPortal(
            <div className="ylc-print-portal">
              <div className="ylc-preview" role="dialog" aria-label="ตัวอย่าง/แก้ PDF (NewData)">
                <div className="ylc-preview__toolbar">
                  <span className="ylc-preview__toolbar-title">
                    {clientName || "เจ้าของดวงชะตา"} · เกิด {data.rawInput.birthDate} {data.rawInput.birthTime} น.
                  </span>
                  <div className="ylc-preview__toolbar-actions">
                    <button
                      type="button"
                      className={`ylc-preview__btn ${editMode ? "ylc-preview__btn--primary" : "ylc-preview__btn--ghost"}`}
                      onClick={() => setEditMode((v) => !v)}
                    >
                      {editMode ? "ดูหน้าจริง (A4)" : "แก้ข้อความ"}
                    </button>
                    <button type="button" className="ylc-preview__btn ylc-preview__btn--primary" onClick={handlePrintYlc}>
                      🖨 พิมพ์ / บันทึก PDF
                    </button>
                    <button
                      type="button"
                      className="ylc-preview__btn ylc-preview__btn--ghost"
                      onClick={() => {
                        setShowPreview(false);
                        setEditMode(false);
                      }}
                    >
                      ปิด
                    </button>
                  </div>
                </div>
                <div className="ylc-preview__stage">
                  {editMode ? (
                    <ReadingEditPanel
                      rawInput={data.rawInput}
                      calculatedState={data.calculatedState}
                      chapters={editChapters}
                      relationshipLines={null}
                      onSaveChapter={(topicId, markdown) => {
                        const ch = data.chapters?.find((c) => c.id === topicId);
                        if (ch) setBoxes(ch, parseBoxMarkdown(markdown));
                      }}
                      onRenameChapter={setTitle}
                      onChangeLines={() => {}}
                      onGenerateLines={() => {}}
                      generatingLines={false}
                      canGenerateLines={false}
                    />
                  ) : (
                    <PagedPreview key={pdfContentKey}>
                      <ReadingPrintDocument
                        rawInput={data.rawInput}
                        calculatedState={data.calculatedState}
                        chapters={printChapters}
                        clientName={clientName || null}
                      />
                    </PagedPreview>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
