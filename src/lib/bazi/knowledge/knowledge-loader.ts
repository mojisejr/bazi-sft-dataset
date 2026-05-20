import compiledKnowledgeArtifactJson from "./compiled-knowledge.json";

import {
  type CompiledKnowledgeArtifact,
  type CompiledKnowledgeSourceBundle,
  type CompiledTopicKnowledge,
  type TopicId,
} from "./topic-types";

const compiledKnowledgeArtifact =
  compiledKnowledgeArtifactJson as CompiledKnowledgeArtifact;

if (compiledKnowledgeArtifact.topicCount !== compiledKnowledgeArtifact.topics.length) {
  throw new Error("Compiled knowledge artifact topic count is inconsistent.");
}

const compiledTopicKnowledgeById = Object.freeze(
  Object.fromEntries(
    compiledKnowledgeArtifact.topics.map((topic) => [topic.id, topic]),
  ) as Record<TopicId, CompiledTopicKnowledge>,
);

export function getCompiledKnowledgeArtifact(): CompiledKnowledgeArtifact {
  return compiledKnowledgeArtifact;
}

export function listCompiledTopicKnowledge(): CompiledTopicKnowledge[] {
  return compiledKnowledgeArtifact.topics;
}

export function getTopicKnowledge(topicId: TopicId): CompiledTopicKnowledge {
  return compiledTopicKnowledgeById[topicId];
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