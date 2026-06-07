'use client'

import { useState } from 'react'
import { Plus, Inbox, ClipboardList, FileSignature } from 'lucide-react'
import NewCorrespondenceForm from '@/app/(dashboard)/correspondence/NewCorrespondenceForm'
import NewOrderForm from '@/app/(dashboard)/orders/NewOrderForm'
import NewContractForm from '@/app/(dashboard)/contracts/NewContractForm'
import { useRouter } from 'next/navigation'

interface NomenclatureItem {
  id: string; section_code: string; item_code: string; name: string; retention_years: string
}

interface Props {
  currentUserId: string
  students: { id: string; first_name: string; last_name: string }[]
  staff: { id: string; first_name: string; last_name: string }[]
  nomenclature: NomenclatureItem[]
  totalCorr: number
}

export default function SecretaryDashboardClient({ currentUserId, students, staff, nomenclature, totalCorr }: Props) {
  const router = useRouter()
  const [openModal, setOpenModal] = useState<'corr' | 'order' | 'contract' | null>(null)

  return (
    <>
      {/* Бързи действия */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => setOpenModal('corr')}
          className="flex items-center justify-center gap-2 p-3 bg-[#0f2240] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity shadow-md">
          <Plus size={14} /><Inbox size={14} /> Нова кореспонденция
        </button>
        <button onClick={() => setOpenModal('order')}
          className="flex items-center justify-center gap-2 p-3 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors">
          <Plus size={14} /><ClipboardList size={14} /> Нова заповед
        </button>
        <button onClick={() => setOpenModal('contract')}
          className="flex items-center justify-center gap-2 p-3 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors">
          <Plus size={14} /><FileSignature size={14} /> Нов договор
        </button>
      </div>

      {openModal === 'corr' && (
        <NewCorrespondenceForm
          totalCount={totalCorr}
          currentUserId={currentUserId}
          students={students}
          staff={staff}
          nomenclature={nomenclature}
          onClose={() => setOpenModal(null)}
          onSaved={() => { setOpenModal(null); router.refresh() }}
        />
      )}
      {openModal === 'order' && (
        <NewOrderForm
          currentUserId={currentUserId}
          students={students}
          nomenclature={nomenclature.filter(n => ['РД', 'УВД', 'ФСД', 'ЛС', 'БУТ'].includes(n.section_code))}
          onClose={() => setOpenModal(null)}
          onSaved={() => { setOpenModal(null); router.refresh() }}
        />
      )}
      {openModal === 'contract' && (
        <NewContractForm
          currentUserId={currentUserId}
          onClose={() => setOpenModal(null)}
          onSaved={() => { setOpenModal(null); router.refresh() }}
        />
      )}
    </>
  )
}
