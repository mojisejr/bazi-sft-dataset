/**
 * ตรวจ id_token ที่ได้จาก LIFF (liff.getIDToken()) กับ LINE เพื่อดึง "LINE userId" ที่เชื่อถือได้.
 * สำคัญด้านความปลอดภัย: ห้ามเชื่อ userId ที่ client ส่งมาตรง ๆ (ปลอมได้) — ต้อง verify id_token เสมอ.
 *
 * LINE verify API: POST https://api.line.me/oauth2/v2.1/verify (id_token + client_id) → { sub = userId }.
 * server-only.
 */
import { getLineLoginChannelId } from "@/lib/env";

type LineVerifyResponse = {
  sub?: string; // = LINE userId
  aud?: string;
  exp?: number;
  error?: string;
  error_description?: string;
};

/** คืน LINE userId ถ้า token ถูกต้อง, คืน null ถ้าไม่ถูก/หมดอายุ/verify ไม่ผ่าน */
export async function verifyLiffIdToken(idToken: string): Promise<string | null> {
  let channelId: string;
  try {
    channelId = getLineLoginChannelId();
  } catch {
    console.error("[bazi-alerts] LINE_LOGIN_CHANNEL_ID not set — cannot verify LIFF id_token");
    return null;
  }

  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }).toString(),
    });
    const data = (await res.json()) as LineVerifyResponse;
    if (!res.ok || data.error || !data.sub) return null;
    if (data.aud && data.aud !== channelId) return null; // token ออกให้ channel อื่น
    return data.sub;
  } catch (error) {
    console.error("[bazi-alerts] verifyLiffIdToken failed:", error);
    return null;
  }
}
