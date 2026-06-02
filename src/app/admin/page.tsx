CREATE TABLE coordinating_team (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  role_in_team TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, academic_year_id)
);

ALTER TABLE coordinating_team ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coordinating_team_read"
ON coordinating_team FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "coordinating_team_write"
ON coordinating_team FOR ALL
TO authenticated
USING (
  get_my_role() = ANY (ARRAY['admin'::user_role, 'zdud'::user_role])
);
