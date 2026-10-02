import { useMemo, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Logo } from '../components/Logo'
import { applyTheme } from '../lib/prefs'
import { generateDemoLog } from './demoLog'
import { summarize } from './summarize'

/**
 * Safety summary for the judging table (iPad / laptop). Shown next to the app
 * on the phone: the phone shows one check, this shows what a week of checks
 * tells the hospital. Problem → what MEDGUARD changed → what the data teaches.
 */

const n = (v: number) => v.toLocaleString('en-US')

const RED_CAUSE: Record<string, string> = {
  allergy: 'حساسية مسجلة',
  renal: 'ممنوع كلوياً (eGFR منخفض)',
  expired: 'عبوة منتهية الصلاحية',
}
const ORANGE_OUTCOME: Record<string, string> = {
  'given-adjusted': 'أُعطي بعد تعديل الجرعة',
  'given-with-reason': 'أُعطي مع سبب موثق',
  escalated: 'أُحيل للطبيب',
  cancelled: 'أُلغي',
}

export default function Dashboard() {
  const s = useMemo(() => summarize(generateDemoLog()), [])
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    applyTheme(dark ? 'light' : 'dark')
    setDark(!dark)
  }

  const kkjh = s.sources.find((x) => x.source === 'kkjh')!
  const ehr = s.sources.find((x) => x.source === 'ehr')!
  const peakShare = Math.round((s.peakRed.critical / s.counts.critical) * 100)
  const topDrug = s.topDrugs[0]
  const maxDay = Math.max(...s.byDay.map((d) => d.total))

  return (
    <div className="min-h-dvh bg-canvas text-primary">
      <div className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Logo variant="full-ar" size={40} />
          <div className="me-auto border-s border-line ps-6">
            <h1 className="text-xl font-semibold">ملخص الأمان الدوائي</h1>
            <p className="text-[13px] text-secondary">طوارئ مشعر منى · أسبوع الحج 8–14 ذو الحجة</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-warning-border bg-warning-bg px-3 py-1.5 text-[12px] font-medium text-warning-fg">
            <Icon name="file" size={14} />
            بيانات افتراضية للعرض
          </span>
          <button
            onClick={toggle}
            aria-label="تبديل المظهر"
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-secondary hover:text-primary"
          >
            <Icon name="moon" size={18} />
          </button>
        </header>

        {/* Problem → solution */}
        <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_auto_1fr_1fr]">
          <Panel className="bg-surface-2">
            <Eyebrow icon="bell">المشكلة: النظام التقليدي</Eyebrow>
            <BigNumber value={n(s.popups)} unit="نافذة تنبيه" />
            <p className="mt-1 text-[14px] text-secondary">
              في أسبوع واحد · {n(s.total)} فحص · كل تنبيه يقاطع الممرضة بنافذة مستقلة
            </p>
            <p className="mt-4 border-t border-line pt-3 text-[12px] leading-5 text-tertiary">
              من الواقع: في دراسة على أنظمة BCMA أُعطي 10.3% من الأدوية بعد تجاوز تنبيه (Koppel وآخرون، JAMIA 2008).
              كثرة التنبيهات تعلّم التجاهل.
            </p>
          </Panel>

          <div className="hidden items-center justify-center text-tertiary lg:flex">
            <Icon name="chevronLeft" size={32} />
          </div>

          <Panel className="border-safe-border bg-safe-bg">
            <Eyebrow icon="shield" tone="text-safe-fg">مع MEDGUARD</Eyebrow>
            <BigNumber value={n(s.interruptions)} unit="مقاطعة فقط" tone="text-safe-fg" />
            <p className="mt-1 text-[14px] text-secondary">إشارة واحدة لكل فحص فيه خطر، والباقي في قائمة مطوية</p>
            <div className="mt-4 flex items-end gap-3 border-t border-safe-border pt-3">
              <span dir="ltr" className="text-3xl font-bold text-safe-fg">−{s.reductionPct}%</span>
              <span className="pb-1 text-[13px] text-secondary">
                مقاطعات أقل · {s.silentPct}% من الفحوصات خضراء صامتة
              </span>
            </div>
          </Panel>

          <Panel className="border-critical-border bg-critical-bg">
            <Eyebrow icon="stop" tone="text-critical-fg">جرعات خطرة أوقفت</Eyebrow>
            <BigNumber value={n(s.counts.critical)} unit="مرة" tone="text-critical-fg" />
            <p className="mt-1 text-[14px] text-secondary">الأحمر لا يُتجاوز أبداً. يُحال للطبيب لتغيير الدواء.</p>
            <ul className="mt-4 space-y-1.5 border-t border-critical-border pt-3 text-[13px]">
              {Object.entries(s.redByCause).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-3">
                  <span className="text-secondary">{RED_CAUSE[k]}</span>
                  <span className="font-semibold text-critical-fg">{v}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        {/* KPI strip */}
        <section className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon="scanBarcode" label="فحوصات عند السرير" value={n(s.total)} hint="مسح السوار أو البطاقة + الدواء" />
          <Kpi icon="activity" label="زمن الفحص الأخضر" value={`${s.decisionSec.safe} ث`} hint={`البرتقالي ${s.decisionSec.warning} ث · الأحمر ${s.decisionSec.critical} ث (الوسيط)`} />
          <Kpi icon="clipboardList" label="برتقالي موثق" value={`${s.documentedPct}%`} hint="كل استمرار بتعديل جرعة أو سبب مكتوب" />
          <Kpi icon="droplet" label="ملفات بلا قراءة كلى" value={n(ehr.egfrMissing + kkjh.egfrMissing)} hint="ظهر تنبيه واضح بدل الصمت" />
        </section>

        {/* Daily chart + orange response */}
        <section className="mt-4 grid gap-4 lg:grid-cols-12">
          <Panel className="lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">الفحوصات يومياً حسب الإشارة</h2>
              <Legend />
            </div>
            <div className="mt-5 flex h-[220px] items-end gap-3 sm:gap-5" role="img" aria-label="رسم الفحوصات اليومية">
              {s.byDay.map((d) => (
                <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[12px] font-medium text-secondary">{d.total}</span>
                  <div
                    className="flex w-full max-w-[56px] flex-col overflow-hidden rounded-sm"
                    style={{ height: `${(d.total / maxDay) * 100}%` }}
                    title={`${d.name}: ${d.critical} أحمر، ${d.warning} برتقالي، ${d.safe} أخضر`}
                  >
                    <div className="bg-critical-solid" style={{ flexGrow: d.critical, minHeight: d.critical ? 4 : 0 }} />
                    <div className="bg-warning-solid" style={{ flexGrow: d.warning }} />
                    <div className="bg-safe-solid/80" style={{ flexGrow: d.safe }} />
                  </div>
                  <div className="text-center leading-tight">
                    <div className="text-[13px] font-semibold">{d.label}</div>
                    <div className={`text-[11px] ${d.name === s.peakRed.name ? 'font-semibold text-critical-fg' : 'text-tertiary'}`}>
                      {d.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="lg:col-span-5">
            <h2 className="text-base font-semibold">ماذا فعلت الممرضة مع البرتقالي؟</h2>
            <p className="text-[13px] text-secondary">{n(s.counts.warning)} تنبيه برتقالي، لا يُكمل إلا بقرار موثق</p>
            <div className="mt-4 space-y-3">
              {Object.entries(s.orangeOutcome).map(([k, v]) => (
                <HBar key={k} label={ORANGE_OUTCOME[k]} value={v} max={s.counts.warning} tone="bg-warning-solid" />
              ))}
            </div>
            <h3 className="mt-5 border-t border-line pt-3 text-[13px] font-semibold text-secondary">أسباب الاستمرار المكتوبة</h3>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
              {Object.entries(s.reasons).map(([r, v]) => (
                <li key={r} className="flex justify-between gap-2">
                  <span className="text-secondary">{r}</span>
                  <span className="font-semibold">{v}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        {/* Drugs · sources · AI */}
        <section className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Panel>
            <h2 className="text-base font-semibold">أكثر الأدوية إثارة للتنبيه</h2>
            <table className="mt-3 w-full text-[13px]">
              <thead className="text-tertiary">
                <tr className="border-b border-line">
                  <th className="py-2 text-start font-medium">الدواء</th>
                  <th className="py-2 text-center font-medium">أحمر</th>
                  <th className="py-2 text-center font-medium">برتقالي</th>
                </tr>
              </thead>
              <tbody>
                {s.topDrugs.map((d) => (
                  <tr key={d.name} className="border-b border-line last:border-0">
                    <td className="py-2">{d.name}</td>
                    <td className="py-2 text-center font-semibold text-critical-fg">{d.critical || '—'}</td>
                    <td className="py-2 text-center font-semibold text-warning-fg">{d.warning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel>
            <h2 className="text-base font-semibold">مصدر البيانات واكتمالها</h2>
            <p className="text-[13px] text-secondary">نسبة الملفات التي تنقصها قراءة الكلى eGFR</p>
            <div className="mt-4 space-y-4">
              <SourceRow label="السجل الصحي (سعوديون ومقيمون)" checks={ehr.checks} pct={ehr.egfrMissingPct} />
              <SourceRow label="بطاقة الحاج الصحية KKJH (إندونيسيا)" checks={kkjh.checks} pct={kkjh.egfrMissingPct} />
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[12px] leading-5 text-tertiary">
              يُقرأ الملف الحرج فقط: الحساسية، الأدوية، الأمراض المزمنة، eGFR، فصيلة الدم.
            </p>
          </Panel>

          <Panel className="md:col-span-2 lg:col-span-1">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Icon name="sparkle" size={18} className="text-brand" />
              ترتيب التنبيهات بالذكاء الاصطناعي
            </h2>
            <p className="text-[13px] text-secondary">
              {n(s.ranking.rankable)} فحص فيه تنبيهان غير حرجين أو أكثر. الأحمر لا يمر على الذكاء أبداً.
            </p>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface-2">
              <div className="bg-brand" style={{ width: `${s.ranking.claudePct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[13px]">
              <span>
                <b className="text-brand">{s.ranking.claudePct}%</b> رتّبها الذكاء الاصطناعي
              </span>
              <span className="text-secondary">
                <b>{100 - s.ranking.claudePct}%</b> ترتيب ثابت (بلا شبكة أو تأخر)
              </span>
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[12px] leading-5 text-tertiary">
              في كل الحالات بقي اللون والقرار كما هما: القواعد على الجهاز تقرر، والذكاء يرتب فقط.
            </p>
          </Panel>
        </section>

        {/* Insights */}
        <section className="mt-4">
          <Panel>
            <h2 className="text-base font-semibold">ماذا تعلّمنا من البيانات؟</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Insight
                finding={`${kkjh.egfrMissingPct}% من بطاقات KKJH بلا قراءة كلى، مقابل ${ehr.egfrMissingPct}% في السجل السعودي`}
                decision="نقترح إضافة eGFR إلى فحص ما قبل السفر في بطاقة الحاج الإندونيسي"
              />
              <Insight
                finding={`يوم ${s.peakRed.name} وحده فيه ${peakShare}% من الجرعات الخطرة الموقوفة`}
                decision={`صيدلي مناوب في نقاط الطوارئ يوم ${s.peakRed.name}`}
              />
              <Insight
                finding={`${topDrug.name} أكثر دواء يثير التنبيه (${topDrug.total} مرة)، أغلبها تعارض مع مميعات الدم أو ضعف الكلى`}
                decision="مراجعة بروتوكول المسكنات في الحج: باراسيتامول خيار أول"
              />
            </div>
            <p className="mt-4 text-[12px] leading-5 text-tertiary">
              الأرقام من سجل افتراضي لأسبوع حج ({n(s.total)} فحص) مولّد للعرض. الحسابات نفسها تُطبَّق على سجل التدقيق في
              التشغيل الفعلي.
            </p>
          </Panel>
        </section>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- pieces */

function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-lg border border-line bg-surface p-5 ${className}`}>{children}</div>
}

function Eyebrow({ icon, tone = 'text-secondary', children }: { icon: IconName; tone?: string; children: ReactNode }) {
  return (
    <p className={`flex items-center gap-2 text-[13px] font-semibold ${tone}`}>
      <Icon name={icon} size={16} />
      {children}
    </p>
  )
}

function BigNumber({ value, unit, tone = 'text-primary' }: { value: string; unit: string; tone?: string }) {
  return (
    <p className="mt-3 flex items-baseline gap-2">
      <span className={`text-5xl font-bold tracking-tight ${tone}`}>{value}</span>
      <span className="text-base font-medium text-secondary">{unit}</span>
    </p>
  )
}

function Kpi({ icon, label, value, hint }: { icon: IconName; label: string; value: string; hint: string }) {
  return (
    <Panel className="p-4">
      <p className="flex items-center gap-2 text-[13px] text-secondary">
        <Icon name={icon} size={16} className="text-brand" />
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-[12px] text-tertiary">{hint}</p>
    </Panel>
  )
}

function HBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px]">
        <span>{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  )
}

function SourceRow({ label, checks, pct }: { label: string; checks: number; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3 text-[13px]">
        <span>{label}</span>
        <span className="shrink-0 text-tertiary">{n(checks)} فحص</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-warning-solid" style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-end text-[13px] font-semibold text-warning-fg">{pct}%</span>
      </div>
    </div>
  )
}

function Insight({ finding, decision }: { finding: string; decision: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-2 p-4">
      <p className="text-[12px] font-semibold text-tertiary">البيانات تقول</p>
      <p className="mt-1 text-[14px] leading-6">{finding}</p>
      <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-[14px] font-medium leading-6 text-brand">
        <Icon name="chevronLeft" size={18} className="mt-0.5 shrink-0" />
        {decision}
      </p>
    </div>
  )
}

function Legend() {
  const item = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${cls}`} />
      {label}
    </span>
  )
  return (
    <div className="flex gap-4 text-[12px] text-secondary">
      {item('bg-critical-solid', 'أحمر')}
      {item('bg-warning-solid', 'برتقالي')}
      {item('bg-safe-solid/80', 'أخضر')}
    </div>
  )
}
