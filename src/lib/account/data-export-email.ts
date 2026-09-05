// src/lib/account/data-export-email.ts — ส่งไฟล์ข้อมูลส่วนตัว (JSON+CSV) ทางอีเมล (PDPA data-export)
// ใช้ Resend REST API ผ่าน fetch (ไม่ผูก dependency) — ทำงานเมื่อมี env RESEND_API_KEY (+ RESEND_FROM).
// ยังไม่ตั้งค่า provider = คืน { sent:false, reason } (ไม่โยน error, ไม่อ้างว่าส่งแล้ว) → คำขอคง status=collecting.

type Bundle = Record<string, unknown> & { anonId?: string; ledger?: Array<Record<string, unknown>> };

/** แปลง ledger (ธุรกรรม QI) เป็น CSV — ส่วนที่เป็นตารางชัดที่สุดของ export */
export function ledgerToCsv(ledger: Array<Record<string, unknown>> | undefined): string {
  const rows = ledger ?? [];
  const cols = ["createdAt", "reason", "qiDelta", "coinDelta", "xpDelta"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

/**
 * ส่งไฟล์ export ทางอีเมล. คืน { sent:false } อย่างเงียบ ๆ ถ้ายังไม่ตั้ง provider (RESEND_API_KEY) หรือไม่มีอีเมล
 * — ผู้เรียกจะคงสถานะคำขอเป็น collecting และไม่อ้างว่าส่งแล้ว.
 */
export async function sendExportEmail(params: { to: string | null; data: Bundle }): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim() || "Mumate <onboarding@resend.dev>";
  if (!apiKey) return { sent: false, reason: "no_provider" };
  if (!params.to) return { sent: false, reason: "no_email" };

  const stamp = new Date().toISOString().slice(0, 10);
  const jsonB64 = Buffer.from(JSON.stringify(params.data, null, 2), "utf8").toString("base64");
  const csvB64 = Buffer.from(ledgerToCsv(params.data.ledger), "utf8").toString("base64");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: "ไฟล์ข้อมูลส่วนตัวของคุณ · Mumate",
        html: [
          "<p>สวัสดีค่ะ</p>",
          "<p>แนบไฟล์ข้อมูลทั้งหมดที่ Mumate เก็บของบัญชีคุณมาให้แล้ว — ทั้งแบบ JSON (ครบทุกส่วน) และ CSV (ประวัติธุรกรรม QI)</p>",
          "<p>ถ้าคุณไม่ได้เป็นผู้ขอไฟล์นี้ กรุณาติดต่อทีมงานทาง LINE @mumate.co</p>",
        ].join(""),
        attachments: [
          { filename: `mumate-data-export-${stamp}.json`, content: jsonB64 },
          { filename: `mumate-qi-history-${stamp}.csv`, content: csvB64 },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { sent: false, reason: `provider_error_${res.status}${detail ? `:${detail.slice(0, 120)}` : ""}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "send_failed" };
  }
}
