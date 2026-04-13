"use client";

import { useEffect, useRef, useState } from "react";

export type SpeechRecognitionErrorCode =
  | "aborted"
  | "audio-capture"
  | "bad-grammar"
  | "language-not-supported"
  | "network"
  | "no-speech"
  | "not-allowed"
  | "phrases-not-supported"
  | "service-not-allowed"
  | string;

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  [index: number]: SpeechRecognitionResultLike;
  length: number;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = {
  error: SpeechRecognitionErrorCode;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

export type SpeechRecognitionWindowLike = {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
};

type UseWebSpeechOptions = {
  lang?: string;
  onTranscript?: (transcript: string) => void;
  onSessionEnd?: () => void;
};

export function resolveSpeechRecognitionConstructor(
  windowLike?: SpeechRecognitionWindowLike | null,
) {
  if (!windowLike) {
    return null;
  }

  return windowLike.SpeechRecognition ?? windowLike.webkitSpeechRecognition ?? null;
}

export function appendSpeechTranscript(currentValue: string, transcript: string) {
  const nextTranscript = transcript.trim();

  if (nextTranscript.length === 0) {
    return currentValue;
  }

  const hasTrailingNewline = /\n\s*$/u.test(currentValue);
  const baseValue = hasTrailingNewline
    ? currentValue.replace(/[ \t]+$/u, "")
    : currentValue.trimEnd();

  if (baseValue.length === 0) {
    return nextTranscript;
  }

  if (hasTrailingNewline || baseValue.endsWith("\n")) {
    return `${baseValue}${nextTranscript}`;
  }

  return `${baseValue} ${nextTranscript}`;
}

export function formatSpeechRecognitionError(errorCode: SpeechRecognitionErrorCode) {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    return "ต้องอนุญาตไมโครโฟนก่อน ระบบจึงจะรับเสียงได้";
  }

  if (errorCode === "audio-capture") {
    return "ยังไม่พบไมโครโฟนที่พร้อมใช้งานในอุปกรณ์นี้";
  }

  if (errorCode === "network") {
    return "การถอดเสียงสะดุดจากเครือข่าย ลองเริ่มพูดใหม่อีกครั้ง";
  }

  if (errorCode === "no-speech") {
    return "ยังไม่ได้ยินเสียงพูดที่ชัดเจน ลองพูดใหม่อีกครั้ง";
  }

  if (errorCode === "language-not-supported") {
    return "เบราว์เซอร์นี้ยังไม่รองรับภาษาที่ต้องการสำหรับ dictation";
  }

  return "ระบบรับเสียงสะดุด ลองหยุดแล้วเริ่มใหม่อีกครั้ง";
}

function collectTranscript(
  event: SpeechRecognitionEventLike,
  mode: "final" | "interim",
) {
  const chunks: string[] = [];

  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];

    if ((mode === "final" && result.isFinal) || (mode === "interim" && !result.isFinal)) {
      const transcript = result[0]?.transcript?.trim();

      if (transcript) {
        chunks.push(transcript);
      }
    }
  }

  return chunks.join(" ").trim();
}

export function useWebSpeech({
  lang = "th-TH",
  onTranscript,
  onSessionEnd,
}: UseWebSpeechOptions = {}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptHandlerRef = useRef(onTranscript);
  const endHandlerRef = useRef(onSessionEnd);
  const [isSupported] = useState(() =>
    typeof window !== "undefined"
      ? Boolean(
          resolveSpeechRecognitionConstructor(window as SpeechRecognitionWindowLike),
        )
      : false,
  );
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    transcriptHandlerRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    endHandlerRef.current = onSessionEnd;
  }, [onSessionEnd]);

  useEffect(() => {
    const SpeechRecognitionConstructor = resolveSpeechRecognitionConstructor(
      window as SpeechRecognitionWindowLike,
    );

    if (!SpeechRecognitionConstructor) {
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsListening(true);
      setErrorMessage(null);
      setInterimTranscript("");
    };
    recognition.onresult = (event) => {
      const finalTranscript = collectTranscript(event, "final");
      const nextInterimTranscript = collectTranscript(event, "interim");

      setInterimTranscript(nextInterimTranscript);

      if (finalTranscript.length > 0) {
        transcriptHandlerRef.current?.(finalTranscript);
      }
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setInterimTranscript("");
      setErrorMessage(formatSpeechRecognitionError(event.error));
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
      endHandlerRef.current?.();
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;

      try {
        recognition.abort();
      } catch {
        // ignore cleanup failures from inactive sessions
      }

      recognitionRef.current = null;
    };
  }, [lang]);

  function startListening() {
    if (!recognitionRef.current) {
      setErrorMessage("เบราว์เซอร์นี้ยังไม่รองรับการพิมพ์ด้วยเสียง");
      return false;
    }

    try {
      setErrorMessage(null);
      setInterimTranscript("");
      recognitionRef.current.start();
      return true;
    } catch {
      setErrorMessage("ยังเริ่มการฟังไม่ได้ ลองหยุดสักครู่แล้วเริ่มใหม่อีกครั้ง");
      return false;
    }
  }

  function stopListening() {
    if (!recognitionRef.current) {
      return;
    }

    try {
      recognitionRef.current.stop();
    } catch {
      setIsListening(false);
    }
  }

  return {
    isSupported,
    isListening,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
  };
}