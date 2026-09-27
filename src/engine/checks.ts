import type { Drug, Finding, InteractionRule, Patient, ScannedPack } from './types'

/**
 * Deterministic clinical rules. These are the safety floor of the system:
 * nothing downstream (ranking model or AI) can remove what they find.
 */

const FAMILY_LABEL_AR: Record<string, string> = {
  penicillin: 'البنسلين',
  cephalosporin: 'السيفالوسبورين',
  nsaid: 'مضادات الالتهاب غير الستيرويدية',
  sulfonamide: 'السلفا',
}

export const familyLabel = (family: string) => FAMILY_LABEL_AR[family] ?? family

/** eGFR within this margin above a threshold raises a quiet heads-up. */
const NEAR_THRESHOLD_MARGIN = 10

export function checkAllergy(patient: Patient, drug: Drug): Finding[] {
  return patient.allergies
    .filter((a) => drug.families.includes(a.family))
    .map((a) => {
      const card = a.source === 'hajj-card'
      return {
        id: `allergy:${a.family}`,
        kind: 'allergy' as const,
        severity: 'critical' as const,
        source: 'rule' as const,
        title: card
          ? `حساسية مصرّح بها في بطاقة الحاج — ${familyLabel(a.family)}`
          : `حساسية موثقة — ${familyLabel(a.family)}`,
        detail: card
          ? `${drug.nameAr} من عائلة ${familyLabel(a.family)}. صرّح الحاج في بطاقته بـ: ${a.reaction}. لم تُوثَّق بعد في ملف المستشفى، لكنها تمنع الإعطاء حتى يراجعها الطبيب.`
          : `${drug.nameAr} من عائلة ${familyLabel(a.family)}. التفاعل المسجل: ${a.reaction}.`,
      }
    })
}

export function checkInteractions(
  patient: Patient,
  drug: Drug,
  rules: InteractionRule[],
  drugName: (id: string) => string,
): Finding[] {
  const findings: Finding[] = []
  for (const med of patient.currentMeds) {
    if (med === drug.id) continue
    const rule = rules.find(
      (r) => (r.a === drug.id && r.b === med) || (r.b === drug.id && r.a === med),
    )
    if (!rule) continue
    const major = rule.grade === 'major'
    findings.push({
      id: `interaction:${drug.id}:${med}`,
      kind: 'interaction',
      severity: major ? 'interaction' : 'info',
      source: 'rule',
      title: major
        ? `تعارض دوائي مع ${drugName(med)}`
        : `تفاعل بسيط مع ${drugName(med)}`,
      detail: rule.effect,
    })
  }
  return findings
}

export function checkRenal(patient: Patient, drug: Drug): Finding[] {
  const rule = drug.renal
  if (!rule) return []
  if (!patient.egfr) return [renalUnknown(patient, drug)]
  const egfr = patient.egfr.value
  const reading = `آخر eGFR: ${egfr} مل/د (${patient.egfr.source})`

  if (rule.contraindicatedBelow !== undefined && egfr < rule.contraindicatedBelow) {
    return [
      {
        id: `renal:contraindicated:${drug.id}`,
        kind: 'renal-contraindicated',
        severity: 'critical',
        source: 'rule',
        title: 'ممنوع مع وظائف الكلى الحالية',
        detail: `${drug.nameAr} لا يُعطى عند eGFR أقل من ${rule.contraindicatedBelow}. ${reading}.`,
      },
    ]
  }

  const findings: Finding[] = []

  if (rule.avoidBelow !== undefined && egfr < rule.avoidBelow) {
    findings.push({
      id: `renal:avoid:${drug.id}`,
      kind: 'renal-avoid',
      severity: 'renal',
      source: 'rule',
      title: 'يُفضّل تجنبه مع قصور الكلى',
      detail: `${rule.avoidReason ?? 'قد يضعف وظائف الكلى.'} ${reading}.`,
    })
  }

  if (rule.adjustBelow !== undefined) {
    if (egfr < rule.adjustBelow) {
      findings.push({
        id: `renal:adjust:${drug.id}`,
        kind: 'renal-adjust',
        severity: 'renal',
        source: 'rule',
        title: 'يتطلب تعديل الجرعة كلوياً',
        detail: `الجرعة الموصوفة ${drug.standardDose} ← المقترحة ${rule.adjustedDose}. ${reading}.`,
      })
    } else if (egfr < rule.adjustBelow + NEAR_THRESHOLD_MARGIN) {
      findings.push({
        id: `renal:near:${drug.id}`,
        kind: 'renal-near-threshold',
        severity: 'info',
        source: 'rule',
        title: 'وظائف الكلى قريبة من حد التعديل',
        detail: `لا يلزم تعديل الآن (الحد ${rule.adjustBelow}). ${reading}.`,
      })
    }
  }

  return findings
}

/**
 * The drug's dose depends on kidney function but there is no eGFR yet.
 * It interrupts (yellow) only when there is a reason to suspect weak kidneys:
 * declared kidney disease or age 65+. Otherwise it is deferred, so a routine
 * ER patient does not trigger a yellow screen for every renally-cleared drug.
 */
function renalUnknown(patient: Patient, drug: Drug): Finding {
  const ckd = patient.conditions?.includes('ckd')
  const elderly = patient.age >= 65
  const why = ckd
    ? patient.hajj
      ? 'بطاقة الحاج تذكر مرض كلى مزمن.'
      : 'المريض لديه مرض كلى مزمن.'
    : elderly
      ? 'العمر 65 أو أكثر يرفع احتمال ضعف الكلى.'
      : ''
  return {
    id: `renal:unknown:${drug.id}`,
    kind: 'renal-unknown',
    severity: ckd || elderly ? 'renal' : 'info',
    source: 'rule',
    title: 'لا يوجد تحليل كلى (eGFR)',
    detail: `جرعة ${drug.nameAr} تعتمد على وظائف الكلى، ولا يوجد eGFR لهذا المريض. ${why} اطلبي تحليل كلى عاجل.`.replace(
      /\s+/g,
      ' ',
    ),
  }
}

export function checkExpiry(pack: ScannedPack | undefined, today: string): Finding[] {
  if (!pack?.expiry || pack.expiry >= today) return []
  return [
    {
      id: 'expired',
      kind: 'expired',
      severity: 'critical',
      source: 'rule',
      title: 'العبوة منتهية الصلاحية',
      detail: `تاريخ الانتهاء المقروء من الباركود: ${pack.expiry}${pack.batch ? ` — التشغيلة ${pack.batch}` : ''}.`,
    },
  ]
}

export function routineNotes(drug: Drug): Finding[] {
  return drug.routineNotes.map((note, i) => ({
    id: `routine:${drug.id}:${i}`,
    kind: 'routine' as const,
    severity: 'info' as const,
    source: 'rule' as const,
    title: 'تذكير روتيني',
    detail: note,
  }))
}
