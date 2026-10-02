import type { Drug, Finding, InteractionRule, Patient, ScannedPack } from './types'

/**
 * Deterministic clinical rules on structured data. These decide the colour.
 * Nothing downstream (including the AI alert ranker) can remove or lower
 * what they find.
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
  const where = patient.source === 'kkjh' ? 'بطاقة الحاج الصحية (KKJH)' : 'السجل الصحي'
  return patient.allergies
    .filter((a) => drug.families.includes(a.family))
    .map((a) => ({
      id: `allergy:${a.family}`,
      kind: 'allergy' as const,
      severity: 'critical' as const,
      title: `حساسية مسجلة — ${familyLabel(a.family)}`,
      detail: `${drug.nameAr} من عائلة ${familyLabel(a.family)}. التفاعل المسجل في ${where}: ${a.reaction}.`,
    }))
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
      severity: major ? 'warning' : 'info',
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
      severity: 'warning',
      title: 'يُفضّل تجنبه مع قصور الكلى',
      detail: `${rule.avoidReason ?? 'قد يضعف وظائف الكلى.'} ${reading}.`,
    })
  }

  if (rule.adjustBelow !== undefined) {
    if (egfr < rule.adjustBelow) {
      findings.push({
        id: `renal:adjust:${drug.id}`,
        kind: 'renal-adjust',
        severity: 'warning',
        title: 'يتطلب تعديل الجرعة كلوياً',
        detail: `الجرعة الموصوفة ${drug.standardDose} ← المقترحة ${rule.adjustedDose}. ${reading}.`,
      })
    } else if (egfr < rule.adjustBelow + NEAR_THRESHOLD_MARGIN) {
      findings.push({
        id: `renal:near:${drug.id}`,
        kind: 'renal-near-threshold',
        severity: 'info',
        title: 'وظائف الكلى قريبة من حد التعديل',
        detail: `لا يلزم تعديل الآن (الحد ${rule.adjustBelow}). ${reading}.`,
      })
    }
  }

  return findings
}

/**
 * The drug's dose depends on kidney function but there is no eGFR on record.
 * It interrupts (orange) only when there is a reason to suspect weak kidneys:
 * recorded kidney disease or age 65+. Otherwise it is deferred, so a routine
 * pilgrim does not trigger an orange screen for every renally-cleared drug.
 */
function renalUnknown(patient: Patient, drug: Drug): Finding {
  const ckd = patient.conditions.includes('ckd')
  const elderly = patient.age >= 65
  const why = ckd ? 'الملف يذكر مرض كلى مزمن.' : elderly ? 'العمر 65 أو أكثر يرفع احتمال ضعف الكلى، خصوصاً مع حرارة المشاعر.' : ''
  return {
    id: `renal:unknown:${drug.id}`,
    kind: 'renal-unknown',
    severity: ckd || elderly ? 'warning' : 'info',
    title: 'لا توجد قراءة كلى (eGFR)',
    detail: `جرعة ${drug.nameAr} تعتمد على وظائف الكلى، ولا توجد قراءة eGFR في ملف الحاج. ${why} اطلبي تحليل كلى عاجل.`.replace(
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
    title: 'تذكير روتيني',
    detail: note,
  }))
}

/**
 * Wrong-patient check (one of the five rights). A pharmacy label dispensed for
 * another patient was scanned at this pilgrim's bedside: the packs got mixed.
 * Orange: the nurse cannot continue without a documented reason.
 */
export function checkDispensedFor(patient: Patient, drug: Drug, pack: ScannedPack | undefined): Finding[] {
  const owner = pack?.dispensedFor
  if (!owner || owner.patientId === patient.id) return []
  return [
    {
      id: `wrong-patient:${owner.orderNo}`,
      kind: 'wrong-patient',
      severity: 'warning',
      title: 'العبوة مصروفة لحاج آخر',
      detail: `عبوة ${drug.nameAr} هذه صرفتها الصيدلية للحاج ${owner.patientName} (${owner.bed}) بوصفة ${owner.prescriber}، طلب ${owner.orderNo}. يبدو أنها اختلطت بأدوية حاج آخر. أعيديها، ولا تعطي إلا عبوة مصروفة لهذا الحاج.`,
    },
  ]
}
