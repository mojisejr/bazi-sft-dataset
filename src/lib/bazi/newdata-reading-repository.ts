/**
 * Repository ของ "ดวงที่บันทึกไว้" (tab อ่าน 15 บท NewData) — bazi_newdata_reading
 *
 * รองรับสถานะ "ยังไม่ได้รัน migration device_label" (expand/contract) — ตรวจว่ามีคอลัมน์
 * device_label ไหม ถ้ายังไม่มีก็ทำงานได้ปกติ (deviceLabel = null) ไม่พังทั้งหน้า.
 * พอรัน migration แล้วจะใช้ป้ายเครื่องได้เองภายใน ~15 วิ (cache probe).
 */
import { desc, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import {
  baziNewdataReading,
  type NewdataReadingEdits,
  type SelectBaziNewdataReading,
} from "@/db/schema";
import { recordNewdataReadingRevision } from "@/lib/bazi/newdata-reading-revisions";

export type NewdataReadingRow = SelectBaziNewdataReading;
type DbClient = ReturnType<typeof createDbClient>;

export type SaveNewdataReadingInput = {
  id?: string;
  clientName?: string | null;
  birthDate: string;
  birthTime: string;
  gender: string;
  province?: string | null;
  edits: NewdataReadingEdits;
  /** ป้ายเครื่องที่สร้าง/แก้ (เช่น "เครื่องซินแส") — undefined = ไม่แก้ค่าเดิม */
  deviceLabel?: string | null;
  /** สร้าง "จุดประวัติการบันทึก" (revision) ด้วยไหม — default true (กดบันทึกเอง). autosave ส่ง false กันประวัติรก */
  createRevision?: boolean;
};

export type NewdataReadingStatus = "in_progress" | "done";

export type NewdataReadingRepository = {
  list: () => Promise<
    Array<Pick<NewdataReadingRow, "id" | "clientName" | "birthDate" | "birthTime" | "gender" | "deviceLabel" | "status" | "updatedAt">>
  >;
  get: (id: string) => Promise<NewdataReadingRow | null>;
  save: (input: SaveNewdataReadingInput) => Promise<NewdataReadingRow>;
  setStatus: (id: string, status: NewdataReadingStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

/** คอลัมน์ทั้งหมด "ยกเว้น device_label" — ใช้ตอนคอลัมน์ยังไม่มีใน DB (ก่อนรัน migration) */
const BASE_COLS = {
  id: baziNewdataReading.id,
  clientName: baziNewdataReading.clientName,
  birthDate: baziNewdataReading.birthDate,
  birthTime: baziNewdataReading.birthTime,
  gender: baziNewdataReading.gender,
  province: baziNewdataReading.province,
  edits: baziNewdataReading.edits,
  createdAt: baziNewdataReading.createdAt,
  updatedAt: baziNewdataReading.updatedAt,
} as const;

// ── probe ว่ามีคอลัมน์ (cache: true = จำถาวร, false = re-probe ทุก 15 วิ) ──
// ใช้ร่วมกันหลายคอลัมน์ (device_label, status) ที่เพิ่มทีหลังผ่าน expand/contract
const colOk = new Map<string, boolean>();
const colLastProbe = new Map<string, number>();
async function hasColumn(db: DbClient, column: string): Promise<boolean> {
  if (colOk.get(column) === true) return true;
  const now = Date.now();
  if (colOk.get(column) === false && now - (colLastProbe.get(column) ?? 0) < 15_000) return false;
  colLastProbe.set(column, now);
  try {
    const res = await db.execute(
      sql`select 1 as ok from information_schema.columns where table_name = 'bazi_newdata_reading' and column_name = ${column} limit 1`,
    );
    const rows = Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
    colOk.set(column, rows.length > 0);
  } catch {
    colOk.set(column, false);
  }
  return colOk.get(column) === true;
}

const hasDeviceColumn = (db: DbClient) => hasColumn(db, "device_label");
const hasStatusColumn = (db: DbClient) => hasColumn(db, "status");

export function createDbNewdataReadingRepository(db = createDbClient()): NewdataReadingRepository {
  return {
    async list() {
      const [hasDevice, hasStatus] = await Promise.all([hasDeviceColumn(db), hasStatusColumn(db)]);
      const listBase = {
        id: baziNewdataReading.id,
        clientName: baziNewdataReading.clientName,
        birthDate: baziNewdataReading.birthDate,
        birthTime: baziNewdataReading.birthTime,
        gender: baziNewdataReading.gender,
        updatedAt: baziNewdataReading.updatedAt,
      };
      const select = {
        ...listBase,
        ...(hasDevice ? { deviceLabel: baziNewdataReading.deviceLabel } : {}),
        ...(hasStatus ? { status: baziNewdataReading.status } : {}),
      };
      const rows = await db
        .select(select)
        .from(baziNewdataReading)
        .orderBy(desc(baziNewdataReading.updatedAt))
        .limit(200);
      return rows.map((r) => ({
        deviceLabel: null as string | null,
        status: "in_progress",
        ...r,
      }));
    },

    async get(id) {
      const [hasDevice, hasStatus] = await Promise.all([hasDeviceColumn(db), hasStatusColumn(db)]);
      const select = {
        ...BASE_COLS,
        ...(hasDevice ? { deviceLabel: baziNewdataReading.deviceLabel } : {}),
        ...(hasStatus ? { status: baziNewdataReading.status } : {}),
      };
      const rows = await db.select(select).from(baziNewdataReading).where(eq(baziNewdataReading.id, id)).limit(1);
      if (!rows[0]) return null;
      return { deviceLabel: null, status: "in_progress", ...rows[0] } as NewdataReadingRow;
    },

    async save(input) {
      const hasCol = await hasDeviceColumn(db);
      let saved: Omit<NewdataReadingRow, "deviceLabel"> | undefined;

      if (hasCol) {
        // คอลัมน์มีแล้ว — ใช้ drizzle ปกติ (รวม device_label)
        const values = {
          clientName: input.clientName ?? null,
          birthDate: input.birthDate,
          birthTime: input.birthTime,
          gender: input.gender,
          province: input.province ?? null,
          // undefined = คงค่าเดิมตอน update
          ...(input.deviceLabel !== undefined ? { deviceLabel: input.deviceLabel } : {}),
          edits: input.edits,
        };
        if (input.id) {
          const rows = await db
            .update(baziNewdataReading)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(baziNewdataReading.id, input.id))
            .returning();
          saved = rows[0];
        }
        if (!saved) {
          const rows = await db.insert(baziNewdataReading).values(values).returning();
          saved = rows[0];
        }
      } else {
        // ยังไม่ได้รัน migration device_label — ใช้ raw SQL ที่ไม่แตะคอลัมน์นั้น (drizzle จะใส่อัตโนมัติ)
        const editsJson = JSON.stringify(input.edits);
        const ret = sql`returning id, client_name as "clientName", birth_date as "birthDate", birth_time as "birthTime", gender, province, edits, created_at as "createdAt", updated_at as "updatedAt"`;
        const extract = (res: unknown): Omit<NewdataReadingRow, "deviceLabel"> | undefined => {
          const rows = Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? []);
          return rows[0] as Omit<NewdataReadingRow, "deviceLabel"> | undefined;
        };
        if (input.id) {
          const res = await db.execute(sql`
            update bazi_newdata_reading set
              client_name = ${input.clientName ?? null}, birth_date = ${input.birthDate},
              birth_time = ${input.birthTime}, gender = ${input.gender},
              province = ${input.province ?? null}, edits = ${editsJson}::jsonb, updated_at = now()
            where id = ${input.id} ${ret}`);
          saved = extract(res);
        }
        if (!saved) {
          const res = await db.execute(sql`
            insert into bazi_newdata_reading (client_name, birth_date, birth_time, gender, province, edits)
            values (${input.clientName ?? null}, ${input.birthDate}, ${input.birthTime}, ${input.gender}, ${input.province ?? null}, ${editsJson}::jsonb)
            ${ret}`);
          saved = extract(res);
        }
      }
      if (!saved) throw new Error("บันทึกไม่สำเร็จ (ไม่มีแถวคืนกลับ)");

      // เก็บ "ประวัติการบันทึก" หนึ่งสแน็ปช็อตทุกครั้งที่บันทึก (insert-only, เก็บ 30 ล่าสุด/ดวง)
      // best-effort: ถ้า revision ล้มเหลวไม่ทำให้การบันทึกหลักพัง
      // autosave (createRevision === false) จะข้ามขั้นนี้ — จุดประวัติเกิดเฉพาะกดบันทึกเอง
      if (input.createRevision !== false) try {
        await recordNewdataReadingRevision({
          readingId: saved.id,
          clientName: saved.clientName,
          birthDate: saved.birthDate,
          birthTime: saved.birthTime,
          gender: saved.gender,
          province: saved.province,
          edits: saved.edits,
        });
      } catch {
        /* บันทึกประวัติไม่สำเร็จ — ข้ามได้ */
      }

      return {
        ...saved,
        status: (saved as { status?: string }).status ?? "in_progress",
        deviceLabel: (saved as { deviceLabel?: string | null }).deviceLabel ?? null,
      } as NewdataReadingRow;
    },

    async setStatus(id, status) {
      // ยังไม่ได้รัน migration status → ข้ามเงียบ ๆ (ไม่พังทั้งหน้า) พอรันแล้วปุ่มจะทำงานเอง
      if (!(await hasStatusColumn(db))) return;
      await db
        .update(baziNewdataReading)
        .set({ status, updatedAt: new Date() })
        .where(eq(baziNewdataReading.id, id));
    },

    async remove(id) {
      await db.delete(baziNewdataReading).where(eq(baziNewdataReading.id, id));
    },
  };
}
