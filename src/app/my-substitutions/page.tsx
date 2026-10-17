import { redirect } from 'next/navigation'

// Заместванията вече са в „Моите лекторски“ (/my-lecturer) — заедно с над норматив и бутона за декларациите.
// Старият адрес остава, за да не се чупят отметки и линкове.
export default function MySubstitutionsPage() {
  redirect('/my-lecturer')
}
