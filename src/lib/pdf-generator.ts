import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Зарежда шрифт с кирилица (Roboto) от public/fonts и го регистрира в jsPDF
async function loadCyrillicFont(doc: jsPDF): Promise<boolean> {
  try {
    const res = await fetch('/fonts/Roboto-Regular.ttf')
    if (!res.ok) return false
    const buf = await res.arrayBuffer()
    // ArrayBuffer → base64
    let binary = ''
    const bytes = new Uint8Array(buf)
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
    }
    const base64 = btoa(binary)
    doc.addFileToVFS('Roboto-Regular.ttf', base64)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')

    // Bold (ако има)
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

interface DistRow {
  name: string
  className: string
  psychologist: string
  speechTherapist: string
  rehabilitator: string
  sendingSchoolName: string
  educationForm: string
  isNew?: boolean
}

const NAVY: [number, number, number] = [15, 34, 64]        // #0f2240
const NAVY_LIGHT: [number, number, number] = [30, 64, 112]
const SLATE: [number, number, number] = [100, 116, 139]

export async function generateDistributionPDF(rows: DistRow[], yearName: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const hasFont = await loadCyrillicFont(doc)
  const FONT = hasFont ? 'Roboto' : 'helvetica'
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const today = new Date().toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // ── Шапка ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageW, 26, 'F')
  doc.setFont(FONT, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.text('ЦСОП – Варна', 14, 12)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(200, 215, 235)
  doc.text('Център за специална образователна подкрепа', 14, 18)
  doc.text('ул. „Петко Стайнов" № 7, гр. Варна', 14, 22.5)

  // Заглавие вдясно
  doc.setFont(FONT, 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text('Разпределение на учениците', pageW - 14, 13, { align: 'right' })
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(200, 215, 235)
  doc.text(`Учебна ${yearName} г.`, pageW - 14, 19, { align: 'right' })

  // ── Таблица ──
  const head = [['№', 'Име', 'Пар.', 'Психолог', 'Логопед', 'Рехабилитатор', 'Изпращащо училище', 'Форма']]
  const body = rows.map((r, i) => [
    String(i + 1),
    r.name + (r.isNew ? '  •нов' : ''),
    r.className,
    r.psychologist,
    r.speechTherapist,
    r.rehabilitator,
    r.sendingSchoolName,
    r.educationForm === 'ifo' ? 'ИФО' : 'Дневна',
  ])

  autoTable(doc, {
    head,
    body,
    startY: 32,
    margin: { left: 14, right: 14 },
    styles: {
      font: FONT, fontSize: 8, cellPadding: 2.2, textColor: [30, 41, 59],
      lineColor: [226, 232, 240], lineWidth: 0.1,
    },
    headStyles: {
      font: FONT, fontStyle: 'bold', fillColor: NAVY, textColor: [255, 255, 255],
      fontSize: 8, cellPadding: 2.5,
    },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', textColor: SLATE },
      1: { cellWidth: 48, fontStyle: 'bold' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 40 },
      4: { cellWidth: 40 },
      5: { cellWidth: 40 },
      6: { cellWidth: 'auto' },
      7: { cellWidth: 18, halign: 'center' },
    },
    didDrawPage: (data) => {
      // Footer на всяка страница
      const pageCount = doc.getNumberOfPages()
      const pageCurrent = data.pageNumber
      doc.setFont(FONT, 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...SLATE)
      doc.text(`Генерирано на ${today}`, 14, pageH - 8)
      doc.text(`Общо ученици: ${rows.length}`, pageW / 2, pageH - 8, { align: 'center' })
      doc.text(`Страница ${pageCurrent} от ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' })
      // тънка линия над footer
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.2)
      doc.line(14, pageH - 12, pageW - 14, pageH - 12)
    },
  })

  doc.save(`Разпределение_${yearName.replace('/', '-')}.pdf`)
}
