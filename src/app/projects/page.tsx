import { redirect } from 'next/navigation'

// „Проекти“ вече са част от „Портфолио“ (вид „Проект“)
export default function ProjectsPage() {
  redirect('/portfolio?kind=project')
}
