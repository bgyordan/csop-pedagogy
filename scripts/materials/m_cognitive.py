"""Познавателни умения: свържи еднаквите, сенки, кое не е на мястото си, категории, редици, мемори, пъзели, голямо–малко."""
import random

from kit import *
from m_academic import scatter

ANIMALS = ['dog', 'cat', 'fish', 'bird', 'horse', 'cow', 'pig', 'chicken', 'sheep', 'rabbit', 'bear', 'lion', 'elephant',
           'butterfly', 'frog', 'monkey', 'giraffe', 'duck', 'owl', 'turtle', 'snail', 'bee', 'fox', 'panda']
FOOD = ['apple', 'banana', 'bread', 'cheese', 'carrot', 'pizza', 'pear', 'grapes', 'strawberry', 'watermelon', 'orange',
        'pineapple', 'egg', 'tomato', 'cucumber', 'icecream', 'cake', 'cookie', 'milk', 'soup', 'mushroom', 'chocolate']
VEHICLES = ['bus', 'car', 'train', 'plane', 'ship', 'bicycle', 'truck', 'tractor', 'rocket', 'helicopter', 'ambulance',
            'firetruck']
CLOTHES = ['tshirt', 'trousers', 'shoes', 'socks', 'coat', 'cap', 'hat', 'glasses']
SCHOOL = ['pencil', 'book', 'scissors', 'backpack', 'ruler', 'glue', 'notebook', 'crayon', 'pen', 'abacus']


def connect_columns(doc, left, right, draw_left, draw_right, row_h=None):
    """Два стълба за свързване с линия; right е разбъркан ред."""
    c = doc.c
    n = len(left)
    rh = (doc.top - doc.bottom) / n
    bw = 130
    for i in range(n):
        y = doc.top - (i + 1) * rh
        card(c, M + 20, y + 6, bw, rh - 12, fill=SOFT, stroke=None, r=14)
        draw_left(c, left[i], M + 20, y + 6, bw, rh - 12)
        dot(c, M + 20 + bw + 16, y + rh / 2, 6, HexColor(doc.color))
        xr = doc.w - M - 20 - bw
        card(c, xr, y + 6, bw, rh - 12, fill=SOFT, stroke=None, r=14)
        draw_right(c, right[i], xr, y + 6, bw, rh - 12)
        dot(c, xr - 16, y + rh / 2, 6, HexColor(doc.color))


def centered_picto(c, key, x, y, w, h, k=0.78, silhouette=None):
    s = min(w, h) * k
    picto(c, key, x + (w - s) / 2, y + (h - s) / 2, s, silhouette=silhouette)


@material('match-same', 'Свържи еднаквите',
          'Свържи всяка картинка с еднаквата от другата страна. Три страници: животни, храна, превозни средства.',
          'worksheet', ['cognitive', 'fine_motor'])
def match_same(doc):
    for p, (pool, title) in enumerate([(ANIMALS, 'животни'), (FOOD, 'храна'), (VEHICLES, 'превозни средства')]):
        doc.new_page(f'Свържи еднаквите — {title}', 'Намери същата картинка и ги свържи с линия.')
        rnd = random.Random(p)
        left = rnd.sample(pool, 5)
        right = left[:]
        while any(a == b for a, b in zip(left, right)):
            rnd.shuffle(right)
        connect_columns(doc, left, right, lambda c, k, *b: centered_picto(c, k, *b), lambda c, k, *b: centered_picto(c, k, *b))


@material('shadows', 'Намери сянката',
          'Свържи картинката с нейната сянка. Зрително възприятие и форма — три страници с нарастваща трудност.',
          'worksheet', ['cognitive'])
def shadows(doc):
    sets = [['apple', 'star', 'heart', 'car', 'fish'], ['elephant', 'rabbit', 'giraffe', 'turtle', 'butterfly'],
            ['pear', 'banana', 'mushroom', 'icecream', 'cake']]
    for p, left in enumerate(sets):
        doc.new_page('Намери сянката', 'Свържи всяка картинка с нейната сянка.')
        right = left[:]
        rnd = random.Random(p + 7)
        while any(a == b for a, b in zip(left, right)):
            rnd.shuffle(right)
        connect_columns(doc, left, right, lambda c, k, *b: centered_picto(c, k, *b),
                        lambda c, k, *b: centered_picto(c, k, *b, silhouette=HexColor('#334155')))


@material('odd-one-out', 'Кое не е на мястото си?',
          'Във всеки ред едно не принадлежи към групата. Огради го и кажи защо. Категоризация и речник.',
          'worksheet', ['cognitive', 'receptive'])
def odd_one_out(doc):
    c = doc.c
    groups = [ANIMALS, FOOD, VEHICLES, CLOTHES, SCHOOL]
    rnd = random.Random(4)
    for p in range(2):
        doc.new_page('Кое не е на мястото си?', 'Огради картинката, която не е от групата.')
        rows = 6
        rh = (doc.top - doc.bottom) / rows
        for r in range(rows):
            g = rnd.randrange(len(groups))
            o = rnd.choice([k for k in range(len(groups)) if k != g])
            items = rnd.sample(groups[g], 3) + [rnd.choice(groups[o])]
            rnd.shuffle(items)
            y = doc.top - (r + 1) * rh
            card(c, M, y + 5, doc.w - 2 * M, rh - 10, fill=SOFT if r % 2 == 0 else white, stroke=None, r=14)
            cw = (doc.w - 2 * M) / 4
            for k, key in enumerate(items):
                centered_picto(c, key, M + k * cw, y + 5, cw, rh - 10, 0.66)


@material('sort-categories', 'Сортирай: храна, животни, превозни средства',
          'Табло с три групи и карти за изрязване и залепване. Категоризация — подходящо и за велкро.',
          'board', ['cognitive', 'receptive'], name_line=False)
def sort_categories(doc):
    c = doc.c
    heads = [('Храна', 'eat', '#f59e0b'), ('Животни', 'dog', '#10b981'), ('Превозни средства', 'car', '#3b82f6')]
    doc.new_page('Сортирай по групи', 'Изрежи картите от втората страница и ги залепи в правилната група.', name_line=False)
    cw = (doc.w - 2 * M - 20) / 3
    for i, (t, k, col) in enumerate(heads):
        x = M + i * (cw + 10)
        card(c, x, doc.bottom, cw, doc.top - doc.bottom, fill=tint(col, 0.9), stroke=HexColor(col), r=16, lw=1.6)
        picto(c, k, x + cw / 2 - 24, doc.top - 62, 48)
        fit_text(c, t, x + cw / 2, doc.top - 84, cw - 10, 14, color=HexColor(col))
        for r in range(4):
            velcro(c, x + (cw - 96) / 2, doc.top - 200 - r * 118, 96, color=HexColor(col))
    doc.new_page('Карти за сортиране', 'Изрежи по пунктира.', name_line=False)
    items = FOOD[:4] + ANIMALS[:4] + VEHICLES[:4]
    random.Random(2).shuffle(items)
    grid_cards(doc, 4, 3, items, lambda c, k, x, y, w, h: picto_card(c, k, LBL[k], x + 4, y + 4, w - 8, h - 8, frame=False))


@material('find-same', 'Намери и огради',
          'Намери всички картинки като образеца и ги огради. Зрително внимание и търсене — три нива.',
          'worksheet', ['cognitive'])
def find_same(doc):
    c = doc.c
    levels = [('star', ['heart', 'sun', 'flower'], 5, 6), ('cat', ['dog', 'rabbit', 'bear', 'mouse'], 6, 7),
              ('apple', ['strawberry', 'tomato', 'pear', 'orange', 'cherry'], 7, 8)]
    for p, (target, others, cols, rows) in enumerate(levels):
        others = [o for o in others if o in LBL]
        doc.new_page('Намери и огради', 'Огради всички картинки като тази в рамката. Колко са?')
        card(c, M, doc.top - 76, 90, 76, fill=tint(doc.color, 0.85), stroke=HexColor(doc.color), r=14, lw=2)
        picto(c, target, M + 18, doc.top - 70, 54)
        label(c, 'Намерих: ____', doc.w - M - 4, doc.top - 44, 15, align='right', color=MUTED)
        rnd = random.Random(p + 20)
        top = doc.top - 96
        cw = (doc.w - 2 * M) / cols
        rh = (top - doc.bottom) / rows
        for r in range(rows):
            for k in range(cols):
                key = target if rnd.random() < 0.28 else rnd.choice(others)
                s = min(cw, rh) * 0.66
                picto(c, key, M + k * cw + (cw - s) / 2, top - (r + 1) * rh + (rh - s) / 2, s)


@material('big-small', 'Голямо и малко',
          'Огради голямото, после малкото. Сравняване по размер с познати картинки.',
          'worksheet', ['cognitive', 'receptive'])
def big_small(doc):
    c = doc.c
    keys = ['elephant', 'ball', 'apple', 'car', 'teddy', 'tree', 'house', 'fish', 'star', 'balloon', 'dog', 'cake']
    for p, (title, ins) in enumerate([('Огради голямото', 'Огради голямата картинка във всеки ред.'),
                                      ('Огради малкото', 'Огради малката картинка във всеки ред.')]):
        doc.new_page(title, ins)
        rows = 6
        rh = (doc.top - doc.bottom) / rows
        rnd = random.Random(p)
        for r in range(rows):
            key = keys[p * 6 + r]
            y = doc.top - (r + 1) * rh
            sizes = [rh * 0.82, rh * 0.38] if rnd.random() < 0.5 else [rh * 0.38, rh * 0.82]
            if p == 1:
                sizes.append(rh * 0.6)
                rnd.shuffle(sizes)
            cw = (doc.w - 2 * M) / len(sizes)
            for k, s in enumerate(sizes):
                picto(c, key, M + k * cw + (cw - s) / 2, y + (rh - s) / 2, s)
            if r < rows - 1:
                c.setStrokeColor(LINE)
                c.setLineWidth(0.6)
                c.line(M, y, doc.w - M, y)


@material('more-less', 'Къде са повече?',
          'Сравни двете групи и огради тази, в която са повече (или по-малко). Количествени представи без броене до края.',
          'worksheet', ['cognitive', 'academic'])
def more_less(doc):
    c = doc.c
    keys = ['apple', 'fish', 'star', 'duck', 'balloon', 'ladybug', 'strawberry', 'car', 'flower', 'bee', 'cat', 'heart']
    rnd = random.Random(12)
    for p, (title, ins) in enumerate([('Къде са повече?', 'Огради кутията, в която има повече.'),
                                      ('Къде са по-малко?', 'Огради кутията, в която има по-малко.')]):
        doc.new_page(title, ins)
        rows = 5
        rh = (doc.top - doc.bottom) / rows
        for r in range(rows):
            a = rnd.randint(1, 5)
            b = rnd.choice([n for n in range(1, 9) if abs(n - a) >= 2])
            key = keys[p * 5 + r]
            y = doc.top - (r + 1) * rh
            bw = (doc.w - 2 * M - 30) / 2
            for k, n in enumerate([a, b]):
                x = M + k * (bw + 30)
                card(c, x, y + 8, bw, rh - 16, fill=SOFT, stroke=LINE, r=16)
                scatter(c, key, n, x + 8, y + 14, bw - 16, rh - 28, 44)


PATTERNS = [('AB', ['sun', 'moon']), ('AB', ['apple', 'banana']), ('AB', ['red', 'blue']), ('AAB', ['star', 'star', 'heart']),
            ('ABB', ['cat', 'dog', 'dog']), ('ABC', ['red', 'yellow', 'green']), ('AB', ['car', 'bus']),
            ('ABC', ['triangle', 'diamond', 'red_sq']), ('AABB', ['fish', 'fish', 'duck', 'duck']),
            ('ABC', ['apple', 'pear', 'grapes']), ('ABB', ['ball', 'teddy', 'teddy']), ('AAB', ['flower', 'flower', 'bee'])]


@material('patterns', 'Продължи редицата',
          'Разгледай редицата и продължи — нарисувай, оцвети или залепи следващите. От АБ до АББ и АБВ. Картите за отговор са долу.',
          'worksheet', ['cognitive', 'academic'])
def patterns(doc):
    c = doc.c
    for p in range(3):
        doc.new_page('Продължи редицата', 'Какво следва? Изрежи картинките отдолу и ги залепи в празните места.')
        rows = PATTERNS[p * 4:(p + 1) * 4]
        strip = 92
        top = doc.top
        rh = (top - doc.bottom - strip - 16) / 4
        answers = []
        for r, (_, seq) in enumerate(rows):
            y = top - (r + 1) * rh
            n = 8
            cw = (doc.w - 2 * M) / n
            for k in range(n):
                x = M + k * cw
                s = min(cw, rh) * 0.72
                if k < 6:
                    picto(c, seq[k % len(seq)], x + (cw - s) / 2, y + (rh - s) / 2, s)
                else:
                    velcro(c, x + (cw - s) / 2, y + (rh - s) / 2, s, color=HexColor(doc.color))
                    answers.append(seq[k % len(seq)])
        # лента с отговори
        random.Random(p).shuffle(answers)
        y0 = doc.bottom
        cut_line(c, M, y0 + strip + 6, doc.w - M, y0 + strip + 6)
        scissors_mark(c, M - 2, y0 + strip, 12)
        cw = (doc.w - 2 * M) / len(answers)
        for k, key in enumerate(answers):
            x = M + k * cw
            card(c, x + 3, y0 + 10, cw - 6, cw - 6, fill=white, stroke=HexColor('#b8c4d3'), r=8, lw=0.8, dash=(3, 3))
            picto(c, key, x + 3 + (cw - 6) * 0.14, y0 + 10 + (cw - 6) * 0.14, (cw - 6) * 0.72)


def memory_set(doc, keys, title):
    for p in range(2):
        doc.new_page(f'Мемори — {title}', 'Изрежи картите. Обърни ги и търси двойките.', name_line=False)
        page_keys = keys[p * 6:(p + 1) * 6]
        items = page_keys + page_keys
        grid_cards(doc, 3, 4, items, lambda c, k, x, y, w, h: picto_card(c, k, LBL[k], x + 6, y + 6, w - 12, h - 12, frame=False))


@material('memory-animals', 'Мемори — животни',
          '24 карти (12 двойки) за игра на мемори, за сдвояване и за назоваване на животни.',
          'game', ['cognitive', 'expressive'], name_line=False)
def memory_animals(doc):
    memory_set(doc, ['dog', 'cat', 'horse', 'cow', 'pig', 'sheep', 'lion', 'elephant', 'monkey', 'giraffe', 'frog', 'owl'], 'животни')


@material('memory-food', 'Мемори — храна',
          '24 карти (12 двойки) с плодове, зеленчуци и храни — мемори, сдвояване, назоваване.',
          'game', ['cognitive', 'expressive'], name_line=False)
def memory_food(doc):
    memory_set(doc, ['apple', 'banana', 'pear', 'grapes', 'strawberry', 'watermelon', 'bread', 'cheese', 'carrot', 'tomato',
                     'pizza', 'icecream'], 'храна')


@material('strip-puzzles', 'Пъзели от ленти',
          'Голяма картинка, нарязана на ленти с номера. Изрежи и подреди — по картинката или по числата. 3, 4, 5 и 6 части.',
          'game', ['cognitive', 'fine_motor'], name_line=False)
def strip_puzzles(doc):
    c = doc.c
    for p, (key, n) in enumerate([('elephant', 3), ('lion', 4), ('rocket', 5), ('butterfly', 6)]):
        col = PALETTE[p * 2 % 8]
        doc.new_page(f'Пъзел от {n} ленти', 'Изрежи лентите и подреди картинката. Числата отдолу помагат.', name_line=False)
        W = doc.w - 2 * M
        H = min(W, doc.top - doc.bottom - 40)
        y0 = doc.bottom + 40
        card(c, M, y0 - 34, W, H + 34, fill=tint(col, 0.9), stroke=None, r=0)
        picto(c, key, M + (W - H * 0.92) / 2, y0 + H * 0.04, H * 0.92)
        sw = W / n
        for k in range(n):
            label(c, str(k + 1), M + sw * (k + 0.5), y0 - 26, 20, font='Nunito-Black', color=HexColor(col))
            if k:
                cut_line(c, M + sw * k, y0 - 34, M + sw * k, y0 + H)
        c.setStrokeColor(HexColor('#9aa7b8'))
        c.setDash(4, 4)
        c.setLineWidth(0.8)
        c.rect(M, y0 - 34, W, H + 34, stroke=1, fill=0)
        c.setDash()


@material('associations', 'Кое с кое върви?',
          'Свържи нещата, които вървят заедно: чорап и обувка, пчела и цвете, четка и зъб. Асоциации и речник.',
          'worksheet', ['cognitive', 'receptive'])
def associations(doc):
    sets = [[('socks', 'shoes'), ('bee', 'flower'), ('toothbrush', 'tooth'), ('dog', 'bone'), ('rain', 'umbrella')],
            [('cow', 'milk'), ('chicken', 'egg'), ('key', 'door'), ('notebook', 'pencil'), ('guitar', 'music')],
            [('fish', 'wave'), ('bird', 'tree'), ('rabbit', 'carrot2'), ('moon', 'bed'), ('ball', 'playground')]]
    for p, pairs in enumerate(sets):
        doc.new_page('Кое с кое върви?', 'Свържи двете неща, които вървят заедно.')
        left = [a for a, _ in pairs]
        right = [b for _, b in pairs]
        rnd = random.Random(p + 30)
        orig = right[:]
        while any(a == b for a, b in zip(orig, right)):
            rnd.shuffle(right)
        connect_columns(doc, left, right, lambda c, k, *b: centered_picto(c, k, *b), lambda c, k, *b: centered_picto(c, k, *b))


@material('colors-match', 'Какъв цвят е?',
          'Свържи всеки плод или предмет с неговия цвят. Карти с цветовете за назоваване.',
          'worksheet', ['cognitive', 'receptive'])
def colors_match(doc):
    c = doc.c
    sets = [[('strawberry', 'червено', '#ef4444'), ('banana', 'жълто', '#facc15'), ('cucumber', 'зелено', '#22c55e'),
             ('grapes', 'лилаво', '#8b5cf6'), ('carrot', 'оранжево', '#f97316')],
            [('tomato', 'червено', '#ef4444'), ('sun', 'жълто', '#facc15'), ('leaf', 'оранжево', '#f97316'),
             ('whale', 'синьо', '#3b82f6'), ('frog', 'зелено', '#22c55e')]]
    for p, rows in enumerate(sets):
        doc.new_page('Какъв цвят е?', 'Свържи картинката с нейния цвят. Кажи цвета.')
        right = rows[:]
        rnd = random.Random(p + 40)
        while any(a == b for a, b in zip(rows, right)):
            rnd.shuffle(right)

        def swatch(c, it, x, y, w, h):
            _, name, col = it
            card(c, x + 14, y + 26, w - 28, h - 46, fill=HexColor(col), stroke=None, r=12)
            label(c, name, x + w / 2, y + 8, 12, color=INK)
        connect_columns(doc, rows, right, lambda c, it, *b: centered_picto(c, it[0], *b), swatch)
    doc.new_page('Карти с цветове', 'Изрежи. Покажи и назови цвета.', name_line=False)
    cols = [('червено', '#ef4444'), ('оранжево', '#f97316'), ('жълто', '#facc15'), ('зелено', '#22c55e'), ('синьо', '#3b82f6'),
            ('лилаво', '#8b5cf6'), ('розово', '#ec4899'), ('кафяво', '#92400e'), ('черно', '#111827'), ('бяло', '#ffffff'),
            ('сиво', '#9ca3af'), ('светлосиньо', '#38bdf8')]

    def draw(c, it, x, y, w, h):
        name, col = it
        card(c, x + 14, y + 34, w - 28, h - 50, fill=HexColor(col), stroke=LINE, r=12)
        label(c, name, x + w / 2, y + 12, 15, color=INK)
    grid_cards(doc, 3, 4, cols, draw)


@material('seasons-sort', 'Сезоните',
          'Четирите сезона — карти и табло за сортиране на картинки: сняг, цветя, слънце, листа. Време и природа.',
          'board', ['cognitive', 'receptive'], name_line=False)
def seasons(doc):
    c = doc.c
    S = [('Зима', 'winter', '#3b82f6'), ('Пролет', 'spring', '#22c55e'), ('Лято', 'summer', '#f59e0b'), ('Есен', 'autumn', '#ea580c')]
    doc.new_page('Сезоните', 'Залепи всяка картинка при нейния сезон.', name_line=False)
    W = (doc.w - 2 * M - 12) / 2
    H = (doc.top - doc.bottom - 12) / 2
    for i, (t, k, col) in enumerate(S):
        x = M + (i % 2) * (W + 12)
        y = doc.top - (i // 2 + 1) * H - (i // 2) * 12
        card(c, x, y, W, H, fill=tint(col, 0.9), stroke=HexColor(col), r=18, lw=1.6)
        picto(c, k, x + 16, y + H - 66, 50)
        label(c, t, x + 76, y + H - 48, 20, font='Nunito-Black', color=HexColor(col), align='left')
        for r in range(2):
            for q in range(2):
                velcro(c, x + 30 + q * (W - 60) / 2 + ((W - 60) / 2 - 80) / 2, y + 20 + r * 100, 80, color=HexColor(col))
    doc.new_page('Картинки за сезоните', 'Изрежи по пунктира.', name_line=False)
    items = ['snow', 'coat', 'snow', 'hat', 'flower', 'butterfly', 'rain', 'bee', 'sun', 'icecream', 'swim', 'watermelon',
             'leaf', 'mushroom', 'umbrella', 'grapes']
    items[2] = 'socks'
    grid_cards(doc, 4, 4, items, lambda c, k, x, y, w, h: picto_card(c, k, LBL[k], x + 4, y + 4, w - 8, h - 8, frame=False))
