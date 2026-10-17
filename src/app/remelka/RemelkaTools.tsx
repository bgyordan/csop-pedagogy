'use client'
// Бутоните горе в „РЕМЕЛКА“: наръчникът (за всички) и каталогът с уменията (координатори и ръководство).

import { useState } from 'react'
import { BookOpen, ListTree } from 'lucide-react'
import Guide from '../students/[id]/remelka/Guide'
import CatalogEditor from './CatalogEditor'

export default function RemelkaTools({ canEditCatalog }: { canEditCatalog: boolean }) {
  const [open, setOpen] = useState<'' | 'guide' | 'catalog'>('')
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
  return (
    <>
      <button type="button" onClick={() => setOpen('guide')} className={btn}><BookOpen size={14} /> Наръчник</button>
      {canEditCatalog && <button type="button" onClick={() => setOpen('catalog')} className={btn}><ListTree size={14} /> Каталог</button>}
      {open === 'guide' && <Guide onClose={() => setOpen('')} />}
      {open === 'catalog' && <CatalogEditor onClose={() => setOpen('')} />}
    </>
  )
}
