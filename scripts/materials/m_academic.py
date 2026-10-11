"""Учебни умения: цифри и броене, буквите А–Я, срички, първи звук, събиране с картинки."""
import random

from kit import *

GREEN = HexColor('#10b981')
WORDS = ['нула', 'едно', 'две', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет', 'десет']
COUNT_PICTO = ['', 'sun', 'cat', 'apple', 'car', 'star', 'balloon', 'fish', 'strawberry', 'butterfly', 'duck']


def guide_lines(c, x1, x2, y, h, color=LINE):
    """Редове за писане: основна линия, пунктирна среда, горна линия."""
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(0.9)
    c.line(x1, y, x2, y)
    c.line(x1, y + h, x2, y + h)
    c.setDash(3, 3)
    c.line(x1, y + h * 0.5, x2, y + h * 0.5)
    c.restoreState()


def trace_row(c, text, x1, x2, y, size, first_color, gap=None, font='Andika'):
    """Ред: първият знак в цвят, следващите — светли за проследяване."""
    w = pdfmetrics.stringWidth(text, font, size)
    gap = gap or w * 0.6
    guide_lines(c, x1, x2, y, size * 0.72)
    x = x1 + 8
    i = 0
    while x + w < x2:
        if i == 0:
            label(c, text, x, y, size, font=font, color=first_color, align='left')
        else:
            trace_text(c, text, x, y, size, font=font)
        x += w + gap
        i += 1


def ten_frame(c, x, y, w, n, color):
    s = w / 5
    for i in range(10):
        r, k = divmod(i, 5)
        X, Y = x + k * s, y + (1 - r) * s
        c.setStrokeColor(LINE)
        c.setLineWidth(1)
        c.setFillColor(white)
        c.rect(X, Y, s, s, stroke=1, fill=1)
        if i < n:
            dot(c, X + s / 2, Y + s / 2, s * 0.32, color)


def scatter(c, key, n, x, y, w, h, size, seed=0):
    """n пиктограми, подредени в решетка в кутия (без застъпване)."""
    if n == 0:
        return
    cols = min(n, 5)
    rows = (n + cols - 1) // cols
    s = min(size, w / cols * 0.85, h / rows * 0.85)
    for i in range(n):
        r, k = divmod(i, cols)
        in_row = cols if r < rows - 1 else n - cols * (rows - 1)
        X = x + (w - in_row * s / 0.85) / 2 + k * s / 0.85 + s * 0.075
        Y = y + h - (r + 1) * (h / rows) + (h / rows - s) / 2
        picto(c, key, X, Y, s)


@material('digits', 'Цифрите от 0 до 10',
          'По една страница за всяка цифра: голяма цифра за проследяване, броене с картинки и десетична рамка, редове за писане и „намери цифрата“.',
          'worksheet', ['academic', 'fine_motor'])
def digits(doc):
    c = doc.c
    for n in range(11):
        col = PALETTE[n % len(PALETTE)]
        doc.new_page(f'Цифрата {n}', 'Проследи с пръст, после с молив. Преброй картинките.')
        top = doc.top
        # голяма цифра
        card(c, M, top - 260, 250, 260, fill=tint(col, 0.9), stroke=None, r=18)
        trace_text(c, str(n), M + 125, top - 220, 230 if n < 10 else 160, font='Andika-Bold', color=HexColor(col),
                   dashed=True, align='center', lw=2.4)
        label(c, WORDS[n], M + 125, top - 248, 18, color=HexColor(col))
        # броене
        x = M + 266
        w = doc.w - M - x
        card(c, x, top - 260, w, 260, fill=SOFT, stroke=None, r=18)
        if n:
            scatter(c, COUNT_PICTO[n], n, x + 10, top - 175, w - 20, 165, 70)
        else:
            label(c, 'няма нищо', x + w / 2, top - 100, 18, color=MUTED)
        ten_frame(c, x + 30, top - 246, w - 60, n, HexColor(col))
        # редове за писане
        y = top - 340
        for _ in range(3):
            trace_row(c, str(n), M, doc.w - M, y, 58, HexColor(col))
            y -= 80
        guide_lines(c, M, doc.w - M, y, 58 * 0.72)
        # намери цифрата
        y = doc.bottom + 14
        label(c, f'Огради всички {n}:', M + 4, y + 8, 12, align='left', color=MUTED)
        rnd = random.Random(n)
        seq = [n if rnd.random() < 0.35 else rnd.randint(0, 10) for _ in range(12)]
        x = M + 120
        step = (doc.w - M - x) / 12
        for v in seq:
            label(c, str(v), x + step / 2, y + 4, 22, font='Nunito-Bold', color=INK)
            x += step


ALPHA = [('А', 'ананас', 'pineapple'), ('Б', 'банан', 'banana'), ('В', 'влак', 'train'), ('Г', 'гъба', 'mushroom'),
         ('Д', 'дърво', 'tree'), ('Е', 'елен', 'deer'), ('Ж', 'жираф', 'giraffe'), ('З', 'заек', 'rabbit'),
         ('И', 'игла', 'needle'), ('Й', 'йо-йо', 'yoyo'), ('К', 'котка', 'cat'), ('Л', 'лъв', 'lion'),
         ('М', 'мечка', 'bear'), ('Н', 'нос', 'nose'), ('О', 'облак', 'cloud'), ('П', 'пеперуда', 'butterfly'),
         ('Р', 'риба', 'fish'), ('С', 'слон', 'elephant'), ('Т', 'торта', 'cake'), ('У', 'ухо', 'ear'),
         ('Ф', 'фламинго', 'flamingo'), ('Х', 'хляб', 'bread'), ('Ц', 'цвете', 'flower'), ('Ч', 'часовник', 'clock2'),
         ('Ш', 'шапка', 'hat'), ('Щ', 'щастлив', 'happy'), ('Ъ', 'ъгъл', 'triangle_ruler'), ('Ь', 'шофьор', 'car'),
         ('Ю', 'юмрук', 'fist'), ('Я', 'ябълка', 'apple')]


def word_with_letter(c, word, letter, x, y, size, color, align='center'):
    """Думата с подчертана (оцветена) буква."""
    i = word.lower().find(letter.lower())
    parts = [(word[:i], INK), (word[i], HexColor(color)), (word[i + 1:], INK)] if i >= 0 else [(word, INK)]
    total = sum(pdfmetrics.stringWidth(p, 'Andika-Bold', size) for p, _ in parts)
    xx = x - total / 2 if align == 'center' else x
    for p, col in parts:
        label(c, p, xx, y, size, font='Andika-Bold', color=col, align='left')
        xx += pdfmetrics.stringWidth(p, 'Andika-Bold', size)


@material('alphabet', 'Буквите от А до Я',
          'Тридесет страници — по една за всяка буква: главна и малка буква за проследяване, картинка и дума, редове за писане. Шрифт Andika — ясни форми за начинаещи.',
          'worksheet', ['academic', 'fine_motor'])
def alphabet(doc):
    c = doc.c
    for i, (L, word, pk) in enumerate(ALPHA):
        col = PALETTE[i % len(PALETTE)]
        doc.new_page(f'Буквата {L} {L.lower()}', 'Проследи буквите. Кажи думата и чуй звука.')
        top = doc.top
        card(c, M, top - 230, 300, 230, fill=tint(col, 0.9), stroke=None, r=18)
        trace_text(c, L, M + 90, top - 180, 170, font='Andika-Bold', color=HexColor(col), dashed=True, align='center', lw=2.4)
        trace_text(c, L.lower(), M + 225, top - 180, 170, font='Andika-Bold', color=HexColor(col), dashed=True,
                   align='center', lw=2.4)
        x = M + 314
        w = doc.w - M - x
        card(c, x, top - 230, w, 230, fill=SOFT, stroke=None, r=18)
        picto(c, pk, x + (w - 140) / 2, top - 168, 140)
        word_with_letter(c, word, L, x + w / 2, top - 212, 28, col)
        y = top - 310
        for t in [L, L, L.lower(), L.lower()]:
            trace_row(c, t, M, doc.w - M, y, 56, HexColor(col))
            y -= 78
        # дума за проследяване
        guide_lines(c, M, doc.w - M, y, 56 * 0.72)
        fs = 56 if pdfmetrics.stringWidth(word, 'Andika', 56) < 220 else 44
        label(c, word, M + 8, y, fs, font='Andika', color=HexColor(col), align='left')
        trace_text(c, word, M + 40 + pdfmetrics.stringWidth(word, 'Andika', fs), y, fs)
        y -= 78
        guide_lines(c, M, doc.w - M, y, 56 * 0.72)


@material('alphabet-cards', 'Азбука — карти с картинки',
          'Тридесет карти за изрязване: буква, картинка и дума. За стена, игри „намери буквата“ и подреждане.',
          'cards', ['academic', 'receptive'], name_line=False)
def alphabet_cards(doc):
    for p in range(3):
        doc.new_page('Азбука — карти', 'Изрежи по пунктира.', name_line=False)
        items = list(enumerate(ALPHA))[p * 12:(p + 1) * 12]

        def draw(c, it, x, y, w, h):
            i, (L, word, pk) = it
            col = PALETTE[i % len(PALETTE)]
            label(c, f'{L}{L.lower()}', x + 14, y + h - 46, 36, font='Andika-Bold', color=HexColor(col), align='left')
            s = min(w, h) * 0.5
            picto(c, pk, x + w - s - 12, y + h - s - 12, s)
            word_with_letter(c, word, L, x + w / 2, y + 16, 20, col)
        grid_cards(doc, 3, 4, items, draw)


@material('number-cards', 'Карти с числа 0–10',
          'Единадесет карти: цифра, дума, десетична рамка и точки. За броене, сравняване и подреждане по ред.',
          'cards', ['academic', 'cognitive'], name_line=False)
def number_cards(doc):
    for p in range(2):
        doc.new_page('Карти с числа', 'Изрежи по пунктира.', name_line=False)
        items = list(range(11))[p * 6:(p + 1) * 6]

        def draw(c, n, x, y, w, h):
            col = HexColor(PALETTE[n % len(PALETTE)])
            label(c, str(n), x + w / 2, y + h - 110, 96, font='Nunito-Black', color=col)
            label(c, WORDS[n], x + w / 2, y + h - 140, 18, color=INK)
            ten_frame(c, x + 28, y + 26, w - 56, n, col)
        grid_cards(doc, 2, 3, items, draw)


@material('count-circle', 'Преброй и огради',
          'Преброй картинките и огради правилното число. Три нива: до 5, до 8 и до 10.',
          'worksheet', ['academic', 'cognitive'])
def count_circle(doc):
    c = doc.c
    keys = ['apple', 'star', 'ball', 'fish', 'car', 'duck', 'flower', 'heart', 'balloon', 'cat', 'bee', 'ladybug',
            'strawberry', 'butterfly', 'sun']
    rnd = random.Random(5)
    for lvl, (lo, hi) in enumerate([(1, 5), (3, 8), (5, 10)]):
        doc.new_page(f'Преброй и огради (до {hi})', 'Колко са? Огради числото.')
        rows = 5
        rh = (doc.top - doc.bottom) / rows
        for r in range(rows):
            n = rnd.randint(lo, hi)
            key = keys[(lvl * 5 + r) % len(keys)]
            y = doc.top - (r + 1) * rh
            card(c, M, y + 6, 330, rh - 12, fill=SOFT, stroke=None, r=14)
            scatter(c, key, n, M + 10, y + 12, 310, rh - 24, 56)
            opts = {n}
            while len(opts) < 3:
                opts.add(max(0, min(10, n + rnd.choice([-2, -1, 1, 2, 3]))))
            opts = sorted(opts)
            for k, v in enumerate(opts):
                cx = M + 380 + k * 52
                c.setStrokeColor(LINE)
                c.setLineWidth(1.2)
                c.circle(cx, y + rh / 2, 23, stroke=1, fill=0)
                label(c, str(v), cx, y + rh / 2 - 9, 26, font='Nunito-Black', color=INK)


@material('count-match', 'Свържи количеството с числото',
          'Свържи всяка група картинки с правилното число. Тренира съответствие количество–цифра.',
          'worksheet', ['academic', 'cognitive'])
def count_match(doc):
    c = doc.c
    sets = [[(2, 'cat'), (4, 'apple'), (1, 'sun'), (5, 'star'), (3, 'fish')],
            [(6, 'balloon'), (9, 'strawberry'), (7, 'duck'), (10, 'flower'), (8, 'ladybug')]]
    for p, rows in enumerate(sets):
        doc.new_page('Свържи количеството с числото', 'Преброй и свържи с линия.')
        nums = [n for n, _ in rows]
        random.Random(p + 3).shuffle(nums)
        rh = (doc.top - doc.bottom) / len(rows)
        for i, (n, key) in enumerate(rows):
            y = doc.top - (i + 1) * rh
            card(c, M, y + 6, 300, rh - 12, fill=SOFT, stroke=None, r=14)
            scatter(c, key, n, M + 8, y + 12, 284, rh - 24, 50)
            dot(c, M + 316, y + rh / 2, 6, HexColor(doc.color))
            v = nums[i]
            dot(c, doc.w - M - 110, y + rh / 2, 6, HexColor(doc.color))
            card(c, doc.w - M - 90, y + rh / 2 - 34, 86, 68, fill=white, stroke=LINE, r=14)
            label(c, str(v), doc.w - M - 47, y + rh / 2 - 15, 40, font='Nunito-Black', color=HexColor(PALETTE[v % 8]))


@material('addition', 'Събиране с картинки',
          'Задачи за събиране с картинки — до 5 и до 10. Преброй двете групи и напиши колко са общо.',
          'worksheet', ['academic', 'cognitive'])
def addition(doc):
    c = doc.c
    rnd = random.Random(9)
    keys = ['apple', 'star', 'fish', 'duck', 'car', 'balloon', 'strawberry', 'flower', 'cat', 'ball', 'heart', 'bee']
    for lvl, top_sum in enumerate([5, 10]):
        doc.new_page(f'Събиране до {top_sum}', 'Преброй и напиши колко са общо.')
        rows = 6
        rh = (doc.top - doc.bottom) / rows
        for r in range(rows):
            a = rnd.randint(1, top_sum - 1)
            b = rnd.randint(1, top_sum - a)
            key = keys[(lvl * 6 + r) % len(keys)]
            y = doc.top - (r + 1) * rh
            bw = 165 if top_sum == 5 else 175
            for k, n in enumerate([a, b]):
                bx = M + k * (bw + 40)
                card(c, bx, y + 8, bw, rh - 16, fill=SOFT, stroke=None, r=12)
                scatter(c, key, n, bx + 6, y + 30, bw - 12, rh - 46, 30)
                label(c, str(n), bx + bw / 2, y + 13, 13, color=MUTED)
            label(c, '+', M + bw + 20, y + rh / 2 - 10, 28, font='Nunito-Black', color=HexColor(doc.color))
            x = M + 2 * bw + 40
            label(c, '=', x + 22, y + rh / 2 - 10, 28, font='Nunito-Black', color=HexColor(doc.color))
            card(c, x + 46, y + rh / 2 - 30, 70, 60, fill=white, stroke=HexColor(doc.color), r=12, lw=1.6)


SYLL = [('ри-ба', 'fish'), ('ко-ла', 'car'), ('ку-че', 'dog'), ('ба-нан', 'banana'), ('лъв', 'lion'), ('гъ-ба', 'mushroom'),
        ('ра-ке-та', 'rocket'), ('пе-пе-ру-да', 'butterfly'), ('слон', 'elephant'), ('та-ра-леж', 'hedgehog'),
        ('ди-ня', 'watermelon'), ('ав-то-бус', 'bus'), ('кит', 'whale'), ('мор-ков', 'carrot'),
        ('ко-сте-нур-ка', 'turtle'), ('хляб', 'bread'), ('я-бъл-ка', 'apple'), ('хе-ли-коп-тер', 'helicopter')]


@material('syllables', 'Пляскай сричките',
          'Кажи думата, пляскай сричките и оцвети толкова кръгчета. Фонологично осъзнаване — от 1 до 4 срички.',
          'worksheet', ['academic', 'receptive', 'expressive'])
def syllables(doc):
    c = doc.c
    for p in range(3):
        doc.new_page('Пляскай сричките', 'Кажи думата. Пляскай. Оцвети по едно кръгче за всяко пляскане.')
        rows = SYLL[p * 6:(p + 1) * 6]
        rh = (doc.top - doc.bottom) / 6
        for i, (w, key) in enumerate(rows):
            y = doc.top - (i + 1) * rh
            picto(c, key, M + 6, y + (rh - 64) / 2, 64)
            label(c, w.replace('-', ''), M + 90, y + rh / 2 + 4, 24, font='Andika-Bold', align='left')
            label(c, w.replace('-', ' · '), M + 90, y + rh / 2 - 18, 13, font='Andika', color=MUTED, align='left')
            picto(c, 'clap', M + 300, y + rh / 2 - 15, 30)
            for k in range(4):
                c.setStrokeColor(HexColor(PALETTE[k + 2]))
                c.setLineWidth(2)
                c.circle(M + 360 + k * 46, y + rh / 2, 17, stroke=1, fill=0)
            if i < 5:
                c.setStrokeColor(LINE)
                c.setLineWidth(0.6)
                c.line(M, y, doc.w - M, y)


FIRST = [('котка', 'cat', 'КМС'), ('слон', 'elephant', 'ЛСР'), ('ябълка', 'apple', 'ЯАЮ'), ('риба', 'fish', 'БРП'),
         ('мечка', 'bear', 'НМТ'), ('банан', 'banana', 'ДБВ'), ('топка', 'ball', 'ТДК'), ('жираф', 'giraffe', 'ЗШЖ'),
         ('влак', 'train', 'ВФБ'), ('дърво', 'tree', 'ТДГ'), ('лъв', 'lion', 'ЛНР'), ('пица', 'pizza', 'БПТ'),
         ('заек', 'rabbit', 'СЗЦ'), ('гъба', 'mushroom', 'КГХ'), ('сладолед', 'icecream', 'ШСЗ'), ('торта', 'cake', 'ДТП'),
         ('кола', 'car', 'ГКХ'), ('ухо', 'ear', 'ОУЮ'), ('нос', 'nose', 'МНЛ'), ('чадър', 'umbrella', 'ШЧЦ'),
         ('хляб', 'bread', 'ХКГ'), ('облак', 'cloud', 'ОАУ'), ('цвете', 'flower', 'СЦЧ'), ('шапка', 'hat', 'ЖШС')]


@material('first-sound', 'С кой звук започва?',
          'Кажи думата и огради буквата, с която започва. 24 картинки, по три възможности.',
          'worksheet', ['academic', 'receptive'])
def first_sound(doc):
    for p in range(3):
        doc.new_page('С кой звук започва?', 'Кажи думата. Огради първата буква.')
        items = FIRST[p * 8:(p + 1) * 8]

        def draw(c, it, x, y, w, h):
            word, key, opts = it
            s = min(h - 30, w * 0.4)
            picto(c, key, x + 14, y + (h - s) / 2 + 6, s - 10)
            label(c, word, x + 14 + (s - 10) / 2, y + 8, 11, font='Andika', color=MUTED)
            step = (w - s - 30) / 3
            for k, L in enumerate(opts):
                cx = x + s + 18 + step * (k + 0.5)
                label(c, L, cx, y + h / 2 - 12, 32, font='Andika-Bold', color=INK)
        grid_cards(doc, 2, 4, items, draw, cut=True)
