import { redirect } from 'next/navigation'

// „Споделени файлове“ вече са таб в „Портфолио“
export default function SharedPage() {
  redirect('/portfolio?tab=files')
}
