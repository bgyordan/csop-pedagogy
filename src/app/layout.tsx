import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'

const montserrat = Montserrat({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: 'Единна информационна система — ЦСОП Варна',
  description: 'Единна информационна система за управление на ЕПЛР и деловодство в ЦСОП Варна',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body className={montserrat.className}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
