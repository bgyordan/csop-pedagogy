```tsx
'use client'

import { useState } from 'react'
import NewContractForm from './NewContractForm'
import ViewContractModal from './ViewContractModal'
import EditContractModal from './EditContractModal'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import {
    Plus,
    Search,
    FileText,
    FileSignature,
    ChevronLeft,
    ChevronRight,
    Pencil
} from 'lucide-react'

function daysUntil(dateStr: string): number | null {
    if (!dateStr) return null
    return Math.ceil(
        (new Date(dateStr).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
    )
}

interface Props {
    contracts: any[]
    totalCount: number
    page: number
    pageSize: number
    searchValue: string
    canEdit: boolean
    currentUserId: string
    students: {
        id: string
        first_name: string
        last_name: string
    }[]
}

export default function ContractsClient({
    contracts,
    totalCount,
    page,
    pageSize,
    searchValue,
    canEdit,
    currentUserId,
}: Props) {

    const router = useRouter()
    const supabase = createClient()

    const [search, setSearch] = useState(searchValue)

    const [showForm, setShowForm] = useState(false)
    const [viewItem, setViewItem] = useState<any | null>(null)
    const [editItem, setEditItem] = useState<any | null>(null)

    const totalPages = Math.ceil(totalCount / pageSize)

    function handleSearch(e: React.FormEvent) {
        e.preventDefault()

        const params = new URLSearchParams()

        if (search) params.set('q', search)

        params.set('page', '1')

        router.push(`/contracts?${params.toString()}`)
    }

    function handlePageChange(newPage: number) {

        const params = new URLSearchParams()

        if (searchValue)
            params.set('q', searchValue)

        params.set('page', String(newPage))

        router.push(`/contracts?${params.toString()}`)
    }

    return (

        <div className="space-y-5 animate-in fade-in duration-300">

            <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-center">

                <div>
                    <h1 className="text-xl font-bold text-slate-800">
                        Договори
                    </h1>

                    <p className="text-sm text-slate-500">
                        Общо
                        <span className="ml-1 font-bold text-slate-800">
                            {totalCount}
                        </span>
                    </p>
                </div>

                {canEdit && (

                    <button
                        onClick={() => setShowForm(true)}
                        className="
                        flex
                        items-center
                        gap-2
                        rounded-2xl
                        px-5
                        py-2.5
                        text-white
                        font-semibold
                        shadow-lg
                        hover:shadow-xl
                        hover:scale-105
                        active:scale-95
                        transition-all
                    "
                        style={{
                            background:
                                'linear-gradient(135deg,#0f2240,#2563eb)',
                        }}
                    >
                        <Plus size={16} />

                        Нов договор
                    </button>

                )}

            </div>

            <div className="
                bg-white
                rounded-3xl
                border
                border-slate-200
                shadow-lg
                p-4
            ">

                <form
                    onSubmit={handleSearch}
                    className="flex gap-3 items-center"
                >

                    <div className="relative">

                        <Search
                            size={16}
                            className="
                            absolute
                            left-3
                            top-1/2
                            -translate-y-1/2
                            text-slate-400
                        "
                        />

                        <input
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                            placeholder="Търсене..."
                            className="
                            w-80
                            rounded-xl
                            border
                            border-slate-200
                            bg-slate-50
                            pl-10
                            py-2
                            text-sm
                            focus:ring-2
                            focus:ring-indigo-300
                            focus:bg-white
                            transition-all
                        "
                        />

                    </div>

                    <button
                        type="submit"
                        className="
                        rounded-xl
                        px-4
                        py-2
                        bg-slate-100
                        hover:bg-slate-200
                        transition
                        text-sm
                        font-semibold
                    "
                    >
                        Търси
                    </button>

                </form>

            </div>

            <div
                className="
                bg-white
                rounded-3xl
                border
                border-slate-200
                shadow-xl
                overflow-hidden
            "
            >

                <div className="overflow-x-auto">

                    <table className="w-full text-sm">

                        <thead
                            className="
                            sticky
                            top-0
                            bg-slate-100/80
                            backdrop-blur
                            border-b
                        "
                        >

                            <tr>

                                <th className="text-left px-4 py-3">
                                    №
                                </th>

                                <th className="text-left px-4 py-3">
                                    Дата
                                </th>

                                <th className="text-left px-4 py-3">
                                    Контрагент
                                </th>

                                <th className="text-left px-4 py-3">
                                    Предмет
                                </th>

                                <th className="text-left px-4 py-3">
                                    Период
                                </th>

                                <th className="text-left px-4 py-3">
                                    Файл
                                </th>

                            </tr>

                        </thead>

                        <tbody>

                            {contracts.length === 0 ? (

                                <tr>

                                    <td
                                        colSpan={6}
                                        className="py-16 text-center"
                                    >

                                        <FileSignature
                                            className="mx-auto text-slate-300 mb-3"
                                            size={40}
                                        />

                                        <p className="text-slate-400">
                                            Няма договори
                                        </p>

                                    </td>

                                </tr>

                            ) : (

                                contracts.map((item) => {

                                    const days =
                                        daysUntil(item.end_date)

                                    const expiring =
                                        days !== null &&
                                        days < 30

                                    return (

                                        <tr
                                            key={item.id}
                                            onClick={() =>
                                                setViewItem(item)
                                            }
                                            className="
                                            group
                                            cursor-pointer
                                            border-b
                                            border-slate-100
                                            hover:bg-indigo-50
                                            hover:shadow-md
                                            transition-all
                                            duration-200
                                        "
                                        >

                                            <td className="px-4 py-2">

                                                <span
                                                    className="
                                                    inline-flex
                                                    rounded-full
                                                    bg-indigo-100
                                                    text-indigo-700
                                                    px-2.5
                                                    py-1
                                                    text-[11px]
                                                    font-bold
                                                "
                                                >
                                                    {item.number}
                                                </span>

                                            </td>

                                            <td className="px-4 py-2 text-xs text-slate-500">

                                                {item.date
                                                    ? new Date(
                                                          item.date
                                                      ).toLocaleDateString(
                                                          'bg-BG'
                                                      )
                                                    : '—'}

                                            </td>

                                            <td className="px-4 py-2 font-semibold group-hover:text-indigo-700 transition">

                                                {item.counterparty}

                                            </td>

                                            <td className="px-4 py-2">

                                                <div
                                                    title={item.subject}
                                                    className="
                                                    truncate
                                                    max-w-[240px]
                                                    text-slate-700
                                                "
                                                >
                                                    {item.subject}
                                                </div>

                                            </td>

                                            <td className="px-4 py-2">

                                                <div className="flex gap-2 items-center">

                                                    {item.end_date
                                                        ? new Date(
                                                              item.end_date
                                                          ).toLocaleDateString(
                                                              'bg-BG'
                                                          )
                                                        : '—'}

                                                    {expiring && (

                                                        <span
                                                            className={`
                                                        px-2
                                                        py-0.5
                                                        rounded-full
                                                        text-[10px]
                                                        font-bold
                                                        ${
                                                            days! < 0
                                                                ? 'bg-red-100 text-red-700'
                                                                : 'bg-orange-100 text-orange-700'
                                                        }
                                                    `}
                                                        >
                                                            {days! < 0
                                                                ? 'Изтекъл'
                                                                : `${days} дни`}
                                                        </span>

                                                    )}

                                                </div>

                                            </td>

                                            <td
                                                className="px-4 py-2"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >

                                                <div className="flex gap-2">

                                                    {canEdit && (

                                                        <button
                                                            onClick={() =>
                                                                setEditItem(
                                                                    item
                                                                )
                                                            }
                                                            className="
                                                            p-2
                                                            rounded-lg
                                                            hover:bg-indigo-100
                                                            transition
                                                        "
                                                        >

                                                            <Pencil
                                                                size={15}
                                                            />

                                                        </button>

                                                    )}

                                                    {item.file_url && (

                                                        <button
                                                            onClick={async () => {

                                                                const win =
                                                                    window.open(
                                                                        '',
                                                                        '_blank'
                                                                    )

                                                                const {
                                                                    data,
                                                                } =
                                                                    await supabase.storage
                                                                        .from(
                                                                            'documents'
                                                                        )
                                                                        .createSignedUrl(
                                                                            item.file_url,
                                                                            120
                                                                        )

                                                                if (
                                                                    data?.signedUrl &&
                                                                    win
                                                                ) {
                                                                    win.location.href =
                                                                        data.signedUrl
                                                                }
                                                            }}
                                                            className="
                                                            flex
                                                            items-center
                                                            gap-1
                                                            rounded-lg
                                                            bg-red-50
                                                            px-2
                                                            py-1
                                                            text-red-600
                                                            hover:bg-red-100
                                                            transition
                                                        "
                                                        >

                                                            <FileText
                                                                size={13}
                                                            />

                                                            PDF

                                                        </button>

                                                    )}

                                                </div>

                                            </td>

                                        </tr>

                                    )

                                })

                            )}

                        </tbody>

                    </table>

                </div>

            </div>

            {totalPages > 1 && (

                <div className="flex justify-between items-center">

                    <span className="text-sm text-slate-500">

                        {page} / {totalPages}

                    </span>

                    <div className="flex gap-2">

                        <button
                            disabled={page <= 1}
                            onClick={() =>
                                handlePageChange(page - 1)
                            }
                            className="
                            rounded-xl
                            border
                            px-4
                            py-2
                            hover:shadow
                            hover:-translate-y-0.5
                            transition-all
                        "
                        >
                            <ChevronLeft size={14} />
                        </button>

                        <button
                            disabled={page >= totalPages}
                            onClick={() =>
                                handlePageChange(page + 1)
                            }
                            className="
                            rounded-xl
                            border
                            px-4
                            py-2
                            hover:shadow
                            hover:-translate-y-0.5
                            transition-all
                        "
                        >
                            <ChevronRight size={14} />
                        </button>

                    </div>

                </div>

            )}

            {viewItem && (
                <ViewContractModal
                    item={viewItem}
                    onClose={() => setViewItem(null)}
                />
            )}

            {editItem && (
                <EditContractModal
                    item={editItem}
                    onClose={() => setEditItem(null)}
                />
            )}

            {showForm && (
                <NewContractForm
                    currentUserId={currentUserId}
                    onClose={() => setShowForm(false)}
                    onSaved={() => setShowForm(false)}
                />
            )}

        </div>
    )
}
```
