"use client";

/**
 * Text-to-Speech สำหรับแชทโค้ชฮีลใจ — รองรับ 2 แหล่ง:
 *  - "browser": Web Speech API (speechSynthesis) ฟรี ไม่ต้องมี key คุณภาพขึ้นกับ OS ผู้ใช้
 *  - "server" : เสียง Gemini TTS คุณภาพสูง ผ่าน route /api/louise-hay/tts (ใช้ GEMINI_API_KEY เดิม)
 *  - "auto"   : ใช้ server ถ้าเปิดใช้ได้ ไม่งั้น fallback browser
 *
 * interface speak()/cancel()/isSpeaking คงเดิม → อวตารใช้สถานะ isSpeaking ขับปากได้เหมือนกัน.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type VoiceGender = "auto" | "male" | "female";
export type VoiceSource = "auto" | "server" | "browser";
export type ServerVoice = { id: string; label: string; gender: "male" | "female" };

// คำใบ้ในชื่อ voice เพื่อเดาเพศเสียงเบราว์เซอร์ (best-effort — Web Speech ไม่บอกเพศตรง ๆ)
const MALE_HINTS = /pattara|male|ชาย|david|mark|george|liam|niwat/i;
const FEMALE_HINTS = /female|หญิง|kanya|premwadee|achara|zira|google ไทย|google thai|aria/i;

type UseTextToSpeechOptions = {
  lang?: string;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
};

function isVoiceGender(voice: SpeechSynthesisVoice, gender: VoiceGender): boolean {
  if (gender === "male") return MALE_HINTS.test(voice.name);
  if (gender === "female") return FEMALE_HINTS.test(voice.name);
  return true;
}

export function useTextToSpeech({
  lang = "th-TH",
  onSpeakStart,
  onSpeakEnd,
}: UseTextToSpeechOptions = {}) {
  const startRef = useRef(onSpeakStart);
  const endRef = useRef(onSpeakEnd);
  useEffect(() => {
    startRef.current = onSpeakStart;
  }, [onSpeakStart]);
  useEffect(() => {
    endRef.current = onSpeakEnd;
  }, [onSpeakEnd]);

  const [browserSupported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  );
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [serverVoices, setServerVoices] = useState<ServerVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // โหลดรายชื่อเสียงเบราว์เซอร์ (มาแบบ async ผ่าน voiceschanged)
  useEffect(() => {
    if (!browserSupported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [browserSupported]);

  // ถาม config เสียงเซิร์ฟเวอร์ (Azure เปิดใช้ได้ไหม + มีเสียงอะไร) — ขับปุ่มแหล่งเสียง/เลือกเสียง
  useEffect(() => {
    let alive = true;
    fetch("/api/louise-hay/tts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { available?: boolean; voices?: ServerVoice[] } | null) => {
        if (!alive || !data) return;
        setServerAvailable(Boolean(data.available));
        setServerVoices(data.voices ?? []);
      })
      .catch(() => {
        /* เงียบ — ถือว่าเสียงเซิร์ฟเวอร์ไม่พร้อม ใช้ browser แทน */
      });
    return () => {
      alive = false;
    };
  }, []);

  const thaiVoices = useMemo(
    () => voices.filter((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())),
    [voices, lang],
  );

  const pickBrowserVoice = useCallback(
    (gender: VoiceGender, voiceName?: string): SpeechSynthesisVoice | null => {
      if (voiceName) {
        const exact = voices.find((v) => v.name === voiceName);
        if (exact) return exact;
      }
      const pool = thaiVoices.length > 0 ? thaiVoices : voices;
      if (gender !== "auto") {
        const byGender = pool.find((v) => isVoiceGender(v, gender));
        if (byGender) return byGender;
      }
      return pool[0] ?? null;
    },
    [voices, thaiVoices],
  );

  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.onerror = null;
      a.pause();
      if (a.src) URL.revokeObjectURL(a.src);
      audioRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (browserSupported) window.speechSynthesis.cancel();
    stopAudio();
    setIsSpeaking(false);
  }, [browserSupported, stopAudio]);

  const speakBrowser = useCallback(
    (text: string, gender: VoiceGender, voiceName: string | undefined, rate: number, pitch: number) => {
      if (!browserSupported) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = rate;
      utter.pitch = pitch;
      const voice = pickBrowserVoice(gender, voiceName);
      if (voice) utter.voice = voice;
      utter.onstart = () => {
        setIsSpeaking(true);
        startRef.current?.();
      };
      const done = () => {
        setIsSpeaking(false);
        endRef.current?.();
      };
      utter.onend = done;
      utter.onerror = done;
      window.speechSynthesis.speak(utter);
    },
    [browserSupported, lang, pickBrowserVoice],
  );

  const speakServer = useCallback(
    async (text: string, serverVoice: string | undefined): Promise<boolean> => {
      try {
        const res = await fetch("/api/louise-hay/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, ...(serverVoice ? { voice: serverVoice } : {}) }),
        });
        if (!res.ok) return false;
        const blob = await res.blob();
        stopAudio();
        const audio = new Audio(URL.createObjectURL(blob));
        audioRef.current = audio;
        audio.onended = () => {
          stopAudio();
          setIsSpeaking(false);
          endRef.current?.();
        };
        audio.onerror = () => {
          stopAudio();
          setIsSpeaking(false);
          endRef.current?.();
        };
        setIsSpeaking(true);
        startRef.current?.();
        await audio.play();
        return true;
      } catch {
        return false;
      }
    },
    [stopAudio],
  );

  const speak = useCallback(
    (
      text: string,
      opts: {
        source?: VoiceSource;
        gender?: VoiceGender;
        voiceName?: string;
        serverVoice?: string;
        rate?: number;
        pitch?: number;
      } = {},
    ) => {
      const clean = text.trim();
      if (!clean) return;
      const source = opts.source ?? "auto";
      const useServer = (source === "server" || source === "auto") && serverAvailable;

      if (useServer) {
        void speakServer(clean, opts.serverVoice).then((ok) => {
          // auto: ถ้าเซิร์ฟเวอร์ล้มเหลว ค่อย fallback เบราว์เซอร์
          if (!ok && source !== "server") {
            speakBrowser(clean, opts.gender ?? "auto", opts.voiceName, opts.rate ?? 1, opts.pitch ?? 1);
          } else if (!ok) {
            setIsSpeaking(false);
          }
        });
        return;
      }
      speakBrowser(clean, opts.gender ?? "auto", opts.voiceName, opts.rate ?? 1, opts.pitch ?? 1);
    },
    [serverAvailable, speakServer, speakBrowser],
  );

  return {
    /** พูดได้ไหม (มีอย่างน้อยหนึ่งแหล่ง) */
    isSupported: browserSupported || serverAvailable,
    browserSupported,
    serverAvailable,
    serverVoices,
    isSpeaking,
    thaiVoices,
    speak,
    cancel,
  };
}
