import {
  BaziTopicDefinitionSchema,
  type BaziTopicDefinition,
  type BaziTopicDefinitionDraft,
} from "@/lib/bazi/knowledge/topic-types";

const TOPIC_REGISTRY_DRAFT = [
  {
    id: "personality_baseline",
    sequence: 1,
    thaiLabel: "นิสัย/บุคลิกพื้นฐาน",
    chunkGroup: "core_fate",
    annotationDimension: "personality_psychology",
    engineDependencies: [
      "day_master",
      "day_master_strength",
      "sixty_jiazi_persona",
      "hidden_stems",
      "twelve_qi_profile",
    ],
    sinsaeLogicRules: [
      "อ่านบุคลิกจาก Day Master เป็นแกนหลักก่อนทุกครั้ง",
      "ขยายภาพบุคลิกด้วย 60 Jiazi และ hidden stems ของหลักเดือน",
      "ใช้ 12 เชี่ยงแซเป็นตัวคุมโทน ไม่ให้ตีความหลุดจากแรงจริงของดวง",
    ],
    sourceRefs: [
      {
        directoryLabel: "1.นิสัยโดยพื้นฐาน",
        primarySource: "1.นิสัยโดยพื้นฐาน",
        supportingSources: [
          "ลักษณะนิสัย60แบบ_ราศีบน-ล่าง_12เซี่ยงแซ",
          "ระบบ 12 เชี่ยงแซ",
        ],
        reasoningFocus: "ภาพรวมดวงและนิสัย 60 กะจื่อ",
      },
    ],
  },
  {
    id: "suitable_career",
    sequence: 2,
    thaiLabel: "อาชีพที่เหมาะสม",
    chunkGroup: "life_path",
    annotationDimension: "career_potential",
    engineDependencies: ["day_master_strength", "resource_star", "peer_star", "favorable_elements", "useful_god"],
    sinsaeLogicRules: [
      "เริ่มจากประเมินว่าดวงอ่อนหรือแข็ง แล้วค่อยเลือกธาตุงานที่ส่งเสริม",
      "งานที่เหมาะต้องสอดคล้องกับธาตุเกื้อหนุนและ Useful God",
      "ห้ามสรุปอาชีพจากบุคลิกอย่างเดียวโดยไม่ดูโครงสร้างธาตุ",
    ],
    sourceRefs: [
      {
        directoryLabel: "การงานและธุรกิจ",
        primarySource: "Source6_ การงานและธุรกิจ",
        supportingSources: [],
        reasoningFocus: "การเลือกอาชีพตามธาตุส่งเสริมสำหรับดวงอ่อนและดวงแข็ง",
      },
    ],
  },
  {
    id: "wealth_luck",
    sequence: 3,
    thaiLabel: "โชคลาภ",
    chunkGroup: "life_path",
    annotationDimension: "wealth_and_investment",
    engineDependencies: ["wealth_star", "pillar_relations", "clash_matrix", "combination_matrix", "day_master_strength"],
    sinsaeLogicRules: [
      "ดูดาวทรัพย์และตำแหน่งที่มันไปอยู่ก่อนสรุปเรื่องโชคลาภ",
      "แยกความหมายระหว่างโอกาสได้เงินกับความสามารถในการเก็บทรัพย์",
      "ถ้ามีชงหรือฮะกับดาวทรัพย์ต้องอธิบายผลกระทบต่อความมั่นคงทางการเงิน",
    ],
    sourceRefs: [
      {
        directoryLabel: "การเงินและการลงทุน",
        primarySource: "Source4_ การเงินและการลงทุน",
        supportingSources: [],
        reasoningFocus: "ตัวโชคลาภและตำแหน่งปี เดือน วัน ยาม",
      },
    ],
  },
  {
    id: "patrons_support",
    sequence: 4,
    thaiLabel: "ผู้ดูแล/อุปถัมภ์",
    chunkGroup: "core_fate",
    annotationDimension: "chart_foundation",
    engineDependencies: ["resource_star", "combination_matrix", "hidden_stems", "month_branch_relations"],
    sinsaeLogicRules: [
      "ผู้สนับสนุนดูจากดาวทรัพยากรและแรงหนุนที่ซ่อนในโครงสร้างหลักเดือน",
      "ถ้ามีฮะที่ช่วยเปิด resource ให้บันทึกว่าแรงหนุนมาจากคนรอบตัวหรือระบบ",
      "ห้ามตีความผู้ใหญ่ช่วยเหลือโดยไม่เห็น resource จริงในดวง",
    ],
    sourceRefs: [
      {
        directoryLabel: "ความหมายของปฏิกิริยาธาตุทั้ง 5",
        primarySource: "ความหมายของปฏิกิริยาธาตุทั้ง 5",
        supportingSources: ["12สี่ซิ้ง"],
        reasoningFocus: "หาแรงหนุนจากธาตุส่งเสริมและการฮะราศีแฝง",
      },
    ],
  },
  {
    id: "talents",
    sequence: 5,
    thaiLabel: "พรสวรรค์",
    chunkGroup: "core_fate",
    annotationDimension: "ten_gods_reaction",
    engineDependencies: ["output_star", "day_master_strength", "twelve_qi_profile", "hidden_stems"],
    sinsaeLogicRules: [
      "พรสวรรค์อ่านจาก Output ที่มีแรงและมีที่ยืนในดวง",
      "ถ้า Output เด่นแต่ดิถีอ่อน ต้องอธิบายว่าพรสวรรค์ใช้ได้ดีเมื่อมีคนหนุน",
      "ให้ใช้ 12 เชี่ยงแซช่วยแยกว่าเป็นพรสวรรค์เชิงสร้างสรรค์หรือเชิงปฏิบัติ",
    ],
    sourceRefs: [
      {
        directoryLabel: "ลักษณะ ของ ดิถี 10",
        primarySource: "ลักษณะ ของ ดิถี 10",
        supportingSources: ["ตาราง 12 เชี่ยงแซ"],
        reasoningFocus: "ตัวถ่ายเทที่แข็งแรงและเซียงแซที่มีกำลัง",
      },
    ],
  },
  {
    id: "family_dynamics",
    sequence: 6,
    thaiLabel: "ครอบครัว",
    chunkGroup: "relationships",
    annotationDimension: "love_and_family",
    engineDependencies: ["month_branch_relations", "pillar_relations", "clash_matrix", "harm_matrix"],
    sinsaeLogicRules: [
      "เรื่องครอบครัวให้ยึดหลักเดือนเป็นแกนก่อน",
      "ถ้ามีชง เฮ้ง ไห่ หรือผั่วกับหลักเดือน ต้องอธิบายเป็นความตึงเครียดในบ้านเดิม",
      "ถ้ามีภาคีช่วยค้ำหลักเดือน ให้สะท้อนเป็นแรงประคองจากครอบครัว",
    ],
    sourceRefs: [
      {
        directoryLabel: "ความรักและความสัมพันธ์",
        primarySource: "ความรักและความสัมพันธ์",
        supportingSources: ["ชงเฮ้งไห่ผั่วภาคี(เนื้อหา).docx.md"],
        reasoningFocus: "ความสัมพันธ์ในบ้านและหลักเดือน",
      },
    ],
  },
  {
    id: "love_life",
    sequence: 7,
    thaiLabel: "ความรัก",
    chunkGroup: "relationships",
    annotationDimension: "love_and_family",
    engineDependencies: ["wealth_star", "power_star", "day_branch_relations", "combination_matrix", "clash_matrix"],
    sinsaeLogicRules: [
      "ฐานคู่ครองดูจากหลักวันก่อน แล้วค่อยพิจารณาดาวคู่ครองตามเพศ",
      "ชายให้ดู Wealth หญิงให้ดู Power แต่ต้องอ่านร่วมกับ day branch เสมอ",
      "ถ้ามีฮะหรือชงที่ฐานคู่ครอง ต้องแปลเป็นรูปแบบสัมพันธ์ ไม่ใช่สรุปดีร้ายลอยๆ",
    ],
    sourceRefs: [
      {
        directoryLabel: "ความรักและความสัมพันธ์",
        primarySource: "Source5_ ความรักและความสัมพันธ์",
        supportingSources: ["คู่สมพงษ์(ความรัก)"],
        reasoningFocus: "ฐานคู่ครอง หลักวัน และดาวคู่ครองแยกตามเพศ",
      },
    ],
  },
  {
    id: "allies_and_rivals",
    sequence: 8,
    thaiLabel: "เพื่อนแท้/ศัตรู",
    chunkGroup: "relationships",
    annotationDimension: "pillar_relations",
    engineDependencies: ["peer_star", "clash_matrix", "punishment_matrix", "twelve_qi_profile"],
    sinsaeLogicRules: [
      "ดูเพื่อนและคู่แข่งจากดาวพวกเดียวกันประกบกับสภาพชงเฮ้งไห่ผั่ว",
      "ถ้า peer เด่นแต่โดนชงแรง ต้องอธิบายว่ามีทั้งแรงช่วยและแรงแย่ง",
      "ใช้ 12 เชี่ยงแซช่วยบอกว่าความสัมพันธ์ไปทางร่วมมือหรือกัดกัน",
    ],
    sourceRefs: [
      {
        directoryLabel: "ตารางชงเฮ้งไห่ผั่ว",
        primarySource: "ตารางชงเฮ้งไห่ผั่ว",
        supportingSources: ["ระบบ 12 เชี่ยงแซ"],
        reasoningFocus: "จุดชงทำลายและแรงเพื่อนร่วมรุ่น",
      },
    ],
  },
  {
    id: "partnerships",
    sequence: 9,
    thaiLabel: "หุ้นส่วน",
    chunkGroup: "relationships",
    annotationDimension: "career_potential",
    engineDependencies: ["day_branch_relations", "peer_star", "wealth_star", "combination_matrix"],
    sinsaeLogicRules: [
      "หุ้นส่วนให้อ่านคล้ายคู่ครองแต่ย้ายบริบทไปความร่วมมือทางงาน",
      "ถ้า day branch รับฮะกับดาวงานหรือดาวทรัพย์ ให้มองเป็นโอกาสจับมือ",
      "ถ้า peer แข็งแต่ไม่มีกติกาคุม ต้องเตือนเรื่องการแย่งอำนาจในหุ้นส่วน",
    ],
    sourceRefs: [
      {
        directoryLabel: "ความรักและความสัมพันธ์",
        primarySource: "ความรักและความสัมพันธ์",
        supportingSources: ["คุ่สมพงษ์(การงาน)"],
        reasoningFocus: "ความสัมพันธ์เชิงคู่ร่วมงานและหุ้นส่วน",
      },
    ],
  },
  {
    id: "solo_vs_teamwork",
    sequence: 10,
    thaiLabel: "ทำคนเดียวดีหรือทีม",
    chunkGroup: "life_path",
    annotationDimension: "core_prediction",
    engineDependencies: ["day_master_strength", "peer_star", "output_star", "resource_star"],
    sinsaeLogicRules: [
      "ถ้าดิถีแข็งและ peer หนาแน่น ให้ระวังการชนอัตตาในงานทีม",
      "ถ้าดิถีอ่อนแต่ resource ดี มักทำงานทีมแล้วไปได้ไกลกว่าเดี่ยว",
      "อย่าสรุปจาก personality อย่างเดียว ต้องยึด strength เป็นตัวชี้ขาด",
    ],
    sourceRefs: [
      {
        directoryLabel: "การงานและธุรกิจ",
        primarySource: "Stepพิจารณาดวง",
        supportingSources: [],
        reasoningFocus: "พิจารณาความแข็งอ่อนของดิถีเพื่อเลือกรูปแบบการทำงาน",
      },
    ],
  },
  {
    id: "subordinates",
    sequence: 11,
    thaiLabel: "บริวาร",
    chunkGroup: "relationships",
    annotationDimension: "pillar_relations",
    engineDependencies: ["hour_branch_relations", "output_star", "clash_matrix", "harm_matrix"],
    sinsaeLogicRules: [
      "บริวารให้ดูหลักยามและความสัมพันธ์ที่มากระทบหลักยาม",
      "ถ้า Output เด่นแต่หลักยามเสีย ต้องเตือนเรื่องคนทำงานตามไม่ทัน",
      "ถ้ามีภาคีหรือฮะมาช่วยหลักยาม ให้สะท้อนเป็นทีมงานช่วยเสริมงาน",
    ],
    sourceRefs: [
      {
        directoryLabel: "ตารางชงเฮ้งไห่ผั่ว",
        primarySource: "ตารางชงเฮ้งไห่ผั่ว",
        supportingSources: ["ชงเฮ้งไห่ผั่วภาคี(เนื้อหา).docx.md"],
        reasoningFocus: "ความสัมพันธ์ที่กระทบหลักยามและคนใต้บังคับบัญชา",
      },
    ],
  },
  {
    id: "study_path",
    sequence: 12,
    thaiLabel: "การเรียน",
    chunkGroup: "life_path",
    annotationDimension: "actionable_advice",
    engineDependencies: ["resource_star", "output_star", "day_master_strength", "favorable_elements"],
    sinsaeLogicRules: [
      "การเรียนให้ดู resource ว่ารับความรู้เข้าได้ดีแค่ไหน",
      "ถ้า output แข็งแต่ resource บาง ให้เน้นการเรียนจากการลงมือทำ",
      "แนะนำทิศทางการเรียนจากธาตุเกื้อหนุน ไม่ใช่แค่จากอาชีพที่เหมาะ",
    ],
    sourceRefs: [
      {
        directoryLabel: "การงานและธุรกิจ",
        primarySource: "การงานและธุรกิจ",
        supportingSources: ["ลักษณะ ของ ดิถี 10"],
        reasoningFocus: "แรงถ่ายเท พลังรับความรู้ และธาตุปรับดวง",
      },
    ],
  },
  {
    id: "major_luck_cycles",
    sequence: 13,
    thaiLabel: "ช่วงอายุ (วัยจร)",
    chunkGroup: "life_path",
    annotationDimension: "major_luck_cycles",
    engineDependencies: ["dayun_cycles", "twelve_qi_profile", "pillar_relations", "combination_matrix", "clash_matrix"],
    sinsaeLogicRules: [
      "วัยจรต้องอ่านจาก DaYun เป็นแกนและผูกกับโครงสร้างกำเนิด",
      "แต่ละช่วงอายุต้องระบุว่าดาวไหนเด่นขึ้นหรือถูกกระทบจากชงฮะ",
      "ห้ามทำนายวัยจรแบบลอยๆ โดยไม่อิง relation กับดวงเดิม",
    ],
    sourceRefs: [
      {
        directoryLabel: "การทายวัยจร",
        primarySource: "การทายวัยจร",
        supportingSources: ["สูตรคำนวณวัยจรลัคนา"],
        reasoningFocus: "ความเป็นไปของชีวิตรายทศวรรษ",
      },
    ],
  },
  {
    id: "health_risks",
    sequence: 14,
    thaiLabel: "สุขภาพ",
    chunkGroup: "misc",
    annotationDimension: "health_overview",
    engineDependencies: ["health_signals", "element_balance", "clash_matrix", "harm_matrix", "punishment_matrix"],
    sinsaeLogicRules: [
      "สุขภาพเริ่มจากธาตุขาดเกินก่อน แล้วค่อยดูตำแหน่งที่โดนชงหรือเจาะ",
      "ต้องแยกความเสี่ยงพื้นฐานออกจากเหตุการณ์เฉียบพลันที่มาจากปฏิกิริยา",
      "ห้ามสรุปโรคเฉพาะเจาะจงเกินฐานข้อมูลของดวง",
    ],
    sourceRefs: [
      {
        directoryLabel: "สุขภาพ(พื้นฐาน)",
        primarySource: "Source3_ สุขภาพ(พื้นฐาน)",
        supportingSources: [],
        reasoningFocus: "ธาตุขาดหายและแรงกระแทกต่อแต่ละตำแหน่ง",
      },
    ],
  },
  {
    id: "fortune_enhancement",
    sequence: 15,
    thaiLabel: "การเสริมดวง",
    chunkGroup: "misc",
    annotationDimension: "balance_element",
    engineDependencies: ["useful_god", "favorable_elements", "unfavorable_elements", "day_master_strength", "element_balance"],
    sinsaeLogicRules: [
      "การเสริมดวงต้องยึด Useful God เป็นแกน ไม่ใช่เลือกธาตุจากความชอบ",
      "ถ้าดวงแข็งให้เน้นธาตุระบาย ถ้าดวงอ่อนให้เน้นธาตุหนุน",
      "ทุกคำแนะนำต้องอธิบายว่ากำลังแก้สมดุลตรงไหนของดวง",
    ],
    sourceRefs: [
      {
        directoryLabel: "การเสริมดวง",
        primarySource: "Source7_ การเสริมดวง",
        supportingSources: ["อธิบายวงจรธาตุ"],
        reasoningFocus: "หา Useful God และวิธีคืนสมดุลดวง",
      },
    ],
  },
] satisfies readonly BaziTopicDefinitionDraft[];

export const BAZI_TOPIC_REGISTRY = TOPIC_REGISTRY_DRAFT.map((entry) =>
  BaziTopicDefinitionSchema.parse(entry),
);

export const BAZI_TOPIC_REGISTRY_BY_ID = Object.freeze(
  Object.fromEntries(BAZI_TOPIC_REGISTRY.map((topic) => [topic.id, topic])) as Record<
    BaziTopicDefinition["id"],
    BaziTopicDefinition
  >,
);

export function getBaziTopicDefinition(topicId: BaziTopicDefinition["id"]) {
  return BAZI_TOPIC_REGISTRY_BY_ID[topicId];
}
