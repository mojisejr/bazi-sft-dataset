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
      "output_star",
    ],
    sinsaeLogicRules: [
      "ดูธาตุถ่ายเท (Output) เป็นหลักเพื่อดูการแสดงออก",
      "ดูราศีบนหลักวัน (Day Master) เป็นแกนเสริมเพื่อดูคาแรคเตอร์ที่คนอื่นมองเห็น",
      "นำ 12 เซียงแซมาขยายความนิสัยพฤติกรรม (เช่น กินเร็ว เจ้าระเบียบ ฯลฯ)",
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
      "อ้างอิงจากความแข็ง-อ่อนของดิถีเป็นหลัก",
      "หากดวงอ่อนให้แนะนำธาตุส่งเสริม (Input/Resource) หรือธาตุคู่ (Peer)",
      "จับคู่ Keyword อาชีพตามธาตุที่เป็นประโยชน์",
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
      "ดูธาตุโชคลาภ (Wealth) ในดวงว่ามีกี่ตัวและประจำอยู่ตำแหน่งไหน",
      "อธิบายแหล่งที่มาของเงินตามตำแหน่ง (เช่น หลักเดือน = ธุรกิจในพื้นที่, หลักปี = ออนไลน์หรือต่างประเทศ)",
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
    engineDependencies: ["resource_star", "peer_star", "combination_matrix", "hidden_stems", "month_branch_relations"],
    sinsaeLogicRules: [
      "ดูธาตุส่งเสริม (Input/Resource) และธาตุคู่ (Peer)",
      "หากไม่มีในราศีบน ให้เจาะเข้าไปดูที่ราศีแฝงเสมอ",
      "ทำนายลักษณะการช่วยเหลือว่ามาแบบใด (เช่น ช่วยลับๆ หรือเราต้องให้ก่อน)",
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
      "ดูที่ตัวถ่ายเท (Output) ที่ดีและมีกำลังจาก 12 เซียงแซ",
      "อธิบายความสามารถพิเศษที่เจ้าตัวทำได้ง่ายและเร็วกว่าคนอื่น",
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
    engineDependencies: ["month_branch_relations", "twelve_qi_profile", "pillar_relations", "clash_matrix", "harm_matrix"],
    sinsaeLogicRules: [
      "ให้โฟกัสวิเคราะห์ความสัมพันธ์กับหลักเดือนเป็นหลัก",
      "ใช้ 12 เซียงแซในการบอกสถานะและลักษณะแวดล้อมครอบครัว",
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
      "โฟกัสที่ราศีล่างหลักวัน (ฐานคู่ครอง)",
      "แยกเพศในการพิจารณาชัดเจน (ชายดูธาตุลาภ Wealth, หญิงดูธาตุอำนาจ Power)",
      "ดูแรงสัมพันธ์ว่าส่งเสริมกันหรือผลัก/ขัดแย้งกัน",
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
    engineDependencies: ["peer_star", "twelve_qi_profile", "clash_matrix", "punishment_matrix"],
    sinsaeLogicRules: [
      "ใช้ 12 เซียงแซช่วยเช็กคุณภาพของบรรดาธาตุในทุกตำแหน่ง",
      "ตำแหน่งที่เซียงแซดีคือมิตร ตำแหน่งที่เซียงแซเสียหรือโดนชงคือศัตรู/ขัดแย้ง",
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
    engineDependencies: ["day_branch_relations", "twelve_qi_profile", "peer_star", "wealth_star", "combination_matrix"],
    sinsaeLogicRules: [
      "โฟกัสที่ราศีล่างหลักวัน แล้วนำมาเทียบกับ 12 เซียงแซ",
      "ถ้าผลลัพธ์ดี แปลว่าการมีหุ้นส่วนจะช่วยส่งเสริมและเข้ากันได้ดี",
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
      "ใช้ความแข็ง-อ่อนของดิถีเจาะเป็นประเด็นหลัก",
      "ดวงอ่อนควรมีผู้ใหญ่หรือเพื่อนช่วยทำเป็นทีมถึงจะดันเป้าหมายได้",
      "ดวงแข็งมีศักยภาพในการลุยเดี่ยว รับแรงกดดันคนเดียวได้ดีกว่า",
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
    engineDependencies: ["hour_branch_relations", "twelve_qi_profile", "output_star", "clash_matrix", "harm_matrix"],
    sinsaeLogicRules: [
      "โฟกัสการพิจารณาตำแหน่งที่หลักยาม (ครอบคลุมลูกจ้างหรือบุตร)",
      "ดูคุณภาพธาตุในหลักยามประกอบกับเซียงแซ (เช่น หมกยก หมายถึงสร้างปัญหาต้องตามแก้)",
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
    engineDependencies: ["resource_star", "output_star", "useful_god", "day_master_strength", "favorable_elements"],
    sinsaeLogicRules: [
      "เน้นดูที่ตัวถ่ายเท (Output) และพิจารณาธาตุที่มาช่วยแก้ดวง (Useful God)",
      "แนะนำสาขาวิชาหรือแขนงความรู้ตามธาตุสำคัญเพื่อมาช่วยปรับสมดุลดวง",
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
      "ใช้ข้อมูลวัยจร (10-Year Luck Cycle)",
      "อธิบายเล่าเรื่องหรือพยากรณ์บรรยากาศในแต่ละช่วงอายุเสมือนเป็น Chapter ของชีวิต",
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
      "นับแต้มธาตุเป็นหลัก ธาตุไหนน้อยหรือขาดหาย อวัยวะส่วนนั้นจะอ่อนแอ",
      "ตรวจสอบตําแหน่งที่รับผลกระทบถูก 'ชง' หรือ 'เจาะ' ผสมด้วย (เช่น หลักยามโดนเจาะ = ปัญหาที่ช่วงล่างหรือขา)",
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
    engineDependencies: ["useful_god", "twelve_qi_profile", "favorable_elements", "unfavorable_elements", "day_master_strength", "element_balance"],
    sinsaeLogicRules: [
      "หาธาตุที่มาเป็น Master Key (Useful God) ขนานแท้ในการแก้ดวง",
      "เอา Useful God นั้นไปประกบทดสอบกับดวงทั้ง 8 ตัวแล้วต้องทำ 12 เซียงแซได้ค่าที่ดีที่สุด (ห้ามเกิดตัวเสีย)",
      "แนะนำสิ่งของ สี ทิศ องค์เทพเจ้าให้สอดคล้องเจาะจงกับธาตุสำคัญ",
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
