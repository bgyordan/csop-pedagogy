// Замествания: заместват и се заместват САМО учители и възпитатели
// (графикът на специалистите — логопед, психолог, рехабилитатор — се отлага, не се замества)
export const SUBSTITUTION_ROLES = ['class_teacher', 'teacher', 'educator']
export const canSubstitute = (role?: string | null) => SUBSTITUTION_ROLES.includes(role || '')

// Педагогически специалисти (ЗПУО, чл. 211) — за колоната „непедагогически“ в МОН отчета.
// Рехабилитаторите (медицински, ерготерапевт), помощник на учителя и помощният персонал НЕ са.
export const PEDAGOGICAL_ROLES = ['class_teacher', 'teacher', 'educator', 'speech_therapist', 'psychologist', 'zdud', 'director', 'admin']
export const isPedagogical = (role?: string | null) => PEDAGOGICAL_ROLES.includes(role || '')
