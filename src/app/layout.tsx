import type { Metadata } from 'next'
// Шрифтът е в самия проект (@fontsource) — build-ът вече не тегли нищо от Google Fonts
import '@fontsource/montserrat/300.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
// Деловоден шрифт за менюто (сайдбара)
import '@fontsource/roboto-condensed/300.css'
import '@fontsource/roboto-condensed/400.css'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'

export const metadata: Metadata = {
  title: 'Единна информационна система — ЦСОП Варна',
  description: 'Единна информационна система за управление на ЕПЛР и деловодство в ЦСОП Варна',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body style={{ fontFamily: "'Montserrat', system-ui, sans-serif" }}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
