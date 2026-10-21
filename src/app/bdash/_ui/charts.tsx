// bdash กราฟ (mumate-bdash-v2-001 slice 2). SVG ย่อขยายตามกล่อง ตัวหนังสือจึงเล็กลงตามจอ — เดิมเหลือ ~6px บนมือถือ.
// แก้โดยวาดสองขนาด (กว้าง 560 / แคบ 340 หน่วย) แล้วให้ container query เลือกตามความกว้างจริงของการ์ด:
// ตัวหนังสือ 13.5 หน่วยในแบบกว้าง (กล่อง ≥ 460px → ≥ 11px) และ 13 หน่วยในแบบแคบ (กล่อง ≥ 288px → ≥ 11px).
import type { Bucket } from "@/lib/bdash/range";
import { thDate } from "@/lib/bdash/view";

type Size = { w: number; h: number; m: { t: number; r: number; b: number; l: number }; xLabels: number };
const SIZES: ReadonlyArray<readonly ["wide" | "narrow", Size]> = [
  ["wide", { w: 560, h: 220, m: { t: 26, r: 14, b: 28, l: 48 }, xLabels: 6 }],
  ["narrow", { w: 340, h: 210, m: { t: 26, r: 10, b: 28, l: 42 }, xLabels: 4 }],
];

export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v) ?? 10 * p;
}

/** ป้ายแกนนอน: ราว n ป้าย กระจายเท่าๆ กัน และมีช่องสุดท้ายเสมอ */
export function labelIndexes(count: number, n: number): number[] {
  if (count <= 0) return [];
  if (count <= n) return [...Array(count).keys()];
  const step = Math.ceil((count - 1) / (n - 1));
  const out: number[] = [];
  for (let i = 0; i < count - 1; i += step) out.push(i);
  if (count - 1 - (out.at(-1) ?? 0) < step / 2) out.pop();
  out.push(count - 1);
  return out;
}

export type Line = { key: string; label: string; cls: string; values: (number | null)[] };

export function LineChart(props: {
  buckets: string[];
  bucket: Bucket;
  lines: Line[];
  fmt: (v: number) => string;
  /** แกนตั้งสูงสุดตายตัว (เช่น 1 สำหรับ %) — ไม่ใส่ = ตามข้อมูล */
  top?: number;
  markers?: { day: string; label: string }[];
  aria: string;
}) {
  const { buckets } = props;
  const all = props.lines.flatMap((l) => l.values.filter((v): v is number => v !== null));
  const top = props.top ?? niceMax(Math.max(1e-9, ...all) * 1.1);
  if (buckets.length === 0) return <p className="bd-hint">ยังไม่มีข้อมูล</p>;
  return (
    <div className="bd-chart">
      {SIZES.map(([name, s]) => {
        const pw = s.w - s.m.l - s.m.r;
        const x = (i: number) => s.m.l + (buckets.length === 1 ? pw / 2 : (i / (buckets.length - 1)) * pw);
        const y = (v: number) => s.h - s.m.b - (v / top) * (s.h - s.m.t - s.m.b);
        const ticks = [0, top / 2, top];
        const slot = buckets.length === 1 ? pw : pw / (buckets.length - 1);
        const at = (day: string) => {
          // ช่องที่มีวันนี้อยู่ (รายสัปดาห์ = สัปดาห์ที่ครอบวันนั้น)
          let i = buckets.findIndex((b) => b > day);
          i = i === -1 ? buckets.length - 1 : Math.max(0, i - 1);
          return props.bucket === "day" ? buckets.indexOf(day) : i;
        };
        return (
          <svg key={name} className={`bd-svg ${name}`} viewBox={`0 0 ${s.w} ${s.h}`} role="img" aria-label={props.aria}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid" x1={s.m.l} x2={s.w - s.m.r} y1={y(t)} y2={y(t)} />
                <text className="tick" x={s.m.l - 6} y={y(t)} dy=".32em" textAnchor="end">
                  {props.fmt(t)}
                </text>
              </g>
            ))}
            {labelIndexes(buckets.length, s.xLabels).map((i) => (
              <text key={buckets[i]} className="tick" x={x(i)} y={s.h - 6} textAnchor={i === 0 && buckets.length > 1 ? "start" : i === buckets.length - 1 && buckets.length > 1 ? "end" : "middle"}>
                {thDate(buckets[i])}
              </text>
            ))}
            {(props.markers ?? []).map((mk) => {
              const i = at(mk.day);
              if (i < 0) return null;
              return (
                <g key={mk.day} className="marker">
                  <line x1={x(i)} x2={x(i)} y1={s.m.t - 4} y2={s.h - s.m.b} />
                  <text x={x(i)} y={s.m.t - 10} textAnchor={x(i) > s.w * 0.6 ? "end" : "start"}>
                    {`${thDate(mk.day)} ${mk.label}`}
                  </text>
                </g>
              );
            })}
            {props.lines.map((l) => {
              let d = "";
              let pen = false;
              l.values.forEach((v, i) => {
                if (v === null) {
                  pen = false;
                  return;
                }
                d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
                pen = true;
              });
              const last = l.values.findLastIndex((v) => v !== null);
              return (
                <g key={l.key} className={l.cls}>
                  <path className="line" d={d} />
                  {last >= 0 ? <circle cx={x(last)} cy={y(l.values[last] as number)} r={4} /> : null}
                </g>
              );
            })}
            {buckets.map((b, i) => (
              <rect key={b} className="hit" x={x(i) - slot / 2} y={s.m.t} width={slot} height={s.h - s.m.t - s.m.b}>
                <title>{`${props.bucket === "week" ? "สัปดาห์ของ " : ""}${thDate(b)} · ${props.lines
                  .map((l) => `${l.label} ${l.values[i] === null ? "—" : props.fmt(l.values[i] as number)}`)
                  .join(" · ")}`}</title>
              </rect>
            ))}
          </svg>
        );
      })}
    </div>
  );
}

export type Bar = { key: string; label: string; value: number; partial: boolean; valueText: string; tip: string };

export function BarChart(props: { bars: Bar[]; fmt: (v: number) => string; floor: number; reference?: { value: number; tip: string }; aria: string }) {
  if (props.bars.length === 0) return <p className="bd-hint">ยังไม่มีข้อมูลในช่วงนี้</p>;
  const top = niceMax(Math.max(props.floor, ...props.bars.map((b) => b.value * 1.25)));
  return (
    <div className="bd-chart">
      {SIZES.map(([name, s]) => {
        const y = (v: number) => s.h - s.m.b - (v / top) * (s.h - s.m.t - s.m.b);
        const band = (s.w - s.m.l - s.m.r) / props.bars.length;
        const bw = Math.min(36, band * 0.6);
        // ไม่เกิน 6 แท่ง ป้ายครบทุกแท่ง · มากกว่านั้นเว้นเป็นช่วง โดยนับจากแท่งล่าสุด
        const every = props.bars.length <= 6 ? 1 : Math.ceil(props.bars.length / s.xLabels);
        return (
          <svg key={name} className={`bd-svg ${name}`} viewBox={`0 0 ${s.w} ${s.h}`} role="img" aria-label={props.aria}>
            {[0, top / 2, top].map((t) => (
              <g key={t}>
                <line className="grid" x1={s.m.l} x2={s.w - s.m.r} y1={y(t)} y2={y(t)} />
                <text className="tick" x={s.m.l - 6} y={y(t)} dy=".32em" textAnchor="end">
                  {props.fmt(t)}
                </text>
              </g>
            ))}
            {props.bars.map((b, i) => {
              const x = s.m.l + i * band + (band - bw) / 2;
              const showLabel = (props.bars.length - 1 - i) % every === 0;
              return (
                <g key={b.key}>
                  <rect className={b.partial ? "bar partial" : "bar"} x={x} width={bw} y={y(b.value)} height={Math.max(0, y(0) - y(b.value))} rx={8}>
                    <title>{b.tip}</title>
                  </rect>
                  {showLabel ? (
                    <>
                      <text className="val" x={x + bw / 2} y={y(b.value) - 6} textAnchor="middle">
                        {b.valueText}
                      </text>
                      <text className="tick" x={x + bw / 2} y={s.h - 6} textAnchor="middle">
                        {b.label}
                      </text>
                    </>
                  ) : null}
                </g>
              );
            })}
            {props.reference ? (
              <line className="ref" x1={s.m.l} x2={s.w - s.m.r} y1={y(props.reference.value)} y2={y(props.reference.value)}>
                <title>{props.reference.tip}</title>
              </line>
            ) : null}
          </svg>
        );
      })}
    </div>
  );
}
