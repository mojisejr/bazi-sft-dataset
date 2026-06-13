"use client";

import { useCallback, useState, type FormEvent } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import type { PhonePairReading, PhoneReading } from "@/lib/bazi/phone-number";

const ZONE_LABEL: Record<PhonePairReading["zone"], string> = {
  front: "รู้หน้า · การแสดงออกภายนอก",
  back: "รู้ใจ · ความรู้สึกภายใน",
};

const FIELD_LABELS: { key: keyof PhonePairReading["meaning"]; label: string }[] = [
  { key: "feeling", label: "ความรู้สึกนึกคิด / บุคลิกภาพ" },
  { key: "work", label: "การงาน" },
  { key: "money", label: "การเงิน" },
  { key: "love", label: "ความรัก" },
  { key: "analysis", label: "บทวิเคราะห์" },
];

function PairMeaningBlock({ reading }: { reading: PhonePairReading }) {
  return (
    <dl className="phone-meaning">
      {FIELD_LABELS.map(({ key, label }) =>
        reading.meaning[key] ? (
          <div key={key} className="phone-meaning__row">
            <dt>{label}</dt>
            <dd>{reading.meaning[key]}</dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

export function PhoneReadingWorkspace() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhoneReading | null>(null);

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch("/api/bazi/phone-reading", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phoneNumber }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "ทำนายไม่สำเร็จ");
        }
        setResult(data as PhoneReading);
      } catch (err) {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
        setResult(null);
      } finally {
        setSubmitting(false);
      }
    },
    [phoneNumber],
  );

  return (
    <div className="phone-shell">
      <Surface as="section" inset>
        <SectionHeading
          kicker="เลขพยากรณ์"
          title="กรอกเบอร์มือถือเพื่อทำนาย"
          note="ระบบจะตัดรหัสประเทศ (0 หรือ 66) แล้วอ่านคำทำนายจากคู่เลขที่ติดกัน โดยให้น้ำหนักคู่ท้ายสุดมากที่สุด"
        />
        <form className="phone-form" onSubmit={onSubmit}>
          <input
            className="phone-form__input"
            type="tel"
            inputMode="numeric"
            name="phoneNumber"
            placeholder="เช่น 0812345678"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            aria-label="เบอร์มือถือ"
          />
          <ActionButton tone="primary" type="submit" disabled={submitting}>
            {submitting ? "กำลังทำนาย..." : "ทำนายเบอร์"}
          </ActionButton>
        </form>
        {error ? <p className="phone-error">{error}</p> : null}
      </Surface>

      {result ? (
        <Surface as="section" inset className="phone-result">
          <SectionHeading
            kicker={`เบอร์ ${result.normalized}`}
            title="ภาพรวมคำทำนาย"
            note="ไล่อ่านทีละคู่จากซ้าย (ปัจจัยภายนอก) ไปขวา (ความรู้สึกภายใน) — คู่ปิดท้ายสำคัญที่สุด"
          />

          <div className="phone-digits" aria-hidden="true">
            {result.normalized.split("").map((d, i) => (
              <span key={i} className="phone-digit">
                {d}
              </span>
            ))}
          </div>

          <div className="phone-closing">
            <p className="phone-closing__tag">คู่ปิดท้าย {result.closing.pair} · เด่นที่สุด</p>
            <PairMeaningBlock reading={result.closing} />
          </div>

          <div className="phone-pairs">
            <SectionHeading kicker="ทีละคู่" title="คำทำนายรายคู่" titleLevel="h4" compact />
            {result.pairs.map((p) => (
              <details key={p.position} className="phone-pair" open={p.position === result.pairs.length}>
                <summary>
                  <span className="phone-pair__code">{p.pair}</span>
                  <span className="phone-pair__zone">{ZONE_LABEL[p.zone]}</span>
                  <span className="phone-pair__weight">น้ำหนัก {Math.round(p.weight * 100)}%</span>
                </summary>
                <PairMeaningBlock reading={p} />
              </details>
            ))}
          </div>

          <div className="phone-tally">
            <SectionHeading
              kicker="องค์ประกอบหลัก"
              title="ดาว / ธาตุ ในเบอร์"
              titleLevel="h4"
              compact
            />
            <table className="phone-tally__table">
              <thead>
                <tr>
                  <th>เลข</th>
                  <th>จำนวน</th>
                  <th>ดาว</th>
                  <th>ธาตุ</th>
                  <th>ความหมาย</th>
                </tr>
              </thead>
              <tbody>
                {result.digitTally.map((t) => (
                  <tr key={t.digit}>
                    <td className="phone-tally__digit">{t.digit}</td>
                    <td>{t.count}</td>
                    <td>{t.planet}</td>
                    <td>{t.element}</td>
                    <td>{t.keyword}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
