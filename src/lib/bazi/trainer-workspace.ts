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

export const THAI_MONTH_OPTIONS = [
  { value: "1", label: "มกราคม" },
  { value: "2", label: "กุมภาพันธ์" },
  { value: "3", label: "มีนาคม" },
  { value: "4", label: "เมษายน" },
  { value: "5", label: "พฤษภาคม" },
  { value: "6", label: "มิถุนายน" },
  { value: "7", label: "กรกฎาคม" },
  { value: "8", label: "สิงหาคม" },
  { value: "9", label: "กันยายน" },
  { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" },
  { value: "12", label: "ธันวาคม" },
] as const;

export const BUDDHIST_ERA_YEAR_MIN = 2450;
export const BUDDHIST_ERA_YEAR_MAX = 2570;

export const BUDDHIST_ERA_YEAR_OPTIONS = Array.from(
  { length: BUDDHIST_ERA_YEAR_MAX - BUDDHIST_ERA_YEAR_MIN + 1 },
  (_, index) => String(BUDDHIST_ERA_YEAR_MAX - index),
);

export type FormState = {
  birthDay: string;
  birthMonth: string;
  birthYearBe: string;
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
    birthDay: "",
    birthMonth: "",
    birthYearBe: "",
    birthTime: "",
    gender: "female",
    province: "",
    calendarSystem: "solar",
    timezone: "Asia/Bangkok",
  };
}

function parseNumericFormValue(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  return Number.parseInt(value, 10);
}

function isLeapYear(year: number) {
  if (year % 400 === 0) {
    return true;
  }

  if (year % 100 === 0) {
    return false;
  }

  return year % 4 === 0;
}

function getDaysInMonth(year: number, month: number) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }

  return 31;
}

export function getGregorianYearFromBuddhistEra(yearBe: string) {
  const parsedYear = parseNumericFormValue(yearBe);

  if (parsedYear === null) {
    return null;
  }

  return parsedYear - 543;
}

export function getBirthDayOptions(month: string, yearBe: string) {
  const parsedMonth = parseNumericFormValue(month);
  const gregorianYear = getGregorianYearFromBuddhistEra(yearBe);
  const totalDays =
    parsedMonth && gregorianYear
      ? getDaysInMonth(gregorianYear, parsedMonth)
      : 31;

  return Array.from({ length: totalDays }, (_, index) => String(index + 1));
}

export function applyFormFieldChange(
  current: FormState,
  name: string,
  value: string,
): FormState {
  const next = {
    ...current,
    [name]: value,
  };

  if (name !== "birthMonth" && name !== "birthYearBe") {
    return next;
  }

  const maxValidDay = getBirthDayOptions(next.birthMonth, next.birthYearBe).length;
  const selectedDay = parseNumericFormValue(next.birthDay);

  if (selectedDay !== null && selectedDay > maxValidDay) {
    next.birthDay = "";
  }

  return next;
}

export function buildBirthDateValue(formState: FormState) {
  const day = parseNumericFormValue(formState.birthDay);
  const month = parseNumericFormValue(formState.birthMonth);
  const gregorianYear = getGregorianYearFromBuddhistEra(formState.birthYearBe);

  if (day === null || month === null || gregorianYear === null) {
    return "";
  }

  if (month < 1 || month > 12) {
    return "";
  }

  const maxValidDay = getDaysInMonth(gregorianYear, month);

  if (day < 1 || day > maxValidDay) {
    return "";
  }

  return `${String(gregorianYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
    birthDate: buildBirthDateValue(formState),
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