import type {
  ContextRuleNoteValue,
  ElementSeasonalSupportValue,
  ElementStrengthLevelValue,
  ElementStrengthValue,
} from "@/lib/bazi/schema-types";

const ELEMENT_STRENGTH_LABELS: Record<ElementStrengthLevelValue, string> = {
  missing: "ไร้กำลัง",
  weak: "กำลังอ่อน",
  balanced: "กำลังสมดุล",
  strong: "กำลังเด่น",
};

const ELEMENT_SEASONAL_SUPPORT_LABELS: Record<ElementSeasonalSupportValue, string> = {
  "seasonal-peak": "ฤดูหนุนสูง",
  "seasonal-support": "ฤดูหนุน",
  "seasonal-drained": "ฤดูถ่ายแรง",
};

export function getElementStrengthLabel(strength: ElementStrengthLevelValue) {
  return ELEMENT_STRENGTH_LABELS[strength];
}

export function getElementSeasonalSupportLabel(seasonalSupport: ElementSeasonalSupportValue) {
  return ELEMENT_SEASONAL_SUPPORT_LABELS[seasonalSupport];
}

export function getElementRootLabel(rooted: boolean) {
  return rooted ? "มีราก" : "ไร้ราก";
}

export function getElementStrengthBadges(strength: ElementStrengthValue) {
  return [
    getElementStrengthLabel(strength.strength),
    getElementRootLabel(strength.rooted),
    getElementSeasonalSupportLabel(strength.seasonalSupport),
  ];
}

export function renderContextRuleNoteThai(signal: ContextRuleNoteValue) {
  switch (signal.key) {
    case "NARRATIVE_SUPPORTS_BUT_NOT_OVERRIDE":
      return "คำบรรยาย 60 Jiazi ใช้ช่วยอ่านภาพรวมได้ แต่ยังไม่ลบล้างกฎจัดลำดับ interaction หลัก";
    case "PERSONA_TWELVE_QI_TONE":
      return `แหล่ง persona canonical ระบุโทน 12 เชี่ยงแซไว้ที่ ${signal.params.twelveQiLabel ?? "ไม่ทราบ"}`;
    case "SOLAR_TERM_BOUNDARY_NEAR":
      return `ดวงนี้อยู่ห่างจุดเปลี่ยน solar term ${signal.params.solarTermName ?? signal.params.label ?? "ไม่ทราบ"} ประมาณ ${signal.params.hours ?? "0.00"} ชั่วโมง (${signal.params.boundaryAt ?? "ไม่ทราบ"} HKT) ควรตรวจเคสคาบเกี่ยวด้วยมืออีกครั้ง`;
    case "ACTIVE_COMBINATION_PRECEDENCE":
      return `ฮะ ${signal.params.label ?? "ไม่ทราบ"} ทำงานก่อน และมีน้ำหนักเหนือความปะทะที่แตะกิ่งเดียวกัน`;
    case "CLASH_NEUTRALIZED_BY_COMBINATION":
      return `ชง ${signal.params.label ?? "ไม่ทราบ"} ถูกลดน้ำหนัก เพราะหนึ่งในกิ่งเข้าสู่ฮะก่อน`;
    case "ACTIVE_CLASH_OUTRANKS_PUNISHMENT":
      return `ชง ${signal.params.label ?? "ไม่ทราบ"} ยังเป็นแรงหลัก และควรให้น้ำหนักเหนือโทษ`;
    case "ACTIVE_PUNISHMENT_REMAINS":
      return `โทษ ${signal.params.label ?? "ไม่ทราบ"} ยังทำงานอยู่หลังจัดลำดับ interaction หลักแล้ว`;
    case "HARM_SUPPLEMENTARY_UNDER_HIGHER_PRECEDENCE":
      return `ความสัมพันธ์แบบ harm ${signal.params.label ?? "ไม่ทราบ"} มีอยู่ แต่ให้ถือเป็นสัญญาณเสริมเพราะมี interaction ที่แรงกว่าคุมอยู่`;
    case "HARM_ACTIVE_SECONDARY":
      return `ความสัมพันธ์แบบ harm ${signal.params.label ?? "ไม่ทราบ"} ยังทำงานเป็นสัญญาณรอง`;
    case "DESTRUCTION_SUPPLEMENTARY_UNDER_HIGHER_PRECEDENCE":
      return `ความสัมพันธ์แบบ destruction ${signal.params.label ?? "ไม่ทราบ"} มีอยู่ แต่ยังเป็นสัญญาณเสริมใต้ interaction ที่แรงกว่า`;
    case "DESTRUCTION_ACTIVE_SECONDARY":
      return `ความสัมพันธ์แบบ destruction ${signal.params.label ?? "ไม่ทราบ"} ยังทำงานเป็นสัญญาณรอง`;
    case "MONTH_BRANCH_CLASH_REDUCES_SEASONAL_SUPPORT":
      return `ชงที่แตะกิ่งเดือนทำให้น้ำหนักฤดูกาลลดลงเหลือ ${signal.params.factor ?? "1.00"} จนกว่าจะมีฮะที่แรงกว่ามาจัดลำดับใหม่`;
  }
}

export function localizeContextRuleNotes(
  signals: ContextRuleNoteValue[],
  fallbackNotes: string[] = [],
) {
  return signals.map((signal, index) => renderContextRuleNoteThai(signal) ?? fallbackNotes[index] ?? signal.key);
}