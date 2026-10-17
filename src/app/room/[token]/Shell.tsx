// Обвивката на страницата за родителя (обща за личната стая и стаята на паралелката)
import { MonitorSmartphone, Lock } from 'lucide-react'

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-widest text-slate-500 mb-4">
          <MonitorSmartphone size={15} /> ЦСОП Варна · Онлайн стая
        </div>
        {children}
      </div>
    </div>
  )
}

export function Closed() {
  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <Lock size={28} className="mx-auto mb-3 text-slate-300" />
        <p className="text-slate-700">Стаята не е активна.</p>
        <p className="text-sm text-slate-500 mt-1">Линкът е изтекъл или е грешен. Обърнете се към класния ръководител.</p>
      </div>
    </Shell>
  )
}
