import { pictoUrl } from '@/lib/pictos'
import type { Item } from './lib'

// Картинката на една дума от речника: снимка (ако има) или пиктограма
export default function ItemPic({ item, className = 'w-12 h-12' }: { item: Pick<Item, 'photo' | 'picto_key' | 'label'>; className?: string }) {
  if (item.photo) return <img src={item.photo} alt={item.label} className={`${className} object-cover rounded-xl`} />
  if (item.picto_key) return <img src={pictoUrl(item.picto_key)} alt={item.label} className={className} />
  return <div className={`${className} rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs`}>{item.label.slice(0, 2)}</div>
}
