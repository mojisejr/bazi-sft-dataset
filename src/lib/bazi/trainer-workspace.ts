import type {
  AnnotationProgressState,
} from "@/lib/bazi/annotation-store";
import type { SaveDatasetStatus } from "@/lib/bazi/dataset-request";
import type {
  CalculatedStateValue,
  RawInputValue,
} from "@/lib/bazi/schema-types";

export const pillarColumns = [
  { key: "year", label: "ปี" },
  { key: "month", label: "เดือน" },
  { key: "day", label: "วัน" },
  { key: "hour", label: "เวลา" },
] as const;

export const tenGodRows = [
  { key: "yearStem", label: "ก้านปี" },
  { key: "monthStem", label: "ก้านเดือน" },
  { key: "dayStem", label: "ก้านวัน" },
  { key: "hourStem", label: "ก้านเวลา" },
  { key: "yearBranch", label: "กิ่งปี" },
  { key: "monthBranch", label: "กิ่งเดือน" },
  { key: "dayBranch", label: "กิ่งวัน" },
  { key: "hourBranch", label: "กิ่งเวลา" },
] as const;

export const twelveQiRows = [
  { key: "yearBranch", label: "ปี" },
  { key: "monthBranch", label: "เดือน" },
  { key: "dayBranch", label: "วัน" },
  { key: "hourBranch", label: "เวลา" },
] as const;

export const workflowSteps = [
  "ตั้งข้อมูลเกิดให้ครบถ้วน",
  "กดคำนวณเพื่อดึงภาพรวมดวงจีน",
  "อ่านผล 4 เสาและภาพรวมก่อนเข้าสู่การวิเคราะห์เชิงลึก",
] as const;

export type FormState = {
  birthDate: string;
  birthTime: string;
  gender: string;
  province: string;
  calendarSystem: "solar" | "lunar";
  timezone: string;
};

export type SubmissionState = "idle" | "submitting" | "ready" | "error";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type BaziTrainerWorkspaceProps = {
  initialFormState?: FormState;
  initialSubmittedInput?: RawInputValue | null;
  initialCalculatedState?: CalculatedStateValue | null;
  initialSubmissionState?: SubmissionState;
};

export type StatusCopy = {
  tone: "busy" | "error" | "ready" | "idle";
  label: string;
  detail: string;
};

export type ResetActionCopy = {
  label: string;
  detail: string;
  tone: "primary" | "secondary";
};

export function createDefaultFormState(): FormState {
  return {
    birthDate: "",
    birthTime: "",
    gender: "female",
    province: "",
    calendarSystem: "solar",
    timezone: "Asia/Bangkok",
  };
}

export function getStatusCopy(
  status: SubmissionState,
  hasResult: boolean,
): StatusCopy {
  if (status === "submitting") {
    return {
      tone: "busy",
      label: "กำลังคำนวณ",
      detail: "ระบบกำลังจัดโครงสร้างดวงและภาพรวมหลักให้คุณ",
    };
  }

  if (status === "error") {
    return {
      tone: "error",
      label: "ต้องลองอีกครั้ง",
      detail: "ยังปิดผลครั้งนี้ไม่สำเร็จ ตรวจข้อมูลตั้งต้นอีกครั้งแล้วคำนวณใหม่ได้ทันที",
    };
  }

  if (status === "ready" && hasResult) {
    return {
      tone: "ready",
      label: "ภาพรวมพร้อมอ่าน",
      detail: "ผลผูกดวงถูกเติมลงฝั่งซ้ายแล้ว สามารถไล่อ่านตามลำดับได้ทันที",
    };
  }

  return {
    tone: "idle",
    label: "พร้อมเริ่มงาน",
    detail: "ตั้งข้อมูลเกิดแล้วคำนวณเพื่อเปิด workspace ฝั่งภาพรวมดวงจีน",
  };
}

export function formatScore(score: number) {
  return score.toFixed(2);
}

export function formatBirthMoment(rawInput: RawInputValue | null) {
  if (!rawInput) {
    return "รอข้อมูลตั้งต้น";
  }

  return `${rawInput.birthDate} • ${rawInput.birthTime}`;
}

export function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "ยังไม่สามารถคำนวณดวงได้ในตอนนี้";
}

export function buildPayload(formState: FormState): RawInputValue {
  return {
    birthDate: formState.birthDate,
    birthTime: formState.birthTime,
    gender: formState.gender,
    province: formState.province,
    calendarSystem: formState.calendarSystem,
    timezone: formState.timezone,
  };
}

export function getProgressTone(progress: AnnotationProgressState) {
  if (progress === "complete") {
    return "complete";
  }

  if (progress === "draft") {
    return "draft";
  }

  return "not-started";
}

export function getProgressCopy(progress: AnnotationProgressState) {
  if (progress === "complete") {
    return "สมบูรณ์";
  }

  if (progress === "draft") {
    return "กำลังเขียน";
  }

  return "ยังไม่เริ่ม";
}

export function formatSaveTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return "ยังไม่มีการบันทึก";
  }

  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

export function shouldConfirmSessionReset(
  datasetRecordId: string | null,
  datasetStatus: SaveDatasetStatus | null,
) {
  return Boolean(datasetRecordId && datasetStatus !== "reviewed");
}

export function getResetActionCopy(
  datasetStatus: SaveDatasetStatus | null,
): ResetActionCopy {
  if (datasetStatus === "reviewed") {
    return {
      label: "ผูกดวงใหม่",
      detail: "annotation ชุดนี้ถูกปิดแล้ว หากต้องการอ่านดวงใหม่ให้เริ่มรอบใหม่จากปุ่มนี้",
      tone: "primary",
    };
  }

  return {
    label: "ล้างข้อมูลเพื่อผูกดวงใหม่",
    detail: "หากต้องการคำนวณดวงใหม่ ต้องรีเซ็ต session นี้ก่อน เพื่อกันข้อมูลปนกันระหว่าง record",
    tone: "secondary",
  };
}