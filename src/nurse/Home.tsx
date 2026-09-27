import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { Screen } from '../components/ui'
import { loadEvents } from '../lib/events'
import { useSession } from '../lib/session'
import { unlockAudio } from '../lib/sound'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'صباح الخير' : 'مساء الخير'
}

function Action({ to, icon, title, sub, primary }: { to: string; icon: IconName; title: string; sub: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      onClick={unlockAudio}
      className={`flex items-center gap-3.5 rounded-md border p-4 active:scale-[0.99] ${
        primary ? 'border-brand bg-brand text-brand-on' : 'border-line bg-surface'
      }`}
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-md ${primary ? 'bg-white/15' : 'bg-brand-subtle text-brand'}`}>
        <Icon name={icon} size={22} />
      </span>
      <span className="flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className={`block text-[13px] ${primary ? 'text-brand-on/80' : 'text-secondary'}`}>{sub}</span>
      </span>
      <Icon name="chevronLeft" size={18} className={primary ? '' : 'text-tertiary'} />
    </Link>
  )
}

export default function Home() {
  const { nurse, patient } = useSession()
  const today = new Date().toDateString()
  const todays = loadEvents().filter((e) => new Date(e.at).toDateString() === today)
  const blocked = todays.filter((e) => e.level === 'critical').length

  return (
    <Screen>
      <div className="flex flex-col gap-5 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {greeting()}، {nurse}
            </h1>
            <p className="text-[13px] text-secondary">قسم الباطنة — الطابق 3</p>
          </div>
          <Link to="/settings" aria-label="الإعدادات" className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-secondary">
            <Icon name="settings" size={18} />
          </Link>
        </div>

        <p className="flex items-center gap-2 rounded-md bg-safe-bg px-3 py-2.5 text-[12px] font-medium text-safe-fg">
          <Icon name="check" size={16} />
          الجهاز جاهز — {todays.length} فحص اليوم{blocked ? `، أُوقف ${blocked} إعطاء خطر` : ''}
        </p>

        {patient && (
          <Link to="/scan/drug" className="flex items-center gap-3 rounded-md border border-line bg-surface p-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-subtle text-brand">
              <Icon name="user" size={20} />
            </span>
            <span className="flex-1">
              <span className="block text-[12px] text-tertiary">المريض الحالي</span>
              <span className="block text-[15px] font-medium">
                {patient.name} · {patient.hajj ? 'بطاقة حاج' : `غرفة ${patient.room}`}
              </span>
            </span>
            <span className="text-[13px] font-medium text-brand">مسح دواء</span>
          </Link>
        )}

        <nav className="flex flex-col gap-3" aria-label="الإجراءات">
          <Action to="/scan/patient" icon="scanBarcode" title="بدء فحص جديد" sub="امسحي سوار المريض ثم الدواء" primary />
          <Action to="/patient" icon="clipboardList" title="ملف المريض" sub="الحساسيات، الملاحظات، وجرعات اليوم" />
          <Action to="/calculator" icon="pill" title="حاسبة الجرعة الكلوية" sub="الجرعة المناسبة حسب eGFR" />
          <Action to="/scan/hajj" icon="idCard" title="مريض حاج بدون سوار" sub="امسحي بطاقة الحاج لقراءة حساسياته وأدويته" />
        </nav>
      </div>
    </Screen>
  )
}
