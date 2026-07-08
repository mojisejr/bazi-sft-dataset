/** วันที่/สตรีคของฟีเจอร์ Manifestation — ทุกอย่างอิงโซน Asia/Bangkok, รูปแบบ "YYYY-MM-DD". */

const TZ = "Asia/Bangkok";

/** วันนี้ตามเวลาไทย เป็น "YYYY-MM-DD" */
export function todayBangkok(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: TZ });
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * คำนวณสตรีคจากรายการวันที่ (ไม่ต้องเรียง/ซ้ำได้):
 *  current = จำนวนวันติดกันที่จบที่ "วันนี้หรือเมื่อวาน" (ยังไม่บันทึกวันนี้ก็ไม่ตัดสตรีค)
 *  best    = ช่วงติดกันยาวสุดตลอดประวัติ
 */
export function computeStreak(dates: string[], today: string = todayBangkok()): { current: number; best: number } {
  const set = new Set(dates.filter((d) => DATE_RE.test(d)));
  if (!set.size) return { current: 0, best: 0 };

  // best: ไล่หา run ที่ยาวสุด (นับเฉพาะจุดเริ่ม run = วันก่อนหน้าไม่มี)
  let best = 0;
  for (const d of set) {
    if (set.has(addDays(d, -1))) continue;
    let len = 1;
    let cur = d;
    while (set.has(addDays(cur, 1))) {
      cur = addDays(cur, 1);
      len += 1;
    }
    if (len > best) best = len;
  }

  // current: นับถอยหลังจากวันนี้ (หรือเมื่อวาน ถ้าวันนี้ยังไม่บันทึก)
  let anchor = set.has(today) ? today : set.has(addDays(today, -1)) ? addDays(today, -1) : null;
  let current = 0;
  while (anchor && set.has(anchor)) {
    current += 1;
    anchor = addDays(anchor, -1);
  }

  return { current, best };
}
