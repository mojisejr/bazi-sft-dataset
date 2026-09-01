"use client";

/**
 * อวตารโค้ชฮีลใจ — ตัวละครจริง (สร้างด้วย Gemini image gen) แสดงตามสถานะ:
 *  - idle / listening : ยิ้มปิดปาก (listening มีวงพัลส์)
 *  - speaking : สลับ 2 เฟรม (ปิด/อ้าปาก) ให้เหมือนขยับปากพูด
 *  - concern : สีหน้าห่วงใย ตอนเจอเคสหนัก (RED crisis)
 *
 * รูปอยู่ที่ public/louise-hay/avatar/{female,male}/*.webp (regenerate ด้วย scripts/gen-louise-avatar.mjs).
 */

export type AvatarState = "idle" | "listening" | "speaking" | "concern";
export type AvatarGender = "female" | "male";

// ไฟล์รูปฐานตามสถานะ (concern มีรูปเฉพาะ, ที่เหลือใช้ idle เป็นฐาน)
const BASE_FILE: Record<AvatarState, "idle" | "concern"> = {
  idle: "idle",
  listening: "idle",
  speaking: "idle",
  concern: "concern",
};

export function LouiseHayAvatar({
  state,
  gender = "female",
  size = 96,
}: {
  state: AvatarState;
  gender?: AvatarGender;
  size?: number;
}) {
  const dir = `/louise-hay/avatar/${gender}`;
  const stateLabel =
    state === "speaking"
      ? "กำลังพูด"
      : state === "listening"
        ? "กำลังฟัง"
        : state === "concern"
          ? "ห่วงใย"
          : "พร้อมคุย";

  return (
    <div
      className={`lh-avatar lh-avatar--${state}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`อวตารโค้ชฮีลใจ (${stateLabel})`}
    >
      <span className="lh-avatar__ring" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="lh-avatar__img" src={`${dir}/${BASE_FILE[state]}.webp`} alt="" aria-hidden draggable={false} />
      {/* เฟรมปากอ้า ซ้อนบน idle — โผล่สลับตอนพูด */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="lh-avatar__img lh-avatar__img--talk"
        src={`${dir}/speaking.webp`}
        alt=""
        aria-hidden
        draggable={false}
      />
    </div>
  );
}
