// คลังคำถาม AI เพื่อเทรน (เอ็ม 2026-10-22): เก็บเฉพาะคนยินยอม ai_training · ตัดข้อมูลระบุตัวตน · subject ย้อนหาคนไม่ได้
import { beforeEach, describe, expect, it, vi } from "vitest";

const executed: string[] = [];
let consentRows: { accepted: boolean }[] = [];
vi.mock("@/db/client", () => ({
  createDbClient: () => ({
    execute: vi.fn(async (q: { queryChunks?: unknown[] }) => {
      const text = JSON.stringify(q?.queryChunks ?? q);
      executed.push(text);
      if (text.includes("bazi_consent")) return { rows: consentRows };
      return { rows: [] };
    }),
  }),
}));

import { logAiQuestion, purgeAiQuestions, scrubPii, subjectFor } from "@/lib/bazi/ai-question-log";

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  executed.length = 0;
  consentRows = [];
});

describe("ai-question-log", () => {
  it("scrubPii ตัดเบอร์ อีเมล เลขยาว ลิงก์ — คำถามปกติไม่แตะ", () => {
    expect(scrubPii("เบอร์ 081-234-5678 ดีไหม")).toBe("เบอร์ [เบอร์] ดีไหม");
    expect(scrubPii("ติดต่อ a.b@gmail.com")).toBe("ติดต่อ [อีเมล]");
    expect(scrubPii("บัตร 1 2345 67890 12 3")).toBe("บัตร [ตัวเลข]");
    expect(scrubPii("ดู https://x.co/abc หน่อย")).toBe("ดู [ลิงก์] หน่อย");
    expect(scrubPii("ปี 2569 การเงินจะดีไหม")).toBe("ปี 2569 การเงินจะดีไหม");
    expect(scrubPii("ก".repeat(2000)).length).toBe(1000);
  });

  it("subject คงที่ต่อคน และไม่ใช่ anon_id", () => {
    expect(subjectFor("U1")).toBe(subjectFor("U1"));
    expect(subjectFor("U1")).not.toBe(subjectFor("U2"));
    expect(subjectFor("U1")).not.toContain("U1");
  });

  it("ไม่ยินยอม/ถอนแล้ว = ไม่เก็บ · ยินยอม = เก็บคำถามที่ตัดข้อมูลแล้ว (ไม่มี anon_id)", async () => {
    logAiQuestion({ anonId: "U1", question: "งานปีนี้" });
    await flush(); await flush();
    expect(executed.some((t) => t.includes("INSERT INTO ai_question_log"))).toBe(false);

    consentRows = [{ accepted: false }];
    logAiQuestion({ anonId: "U1", question: "งานปีนี้" });
    await flush(); await flush();
    expect(executed.some((t) => t.includes("INSERT INTO ai_question_log"))).toBe(false);

    consentRows = [{ accepted: true }];
    logAiQuestion({ anonId: "U1", question: "โทร 0812345678 งานปีนี้", persona: "mu", topicId: "career" });
    await flush(); await flush();
    const ins = executed.find((t) => t.includes("INSERT INTO ai_question_log"));
    expect(ins).toBeDefined();
    expect(ins).toContain("โทร [เบอร์] งานปีนี้");
    expect(ins).not.toContain("0812345678");
    expect(ins).not.toContain('"U1"');
  });

  it("ไม่มี anonId หรือคำถามว่าง = ไม่แตะ DB", async () => {
    logAiQuestion({ anonId: null, question: "x y" });
    logAiQuestion({ anonId: "U1", question: " " });
    await flush();
    expect(executed).toHaveLength(0);
  });

  it("purge ลบตาม subject", async () => {
    await purgeAiQuestions("U1");
    expect(executed[0]).toContain("DELETE FROM ai_question_log");
    expect(executed[0]).toContain(subjectFor("U1"));
  });
});
