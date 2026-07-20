// Hour Rectification — POST /api/bazi/rectify-hour/combined (#hour-rectification-engine, unified
// lane, end-to-end). flow เดียวถามต่อเนื่อง: daypart จำกัด candidate → เหตุการณ์ให้คะแนนกฎ v2 →
// คำถามจากคำทำนาย v3 → รวมคะแนน. ฉีด loadMap ปลอม (ไม่แตะ DB) — engine คำนวณดวงจริง
import { describe, expect, test, vi } from "vitest";

import { createRectifyHourCombinedHandler } from "@/app/api/bazi/rectify-hour/combined/route";
import {
  combineHourScores,
  shortlistCombined,
} from "@/lib/bazi/hour-rectification/run-combined";
import type { HourBranch } from "@/lib/bazi/hour-rectification/domain/types";

vi.mock("@/db/client", () => ({
  createDbClient: vi.fn(() => {
    throw new Error("rectify-hour combined test must not construct a DB client");
  }),
  createDbSqlClient: vi.fn(() => {
    throw new Error("rectify-hour combined test must not construct a DB sql client");
  }),
}));

const VALID_BIRTH = {
  birthDate: "1989-01-03",
  gender: "male",
  province: "กรุงเทพมหานคร",
} as const;

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
  return createRectifyHourCombinedHandler({ loadMap: async () => FAKE_MAP as never });
}

function createRequest(body: unknown) {
  return new Request("http://localhost/api/bazi/rectify-hour/combined", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("combineHourScores / shortlistCombined — pure", () => {
  test("รวมคะแนน reading+events ต่อยาม เรียงมาก→น้อย พร้อม breakdown", () => {
    const candidates: HourBranch[] = ["卯", "辰", "巳"];
    const ranked = combineHourScores(
      candidates,
      new Map([["辰", 5], ["卯", 2]] as [HourBranch, number][]),
      new Map([["辰", 3], ["巳", 4]] as [HourBranch, number][]),
    );
    expect(ranked[0]).toMatchObject({ hourBranch: "辰", total: 8, readingScore: 5, eventsScore: 3 });
    expect(ranked[1]).toMatchObject({ hourBranch: "巳", total: 4 });
    expect(ranked[2]).toMatchObject({ hourBranch: "卯", total: 2 });
    expect(shortlistCombined(ranked)).toHaveLength(3);
  });
});

describe("POST /api/bazi/rectify-hour/combined", () => {
  test("daypart หาย → 400 (required)", async () => {
    const POST = createHandler();
    const response = await POST(createRequest({ ...VALID_BIRTH, events: [], answers: [] }));
    expect(response.status).toBe(400);
  });

  test('daypart "unknown" + ไม่มีเหตุการณ์ → need_more_signal (gate)', async () => {
    const POST = createHandler();
    const response = await POST(
      createRequest({ ...VALID_BIRTH, daypart: "unknown", events: [], answers: [] }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; message: string };
    expect(body.status).toBe("need_more_signal");
    expect(body.message).toContain("เหตุการณ์");
  });

  test('daypart "unknown" + เหตุการณ์ ≥2 → ไปต่อได้ (question หรือ result บน 12 ยาม)', async () => {
    const POST = createHandler();
    const response = await POST(
      createRequest({
        ...VALID_BIRTH,
        daypart: "unknown",
        events: [
          { type: "marriage", year: 2012 },
          { type: "childbirth", year: 2022 },
        ],
        answers: [],
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(["question", "result"]).toContain(body.status);
  });

  test("รู้ daypart + มีเหตุการณ์ → เดินจนจบ, shortlist มี breakdown คำทำนาย+เหตุการณ์, ยามอยู่ในช่วงเช้า", async () => {
    const POST = createHandler();
    const events = [
      { type: "marriage", year: 2012 },
      { type: "childbirth", year: 2022 },
    ];
    let answers: { questionId: string; optionId: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const response = await POST(
        createRequest({ ...VALID_BIRTH, daypart: "morning", events, answers }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        status: string;
        questionId?: string;
        options?: { id: string }[];
        shortlist?: {
          hourBranch: string;
          total: number;
          readingScore: number;
          eventsScore: number;
        }[];
        daypartOnly?: boolean;
      };
      if (body.status === "question") {
        expect(body.options!.at(-1)!.id).toBe("skip");
        answers = [...answers, { questionId: body.questionId!, optionId: body.options![0].id }];
        continue;
      }
      expect(body.status).toBe("result");
      expect(body.daypartOnly).toBe(false);
      expect(body.shortlist!.length).toBeLessThanOrEqual(4);
      for (const s of body.shortlist!) {
        expect(["卯", "辰", "巳"]).toContain(s.hourBranch);
        expect(s.total).toBe(s.readingScore + s.eventsScore);
      }
      return;
    }
    throw new Error("ไม่จบใน 5 step");
  });

  test("ข้ามทุกคำถาม + ไม่มีเหตุการณ์ → daypartOnly result (ซื่อสัตย์ ไม่มโนยาม)", async () => {
    const POST = createHandler();
    let answers: { questionId: string; optionId: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const response = await POST(
        createRequest({ ...VALID_BIRTH, daypart: "morning", events: [], answers }),
      );
      const body = (await response.json()) as {
        status: string;
        questionId?: string;
        options?: { id: string }[];
        daypartOnly?: boolean;
        timeEstimate?: unknown;
      };
      if (body.status === "question") {
        answers = [...answers, { questionId: body.questionId!, optionId: "skip" }];
        continue;
      }
      expect(body.status).toBe("result");
      expect(body.daypartOnly).toBe(true);
      expect(body.timeEstimate).toBeNull();
      return;
    }
    throw new Error("ไม่จบใน 5 step");
  });
});
