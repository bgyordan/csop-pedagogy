import type { Metadata } from 'next'
// Шрифтът е в самия проект (@fontsource) — build-ът вече не тегли нищо от Google Fonts
import '@fontsource/montserrat/300.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
// Inter — основният шрифт (най-четим в таблици и регистри, еднакво широки цифри)
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
// Roboto Condensed — деловодният шрифт на менюто (сайдбара)
import '@fontsource/roboto-condensed/300.css'
import '@fontsource/roboto-condensed/400.css'
import '@fontsource/roboto-condensed/500.css'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import ImpersonationBar from '@/components/ImpersonationBar'

export const metadata: Metadata = {
  title: 'Единна информационна система — ЦСОП Варна',
  description: 'Единна информационна система за управление на ЕПЛР и деловодство в ЦСОП Варна',
}

// Шрифт на цялата система. За връщане към стария: APP_FONT = "'Montserrat', system-ui, sans-serif"
const APP_FONT = "'Inter', 'Montserrat', system-ui, sans-serif"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body style={{ fontFamily: APP_FONT }}>
        <ToastProvider>
          {children}
          <ImpersonationBar />
        </ToastProvider>
      </body>
    </html>
  )
}
