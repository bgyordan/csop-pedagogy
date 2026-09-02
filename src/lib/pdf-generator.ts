import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Зарежда шрифт с кирилица (Roboto) от public/fonts
async function loadCyrillicFont(doc: jsPDF): Promise<boolean> {
  try {
    const res = await fetch('/fonts/Roboto-Regular.ttf')
    if (!res.ok) return false
    const buf = await res.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buf)
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
    }
    doc.addFileToVFS('Roboto-Regular.ttf', btoa(binary))
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    try {
      const resB = await fetch('/fonts/Roboto-Bold.ttf')
      if (resB.ok) {
        const bufB = await resB.arrayBuffer()
        let binB = ''
        const bytesB = new Uint8Array(bufB)
        for (let i = 0; i < bytesB.length; i += chunk) {
          binB += String.fromCharCode.apply(null, Array.from(bytesB.subarray(i, i + chunk)))
        }
        doc.addFileToVFS('Roboto-Bold.ttf', btoa(binB))
        doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
      }
    } catch {}
    return true
  } catch {
    return false
  }
}

// Зарежда логото от public като base64 (за jsPDF addImage)
async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch('/csop-varna-logo.jpg')
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buf)
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
    }
    return 'data:image/jpeg;base64,' + btoa(binary)
  } catch {
    return null
  }
}

interface DistRow {
  name: string
  className: string
  classTeacher?: string
  psychologist: string
  speechTherapist: string
  rehabilitator: string
  sendingSchoolName: string
  educationForm: string
  isNew?: boolean
}

const NAVY: [number, number, number] = [15, 34, 64]
const SLATE: [number, number, number] = [100, 116, 139]

export async function generateDistributionPDF(rows: DistRow[], yearName: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const hasFont = await loadCyrillicFont(doc)
  const FONT = hasFont ? 'Roboto' : 'helvetica'
  const logo = await loadLogo()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const today = new Date().toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // ── Бланка (letterhead): лого вляво + текст на ЦСОП ──
  let headerBottom = 16
  if (logo) {
    try { doc.addImage(logo, 'JPEG', 14, 8, 16, 16) } catch {}
  }
  const textX = logo ? 33 : 14
  doc.setFont(FONT, 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('Център за специална образователна подкрепа – гр. Варна', textX, 14)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...SLATE)
  doc.text('бул. „Петко Стайнов" №7, e-mail: info-400052@edu.mon.bg, тел. 0888 490 771', textX, 19.5)

  // Разделителна линия под бланката
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.4)
  doc.line(14, 26, pageW - 14, 26)

  // Заглавие на документа
  doc.setFont(FONT, 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...NAVY)
  doc.text('Разпределение на учениците', pageW / 2, 34, { align: 'center' })
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SLATE)
  doc.text(`Учебна ${yearName} г.`, pageW / 2, 39.5, { align: 'center' })

  // ── Таблица ──
  const head = [['№', 'Име', 'Пар.', 'Класен', 'Психолог', 'Логопед', 'Рехабилитатор', 'Изпращащо училище', 'Форма']]
  const body = rows.map((r, i) => [
    String(i + 1),
    r.name + (r.isNew ? '  •нов' : ''),
    r.className,
    r.classTeacher || '—',
    r.psychologist,
    r.speechTherapist,
    r.rehabilitator,
    r.sendingSchoolName,
    r.educationForm === 'ifo' ? 'ИФО' : 'Дневна',
  ])

  autoTable(doc, {
    head,
    body,
    startY: 44,
    margin: { left: 14, right: 14 },
    styles: {
      font: FONT, fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59],
      lineColor: [203, 213, 225], lineWidth: 0.1,
    },
    headStyles: {
      font: FONT, fontStyle: 'bold', fillColor: [237, 242, 247], textColor: NAVY,
      fontSize: 7.5, cellPadding: 2.2, lineColor: [203, 213, 225], lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center', textColor: SLATE },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 34 },
      4: { cellWidth: 34 },
      5: { cellWidth: 34 },
      6: { cellWidth: 34 },
      7: { cellWidth: 'auto' },
      8: { cellWidth: 17, halign: 'center' },
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages()
      doc.setFont(FONT, 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...SLATE)
      doc.text(`Генерирано на ${today}`, 14, pageH - 8)
      doc.text(`Общо ученици: ${rows.length}`, pageW / 2, pageH - 8, { align: 'center' })
      doc.text(`Страница ${data.pageNumber} от ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' })
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.2)
      doc.line(14, pageH - 12, pageW - 14, pageH - 12)
    },
  })

  doc.save(`Разпределение_${yearName.replace('/', '-')}.pdf`)
}


interface IntensityRow {
  name: string
  sendingSchoolName: string
  externalClass: string
  className: string
  intensity: string
  psy: string
  log: string
  reh: string
}

export async function generateIntensityPDF(rows: IntensityRow[], yearName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const hasFont = await loadCyrillicFont(doc)
  const FONT = hasFont ? 'Roboto' : 'helvetica'
  const logo = await loadLogo()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const today = new Date().toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // ── Бланка: лого вляво + центриран текст ──
  if (logo) {
    try { doc.addImage(logo, 'JPEG', 14, 8, 16, 16) } catch {}
  }
  doc.setFont(FONT, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text('Център за специална образователна подкрепа – гр. Варна', pageW / 2, 13, { align: 'center' })
  doc.setFont(FONT, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...SLATE)
  doc.text('бул. „Петко Стайнов" №7, e-mail: info-400052@edu.mon.bg, тел. 0888 490 771', pageW / 2, 18, { align: 'center' })

  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.4)
  doc.line(14, 26, pageW - 14, 26)

  // Заглавие
  doc.setFont(FONT, 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('Терапевтична натовареност по деца', pageW / 2, 34, { align: 'center' })
  doc.setFont(FONT, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...SLATE)
  doc.text(`Учебна ${yearName} г. · инициали × брой сесии седмично`, pageW / 2, 39, { align: 'center' })

  // ── Таблица с групиране по паралелки ──
  const body: any[] = []
  let lastClass = ''
  rows.forEach((r) => {
    if (r.className !== lastClass) {
      lastClass = r.className
      body.push([{ content: `Паралелка ${r.className}`, colSpan: 7, styles: { fillColor: [237, 242, 247], textColor: NAVY, fontStyle: 'bold', halign: 'left', fontSize: 8 } }])
    }
    body.push([
      r.name,
      r.sendingSchoolName,
      r.externalClass || '—',
      r.intensity ? (/^\d+$/.test(r.intensity) ? r.intensity + ' ч.' : r.intensity) : '—',
      r.psy || '—',
      r.log || '—',
      r.reh || '—',
    ])
  })

  autoTable(doc, {
    head: [['Име', 'Изпращащо училище', 'Клас', 'Интензитет', 'П', 'Л', 'Р']],
    body,
    startY: 44,
    margin: { left: 14, right: 14 },
    styles: { font: FONT, fontSize: 7.5, cellPadding: 1.8, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.1 },
    headStyles: { font: FONT, fontStyle: 'bold', fillColor: [241, 245, 249], textColor: NAVY, fontSize: 7.5, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 18, halign: 'center' },
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages()
      doc.setFont(FONT, 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...SLATE)
      doc.text(`Генерирано на ${today}`, 14, pageH - 8)
      doc.text(`Страница ${data.pageNumber} от ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' })
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.2)
      doc.line(14, pageH - 12, pageW - 14, pageH - 12)
    },
  })

  doc.save(`Терапии_по_деца_${yearName.replace('/', '-')}.pdf`)
}
// ═══ СПИСЪК ЗА ТЕРАПИЯ (за печат, носи се на директора) ═══
export interface TherapyListRow {
  name: string
  className: string
  externalClass: string
}
export async function generateTherapyListPDF(rows: TherapyListRow[], roleLabel: string, term: number, yearName: string, teacherName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const hasFont = await loadCyrillicFont(doc)
  const FONT = hasFont ? 'Roboto' : 'helvetica'
  const logo = await loadLogo()
  const pageW = doc.internal.pageSize.getWidth()

  if (logo) { try { doc.addImage(logo, 'JPEG', 14, 8, 16, 16) } catch {} }
  doc.setFont(FONT, 'bold'); doc.setFontSize(11); doc.setTextColor(...NAVY)
  doc.text('Център за специална образователна подкрепа – гр. Варна', pageW / 2, 13, { align: 'center' })
  doc.setFont(FONT, 'normal'); doc.setFontSize(8); doc.setTextColor(...SLATE)
  doc.text('бул. „Петко Стайнов" №7, e-mail: info-400052@edu.mon.bg, тел. 0888 490 771', pageW / 2, 18, { align: 'center' })
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.4); doc.line(14, 26, pageW - 14, 26)

  doc.setFont(FONT, 'bold'); doc.setFontSize(13); doc.setTextColor(...NAVY)
  doc.text('С П И С Ъ К', pageW / 2, 35, { align: 'center' })
  doc.setFont(FONT, 'normal'); doc.setFontSize(9.5); doc.setTextColor(...SLATE)
  const termWord = term === 1 ? 'първи' : 'втори'
  doc.text(`на учениците, включени в графика за терапия при ${teacherName}, ${roleLabel.toLowerCase()},`, pageW / 2, 41, { align: 'center' })
  doc.text(`за ${termWord} срок на учебната ${yearName} г.`, pageW / 2, 46, { align: 'center' })

  const body = rows.map((r, i) => [String(i + 1), r.name, r.className || '—', r.externalClass || '—'])
  autoTable(doc, {
    head: [['№', 'Име, презиме, фамилия', 'Паралелка', 'Клас']],
    body,
    startY: 52,
    styles: { font: FONT, fontSize: 9, cellPadding: 2, textColor: SLATE, lineColor: [210, 215, 222], lineWidth: 0.1 },
    headStyles: { font: FONT, fontStyle: 'bold', fillColor: [237, 242, 247], textColor: NAVY, fontSize: 9, halign: 'left' },
    columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 2: { cellWidth: 28, halign: 'center' }, 3: { cellWidth: 24, halign: 'center' } },
    alternateRowStyles: { fillColor: [246, 248, 250] },
    margin: { left: 14, right: 14 },
  })

  const endY = (doc as any).lastAutoTable.finalY + 14
  doc.setFont(FONT, 'normal'); doc.setFontSize(9); doc.setTextColor(...SLATE)
  doc.text(`Общо: ${rows.length} деца`, 14, endY)
  doc.text(`Изготвил: ${teacherName}`, pageW - 14, endY, { align: 'right' })
 
  doc.save(`Списък_терапия_${yearName.replace('/', '-')}.pdf`)
}
// ═══ УЧЕНИЦИ ПО УЧИЛИЩА (справка PDF) ═══
export interface BySchoolStudent { name: string; className: string; classTeacher: string }
export interface BySchoolGroup { school: string; externalClass: string; students: BySchoolStudent[] }
export async function generateStudentsBySchoolPDF(groups: BySchoolGroup[], yearName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const hasFont = await loadCyrillicFont(doc)
  const FONT = hasFont ? 'Roboto' : 'helvetica'
  const logo = await loadLogo()
  const pageW = doc.internal.pageSize.getWidth()

  if (logo) { try { doc.addImage(logo, 'JPEG', 14, 8, 16, 16) } catch {} }
  doc.setFont(FONT, 'bold'); doc.setFontSize(11); doc.setTextColor(...NAVY)
  doc.text('Център за специална образователна подкрепа – гр. Варна', pageW / 2, 13, { align: 'center' })
  doc.setFont(FONT, 'normal'); doc.setFontSize(8); doc.setTextColor(...SLATE)
  doc.text('бул. „Петко Стайнов" №7, e-mail: info-400052@edu.mon.bg, тел. 0888 490 771', pageW / 2, 18, { align: 'center' })
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.4); doc.line(14, 26, pageW - 14, 26)

  doc.setFont(FONT, 'bold'); doc.setFontSize(13); doc.setTextColor(...NAVY)
  doc.text('Ученици по изпращащи училища', pageW / 2, 35, { align: 'center' })
  doc.setFont(FONT, 'normal'); doc.setFontSize(9); doc.setTextColor(...SLATE)
  doc.text(`Учебна ${yearName} г.`, pageW / 2, 41, { align: 'center' })

  const body: any[] = []
  groups.forEach(g => {
    body.push([{ content: `${g.school}  —  ${g.externalClass} клас`, colSpan: 3, styles: { fillColor: [237, 242, 247], textColor: NAVY, fontStyle: 'bold', halign: 'left', fontSize: 9 } }])
    g.students.forEach(s => body.push([s.name, s.className || '—', s.classTeacher || '—']))
  })
  autoTable(doc, {
    head: [['Ученик', 'Паралелка', 'Класен ръководител']],
    body,
    startY: 47,
    styles: { font: FONT, fontSize: 9, cellPadding: 1.8, textColor: SLATE, lineColor: [210,215,222], lineWidth: 0.1 },
    headStyles: { font: FONT, fontStyle: 'bold', fillColor: [237, 242, 247], textColor: NAVY, fontSize: 9, halign: 'left' },
    columnStyles: { 1: { cellWidth: 30, halign: 'center' }, 2: { cellWidth: 55 } },
    margin: { left: 14, right: 14 },
  })
  doc.save(`Ученици_по_училища_${yearName.replace('/', '-')}.pdf`)
}
