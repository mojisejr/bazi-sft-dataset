// seed จากคำถาม — ให้ "คำถามต่างกัน → จั่วไพ่ต่างกัน" (คำถามเดิม → ไพ่เดิม)
// (ซินแส/ปอง 2026-09-21: เดิมไม่มีคำถาม จั่ว random ทุกคนได้กล่องเหมือนกัน). ใช้กับ drawRandom(count, seed?).
// cyrb53 hash → uint32 (เหมาะเป็น seed ของ mulberry32 ในเด็ค). salt สำหรับกรณีอยากได้ผลจั่วใหม่ (เช่น day-key).
export function seedFromQuestion(question: string, salt = ""): number {
  const s = (question ?? "").trim() + salt;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return h1 >>> 0;
}
