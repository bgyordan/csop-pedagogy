'use server'
import { createClient } from '@/lib/supabase/server'

const SUPPORT_LABEL: Record<string, string> = { short: 'краткосрочна', long: 'дългосрочна' }
const SURVEY_LABEL: Record<string, string> = { completed: 'Завършена', in_progress: 'В процес' }
const STATUS_LABEL: Record<string, string> = { active: 'Активен', archived: 'Архивиран' }

function calcAge(bd?: string | null) {
  if (!bd) return ''
  const d = new Date(bd); const t = new Date()
  let a = t.getFullYear() - d.getFullYear()
  const m = t.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--
  return a >= 0 ? String(a) : ''
}

export async function getFullReport(): Promise<{ error: string } | { headers: string[]; rows: (string | number)[][] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не сте влезли' }
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director'].includes(me.role)) return { error: 'Няма достъп' }

  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  const { data: students } = await supabase.from('students')
    .select('id, first_name, middle_name, last_name, status, is_new, birth_date, external_class, intensity, sending_school:sending_schools(name, city)')
    .order('last_name')
  const ids = (students || []).map((s: any) => s.id)
  const headersOnly: string[] = []
  if (ids.length === 0) return { headers: headersOnly, rows: [] }

  const [enrRes, ctaRes, eplrRes, guardRes, coudRes, oresRes, surveyRes, docRes] = await Promise.all([
    supabase.from('student_enrollments').select('student_id, class_id, education_form, class:classes(name)').eq('academic_year_id', cy?.id),
    supabase.from('class_teacher_assignments').select('class_id, staff:staff_profiles(first_name, last_name)').eq('academic_year_id', cy?.id),
    supabase.from('eplr_teams').select('student_id, psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(first_name, last_name), speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(first_name, last_name), rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(first_name, last_name)').eq('academic_year_id', cy?.id),
    supabase.from('student_guardians').select('student_id, full_name, phone').in('student_id', ids),
    supabase.from('coud_enrollments').select('student_id, coud_group:coud_groups(name, teacher:staff_profiles(first_name, last_name))').in('student_id', ids),
    supabase.from('student_ores').select('student_id, from_date, to_date').in('student_id', ids),
    supabase.from('student_surveys').select('student_id, status').in('student_id', ids),
    supabase.from('student_documents').select('student_id, doc_type, doc_number, issued_on, valid_until, support_type, diagnosis, note').in('student_id', ids),
  ])

  const enrMap: Record<string, any> = {}; (enrRes.data || []).forEach((e: any) => { enrMap[e.student_id] = e })
  const teacherByClass: Record<string, string> = {}; (ctaRes.data || []).forEach((c: any) => { if (c.staff && !teacherByClass[c.class_id]) teacherByClass[c.class_id] = `${c.staff.first_name} ${c.staff.last_name}` })
  const eplrMap: Record<string, any> = {}; (eplrRes.data || []).forEach((e: any) => { eplrMap[e.student_id] = e })
  const guardMap: Record<string, { names: string[]; phones: string[] }> = {}
  ;(guardRes.data || []).forEach((g: any) => { const m = guardMap[g.student_id] || (guardMap[g.student_id] = { names: [], phones: [] }); if (g.full_name) m.names.push(g.full_name); if (g.phone) m.phones.push(g.phone) })
  const coudMap: Record<string, any> = {}; (coudRes.data || []).forEach((c: any) => { if (!coudMap[c.student_id]) coudMap[c.student_id] = c.coud_group })
  const today = new Date().toISOString().split('T')[0]
  const oresActive: Record<string, boolean> = {}; (oresRes.data || []).forEach((o: any) => { if (o.from_date <= today && (!o.to_date || o.to_date >= today)) oresActive[o.student_id] = true })
  const surveyMap: Record<string, string> = {}; (surveyRes.data || []).forEach((s: any) => { surveyMap[s.student_id] = s.status })
  const docMap: Record<string, Record<string, any>> = {}; (docRes.data || []).forEach((d: any) => { (docMap[d.student_id] || (docMap[d.student_id] = {}))[d.doc_type] = d })

  const nm = (p: any) => p ? `${p.first_name} ${p.last_name}` : ''

  const headers = [
    'Име', 'Статус', 'Паралелка', 'Форма', 'Възраст', 'Нов', 'Интензитет', 'ОРЕС активен', 'Анкета',
    'Изпращащо училище', 'Град', 'Клас',
    'Класен ръководител', 'Психолог', 'Логопед', 'Рехабилитатор', 'ЦОУД група', 'ЦОУД възпитател',
    'Родители', 'Телефони',
    'РЦПППО', 'РЦПППО №', 'РЦПППО дата', 'РЦПППО валиден до', 'РЦПППО вид подкрепа',
    'ТЕЛК', 'ТЕЛК №', 'ТЕЛК дата', 'ТЕЛК валиден до', 'Диагноза',
    'Алергии', 'Алергии валиден до', 'Алергии бележка',
  ]

  const rows: (string | number)[][] = (students || []).map((s: any) => {
    const e = enrMap[s.id]; const ep = eplrMap[s.id] || {}; const g = guardMap[s.id] || { names: [], phones: [] }
    const cg = coudMap[s.id]; const d = docMap[s.id] || {}; const rc = d.rcpppo; const tk = d.telk; const al = d.allergy
    const name = `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`.replace(/\s+/g, ' ').trim()
    return [
      name,
      STATUS_LABEL[s.status] || s.status || '',
      e?.class?.name || '',
      e?.education_form === 'ifo' ? 'ИФО' : (e ? 'Дневна' : ''),
      calcAge(s.birth_date),
      s.is_new ? 'Да' : 'Не',
      s.intensity || '',
      oresActive[s.id] ? 'Да' : 'Не',
      SURVEY_LABEL[surveyMap[s.id]] || 'Няма',
      s.sending_school?.name || '',
      s.sending_school?.city || '',
      s.external_class || '',
      e?.class_id ? (teacherByClass[e.class_id] || '') : '',
      nm(ep.psychologist), nm(ep.speech_therapist), nm(ep.rehabilitator),
      cg?.name || '', cg?.teacher ? nm(cg.teacher) : '',
      g.names.join('; '), g.phones.join('; '),
      rc ? 'Да' : 'Не', rc?.doc_number || '', rc?.issued_on || '', rc?.valid_until || '', SUPPORT_LABEL[rc?.support_type] || '',
      tk ? 'Да' : 'Не', tk?.doc_number || '', tk?.issued_on || '', tk?.valid_until || '', tk?.diagnosis || '',
      al ? 'Да' : 'Не', al?.valid_until || '', al?.note || '',
    ]
  })

  return { headers, rows }
}
