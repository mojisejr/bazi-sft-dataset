"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";

import { PagedPreview } from "@/components/bazi/reading/PagedPreview";
import { ReadingChartFoundation } from "@/components/bazi/reading/ReadingChartFoundation";
import { MascotBadge } from "@/components/bazi/reading/MascotBadge";
import { ReadingEditPanel } from "@/components/bazi/reading/ReadingEditPanel";
import {
  DEFAULT_REFERRAL_CODE,
  ReadingPrintDocument,
  type PrintChapter,
} from "@/components/bazi/reading/ReadingPrintDocument";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";
import {
  applyFormFieldChange,
  buildBirthDateValue,
  buildBirthTimeValue,
  BIRTH_HOUR_OPTIONS,
  BIRTH_MINUTE_OPTIONS,
  BUDDHIST_ERA_YEAR_OPTIONS,
  createDefaultFormState,
  formStateFromRawInput,
  getBirthDayOptions,
  THAI_MONTH_OPTIONS,
  type FormState,
} from "@/lib/bazi/trainer-workspace";

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

const normTitle = (t: string) => (t || "").trim().replace(/\s+/g, " ");

/**
 * เติม "กล่องที่ขาด" จาก NewData ล่าสุด (base) เข้าไปในบทที่แก้แล้ว (edited) โดย:
 *  - คงกล่องที่แก้ไว้ทั้งเนื้อและลำดับ (ไม่ทำใหม่)
 *  - แทรกเฉพาะกล่องของ base ที่ "หัวข้อยังไม่มี" ใน edited — วางตามลำดับ NewData (หลังกล่องก่อนหน้าที่มีอยู่)
 *  - ไม่ลบกล่องที่ base เอาออก (คงงานซินแสไว้เสมอ) · กล่องไม่มีหัวข้อ = ข้าม (match ไม่ได้)
 * match ด้วยหัวข้อกล่อง (ถ้าซินแสเปลี่ยนชื่อหัวข้อ อาจถูกมองเป็นกล่องใหม่ — พบไม่บ่อย)
 */
function gapFillMerge(base: ReadingBox[], edited: ReadingBox[]): ReadingBox[] {
  const present = new Set(edited.map((b) => normTitle(b.title)).filter((t) => t.length > 0));
  const result = [...edited];
  for (let i = 0; i < base.length; i++) {
    const title = normTitle(base[i].title);
    if (!title || present.has(title)) continue; // มีอยู่แล้ว / ไม่มีหัวข้อ → ข้าม
    // หาตำแหน่งแทรก = หลังกล่องของ base ก่อนหน้าที่ปรากฏใน result อยู่แล้ว (คงลำดับ NewData)
    let insertPos = 0;
    for (let j = i - 1; j >= 0; j--) {
      const pt = normTitle(base[j].title);
      if (pt && present.has(pt)) {
        const idx = result.findIndex((b) => normTitle(b.title) === pt);
        if (idx >= 0) {
          insertPos = idx + 1;
          break;
        }
      }
    }
    result.splice(insertPos, 0, base[i]);
    present.add(title);
  }
  return result;
}

/** เติมกล่องที่ขาด (จาก NewData ล่าสุด) เข้าทุกบทที่มี override — เฉพาะบทที่แก้แล้ว บทที่ยังไม่แก้ใช้ base สดอยู่แล้ว */
function applyGapFill(edits: Edits, chapters: ChapterView[]): Edits {
  if (Object.keys(edits.boxes).length === 0) return edits;
  const baseById = new Map(chapters.map((c) => [c.id, c.boxes]));
  const boxes: Record<string, ReadingBox[]> = {};
  for (const [id, edited] of Object.entries(edits.boxes)) {
    const base = baseById.get(id);
    boxes[id] = base ? gapFillMerge(base, edited) : edited;
  }
  return { ...edits, boxes };
}

/**
 * Tab "อ่านดวงทีละบท (NewData)" — คำทายจาก NewData, แก้เป็นกล่อง (เพิ่ม/ลบ) ได้ทั้งหน้าจอและในตัวอย่าง PDF
 * PDF ดีไซน์เดียวกับหน้าดูดวงหลัก · บันทึก/โหลดดวงข้ามเครื่อง (DB)
 */
export function NewdataReadingWorkspace() {
  // ฟอร์มวันเกิดแบบเดียวกับหน้าอ่านดวงหลัก: dropdown วัน/เดือน/ปี พ.ศ. + ชั่วโมง/นาที
  const [formState, setFormState] = useState<FormState>(() => ({
    ...createDefaultFormState(),
    birthDay: "15",
    birthMonth: "5",
    birthYearBe: "2531", // ค.ศ.1988
    birthHour: "14",
    birthMinute: "30",
    gender: "male",
  }));
  const [clientName, setClientName] = useState("");
  const [referralCode, setReferralCode] = useState(DEFAULT_REFERRAL_CODE);
  /** ชื่อเครื่องนี้ (ต่อ browser) — บอกว่าดวงถูกสร้าง/แก้จากเครื่องไหน (แยกงานซินแส) */
  const [deviceLabel, setDeviceLabel] = useState("");
  useEffect(() => {
    try {
      setDeviceLabel(localStorage.getItem("newdata-reading:device-label") ?? "");
    } catch {
      /* localStorage ปิด */
    }
  }, []);
  const updateDeviceLabel = useCallback((value: string) => {
    setDeviceLabel(value);
    try {
      localStorage.setItem("newdata-reading:device-label", value);
    } catch {
      /* ignore */
    }
  }, []);

  // ค่าที่ derive จาก formState — รูปแบบเดิมที่ API/บันทึก/โหลดใช้
  const birthDate = buildBirthDateValue(formState);
  const birthTime = buildBirthTimeValue(formState.birthHour, formState.birthMinute);
  const gender: "male" | "female" = formState.gender === "female" ? "female" : "male";
  const province = formState.province;
  const dayOptions = getBirthDayOptions(formState.birthMonth, formState.birthYearBe);
  const formComplete = Boolean(birthDate && birthTime);

  const handleField = useCallback(
    (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      const { name, value } = event.target;
      setFormState((prev) => applyFormFieldChange(prev, name, value));
    },
    [],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ReadingData | null>(null);
  const [edits, setEdits] = useState<Edits>(EMPTY_EDITS);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  /** ร่างกล่องที่กำลังแก้ (ยังไม่บันทึก) ต่อบท — กด "บันทึกกล่อง" ถึงจะมีผล */
  const [drafts, setDrafts] = useState<Record<string, ReadingBox[]>>({});
  /** บทที่ AI กำลังเรียบเรียงอยู่ (per-chapter) + สถานะทำทั้งชุด + ข้อความ error */
  const [aiBusy, setAiBusy] = useState<Record<string, boolean>>({});
  const [aiAll, setAiAll] = useState(false);
  const [aiError, setAiError] = useState("");

  const [showPreview, setShowPreview] = useState(false);
  const [editMode, setEditMode] = useState(false);

  type SavedItem = { id: string; clientName: string | null; birthDate: string; birthTime: string; gender: string; deviceLabel: string | null; updatedAt: string };
  const [savedList, setSavedList] = useState<SavedItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("");

  // ── Auto-save: ทายดวงเสร็จ → สร้าง record ใน DB ทันที แล้วบันทึกทุกครั้งที่แก้ (กันปิด tab แล้วงานหาย) ──
  /** สแน็ปช็อตของสิ่งที่บันทึกลง DB ครั้งล่าสุด — กัน autosave ยิงซ้ำค่าเดิม */
  const lastPersistedRef = useRef<string | null>(null);
  /** ข้าม autosave หนึ่งครั้ง (ตอนเพิ่งโหลดดวงจาก DB — ไม่ต้องเขียนกลับทันที) */
  const skipAutosaveOnceRef = useRef(false);
  /** มีการบันทึกค้างอยู่ — กันสร้าง record ซ้ำซ้อนตอนยังไม่มี sessionId */
  const savingRef = useRef(false);
  const serializeReading = useCallback(
    () => JSON.stringify({ clientName, gender, birthDate, birthTime, province, edits, deviceLabel }),
    [clientName, gender, birthDate, birthTime, province, edits, deviceLabel],
  );

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
        } else {
          try {
            const raw = JSON.parse(localStorage.getItem(key) ?? "{}") as Partial<Edits>;
            saved = { boxes: raw.boxes ?? {}, titles: raw.titles ?? {} };
          } catch {
            saved = EMPTY_EDITS;
          }
        }
        // เติมกล่องที่ขาดจาก NewData ล่าสุดเข้าบทที่แก้แล้ว (คงกล่องที่แก้ + แทรกกล่องใหม่ตามลำดับ NewData)
        saved = applyGapFill(saved, body.chapters ?? []);
        if (editsOverride) persist(key, saved);
        setEdits(saved);
        setDrafts({});
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
    lastPersistedRef.current = null; // คำนวณใหม่ = ดวงใหม่ → ให้ autosave สร้าง record เสมอ
    return runReading({ birthDate, birthTime, gender, province });
  }, [runReading, birthDate, birthTime, gender, province]);

  // เปลี่ยนเพศ: ทิศ/อายุเริ่มวัยจร (大運) ขึ้นกับเพศ → ถ้ามีผลอ่านอยู่แล้ว ให้คำนวณใหม่ทันที
  // โดยคงคำที่แก้ไว้ (ส่ง edits เดิมเป็น override ติดไปดวงเพศใหม่ — ไม่ให้หลุด)
  const handleGenderField = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextGender: "male" | "female" = event.target.value === "female" ? "female" : "male";
      setFormState((prev) => applyFormFieldChange(prev, "gender", nextGender));
      if (data && formComplete) {
        void runReading({ birthDate, birthTime, gender: nextGender, province }, edits);
      }
    },
    [data, formComplete, runReading, birthDate, birthTime, province, edits],
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
  /** กล่องที่โชว์ในช่องแก้ = ร่าง (ถ้ามี) ไม่งั้น = ที่บันทึกไว้ */
  const viewBoxes = useCallback(
    (ch: ChapterView): ReadingBox[] => drafts[ch.id] ?? edits.boxes[ch.id] ?? ch.boxes,
    [drafts, edits],
  );
  /** แก้ลง "ร่าง" (ยังไม่บันทึก) */
  const editDraft = useCallback(
    (ch: ChapterView, transform: (boxes: ReadingBox[]) => ReadingBox[]) => {
      setDrafts((prev) => ({ ...prev, [ch.id]: transform(prev[ch.id] ?? edits.boxes[ch.id] ?? ch.boxes) }));
    },
    [edits],
  );
  const updateBox = useCallback(
    (ch: ChapterView, idx: number, field: "title" | "body", value: string) =>
      editDraft(ch, (bs) => bs.map((b, i) => (i === idx ? { ...b, [field]: value } : b))),
    [editDraft],
  );
  const addBox = useCallback(
    (ch: ChapterView) => editDraft(ch, (bs) => [...bs, { title: "", body: "" }]),
    [editDraft],
  );
  const removeBox = useCallback(
    (ch: ChapterView, idx: number) => {
      const box = viewBoxes(ch)[idx];
      if (!window.confirm(`ลบกล่อง "${box?.title || "ไม่มีหัวข้อ"}" ?`)) return;
      editDraft(ch, (bs) => bs.filter((_, i) => i !== idx));
    },
    [viewBoxes, editDraft],
  );
  const moveBox = useCallback(
    (ch: ChapterView, idx: number, dir: -1 | 1) =>
      editDraft(ch, (bs) => {
        const arr = [...bs];
        const j = idx + dir;
        if (j < 0 || j >= arr.length) return arr;
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        return arr;
      }),
    [editDraft],
  );
  /** มีร่างที่ยังไม่บันทึกในบทนี้ไหม */
  const isDirty = useCallback(
    (ch: ChapterView) => ch.id in drafts && !sameBoxes(drafts[ch.id], edits.boxes[ch.id] ?? ch.boxes),
    [drafts, edits],
  );
  /** บันทึกกล่องของบทนี้ (ร่าง → มีผลจริง + เซฟในเครื่อง) */
  const saveBoxesDraft = useCallback(
    (ch: ChapterView) => {
      const draft = drafts[ch.id];
      if (draft) setBoxes(ch, draft);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[ch.id];
        return next;
      });
    },
    [drafts, setBoxes],
  );
  /** ยกเลิกร่าง (กลับไปค่าที่บันทึกไว้ล่าสุด) */
  const cancelDraft = useCallback((chapterId: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[chapterId];
      return next;
    });
  }, []);

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
      cancelDraft(chapterId);
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
    [persist, storageKey, cancelDraft],
  );
  const clearAll = useCallback(() => {
    if (!window.confirm("ล้างคำที่แก้ทั้งหมด กลับไปใช้ต้นฉบับ NewData?")) return;
    setEdits(EMPTY_EDITS);
    setDrafts({});
    persist(storageKey, EMPTY_EDITS);
  }, [persist, storageKey]);

  // ── ทำนายด้วย LLM (Gemini) ──
  // แกนคำตอบ = "ที่ซินแสแก้ไว้" (edits) ถ้ามี ไม่งั้น = NewData ต้นฉบับ → AI ขัดเกลาต่อจากงานซินแส ไม่ล้างทิ้ง
  // (อยาก gen สดจากศูนย์: กด "คืนค่าต้นฉบับบทนี้" ก่อนแล้วค่อยกด AI)
  // ผลลัพธ์แทนที่กล่องเดิมแบบ override — แก้ต่อ/คืนค่าได้เหมือนการแก้ทั่วไป
  const predictChapterAi = useCallback(
    async (ch: ChapterView, mode: "compose" | "refine" = "compose"): Promise<boolean> => {
      if (!data?.rawInput || !data?.calculatedState || !ch.hasContent) return false;
      setAiError("");
      setAiBusy((prev) => ({ ...prev, [ch.id]: true }));
      try {
        const res = await fetch("/api/reading/newdata-reading/llm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            topicId: ch.id,
            rawInput: data.rawInput,
            calculatedState: data.calculatedState,
            boxes: edits.boxes[ch.id] ?? ch.boxes,
            mode,
          }),
        });
        const body = (await res.json()) as { text?: string; error?: string };
        if (!res.ok || !body.text) {
          setAiError(`บท "${titleOf(ch)}": ${body.error ?? "ทำนายด้วย AI ไม่สำเร็จ"}`);
          return false;
        }
        // AI คืนเป็นกล่อง [[box=]]...[[/box]] (โหมดถอดแบบซินแส) → parse เป็นกล่องจริง
        // fallback: ถ้าพาร์สไม่ออก ใช้ทั้งก้อนเป็นกล่องเดียว
        const parsed = parseBoxMarkdown(body.text);
        setBoxes(ch, parsed.length > 0 ? parsed : [{ title: "", body: body.text }]);
        // เคลียร์ร่างที่ยังไม่บันทึก (ถ้ามี) เพื่อให้ผล AI แสดงแทน (ร่างมี precedence เหนือ edits)
        setDrafts((prev) => {
          if (!(ch.id in prev)) return prev;
          const next = { ...prev };
          delete next[ch.id];
          return next;
        });
        return true;
      } catch {
        setAiError(`บท "${titleOf(ch)}": เชื่อมต่อ AI ไม่สำเร็จ`);
        return false;
      } finally {
        setAiBusy((prev) => {
          const next = { ...prev };
          delete next[ch.id];
          return next;
        });
      }
    },
    [data, edits, setBoxes, titleOf],
  );

  // ทำ AI ทีละบท (sequential) เพื่อเลี่ยง rate limit ของ Gemini — เฉพาะบทที่มีคำทาย NewData
  const predictAllAi = useCallback(async () => {
    const chapters = data?.chapters?.filter((c) => c.hasContent) ?? [];
    if (chapters.length === 0) return;
    if (!window.confirm(`ให้ AI เรียบเรียงคำทำนาย ${chapters.length} บท (ทับกล่องเดิม — คืนค่าได้ภายหลัง)?`)) return;
    setAiAll(true);
    setAiError("");
    try {
      for (const ch of chapters) {
        // ทีละบท (sequential) เพื่อเลี่ยง rate limit ของ Gemini
        await predictChapterAi(ch);
      }
    } finally {
      setAiAll(false);
    }
  }, [data, predictChapterAi]);

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
        body: JSON.stringify({ id: sessionId, clientName, birthDate, birthTime, gender, province, edits, deviceLabel: deviceLabel || null }),
      });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        setSaveStatus(body.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setSessionId(body.id);
      lastPersistedRef.current = serializeReading(); // จำสภาพที่เพิ่งบันทึก — กัน autosave ยิงซ้ำทันที
      setSaveStatus(`บันทึกแล้ว ✓ (${clientName || "ไม่ระบุชื่อ"})`);
      await reloadSavedList();
    } catch {
      setSaveStatus("บันทึกไม่สำเร็จ");
    }
  }, [sessionId, clientName, birthDate, birthTime, gender, province, edits, deviceLabel, reloadSavedList, serializeReading]);

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
        setFormState(
          formStateFromRawInput({
            birthDate: r.birthDate,
            birthTime: r.birthTime,
            gender: g,
            province: r.province ?? "",
          }),
        );
        setSessionId(id);
        skipAutosaveOnceRef.current = true; // เพิ่งโหลดจาก DB — ไม่ต้องเขียนกลับทันที
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
  // เปิด "จุดบันทึก" (revision) มาดู/แก้ต่อ — โหลด edits ของจุดนั้น ผูก sessionId = ดวงต้นทาง (บันทึกต่อได้)
  const loadRevision = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/reading/newdata-reading/revisions/${id}`);
        const body = (await res.json()) as {
          id?: string;
          readingId?: string;
          clientName?: string | null;
          birthDate?: string;
          birthTime?: string;
          gender?: string;
          province?: string | null;
          edits?: Partial<Edits>;
          createdAt?: string;
          error?: string;
        };
        if (!res.ok || !body.id || !body.readingId) {
          setSaveStatus(body.error ?? "โหลดไม่สำเร็จ");
          return;
        }
        const g = body.gender === "female" ? "female" : "male";
        setClientName(body.clientName ?? "");
        setFormState(
          formStateFromRawInput({
            birthDate: body.birthDate ?? "",
            birthTime: body.birthTime ?? "",
            gender: g,
            province: body.province ?? "",
          }),
        );
        setSessionId(body.readingId);
        skipAutosaveOnceRef.current = true; // เพิ่งโหลดจุดบันทึก — ไม่ต้องเขียนกลับทันที
        setSaveStatus("เปิดจุดบันทึกจากประวัติแล้ว");
        await runReading(
          { birthDate: body.birthDate ?? "", birthTime: body.birthTime ?? "", gender: g, province: body.province ?? "" },
          { boxes: body.edits?.boxes ?? {}, titles: body.edits?.titles ?? {} },
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

  // Auto-save: ทายดวงเสร็จ → สร้าง record ทันที, แก้กล่อง/ชื่อ → บันทึกต่อเองอัตโนมัติ (debounce) ไม่ต้องกดปุ่ม
  // ส่ง createRevision:false → ลง DB ทุกครั้งแต่ไม่สร้างจุดประวัติรก (จุดประวัติ = กด "บันทึกดวงนี้" เองเท่านั้น)
  useEffect(() => {
    if (!data || !formComplete) return;
    // กันรก: ถ้ายังไม่เคยบันทึก (ไม่มี sessionId) และยังไม่แก้อะไรเลย → "เปิดดูเฉย ๆ" ไม่ต้องสร้าง record
    // (พอแก้ ≥1 บท หรือกด "บันทึกดวงนี้" เอง ค่อยลง DB)
    const noEdits = Object.keys(edits.boxes).length === 0 && Object.keys(edits.titles).length === 0;
    if (!sessionId && noEdits) return;
    const snapshot = serializeReading();
    // เพิ่งโหลดดวงจาก DB — จำค่าไว้เฉย ๆ ไม่เขียนกลับ
    if (skipAutosaveOnceRef.current) {
      skipAutosaveOnceRef.current = false;
      lastPersistedRef.current = snapshot;
      return;
    }
    if (snapshot === lastPersistedRef.current) return;
    const timer = setTimeout(() => {
      void (async () => {
        if (savingRef.current) return; // มีบันทึกค้างอยู่ — รอบหน้าค่อยยิง
        savingRef.current = true;
        const creating = !sessionId;
        try {
          const res = await fetch("/api/reading/newdata-reading/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              id: sessionId ?? undefined,
              clientName,
              birthDate,
              birthTime,
              gender,
              province,
              edits,
              deviceLabel: deviceLabel || null,
              createRevision: false,
            }),
          });
          const body = (await res.json()) as { id?: string; error?: string };
          if (res.ok && body.id) {
            lastPersistedRef.current = snapshot;
            if (creating) {
              setSessionId(body.id);
              await reloadSavedList();
            }
            setSaveStatus("บันทึกอัตโนมัติแล้ว ✓");
          }
        } catch {
          /* best-effort — ยังมี localStorage รองอยู่ */
        } finally {
          savingRef.current = false;
        }
      })();
    }, sessionId ? 1200 : 400); // ครั้งแรกสร้างเร็วหน่อย, การแก้ต่อ ๆ ไป debounce
    return () => clearTimeout(timer);
  }, [
    data,
    formComplete,
    serializeReading,
    sessionId,
    clientName,
    birthDate,
    birthTime,
    gender,
    province,
    edits,
    deviceLabel,
    reloadSavedList,
  ]);

  // เปิดจากหน้าประวัติดวง: ?session=<id> โหลดดวง · ?revision=<id> โหลดจุดบันทึกจากประวัติ (ครั้งเดียว)
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const revisionId = params.get("revision");
    const sessionParam = params.get("session");
    if (!revisionId && !sessionParam) return;
    autoLoadedRef.current = true;
    if (revisionId) void loadRevision(revisionId);
    else if (sessionParam) void loadSession(sessionParam);
  }, [loadSession, loadRevision]);

  // ── เนื้อหา ──
  const editedCount = useMemo(
    () => new Set([...Object.keys(edits.boxes), ...Object.keys(edits.titles)]).size,
    [edits],
  );
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
          เรฟโค้ด Mumate VIP
          <input
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder={DEFAULT_REFERRAL_CODE}
            title="โค้ดชวนเพื่อน (แก้ต่อคนได้) — แสดงบนหน้าก่อนปกหลังใน PDF"
          />
        </label>
        <label>
          ชื่อเครื่องนี้
          <input
            value={deviceLabel}
            onChange={(e) => updateDeviceLabel(e.target.value)}
            placeholder="เช่น เครื่องซินแส"
            title="บอกว่าดวงนี้สร้าง/แก้จากเครื่องไหน — จำต่อ browser นี้ แล้วติดไปกับดวงที่บันทึก"
          />
        </label>
        <label>
          วันเกิด
          <span className="newdata-reading__time">
            <select name="birthDay" aria-label="วัน" value={formState.birthDay} onChange={handleField} required>
              <option value="">วัน</option>
              {dayOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <select name="birthMonth" aria-label="เดือน" value={formState.birthMonth} onChange={handleField} required>
              <option value="">เดือน</option>
              {THAI_MONTH_OPTIONS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            <select name="birthYearBe" aria-label="ปี พ.ศ." value={formState.birthYearBe} onChange={handleField} required>
              <option value="">ปี พ.ศ.</option>
              {BUDDHIST_ERA_YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          เวลาเกิด
          <span className="newdata-reading__time">
            <select name="birthHour" aria-label="ชั่วโมง (24 ชม.)" value={formState.birthHour} onChange={handleField} required>
              <option value="">ชม.</option>
              {BIRTH_HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span aria-hidden>:</span>
            <select name="birthMinute" aria-label="นาที" value={formState.birthMinute} onChange={handleField} required>
              <option value="">นาที</option>
              {BIRTH_MINUTE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="newdata-reading__time-unit">น.</span>
          </span>
        </label>
        <label>
          เพศ
          <select name="gender" value={formState.gender} onChange={handleGenderField} disabled={loading}>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
          </select>
        </label>
        <label>
          จังหวัด
          <input name="province" value={formState.province} onChange={handleField} />
        </label>
        <button type="submit" className="newdata-reading__btn" disabled={loading || !formComplete}>
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
        {data && (
          <button
            type="button"
            className="newdata-reading__btn newdata-reading__btn--ai"
            onClick={() => void predictAllAi()}
            disabled={aiAll || Object.keys(aiBusy).length > 0 || !(summary && summary.got > 0)}
            title="ให้ AI (Gemini) เรียบเรียงทุกบทที่มีคำทายจาก NewData เป็นร้อยแก้ว — ทับกล่อง แต่คืนค่าได้"
          >
            {aiAll ? "✨ ถอดแบบซินแส กำลังเรียบเรียง…" : "✨ ทำนายด้วย AI ทั้งบท (ถอดแบบซินแส)"}
          </button>
        )}
        {editedCount > 0 && (
          <button type="button" className="newdata-reading__btn newdata-reading__btn--ghost" onClick={clearAll}>
            ล้างที่แก้ ({editedCount})
          </button>
        )}
        {saveStatus && <span className="newdata-reading__savestatus">{saveStatus}</span>}
      </form>

      {data && (
        <p className="newdata-reading__hint no-print">
          ✏️ แก้กล่องแล้วกด <strong>💾 บันทึกกล่องบทนี้</strong> (ต่อบท) เพื่อให้มีผล · จากนั้นกด{" "}
          <strong>💾 บันทึกดวงนี้</strong> เพื่อเก็บถาวรลงระบบ (เปิดข้ามเครื่อง / ปรินซ้ำได้)
          {editedCount > 0 ? ` · บันทึกแล้ว ${editedCount} บท` : ""}
        </p>
      )}

      {savedList.length > 0 && (
        <details className="newdata-reading__saved no-print">
          <summary>ดวงที่บันทึกไว้ ({savedList.length})</summary>
          <ul>
            {savedList.map((s) => (
              <li key={s.id} className={s.id === sessionId ? "is-current" : ""}>
                <button type="button" className="newdata-reading__saved-load" onClick={() => void loadSession(s.id)}>
                  {s.clientName || "(ไม่ระบุชื่อ)"} · {s.birthDate} {s.birthTime} · {s.gender === "female" ? "หญิง" : "ชาย"}
                  {s.deviceLabel ? ` · 🖥 ${s.deviceLabel}` : ""}
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
      {aiError && <p className="newdata-reading__error no-print">⚠️ {aiError}</p>}

      {data && (
        <article className="newdata-reading__doc ylc-prose">
          <header className="newdata-reading__cover">
            <p className="newdata-reading__kicker">ถอดรหัสดวงชะตา · ฉบับ NewData</p>
            <h1>{clientName || "เจ้าของดวงชะตา"}</h1>
            <p className="newdata-reading__birth">
              เกิด {data.rawInput?.birthDate} {data.rawInput?.birthTime} · {gender === "male" ? "ชาย" : "หญิง"}
              {data.calculatedState?.dayMaster ? ` · ดิถี ${data.calculatedState.dayMaster}` : ""}
            </p>
            {data.calculatedState && (
              <MascotBadge
                dayStem={data.calculatedState.fourPillars?.day?.stem}
                dayBranch={data.calculatedState.fourPillars?.day?.branch}
              />
            )}
            {data.calculatedState && (
              <ReadingChartFoundation calculatedState={data.calculatedState} />
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
            const boxes = viewBoxes(ch);
            const dirty = isDirty(ch);
            const edited = edits.boxes[ch.id] !== undefined || edits.titles[ch.id] !== undefined;
            return (
              <section key={ch.id} className={`newdata-reading__chapter ${status.cls}${dirty ? " is-dirty" : ""}`}>
                <h2 className="newdata-reading__chapter-title">
                  <span className="newdata-reading__chapter-no">บทที่ {ch.chapter}</span>
                  <input
                    className="newdata-reading__title-input"
                    value={titleOf(ch)}
                    aria-label="ชื่อบท (แก้ได้)"
                    onChange={(e) => setTitle(ch.id, e.target.value)}
                  />
                  {dirty && <span className="newdata-reading__badge no-print is-dirty">● ยังไม่บันทึก</span>}
                  {!dirty && edited && <span className="newdata-reading__badge no-print is-edited">✎ แก้แล้ว</span>}
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
                    <button
                      type="button"
                      className="newdata-reading__btn newdata-reading__btn--ai"
                      disabled={!ch.hasContent || aiBusy[ch.id] || aiAll}
                      onClick={() => void predictChapterAi(ch, "compose")}
                      title={
                        ch.hasContent
                          ? "AI เขียน/เสริมบทนี้แบบซินแส (เอาที่แก้เป็นแกน ถ้ามี) — ทับกล่อง แต่คืนค่าได้"
                          : "บทนี้ยังไม่มีคำทายจาก NewData ให้ AI เรียบเรียง"
                      }
                    >
                      {aiBusy[ch.id] ? "✨ ถอดแบบซินแส…" : "✨ ทำนายด้วย AI (ถอดแบบซินแส)"}
                    </button>
                    <button
                      type="button"
                      className="newdata-reading__btn newdata-reading__btn--ai newdata-reading__btn--refine"
                      disabled={!ch.hasContent || aiBusy[ch.id] || aiAll}
                      onClick={() => void predictChapterAi(ch, "refine")}
                      title="เกลาสำนวนของกล่องเดิมให้ลื่น/อ่านง่าย โดยคงเนื้อครบ ไม่เติมเนื้อ (เอาที่แก้เป็นแกน ถ้ามี)"
                    >
                      {aiBusy[ch.id] ? "✏️ เกลาคำ…" : "✏️ เกลาคำอย่างเดียว"}
                    </button>
                    <button
                      type="button"
                      className="newdata-reading__btn newdata-reading__btn--save newdata-reading__savebox"
                      disabled={!dirty}
                      onClick={() => saveBoxesDraft(ch)}
                    >
                      💾 บันทึกกล่องบทนี้
                    </button>
                    {dirty && (
                      <button type="button" className="newdata-reading__revert" onClick={() => cancelDraft(ch.id)}>
                        ✕ ยกเลิกที่แก้
                      </button>
                    )}
                    {!dirty && edited && (
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
                        referralCode={referralCode}
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
