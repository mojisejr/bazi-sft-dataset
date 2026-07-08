/**
 * ดาวน์โหลดไฟล์ .ics "เพิ่มวันเตือนลงปฏิทิน" — ช่องทางเตือนที่ไม่ผูก LINE (เฟส 1 multi-channel).
 * ไฟล์เดียวใช้ได้ทั้ง Google Calendar / Apple Calendar / Outlook / ปฏิทินในเครื่อง ทุกแพลตฟอร์ม
 * ไม่ต้อง login/OAuth — ข้อมูลในไฟล์คือสิ่งที่ผู้ใช้เห็นบนหน้าจออยู่แล้ว จึงไม่ต้องยืนยันตัวตน.
 *
 *   GET /api/alerts/ics?date=YYYY-MM-DD&kind=luck|caution|custom&label=...&message=...
 *   → text/calendar (event ทั้งวัน + VALARM เด้งเตือน 09:00 ของวันนั้น)
 */
import { z } from "zod";

export const runtime = "nodejs";

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date ต้องเป็น YYYY-MM-DD"),
  kind: z.enum(["luck", "caution", "custom"]).default("custom"),
  label: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(1000),
});

/** escape ข้อความตามสเปก iCalendar (RFC 5545): \ ; , และขึ้นบรรทัด */
function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** พับบรรทัดยาวเกิน 75 octets (RFC 5545 §3.1) — ตัดตามไบต์ UTF-8 โดยไม่ผ่ากลางตัวอักษร */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf-8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let chunk = "";
  let chunkBytes = 0;
  // บรรทัดต่อ (continuation) ขึ้นต้นด้วย space → เหลือ 74 octets ต่อบรรทัด
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf-8");
    if (chunkBytes + b > 74) {
      out.push(chunk);
      chunk = "";
      chunkBytes = 0;
    }
    chunk += ch;
    chunkBytes += b;
  }
  if (chunk) out.push(chunk);
  return out.join("\r\n ");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    date: url.searchParams.get("date") ?? "",
    kind: url.searchParams.get("kind") ?? "custom",
    label: url.searchParams.get("label") ?? "",
    message: url.searchParams.get("message") ?? "",
  });
  if (!parsed.success) {
    return Response.json(
      { error: { message: parsed.error.issues[0]?.message ?? "พารามิเตอร์ไม่ถูกต้อง" } },
      { status: 400 },
    );
  }
  const { date, kind, label, message } = parsed.data;

  const dateCompact = date.replace(/-/g, ""); // YYYYMMDD (event ทั้งวัน — ตรงวันเดียวกันทุก timezone)
  const [y, m, d] = date.split("-").map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
  const dateEnd = `${nextDay.getUTCFullYear()}${String(nextDay.getUTCMonth() + 1).padStart(2, "0")}${String(nextDay.getUTCDate()).padStart(2, "0")}`;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const emoji = kind === "luck" ? "🍀" : kind === "caution" ? "🌙" : "🔔";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mumate//Louise Hay Alerts//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:lh-alert-${date}-${kind}@mumate`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dateCompact}`,
    `DTEND;VALUE=DATE:${dateEnd}`,
    `SUMMARY:${icsEscape(`${emoji} ${label}`)}`,
    `DESCRIPTION:${icsEscape(message)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(label)}`,
    "TRIGGER:PT9H", // เด้งเตือน 09:00 ตามเวลาเครื่องผู้ใช้ (9 ชม.หลังเที่ยงคืนของวันนั้น)
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].map(foldLine);

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="alert-${date}.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
