import { redirect } from 'next/navigation'
// „Справки“ на терапевтите вече е таб „Разпределение“ в /reports
export default function SpravkiPage() { redirect('/reports?tab=distribution') }
