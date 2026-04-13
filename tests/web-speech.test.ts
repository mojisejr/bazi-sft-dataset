import { describe, expect, test } from "vitest";

import {
  appendSpeechTranscript,
  formatSpeechRecognitionError,
  resolveSpeechRecognitionConstructor,
} from "@/hooks/bazi/useWebSpeech";

describe("useWebSpeech helpers", () => {
  test("resolves the standard speech recognition constructor before the prefixed one", () => {
    class StandardRecognition {}
    class PrefixedRecognition {}

    expect(
      resolveSpeechRecognitionConstructor({
        SpeechRecognition: StandardRecognition as never,
        webkitSpeechRecognition: PrefixedRecognition as never,
      }),
    ).toBe(StandardRecognition);
    expect(
      resolveSpeechRecognitionConstructor({
        webkitSpeechRecognition: PrefixedRecognition as never,
      }),
    ).toBe(PrefixedRecognition);
    expect(resolveSpeechRecognitionConstructor(null)).toBeNull();
  });

  test("appends dictated transcript without destroying existing reasoning", () => {
    expect(appendSpeechTranscript("", "ดวงนี้ดิถีแข็ง")).toBe("ดวงนี้ดิถีแข็ง");
    expect(
      appendSpeechTranscript("ดวงนี้มีแรงผลักสูง", "ควรอ่านเรื่องงานก่อน"),
    ).toBe("ดวงนี้มีแรงผลักสูง ควรอ่านเรื่องงานก่อน");
    expect(appendSpeechTranscript("บรรทัดแรก\n", "บรรทัดถัดไป")).toBe(
      "บรรทัดแรก\nบรรทัดถัดไป",
    );
  });

  test("maps speech recognition errors to operator-friendly Thai copy", () => {
    expect(formatSpeechRecognitionError("not-allowed")).toBe(
      "ต้องอนุญาตไมโครโฟนก่อน ระบบจึงจะรับเสียงได้",
    );
    expect(formatSpeechRecognitionError("network")).toBe(
      "การถอดเสียงสะดุดจากเครือข่าย ลองเริ่มพูดใหม่อีกครั้ง",
    );
    expect(formatSpeechRecognitionError("no-speech")).toBe(
      "ยังไม่ได้ยินเสียงพูดที่ชัดเจน ลองพูดใหม่อีกครั้ง",
    );
  });
});