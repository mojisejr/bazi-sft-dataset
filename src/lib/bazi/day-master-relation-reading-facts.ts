import { z } from "zod";

import {
  BaziCallerContractSchema,
  type BaziCallerContract,
} from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  Source5RelationshipOverlaySchema,
  buildSource5RelationshipOverlay,
  type Source5RelationshipOverlay,
} from "@/lib/bazi/source5-relationship-overlay";
import {
  RawInputSchema,
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  RelationReadingPacketSchema,
  type RelationReadingPacket,
} from "@/lib/bazi/day-master-relation-reading-packet";

export const DayMasterRelationReadingFactsSchema = z.object({
  rawInput: RawInputSchema,
  packet: RelationReadingPacketSchema,
  callerContract: BaziCallerContractSchema.optional(),
  source5RelationshipOverlay: Source5RelationshipOverlaySchema.optional(),
}).superRefine((facts, context) => {
  if (facts.source5RelationshipOverlay && !facts.callerContract) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["callerContract"],
      message: "Source 5 reading seam requires callerContract when source5RelationshipOverlay is present.",
    });
  }
});

export const DayMasterRelationReadingSeamSchema = DayMasterRelationReadingFactsSchema;

export type DayMasterRelationReadingFacts = z.infer<typeof DayMasterRelationReadingFactsSchema>;
export type DayMasterRelationReadingSeam = DayMasterRelationReadingFacts;

function resolveSource5RelationshipOverlay(input: {
  callerContract?: BaziCallerContract;
  source5RelationshipOverlay?: Source5RelationshipOverlay;
}) {
  if (input.source5RelationshipOverlay) {
    return input.source5RelationshipOverlay;
  }

  if (!input.callerContract) {
    return undefined;
  }

  return buildSource5RelationshipOverlay(input.callerContract);
}

export function buildDayMasterRelationReadingFacts(input: {
  rawInput: RawInputValue;
  packet: RelationReadingPacket;
  callerContract?: BaziCallerContract;
  source5RelationshipOverlay?: Source5RelationshipOverlay;
}) {
  return DayMasterRelationReadingFactsSchema.parse({
    rawInput: input.rawInput,
    packet: input.packet,
    callerContract: input.callerContract,
    source5RelationshipOverlay: resolveSource5RelationshipOverlay(input),
  });
}

export function buildDayMasterRelationReadingFactsFromUpstream(options: {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  packetBuilder: (calculatedState: CalculatedStateValue) => RelationReadingPacket;
  callerContract?: BaziCallerContract;
  source5RelationshipOverlay?: Source5RelationshipOverlay;
}) {
  return buildDayMasterRelationReadingFacts({
    rawInput: options.rawInput,
    packet: options.packetBuilder(options.calculatedState),
    callerContract: options.callerContract,
    source5RelationshipOverlay: options.source5RelationshipOverlay,
  });
}

export function buildDayMasterRelationReadingSeam(input: {
  rawInput: RawInputValue;
  packet: RelationReadingPacket;
  callerContract?: BaziCallerContract;
  source5RelationshipOverlay?: Source5RelationshipOverlay;
}) {
  return buildDayMasterRelationReadingFacts(input);
}