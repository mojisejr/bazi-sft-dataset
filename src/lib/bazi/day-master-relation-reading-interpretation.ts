import { z } from "zod";

import {
  DayMasterRelationReadingSeamSchema,
  buildDayMasterRelationReadingSeam,
  type DayMasterRelationReadingSeam,
} from "@/lib/bazi/day-master-relation-reading-facts";
import { type RelationReadingPacket } from "@/lib/bazi/day-master-relation-reading-packet";
import {
  type RawInputValue,
} from "@/lib/bazi/schema-types";

const BriefStepSchema = z.object({
  stepNumber: z.number().int().min(1).max(6),
  titleThai: z.string().trim().min(1),
  briefThai: z.string().trim().min(1),
  evidenceRefs: z.array(z.string().trim().min(1)).min(1),
  evidenceLines: z.array(z.string().trim().min(1)).min(1),
});

export const DayMasterRelationBriefSchema = z.object({
  version: z.literal("bazi-stepwise-brief-v2"),
  openingDoctrineThai: z.string().trim().min(1),
  chartAnchor: z.object({
    dayMasterStem: z.string().trim().min(1),
    dayMasterElementLabelThai: z.string().trim().min(1),
    dayMasterStrengthLabelThai: z.string().trim().min(1),
    dayMasterStrengthScore: z.number().finite(),
    dayBranchLabelThai: z.string().trim().min(1),
  }),
  steps: z.array(BriefStepSchema).length(6),
});

export type DayMasterRelationBrief = z.infer<typeof DayMasterRelationBriefSchema>;

export function buildDayMasterRelationBriefFromReadingSeam(seamInput: DayMasterRelationReadingSeam) {
  const seam = DayMasterRelationReadingSeamSchema.parse(seamInput);
  const { packet } = seam;

  return DayMasterRelationBriefSchema.parse({
    version: "bazi-stepwise-brief-v2",
    openingDoctrineThai: "อ่านตาม Step 1 ถึง 6 เท่านั้น: สมดุล -> หลักวัน -> พลังมาตรฐาน -> ผลลัพธ์/โชคลาภ -> บริบทสี่เสา -> สัญญาณขั้นสูง โดยใช้ศัพท์สำนักก่อนและห้ามให้ prose แซง fact",
    chartAnchor: {
      dayMasterStem: packet.chartAnchor.dayMasterStem,
      dayMasterElementLabelThai: packet.chartAnchor.dayMasterElementLabelThai,
      dayMasterStrengthLabelThai: packet.chartAnchor.dayMasterStrengthLabelThai,
      dayMasterStrengthScore: packet.chartAnchor.dayMasterStrengthScore,
      dayBranchLabelThai: packet.chartAnchor.dayBranchLabelThai,
    },
    steps: packet.stepInsights.map((step) => ({
      stepNumber: step.stepNumber,
      titleThai: step.titleThai,
      briefThai: step.summaryThai,
      evidenceRefs: step.evidenceIds,
      evidenceLines: step.evidenceLines,
    })),
  });
}

export function buildDayMasterRelationBrief(rawInput: RawInputValue, packet: RelationReadingPacket) {
  return buildDayMasterRelationBriefFromReadingSeam(buildDayMasterRelationReadingSeam({
    rawInput,
    packet,
  }));
}

export function assertDayMasterRelationResponseEvidenceRefs(
  response: { step_readings: Array<{ evidence_refs: string[] }> },
  brief: DayMasterRelationBrief,
) {
  const allowedEvidenceRefs = new Set(brief.steps.flatMap((step) => step.evidenceRefs));

  response.step_readings.forEach((step) => {
    step.evidence_refs.forEach((reference) => {
      if (!allowedEvidenceRefs.has(reference)) {
        throw new Error(`Unknown evidence ref returned by Gemini: ${reference}`);
      }
    });
  });
}