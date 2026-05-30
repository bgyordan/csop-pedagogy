# ЦСОП Варна — Педагогическа система

Next.js 15 + Supabase + Tailwind CSS

## Стек

- **Next.js 15** (App Router)
- **Supabase** (PostgreSQL + Auth + RLS)
- **Tailwind CSS**
- **docx** — генериране на Word документи
- **xlsx** — генериране на Excel (отсъствия)
- Google OAuth (само @csop-varna.bg акаунти)

## Стартиране

### 1. Supabase

1. Създай нов проект в [supabase.com](https://supabase.com)
2. Изпълни SQL миграцията от `supabase/migrations/001_initial_schema.sql`
3. В Supabase → Authentication → Providers → Google — активирай Google OAuth
4. Добави `https://YOUR_DOMAIN/auth/callback` в Redirect URLs

### 2. Локална среда

```bash
cp .env.local.example .env.local
# Попълни NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 3. Vercel Deploy

```bash
# Push в GitHub
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USER/csop-pedagogy.git
git push -u origin main
```

После свържи repo-то с Vercel и добави environment variables.

### 4. Първи admin

След deploy, в Supabase → Table Editor → `staff_profiles`:
- Добави ред с `user_id` на твоя Google акаунт
- Постави `role = 'admin'`

## Структура

```
src/
├── app/
│   ├── auth/          # Login + OAuth callback
│   ├── dashboard/     # Начало + sidebar layout
│   ├── students/      # Ученици + детайл + ЕПЛР
│   ├── documents/     # Редактор на документи
│   ├── absences/      # Месечни отсъствия
│   ├── committees/    # Комисии
│   ├── staff/         # Профили на служителите
│   └── admin/         # Администрация
├── components/
│   └── layout/        # Sidebar
├── lib/
│   ├── supabase/      # Client + Server helpers
│   ├── docx-generator.ts   # Word генератор
│   ├── excel-generator.ts  # Excel генератор
│   └── utils.ts
└── types/             # TypeScript типове
```

## Роли и достъп

| Роля | Ученици | Документи | Отсъствия |
|------|---------|-----------|-----------|
| Admin | Всички | Всички | Всички |
| Директор | Всички (чете) | Всички (чете) | Всички (чете) |
| ЗДУД | Всички | Всички | Всички |
| Психолог | Само от ЕПЛР | Само от ЕПЛР | — |
| Логопед | Само от ЕПЛР | Само от ЕПЛР | — |
| Рехабилитатор | Само от ЕПЛР | Само от ЕПЛР | — |
| Класен р-л | Само паралелката | Само паралелката | Своята паралелка |
