-- Координаторът вижда всички ученици
CREATE POLICY "students_coordinator"
ON students FOR SELECT
TO authenticated
USING (get_my_role() = 'coordinator'::user_role);

-- Координаторът вижда всички записвания
CREATE POLICY "enrollments_coordinator"
ON student_enrollments FOR SELECT
TO authenticated
USING (get_my_role() = 'coordinator'::user_role);

-- Координаторът може да редактира eplr_teams
CREATE POLICY "eplr_teams_coordinator"
ON eplr_teams FOR ALL
TO authenticated
USING (get_my_role() = 'coordinator'::user_role)
WITH CHECK (get_my_role() = 'coordinator'::user_role);

-- Координаторът вижда документи
CREATE POLICY "documents_coordinator"
ON documents FOR SELECT
TO authenticated
USING (get_my_role() = 'coordinator'::user_role);

-- Координаторът вижда паралелки и служители
CREATE POLICY "classes_coordinator"
ON classes FOR SELECT
TO authenticated
USING (get_my_role() = 'coordinator'::user_role);

CREATE POLICY "staff_coordinator"
ON staff_profiles FOR SELECT
TO authenticated
USING (get_my_role() = 'coordinator'::user_role);
