// /bdash/chat — แชตถามอะไร (mumate-bdash-v2-001 slice 4, plan 0.4): การ์ดหัวข้อ (mate_ai_chat_meta ทุกแชต ไม่มีข้อความ)
// และการ์ดคำถามจริง (ai_question_log ของทีม อ่านอย่างเดียว เฉพาะคนที่ยินยอมรุ่นที่ครอบคลุมการวิเคราะห์เพื่อพัฒนาบริการ).
// ไม่มีปุ่มติดป้าย ลบ หรือ export — งานพวกนั้นอยู่ที่ /ops. ตัวกรองเป็นฟอร์ม GET ธรรมดา ไม่มี JavaScript ฝั่งเครื่อง.
import { CHAT_FROM, parseQuestionFilter, QUESTIONS_MAX, SEARCH_MAX, topicTh, type QuestionCard, type TopicCard, type TopicRow } from "@/lib/bdash/chat";
import { loadChat } from "@/lib/bdash/live";
import type { BdashRange } from "@/lib/bdash/range";
import { int, thDate } from "@/lib/bdash/view";

import { LineChart } from "../_ui/charts";
import { bdashMetadata, BdashShell, extra, openBdash, readOrHeavy, ShowAll, TooHeavy, type SearchParams } from "../_ui/shell";

export const dynamic = "force-dynamic";
export const metadata = bdashMetadata;

export default async function BdashChat({ searchParams }: { searchParams: SearchParams }) {
  const range = await openBdash(searchParams);
  const filter = parseQuestionFilter(await searchParams);
  const r = await readOrHeavy(loadChat(range, filter));
  return (
    <BdashShell active="chat" range={range} at={r?.at ?? null}>
      {r ? (
        <section className="bd-grid bd-chat">
          <Topics card={r.value.topics} range={range} />
          <Questions card={r.value.questions} range={range} />
        </section>
      ) : (
        <TooHeavy range={range} />
      )}
    </BdashShell>
  );
}

const share = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const SERIES = ["s1", "s2", "s3", "s4"];

function Change({ r }: { r: TopicRow }) {
  if (r.previous === null) return <>—</>;
  const d = r.questions - r.previous;
  if (d === 0) return <span className="bd-pill">เท่าเดิม</span>;
  return <span className={`bd-pill ${d > 0 ? "up" : "down"}`}>{`${d > 0 ? "+" : "−"}${int(Math.abs(d))}`}</span>;
}

function Topics({ card, range }: { card: TopicCard; range: BdashRange }) {
  const per = range.bucket === "day" ? "รายวัน" : "รายสัปดาห์";
  const near = card.timeframes.find((t) => t.key === "near");
  const year = card.timeframes.find((t) => t.key === "year");
  return (
    <div className="bd-card bd-topics">
      <h3>คนถามแชตเรื่องอะไรกัน</h3>
      <p className="bd-hint">
        หัวข้อ = AI จัดให้จากคำถาม ไม่ใช่คำที่สมาชิกพิมพ์ · นับทุกแชต และส่วนนี้ไม่เก็บข้อความที่ถาม · ลูกค้าที่จ่ายเงิน = เคยจ่ายสำเร็จถึงวันสุดท้ายของช่วง
      </p>
      {card.partial ? <p className="bd-note">เริ่มเก็บหัวข้อ {thDate(CHAT_FROM)} · ก่อนหน้านั้นไม่มีข้อมูล</p> : null}

      {card.questions === 0 ? (
        <p className="bd-hint">ยังไม่มีคำถามในแชตช่วงนี้</p>
      ) : (
        <>
          <div className="bd-stats">
            <div className="bd-stat">
              คำถาม<b>{int(card.questions)}</b>
            </div>
            <div className="bd-stat">
              คนถาม<b>{int(card.people)}</b>
            </div>
            <div className="bd-stat">
              ในนั้นเป็นลูกค้าที่จ่ายเงิน<b>{int(card.paidPeople)}</b>
            </div>
            <div className="bd-stat">
              นอกเรื่อง/คุยเล่น<b>{share(card.asideShare)}</b>
            </div>
          </div>

          <table className="bd-wide">
            <thead>
              <tr>
                <th>หัวข้อ</th>
                <th>คำถาม</th>
                <th>คนถาม</th>
                <th>ลูกค้าที่จ่ายเงิน</th>
                <th>คนใช้ฟรี</th>
                <th>เทียบช่วงก่อน</th>
              </tr>
            </thead>
            <tbody>
              {card.rows.map((r) => (
                <tr key={r.topic}>
                  <td className="txt">{r.label}</td>
                  <td style={{ fontWeight: 600 }}>{int(r.questions)}</td>
                  <td>{int(r.people)}</td>
                  <td>
                    {int(r.paidQuestions)} <span className="bd-sub-in">({share(r.paidShare)})</span>
                  </td>
                  <td>
                    {int(r.freeQuestions)} <span className="bd-sub-in">({share(r.freeShare)})</span>
                  </td>
                  <td>
                    <Change r={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bd-list bd-narrow">
            {card.rows.map((r, i) => (
              <div key={r.topic} className={`bd-item ${extra(i) ?? ""}`}>
                <div className="bd-item-head">
                  <b>{r.label}</b>
                  <span className="num">
                    <b>{int(r.questions)}</b> คำถาม
                  </span>
                </div>
                <span className="bd-sub">
                  <span className="num">{int(r.people)}</span> คน · ลูกค้าที่จ่ายเงิน <span className="num">{int(r.paidQuestions)}</span> · ใช้ฟรี{" "}
                  <span className="num">{int(r.freeQuestions)}</span> {r.previous !== null ? <Change r={r} /> : null}
                </span>
              </div>
            ))}
            <ShowAll id="topics-all" total={card.rows.length} label={(n) => `ดูอีก ${n} หัวข้อ`} />
          </div>
          <p className="bd-sub">
            ตัวเลขในวงเล็บ = กี่ % ของคำถามทั้งหมดในกลุ่มนั้น ·{" "}
            {card.compared ? "เทียบช่วงก่อน = เทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน" : `ยังเทียบช่วงก่อนไม่ได้ เพราะช่วงก่อนหน้าเริ่มก่อน ${thDate(CHAT_FROM)}`}
          </p>

          <h4 className="bd-h4">ถามเรื่องวันนี้ หรือเรื่องทั้งปี</h4>
          {near && year ? (
            <p className="bd-hint">
              วันนี้/พรุ่งนี้ <b className="num">{share(near.share)}</b> เทียบกับปีนี้/ปีหน้า <b className="num">{share(year.share)}</b> ของคำถามดูดวง (ไม่นับนอกเรื่อง/คุยเล่น)
            </p>
          ) : null}
          <div className="bd-stats">
            {card.timeframes.map((t) => (
              <div key={t.key} className="bd-stat">
                {t.label}
                <b>{share(t.share)}</b>
              </div>
            ))}
          </div>

          {card.series.length ? (
            <>
              <h4 className="bd-h4">หัวข้อยอดนิยม{per}</h4>
              <div className="bd-legend">
                {card.series.map((s, i) => (
                  <span key={s.topic}>
                    <i className={`dot-${SERIES[i]}`} />
                    {s.label}
                  </span>
                ))}
              </div>
              <LineChart
                aria={`คำถาม${per}ของ ${card.series.map((s) => s.label).join(" ")}`}
                buckets={card.buckets}
                bucket={range.bucket}
                fmt={(v) => int(v)}
                lines={card.series.map((s, i) => ({ key: s.topic, label: s.label, cls: SERIES[i], values: s.values }))}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

/** ช่วงปัจจุบันเป็น hidden input — ฟอร์มกรองส่งช่วงเดิมไปด้วย */
function RangeInputs({ range }: { range: BdashRange }) {
  return range.key === "custom" ? (
    <>
      <input type="hidden" name="from" value={range.from} />
      <input type="hidden" name="to" value={range.to} />
    </>
  ) : (
    <input type="hidden" name="range" value={range.key} />
  );
}

function Questions({ card, range }: { card: QuestionCard; range: BdashRange }) {
  const filtered = Boolean(card.filter.topic || card.filter.q);
  const chosen = card.filter.topic;
  const options =
    !chosen || card.topics.some((t) => t.topic === chosen) ? card.topics : [...card.topics, { topic: chosen, label: topicTh(chosen), questions: 0 }];
  return (
    <div className="bd-card bd-questions">
      <h3>ตัวอย่างคำถามจริง</h3>
      <p className="bd-hint">
        เฉพาะสมาชิกที่ยินยอมให้ใช้คำถามเพื่อพัฒนาบริการ (ตอนนี้ <b className="num">{int(card.consenters)}</b> คน) ไม่ใช่ทุกคนที่แชต จึงใช้ดูว่าคนถามอะไร
        ไม่ใช่นับสัดส่วน · ไม่เห็นว่าใครถาม · ระบบตัดเบอร์โทร อีเมล ตัวเลขยาว และลิงก์ออกก่อนเก็บ
      </p>

      {card.consenters === 0 ? (
        <p className="bd-hint">ยังไม่มีสมาชิกยินยอมข้อความรุ่นที่ครอบคลุมการวิเคราะห์ · คำถามจะเริ่มขึ้นที่นี่หลังมีคนกดยินยอม</p>
      ) : (
        <>
          <form method="get" action="/bdash/chat" className="bd-filter">
            <RangeInputs range={range} />
            <label>
              หัวข้อ
              <select name="topic" defaultValue={chosen ?? ""}>
                <option value="">ทุกหัวข้อ</option>
                {options.map((t) => (
                  <option key={t.topic} value={t.topic}>
                    {`${t.label} (${int(t.questions)})`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              มีคำว่า
              <input type="search" name="q" defaultValue={card.filter.q ?? ""} maxLength={SEARCH_MAX} placeholder="เช่น งาน, แฟน" />
            </label>
            <button type="submit">กรอง</button>
            {filtered ? (
              <a className="bd-go" href={`/bdash/chat?${range.query}`}>
                ล้างตัวกรอง
              </a>
            ) : null}
          </form>

          <p className="bd-sub">
            <b className="num">{int(card.questions)}</b> คำถามจาก <b className="num">{int(card.people)}</b> คน{filtered ? "ที่ตรงตัวกรอง" : ""}ในช่วงนี้
            {card.more ? ` · แสดง ${QUESTIONS_MAX} คำถามล่าสุด` : ""}
          </p>

          {card.rows.length === 0 ? (
            <p className="bd-hint">{filtered ? "ไม่มีคำถามที่ตรงตัวกรองในช่วงนี้" : "ยังไม่มีคำถามในช่วงนี้"}</p>
          ) : (
            <ol className="bd-qs">
              {card.rows.map((r, i) => (
                <li key={`${r.at}-${i}`} className={extra(i)}>
                  <p>{r.question}</p>
                  <span className="bd-sub">
                    <span className="bd-tag">{r.label}</span> <span className="num">{`${thDate(r.at.slice(0, 10))} ${r.at.slice(11)} น.`}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <ShowAll id="qs-all" total={card.rows.length} label={(n) => `ดูอีก ${n} คำถาม`} />
        </>
      )}
    </div>
  );
}
