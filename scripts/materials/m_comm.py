"""Комуникация и структура: Първо–после, табла за избор, ядро речник, тематични табла, карти за нуждите,
правила, действия, изречения, визуален график, жетонни табла, чакам, календар."""
from kit import *

# Цветен код на Фицджералд (използван в AAC системи): местоимения — жълто, глаголи — зелено,
# социални — розово, съществителни — оранжево, отрицание/стоп — червено, описателни — синьо.
FK = {'pron': '#eab308', 'verb': '#16a34a', 'soc': '#db2777', 'noun': '#ea580c', 'neg': '#dc2626', 'desc': '#2563eb'}

CORE = [('me', 'аз', 'pron'), ('you', 'ти', 'pron'), ('want', 'искам', 'verb'), ('like', 'харесвам', 'verb'),
        ('walk', 'отивам', 'verb'), ('come', 'ела', 'verb'),
        ('yes', 'да', 'soc'), ('no', 'не', 'neg'), ('more', 'още', 'desc'), ('done', 'готово', 'soc'),
        ('help', 'помощ', 'verb'), ('stop', 'стоп', 'neg'),
        ('eat', 'ям', 'verb'), ('drink', 'пия', 'verb'), ('play', 'играя', 'verb'), ('look', 'гледай', 'verb'),
        ('listen', 'слушай', 'verb'), ('wait', 'чакам', 'verb'),
        ('hello', 'здравей', 'soc'), ('toilet', 'тоалетна', 'noun'), ('break', 'почивка', 'noun'), ('hurt', 'боли ме', 'desc'),
        ('happy', 'добре', 'desc'), ('sad', 'тъжно', 'desc')]


def board_cell(c, key, text, x, y, w, h, color, font_size=None):
    card(c, x, y, w, h, fill=tint(color, 0.86), stroke=HexColor(color), r=10, lw=1.8)
    fs = font_size or max(9, min(15, w * 0.13))
    c.setFillColor(white)
    c.roundRect(x + 4, y + 4, w - 8, h - fs * 1.9 - 4, 7, stroke=0, fill=1)
    s = min(w - 18, h - fs * 1.9 - 18)
    picto(c, key, x + (w - s) / 2, y + 4 + (h - fs * 1.9 - 4 - s) / 2, s)
    fit_text(c, text, x + w / 2, y + h - fs * 1.35, w - 8, fs)


def grid(doc, cols, rows, items, fn, top=None, bottom=None, gap=8, left=None, right=None):
    top = doc.top if top is None else top
    bottom = doc.bottom if bottom is None else bottom
    left = M if left is None else left
    right = doc.w - M if right is None else right
    cw = (right - left - gap * (cols - 1)) / cols
    ch = (top - bottom - gap * (rows - 1)) / rows
    for i, it in enumerate(items[:cols * rows]):
        r, k = divmod(i, cols)
        fn(doc.c, it, left + k * (cw + gap), top - (r + 1) * ch - r * gap, cw, ch)
    return cw, ch


# ── Първо — после ───────────────────────────────────────────────────────────
ACTIVITY_CARDS = ['book', 'pencil', 'math', 'letters', 'paint', 'crayon', 'scissors', 'puzzle', 'blocks', 'speech',
                  'psychologist', 'therapy_move', 'sport', 'music', 'circle_time', 'lunch', 'breakfast', 'toilet',
                  'wash_hands', 'computer', 'tablet', 'ball', 'swing', 'slide', 'bubbles', 'playground', 'break',
                  'home', 'bus_school', 'sleep', 'dance', 'sing', 'garden', 'teddy', 'videogame', 'walk']


def panels(doc, heads):
    c = doc.c
    n = len(heads)
    gap = 14
    W = (doc.w - 2 * M - gap * (n - 1)) / n
    H = doc.top - doc.bottom
    for i, (t, col) in enumerate(heads):
        x = M + i * (W + gap)
        card(c, x, doc.bottom, W, H, fill=tint(col, 0.9), stroke=HexColor(col), r=22, lw=2.5)
        c.setFillColor(HexColor(col))
        c.roundRect(x, doc.bottom + H - 64, W, 64, 22, stroke=0, fill=1)
        c.rect(x, doc.bottom + H - 64, W, 30, stroke=0, fill=1)
        label(c, t, x + W / 2, doc.bottom + H - 44, 30, font='Nunito-Black', color=white)
        s = min(W - 60, H - 120)
        velcro(c, x + (W - s) / 2, doc.bottom + (H - 64 - s) / 2, s, color=HexColor(col))
        if i < n - 1:
            arrow(c, x + W - 6, doc.bottom + H / 2 - 20, x + W + gap + 6, doc.bottom + H / 2 - 20, color=INK, lw=3, head=10)


def activity_cards(doc, title, keys, cols=4, rows=4):
    per = cols * rows
    for p in range(0, len(keys), per):
        doc.new_page(title, 'Изрежи по пунктира. Ламинирай и сложи велкро отзад.', name_line=False)
        grid_cards(doc, cols, rows, keys[p:p + per],
                   lambda c, k, x, y, w, h: picto_card(c, k, LBL[k], x + 5, y + 5, w - 10, h - 10, frame=False))


@material('first-then', 'Първо — после',
          'Табло „Първо — после“ и 36 карти с дейности и награди. Помага на детето да приеме задачата, като вижда какво следва.',
          'board', ['receptive', 'sensory'], land=True, name_line=False)
def first_then(doc):
    doc.new_page('Първо — после', 'Сложи задачата в „Първо“ и любимата дейност в „После“.', name_line=False)
    panels(doc, [('ПЪРВО', '#16a34a'), ('ПОСЛЕ', '#2563eb')])
    activity_cards(doc, 'Карти за „Първо — после“', ACTIVITY_CARDS, cols=6, rows=3)


@material('now-next-then', 'Сега — после — накрая',
          'Табло с три стъпки за по-дълги поредици и преходи. Използва същите карти като „Първо — после“.',
          'board', ['receptive', 'sensory'], land=True, name_line=False)
def now_next(doc):
    doc.new_page('Сега — после — накрая', 'Подреди трите стъпки. Махай картата, когато стъпката е готова.', name_line=False)
    panels(doc, [('СЕГА', '#16a34a'), ('ПОСЛЕ', '#f59e0b'), ('НАКРАЯ', '#2563eb')])


@material('choice-boards', 'Табла за избор',
          'Табла „Искам…“ с 2, 3 и 4 възможности за избор — за храна, игра или дейност. С картите от „Първо — после“ или собствени снимки.',
          'board', ['expressive', 'receptive'], land=True, name_line=False)
def choice_boards(doc):
    c = doc.c
    for n in [2, 3, 4]:
        doc.new_page(f'Искам… (избор от {n})', 'Сложи възможностите. Детето посочва или подава картата.', name_line=False)
        bar = 86
        card(c, M, doc.top - bar, doc.w - 2 * M, bar, fill=tint(FK['verb'], 0.88), stroke=HexColor(FK['verb']), r=16, lw=2)
        picto(c, 'me', M + 18, doc.top - bar + 13, 60)
        label(c, 'Аз', M + 96, doc.top - bar / 2 - 10, 28, font='Nunito-Black', align='left')
        picto(c, 'want', M + 160, doc.top - bar + 13, 60)
        label(c, 'искам', M + 238, doc.top - bar / 2 - 10, 28, font='Nunito-Black', align='left')
        velcro(c, doc.w - M - 80, doc.top - bar + 10, 66, color=HexColor(FK['verb']))
        gap = 16
        W = (doc.w - 2 * M - gap * (n - 1)) / n
        H = doc.top - bar - 16 - doc.bottom
        for i in range(n):
            x = M + i * (W + gap)
            card(c, x, doc.bottom, W, H, fill=SOFT, stroke=LINE, r=18, lw=1.4)
            s = min(W - 40, H - 40)
            velcro(c, x + (W - s) / 2, doc.bottom + (H - s) / 2, s)


@material('core-board', 'Ядро речник — 24 думи',
          'Комуникационно табло с 24-те най-често използвани думи, оцветени по ключа на Фицджералд. Посочване на дума или изграждане на кратко изречение.',
          'board', ['expressive', 'receptive'], land=True, name_line=False)
def core_board(doc):
    c = doc.c
    doc.new_page('Моето табло', 'Посочи думите. Може да ги съчетаваш: „аз искам още“.', name_line=False)
    leg = 26
    grid(doc, 6, 4, CORE, lambda c, it, x, y, w, h: board_cell(c, it[0], it[1], x, y, w, h, FK[it[2]]),
         bottom=doc.bottom + leg)
    x = M
    for k, t in [('pron', 'хора'), ('verb', 'действия'), ('soc', 'общуване'), ('noun', 'неща'), ('desc', 'описание'),
                 ('neg', 'не / стоп')]:
        x += pill(c, t, x, doc.bottom, FK[k], size=9) + 6


def topic_board(doc, title, items, color):
    """Тематично табло: колона с ядро думи вляво + 20 тематични думи."""
    c = doc.c
    doc.new_page(title, 'Посочи: „Искам…“, „Още“, „Готово“.', name_line=False)
    core = [('want', 'искам', 'verb'), ('more', 'още', 'desc'), ('no', 'не', 'neg'), ('done', 'готово', 'soc'),
            ('help', 'помощ', 'verb')]
    cw = 92
    grid(doc, 1, 5, core, lambda c, it, x, y, w, h: board_cell(c, it[0], it[1], x, y, w, h, FK[it[2]]),
         right=M + cw)
    grid(doc, 5, 4, items, lambda c, k, x, y, w, h: board_cell(c, k[0], k[1], x, y, w, h, color),
         left=M + cw + 14)


@material('board-food', 'Табло: храна и напитки',
          'Тематично табло за закуска и обяд — 20 храни и напитки плюс „искам, още, не, готово, помощ“.',
          'board', ['expressive', 'self_care'], land=True, name_line=False)
def board_food(doc):
    keys = ['water', 'milk', 'juice', 'bread', 'cheese', 'egg', 'soup', 'pasta', 'pizza', 'apple', 'banana', 'pear',
            'grapes', 'strawberry', 'orange', 'tomato', 'cucumber', 'carrot', 'cookie', 'icecream']
    topic_board(doc, 'Храна и напитки', [(k, LBL[k] if k != 'water' else 'вода') for k in keys], FK['noun'])


@material('board-play', 'Табло: игра и почивка',
          'Тематично табло за свободното време — 20 игри и дейности плюс ядро думи.',
          'board', ['expressive', 'social'], land=True, name_line=False)
def board_play(doc):
    keys = ['ball', 'blocks', 'puzzle', 'book', 'paint', 'crayon', 'music', 'dance', 'sing', 'tablet', 'computer',
            'bubbles', 'swing', 'slide', 'teddy', 'drum', 'playground', 'run', 'jump', 'bike']
    topic_board(doc, 'Игра и почивка', [(k, LBL[k]) for k in keys], FK['verb'])


@material('board-feelings-needs', 'Табло: чувства и нужди',
          'Табло, с което детето казва как се чувства и от какво има нужда — 20 думи плюс ядро.',
          'board', ['expressive', 'social'], land=True, name_line=False)
def board_feel(doc):
    keys = ['happy', 'sad', 'angry', 'scared', 'tired' if 'tired' in LBL else 'sleepy', 'hurt', 'sick', 'calm', 'confused',
            'bored', 'toilet', 'water', 'eat', 'break', 'quiet', 'headphones', 'hug', 'stop', 'wait', 'home']
    topic_board(doc, 'Чувства и нужди', [(k, LBL[k]) for k in keys], FK['desc'])


@material('need-cards', 'Карти за нуждите',
          'Дванадесет карти, които детето носи на ключодържател или лента: тоалетна, вода, помощ, почивка, боли ме, стоп… В голям и в малък размер.',
          'cards', ['expressive', 'self_care'], name_line=False)
def need_cards(doc):
    items = [('toilet', 'тоалетна'), ('water', 'вода'), ('eat', 'гладен съм'), ('help', 'помогни ми'),
             ('break', 'почивка'), ('stop', 'стоп'), ('hurt', 'боли ме'), ('quiet', 'много е шумно'),
             ('headphones', 'слушалки'), ('hug', 'прегръдка'), ('yes', 'да'), ('no', 'не')]
    doc.new_page('Карти за нуждите', 'Изрежи, ламинирай и закачи на ключодържател.', name_line=False)
    grid_cards(doc, 3, 4, items, lambda c, it, x, y, w, h: picto_card(c, it[0], it[1], x + 5, y + 5, w - 10, h - 10,
                                                                     color=PALETTE[items.index(it) % 8]))
    doc.new_page('Карти за нуждите — малки', 'Малък размер — за ключодържател.', name_line=False)
    grid_cards(doc, 4, 6, items * 2, lambda c, it, x, y, w, h: picto_card(c, it[0], it[1], x + 4, y + 4, w - 8, h - 8,
                                                                         color=PALETTE[items.index(it) % 8]), gap=6)


def big_card(c, key, text, sub, x, y, w, h, color):
    card(c, x, y, w, h, fill=tint(color, 0.88), stroke=HexColor(color), r=26, lw=3)
    s = h * 0.55
    picto(c, key, x + (w - s) / 2, y + h - s - 30, s)
    fit_text(c, text, x + w / 2, y + 62, w - 40, 38, font='Nunito-Black', color=HexColor(color))
    if sub:
        fit_text(c, sub, x + w / 2, y + 30, w - 40, 16, font='Nunito', color=INK)


@material('big-request-cards', 'Големи карти: почивка, помощ, чакам, готово',
          'Големи карти за молба и преход — „Искам почивка“, „Помогни ми“, „Чакам“, „Готово“, „Да“, „Не“. По две на страница.',
          'cards', ['expressive', 'sensory'], name_line=False)
def big_requests(doc):
    pairs = [[('break', 'Почивка', 'Искам почивка, моля.', '#0d9488'), ('help', 'Помогни ми', 'Не мога сам. Помогни ми, моля.', '#2563eb')],
             [('wait', 'Чакам', 'Чакам спокойно реда си.', '#f59e0b'), ('done', 'Готово', 'Свърших. Какво следва?', '#16a34a')],
             [('yes', 'Да', '', '#16a34a'), ('no', 'Не', '', '#dc2626')]]
    for pr in pairs:
        doc.new_page('Големи карти', 'Изрежи по пунктира.', name_line=False)
        H = (doc.top - doc.bottom - 20) / 2
        for i, (k, t, s, col) in enumerate(pr):
            y = doc.top - (i + 1) * H - i * 20
            big_card(doc.c, k, t, s, M + 20, y, doc.w - 2 * M - 40, H, col)
        cut_line(doc.c, M, doc.top - H - 10, doc.w - M, doc.top - H - 10)


@material('class-rules', 'Правилата в класа',
          'Плакат с шест правила с картинки: гледам, слушам, вдигам ръка, седя на мястото си, говоря тихо, помагам. За стената и за индивидуално напомняне.',
          'board', ['social', 'receptive'], name_line=False)
def class_rules(doc):
    c = doc.c
    rules = [('look', 'Гледам учителя'), ('listen', 'Слушам внимателно'), ('hand_up', 'Вдигам ръка, когато искам да кажа'),
             ('sit', 'Седя на мястото си'), ('quiet', 'Говоря тихо'), ('hug', 'Помагам на другите')]
    doc.new_page('Правилата в нашия клас', '', name_line=False)
    n = len(rules)
    rh = (doc.top - doc.bottom) / n
    for i, (k, t) in enumerate(rules):
        col = PALETTE[i]
        y = doc.top - (i + 1) * rh
        card(c, M, y + 5, doc.w - 2 * M, rh - 10, fill=tint(col, 0.88), stroke=None, r=20)
        c.setFillColor(HexColor(col))
        c.circle(M + 34, y + rh / 2, 20, stroke=0, fill=1)
        label(c, str(i + 1), M + 34, y + rh / 2 - 8, 22, font='Nunito-Black', color=white)
        s = rh - 30
        c.setFillColor(white)
        c.roundRect(M + 66, y + 13, s + 6, s + 4, 14, stroke=0, fill=1)
        picto(c, k, M + 70, y + 16, s - 2)
        fit_text(c, t, (M + 76 + s + doc.w - M) / 2, y + rh / 2 - 9, doc.w - M - (M + 90 + s), 26, font='Nunito-Black')


@material('action-cards', 'Карти с действия',
          '36 карти с глаголи — ям, пия, спя, тичам, рисувам, чета… За разбиране („покажи кой тича“), назоваване и изречения.',
          'cards', ['expressive', 'receptive'], name_line=False)
def action_cards(doc):
    keys = ['eat', 'drink', 'sleep', 'run', 'walk', 'jump', 'swim', 'dance', 'sing', 'paint', 'book', 'pencil',
            'crayon', 'scissors', 'cook', 'shop', 'broom', 'wash_hands', 'shower', 'toothbrush', 'sit', 'play', 'clap',
            'hand_up', 'look', 'listen', 'talk', 'think', 'hug', 'hello', 'wait', 'drum', 'bubbles', 'bike', 'swing', 'slide']
    for p in range(3):
        doc.new_page('Карти с действия', 'Изрежи. Покажи и кажи: „Какво прави?“', name_line=False)
        grid_cards(doc, 3, 4, keys[p * 12:(p + 1) * 12],
                   lambda c, k, x, y, w, h: picto_card(c, k, LBL[k], x + 6, y + 6, w - 12, h - 12, frame=False))


@material('sentence-strip', 'Лента за изречение „Аз искам…“',
          'Лента за изграждане на изречение: „Аз“ + „искам“ + картинка. С карти за най-честите желания. Основа за PECS етап IV.',
          'board', ['expressive'], land=True, name_line=False)
def sentence_strip(doc):
    c = doc.c
    doc.new_page('Аз искам…', 'Сложи картите в лентата и „прочети“ изречението, като сочиш.', name_line=False)
    for k in range(2):
        y = doc.top - 30 - (k + 1) * 150 - k * 30
        card(c, M, y, doc.w - 2 * M, 150, fill=SOFT, stroke=HexColor(FK['verb']), r=20, lw=2.4)
        W = (doc.w - 2 * M - 40) / 4
        for i, (key, t, col) in enumerate([('me', 'Аз', FK['pron']), ('want', 'искам', FK['verb'])]):
            board_cell(c, key, t, M + 10 + i * (W + 6), y + 10, W, 130, col, font_size=18)
        velcro(c, M + 10 + 2 * (W + 6) + (W - 120) / 2, y + 15, 120, color=HexColor(FK['noun']))
        velcro(c, M + 10 + 3 * (W + 6) + (W - 120) / 2, y + 15, 120, color=HexColor(FK['desc']))
    activity_cards(doc, 'Карти за „Аз искам…“', ['water', 'milk', 'juice', 'bread', 'apple', 'banana', 'cookie', 'more',
                                                  'toilet', 'break', 'help', 'hug', 'ball', 'blocks', 'puzzle', 'book',
                                                  'music', 'tablet', 'bubbles', 'swing', 'teddy', 'paint', 'home', 'quiet'],
                   cols=6, rows=4)


SCHEDULE_CARDS = ['bus_school', 'school', 'circle_time', 'breakfast', 'lunch', 'math', 'letters', 'book', 'pencil',
                  'paint', 'music', 'sport', 'speech', 'psychologist', 'therapy_move', 'computer', 'playground', 'break',
                  'toilet', 'wash_hands', 'toothbrush', 'sleep', 'garden', 'science', 'art', 'dance', 'swim', 'shop',
                  'walk', 'party', 'doctor', 'home', 'bell', 'teacher', 'class', 'backpack']


@material('visual-schedule', 'Визуален график за деня',
          'Вертикален график „Моят ден“ с 8 места и джоб „Готово“, плюс 36 карти за училищни дейности и терапии. Детето маха картата, когато дейността свърши.',
          'board', ['receptive', 'sensory', 'self_care'], name_line=False)
def visual_schedule(doc):
    c = doc.c
    doc.new_page('Моят ден', 'Подреди картите отгоре надолу. Когато свършиш — премести картата в „Готово“.', name_line=False)
    W = 210
    x = M + 10
    n = 8
    H = doc.top - doc.bottom
    sh = H / n
    card(c, x, doc.bottom, W, H, fill=tint('#2563eb', 0.92), stroke=HexColor('#2563eb'), r=18, lw=2)
    for i in range(n):
        y = doc.top - (i + 1) * sh
        label(c, str(i + 1), x + 22, y + sh / 2 - 7, 18, font='Nunito-Black', color=HexColor('#2563eb'))
        velcro(c, x + 44, y + 5, sh - 10, color=HexColor('#2563eb'))
        c.setStrokeColor(HexColor('#2563eb'))
        c.setLineWidth(1)
        c.circle(x + W - 22, y + sh / 2, 9, stroke=1, fill=0)
    x2 = x + W + 30
    W2 = doc.w - M - x2
    card(c, x2, doc.bottom, W2, H, fill=tint('#16a34a', 0.9), stroke=HexColor('#16a34a'), r=18, lw=2)
    picto(c, 'done', x2 + W2 / 2 - 40, doc.top - 100, 80)
    label(c, 'ГОТОВО', x2 + W2 / 2, doc.top - 128, 26, font='Nunito-Black', color=HexColor('#16a34a'))
    label(c, 'Сложи тук картите на', x2 + W2 / 2, doc.top - 150, 11, color=MUTED)
    label(c, 'дейностите, които свършиха.', x2 + W2 / 2, doc.top - 164, 11, color=MUTED)
    card(c, x2 + 20, doc.bottom + 20, W2 - 40, H - 210, fill=white, stroke=HexColor('#16a34a'), r=14, lw=1.2, dash=(5, 4))
    activity_cards(doc, 'Карти за графика', SCHEDULE_CARDS, cols=4, rows=5)
    doc.new_page('Карти за графика — празни', 'Залепи снимка или нарисувай. Надпиши отдолу.', name_line=False)
    grid_cards(doc, 4, 5, [None] * 20, lambda c, it, x, y, w, h: (velcro(c, x + 14, y + 26, min(w, h) - 30),
                                                                 c.setStrokeColor(LINE), c.line(x + 10, y + 16, x + w - 10, y + 16)))


def token_board(doc, n, title):
    c = doc.c
    doc.new_page(title, '', name_line=False)
    H = 300
    y = doc.top - H
    card(c, M, y, doc.w - 2 * M, H, fill=tint('#f59e0b', 0.88), stroke=HexColor('#f59e0b'), r=24, lw=2.5)
    label(c, 'Работя за:', M + 24, doc.top - 40, 20, font='Nunito-Black', color=HexColor('#b45309'), align='left')
    velcro(c, doc.w - M - 130, doc.top - 130, 110, color=HexColor('#f59e0b'))
    per_row = 5
    rows = n // per_row
    step = (doc.w - 2 * M - 190) / per_row
    s = step * 0.82
    for r in range(rows):
        for k in range(per_row):
            cx = M + 30 + k * step + step / 2
            cy = doc.top - 105 - r * (s + 26) - (40 if rows == 1 else 0)
            path(c, star_pts(cx, cy, s / 2, s / 4.6), color=HexColor('#f59e0b'), lw=2, fill=white, dash=(4, 3))
    label(c, 'Когато събера всички звезди, получавам наградата!', doc.w / 2, y + 22, 13, color=HexColor('#92400e'))
    # жетони за изрязване
    label(c, 'Жетони за изрязване:', M, y - 34, 12, align='left', color=MUTED)
    cut_line(c, M, y - 14, doc.w - M, y - 14)
    tok = 64
    cols = int((doc.w - 2 * M) // (tok + 14))
    rows2 = int((y - 50 - doc.bottom) // (tok + 14))
    for r in range(rows2):
        for k in range(cols):
            x = M + k * (tok + 14) + 7
            yy = y - 50 - (r + 1) * (tok + 14)
            card(c, x, yy, tok, tok, fill=white, stroke=HexColor('#b8c4d3'), r=10, lw=0.8, dash=(3, 3))
            picto(c, 'star' if (r + k) % 3 else 'trophy', x + 8, yy + 8, tok - 16)


@material('token-boards', 'Жетонни табла (5 и 10)',
          'Табла за поощрение с 5 и 10 звезди и място за наградата („Работя за…“). Жетоните за изрязване са на същата страница.',
          'board', ['sensory', 'social'], name_line=False)
def token_boards(doc):
    token_board(doc, 5, 'Жетонно табло — 5 звезди')
    token_board(doc, 10, 'Жетонно табло — 10 звезди')


@material('waiting-card', 'Карта „Чакам“ с обратно броене',
          'Карта за чакане с обратно броене 5–4–3–2–1 и идеи какво да правя, докато чакам. Помага при трудност с чакането.',
          'board', ['sensory', 'social'], name_line=False)
def waiting_card(doc):
    c = doc.c
    doc.new_page('Чакам', 'Покрий по едно число, докато броиш. На нулата — твой ред е!', name_line=False)
    big_card(c, 'wait', 'Чакам', 'Чакам спокойно — скоро е мой ред.', M + 40, doc.top - 300, doc.w - 2 * M - 80, 300, '#f59e0b')
    cw = (doc.w - 2 * M) / 5
    for i, n in enumerate([5, 4, 3, 2, 1]):
        x = M + i * cw
        col = PALETTE[i]
        c.setFillColor(HexColor(col))
        c.circle(x + cw / 2, doc.top - 360, cw * 0.38, stroke=0, fill=1)
        label(c, str(n), x + cw / 2, doc.top - 376, 42, font='Nunito-Black', color=white)
    label(c, 'Докато чакам, мога да:', M, doc.top - 450, 15, font='Nunito-Black', align='left')
    opts = [('yoga', 'дишам'), ('look', 'гледам'), ('think', 'броя наум'), ('teddy', 'държа играчка'), ('sit', 'седя')]
    for i, (k, t) in enumerate(opts):
        x = M + i * cw
        picto_card(c, k, t, x + 6, doc.bottom + 30, cw - 12, doc.top - 480 - doc.bottom - 30)


@material('work-system', 'Моята работа: 1 — 2 — 3 — готово',
          'Система за самостоятелна работа (TEACCH): три задачи по ред, после награда. Детето вижда колко има и кога свършва.',
          'board', ['sensory', 'cognitive'], land=True, name_line=False)
def work_system(doc):
    c = doc.c
    doc.new_page('Моята работа', 'Свърши задачите по ред. После — наградата!', name_line=False)
    heads = [('1', '#2563eb'), ('2', '#7c3aed'), ('3', '#db2777'), ('★', '#16a34a')]
    gap = 14
    W = (doc.w - 2 * M - gap * 3) / 4
    H = doc.top - doc.bottom
    for i, (t, col) in enumerate(heads):
        x = M + i * (W + gap)
        card(c, x, doc.bottom, W, H, fill=tint(col, 0.9), stroke=HexColor(col), r=20, lw=2.5)
        c.setFillColor(HexColor(col))
        c.circle(x + W / 2, doc.top - 50, 32, stroke=0, fill=1)
        if t == '★':
            path(c, star_pts(x + W / 2, doc.top - 52, 22, 9), color=None, fill=white)
        else:
            label(c, t, x + W / 2, doc.top - 63, 36, font='Nunito-Black', color=white)
        s = W - 40
        velcro(c, x + 20, doc.bottom + (H - 100 - s) / 2 + 10, s, color=HexColor(col))
        label(c, 'награда' if t == '★' else 'задача', x + W / 2, doc.bottom + 22, 15, color=HexColor(col))


@material('calendar-board', 'Днес е…',
          'Табло за сутрешния кръг: ден от седмицата, време навън и как се чувствам. С карти за дните и времето.',
          'board', ['cognitive', 'receptive', 'social'], land=True, name_line=False)
def calendar_board(doc):
    c = doc.c
    doc.new_page('Днес е…', 'Всяка сутрин: какъв ден е, какво е времето, как се чувствам.', name_line=False)
    rows = [('calendar', 'Днес е', '#2563eb'), ('sun', 'Времето е', '#f59e0b'), ('happy', 'Чувствам се', '#e11d48')]
    rh = (doc.top - doc.bottom - 20) / 3
    for i, (k, t, col) in enumerate(rows):
        y = doc.top - (i + 1) * rh - i * 10
        card(c, M, y, doc.w - 2 * M, rh, fill=tint(col, 0.9), stroke=HexColor(col), r=20, lw=2)
        picto(c, k, M + 20, y + (rh - 70) / 2, 70)
        label(c, t, M + 110, y + rh / 2 - 10, 28, font='Nunito-Black', color=HexColor(col), align='left')
        velcro(c, doc.w - M - 330, y + 12, rh - 24, color=HexColor(col))
        card(c, doc.w - M - 320 + rh, y + rh / 2 - 26, 300 - rh, 52, fill=white, stroke=HexColor(col), r=12, lw=1.2,
             dash=(5, 4))
    days = ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя']
    dcol = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
    doc.new_page('Карти: дните от седмицата', 'Изрежи по пунктира.', name_line=False)

    def day(c, it, x, y, w, h):
        t, col = it
        card(c, x + 6, y + 6, w - 12, h - 12, fill=HexColor(col), stroke=None, r=14)
        fit_text(c, t, x + w / 2, y + h / 2 - 9, w - 30, 26, font='Nunito-Black', color=white)
    grid_cards(doc, 2, 4, list(zip(days, dcol)) + [('Днес', '#475569')], day)
    doc.new_page('Карти: времето и сезоните', 'Изрежи по пунктира.', name_line=False)
    weather = [('sun', 'слънчево'), ('cloud', 'облачно'), ('rain', 'дъждовно'), ('snow', 'снежно'), ('wind', 'ветровито'),
               ('rainbow', 'дъга'), ('moon', 'нощ'), ('umbrella', 'вземи чадър'), ('spring', 'пролет'), ('summer', 'лято'),
               ('autumn', 'есен'), ('winter', 'зима')]
    grid_cards(doc, 4, 3, weather, lambda c, it, x, y, w, h: picto_card(c, it[0], it[1], x + 5, y + 5, w - 10, h - 10, frame=False))
