# Gemini prompt tuning — ขัดเกลาให้ใกล้ gptCase output (A/B, 2026-06-08)

## โจทย์
ป้อน engine reading เข้า Gemini แล้วขัดเกลาให้ใกล้ **gptCase output** มากที่สุด · ใช้ A/B tester วัด + วนปรับ

## เครื่องมือที่สร้าง
- **prompt profile สลับได้** — [reading-prompt-profiles.ts](../src/lib/bazi/reading-prompt-profiles.ts): `baseline` (เดิม), `gptcase-tuned`, `gptcase-tuned-v2`; `generateReadingTopicLlm` รับ `input.profile`
- **scoring** — [reading-similarity.ts](../scripts/lib/reading-similarity.ts): embedding cosine (Gemini) + LLM-judge rubric (faithfulness/tone/coverage/overall) → `combinedScore` (0.5/0.5)
- **gptCase loader** — [gptcase-cases.ts](../scripts/lib/gptcase-cases.ts): แตก output 8 ไฟล์เป็นรายบท + manifest วันเกิด
- **A/B harness** — [ab-prompt-tester.ts](../scripts/ab-prompt-tester.ts): `variant × ground × case × topic` → leaderboard + diff
  - รัน: `npx tsx scripts/ab-prompt-tester.ts --variants baseline,gptcase-tuned --ground both --cases 1,4 --topics ... --judge on`

## ผล A/B

### Round 1 (baseline vs gptcase-tuned × technical/consumer · 2 เคส × 4 บท = 32 แถว)
| variant · ground | combined | cosine | judge |
|---|---|---|---|
| **gptcase-tuned · consumer** | **77.9** | 0.872 | 68.5 |
| baseline · technical | 76.8 | 0.867 | 66.9 |
| baseline · consumer | 76.0 | 0.873 | 64.6 |
| gptcase-tuned · technical | 75.8 | 0.864 | 65.3 |

→ **consumer ground + prompt ปรับโทน** ชนะ · prompt ปรับโทนเข้าคู่กับ ground ที่สะอาด (consumer) ได้ดีกว่า technical

### Round 2 (gptcase-tuned vs v2 · consumer · 16 แถว)
| variant · ground | combined | cosine | judge |
|---|---|---|---|
| **gptcase-tuned · consumer** | **77.4** | 0.870 | 67.9 |
| gptcase-tuned-v2 · consumer | 74.0 | 0.872 | 60.8 |

→ v2 (ห้ามขยายลิสต์ + บังคับจัดกลุ่มเข้ม) **แย่ลง** (judge ตก โดยเฉพาะ wealth 63 vs 73) · cosine เท่ากัน = เนื้อหาใกล้พอกัน แต่ judge ชอบร้อยแก้วที่รวยกว่าของ v1 · คะแนน **plateau ~77-78**

## ข้อสรุป / สิ่งที่ตั้งเป็น default
- **ผู้ชนะ: profile `gptcase-tuned` + ground `consumer`** → ตั้งเป็น default ของ Gemini path ใน [route.ts](../src/app/api/reading/topic/route.ts) (mode="llm", provider gemini): ใช้ `buildTopicConsumerReading` เป็น ground + `GPTCASE_TUNED_PROFILE`

## เพดาน (ceiling) — สำคัญ
ความใกล้เคียงถูกจำกัดด้วย **เนื้อหา engine ที่ต่างจาก gptCase ไม่ใช่ที่ prompt**:
- เคส A บทอาชีพ: engine ให้ useful god = **ไฟ+ทอง** แต่ gptCase = **น้ำ+ไฟ** → judge faithfulness/coverage ตก (cosine ยังสูง) เพราะรายการอาชีพคนละธาตุ — เป็น divergence สาย useful-god/strength (ดู [[strength-1988-divergence]])
- prompt ปรับได้แค่ "โทน/โครง/กันหลอน" บทที่เนื้อตรงกัน (chart 82, career 79) คะแนนสูง · บทที่เนื้อต่าง (wealth/career บางเคส) ติดเพดาน

**งานต่อที่จะดันคะแนนเกินเพดาน = แก้ logic useful-god/strength ของ engine (คนละชั้น ไม่ใช่ prompt)** — ดู R5 ใน [plan.md](../plan.md)

## หมายเหตุ noise
generate ใช้ temperature 0.55 → คะแนนแกว่ง ±0.5 ต่อรอบ (gptcase-tuned: 77.9 → 77.4) · ควรเทียบที่ส่วนต่าง > 1 จึงถือว่าต่างจริง
