"""Социално-емоционално и сензорика: карти с емоции, скала 1–5, меню за успокояване, дишане, социални истории."""
import math
import random

from kit import *
from m_cognitive import connect_columns, centered_picto

EMO = [('happy', 'радост', '#f59e0b'), ('sad', 'тъга', '#3b82f6'), ('angry', 'гняв', '#ef4444'), ('scared', 'страх', '#8b5cf6'),
       ('surprised', 'изненада', '#ec4899'), ('calm', 'спокойствие', '#10b981'), ('sleepy', 'умора', '#64748b'),
       ('worried', 'тревога', '#f97316'), ('confused', 'объркване', '#14b8a6'), ('proud', 'гордост', '#eab308'),
       ('bored', 'скука', '#94a3b8'), ('love', 'обич', '#e11d48')]


def wrap(text, font, size, max_w):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if pdfmetrics.stringWidth(t, font, size) <= max_w:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def para(c, text, x, y, max_w, size=14, font='Nunito-Bold', color=INK, align='center', leading=1.3):
    """Текст с пренасяне; y е горният ред. Връща долната граница."""
    for ln in wrap(text, font, size, max_w):
        label(c, ln, x, y, size, font, color, align)
        y -= size * leading
    return y


@material('emotion-cards', 'Карти с емоции',
          'Дванадесет карти с емоции — радост, тъга, гняв, страх, изненада, спокойствие, умора, тревога и др. За назоваване, „покажи как се чувстваш“ и игри.',
          'cards', ['social', 'expressive'], name_line=False)
def emotion_cards(doc):
    doc.new_page('Карти с емоции', 'Изрежи. Назови емоцията и покажи с лицето си.', name_line=False)
    grid_cards(doc, 3, 4, EMO, lambda c, it, x, y, w, h: picto_card(c, it[0], it[1], x + 5, y + 5, w - 10, h - 10,
                                                                   color=it[2], fill=tint(it[2], 0.9)))


@material('feelings-checkin', 'Как се чувствам днес?',
          'Лист за сутрешна проверка на чувствата: огради лицето, нарисувай защо и какво ще ти помогне.',
          'worksheet', ['social', 'expressive'])
def feelings_checkin(doc):
    c = doc.c
    doc.new_page('Как се чувствам днес?', 'Огради как се чувстваш.')
    six = EMO[:6]
    cw = (doc.w - 2 * M) / 3
    for i, (k, t, col) in enumerate(six):
        x = M + (i % 3) * cw
        y = doc.top - (i // 3 + 1) * 150
        picto_card(c, k, t, x + 8, y + 8, cw - 16, 134, color=col, fill=tint(col, 0.9))
    y = doc.top - 340
    label(c, 'Чувствам се така, защото…', M, y, 16, font='Nunito-Black', align='left')
    card(c, M, y - 190, doc.w - 2 * M, 176, fill=SOFT, stroke=LINE, r=16)
    label(c, 'нарисувай или напиши', doc.w - M - 12, y - 182, 9, color=MUTED, align='right')
    y -= 230
    label(c, 'Какво ще ми помогне?', M, y, 16, font='Nunito-Black', align='left')
    opts = [('hug', 'прегръдка'), ('break', 'почивка'), ('water', 'вода'), ('yoga', 'дишане'), ('talk', 'да поговоря'),
            ('music', 'музика')]
    ow = (doc.w - 2 * M) / 6
    for i, (k, t) in enumerate(opts):
        picto_card(c, k, t, M + i * ow + 4, doc.bottom, ow - 8, y - 16 - doc.bottom)


@material('emotion-match', 'Свържи лицето с думата',
          'Свържи всяко лице с името на емоцията. Разпознаване на емоции и четене на думи.',
          'worksheet', ['social', 'academic'])
def emotion_match(doc):
    for p in range(2):
        doc.new_page('Свържи лицето с думата', 'Как се чувства? Свържи лицето с думата.')
        rows = EMO[p * 5:(p + 1) * 5]
        right = rows[:]
        rnd = random.Random(p + 50)
        while any(a == b for a, b in zip(rows, right)):
            rnd.shuffle(right)

        def word(c, it, x, y, w, h):
            label(c, it[1], x + w / 2, y + h / 2 - 8, 22, font='Andika-Bold', color=INK)
        connect_columns(doc, rows, right, lambda c, it, *b: centered_picto(c, it[0], *b), word)


SCALE = [(5, 'Избухвам', 'Не мога да се спра. Трябва ми помощ.', '#dc2626', 'angry'),
         (4, 'Много съм ядосан', 'Тялото ми е напрегнато, говоря силно.', '#f97316', 'angry'),
         (3, 'Нервен съм', 'Нещо ме дразни или тревожи.', '#eab308', 'worried'),
         (2, 'Добре съм', 'Мога да работя и да играя.', '#22c55e', 'happy'),
         (1, 'Спокоен съм', 'Тялото ми е отпуснато.', '#3b82f6', 'calm')]


@material('scale-5', 'Моята скала 1–5',
          'Скала на напрежението от 1 (спокоен) до 5 (избухвам) с празно място за личните стратегии на детето. Попълва се заедно с детето.',
          'board', ['social', 'sensory'], name_line=True)
def scale5(doc):
    c = doc.c
    doc.new_page('Моята скала', 'Покажи на коя стъпка си. Какво мога да направя, за да сляза надолу?')
    rh = (doc.top - doc.bottom) / 5
    label(c, 'Как се чувствам', M + 150, doc.top + 2, 9, color=MUTED)
    label(c, 'Какво мога да направя', M + 395, doc.top + 2, 9, color=MUTED)
    for i, (n, t, sub, col, pk) in enumerate(SCALE):
        y = doc.top - (i + 1) * rh
        card(c, M, y + 4, doc.w - 2 * M, rh - 8, fill=tint(col, 0.88), stroke=HexColor(col), r=18, lw=2)
        c.setFillColor(HexColor(col))
        c.roundRect(M, y + 4, 64, rh - 8, 18, stroke=0, fill=1)
        c.rect(M + 40, y + 4, 24, rh - 8, stroke=0, fill=1)
        label(c, str(n), M + 32, y + rh / 2 - 16, 42, font='Nunito-Black', color=white)
        picto(c, pk, M + 76, y + rh / 2 - 26, 52)
        label(c, t, M + 138, y + rh / 2 + 6, 16, font='Nunito-Black', color=INK, align='left')
        para(c, sub, M + 138, y + rh / 2 - 12, 150, 9.5, font='Nunito', color=INK, align='left')
        x = M + 300
        card(c, x, y + 14, doc.w - M - 12 - x, rh - 28, fill=white, stroke=HexColor(col), r=12, lw=1, dash=(4, 3))


CALM = [('yoga', 'дишам бавно'), ('water', 'пия вода'), ('headphones', 'слушалки'), ('hug', 'прегръдка'),
        ('teddy', 'гушкам мече'), ('music', 'спокойна музика'), ('break', 'тихо място'), ('book', 'разглеждам книжка'),
        ('blocks', 'подреждам'), ('walk', 'разходка'), ('bubbles', 'балончета'), ('crayon', 'рисувам')]


@material('calm-menu', 'Меню за успокояване',
          'Табло с 12 начина да се успокоиш — дишане, слушалки, вода, тихо място, мече… Детето избира, когато е напрегнато. С място за отметки.',
          'board', ['sensory', 'social'], name_line=True)
def calm_menu(doc):
    c = doc.c
    doc.new_page('Какво ми помага да се успокоя', 'Посочи какво искаш да направиш. Отбележи кое ти помага най-много.')
    cw, ch = grid_cards(doc, 3, 4, CALM, lambda c, it, x, y, w, h: (
        picto_card(c, it[0], it[1], x + 5, y + 5, w - 10, h - 10, color='#0d9488', fill=tint('#0d9488', 0.92)),
        card(c, x + w - 34, y + h - 34, 20, 20, fill=white, stroke=HexColor('#0d9488'), r=5, lw=1.4)), cut=False)


def breath_page(doc, title, ins, draw):
    doc.new_page(title, ins, name_line=False)
    draw(doc.c, doc)


@material('breathing', 'Карти за дишане',
          'Пет упражнения за дишане с рисунка за проследяване с пръст: цвете и свещ, квадрат, звезда, балон, вълни. За успокояване и саморегулация.',
          'cards', ['sensory', 'social'], name_line=False)
def breathing(doc):
    G, B = HexColor('#10b981'), HexColor('#3b82f6')

    def flower(c, doc):
        cx = doc.w / 2
        y = doc.top - 60
        for i, (k, t, sub, col) in enumerate([('flower', 'Помириши цветето', 'Вдишай бавно през носа…', '#ec4899'),
                                              ('candle', 'Духни свещта', '…издишай бавно през устата.', '#f59e0b')]):
            yy = y - (i + 1) * 300 + 20
            card(c, M + 30, yy, doc.w - 2 * M - 60, 270, fill=tint(col, 0.9), stroke=HexColor(col), r=24, lw=2.5)
            picto(c, k, cx - 80, yy + 80, 160)
            label(c, t, cx, yy + 48, 26, font='Nunito-Black', color=HexColor(col))
            label(c, sub, cx, yy + 22, 15, font='Nunito', color=INK)
        label(c, 'Повтори 5 пъти.', cx, doc.bottom + 10, 14, color=MUTED)

    def square(c, doc):
        cx, cy, r = doc.w / 2, (doc.top + doc.bottom) / 2 + 20, 180
        pts = [(cx - r, cy - r), (cx - r, cy + r), (cx + r, cy + r), (cx + r, cy - r), (cx - r, cy - r)]
        path(c, pts, color=B, lw=10)
        for (x1, y1), (x2, y2), t in zip(pts, pts[1:], ['вдишай — 4', 'задръж — 4', 'издишай — 4', 'задръж — 4']):
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            arrow(c, mx - (x2 - x1) * 0.12, my - (y2 - y1) * 0.12, mx + (x2 - x1) * 0.12, my + (y2 - y1) * 0.12,
                  color=white, lw=3, head=10)
            ox = 0 if x1 == x2 else 0
            oy = 0
            if x1 == x2:
                ox = -40 if x1 < cx else 40
                c.saveState()
                c.translate(mx + ox, my)
                c.rotate(90)
                label(c, t, 0, -6, 16, font='Nunito-Black', color=B)
                c.restoreState()
            else:
                label(c, t, mx, my + (22 if y1 > cy else -36), 16, font='Nunito-Black', color=B)
        dot(c, cx - r, cy - r, 12, G)
        picto(c, 'yoga', cx - 60, cy - 60, 120)
        label(c, 'Започни от зелената точка. Води пръста по линията и брой до 4 на всяка страна.', cx, doc.bottom + 10, 12, color=MUTED)

    def star(c, doc):
        cx, cy = doc.w / 2, (doc.top + doc.bottom) / 2 + 10
        pts = star_pts(cx, cy, 230, 100)
        path(c, pts, color=HexColor('#f59e0b'), lw=9, fill=tint('#f59e0b', 0.88))
        dot(c, *pts[1], 10, G)
        label(c, 'Нагоре — вдишай', cx, cy + 4, 15, font='Nunito-Black', color=INK)
        label(c, 'Надолу — издишай', cx, cy - 16, 15, font='Nunito-Black', color=INK)
        label(c, 'Започни от зелената точка и обиколи цялата звезда.', cx, doc.bottom + 10, 12, color=MUTED)

    def balloon(c, doc):
        cx = doc.w / 2
        for row, (sizes, t, col) in enumerate([([70, 120, 170], 'Вдишай — балонът се надува', '#ef4444'),
                                               ([170, 120, 70], 'Издишай — балонът се свива', '#3b82f6')]):
            base = doc.top - 40 - row * 330
            label(c, t, cx, base - 18, 20, font='Nunito-Black', color=HexColor(col))
            xs = [M + 80, cx, doc.w - M - 100]
            for k, (x, s) in enumerate(zip(xs, sizes)):
                picto(c, 'balloon', x - s / 2, base - 60 - 200 + (200 - s) / 2, s)
                if k < 2:
                    arrow(c, x + 60, base - 160, xs[k + 1] - 60, base - 160, color=HexColor(col), lw=3, head=10)
        label(c, 'Сложи ръце на корема и усети как се движи.', cx, doc.bottom + 10, 12, color=MUTED)

    def waves(c, doc):
        x1, x2 = M + 30, doc.w - M - 30
        for k in range(3):
            y = doc.top - 140 - k * 170
            pts = [(x1 + (x2 - x1) * t / 200, y + 50 * math.sin(t / 200 * 3 * 2 * math.pi)) for t in range(201)]
            path(c, pts, color=B, lw=8)
            dot(c, *pts[0], 10, G)
            for j in range(3):
                xa = x1 + (x2 - x1) * (j / 3 + 1 / 12)
                xb = x1 + (x2 - x1) * (j / 3 + 3 / 12)
                label(c, 'вдишай', xa, y + 66, 12, font='Nunito-Black', color=B)
                label(c, 'издишай', xb, y - 80, 12, font='Nunito-Black', color=B)
        picto(c, 'wave', doc.w / 2 - 30, doc.bottom + 30, 60)
        label(c, 'Води пръста по вълните: нагоре — вдишай, надолу — издишай.', doc.w / 2, doc.bottom + 10, 12, color=MUTED)

    breath_page(doc, 'Цвете и свещ', 'Вдишай, все едно миришеш цвете. Издишай, все едно духаш свещ.', flower)
    breath_page(doc, 'Дишане по квадрата', 'Бавно, по четирите страни.', square)
    breath_page(doc, 'Дишане със звезда', 'Обиколи звездата с пръст.', star)
    breath_page(doc, 'Балон в коремчето', 'Дишай с корема.', balloon)
    breath_page(doc, 'Вълни', 'Като морето — бавно и спокойно.', waves)


def social_story(doc, title, panels, color):
    """Социална история: 6 кадъра (2×3) на страница, по едно изречение от първо лице."""
    c = doc.c
    per = 6
    for p in range(0, len(panels), per):
        doc.new_page(title, 'Прочетете заедно. Детето сочи картинките.', name_line=False)
        chunk = panels[p:p + per]
        gap = 12
        W = (doc.w - 2 * M - gap) / 2
        H = (doc.top - doc.bottom - 2 * gap) / 3
        for i, (keys, text) in enumerate(chunk):
            x = M + (i % 2) * (W + gap)
            y = doc.top - (i // 2 + 1) * H - (i // 2) * gap
            card(c, x, y, W, H, fill=white, stroke=HexColor(color), r=18, lw=1.8)
            c.setFillColor(tint(color, 0.9))
            c.roundRect(x + 8, y + 70, W - 16, H - 78, 12, stroke=0, fill=1)
            n = len(keys)
            s = min((W - 40) / n - 10, H - 100)
            tot = n * s + (n - 1) * 14
            for k, key in enumerate(keys):
                picto(c, key, x + (W - tot) / 2 + k * (s + 14), y + 70 + (H - 78 - s) / 2, s)
            c.setFillColor(HexColor(color))
            c.circle(x + 22, y + H - 22, 12, stroke=0, fill=1)
            label(c, str(p + i + 1), x + 22, y + H - 27, 13, font='Nunito-Black', color=white)
            lines = wrap(text, 'Nunito-Bold', 13, W - 24)
            yy = y + 38 + (len(lines) - 1) * 8
            for ln in lines:
                label(c, ln, x + W / 2, yy, 13, font='Nunito-Bold')
                yy -= 16


@material('story-angry', 'Социална история: Когато се ядосам',
          'Кратка история от първо лице: какво става, когато се ядосам, и какво мога да направя — да спра, да дишам, да поискам почивка.',
          'story', ['social', 'sensory'], name_line=False)
def story_angry(doc):
    social_story(doc, 'Когато се ядосам', [
        (['me', 'angry'], 'Понякога се ядосвам. Всички хора понякога се ядосват.'),
        (['angry', 'fire'], 'Когато съм ядосан, тялото ми става горещо и напрегнато.'),
        (['stop', 'hand'], 'Мога да кажа „Стоп“ и да спра. Не удрям и не хвърлям.'),
        (['yoga'], 'Дишам бавно: вдишвам през носа и издишвам през устата.'),
        (['break', 'headphones'], 'Мога да поискам почивка или слушалки.'),
        (['calm', 'clap'], 'Когато се успокоя, се връщам. Учителят се радва!'),
    ], '#e11d48')


@material('story-waiting', 'Социална история: Чакам реда си',
          'История за чакане на ред — в игра, на опашка, при говорене. С идеи какво да правя, докато чакам.',
          'story', ['social'], name_line=False)
def story_waiting(doc):
    social_story(doc, 'Чакам реда си', [
        (['class'], 'В класа сме много деца. Всички искаме да играем.'),
        (['ball', 'you'], 'Понякога друго дете играе първо. Тогава чакам.'),
        (['wait'], 'Да чакам е трудно, но мога да се справя.'),
        (['yoga', 'look'], 'Докато чакам, дишам спокойно и гледам играта.'),
        (['me', 'ball'], 'Скоро идва моят ред. Сега играя аз!'),
        (['happy', 'clap'], 'Когато чакам, приятелите ми се радват да играят с мен.'),
    ], '#f59e0b')


@material('story-change', 'Социална история: Когато има промяна',
          'История за неочаквани промени в графика — друг учител, отменена дейност, нова стая. Подготвя детето, че промяната е нормална.',
          'story', ['social', 'sensory'], name_line=False)
def story_change(doc):
    social_story(doc, 'Когато има промяна', [
        (['calendar'], 'Всеки ден имам график. Знам какво следва.'),
        (['surprised'], 'Понякога графикът се променя. Това се случва на всички.'),
        (['teacher'], 'Може да дойде друг учител или да сме в друга стая.'),
        (['worried', 'yoga'], 'Ако се притесня, дишам бавно и питам какво следва.'),
        (['look', 'calendar'], 'Учителят ми показва новия график.'),
        (['calm', 'proud'], 'Справям се с промяната. Гордея се със себе си!'),
    ], '#7c3aed')


@material('story-hello', 'Социална история: Казвам здравей',
          'История за поздрав — как да поздравя, да погледна и да отговоря. Първи стъпки в общуването с връстници.',
          'story', ['social', 'expressive'], name_line=False)
def story_hello(doc):
    social_story(doc, 'Казвам здравей', [
        (['school', 'class'], 'Сутрин идвам в училище. Там са приятелите ми.'),
        (['look', 'happy'], 'Когато видя приятел, го поглеждам и се усмихвам.'),
        (['hello'], 'Махам с ръка или казвам „Здравей!“.'),
        (['you', 'hello'], 'Приятелят ми също казва „Здравей!“.'),
        (['talk'], 'Мога да попитам: „Ще играеш ли с мен?“'),
        (['class', 'happy'], 'Хората се радват, когато ги поздравя.'),
    ], '#0d9488')


@material('story-therapy', 'Социална история: Отивам на терапия',
          'История за ходенето при логопед, психолог или рехабилитатор — кой ме взима, какво правим, кога се връщам в класа.',
          'story', ['social', 'receptive'], name_line=False)
def story_therapy(doc):
    social_story(doc, 'Отивам на терапия', [
        (['calendar', 'clock'], 'В някои дни имам терапия. Виждам я в графика си.'),
        (['teacher', 'walk'], 'Специалистът идва да ме вземе от класа.'),
        (['speech', 'psychologist', 'therapy_move'], 'Може да е логопед, психолог или рехабилитатор.'),
        (['puzzle', 'talk'], 'Заедно играем, говорим и упражняваме.'),
        (['bell', 'class'], 'Когато свършим, се връщам в класа.'),
        (['proud', 'clap'], 'Терапията ми помага да уча нови неща!'),
    ], '#2563eb')
