"use client";
/**
 * ตัวช่วย LIFF ฝั่ง client (โหลด SDK แบบ dynamic เพื่อไม่กระทบ SSR).
 * ใช้ init ครั้งเดียว แล้วดึง id_token ไว้ยืนยันตัวตนตอนตั้ง alert (server จะ verify id_token กับ LINE อีกที).
 * ต้องตั้ง env NEXT_PUBLIC_LIFF_ID — ถ้าไม่ตั้ง ถือว่าใช้ LIFF ไม่ได้ (คืน null).
 */

/** เฉพาะเมธอดของ LIFF ที่เราใช้ */
type LiffLike = {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: () => void;
  getIDToken: () => string | null;
};

let initPromise: Promise<LiffLike | null> | null = null;

async function loadLiff(): Promise<LiffLike | null> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) return null;
  try {
    const liff = (await import("@line/liff")).default as unknown as LiffLike;
    await liff.init({ liffId });
    return liff;
  } catch (error) {
    console.error("[liff] init failed:", error);
    return null;
  }
}

function ensureLiff(): Promise<LiffLike | null> {
  if (!initPromise) initPromise = loadLiff();
  return initPromise;
}

/** ใช้ LIFF ได้ไหม (มี LIFF ID + init สำเร็จ) */
export async function liffAvailable(): Promise<boolean> {
  return Boolean(await ensureLiff());
}

/**
 * ดึง id_token สำหรับยืนยันตัวตน — ถ้ายังไม่ล็อกอินจะพาไป LINE login (คืน null แล้วรอ redirect กลับมา).
 * คืน null ถ้า LIFF ใช้ไม่ได้ (ไม่ได้เปิดผ่าน LINE / ยังไม่ตั้ง LIFF ID).
 */
export async function getLiffIdToken(): Promise<string | null> {
  const liff = await ensureLiff();
  if (!liff) return null;
  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }
  return liff.getIDToken() ?? null;
}
