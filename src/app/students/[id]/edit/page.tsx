import { redirect } from 'next/navigation'

// Личните данни вече се редактират на място — досие → таб „Данни“ → „Лични данни“.
// Старият адрес пренасочва натам (за отметки и стари връзки).
export default async function EditStudentRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/students/${id}?tab=data`)
}
