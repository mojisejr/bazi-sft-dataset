import { z, ZodError } from "zod";

export const runtime = "nodejs";

/**
 * /api/ops/auth/login — เข้าหลังบ้านด้วย "บัญชีของตัวเอง" (username/password) แทนการจำ secret ดิบ.
 * บัญชีตั้งใน env OPS_ADMINS = JSON array เช่น [{"u":"phuwasit","p":"...","name":"ภูวสิษฏ์"}]
 * ตรวจ username/password → คืน { ok, name, secret } โดย secret = OPS_ADMIN_SECRET (คีย์ที่ endpoint
 * /ops/* ใช้ตรวจ) เพื่อให้หน้าเว็บยิงต่อได้ — ชั้น login นี้คุมว่า "ใครเข้าได้" ต่อบัญชี.
 * fail-closed: ไม่ตั้ง OPS_ADMIN_SECRET หรือ OPS_ADMINS → เข้าไม่ได้.
 */
type AdminAccount = { u: string; p: string; name?: string };

function loadAdmins(): AdminAccount[] {
  const raw = process.env.OPS_ADMINS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a) => a && typeof a.u === "string" && typeof a.p === "string");
  } catch {
    return [];
  }
}

const Schema = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "กรอกข้อมูลไม่ครบ" }, { status: 400 });
    return Response.json({ error: "payload ไม่ถูกต้อง" }, { status: 400 });
  }

  const secret = process.env.OPS_ADMIN_SECRET;
  if (!secret) return Response.json({ error: "ระบบยังไม่พร้อม (ไม่ได้ตั้ง OPS_ADMIN_SECRET)" }, { status: 503 });

  const admins = loadAdmins();
  const match = admins.find((a) => a.u.toLowerCase() === body.username.toLowerCase() && a.p === body.password);
  if (!match) return Response.json({ error: "username หรือ password ไม่ถูกต้อง" }, { status: 401 });

  return Response.json({ ok: true, name: match.name ?? match.u, secret }, { status: 200 });
}
