import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentWorkDocs from '@/app/students/[id]/StudentWorkDocs'

// „Моите документи“ — личната папка на служителя в Drive
export default async function MyFilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-medium text-[#0f2240]">Моите документи</h1>
        <p className="text-sm text-slate-500 font-light mt-1">
          Вижда ги само вие. С бутона <span className="text-sky-700">„Сподели“</span> на файла той се появява при колегите в „Споделено от колеги“.
        </p>
      </div>
      <StudentWorkDocs staff />
      <p className="mt-4 text-xs text-slate-400 font-light">
        Файловете отпреди прехвърлянето в Drive са в <Link href="/my-files/old" className="underline hover:text-slate-600">старите „Мои файлове“</Link>.
      </p>
    </div>
  )
}
