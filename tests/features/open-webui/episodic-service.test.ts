import { describe, expect, test } from "vitest";

import {
  buildRollingOpenWebUiThreadState,
  normalizeOpenWebUiThreadId,
  OPEN_WEBUI_EPISODIC_RECENT_MESSAGE_LIMIT,
  OPEN_WEBUI_EPISODIC_SUMMARY_HEADER,
  sanitizeOpenWebUiPersistedTurn,
  sanitizeOpenWebUiEpisodicMessages,
} from "@/features/open-webui/episodic-service";

describe("episodic-service", () => {
  test("normalizeOpenWebUiThreadId trims usable thread ids and rejects blanks", () => {
    expect(normalizeOpenWebUiThreadId("  chat-123  ")).toBe("chat-123");
    expect(normalizeOpenWebUiThreadId("   ")).toBeNull();
    expect(normalizeOpenWebUiThreadId(null)).toBeNull();
  });

  test("sanitizeOpenWebUiEpisodicMessages keeps only valid turns and maps model to assistant", () => {
    expect(sanitizeOpenWebUiEpisodicMessages([
      { role: "user", content: "  ผู้ใช้บอกวันเกิด  " },
      { role: "model", content: "  ผู้ช่วยตอบกลับ  " },
      { role: "assistant", content: "  ตอบซ้ำได้ถ้ามีข้อมูลเดิม  " },
      { role: "system", content: "ห้ามติดมาด้วย" },
      { role: "user", content: "   " },
      null,
    ])).toEqual([
      { role: "user", content: "ผู้ใช้บอกวันเกิด" },
      { role: "assistant", content: "ผู้ช่วยตอบกลับ" },
      { role: "assistant", content: "ตอบซ้ำได้ถ้ามีข้อมูลเดิม" },
    ]);
  });

  test("sanitizeOpenWebUiPersistedTurn strips hidden assistant reasoning before persistence", () => {
    expect(sanitizeOpenWebUiPersistedTurn({
      role: "assistant",
      content: '<bazi_logic>{"trace":"internal"}</bazi_logic>\n<reply>คำตอบที่ผู้ใช้เห็นค่ะ</reply>',
    })).toEqual({
      role: "assistant",
      content: "คำตอบที่ผู้ใช้เห็นค่ะ",
    });
  });

  test("buildRollingOpenWebUiThreadState writes summary from visible transcript and keeps bounded recent turns", () => {
    const nextState = buildRollingOpenWebUiThreadState({
      previousSummary: null,
      existingMessages: [
        { role: "user", content: "เกิด 12 ส.ค. 1992 กรุงเทพ" },
        { role: "assistant", content: "รับข้อมูลพื้นฐานไว้แล้วค่ะ" },
        { role: "user", content: "อยากดูเรื่องงาน" },
        { role: "assistant", content: "ได้ค่ะ จะโฟกัสเรื่องงานให้" },
        { role: "user", content: "ตอนนี้รู้สึกตัน" },
        { role: "assistant", content: "เห็นภาพแล้วค่ะ" },
      ],
      appendedMessages: [
        { role: "user", content: "แล้วควรขยับยังไงต่อ" },
        { role: "assistant", content: "ค่อย ๆ ขยับจากงานที่ใช้ทักษะเดิมก่อนค่ะ" },
      ],
    });

    expect(nextState.contextSummary).toContain(OPEN_WEBUI_EPISODIC_SUMMARY_HEADER);
    expect(nextState.contextSummary).toContain("- User: เกิด 12 ส.ค. 1992 กรุงเทพ");
    expect(nextState.contextSummary).toContain("- Assistant: รับข้อมูลพื้นฐานไว้แล้วค่ะ");
    expect(nextState.contextSummary).not.toContain("internal");
    expect(nextState.messages).toHaveLength(OPEN_WEBUI_EPISODIC_RECENT_MESSAGE_LIMIT);
    expect(nextState.messages.at(0)).toEqual({ role: "user", content: "อยากดูเรื่องงาน" });
    expect(nextState.messages.at(-1)).toEqual({
      role: "assistant",
      content: "ค่อย ๆ ขยับจากงานที่ใช้ทักษะเดิมก่อนค่ะ",
    });
  });
});