// Hour Rectification v3 — POST /api/bazi/rectify-hour/reading (#hour-rectification-engine,
// สอบจากคำทำนาย lane, end-to-end). ใช้ handler factory ฉีด loadMap ปลอม (ไม่แตะ DB) — engine
// คำนวณดวง 12 ยามจริง (no-op knowledge repository เหมือน v1/v2) ส่วนคลัง NewData เป็น map ที่คุมได้
//
// เหมือน events test: ผลชนะเป็น property ของดวง ไม่ hardcode — assert รูปร่าง/สถานะที่ valid แทน
import { describe, expect, test, vi } from "vitest";

import { createRectifyHourReadingHandler } from "@/app/api/bazi/rectify-hour/reading/route";

// Prove โครงสร้าง: route ห้ามสร้าง DB client เอง (loadMap ถูกฉีดเสมอในเทสต์นี้)
vi.mock("@/db/client", () => ({
  createDbClient: vi.fn(() => {
    throw new Error("rectify-hour reading test must not construct a DB client");
  }),
  createDbSqlClient: vi.fn(() => {
    throw new Error("rectify-hour reading test must not construct a DB sql client");
  }),
}));

const VALID_BIRTH = {
  birthDate: "1989-01-03",
  gender: "male",
  province: "กรุงเทพมหานคร",
} as const;

// คลังปลอม: subordinate_state ครบทั้ง 12 สถานะเชี่ยงแซ (สถานะจริงของดวงจะ hit ตัวใดตัวหนึ่งแน่)
// เนื้อไม่ซ้ำกันต่อสถานะ → มีโอกาสเกิดคำถามเมื่อยามใน daypart ตกคนละสถานะ
const ALL_STATES = [
  "เชี่ยงแซ",
  "หมกยก",
  "กวงตั่ว",
  "ลิ่มกัว",
  "ตี้อ๋วง",
  "ซวย",
  "แป่",
  "ซี่",
  "หมอ",
  "เจ๊าะ",
  "ทอ",
  "เอี้ยง",
];
const FAKE_MAP = {
  subordinate_state: Object.fromEntries(
    ALL_STATES.map((s, i) => [s, `บริวารแบบ${i + 1} (${s})`]),
  ),
};

function createHandler() {
  return createRectifyHourReadingHandler({
    loadMap: async () => FAKE_MAP as never,
  });
}

function createRequest(body: unknown) {
  return new Request("http://localhost/api/bazi/rectify-hour/reading", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bazi/rectify-hour/reading — validation", () => {
  test("birthDate ไม่ใช่วันจริง → 400", async () => {
    const POST = createHandler();
    const response = await POST(
      createRequest({ ...VALID_BIRTH, birthDate: "2026-99-99", answers: [] }),
    );
    expect(response.status).toBe(400);
  });

  test("gender นอก enum → 400", async () => {
    const POST = createHandler();
    const response = await POST(
      createRequest({ ...VALID_BIRTH, gender: "other", answers: [] }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/bazi/rectify-hour/reading — flow ตามหลักอาจารย์", () => {
  test("ไม่ส่ง daypart → need_daypart พร้อม 4 ช่วง", async () => {
    const POST = createHandler();
    const response = await POST(createRequest({ ...VALID_BIRTH, answers: [] }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; dayparts: unknown[] };
    expect(body.status).toBe("need_daypart");
    expect(body.dayparts).toHaveLength(4);
  });

  test('daypart "unknown" → unknown_daypart (gate: ไม่รู้ช่วงเลยไม่ไปต่อ)', async () => {
    const POST = createHandler();
    const response = await POST(
      createRequest({ ...VALID_BIRTH, daypart: "unknown", answers: [] }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; message: string };
    expect(body.status).toBe("unknown_daypart");
    expect(body.message).toContain("เหตุการณ์");
  });

  test("daypart จริง → question (มีตัวเลือกข้าม) หรือ result ที่ shortlist ≤4 — เดินจนจบได้", async () => {
    const POST = createHandler();
    let answers: { questionId: string; optionId: string }[] = [];
    // เดิน stateless loop สูงสุด 5 รอบ (คำถามมีได้ไม่เกิน 3 มิติ) — ตอบตัวเลือกแรกเสมอ
    for (let i = 0; i < 5; i++) {
      const response = await POST(
        createRequest({ ...VALID_BIRTH, daypart: "morning", answers }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        status: string;
        questionId?: string;
        options?: { id: string; label: string }[];
        shortlist?: { hourBranch: string; score: number }[];
        totalQuestions?: number;
        daypartOnly?: boolean;
      };
      if (body.status === "question") {
        expect(body.options!.length).toBeGreaterThanOrEqual(2);
        // ตัวเลือกข้ามต้องมีเสมอ (อาจารย์: บางคนไม่มีลูกน้อง/ลูก ตอบไม่ได้)
        expect(body.options!.at(-1)!.id).toBe("skip");
        answers = [...answers, { questionId: body.questionId!, optionId: body.options![0].id }];
        continue;
      }
      expect(body.status).toBe("result");
      expect(body.shortlist!.length).toBeLessThanOrEqual(4);
      expect(body.shortlist!.length).toBeGreaterThanOrEqual(1);
      // ทุกยามใน shortlist ต้องอยู่ในช่วงเช้า (卯辰巳)
      for (const s of body.shortlist!) {
        expect(["卯", "辰", "巳"]).toContain(s.hourBranch);
      }
      return;
    }
    throw new Error("ไม่จบใน 5 step — คำถามเกินจำนวนมิติที่มีจริง");
  });
});
