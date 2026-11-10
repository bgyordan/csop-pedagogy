// Описание на системата като приложение — за „Инсталирай“ в Chrome/Edge и „Добави към началния екран“ на телефон.
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ЕИС — ЦСОП Варна',
    short_name: 'ЕИС ЦСОП',
    description: 'Единна информационна система на ЦСОП Варна',
    lang: 'bg',
    id: '/',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icons/eis-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/eis-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/eis-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Табло', url: '/dashboard' },
      { name: 'Календар', url: '/calendar' },
      { name: 'Моят профил', url: '/profile' },
    ],
  }
}
