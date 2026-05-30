-- ============================================================
-- ЦСОП Варна — Педагогическа система
-- Migration 001: Initial Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'admin',
  'director',
  'zdud',
  'psychologist',
  'speech_therapist',
  'rehabilitator',
  'class_teacher'
);

CREATE TYPE document_type AS ENUM (
  'protocol_1',
  'protocol_2',
  'protocol_3',
  'iup',
  'iu_program',
  'support_plan',
  'parent_program'
);

CREATE TYPE document_status AS ENUM (
  'empty',
  'in_progress',
  'completed'
);

CREATE TYPE student_status AS ENUM (
  'active',
  'archived'
);

-- ============================================================
-- ACADEMIC YEARS
-- ============================================================

CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- e.g. "2024-2025"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one current year at a time
CREATE UNIQUE INDEX idx_one_current_year ON academic_years (is_current) WHERE is_current = true;

-- ============================================================
-- CLASSES (ПАРАЛЕЛКИ)
-- ============================================================

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- e.g. "1А", "3Б"
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, academic_year_id)
);

-- ============================================================
-- STAFF PROFILES
-- ============================================================

CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  role user_role NOT NULL,
  position TEXT, -- длъжност (свободен текст)
  email TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STUDENTS (УЧЕНИЦИ)
-- ============================================================

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  status student_status DEFAULT 'active',
  archive_reason TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student enrollment per academic year + class
CREATE TABLE student_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE(student_id, academic_year_id)
);

-- ============================================================
-- ЕПЛР — ЕКИП ПО ПЛАН ЗА ЛИЧНОСТНО РАЗВИТИЕ
-- ============================================================

CREATE TABLE eplr_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  psychologist_id UUID REFERENCES staff_profiles(id),
  speech_therapist_id UUID REFERENCES staff_profiles(id),
  rehabilitator_id UUID REFERENCES staff_profiles(id),
  class_teacher_id UUID REFERENCES staff_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, academic_year_id)
);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  doc_type document_type NOT NULL,
  status document_status DEFAULT 'empty',
  data JSONB DEFAULT '{}', -- all field values stored here
  created_by UUID REFERENCES staff_profiles(id),
  updated_by UUID REFERENCES staff_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, academic_year_id, doc_type)
);

-- Document field edits log
CREATE TABLE document_edits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  editor_id UUID REFERENCES staff_profiles(id),
  field_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edited_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MONTHLY ABSENCES (МЕСЕЧНИ ОТСЪСТВИЯ)
-- ============================================================

CREATE TABLE monthly_absences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  submitted_by UUID REFERENCES staff_profiles(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, month, year)
);

CREATE TABLE absence_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  monthly_absence_id UUID REFERENCES monthly_absences(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL, -- предмет/терапия
  planned_hours INT DEFAULT 0,
  realized_hours INT DEFAULT 0,
  reason TEXT,
  compensation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMITTEES (КОМИСИИ)
-- ============================================================

CREATE TABLE committees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES staff_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE committee_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
  role TEXT, -- напр. "Председател", "Секретар"
  UNIQUE(committee_id, staff_id)
);

CREATE TABLE committee_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  agenda TEXT,
  protocol TEXT,
  decisions TEXT,
  deadline DATE,
  created_by UUID REFERENCES staff_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES / ANNOUNCEMENTS
-- ============================================================

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES staff_profiles(id),
  target_roles user_role[] DEFAULT '{}', -- empty = всички
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ============================================================
-- CALENDAR DEADLINES
-- ============================================================

CREATE TABLE calendar_deadlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  deadline_date DATE NOT NULL,
  doc_type document_type,
  color TEXT DEFAULT 'yellow', -- 'red' | 'yellow' | 'green'
  created_by UUID REFERENCES staff_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON staff_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_eplr_updated_at BEFORE UPDATE ON eplr_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_absences_updated_at BEFORE UPDATE ON monthly_absences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE eplr_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM staff_profiles WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: get current user's staff_profile id
CREATE OR REPLACE FUNCTION get_my_staff_id()
RETURNS UUID AS $$
  SELECT id FROM staff_profiles WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- ---- ACADEMIC YEARS: everyone can read ----
CREATE POLICY "academic_years_read" ON academic_years FOR SELECT USING (true);
CREATE POLICY "academic_years_admin" ON academic_years FOR ALL USING (get_my_role() IN ('admin'));

-- ---- CLASSES: everyone can read ----
CREATE POLICY "classes_read" ON classes FOR SELECT USING (true);
CREATE POLICY "classes_admin" ON classes FOR ALL USING (get_my_role() IN ('admin', 'zdud'));

-- ---- STAFF PROFILES ----
CREATE POLICY "staff_read_all" ON staff_profiles FOR SELECT USING (true);
CREATE POLICY "staff_self_update" ON staff_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "staff_admin_all" ON staff_profiles FOR ALL USING (get_my_role() = 'admin');

-- ---- STUDENTS ----
-- Admin, Director, ZDUD see all
CREATE POLICY "students_admin_director_zdud" ON students FOR SELECT
  USING (get_my_role() IN ('admin', 'director', 'zdud'));

-- Specialists see only their EPLR students
CREATE POLICY "students_psychologist" ON students FOR SELECT
  USING (
    get_my_role() = 'psychologist' AND
    EXISTS (
      SELECT 1 FROM eplr_teams
      WHERE student_id = students.id
      AND psychologist_id = get_my_staff_id()
    )
  );

CREATE POLICY "students_speech_therapist" ON students FOR SELECT
  USING (
    get_my_role() = 'speech_therapist' AND
    EXISTS (
      SELECT 1 FROM eplr_teams
      WHERE student_id = students.id
      AND speech_therapist_id = get_my_staff_id()
    )
  );

CREATE POLICY "students_rehabilitator" ON students FOR SELECT
  USING (
    get_my_role() = 'rehabilitator' AND
    EXISTS (
      SELECT 1 FROM eplr_teams
      WHERE student_id = students.id
      AND rehabilitator_id = get_my_staff_id()
    )
  );

-- Class teacher sees their class
CREATE POLICY "students_class_teacher" ON students FOR SELECT
  USING (
    get_my_role() = 'class_teacher' AND
    EXISTS (
      SELECT 1 FROM student_enrollments se
      JOIN classes c ON c.id = se.class_id
      JOIN eplr_teams et ON et.student_id = students.id
      WHERE et.class_teacher_id = get_my_staff_id()
      AND se.student_id = students.id
    )
  );

CREATE POLICY "students_write" ON students FOR ALL
  USING (get_my_role() IN ('admin', 'zdud'));

-- ---- EPLR TEAMS ----
CREATE POLICY "eplr_read_admin_zdud_director" ON eplr_teams FOR SELECT
  USING (get_my_role() IN ('admin', 'zdud', 'director'));

CREATE POLICY "eplr_read_own" ON eplr_teams FOR SELECT
  USING (
    psychologist_id = get_my_staff_id() OR
    speech_therapist_id = get_my_staff_id() OR
    rehabilitator_id = get_my_staff_id() OR
    class_teacher_id = get_my_staff_id()
  );

CREATE POLICY "eplr_write" ON eplr_teams FOR ALL
  USING (get_my_role() IN ('admin', 'zdud'));

-- ---- DOCUMENTS ----
CREATE POLICY "documents_admin_zdud_director" ON documents FOR SELECT
  USING (get_my_role() IN ('admin', 'zdud', 'director'));

CREATE POLICY "documents_specialist_read" ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM eplr_teams et
      WHERE et.student_id = documents.student_id
      AND (
        et.psychologist_id = get_my_staff_id() OR
        et.speech_therapist_id = get_my_staff_id() OR
        et.rehabilitator_id = get_my_staff_id() OR
        et.class_teacher_id = get_my_staff_id()
      )
    )
  );

CREATE POLICY "documents_specialist_update" ON documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM eplr_teams et
      WHERE et.student_id = documents.student_id
      AND (
        et.psychologist_id = get_my_staff_id() OR
        et.speech_therapist_id = get_my_staff_id() OR
        et.rehabilitator_id = get_my_staff_id() OR
        et.class_teacher_id = get_my_staff_id()
      )
    )
  );

CREATE POLICY "documents_admin_all" ON documents FOR ALL
  USING (get_my_role() IN ('admin', 'zdud'));

-- ---- MONTHLY ABSENCES ----
CREATE POLICY "absences_admin_zdud_director" ON monthly_absences FOR SELECT
  USING (get_my_role() IN ('admin', 'zdud', 'director'));

CREATE POLICY "absences_class_teacher_own" ON monthly_absences FOR ALL
  USING (
    get_my_role() = 'class_teacher' AND
    submitted_by = get_my_staff_id()
  );

CREATE POLICY "absence_entries_read" ON absence_entries FOR SELECT USING (true);
CREATE POLICY "absence_entries_write" ON absence_entries FOR ALL
  USING (get_my_role() IN ('admin', 'zdud', 'class_teacher'));

-- ---- COMMITTEES ----
CREATE POLICY "committees_read" ON committees FOR SELECT USING (true);
CREATE POLICY "committees_write" ON committees FOR ALL
  USING (get_my_role() IN ('admin', 'zdud', 'director'));

CREATE POLICY "committee_members_read" ON committee_members FOR SELECT USING (true);
CREATE POLICY "committee_members_write" ON committee_members FOR ALL
  USING (get_my_role() IN ('admin', 'zdud'));

CREATE POLICY "committee_sessions_read" ON committee_sessions FOR SELECT USING (true);
CREATE POLICY "committee_sessions_write" ON committee_sessions FOR ALL
  USING (get_my_role() IN ('admin', 'zdud', 'director'));

-- ---- ANNOUNCEMENTS ----
CREATE POLICY "announcements_read" ON announcements FOR SELECT USING (is_active = true);
CREATE POLICY "announcements_write" ON announcements FOR ALL
  USING (get_my_role() IN ('admin', 'zdud'));

-- ---- CALENDAR DEADLINES ----
CREATE POLICY "deadlines_read" ON calendar_deadlines FOR SELECT USING (true);
CREATE POLICY "deadlines_write" ON calendar_deadlines FOR ALL
  USING (get_my_role() IN ('admin', 'zdud'));

-- ---- DOCUMENT EDITS LOG ----
CREATE POLICY "edits_read_admin" ON document_edits FOR SELECT
  USING (get_my_role() IN ('admin', 'zdud', 'director'));
CREATE POLICY "edits_insert_own" ON document_edits FOR INSERT
  WITH CHECK (editor_id = get_my_staff_id());

-- ============================================================
-- SEED: Default academic year
-- ============================================================

INSERT INTO academic_years (name, start_date, end_date, is_current)
VALUES ('2025-2026', '2025-09-15', '2026-06-30', true);
