import { readFileSync } from "node:fs";
import path from "node:path";

import {
  type CompiledKnowledgeArtifact,
  type CompiledKnowledgeSourceBundle,
  type CompiledTopicKnowledge,
  type TopicId,
} from "./topic-types";

// ⚠️ ห้ามเปลี่ยนกลับเป็น `import ... from "./compiled-knowledge.json"` —
// ไฟล์นี้ ~42MB static import จะถูกฝังเข้า shared chunk แล้ว Vercel ก็อปเข้า
// serverless function ทุกตัวที่แตะ lib/bazi (~77 routes) → deployment บวม >10GB.
// อ่านด้วย fs ตอน runtime แทน ให้ Next file-tracing แนบไฟล์เฉพาะ function ที่ใช้จริง.
const COMPILED_KNOWLEDGE_PATH = path.join(
  process.cwd(),
  "src/lib/bazi/knowledge/compiled-knowledge.json",
);

let cached: {
  artifact: CompiledKnowledgeArtifact;
  byId: Record<TopicId, CompiledTopicKnowledge>;
} | null = null;

function loadCompiledKnowledge() {
  if (cached) return cached;
  const artifact = JSON.parse(
    readFileSync(COMPILED_KNOWLEDGE_PATH, "utf8"),
  ) as CompiledKnowledgeArtifact;

  if (artifact.topicCount !== artifact.topics.length) {
    throw new Error("Compiled knowledge artifact topic count is inconsistent.");
  }

  const byId = Object.freeze(
    Object.fromEntries(
      artifact.topics.map((topic) => [topic.id, topic]),
    ) as Record<TopicId, CompiledTopicKnowledge>,
  );
  cached = { artifact, byId };
  return cached;
}

export function getCompiledKnowledgeArtifact(): CompiledKnowledgeArtifact {
  return loadCompiledKnowledge().artifact;
}

export function listCompiledTopicKnowledge(): CompiledTopicKnowledge[] {
  return loadCompiledKnowledge().artifact.topics;
}

export function getTopicKnowledge(topicId: TopicId): CompiledTopicKnowledge {
  return loadCompiledKnowledge().byId[topicId];
}

export function getTopicSourceBundle(
  topicId: TopicId,
  directoryLabel: string,
): CompiledKnowledgeSourceBundle | undefined {
  return getTopicKnowledge(topicId).sourceBundles.find(
    (bundle) => bundle.directoryLabel === directoryLabel,
  );
}

export function getTopicKnowledgeContext(topicId: TopicId): string {
  const topic = getTopicKnowledge(topicId);
  const sections = [
    `หัวข้อ: ${topic.thaiLabel}`,
    `กลุ่มความรู้: ${topic.chunkGroup}`,
    `มิติคำอธิบาย: ${topic.annotationDimension}`,
    `ตัวแปร engine ที่ต้องใช้: ${topic.engineDependencies.join(", ")}`,
    "หลักการตีความ:",
    ...topic.sinsaeLogicRules.map((rule, index) => `${index + 1}. ${rule}`),
    "องค์ความรู้ที่ compile แล้ว:",
    ...topic.sourceBundles.map(formatTopicSourceBundleContext),
  ];

  return sections.join("\n\n");
}

function formatTopicSourceBundleContext(
  bundle: CompiledKnowledgeSourceBundle,
): string {
  const documentList = bundle.documents
    .map(
      (document) =>
        `- ${document.title} (${document.sourceFormat}) :: ${document.relativePath}`,
    )
    .join("\n");

  return [
    `แหล่งอ้างอิง: ${bundle.directoryLabel}`,
    `Primary source: ${bundle.primarySource}`,
    `Supporting sources: ${bundle.supportingSources.join(", ") || "-"}`,
    `Reasoning focus: ${bundle.reasoningFocus}`,
    `Documents:\n${documentList}`,
    bundle.combinedNormalizedContent,
  ].join("\n\n");
}