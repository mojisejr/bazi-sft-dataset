"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChapterEditor } from "@/components/bazi/reading/ChapterEditor";
import { ChapterPagePreview } from "@/components/bazi/reading/ChapterPagePreview";
import { RelationshipLinesEditor } from "@/components/bazi/reading/RelationshipLinesEditor";
import { buildChapterAnnotation, ChapterChartStrip } from "@/components/bazi/reading/ChapterChartStrip";
import {
  ReadingPrintDocument,
  SingleAppendixDocument,
  SingleChapterDocument,
  type PrintChapter,
} from "@/components/bazi/reading/ReadingPrintDocument";
import { countReadingPages, type ReadingPageCount } from "@/components/bazi/reading/reading-page-count";
import type { RelationshipLineRow } from "@/components/bazi/reading/TopicCard";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

const APPENDIX_KEY = "appendix";

type ReadingEditPanelProps = {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  chapters: PrintChapter[];
  relationshipLines: RelationshipLineRow[] | null;
  onSaveChapter: (topicId: string, markdown: string) => void;
  /** แก้ชื่อบท (หัวข้อใหญ่) เฉพาะดวงนี้ — ค่าว่าง = กลับใช้ชื่อเดิม */
  onRenameChapter: (topicId: string, title: string) => void;
  onChangeLines: (rows: RelationshipLineRow[]) => void;
  onGenerateLines: () => void;
  generatingLines: boolean;
  canGenerateLines: boolean;
};

/**
 * โหมดแก้แบบ tab ซ้าย: รายชื่อบทด้านซ้าย, แก้ทีละบทด้านขวา (mount editor เดียว — เบา/ง่าย)
 * + กล่องจำนวนหน้า A4 จริง (นับจาก paged.js ผ่าน hidden ReadingPrintDocument)
 */
export function ReadingEditPanel({
  rawInput,
  calculatedState,
  chapters,
  relationshipLines,
  onSaveChapter,
  onRenameChapter,
  onChangeLines,
  onGenerateLines,
  generatingLines,
  canGenerateLines,
}: ReadingEditPanelProps) {
  const hasAppendix = Boolean(relationshipLines && relationshipLines.length > 0);
  const firstKey = chapters[0]?.id ?? APPENDIX_KEY;
  const [selected, setSelected] = useState<string>(firstKey);

  const sourceRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState<ReadingPageCount | null>(null);
  const [counting, setCounting] = useState(false);
  const [countError, setCountError] = useState(false);
  const [stale, setStale] = useState(false);
  // bump เพื่อ remount มินิพรีวิว (paged.js รันใหม่) เมื่อกด "อัปเดตพรีวิว"
  const [previewKey, setPreviewKey] = useState(0);

  // auto อัปเดตพรีวิว + จำนวนหน้า เมื่อหยุดพิมพ์ ~5 วิ (เลื่อน timer ทุกครั้งที่มีการแก้)
  const autoPreviewRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // runCount ถูกประกาศด้านล่าง → เก็บใน ref ให้ timer เรียกตัวล่าสุดได้
  const runCountRef = useRef<() => void>(() => {});
  const scheduleAutoPreview = useCallback(() => {
    if (autoPreviewRef.current) clearTimeout(autoPreviewRef.current);
    autoPreviewRef.current = setTimeout(() => {
      setPreviewKey((k) => k + 1);
      runCountRef.current(); // อัปเดตจำนวนหน้า A4 อัตโนมัติ (paged.js เอกสารเต็ม)
    }, 5000);
  }, []);
  useEffect(() => () => {
    if (autoPreviewRef.current) clearTimeout(autoPreviewRef.current);
  }, []);

  // ลายเซ็นเนื้อหา — เปลี่ยนเมื่อข้อความบท/ตารางเปลี่ยน → จำนวนหน้าที่เคยนับไว้ "ต้องอัปเดต"
  const signature = useMemo(
    () => chapters.map((c) => `${c.id}:${(c.text ?? "").length}`).join("|") + `#${relationshipLines?.length ?? 0}`,
    [chapters, relationshipLines],
  );

  const runCount = useCallback(async () => {
    if (!sourceRef.current) return;
    setCounting(true);
    setCountError(false);
    try {
      const res = await countReadingPages(sourceRef.current);
      setPageCount(res);
      setStale(false);
    } catch {
      setCountError(true);
    } finally {
      setCounting(false);
    }
  }, []);

  // ให้ timer auto เรียก runCount ตัวล่าสุดได้
  useEffect(() => {
    runCountRef.current = () => void runCount();
  }, [runCount]);

  // นับครั้งแรกตอนเปิดโหมดแก้
  useEffect(() => {
    void runCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // เนื้อหาเปลี่ยนหลังนับแล้ว → ตั้ง stale (ไม่รันนับเองทุกครั้ง เพราะ paged.js ช้า)
  const firstSig = useRef(signature);
  useEffect(() => {
    if (signature !== firstSig.current) setStale(true);
  }, [signature]);

  const selectedChapter = chapters.find((c) => c.id === selected);
  const annotation =
    selectedChapter?.id ? buildChapterAnnotation(calculatedState, selectedChapter.id) : null;

  return (
    <div className="ylc-edit-layout">
      {/* hidden source สำหรับนับจำนวนหน้า (default doc มี data-ch-start ต่อบท) */}
      <div ref={sourceRef} className="ylc-edit-source" aria-hidden="true">
        <ReadingPrintDocument
          rawInput={rawInput}
          calculatedState={calculatedState}
          chapters={chapters}
          relationshipLines={relationshipLines}
        />
      </div>

      {/* ── ซ้าย: รายชื่อบท + จำนวนหน้า ── */}
      <nav className="ylc-edit-nav" aria-label="รายชื่อบท">
        <div className="ylc-pagecount-box">
          <div className="ylc-pagecount-box__num">
            {pageCount ? `${pageCount.total} หน้า` : counting ? "กำลังนับ…" : "— หน้า"}
          </div>
          <button type="button" className="ylc-pagecount-box__btn" onClick={() => void runCount()} disabled={counting}>
            {counting ? "กำลังนับ…" : "อัปเดตจำนวนหน้า"}
          </button>
          {stale && !counting ? <span className="ylc-pagecount-box__stale">ต้องอัปเดต</span> : null}
          {countError ? <span className="ylc-pagecount-box__err">นับไม่สำเร็จ ลองใหม่</span> : null}
        </div>

        <ul className="ylc-edit-nav__list">
          {chapters.map((ch) => (
            <li key={ch.id ?? ch.chapter}>
              <button
                type="button"
                className={`ylc-edit-nav__item ${selected === ch.id ? "is-active" : ""}`}
                onClick={() => ch.id && setSelected(ch.id)}
              >
                <span className="ylc-edit-nav__title">
                  {ch.chapter}. {ch.title}
                </span>
                {ch.id && pageCount?.perChapter[ch.id] ? (
                  <span className="ylc-edit-nav__pages">{pageCount.perChapter[ch.id]} หน้า</span>
                ) : null}
              </button>
            </li>
          ))}
          {hasAppendix ? (
            <li>
              <button
                type="button"
                className={`ylc-edit-nav__item ${selected === APPENDIX_KEY ? "is-active" : ""}`}
                onClick={() => setSelected(APPENDIX_KEY)}
              >
                <span className="ylc-edit-nav__title">บทเสริม · ตารางวัยจร</span>
                {pageCount?.perChapter[APPENDIX_KEY] ? (
                  <span className="ylc-edit-nav__pages">{pageCount.perChapter[APPENDIX_KEY]} หน้า</span>
                ) : null}
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      {/* ── ขวา: แก้ทีละบท ── */}
      <main className="ylc-edit-main">
        {selected === APPENDIX_KEY && relationshipLines ? (
          <RelationshipLinesEditor
            rows={relationshipLines}
            onChange={(rows) => {
              onChangeLines(rows);
              scheduleAutoPreview();
            }}
            onGenerateDeepNotes={onGenerateLines}
            generating={generatingLines}
            canGenerate={canGenerateLines}
          />
        ) : selectedChapter ? (
          <div className="ylc-edit-main__chapter">
            <div className="ylc-edit-main__title-row">
              <span className="ylc-edit-main__title-num">{selectedChapter.chapter}.</span>
              <input
                key={`title-${selected}`}
                className="ylc-edit-main__title-input"
                type="text"
                value={selectedChapter.title}
                aria-label="หัวข้อใหญ่ของบท (แก้ได้)"
                title="แก้หัวข้อใหญ่ของบทนี้ (เฉพาะดวงนี้) — ลบให้ว่างเพื่อกลับใช้ชื่อเดิม"
                onChange={(event) =>
                  selectedChapter.id && onRenameChapter(selectedChapter.id, event.target.value)
                }
              />
            </div>
            {annotation ? (
              <div className="ylc-prose">
                <ChapterChartStrip annotation={annotation} uid={selectedChapter.id ?? String(selectedChapter.chapter)} />
              </div>
            ) : null}
            <ChapterEditor
              key={selected}
              value={selectedChapter.text ?? ""}
              onChange={(md) => {
                if (selectedChapter.id) onSaveChapter(selectedChapter.id, md);
                scheduleAutoPreview();
              }}
            />
          </div>
        ) : null}
      </main>

      {/* ── ขวาสุด: มินิพรีวิวหน้าจริง (บท / บทเสริม) — PDF แบ่งตรงไหน ── */}
      {selected !== APPENDIX_KEY && selectedChapter ? (
        <aside className="ylc-edit-preview" aria-label="หน้าจริงใน PDF">
          <div className="ylc-edit-preview__head">
            <span>หน้าจริงใน PDF · เห็นจุดแบ่งหน้า</span>
            <button type="button" className="ylc-edit-preview__btn" onClick={() => setPreviewKey((k) => k + 1)}>
              อัปเดตพรีวิว
            </button>
          </div>
          <ChapterPagePreview key={`${selected}-${previewKey}`}>
            <SingleChapterDocument rawInput={rawInput} calculatedState={calculatedState} chapter={selectedChapter} />
          </ChapterPagePreview>
        </aside>
      ) : selected === APPENDIX_KEY && relationshipLines && relationshipLines.length > 0 ? (
        <aside className="ylc-edit-preview" aria-label="หน้าจริงใน PDF (บทเสริม)">
          <div className="ylc-edit-preview__head">
            <span>หน้าจริงใน PDF · บทเสริม</span>
            <button type="button" className="ylc-edit-preview__btn" onClick={() => setPreviewKey((k) => k + 1)}>
              อัปเดตพรีวิว
            </button>
          </div>
          <ChapterPagePreview key={`appendix-${previewKey}`}>
            <SingleAppendixDocument rawInput={rawInput} relationshipLines={relationshipLines} />
          </ChapterPagePreview>
        </aside>
      ) : null}
    </div>
  );
}
