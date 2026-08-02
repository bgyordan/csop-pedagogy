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
      font: FONT, fontStyle: 'bold', fillColor: NAVY, textColor: [255, 255, 255],
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
