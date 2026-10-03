// „Моето портфолио“ като Word документ — за атестацията (професионално портфолио).
// Текстът е черен, 12 pt; към всяка публикация — до 4 миниатюри.

import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'
import { kindMeta, fmtDate, fmtPeriod, STATUS, isImage } from './lib'
import type { Post } from './lib'

const F = 'Times New Roman'
const t = (text: string, o: Record<string, unknown> = {}) => new TextRun({ text, font: F, size: 24, color: '000000', ...o })

async function imageRun(url: string): Promise<ImageRun | null> {
  try {
    const blob = await (await fetch(url)).blob()
    const bmp = await createImageBitmap(blob)
    const w = 150, h = Math.round(150 * bmp.height / bmp.width)
    return new ImageRun({ data: new Uint8Array(await blob.arrayBuffer()), transformation: { width: w, height: Math.min(h, 200) }, type: 'jpg' })
  } catch { return null }
}

export async function exportPortfolio(opts: { name: string; label: string; posts: Post[]; thumbs: Record<string, string>; classNames: Record<string, string> }) {
  const { name, label, posts, thumbs, classNames } = opts
  const kids: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [t('ПРОФЕСИОНАЛНО ПОРТФОЛИО', { bold: true, size: 32 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [t(name, { bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [t(`${label ? label + ', ' : ''}ЦСОП – Варна · ${new Date().toLocaleDateString('bg-BG')}`)] }),
  ]
  const sorted = [...posts].sort((a, b) => a.kind.localeCompare(b.kind) || b.created_at.localeCompare(a.created_at))
  let lastKind = ''
  for (const p of sorted) {
    const k = kindMeta(p.kind)
    if (p.kind !== lastKind) {
      lastKind = p.kind
      kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 }, children: [t(k.plural.toUpperCase(), { bold: true, size: 28 })] }))
    }
    kids.push(new Paragraph({ spacing: { before: 240, after: 60 }, children: [t(p.title, { bold: true, size: 26 })] }))
    const meta = [
      p.event_date ? fmtDate(p.event_date) : fmtDate(p.created_at),
      p.kind === 'project' ? fmtPeriod(p.period_from, p.period_to) : '',
      p.kind === 'project' && p.status ? STATUS[p.status]?.label : '',
      p.classIds.map(id => classNames[id]).filter(Boolean).join(', '),
    ].filter(Boolean).join(' · ')
    if (meta) kids.push(new Paragraph({ spacing: { after: 120 }, children: [t(meta, { italics: true })] }))
    const blocks: [string, string | null][] = [['', p.body], ['Идеи', p.ideas], ['Дейности', p.activities], ['Цели', p.goals]]
    for (const [head, text] of blocks) {
      if (!text?.trim()) continue
      if (head) kids.push(new Paragraph({ spacing: { before: 80 }, children: [t(head + ':', { bold: true })] }))
      text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
        const clean = l.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        if (clean.startsWith('## ')) kids.push(new Paragraph({ spacing: { before: 80 }, children: [t(clean.slice(3), { bold: true })] }))
        else if (/^[-•] /.test(clean)) kids.push(new Paragraph({ bullet: { level: 0 }, children: [t(clean.slice(2))] }))
        else kids.push(new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.JUSTIFIED, children: [t(clean)] }))
      })
    }
    const imgs = p.media.filter(isImage).filter(m => m.thumb_path && thumbs[m.thumb_path]).slice(0, 4)
    const runs: (ImageRun | TextRun)[] = []
    for (const m of imgs) { const r = await imageRun(thumbs[m.thumb_path!]); if (r) { runs.push(r); runs.push(t('  ')) } }
    if (runs.length) kids.push(new Paragraph({ spacing: { before: 120, after: 120 }, children: runs }))
    const files = p.media.filter(m => !isImage(m))
    if (files.length) kids.push(new Paragraph({ children: [t('Приложения: ', { bold: true }), t(files.map(f => f.name || 'файл').join(', '))] }))
  }
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: kids }] })
  saveAs(await Packer.toBlob(doc), `Портфолио_${name.replace(/\s+/g, '_')}.docx`)
}
