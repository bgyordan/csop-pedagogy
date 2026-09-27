# Одит на ЕИС „ЦСОП Варна“ (csop-pedagogy)

> **Тип:** само анализ. В този пуск не е променен код. Единственият нов файл е `docs/AUDIT.md`.
> **Обхват:** `src/**` (≈ 260 файла, ≈ 40 000 реда), `supabase/migrations/`, `package.json`, `tsconfig.json`.
> **Метод:** четене на кода, grep по шаблони, изпълнение на `tsc --noEmit --noUnusedLocals --noUnusedParameters`
> (зависимостите са инсталирани временно, без да се пипа `package-lock.json`) и програмен модел на `canSee()` от сайдбара.
> **Не е проверявано:** live базата (RLS политики, индекси, тригери, реални данни). Всичко, което зависи от тях, е отбелязано **„за проверка“**.
> **Бизнес логиката на заповедите/декларациите** (правни основания, НП правила, чл. 162, календарна логика) **не е оценявана по същество** — само е посочено къде живее, за да не се пипа случайно.

Легенда за роли: `admin`, `director` (Директор), `zdud` (ЗДУД), `secretary`, `class_teacher` (КлР), `teacher`, `educator` (възпитател), `psychologist`, `speech_therapist`, `rehabilitator` (заедно — „терапевти“), `support`, `coordinator` (роля) и флаг `is_coordinator` (**+К**).

---

## Съдържание

1. [Карта на системата](#1-карта-на-системата)
2. [Сайдбар и менюта](#2-сайдбар-и-менюта)
3. [Дублиране](#3-дублиране)
4. [Справки и експорти](#4-справки-и-експорти)
5. [Мъртъв код](#5-мъртъв-код)
6. [Известни бъгове — проверка](#6-известни-бъгове--проверка)
7. [Последователност на данните](#7-последователност-на-данните)
8. [Силни страни — да не се пипат](#8-силни-страни--да-не-се-пипат)
9. [План за подобрение](#9-план-за-подобрение)

---

## 1. Карта на системата

### 1.0 Обща архитектура

- **Next.js 16.2.6** (App Router; README-то казва „Next 15“ — остаряло), React 19, Supabase (`@supabase/ssr`), Tailwind, `docx`, `xlsx`, `jspdf`.
- **Middleware** (`src/middleware.ts`) пуска само логнати потребители (без проверка на роля).
- **Всеки top-level маршрут има собствен `layout.tsx`**, който чете профила и рендира `<Sidebar>`. Има 36 такива layout-а — копия на 8 варианта (виж §3.1). Изключения: `/procurements` и `/profile` **нямат layout → нямат сайдбар**.
- **Проверката на роля е по страница** (`redirect('/dashboard')`). Много client-страници (`'use client'`) нямат сървърна проверка — разчитат изцяло на RLS (виж §7.4).
- **Три клиента към Supabase:** `lib/supabase/client.ts` (браузър), `server.ts` (сървър, с cookies), `admin.ts` (service-role, ползва се само в `admin/staff/actions.ts` и `my-schedule/edit/actions.ts`).
- **Генератори:** `lib/docx-generator.ts` (2538 реда), `lib/docx-substitution.ts` (786), `lib/pdf-generator.ts`, `lib/excel-generator.ts`, `lib/recurring.ts`.
- **Миграции:** в репото има само `001_initial_schema.sql` с 15 таблици. Кодът използва **≈ 70 таблици** и 10 storage bucket-а. Схемата и RLS на live базата **не са версионирани** (виж §7.1).

### 1.1 Начало, вход, профил

| Маршрут | Какво прави | Роли (страница) | Таблици |
|---|---|---|---|
| `/` | Пренасочва към `/auth/login` | всички | — |
| `/auth/login`, `/auth/callback` | Google OAuth; свързва `staff_profiles.user_id` по email; изхвърля, ако няма профил | всички | `staff_profiles` |
| `/dashboard` | Табло по роля: Admin (admin+zdud), Director, Specialist, ClassTeacher (class_teacher/teacher/educator), Secretary. **`support` и `coordinator` (роля) нямат табло** — виждат само заглавието | всички | `academic_years`, `staff_profiles`, `class_teacher_assignments` + много в компонентите |
| `/profile` | Смяна на парола (client) — **без сайдбар** | всички | `staff_profiles` |
| `/my-files` | Лични файлове, споделяне | всички (линк в долната част на сайдбара) | `staff_files`, bucket `staff-files` |
| `/shared` | Споделени от колеги файлове | всички (линк от картата SharedFiles в таблото) | `staff_files` |

### 1.2 Деловодство

| Маршрут | Какво прави | Роли | Таблици |
|---|---|---|---|
| `/correspondence` | Вх./Изх. регистър; бързи сценарии (отпуск, НП отпуск, ученик → досие); по желание създава заповед за отпуск (РД-10) и заместване | достъп: admin, zdud, director, secretary, **+К (само чете)**; редакция: admin, zdud, director, secretary | `correspondence`, `orders`, `nomenclature_items`, `student_attachments`, `student_guardians`, `substitutions`, bucket `documents` |
| `/orders` | Регистър на заповедите | admin, zdud, director, secretary | `orders`, `nomenclature_items`, bucket `documents` |
| `/contracts` | Договори (номер `ДГ-NNN/ГГГГ`) | admin, zdud, director, secretary | `contracts`, bucket `documents` |
| `/procurements` | Обществени поръчки — **без сайдбар (няма layout)** | достъп/редакция: admin, zdud, director, secretary; триене: admin, zdud | `procurements`, `procurement_files` |
| `/site-docs` | CMS за публичния сайт: документи, новини, събития, галерия, обяви за работа, абонати | admin, zdud, director, secretary | `site_documents`, `site_news`, `site_events`, `gallery_*`, `site_jobs`, `job_subscribers`, `site_settings`, buckets `public-docs`, `public-media` |
| `/normative-docs` | Нормативни документи на центъра (чете `site_documents`) | всички логнати — **няма линк никъде** | `site_documents` |
| `/admin/nomenclature` | Номенклатура на делата + „бързи индекси“ | admin, zdud | `nomenclature_items` |
| Карта „Резервирай номер“ (`dashboard/components/ReserveNumberCard.tsx`) | Резервира следващ номер Вх./Изх./Заповед | таблото на секретаря | `orders`, `correspondence` |

### 1.3 Замествания

| Маршрут | Какво прави | Роли | Таблици |
|---|---|---|---|
| `/substitutions` | Регистър на отсъствия/замествания, разпределение по дни/заместници, генериране на заповед РД-08 (Word), НП флаг | admin, zdud, director, secretary | `substitutions`, `substitution_assignments`, `orders`, `academic_calendar_days`, `class_schedules`, `schedule_slots`, `teacher_ifo_slots`, `educator_slots`, `coud_groups` |
| `/my-substitutions` | Моите замествания + месечна декларация (НП / бюджет) | всички с профил (в менюто: КлР, teacher, educator) | `substitutions` (+ actions от `/substitutions`) |
| `/mon-export` | Excel за импорт в портала на МОН (НП „Без свободен час“) | admin, zdud, director | чрез `getMonExport` в `substitutions/actions.ts` |

### 1.4 Лекторски часове

| Маршрут | Какво прави | Роли | Таблици |
|---|---|---|---|
| `/lecturer` | Определяне на лекторски слотове по учител + обща заповед (Word) | admin, zdud, director | `lecturer_slots`, `class_schedules`, `schedule_slots`, `teacher_ifo_slots`, `academic_calendar_days` |
| `/my-lecturer` | Моите лекторски слотове → декларация по дати (само учебни дни) | всички с профил (в менюто: КлР, teacher, educator) | `lecturer_slots`, `lecturer_declarations`, `academic_calendar_days` |
| `/lecturer-review` | Проверка/потвърждаване на декларациите | admin, zdud, director, secretary | `lecturer_declarations`, `lecturer_slots` |

### 1.5 Разписания

| Маршрут | Какво прави | Роли | Таблици |
|---|---|---|---|
| `/schedules` | Обзор с табове: паралелки / учители / терапевти / ИФО | admin, zdud, director | `class_schedules`, `schedule_slots`, `teacher_ifo_slots`, `therapist_*`, … |
| `/my-schedule` | Моето седмично разписание (учител/възпитател); мениджърите → `/schedules?tab=teachers` | учители, възпитатели | `schedule_slots`, `teacher_ifo_slots`, `educator_slots` |
| `/my-schedule/edit` | **Основният редактор**: учителят въвежда своите часове по паралелки и ИФО; admin/zdud — от името на друг (`?staff=`) | КлР, teacher; admin/zdud | `class_schedules`, `schedule_slots`, `teacher_ifo_slots`, `subjects` |
| `/my-ifo` | Стар редактор на ИФО часове на учителя — **няма линк** | КлР, educator, admin, zdud | `teacher_ifo_slots`, `subjects` |
| `/classes/[id]/schedule` | Стар редактор „по паралелка“ — **няма линк**; изтрива всички слотове на паралелката (виж §6.4) | admin, zdud | `class_schedules`, `schedule_slots`, `subjects` |
| `/classes/[id]/schedule-view` | Преглед + Word на разписание на паралелка | всички логнати | `class_schedules`, `schedule_slots` |
| `/students/[id]/schedule` | Преглед на ИФО разписание на ученик (само четене) | admin, zdud, director + класният и учителите с ИФО часове при детето | `teacher_ifo_slots` |
| `/my-activities/schedule` | Терапевтично разписание на специалиста; мениджърите → `/schedules?tab=therapists` | терапевти | `therapist_schedules`, `therapist_slots` |
| `/gym-schedule` | Заетост на физкултурния салон (ФВС часове) | всички логнати | `schedule_slots`, `teacher_ifo_slots`, `subjects` |
| `/duties` | График на дежурствата (Word) | достъп: admin, zdud, director, secretary; редакция: admin, zdud, secretary | `duty_slots`, `staff_profiles` |
| `/admin/coud` | ЦОУД групи + стандартно разписание на възпитател + заповед (Word) | admin, zdud, director, +К; редакция admin, zdud | `coud_groups`, `coud_enrollments`, `educator_slots` |

### 1.6 ЕПЛР, генератор, терапия, анкети

| Маршрут | Какво прави | Роли | Таблици |
|---|---|---|---|
| `/admin/eplr-assignment` | Матрица ученик × специалист (ЕПЛР екип) | admin, zdud, director, +К | `eplr_teams`, `student_enrollments`, `classes` |
| `/students/[id]/eplr` | Същият ЕПЛР екип, но за един ученик + външни членове | всички логнати (client) | `eplr_teams`, `eplr_external_members` |
| `/admin/eplr-schedule` | График на срещите на ЕПЛР + Word (по специалист/по ден) | admin, zdud, director, +К | `eplr_schedules`, `eplr_schedule_slots` |
| `/admin/therapists` | Матрица кой терапевт води детето (**`students.therapist_*`**, не `eplr_teams`) | admin, zdud, director, +К | `students` |
| `/my-activities` | „Списък за терапия“ — самозаписване на деца към себе си + PDF | терапевти | `students.therapist_*`, `therapist_*` |
| `/generator`, `/generator/[id]` | Списък „моите деца по ЕПЛР“ → документи П1/П2/П3/ПДП | учители, възпитатели, терапевти; мениджъри/+К — всички | `eplr_teams`, `documents` |
| `/documents/[studentId]/[docType]` | Редактор + Word на документ (П1…ПР) | всички логнати (client) | `documents`, `eplr_teams`, `student_guardians` |
| `/documents` | **Мъртва** — първият ред е `redirect('/templates')` | — | — |
| `/surveys` | Анкети на новите деца (списък) | терапевти, admin, zdud, director, +К | `student_surveys`, `students` |
| `/students/[id]/survey` | Попълване на анкета + Word | терапевти, admin, zdud, +К | `student_surveys`, `student_guardians` |
| `/admin/coordinating-team` | Координиращ екип: членове, заседания, протоколи (Word), документи | admin, zdud, director, +К | `coordinating_team*`, bucket `documents` |
| `/committees/*` | Комисии, членове, заседания, протокол (Word) — **няма линк в менюто** | admin, zdud, director | `committees`, `committee_members`, `committee_sessions` |
| `/bullying-council` | Координационен съвет (тормоз): членове, протоколи (Word), документи | членове на съвета + admin, zdud, director | `bullying_council_members`, `bullying_protocols`, `bullying_documents`, bucket `bullying-council` |
| `/council` | Материали „за съгласуване“ преди педагогически съвет | всички (архив — само управляващите); upload: admin, director, zdud | `council_sets`, `council_files`, bucket `council-materials` |

### 1.7 Досие на ученика

| Маршрут | Какво прави | Роли | Таблици |
|---|---|---|---|
| `/students` | Списък с филтри (форма, ОРЕС, непълни данни…) — съдържанието зависи от ролята | всички | `students`, `student_enrollments`, `eplr_teams`, `coud_*`, `student_ores`, `schedule_slots` |
| `/students/[id]` | Досие: статус, родители, прикачени (досие), ЕПЛР документи, документи (ТЕЛК/ЕР…), декларации | всички (редакция admin, zdud) | `students`, `student_guardians`, `student_attachments`, `student_documents`, `eplr_attachments`, `eplr_teams`, `student_ores`, `coud_enrollments` |
| `/students/new`, `/[id]/edit`, `/[id]/archive`, `/[id]/transfer` | CRUD ученик (client) | UI само за admin/zdud; **сървърна проверка няма** | `students`, `student_enrollments`, `sending_schools` |
| `/students/archived` | Архив | admin, zdud, director, secretary | `students` |
| `/students/documents` | Матрица „досиета“ ученик × вид документ (валидност) | admin, zdud, director, secretary; КлР — своите | `student_attachments`, bucket `student-dossiers` |
| `/absences`, `/absences/[classId]/[month]`, `/absences/export/[m]/[y]` | Реализация на ИУП по месеци + Excel | КлР (своите), admin, zdud, director | `monthly_absences`, `absence_entries` |
| `/classes`, `/classes/[id]` | Паралелки + таб „ЦОУД групи“ | мениджъри/+К — всички; останалите — само своите | `classes`, `class_teacher_assignments`, `student_enrollments`, `coud_*`, `student_attachments` |
| `/staff`, `/staff/[id]` | Служители (списък — всички логнати; детайл — admin, zdud, director) | виж колоната | `staff_profiles`, `class_teacher_assignments`, `eplr_teams`, `coud_groups` |
| `/projects` | Проекти на паралелките | КлР/учители (своите), мениджъри (всички) | `class_projects`, `class_project_classes` |

### 1.8 Файлове и образци

| Маршрут | Какво прави | Роли | Таблици |
|---|---|---|---|
| `/templates` | Образци на документи (upload/download) | всички четат; редакция admin, zdud, secretary, +К | `document_templates`, bucket `templates` |
| `/admin/schools` | Изпращащи училища + файлове към тях | UI: admin/zdud/secretary; **сървърна проверка няма** | `sending_schools`, `school_files`, bucket `school-files` |
| `/my-files`, `/shared` | Виж §1.1 | | |

### 1.9 Справки

Виж подробно в §4. Маршрути: `/reports` (Натовареност/Разпределение), `/reports/hub`, `/reports/letters`, `/reports/full`, `/reports/by-class`, `/reports/by-school`, `/reports/enrollments`, `/reports/guardians`, `/reports/traveling`, `/reports/coud` (**без линк**), `/spravki`, `/mon-export`.

### 1.10 Администрация

| Маршрут | Какво прави | Роли | Таблици |
|---|---|---|---|
| `/admin` | Хъб с плочки + срокове | admin, zdud, +К | `academic_years`, `calendar_deadlines`, `coordinating_team`, `sending_schools` |
| `/admin/years` | Паралелки и учебна година (client) | няма сървърна проверка | `academic_years`, `classes`, … |
| `/admin/subjects` | Предмети | admin, zdud | `subjects` |
| `/admin/staff` | Потребители и достъп (създава auth акаунт със service-role) | UI без проверка; action — admin, zdud | `staff_profiles`, `class_teacher_assignments` |
| `/admin/announcements` | Съобщения (client) | няма сървърна проверка | `announcements` |
| `/admin/deadlines` | Срокове в календара (client) | няма сървърна проверка | `calendar_deadlines` |
| `/admin/tasks` | Повтарящи се задачи/срокове (`lib/recurring.ts`) | четат всички; редакция admin, zdud, secretary | `recurring_tasks`, `recurring_task_completions` |
| `/admin/rollover` | Нова учебна година — прехвърляне | admin, zdud (страница); част от actions — без проверка | `students`, `student_enrollments`, `classes`, `eplr_teams`, `coud_*`, `class_teacher_assignments` |
| `/admin/nomenclature`, `/admin/coud`, `/admin/therapists`, `/admin/eplr-*`, `/admin/coordinating-team` | Виж по-горе | | |

---

## 2. Сайдбар и менюта

Източник: `src/components/layout/Sidebar.tsx` (масив `navItems`, функция `canSee` на ред 177). Матрицата по-долу е получена чрез изпълнение на същата логика (вкл. `effectiveRoles = [role, 'zdud']` за координатор).

### 2.1 Матрица роля × пункт

`+К` = служител с `is_coordinator = true`. ⛔ = пунктът се вижда, но страницата пренасочва към `/dashboard` (мъртъв линк за тази роля).

| Пункт (група › пункт) | admin | director | zdud | secretary | КлР | teacher | educator | терапевт | support | coordinator (роля) | терапевт+К | КлР+К |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Начало `/dashboard` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Ученици `/students` | ✔ | ✔ | ✔ | ✔¹ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Паралелки `/classes` | ✔ | ✔ | ✔ | | | | | | | | ✔ | ✔ |
| Проекти `/projects` | ✔ | ✔ | ✔ | | ✔ | ✔ | ✔ | | | | ✔ (само своите/празно) | ✔ |
| График срокове `/admin/tasks` | ✔ | ✔ | ✔ | ✔¹ | | | | | | | ✔ | ✔ |
| Документи › Образци `/templates` | ✔ | ✔ | ✔ | ✔¹ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Документи › За съгласуване `/council` | ✔ | ✔ | ✔ | | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Справки `/spravki` | | | | | | | | ✔ | | | (скрит за +К) | |
| Въвеждане на разписание `/my-schedule/edit` | | | | | ✔ | ✔ | | | | | | ✔ |
| Моето разписание `/my-schedule` | | | | | ✔ | ✔ | ✔ | | | | | ✔ |
| Физк. салон `/gym-schedule` | ✔² | ✔² | ✔² | | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Лекторски › Заместване `/my-substitutions` | | | | | ✔ | ✔ | ✔ | | | | | ✔ |
| Лекторски › Над норматив `/my-lecturer` | | | | | ✔ | ✔ | ✔ | | | | | ✔ |
| Реализация на ИУП `/absences` | ✔² | ✔² | ✔² | | ✔ | | | | | | ✔² (празно) | ✔ |
| Списък за терапия `/my-activities` | | | | | | | | ✔ | | | ✔ | |
| Анкети на новите деца `/surveys` | ✔³ | ✔³ | ✔³ | | | | | ✔ | | | ✔ (×2) | ✔ |
| Генератор на документи `/generator` | | | | | ✔ | ✔ | ✔ | ✔ | | | ✔ | ✔ |
| Натовареност `/reports` | | | | | | | | ✔ | | | ✔ | |
| Учебен процес › Разписания `/schedules` | ✔ | ✔ | ✔ | | | | | | | | ⛔ | ⛔ |
| Учебен процес › Дежурства `/duties` | ✔ | ✔ | ✔ | ✔¹ | | | | | | | ⛔ | ⛔ |
| К. Съвет `/bullying-council` | ✔ | ✔ | ✔ | | член | член | член | член | член | член | член | член |
| Управление › Служители `/staff` | ✔ | ✔ | ✔ | | | | | | | | ✔ | ✔ |
| Управление › Справки `/reports/hub` | ✔ | ✔ | ✔ | ✔¹ | | | | | | | ✔ | ✔ |
| Управление › Официални писма `/reports/letters` | ✔ | ✔ | ✔ | | | | | | | | ⛔ | ⛔ |
| Управление › Пълна справка `/reports/full` | ✔ | ✔ | ✔ | | | | | | | | ⛔ | ⛔ |
| Управление › Администрация `/admin` | ✔ | | ✔ | | | | | | | | ✔ | ✔ |
| Лекторски › Лекторски часове `/lecturer` | ✔ | ✔ | ✔ | | | | | | | | ⛔ | ⛔ |
| Лекторски › Замествания `/substitutions` | ✔ | ✔ | ✔ | ✔¹ | | | | | | | ⛔ | ⛔ |
| Лекторски › Проверка лекторски `/lecturer-review` | ✔ | ✔ | ✔ | ✔¹ | | | | | | | ⛔ | ⛔ |
| Лекторски › Отчет НП `/mon-export` | ✔ | ✔ | ✔ | | | | | | | | ⛔ | ⛔ |
| Коорд. екип › Заседания `/admin/coordinating-team` | ✔ | ✔ | ✔ | | | | | | | | ✔ | ✔ |
| Коорд. екип › Разпределение ЕПЛР `/admin/eplr-assignment` | ✔ | | ✔ | | | | | | | | ✔ | ✔ |
| Коорд. екип › Справки и писма `/reports/hub` | ✔ | ✔ | ✔ | | | | | | | | ✔ | ✔ |
| Коорд. екип › Анкети `/surveys` | ✔ | ✔ | ✔ | | | | | | | | ✔ | ✔ |
| Коорд. екип › График ЕПЛР `/admin/eplr-schedule` | ✔ | ✔ | ✔ | | | | | | | | ✔ | ✔ |
| Деловодство › Регистър `/correspondence` | ✔ | ✔ | ✔ | ✔ | | | | | | | ✔ (чете) | ✔ (чете) |
| Деловодство › Заповеди `/orders` | ✔ | ✔ | ✔ | ✔ | | | | | | | ⛔ | ⛔ |
| Деловодство › Договори `/contracts` | ✔ | ✔ | ✔ | ✔ | | | | | | | ⛔ | ⛔ |
| Деловодство › Обществени поръчки `/procurements` | ✔ | ✔ | ✔ | ✔ | | | | | | | ⛔ | ⛔ |
| Деловодство › Сайт `/site-docs` | ✔ | ✔ | ✔ | ✔ | | | | | | | ⛔ | ⛔ |
| Училища `/admin/schools` | | | | ✔¹ | | | | | | | | |
| Досиета `/students/documents` | | | | ✔¹ | | | | | | | | |
| Мои файлове / Профил и парола (долу) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

¹ секретарят вижда тези пунктове в плоския списък `section: 'settings'` (без заглавие), виж 2.2.
² под групата „Учебен процес“ (отделен запис в `navItems` от този за учителите).
³ под групата „Координиращ екип“.

### 2.2 Несъответствия и нелогично групиране

1. **Координатор (+К) вижда чужди менюта, до които няма достъп.** `canSee()` добавя `'zdud'` към ролите на координатора, затова той вижда „Учебен процес“, „Управление“, „Лекторски“ и цялото „Деловодство“. 12 от тези страници проверяват само `role` (без `is_coordinator`) и го връщат на таблото (⛔ в матрицата). Страниците, които **приемат** +К: `/admin`, `/classes`, `/students`, `/admin/coud`, `/admin/eplr-*`, `/admin/therapists`, `/admin/coordinating-team`, `/reports`, `/reports/hub`, `/reports/coud`, `/surveys`, `/generator`, `/correspondence` (само четене).
2. **Групите нямат собствена проверка на роли.** `visibleItems` показва групата, ако поне едно дете е видимо; `roles` на самата група (напр. `#process`, `#manage`) не се ползва. Сега работи по съвпадение, но е капан.
3. **Секретарят** получава два блока: „Деловодство“ (5 пункта, със заглавие) и **9 разнородни пункта без заглавие** (`section: 'settings'`): Училища, Ученици, Образци, Замествания, Проверка лекторски, Дежурства, Справки, Досиета, График срокове. Смесват се ученици/досиета, лекторски/замествания и справки. Предложение: 3 групи — „Ученици“ (Ученици, Досиета, Училища), „Персонал“ (Замествания, Проверка лекторски, Дежурства), „Общи“ (Справки, Образци, График срокове).
4. **Един и същ маршрут на две места в менюто на една роля:**
   - `/reports/hub` — „Управление › Справки“ **и** „Координиращ екип › Справки и писма“ (admin, zdud, director, +К).
   - `/surveys` — за терапевт+К се вижда и като основен пункт, и в „Координиращ екип“.
5. **Два пункта „Лекторски“** (за учители и за мениджъри) с една и съща икона — не се виждат едновременно, но създават объркване при поддръжка.
6. **„Натовареност“ за терапевтите** води към `/reports`, където при тях е видим само табът „Терапии по деца“ (`limitedView`). Етикетът и съдържанието не съвпадат.
7. **Генераторът** не е в менюто на admin/zdud/director, въпреки че страницата ги приема и им показва всички деца.
8. **Липсващи от менюто, но полезни:** `/normative-docs` (за всички служители), `/committees` (комисии), `/admin/rollover`, `/admin/coud` и др. са само в хъба `/admin` (ок), но `/normative-docs` и `/committees` нямат **никакъв** вход.
9. **`hasClass`/`requiresClass`** — нито един пункт няма `requiresClass`; `hasClass` се подава само от layout-а на `/dashboard`. Мъртва логика.
10. **`support` и `coordinator` (като роля)** — нямат табло; `coordinator` като роля и `is_coordinator` като флаг са две различни представяния на едно и също (за проверка дали ролята `coordinator` изобщо се ползва в live данните).
11. **Етикети на роли:** `types/index.ts` → `secretary: 'Секретар'`, а `dashboard/page.tsx:12` има свой `ROLE_LABELS` със `secretary: 'Деловодител'`.
12. **Технически проблеми в Sidebar:**
    - `sidebarContent` се рендира два пъти (десктоп + мобилен, редове 401 и 427) и съдържа `<AutoLogout />` (ред 289) → **два таймера за автоматичен изход** и два диалога-предупреждения (за проверка в браузъра).
    - `NavGroup` е дефиниран вътре в `Sidebar` → при всяко рендиране е нов компонент и губи състоянието „отворено/затворено“.
    - Членството в съвета се чете с 3 заявки от браузъра при всяко монтиране на layout (т.е. при всяка смяна на модул).
    - Неизползвани: `userEmail`, `settingsOpen`, икони `ScrollText`, `Building2`.
13. **Страници без сайдбар:** `/procurements`, `/profile` (няма `layout.tsx`).
14. **Страници без никакъв линк** (виж §5.2): `/my-ifo`, `/normative-docs`, `/reports/coud`, `/committees`, `/classes/[id]/schedule`, `/documents`.

---

## 3. Дублиране

### 3.1 Layout-и (36 копия)

36 файла `app/*/layout.tsx` правят едно и също: `getUser` → `staff_profiles` → `<Sidebar>`. Разлики: `.single()` vs `.maybeSingle()`, `select('*')` vs изброени колони, `getFullName(profile)` vs `` `${first} ${last}` ``, `profile.email` vs `user.email`, класове на `<main>` (`overflow-auto` vs `min-w-0`). Само layout-ът на `/dashboard` изчислява `hasClass`.
**Предложение:** един `components/layout/AppShell.tsx` (server component), който всеки layout реекспортира в един ред. Поведение 1:1.

### 3.2 Пореден номер (деловодна година) — 5 копия на `nextSeq`, 7 копия на границите 15.09–14.09

| Къде | Какво |
|---|---|
| `orders/NewOrderForm.tsx:35,47` | `deloYearBounds` + `nextSeq` (orders) |
| `correspondence/NewCorrespondenceForm.tsx:8,18,26` | `deloYearBounds` + `nextSeqCorr` (по `direction`) + `nextSeqOrders` |
| `dashboard/components/ReserveNumberCard.tsx:6,28` | `deloYearBounds` + `nextSeq` (orders или correspondence по direction) |
| `substitutions/actions.ts:97–106` | инлайн изчисление на годината + max(seq) в orders |
| `orders/page.tsx:27`, `correspondence/page.tsx:27`, `dashboard/components/SecretaryDashboard.tsx:16` | инлайн граници за филтъра |

**Предложение:** `lib/delo.ts` с `deloYearBounds(date)` и една `nextDeloSeq(supabase, date)`; в следваща стъпка — атомарен брояч в БД (виж §6.1).

### 3.3 Учебни дни/седмици (`academic_calendar_days`)

| Къде | Функция |
|---|---|
| `substitutions/actions.ts:6` | `workdays(from,to)` → `{iso, dow}[]` |
| `lecturer/actions.ts:82` | `schoolWeeks(from,to)` = round(count/5) — exported server action **без auth** |
| `lecturer/actions.ts:143` | `weeksOf` — копие на `schoolWeeks` с кеш |
| `my-lecturer/actions.ts:43` | инлайн заявка за учебните дни |
| `substitutions/SubstitutionsClient.tsx:166` | инлайн заявка от браузъра |
| `my-lecturer/actions.ts:27` | `datesForDow` — **неизползвана** (стара версия без календар) |
| `duties/page.tsx:9` | собствен генератор на седмици 15.09–30.06 (без календара) |

**Предложение:** `lib/calendar.ts` (`schoolDays`, `schoolWeeks`) — **само преместване**, без промяна на формулите (календарната логика е проверена).

### 3.4 „Часовете на отсъстващия“ в заместванията — 4 копия

`substitutions/actions.ts` събира `schedule_slots` + `teacher_ifo_slots` + `educator_slots` за един учител в четири функции: `generateSubstitution` (~ред 60–84), `getDeclarationData` (~185–204), `getMonthlyDeclaration` (~300–319), `getMonExport` (~395–405, в друг формат). Всяко копие филтрира по `term = 1`.
**Предложение:** една вътрешна функция `collectStaffSlots(supabase, staffId, yearId)` — чисто извличане, без промяна на НП/чл.162 логиката (`npDays` остава както е).

### 3.5 `isSummer` / период на ИУП — 3 различни дефиниции

| Къде | Дефиниция |
|---|---|
| `absences/page.tsx:26` | `month >= 7 && month <= 10` (коментарът казва „юли и август“) |
| `dashboard/components/ClassTeacherDashboard.tsx:13` | `month >= 7 && month <= 10`; `reportMonth` = винаги предишният месец (без правилото „от 28-о“) |
| `dashboard/components/AdminDashboard.tsx:15` | `month === 7 \|\| month === 8` |

Следствие: през септември–октомври админът вижда напомняне „Въвеждане на реализация на ИУП“, а класните — „няма въвеждане“. Реализацията за септември (въвежда се 28.09–08.10) е блокирана за класните (**за проверка** дали е умишлено за тази година).
**Предложение:** `lib/iup-period.ts` с `isIupPaused(date)`, `iupReportMonth(date)`, `isIupActive(date)`; стойностите — по решение на ЗДУД.

### 3.6 Комбо-полета и филтри

| Компонент | Къде |
|---|---|
| `PersonCombo` (търсене по име) | `admin/coordinating-team/page.tsx:55`, `substitutions/SubstitutionsClient.tsx:55`, `correspondence/NewCorrespondenceForm.tsx:75`, `bullying-council/BullyingCouncilClient.tsx:24` |
| `StudentCombo` | `bullying-council/BullyingCouncilClient.tsx:57` (и `PersonCombo` с ученици в NewCorrespondenceForm) |
| Филтър клас/специалист/„само нови“/търсене | `reports/ReportsClient.tsx` (таб „Разпределение“) и `spravki/SpravkiClient.tsx` — идентичен код |

**Предложение:** `components/ui/PersonCombo.tsx` с `excludeId?` и `renderMeta?`.

### 3.7 Дребни helper-и, повторени десетки пъти

| Helper | Брой / места |
|---|---|
| `d.split('-').reverse().join('.')` (ISO → дд.мм.гггг) | 24 инлайн + `fmt`/`fmtDate` в `MyLecturerClient`, `MySubstitutionsClient`, `LecturerClient`, `ReviewClient`, `CouncilClient`, `BullyingCouncilClient`, `StudentStatusSection`, `ArchivedClient`, `SiteDocsClient`, `StudentDocuments` (някои с `toLocaleDateString`) |
| `fmtSize` (байтове → KB/MB) | 5 копия (`SchoolFilesPanel`, `SchoolFilesButton`, `StudentDeclarations`, `CouncilClient`, `BullyingCouncilClient`) |
| `` `${first_name} ${last_name}` `` вместо `getFullName` | ≈ 81 места |
| Месеци на български | `lib/utils.ts` (`getMonthName`, `MONTHS`), `lib/recurring.ts` (`MONTHS_BG`), 2× локален `MONTHS` в `substitutions/actions.ts`, `docx-substitution.ts`, `DutyRosterClient`, `MonExportClient` |
| Дни от седмицата | `DAYS`/`WEEKDAYS`/`DOW`/`DAY` в поне 8 файла (`MyScheduleEditor`, `MyScheduleView`, `EducatorScheduleView`, `ScheduleClient`, `DashboardCalendar`, `admin/tasks`, `lecturer/actions`, `lecturer-review/actions`, `docx-generator`) |
| `ymd(date)` | `lib/recurring.ts:29` и `dashboard/components/DashboardCalendar.tsx:23` |
| Текуща учебна година (`academic_years … is_current`) | 73 заявки, всяка поотделно |
| `ROLE_LABELS` | `types/index.ts`, `dashboard/page.tsx`, `reports/page.tsx` (`ROLE_LABELS_BG`), `spravki/page.tsx` |
| Норми по роля (`NORMS`) | `lecturer/actions.ts` — **за проверка** дали има и други копия при следваща промяна; да не се пипа сега |

### 3.8 Сходни функционалности (по-голямо дублиране)

| Функционалност | Реализации | Предложение |
|---|---|---|
| Редактор на ИФО часове на учител (`teacher_ifo_slots`) | `/my-schedule/edit` (актуален), `/my-ifo` (без линк), `students/[id]/schedule/IfoScheduleGrid.tsx` (неизползван) | остави `/my-schedule/edit`; другите — пренасочване/премахване |
| Редактор на разписание на паралелка (`schedule_slots`) | `/my-schedule/edit` (по учител, с `staff_id`), `/classes/[id]/schedule` (по паралелка, **без** `staff_id`) | премахни стария (§6.4) |
| Добавяне на предмет „в движение“ | `classes/[id]/schedule/actions.ts: addSubject`, `my-ifo/actions.ts: addSubject`, `my-schedule/edit/actions.ts: addSubjectQuick`, `admin/subjects` | един action |
| ЕПЛР екип | `/admin/eplr-assignment` (матрица) и `/students/[id]/eplr` (един ученик) | ок да останат два изгледа, но с един общ save helper |
| Терапевти на детето | `students.therapist_*` (`/admin/therapists`, `/my-activities`) **и** `eplr_teams.*_id` (ЕПЛР екип) | виж §7.2 — да се документира кое за какво е |
| Срокове | `calendar_deadlines` (`/admin/deadlines`, таблата) **и** `recurring_tasks` (`/admin/tasks` „График срокове“) | да се реши дали `calendar_deadlines` не става частен случай (`freq='once'`) на `recurring_tasks` |
| Документи на ученика | `student_attachments` (досие, валидност по `valid_until_year`), `student_documents` (ТЕЛК/ЕР с `valid_until` дата), `eplr_attachments`, `student_declarations` (неизползван компонент), `documents` (П1–ПР) | виж §7.3 |
| Изтичащи документи в таблото | `AdminDashboard` брои от `student_attachments`; `ExpiringDocsCard` (Admin/Director/ClassTeacher) брои от `student_documents` | две различни истини на една и съща страница |
| Списък ЦОУД групи | `/classes?tab=coud` и `/reports/coud` | един |
| Разпределение по специалисти | `/reports` (таб) и `/spravki` | един компонент |
| Комисии / Координиращ екип / К. съвет / „За съгласуване“ | 4 модула с членове + заседания + протокол + файлове | не обединявай сега; само общ `MembersEditor`/`FilesList` при нужда |

---

## 4. Справки и експорти

### 4.1 Инвентар

| Справка / експорт | Къде | Формат | Роли | Бележка |
|---|---|---|---|---|
| Реализация на ИУП | `/absences/export/[m]/[y]` (route) | xlsx (инлайн в route) | мениджъри | `lib/excel-generator.generateAbsencesExcel` **не се ползва** — route-ът прави свой XLSX |
| Разпределение (ученик × специалисти) | `/reports` таб „Разпределение“, `/spravki` | екран + PDF (`generateDistributionPDF`) | мениджъри / терапевти | **дубликат** |
| Писма по училище (ЕПЛР екип, график срещи) | `/reports` таб „Писма по училище“ | Word (`generateSchoolLetter`, `generateSchoolScheduleLetter`) | мениджъри, +К | бутоните „свали всички“ са мъртви (`generateAllLetters`, `downloadAllSchedules`) |
| Натовареност | `/reports` таб „Натовареност“ | екран + xlsx (`generateWorkloadReportExcel`) | мениджъри, +К | |
| Терапии по деца (интензитет) | `/reports` таб „Терапии по деца“ | екран + PDF (`generateIntensityPDF`) | + терапевти | за терапевтите менюто го нарича „Натовареност“ |
| Хъб „Справки“ | `/reports/hub` | — | мениджъри, secretary, +К | не съдържа `/reports/letters`, `/reports/full`, `/spravki`, `/mon-export` |
| Заявления за прием и ЦОУД | `/reports/enrollments` | екран + xlsx | admin, zdud, director, secretary | |
| Ученици по клас (външен клас) | `/reports/by-class` | екран + xlsx | same | |
| Ученици по училища | `/reports/by-school` | PDF | same | припокрива се частично с „Писма по училище“ |
| Родители и контакти | `/reports/guardians` | печат | same | |
| Пътуващи ученици | `/reports/traveling` | екран + xlsx | same | |
| ЦОУД групи | `/classes?tab=coud` (от хъба), `/reports/coud` (без линк) | екран | | виж §6.2 |
| Официални писма — паралелки (РУО, РЦПППО, изнесени групи) | `/reports/letters` | Word | admin, zdud, director | само от менюто „Управление“ |
| Пълна справка | `/reports/full` | xlsx (`generateStudentReportExcel`) | admin, zdud, director | супер-множество на by-class/guardians/traveling |
| Отчет НП (МОН) | `/mon-export` | xlsx (`generateMonImport`) | admin, zdud, director | |
| Заповед/декларации замествания | `/substitutions`, `/my-substitutions` | Word | | бизнес логика — не пипай |
| Лекторски — обща заповед, декларация | `/lecturer`, `/my-lecturer` | Word | | бизнес логика — не пипай |
| Заповед за отпуск по НП | `/correspondence` (сценарий) | Word | | бизнес логика — не пипай |
| Протоколи (комисии, координиращ екип, К. съвет) | съответните модули | Word | | |
| Разписания (паралелка, учител, терапевт, ЕПЛР по специалист/ден), дежурства, ЦОУД заповед, анкета | съответните модули | Word | | |
| Списък за терапия | `/my-activities` | PDF | терапевти | |

### 4.2 Припокриване и излишни

1. **`/spravki` ≡ таб „Разпределение“ в `/reports`** — същите заявки, същите филтри, същият PDF бутон. Може да се премахне `/spravki` и терапевтите да влизат в `/reports` с видими табове „Разпределение“ + „Терапии по деца“.
2. **`/reports/coud` ≡ `/classes?tab=coud`** — страницата няма линк; хъбът сочи към `/classes`, където секретарят вижда „—“ (§6.2).
3. **`/reports/full` е супер-множество** на by-class, guardians, traveling (и частично enrollments). Малките справки са полезни за печат, но трябва поне да използват една и съща заявка/helper.
4. **Мъртви Excel генератори:** `generateAbsencesExcel`, `generateNoTeamReportExcel`, `generateDelayedDocsExcel`, `generateAnnualReportExcel`, а в `ReportsClient` импортите на `generateSchoolReportExcel` и `generateSpecialistReportExcel` не се ползват. `delayedRows` се подава, но не се показва — `/reports/page.tsx` зарежда излишно `documents` и `calendar_deadlines` за него.
5. **`generateSubstitutionDeclaration` и `generateSubstitutionInternalDecl`** (Word) и server action `getDeclarationData` — не се ползват (заменени от месечната декларация). **Не трий без потвърждение от ЗДУД** — може да са резервен вариант.

### 4.3 Липсващи (предложения, по ред на полза)

1. **Обобщение на лекторските декларации за изплащане** (по месец/учител: подадени, проверени, часове) — xlsx от `/lecturer-review`. Сега няма никакъв експорт.
2. **Обобщение на заместванията по месец** за счетоводството (НП/бюджет по учител) — логиката вече я има в `getMonthlyDeclaration`/`getMonExport`, липсва само общ изглед за ЗДУД.
3. **Хъбът `/reports/hub`** да изброява всички справки (letters, full, mon-export, натовареност) с филтър по роля — един вход вместо 4 менюта.
4. **Справка „без ЕПЛР екип“ / „без терапевт“** — генераторът `generateNoTeamReportExcel` съществува, но не е закачен (за проверка дали е нужна).

---

## 5. Мъртъв код

### 5.1 Неизползвани файлове / компоненти

| Файл | Бележка |
|---|---|
| `components/layout/Header.tsx` | не се импортира |
| `components/SessionTimer.tsx` | ползва се `SessionTimerBadge` |
| `app/dashboard/components/DashboardCalendar.tsx` | не се импортира (ползваше `calendar_deadlines`) |
| `app/admin/schools/SchoolFilesButton.tsx` | ползва се `SchoolFilesPanel` |
| `app/students/[id]/schedule/IfoScheduleGrid.tsx` + actions `saveIfoSchedule`, `copyIfoFromTerm1` | страницата ползва само `IfoScheduleView` |
| `app/students/[id]/StudentDeclarations.tsx` | не се импортира → bucket `student-declarations` и таблица `student_declarations` не се ползват от UI (за проверка дали има данни) |
| `app/students/[id]/DocumentsList.tsx` | импортиран в `students/[id]/page.tsx`, но не се рендира |
| `app/documents/page.tsx` | ред 25: `redirect('/templates')` — останалите ~300 реда са недостижими |

### 5.2 Страници без вход (orphan)

| Маршрут | Състояние | Предложение |
|---|---|---|
| `/my-ifo` | заменена от `/my-schedule/edit` | redirect → `/my-schedule/edit` |
| `/classes/[id]/schedule` | стар редактор, опасен (§6.4) | redirect → `/my-schedule/edit` или `/classes/[id]/schedule-view` |
| `/reports/coud` | дубликат | redirect → `/classes?tab=coud` (след оправяне на §6.2) |
| `/documents` | redirect към `/templates` | да остане redirect, кодът под него да се махне |
| `/normative-docs` | работеща, полезна | **да се добави в менюто** („Документи › Нормативни“) |
| `/committees` | работещ модул | да се реши: в менюто ли е нужен, или е заменен от „Координиращ екип“ (за проверка с ЗДУД) |

### 5.3 Неизползвани функции/експорти

- `lib/excel-generator.ts`: `generateAbsencesExcel`, `generateNoTeamReportExcel`, `generateDelayedDocsExcel`, `generateAnnualReportExcel`.
- `lib/docx-substitution.ts`: `generateSubstitutionDeclaration`, `generateSubstitutionInternalDecl` (+ `DOW_SHORT`).
- `lib/utils.ts`: `formatDateLong`, `getDeadlineColor`.
- `substitutions/actions.ts`: `getDeclarationData` (export без извикване), локален `MONTHS` (ред 353), `me` (ред 167).
- `my-lecturer/actions.ts:27` `datesForDow`.
- `my-ifo/actions.ts: copyTeacherIfoFromTerm` — без извикване.
- `admin/staff/actions.ts: genPassword`.
- `reports/ReportsClient.tsx`: `generateAllLetters`, `downloadAllSchedules`, `ruoData`, `generatingAll`, `generatingSchedules`, `delayedRows`.
- `admin/eplr-schedule/ScheduleClient.tsx`: `createSchedule`, `deleteSchedule`, `showNew`, `creating` (UI за създаване/триене на график е премахнат, логиката е останала).
- `admin/years/page.tsx: handleRenameClass`; `orders/OrdersClient.tsx: handleSearch`, `schoolYear`.

### 5.4 Неизползвани променливи — пример `statusOf`

Има **три различни** функции `statusOf`:
- `students/[id]/StudentDocuments.tsx:38` — използва се.
- `students/documents/DocumentsMatrixClient.tsx:45` — използва се.
- `substitutions/SubstitutionsClient.tsx:26` — извиква се на ред 448 (`const st = statusOf(r)`), **но `st` никъде не се показва** → функцията е фактически мъртва (статусът „Заповед издадена / Готово / Чака заместник“ вече не се вижда в списъка).

Също в `SubstitutionsClient.tsx`: `REASONS`, `registerMap/setRegisterMap`, `reason`, `eReason` не се ползват.

### 5.5 Пълен списък от `tsc --noUnusedLocals`

135 предупреждения; ~70 са неизползвани импорти на икони. Най-съществените (извън горните):
`admin/coud/CoudGroupModal.tsx: coudEligible`, `admin/schools/page.tsx: setSortBy, schoolTypes, activeCount`, `classes/[id]/AddStudentsSection.tsx: pending`, `dashboard/components/AdminDashboard.tsx: profile, nextMonth`, `DirectorDashboard.tsx: currentYearName, eplrCount`, `my-lecturer/MyLecturerClient.tsx: todayStr, suggestFrom`, `students/[id]/page.tsx: ALL_DOC_TYPES, docMap, DocumentsList`, `students/[id]/EplrDocumentsSection.tsx: uploadedTypes`, `students/documents/DocumentsMatrixClient.tsx: supabase`, `lib/docx-generator.ts: BORDER_NONE, tc, yearName (2×), scheduleName`, `lib/pdf-generator.ts: headerBottom`.

Отделно: `tsc` дава 16 грешки TS2802 (итерация на `Set` без `target`) — `tsconfig.json` няма `target`. Next ги компилира, но `tsc` не минава чисто.

---

## 6. Известни бъгове — проверка

### 6.1 `nextSeq` — отделни броячи вместо един общ — **ПОТВЪРДЕН**

Сега има **три независими брояча** в деловодната година (15.09–14.09):

| Брояч | Къде се изчислява |
|---|---|
| Входяща кореспонденция | `nextSeqCorr(…, 'incoming', …)` (`NewCorrespondenceForm.tsx:18`), `ReserveNumberCard` |
| Изходяща кореспонденция | `nextSeqCorr(…, 'outgoing', …)`, `ReserveNumberCard` |
| Заповеди | `nextSeq` (`NewOrderForm.tsx:47`), `nextSeqOrders` (`NewCorrespondenceForm.tsx:26`), `ReserveNumberCard`, `substitutions/actions.ts:102` |

Следствие: Вх. 014, Изх. 014 и Заповед 014 могат да съществуват едновременно. Изискването е **един общ пореден номер** за всички регистри.

Допълнителни проблеми около номерацията:
- **Race condition:** номерът е `max(seq)+1`, прочетен от браузъра, после `insert`. Двама потребители едновременно → еднакъв номер. Уникален индекс по `(деловодна година, seq)` в live базата — **за проверка**.
- `ReserveNumberCard` и `substitutions/actions.ts` ползват `new Date().toISOString()` → UTC дата; между 00:00 и 03:00 българско време датата е вчерашната (граничен случай на 15.09).
- `contracts/NewContractForm.tsx:77` — договорите се номерират като `count(*) + 1` за годината → при изтрит договор номерът се повтаря.

**Предложена поправка (без промяна на формата `NNN/дд.мм.ггггг.`):**
1. `lib/delo.ts: nextDeloSeq(supabase, date)` = `max(seq)` от `correspondence` (двете посоки) **и** `orders` за деловодната година + 1; всички 5 места го ползват.
2. Решение на ЗДУД/секретаря от коя дата влиза общият брояч (текущите номера се запазват; новият старт = максимумът от трите).
3. Отделен PR: Postgres функция (`rpc('next_delo_seq')`) с `pg_advisory_xact_lock` или таблица-брояч + уникален индекс — затваря race condition.

### 6.2 `/classes` таб ЦОУД показва „—“ за секретаря — **ПОТВЪРДЕН, причината е намерена**

`classes/page.tsx`:
- ред 22–34: за не-мениджър (секретарят не е мениджър) `classes` се ограничава до **неговите** паралелки → празен списък (`.in('id', ['no-results'])`).
- ред 67–72: `classNameByStudent` и `classIdByStudent` се строят **от филтрирания `classes`** → за всички ученици паралелката и класният са „—“.

Секретарят стига дотук от картата „ЦОУД групи“ в `/reports/hub` (ролите на картата включват `secretary`).
**Поправка (малка):** за ЦОУД таба да се ползва отделна заявка за всички паралелки на годината (както в `/reports/coud`), а филтърът по „мои паралелки“ да остане само за таба „Паралелки“. Алтернатива — хъбът да сочи `/reports/coud` и там да се добави `secretary`.

### 6.3 `/lecturer-review` — стъпката „verify“ е полуготова — **ПОТВЪРДЕН**

Какво има: списък на всички декларации, разгъване с дати по слот, „Потвърди“ (`submitted → verified`), „Върни“ (`verified → submitted`).
Какво липсва/проблеми:
1. **Няма филтър по учебна година, месец/период или статус** — списъкът расте безкрайно (`order by created_at`).
2. **Статус `paid` („Изплатена“) е в UI речника, но нищо не го задава.** Жизненият цикъл свършва на `verified`.
3. **Няма реална сверка** — подзаглавието казва „Сверете с НЕИСПУО“, но системата не показва нищо за сравнение: нито дали датите все още съвпадат с `lecturer_slots`/календара, нито дали същият час е отчетен и като заместване.
4. **Няма „Върни с коментар“** за подадена декларация; учителят не вижда причина.
5. `verifyDeclaration` не проверява текущия статус (може да „потвърди“ вече потвърдена/изплатена), не е в транзакция.
6. `getDeclarationDetail` няма проверка за вход/роля (разчита на RLS — за проверка).
7. **Няма експорт** (обобщение за изплащане) — виж §4.3.
8. Секретарят вижда пункта и може да потвърждава — **за проверка** дали това е желано.

### 6.4 Допълнително открити бъгове (приоритизирани)

| # | Бъг | Къде | Тежест |
|---|---|---|---|
| B1 | **Старият редактор `/classes/[id]/schedule` трие всички слотове на паралелката** (`delete().eq('schedule_id', …)`) и записва нови **без `staff_id`**. Един запис от admin/zdud унищожава въведеното от учителите в `/my-schedule/edit`, а заместванията/лекторските/НП отчетът (които търсят `schedule_slots.staff_id`) остават без часове. Страницата няма линк, но е достъпна по URL. | `classes/[id]/schedule/actions.ts:38` | Висока |
| B2 | Две различни „изтичащи документи“ на едно табло (`student_attachments` vs `student_documents`). | `AdminDashboard.tsx:39`, `ExpiringDocsCard.tsx:29` | Средна |
| B3 | ИУП период: 3 различни дефиниции на лято (§3.5). | | Средна (за проверка) |
| B4 | Двоен `AutoLogout` в сайдбара (§2.2 т.12). | `Sidebar.tsx:289,401,427` | Ниска–средна |
| B5 | Координаторът вижда 12 пункта, които го връщат на таблото (§2.2 т.1). | `Sidebar.tsx:177` | Средна (UX) |
| B6 | Мъртъв статус в списъка със замествания (§5.4). | `SubstitutionsClient.tsx:448` | Ниска |
| B7 | `.eq('…_id', 'no-results')` / `.in('id', ['no-results'])` върху uuid колони дава грешка от PostgREST (невалиден uuid), която се поглъща като „няма данни“. Работи по случайност. | `classes/page.tsx:33`, `generator/page.tsx`, др. | Ниска |
| B8 | Всички разписания в заместванията/лекторските/МОН/натовареност четат само `term = 1` (18 места). През II срок промени в разписанието няма да се отразят — **за проверка** дали е умишлено. | `substitutions/actions.ts`, `lecturer/actions.ts`, `reports/page.tsx`, … | Средна (за проверка, **бизнес логика — не пипай без решение**) |
| B9 | `reports/full/actions.ts` чете `coud_enrollments` без филтър по учебна година → може да покаже миналогодишна ЦОУД група. | ред ~38 | Ниска (за проверка) |
| B10 | `/absences` чете `monthly_absences` за месеца без `academic_year_id`; при `year`+`month` е уникално, така че е ок, но export route-ът чете **всички** `students` (`select('*')`). | `absences/export/[month]/[year]/route.ts` | Ниска (производителност) |
| B11 | Твърдо кодирани имена в документи: директор (`docx-generator.ts:1116,1250,1441`), ЗДУД (`NewCorrespondenceForm.tsx:288`), „вътрешни собственици“ в договорите (`NewContractForm.tsx:20`, `EditContractModal.tsx:20`, `EditCorrespondenceModal.tsx:18`), адресат на РЦПППО (`LettersClient.tsx:28`). При смяна на ръководството документите ще са грешни. В `substitutions/actions.ts` ЗДУД се чете от базата — добър модел. | | Средна |
| B12 | `package-lock.json` не съответства на `package.json` (липсват `jspdf`, `jspdf-autotable` и зависимостите им) → `npm ci` пада. | корен | Средна (деплой) |

---

## 7. Последователност на данните

### 7.1 Схема извън репото

`supabase/migrations/001_initial_schema.sql` описва 15 таблици; кодът ползва ≈ 70 таблици и 10 bucket-а. RLS политиките, уникалните индекси, FK имената (напр. `substitutions_absent_staff_id_fkey`) и storage политиките съществуват само в live базата.
**Препоръка (без риск):** `supabase db dump --schema-only` → `supabase/schema/current.sql` в репото, само за документация. Това е предпоставка за всички RLS проверки по-долу.

### 7.2 Два модела за „кой работи с детето“

| Модел | Колони | Година | Ползва се от |
|---|---|---|---|
| ЕПЛР екип | `eplr_teams.{psychologist,speech_therapist,rehabilitator,class_teacher}_id` | има `academic_year_id` | ЕПЛР разпределение, генератор, справки, `/students` (филтър за терапевт), `/reports`, `/spravki`, rollover |
| Реален терапевт | `students.therapist_{psychologist,speech,rehab}_id` | **няма година** | `/admin/therapists`, `/my-activities`, `/schedules`, таблата, досие |

Разграничението вероятно е умишлено (екипът по документи ≠ кой реално води терапия), но:
- не е документирано;
- `students.therapist_*` не се прехвърля/нулира в rollover (за проверка);
- `/reports` смята натовареността от `therapist_slots`, а разпределението — от `eplr_teams`; `/students` за терапевта филтрира по `eplr_teams`, а `/my-activities` — по `students.therapist_*`. Един терапевт може да вижда различни „мои деца“ на различни места.

### 7.3 Пет таблици за „документи на ученика“

`documents` (П1–ПР, JSON данни), `student_attachments` (досие: заявления, валидност по година), `student_documents` (ТЕЛК/ЕР/МКБ с дата на валидност), `eplr_attachments` (файлове от ЕПЛР), `student_declarations` (неизползвана в UI). Изтичането се смята по два различни начина (`valid_until_year` vs `valid_until`). **Предложение:** не мигрирай данни; първо документирай в `docs/` коя таблица за какво е и уеднакви „изтичащи“ в таблото към един източник.

### 7.4 Проверки на роли — различни на различни места

- **Сървърни страници** проверяват роля с разни списъци: `['admin','zdud','director']`, `+ 'secretary'`, `+ is_coordinator`, `['admin','zdud']`. Няма общ helper; 50 `redirect('/dashboard')` с ръчни масиви.
- **Client страници** (`/admin/years`, `/admin/staff`, `/admin/schools`, `/admin/announcements`, `/admin/deadlines`, `/students/new`, `/students/[id]/edit|archive|transfer`, `/students/[id]/eplr`, `/documents/[…]`, `/committees/new`) **нямат сървърна проверка**, а `admin/layout.tsx` също не проверява роля. Всеки логнат потребител може да отвори URL-а; защитата е само RLS — **за проверка в live базата**.
- **Server actions без проверка на роля/вход** (разчитат на RLS — за проверка): `admin/rollover/actions.ts` (`confirmEnrollment`, `confirmAllEnrollments`, `archiveStudent`, `updateExternalClass`), `lecturer/actions.ts` (`schoolWeeks`, `clearLecturerSlots`, `removeLecturerSlot`), `lecturer-review/actions.ts: getDeclarationDetail`, `substitutions/actions.ts` (`getAssignments`, `saveAssignments`, `getMonExport` — само вход), `classes/[id]/schedule/actions.ts`, `students/[id]/schedule/actions.ts`, `my-ifo/actions.ts: copyTeacherIfoFromTerm`.
- **Добри образци, които вече съществуват:** `admin/coud/educator-schedule-actions.ts` (`requireAdmin`) и `my-activities/schedule/actions.ts` (`resolveStaffId`) — да станат общ `lib/auth.ts`.
- **Координатор:** на едни места `is_coordinator` дава права на мениджър (`/students`, `/classes`, `/generator`), на други — не (`/lecturer`, `/schedules`, `/orders`), а в сайдбара — винаги (§2.2).
- **Service-role в `my-schedule/edit/actions.ts: releaseClassSlot`** трие слотове на **други** учители (`neq('staff_id', me)`), след проверка само за вход. Логиката е умишлена (освобождаване на клетка), но заобикаля RLS — **за проверка** дали учител може да изтрие чужд час.

### 7.5 FK join-ове

- `staff_profiles` се join-ва по 21 различни начина; повечето с явно име на FK (`!eplr_teams_psychologist_id_fkey`) — добре. Без hint: `staff:staff_profiles(` (21×), `teacher:staff_profiles(` (9×) — работят, докато таблицата има само един FK към `staff_profiles`; при добавяне на втори (напр. `created_by`) заявките ще гръмнат с „more than one relationship“. **За проверка:** `class_teacher_assignments`, `coud_groups`, `lecturer_slots` (вече има hint на едно място, без hint на друго).
- `students.therapist_*` се join-ва с 4 различни алиаса за един и същ FK (`psy`/`psych`/`therapist_psychologist`, `spe`/`speech`/`therapist_speech`, `reh`/`rehab`/`therapist_rehab`).
- „Текуща година“ се чете 73 пъти с `.single()`; ако няма текуща година (между rollover стъпки), повечето страници тихо работят с `undefined` id.
- `staff_profiles` по `user_id`: 101× `.single()` срещу 5× `.maybeSingle()` — непоследователно; `.single()` хвърля при 0 реда.

### 7.6 Дати

Смесват се `toISOString().split('T')[0]` (UTC), `new Date(x + 'T00:00')` (локално) и `new Date(x)` (UTC за ISO дата). За България това дава грешен ден около полунощ. Не е спешно, но при изнасяне в `lib/dates.ts` да се ползва една функция `todayLocalISO()`.

---

## 8. Силни страни — да не се пипат

1. **Бизнес логиката на заместванията и НП** (`substitutions/actions.ts: npDays`, чл. 162 → само първите 2 работни дни, РД-08, разделяне НП/бюджет, МОН импорт с номер без дата) — проверена, работи. При рефакторинг само се **местят** помощните функции, правилата не се пипат.
2. **`academic_calendar_days` като единствен източник за учебни дни** в замествания, лекторски и декларации — правилен модел (ваканции/празници идват от данните, не от кода).
3. **Лекторски декларации:** защита от застъпващи се периоди и триене само на „подадена“ (`my-lecturer/actions.ts`).
4. **`/my-schedule/edit` → `saveMySchedule`:** трие само **своите** слотове, включително в паралелки, от които учителят е махнал всичко — внимателно написано и коментирано.
5. **`lib/recurring.ts`** — чист, тестваем модул без зависимости от UI/БД. Добър образец за останалите helper-и.
6. **Auth callback:** свързване на предварително създаден профил по email, fallback проверка, без фалшив signOut; достъп само за служители с профил.
7. **Деловодна година 15.09–14.09** и форматът `NNN/дд.мм.ггггг.` — разбираеми и последователни навсякъде; резервирането на номер от таблото е полезна функция.
8. **Централизирани генератори** (`lib/docx-*`, `pdf-generator`, `excel-generator`) — Word/PDF/Excel не са разпилени по страниците (с малки изключения).
9. **Server action helper-и** `requireAdmin` (`admin/coud/educator-schedule-actions.ts`) и `resolveStaffId` (`my-activities/schedule/actions.ts`) — правилният модел за проверка на права.
10. **Пренасочване на мениджърите** от лични изгледи към общи (`/my-schedule` → `/schedules?tab=teachers`, `/my-activities/schedule` → `/schedules?tab=therapists`) — логично.
11. **UI примитиви** `Toast`, `Modal`, `Confirm`, `BackButton` — леки и последователни.
12. **Сайдбарът като декларативна таблица** (`navItems` с роли) — лесен за промяна; проблемите са в правилата, не в подхода.
13. **FK hints** в повечето многозначни join-ове (`eplr_teams_*_fkey`, `substitutions_*_fkey`).
14. **AutoLogout 30 мин.** с предупреждение — подходящо за споделени компютри (нужна е само поправката за двойното монтиране).

---

## 9. План за подобрение

Всяка стъпка = **един отделен PR**, независим от останалите (освен ако е посочено), без миграции на данни, без промяна на правилата в заповедите/декларациите. Ред: първо безопасни/висока полза, после по-големи.

Риск: **Н** нисък, **С** среден, **В** висок. Полза: ★ … ★★★.

| # | PR | Какво точно | Риск | Полза | Зависи от |
|---|---|---|---|---|---|
| 1 | **Изключване на стария редактор на разписания** | `/classes/[id]/schedule` → `redirect('/my-schedule/edit')` (или към `schedule-view`); actions да не се извикват. Премахва риска B1. | Н | ★★★ | — |
| 2 | **ЦОУД таб за секретаря** | В `classes/page.tsx` ЦОУД данните да ползват всички паралелки на годината (§6.2). | Н | ★★★ | — |
| 3 | **Общ брояч — helper** | `lib/delo.ts` (`deloYearBounds`, `nextDeloSeq` = max от correspondence + orders); заместване на 5-те копия. Преди merge — дата на въвеждане, съгласувана със секретаря. | С | ★★★ | — |
| 4 | **Общ брояч — атомарност** | RPC `next_delo_seq()` с lock + уникален индекс; `nextDeloSeq` вика RPC. Тест на staging със същите данни. | С | ★★ | 3 |
| 5 | **Сайдбар за координатора** | Координаторът да **не** получава `zdud` в `effectiveRoles`; видимост само чрез `coordinatorOnly` + изрично добавени пунктове. Премахва 12 мъртви линка. | Н | ★★ | — |
| 6 | **Сайдбар — поправки без промяна на видимостта** | `AutoLogout` да се монтира веднъж (извън `sidebarContent`); `NavGroup` извън `Sidebar`; махане на `hasClass/requiresClass`, `userEmail`, `settingsOpen`; премахване на дублирания `/reports/hub` в „Координиращ екип“. | Н | ★★ | — |
| 7 | **Меню на секретаря** | `section:'settings'` → 3 озаглавени групи (§2.2 т.3). Само подредба. | Н | ★★ | — |
| 8 | **Orphan страници** | `/my-ifo` → redirect; `/reports/coud` → redirect; `/documents` — махане на недостижимия код; `/normative-docs` в менюто „Документи“. | Н | ★★ | 2 (за `/reports/coud`) |
| 9 | **Мъртъв код — чисто триене** | Файловете от §5.1 (без `StudentDeclarations` и docx генераторите за замествания — те след потвърждение), неизползвани импорти/променливи от `tsc`, `statusOf` в SubstitutionsClient (или да се покаже отново — по решение). | Н | ★ | — |
| 10 | **`/lecturer-review` — филтри** | Филтър по учебна година (по подразбиране текущата), статус и месец; брояч „чакащи“. | Н | ★★ | — |
| 11 | **`/lecturer-review` — безопасно потвърждение** | `verifyDeclaration` само от `submitted` (`.eq('status','submitted')`); auth/роля в `getDeclarationDetail`; „Върни с коментар“ (нова nullable колона `review_note`). | С | ★★ | 10 |
| 12 | **`/lecturer-review` — експорт** | xlsx: учител, период, часове, статус — за изплащане. По желание статус `paid`. | Н | ★★ | 10 |
| 13 | **Общ `AppShell` layout** | Един server компонент; 36-те layout-а стават по 1 ред. Добавя layout на `/procurements` и `/profile`. | Н | ★★ | — |
| 14 | **`lib/auth.ts`** | `getMe()`, `requireRole([...])`, `isManager(me)` (включва/не включва +К изрично). Първо само се добавя; прилагане модул по модул в следващи PR-и. | Н | ★★ | — |
| 15 | **Сървърна защита на client admin страниците** | `admin/layout.tsx` проверява `admin/zdud/+К`; `/students/new|edit|archive|transfer` — тънък server wrapper с `requireRole`. | С (може да скрие страница от някого, който я ползва) — преди това одит на RLS | ★★★ | 14, 17 |
| 16 | **Проверки в server actions** | `requireRole` в rollover, lecturer, substitutions, schedule actions (§7.4). | С | ★★ | 14 |
| 17 | **Схема в репото** | `supabase db dump --schema-only` → `supabase/schema/current.sql` + кратко описание на RLS. Само документация. | Н | ★★★ | — |
| 18 | **`lib/dates.ts` + `lib/format.ts`** | `isoToBg`, `todayLocalISO`, `fmtSize`, `MONTHS_BG`, `WEEKDAYS`; замяна само в нови/пипани файлове (постепенно). | Н | ★ | — |
| 19 | **`lib/calendar.ts`** | Преместване на `workdays`, `schoolWeeks`, `weeksOf` 1:1 (без промяна на формулите). | Н | ★ | — |
| 20 | **`collectStaffSlots` в заместванията** | Извличане на 4-те копия (§3.4) в една функция; изходът на Word/МОН — сравнение байт по байт преди/след на 2–3 реални замествания. | С | ★★ | 19 |
| 21 | **`lib/iup-period.ts`** | Една дефиниция на „лято“ и отчетен месец за `/absences` и двете табла — след решение на ЗДУД кои месеци. | Н | ★★ | — |
| 22 | **Настройки на институцията** | Имена на директор/ЗДУД/адресати от `site_settings` (или константи в `lib/institution.ts` като първа стъпка) вместо твърдо кодирани. | Н | ★★ | — |
| 23 | **Един източник за „изтичащи документи“** | Таблата да ползват една и съща функция; решение коя таблица е водеща (§7.3). | С | ★★ | — |
| 24 | **`/spravki` → `/reports`** | Терапевтите влизат в `/reports` с табове „Разпределение“ + „Терапии по деца“; `/spravki` → redirect; менюто „Натовареност“ се преименува. | Н | ★ | — |
| 25 | **Хъб на справките** | `/reports/hub` изброява всички справки по роля (letters, full, mon-export); менютата сочат само към хъба. | Н | ★ | 24 |
| 26 | **`PersonCombo` в `components/ui`** | Един компонент, замяна на 4-те копия. | Н | ★ | — |
| 27 | **`package-lock.json` синхрон** | `npm install` и commit на lockfile-а; `target: "es2017"` в `tsconfig` → `tsc` минава чисто; README → Next 16. | Н | ★★ | — |
| 28 | **Номера на договорите** | `max(seq)+1` вместо `count+1` (или общия брояч, ако ЗДУД реши). | Н | ★ | — |

### Препоръчителен ред на първите стъпки

1. **PR 1, 2, 6, 27** — малки, изолирани, премахват реални бъгове.
2. **PR 17** — схемата в репото; без нея промените по права са на сляпо.
3. **PR 3 → 4** — общият брояч (изисква решение на секретаря/ЗДУД за датата).
4. **PR 5, 7, 8, 9** — почистване на менюта и мъртъв код.
5. **PR 10 → 11 → 12** — довършване на `/lecturer-review`.
6. **PR 13, 14 → 15, 16** — инфраструктура за права.
7. Останалите — по възможност, заедно с работа в съответния модул.

### Въпроси за решение (преди съответните PR-и)

- От коя дата влиза общият брояч и дали договорите също минават към него? (PR 3, 28)
- Кои месеци са „без ИУП“: юли–август или юли–октомври? (PR 21)
- Трябва ли секретарят да потвърждава лекторски декларации? Нужен ли е статус „изплатена“? (PR 11, 12)
- Нужен ли е модулът „Комисии“ в менюто, или е заменен от „Координиращ екип“?
- Да се пазят ли `generateSubstitutionDeclaration` / `generateSubstitutionInternalDecl` като резервни бланки?
- Замествания/лекторски/МОН — умишлено ли се ползва само разписанието за I срок? (B8)
