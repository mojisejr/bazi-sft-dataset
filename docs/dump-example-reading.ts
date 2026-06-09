import { writeFileSync } from "node:fs";
import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildDayMasterRelationPacket } from "@/lib/bazi/day-master-relation-reading-poc";
import { buildTopicEngineReading, TOPIC_PATH } from "@/lib/bazi/topic-reading";

async function main() {
  const rawInput = { birthDate: "1993-11-24", birthTime: "15:09", gender: "male", province: "กรุงเทพมหานคร" };
  const state = await calculateBaziStateFromRawInput(rawInput);
  const packet = buildDayMasterRelationPacket(state);

  const fp = state.fourPillars;
  const out: any = {
    rawInput,
    dayMaster: state.dayMaster,
    strength:
      state.dayMasterStrengthProfile?.displayLabel ??
      state.dayMasterStrengthProfile?.strengthState ??
      null,
    pillars: {
      year: `${fp.year.stem}${fp.year.branch}`,
      month: `${fp.month.stem}${fp.month.branch}`,
      day: `${fp.day.stem}${fp.day.branch}`,
      hour: `${fp.hour.stem}${fp.hour.branch}`,
    },
    topics: [] as any[],
  };

  for (const topic of TOPIC_PATH) {
    const reading = buildTopicEngineReading(state, topic.id, packet);
    out.topics.push({
      id: topic.id,
      chapter: reading.chapter,
      title: reading.title,
      lens: reading.lens,
      method: reading.method,
    });
  }

  writeFileSync("docs/example-reading-dump.json", JSON.stringify(out, null, 2), "utf8");
  console.log("OK day=", out.dayMaster, "strength=", out.strength, "pillars=", out.pillars);
  console.log("topics=", out.topics.length);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
