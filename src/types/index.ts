export type UserRole =
  | 'admin'
  | 'director'
  | 'zdud'
  | 'coordinator'
  | 'psychologist'
  | 'speech_therapist'
  | 'rehabilitator'
  | 'class_teacher'
  | 'secretary'

export type DocumentType =
  | 'protocol_1'
  | 'protocol_2'
  | 'protocol_3'
  | 'iup'
  | 'iu_program'
  | 'support_plan'
  | 'parent_program'

export type DocumentStatus = 'empty' | 'in_progress' | 'completed'
export type StudentStatus = 'active' | 'archived'

export interface AcademicYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  created_at: string
}

export interface Class {
  id: string
  name: string
  academic_year_id: string
  created_at: string
}

export interface StaffProfile {
  id: string
  user_id: string
  first_name: string
  middle_name?: string
  last_name: string
  role: UserRole
  position?: string
  email: string
  phone?: string
  photo_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  first_name: string
  middle_name?: string
  last_name: string
  birth_date: string
  status: StudentStatus
  archive_reason?: string
  archived_at?: string
  created_at: string
  updated_at: string
}

export interface StudentEnrollment {
  id: string
  student_id: string
  class_id: string
  academic_year_id: string
  enrolled_at: string
  left_at?: string
  student?: Student
  class?: Class
}

export interface EplrTeam {
  id: string
  student_id: string
  academic_year_id: string
  psychologist_id?: string
  speech_therapist_id?: string
  rehabilitator_id?: string
  class_teacher_id?: string
  psychologist?: StaffProfile
  speech_therapist?: StaffProfile
  rehabilitator?: StaffProfile
  class_teacher?: StaffProfile
}

export interface Document {
  id: string
  student_id: string
  academic_year_id: string
  doc_type: DocumentType
  status: DocumentStatus
  data: Record<string, unknown>
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface MonthlyAbsence {
  id: string
  class_id: string
  academic_year_id: string
  month: number
  year: number
  submitted_by?: string
  submitted_at?: string
  created_at: string
  updated_at: string
  class?: Class
  entries?: AbsenceEntry[]
}

export interface AbsenceEntry {
  id: string
  monthly_absence_id: string
  student_id: string
  subject: string
  planned_hours: number
  realized_hours: number
  reason?: string
  compensation?: string
  student?: Student
}

export interface Committee {
  id: string
  name: string
  description?: string
  created_by?: string
  created_at: string
  members?: CommitteeMember[]
}

export interface CommitteeMember {
  id: string
  committee_id: string
  staff_id: string
  role?: string
  staff?: StaffProfile
}

export interface CommitteeSession {
  id: string
  committee_id: string
  session_date: string
  agenda?: string
  protocol?: string
  decisions?: string
  deadline?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  created_by?: string
  target_roles: UserRole[]
  is_active: boolean
  created_at: string
  expires_at?: string
}

export interface CalendarDeadline {
  id: string
  academic_year_id: string
  title: string
  deadline_date: string
  doc_type?: DocumentType
  color: 'red' | 'yellow' | 'green'
  created_at: string
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  protocol_1: 'Протокол 1 — начало на годината',
  protocol_2: 'Протокол 2 — среда на годината',
  protocol_3: 'Протокол 3 — годишен',
  iup: 'ИУП — Индивидуален учебен план',
  iu_program: 'ИУПрограма — по предмети',
  support_plan: 'План за допълнителна подкрепа',
  parent_program: 'Програма за родители',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  director: 'Директор',
  zdud: 'ЗДУД',
  coordinator: 'Координатор',
  psychologist: 'Психолог',
  speech_therapist: 'Логопед',
  rehabilitator: 'Рехабилитатор',
  class_teacher: 'Класен ръководител',
  secretary: 'Секретар',
}

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  empty: 'Непопълнен',
  in_progress: 'В процес',
  completed: 'Завършен',
}
