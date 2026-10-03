import type { Metadata } from 'next'
// Шрифтът е в самия проект (@fontsource) — build-ът вече не тегли нищо от Google Fonts
import '@fontsource/montserrat/300.css'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
// Roboto Condensed — деловодният шрифт (първо само в сайдбара, сега навсякъде)
import '@fontsource/roboto-condensed/300.css'
import '@fontsource/roboto-condensed/400.css'
import '@fontsource/roboto-condensed/500.css'
import '@fontsource/roboto-condensed/600.css'
import '@fontsource/roboto-condensed/700.css'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'

export const metadata: Metadata = {
  title: 'Единна информационна система — ЦСОП Варна',
  description: 'Единна информационна система за управление на ЕПЛР и деловодство в ЦСОП Варна',
}

// Шрифт на цялата система. За връщане към стария: APP_FONT = "'Montserrat', system-ui, sans-serif"
const APP_FONT = "'Roboto Condensed', 'Montserrat', system-ui, sans-serif"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body style={{ fontFamily: APP_FONT }}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
