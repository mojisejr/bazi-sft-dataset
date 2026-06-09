"use client";

// TEMP visual-check route for the YLC PDF document — delete after verifying.
import { PagedPreview } from "@/components/bazi/reading/PagedPreview";
import {
  ReadingPrintDocument,
  type PrintChapter,
} from "@/components/bazi/reading/ReadingPrintDocument";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

const rawInput: RawInputValue = {
  birthDate: "2000-02-14",
  birthTime: "09:53",
  gender: "male",
  province: "กรุงเทพมหานคร",
};

const SAMPLE = `คุณเป็นคนเกิดใน **ดิถีธาตุน้ำหยาง** เปรียบเสมือน "มหาสมุทร" ที่เต็มไปด้วยพลังการเคลื่อนไหว ความคิด และความลึกซึ้งทางอารมณ์ พื้นดวงของคุณจัดอยู่ในลักษณะ **ดวงอ่อน** แม้จะมีธาตุส่งเสริมอยู่ในดวง แต่พลังกลับส่งมาไม่ถึงตัวดิถีโดยตรง

อุปนิสัยของคนธาตุน้ำหยางคือเป็นคน **ปรับตัวเก่ง อยู่กับใครก็ได้ มีพลังและฉลาดลึก** มักเข้าใจสถานการณ์รอบตัวไว รู้จักสังเกตผู้คน

## ด้านที่ควรระวัง
จุดที่ต้องระวังมากที่สุดคือเรื่อง **การสื่อสาร** เพราะแม้คุณจะคิดเก่ง แต่บางครั้งกลับเก็บความรู้สึกไว้ภายใน ควรฝึกเรื่อง:
- การเจรจา
- การพูดคุย
- การใช้ปิยวาจา

แล้วดวงจะยิ่งไหลลื่นและโอกาสดี ๆ จะเข้ามาเร็วขึ้น 🏔 ✨🤖

*** ระวังเป็นพิเศษ ช่วงปีที่ธาตุไฟแรง ควรคุมอารมณ์และการเงินให้ดี`;

const calculatedState = {
  dayMaster: "壬",
  strengthScore: 2.18,
  dayMasterStrengthProfile: { displayLabel: "ดิถีอ่อน" },
  ageSnapshot: { referenceDate: "2026-06-09", thaiAge: 26, chineseAge: 27 },
  fourPillars: {
    hour: { stem: "乙", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
    day: { stem: "壬", branch: "寅", hiddenStems: ["甲", "丙", "戊"] },
    month: { stem: "戊", branch: "寅", hiddenStems: ["甲", "丙", "戊"] },
    year: { stem: "庚", branch: "辰", hiddenStems: ["戊", "乙", "癸"] },
  },
  mingGong: { stem: "丙", branch: "戌", hiddenStems: ["戊", "辛", "丁"] },
  liuNian: { stem: "丙", branch: "午" },
  daYun: [
    { startAge: 4, endAge: 13, stem: "丁", branch: "丑", isCurrent: false },
    { startAge: 14, endAge: 23, stem: "丙", branch: "子", isCurrent: false },
    { startAge: 24, endAge: 33, stem: "辛", branch: "亥", isCurrent: true },
    { startAge: 34, endAge: 43, stem: "庚", branch: "戌", isCurrent: false },
  ],
  elementAnalysis: {
    totalCounts: { wood: 2, fire: 4, earth: 4, metal: 2, water: 1 },
    visibleCounts: { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 },
    hiddenCounts: { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 },
    missingElements: [],
    dominantElements: [],
    elementStrengths: [],
  },
} as unknown as CalculatedStateValue;

const chapters: PrintChapter[] = TOPIC_PATH.filter((t) => t.kind === "predict").map((t) => ({
  chapter: t.chapter,
  title: t.title,
  id: t.id,
  text: SAMPLE,
}));

const relationshipLines = [
  { ageRange: "23-27", symbol: "丙寅", relationLine: "ธาตุไฟส่งเสริม", deepNote: "ช่วงพลังขาขึ้น เหมาะวางรากฐานอาชีพและการเรียนรู้สิ่งใหม่" },
  { ageRange: "28-32", symbol: "丙寅", relationLine: "โชคลาภเปิด", deepNote: "โอกาสด้านการเงินดี แต่ควรระวังการลงทุนที่เกินตัว" },
];

export default function YlcPreviewTestPage() {
  return (
    <div className="ylc-preview">
      <div className="ylc-preview__stage">
        <PagedPreview>
          <ReadingPrintDocument
            rawInput={rawInput}
            calculatedState={calculatedState}
            chapters={chapters}
            relationshipLines={relationshipLines}
          />
        </PagedPreview>
      </div>
    </div>
  );
}
