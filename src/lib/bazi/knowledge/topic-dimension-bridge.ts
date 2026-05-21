import {
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type AnnotationDimensionName,
} from "@/lib/bazi/schema-types";

import { BAZI_TOPIC_REGISTRY } from "@/lib/bazi/knowledge/topic-registry";
import { BAZI_TOPIC_IDS, type TopicId } from "@/lib/bazi/knowledge/topic-types";

export const TOPIC_TO_ANNOTATION_DIMENSION = Object.freeze(
  Object.fromEntries(
    BAZI_TOPIC_REGISTRY.map((topic) => [topic.id, topic.annotationDimension]),
  ) as Record<TopicId, AnnotationDimensionName>,
);

export const ANNOTATION_DIMENSION_TO_TOPIC_IDS = Object.freeze(
  REQUIRED_ANNOTATION_DIMENSION_NAMES.reduce(
    (accumulator, dimensionName) => {
      accumulator[dimensionName] = BAZI_TOPIC_IDS.filter(
        (topicId) => TOPIC_TO_ANNOTATION_DIMENSION[topicId] === dimensionName,
      );

      return accumulator;
    },
    {} as Record<AnnotationDimensionName, TopicId[]>,
  ),
);

export const UNMAPPED_ANNOTATION_DIMENSIONS = Object.freeze(
  REQUIRED_ANNOTATION_DIMENSION_NAMES.filter(
    (dimensionName) => ANNOTATION_DIMENSION_TO_TOPIC_IDS[dimensionName].length === 0,
  ),
);

export const SHARED_ANNOTATION_DIMENSIONS = Object.freeze(
  REQUIRED_ANNOTATION_DIMENSION_NAMES.filter(
    (dimensionName) => ANNOTATION_DIMENSION_TO_TOPIC_IDS[dimensionName].length > 1,
  ),
);

export function getAnnotationDimensionForTopic(topicId: TopicId) {
  return TOPIC_TO_ANNOTATION_DIMENSION[topicId];
}

export function getTopicIdsForAnnotationDimension(
  dimensionName: AnnotationDimensionName,
) {
  return ANNOTATION_DIMENSION_TO_TOPIC_IDS[dimensionName];
}