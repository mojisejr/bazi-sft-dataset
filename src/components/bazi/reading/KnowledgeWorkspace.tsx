"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { SubstitutionRulesTable } from "@/components/bazi/reading/SubstitutionRulesTable";
import { KnowledgeEditor } from "@/components/bazi/reading/KnowledgeEditor";
import type { TopicKnowledgeView } from "@/lib/bazi/knowledge/topic-knowledge-view";
import {
  type SubstitutionRule,
  type SubstitutionRuleScope,
} from "@/lib/bazi/substitution-rules";

type Props = {
  topics: TopicKnowledgeView[];
  unavailable?: boolean;
};

/**
 * หน้า "องค์ความรู้ + คำแก้" รายบท:
 *  - ซ้าย: เลือกบท (ค้นหาได้)
 *  - ขวาบน: องค์ความรู้/หลักการที่ engine ใช้ (read-only — lens/ขั้น/บทบาท/แหล่งอ้างอิง)
 *  - ขวาล่าง: กฎแทนคำของบทนั้น (เพิ่ม/ลบ) ยิง /api/reading/rules (กลไกเปลี่ยนคำเดิม→คำใหม่)
 */
export function KnowledgeWorkspace({ topics, unavailable = false }: Props) {
  const [selectedId, setSelectedId] = useState(topics[0]?.definition.id ?? "");
  const [search, setSearch] = useState("");
  const [rules, setRules] = useState<SubstitutionRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);

  const [match, setMatch] = useState("");
  const [replacement, setReplacement] = useState("");
  const [scope, setScope] = useState<SubstitutionRuleScope>("topic");
  const [editMode, setEditMode] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  // 2 โหมด: รายบท (chapter) vs ตารางตามดวง (condition) — แยกกันชัด หาง่าย
  // เริ่มที่ "chapter" เสมอเพื่อให้ render แรกตรงกับ SSR (กัน hydration mismatch)
  // แล้วค่อยอ่าน deep-link จาก URL หลัง mount (?tab=condition&table=..&key=..)
  const [mode, setMode] = useState<"chapter" | "condition">("chapter");
  const [focusEntityKey, setFocusEntityKey] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "condition") setMode("condition");
    const table = params.get("table");
    const key = params.get("key");
    if (table && key) setFocusEntityKey(`table|${table}|${key}`);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/reading/rules")
      .then((res) => res.json())
      .then((body: { rules?: SubstitutionRule[] }) => {
        if (active && Array.isArray(body.rules)) setRules(body.rules);
      })
      .catch(() => {
        /* เปิดหน้าได้แม้โหลดกฎไม่สำเร็จ */
      })
      .finally(() => {
        if (active) setRulesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = topics.find((topic) => topic.definition.id === selectedId) ?? topics[0];

  const filteredTopics = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return topics;
    return topics.filter(
      (topic) =>
        topic.definition.title.toLowerCase().includes(query) ||
        String(topic.definition.chapter).includes(query),
    );
  }, [topics, search]);

  const topicRules = useMemo(() => {
    if (!selected) return [];
    return rules.filter(
      (rule) => rule.scope === "global" || rule.topicId === selected.definition.id,
    );
  }, [rules, selected]);

  async function handleAddRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!match.trim() || !selected) return;
    try {
      const response = await fetch("/api/reading/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope,
          topicId: scope === "topic" ? selected.definition.id : undefined,
          match,
          replacement,
          source: { kind: "manual" },
        }),
      });
      const body = (await response.json()) as { rules?: SubstitutionRule[] };
      if (response.ok && Array.isArray(body.rules)) {
        setRules(body.rules);
        setMatch("");
        setReplacement("");
      }
    } catch {
      /* เงียบ — ผู้ใช้กดใหม่ได้ */
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      const response = await fetch(`/api/reading/rules?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { rules?: SubstitutionRule[] };
      if (Array.isArray(body.rules)) setRules(body.rules);
    } catch {
      /* เงียบ */
    }
  }

  if (unavailable || topics.length === 0) {
    return (
      <section className="surface">
        <p className="section-note">
          ยังไม่พร้อมแสดงองค์ความรู้ — ตรวจการเชื่อมต่อฐานข้อมูล/การตั้งค่า แล้วรีเฟรชอีกครั้ง
        </p>
      </section>
    );
  }

  const tabBar = (
    <div className="knowledge__tabs surface" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "chapter"}
        className={`knowledge__tab${mode === "chapter" ? " knowledge__tab--active" : ""}`}
        onClick={() => setMode("chapter")}
      >
        📖 แก้คำทีละบท
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "condition"}
        className={`knowledge__tab${mode === "condition" ? " knowledge__tab--active" : ""}`}
        onClick={() => setMode("condition")}
      >
        🎴 ตารางคำทำนายตามดวง
      </button>
      <label className="knowledge__tab-token">
        <input
          type="password"
          placeholder="admin token (ถ้าตั้งไว้)"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          aria-label="admin token"
        />
      </label>
    </div>
  );

  // โหมด "ตารางคำทำนายตามดวง" — ไม่ผูกกับบท เปิดตัวแก้ section=condition ตรง ๆ
  if (mode === "condition") {
    return (
      <div className="knowledge knowledge--single">
        {tabBar}
        <section className="surface knowledge__panel">
          <KnowledgeEditor
            topicId=""
            adminToken={adminToken}
            section="condition"
            focusEntityKey={focusEntityKey}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="knowledge">
      {tabBar}
      <aside className="knowledge__list surface">
        <input
          className="knowledge__search"
          placeholder="ค้นหาบท…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="ค้นหาบท"
        />
        <ul className="knowledge__topics">
          {filteredTopics.map((topic) => (
            <li key={topic.definition.id}>
              <button
                type="button"
                className={`knowledge__topic${
                  topic.definition.id === selected?.definition.id ? " knowledge__topic--active" : ""
                }`}
                onClick={() => setSelectedId(topic.definition.id)}
              >
                <span className="knowledge__topic-ch">บท {topic.definition.chapter}</span>
                <span className="knowledge__topic-title">{topic.definition.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {selected && (
        <div className="knowledge__detail">
          <section className="surface knowledge__panel">
            <h2 className="knowledge__panel-title">
              📚 องค์ความรู้ที่ engine ใช้ — บท {selected.definition.chapter}: {selected.definition.title}
            </h2>
            <dl className="knowledge__meta">
              <div>
                <dt>หลักการอ่าน (lens)</dt>
                <dd>{selected.definition.lens}</dd>
              </div>
              <div>
                <dt>ขั้นที่ใช้ (7 ขั้น)</dt>
                <dd>{selected.definition.stepNumbers.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>บทบาทธาตุ</dt>
                <dd>{selected.definition.relationKeys.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>มิติหลักฐาน</dt>
                <dd>{selected.definition.evidenceDimension ?? "—"}</dd>
              </div>
            </dl>

            {selected.knowledge.length === 0 ? (
              <p className="section-note">
                บทนี้ยังไม่มีก้อนความรู้ใน registry (แสดงเฉพาะเมตาดาทาด้านบน)
              </p>
            ) : (
              selected.knowledge.map((bundle) => (
                <div className="knowledge__bundle" key={bundle.id}>
                  <h3 className="knowledge__bundle-title">{bundle.thaiLabel}</h3>

                  <p className="knowledge__sub">ตัวแปร engine ที่ต้องใช้</p>
                  <div className="knowledge__chips">
                    {bundle.engineDependencies.map((dependency) => (
                      <span className="knowledge__chip" key={dependency}>
                        {dependency}
                      </span>
                    ))}
                  </div>

                  <p className="knowledge__sub">หลักการของซินแส</p>
                  <ol className="knowledge__logic">
                    {bundle.sinsaeLogicRules.map((rule, index) => (
                      <li key={index}>{rule}</li>
                    ))}
                  </ol>

                  <p className="knowledge__sub">แหล่งอ้างอิง (คลังความรู้)</p>
                  <ul className="knowledge__sources">
                    {bundle.sourceRefs.map((source, index) => (
                      <li key={index}>
                        <strong>{source.primarySource}</strong>
                        {source.supportingSources.length > 0 && (
                          <span className="knowledge__support"> · {source.supportingSources.join(" · ")}</span>
                        )}
                        <span className="knowledge__focus"> — {source.reasoningFocus}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          <section className="surface knowledge__panel">
            <h2 className="knowledge__panel-title">✏️ กฎแทนคำของบทนี้ · {topicRules.length} กฎ</h2>
            <p className="section-note">
              เปลี่ยน “คำเดิม” จากระบบให้เป็น “คำใหม่/ประโยคใหม่” — มีผลกับทุกดวงที่ทายได้วลีเดียวกัน
              (เว้นช่องแก้เป็นว่าง = ลบวลีนั้นทิ้ง)
            </p>

            <form className="knowledge__add" onSubmit={handleAddRule}>
              <label className="knowledge__field">
                <span>คำเดิม (จากระบบ)</span>
                <input value={match} onChange={(event) => setMatch(event.target.value)} />
              </label>
              <label className="knowledge__field">
                <span>แก้เป็น (เว้นว่าง = ลบทิ้ง)</span>
                <input value={replacement} onChange={(event) => setReplacement(event.target.value)} />
              </label>
              <label className="knowledge__field knowledge__field--scope">
                <span>ใช้กับ</span>
                <select
                  value={scope}
                  onChange={(event) => setScope(event.target.value as SubstitutionRuleScope)}
                >
                  <option value="topic">บทนี้</option>
                  <option value="global">ทุกบท</option>
                </select>
              </label>
              <ActionButton tone="secondary" type="submit" disabled={match.trim().length === 0}>
                เพิ่มกฎ
              </ActionButton>
            </form>

            {rulesLoading ? (
              <p className="section-note">กำลังโหลดกฎ…</p>
            ) : (
              <SubstitutionRulesTable
                rules={topicRules}
                onDelete={handleDeleteRule}
                emptyNote="บทนี้ยังไม่มีกฎแทนคำ — เพิ่มได้จากฟอร์มด้านบน"
              />
            )}
          </section>

          <section className="surface knowledge__panel">
            <div className="knowledge__editor-head">
              <button
                type="button"
                className="knowledge-edit__toggle"
                onClick={() => setEditMode((value) => !value)}
                aria-expanded={editMode}
              >
                {editMode ? "▾" : "▸"} ✍️ แก้คำของบทนี้ (intro/สรุป/หลักการซินแส/ย่อหน้าเพิ่ม — draft → พรีวิว → เผยแพร่)
              </button>
            </div>
            {editMode && selected && (
              <KnowledgeEditor
                topicId={selected.definition.id}
                adminToken={adminToken}
                registryTopicIds={selected.knowledge.map((bundle) => bundle.id)}
                section="chapter"
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
