import { redirect } from 'next/navigation'

// „Проверка лекторски“ е слята в „Отчитане лекторски“ (там са и ставките) — старите линкове водят натам
export default function LecturerReviewPage() {
  redirect('/lecturer-check')
}
