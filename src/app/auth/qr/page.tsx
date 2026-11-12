// Страница след сканиране на QR за вход: само бутон „Влез“.
// Входът става чак при натискане (POST) — така визуализатори на връзки / прегледи в чат не „изхабяват“ еднократния код.
export const dynamic = 'force-dynamic'

export default async function QrLoginPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-[0_8px_32px_rgba(15,34,64,0.12)] overflow-hidden text-center">
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-7 py-5">
          <div className="text-[11px] uppercase tracking-widest text-white/80">ЦСОП Варна</div>
          <h1 className="text-xl mt-0.5">Вход в EIS</h1>
        </div>
        <div className="p-7">
        {t ? (
          <form action="/auth/qr/go" method="post">
            <input type="hidden" name="t" value={t} />
            <button type="submit" className="w-full py-4 rounded-2xl text-lg text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:opacity-90 active:scale-[0.99] transition">
              Влез
            </button>
            <p className="text-xs text-slate-400 mt-4">След това ще останете влезли на този телефон.</p>
          </form>
        ) : (
          <p className="text-sm text-slate-500">Кодът не е пълен. Помолете администратора за нов QR.</p>
        )}
        </div>
      </div>
    </div>
  )
}
