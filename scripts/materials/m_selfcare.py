"""Самообслужване (поредици в стъпки) и груба моторика (кубчета и карти за движение)."""
from kit import *
from m_social import wrap


def sequence(doc, title, steps, color, note=''):
    """Стр. 1: плакат със стъпките отгоре надолу. Стр. 2: лента за стена/огледало. Стр. 3: карти за подреждане."""
    c = doc.c
    n = len(steps)
    doc.new_page(title, note or 'Следвай стъпките по ред.', name_line=False)
    rh = (doc.top - doc.bottom) / n
    for i, (k, t) in enumerate(steps):
        y = doc.top - (i + 1) * rh
        card(c, M, y + 3, doc.w - 2 * M, rh - 6, fill=tint(color, 0.9 if i % 2 == 0 else 0.95), stroke=None, r=14)
        c.setFillColor(HexColor(color))
        c.circle(M + 26, y + rh / 2, min(16, rh * 0.25), stroke=0, fill=1)
        label(c, str(i + 1), M + 26, y + rh / 2 - 6, min(17, rh * 0.26), font='Nunito-Black', color=white)
        s = rh - 14
        c.setFillColor(white)
        c.roundRect(M + 52, y + 7, s + 4, s, 10, stroke=0, fill=1)
        picto(c, k, M + 56, y + 11, s - 8)
        label(c, t, M + 72 + s, y + rh / 2 - 8, min(22, rh * 0.3), font='Nunito-Black', align='left')
        c.setStrokeColor(HexColor(color))
        c.setLineWidth(1.4)
        c.roundRect(doc.w - M - 40, y + rh / 2 - 11, 22, 22, 5, stroke=1, fill=0)
    # лента
    doc.new_page(title + ' — лента', 'Изрежи и залепи до мивката, тоалетната или в шкафчето.', name_line=False)
    per = min(n, 4)
    rows_used = 0
    y = doc.top
    sw = (doc.w - 2 * M) / per
    h = sw + 16
    copies = max(1, int((doc.top - doc.bottom) // ((h + 10) * ((n + per - 1) // per) + 24)))
    for start in [s0 for _ in range(copies) for s0 in range(0, n, per)]:
        chunk = steps[start:start + per]
        if start == 0 and y < doc.top:
            cut_line(c, M, y - 12, doc.w - M, y - 12)
            y -= 24
        y -= h + 10
        for k, (key, t) in enumerate(chunk):
            x = M + k * sw
            card(c, x + 3, y, sw - 6, h, fill=white, stroke=HexColor(color), r=12, lw=1.6)
            label(c, str(start + k + 1), x + 16, y + h - 20, 13, font='Nunito-Black', color=HexColor(color))
            picto(c, key, x + sw * 0.2, y + 34, sw * 0.6)
            fit_text(c, t, x + sw / 2, y + 12, sw - 16, 12)
        rows_used += 1
    # карти за подреждане
    doc.new_page(title + ' — карти', 'Изрежи и разбъркай. Детето подрежда стъпките по ред.', name_line=False)
    grid_cards(doc, 3, max(2, (n + 2) // 3), steps,
               lambda c, it, x, y, w, h: picto_card(c, it[0], it[1], x + 5, y + 5, w - 10, h - 10, frame=False))


@material('seq-handwashing', 'Мия си ръцете — стъпки',
          'Поредица от 7 стъпки за миене на ръце: плакат, лента до мивката и карти за подреждане.',
          'board', ['self_care', 'receptive'], name_line=False)
def seq_hand(doc):
    sequence(doc, 'Мия си ръцете', [('water', 'Пускам водата'), ('wash_hands', 'Намокрям ръцете'), ('soap', 'Слагам сапун'),
                                     ('hand', 'Търкам дланите и пръстите'), ('water', 'Изплаквам'), ('towel', 'Подсушавам'),
                                     ('done', 'Готово!')], '#0891b2')


@material('seq-toilet', 'Отивам до тоалетна — стъпки',
          'Поредица за тоалетна: казвам, отивам, събличам, сядам, хартия, пускам водата, обличам, мия ръце.',
          'board', ['self_care', 'receptive'], name_line=False)
def seq_toilet(doc):
    sequence(doc, 'Отивам до тоалетна', [('toilet', 'Казвам „Тоалетна“'), ('trousers', 'Свалям панталона'),
                                         ('sit', 'Сядам'), ('towel', 'Използвам хартия'), ('toilet', 'Пускам водата'),
                                         ('trousers', 'Обличам се'), ('wash_hands', 'Мия си ръцете'), ('done', 'Готово!')],
             '#7c3aed')


@material('seq-teeth', 'Мия си зъбите — стъпки',
          'Поредица за миене на зъби — паста, четкане отгоре и отдолу, изплакване. Плакат, лента и карти.',
          'board', ['self_care'], name_line=False)
def seq_teeth(doc):
    sequence(doc, 'Мия си зъбите', [('toothbrush', 'Взимам четката'), ('tooth_brush2', 'Слагам паста'),
                                    ('tooth', 'Мия горните зъби'), ('tooth', 'Мия долните зъби'), ('water', 'Изплаквам'),
                                    ('towel', 'Избърсвам устата'), ('done', 'Готово!')], '#0d9488')


@material('seq-dressing', 'Обличам се — стъпки',
          'Поредица за обличане навън: чорапи, панталон, блуза, яке, обувки, шапка. Плакат, лента и карти.',
          'board', ['self_care', 'fine_motor'], name_line=False)
def seq_dress(doc):
    sequence(doc, 'Обличам се', [('socks', 'Чорапи'), ('trousers', 'Панталон'), ('tshirt', 'Блуза'), ('coat', 'Яке'),
                                 ('shoes', 'Обувки'), ('cap', 'Шапка'), ('done', 'Готов съм!')], '#d97706')


@material('seq-lunch', 'На масата — стъпки и правила',
          'Поредица за хранене: мия ръце, сядам, чакам, ям с вилица, пия вода, казвам „Готово“, прибирам.',
          'board', ['self_care', 'social'], name_line=False)
def seq_lunch(doc):
    sequence(doc, 'На масата', [('wash_hands', 'Мия си ръцете'), ('sit', 'Сядам на стола'), ('wait', 'Чакам храната'),
                                ('eat', 'Ям бавно'), ('drink', 'Пия вода'), ('done', 'Казвам „Готово“'),
                                ('broom', 'Прибирам чинията')], '#ea580c')


@material('seq-arrival', 'Сутрин в училище — стъпки',
          'Поредица за пристигане: поздравявам, събличам якето, закачам раницата, мия ръце, гледам графика, сядам.',
          'board', ['self_care', 'social'], name_line=False)
def seq_arrival(doc):
    sequence(doc, 'Сутрин в училище', [('hello', 'Поздравявам'), ('coat', 'Събличам якето'), ('backpack', 'Закачам раницата'),
                                       ('wash_hands', 'Мия си ръцете'), ('calendar', 'Гледам графика'),
                                       ('sit', 'Сядам на мястото си')], '#2563eb')


# ── Груба моторика ──────────────────────────────────────────────────────────
def cube_net(doc, faces, color, title):
    c = doc.c
    doc.new_page(title, 'Изрежи по външната линия, сгъни и залепи краищата. Хвърли и направи движението!', name_line=False)
    s = min((doc.w - 2 * M - 60) / 3, (doc.top - doc.bottom - 30) / 4)
    x0 = (doc.w - 3 * s) / 2
    y0 = doc.bottom + (doc.top - doc.bottom - 4 * s) / 2
    # кръст: колона (x0+s) с 4 квадрата, ляво и дясно на втория отгоре
    cells = [(1, 3), (0, 2), (1, 2), (2, 2), (1, 1), (1, 0)]
    tabs = {(1, 3): ['W', 'E'], (0, 2): ['N', 'S'], (2, 2): ['N', 'S'], (1, 0): ['W', 'E', 'S']}
    t = s * 0.18
    for (cx, cy), side in tabs.items():
        X, Y = x0 + cx * s, y0 + cy * s
        for d in side:
            pts = {'N': [(X, Y + s), (X + t, Y + s + t), (X + s - t, Y + s + t), (X + s, Y + s)],
                   'S': [(X, Y), (X + t, Y - t), (X + s - t, Y - t), (X + s, Y)],
                   'W': [(X, Y), (X - t, Y + t), (X - t, Y + s - t), (X, Y + s)],
                   'E': [(X + s, Y), (X + s + t, Y + t), (X + s + t, Y + s - t), (X + s, Y + s)]}[d]
            path(c, pts, color=HexColor('#9aa7b8'), lw=0.8, fill=SOFT, dash=(3, 3))
    for i, ((cx, cy), (k, txt)) in enumerate(zip(cells, faces)):
        X, Y = x0 + cx * s, y0 + cy * s
        col = PALETTE[i % 8]
        c.setFillColor(tint(col, 0.88))
        c.setStrokeColor(HexColor(color))
        c.setLineWidth(1.6)
        c.rect(X, Y, s, s, stroke=1, fill=1)
        picto(c, k, X + s * 0.22, Y + s * 0.28, s * 0.56)
        fit_text(c, txt, X + s / 2, Y + s * 0.1, s - 12, 14, font='Nunito-Black')


@material('movement-cubes', 'Кубчета за движение',
          'Две кубчета за сглобяване: „Движи се!“ (скачай, пляскай, тичай на място…) и „Движи се като животно“ (жаба, мечка, птица…). За физкултура и сензорни паузи.',
          'game', ['gross_motor', 'sensory'], name_line=False)
def movement_cubes(doc):
    cube_net(doc, [('jump', 'Скачай 5 пъти'), ('clap', 'Пляскай 10 пъти'), ('run', 'Тичай на място'),
                   ('dance', 'Танцувай'), ('yoga', 'Застани като дърво'), ('hand_up', 'Протегни ръце')], '#0d9488',
             'Кубче „Движи се!“')
    cube_net(doc, [('frog', 'Скачай като жаба'), ('bear', 'Ходи като мечка'), ('bird', 'Летя като птица'),
                   ('snail', 'Пълзи като охлюв'), ('horse', 'Галопирай като кон'), ('rabbit', 'Подскачай като заек')],
             '#0d9488', 'Кубче „Като животно“')


@material('movement-cards', 'Карти за движение',
          '24 карти за двигателни паузи и физкултура — скачай, клекни, балансирай на един крак, пълзи, хвърли топка…',
          'cards', ['gross_motor', 'sensory'], name_line=False)
def movement_cards(doc):
    items = [('jump', 'Скачай'), ('run', 'Тичай на място'), ('clap', 'Пляскай'), ('dance', 'Танцувай'),
             ('yoga', 'Застани като дърво'), ('hand_up', 'Протегни се нагоре'), ('walk', 'Ходи на пръсти'),
             ('ball', 'Хвърли топката'), ('swim', 'Плувай с ръце'), ('bike', 'Карай колело с крака'),
             ('frog', 'Скачай като жаба'), ('bear', 'Ходи като мечка'), ('bird', 'Махай като птица'),
             ('snail', 'Пълзи бавно'), ('rabbit', 'Подскачай като заек'), ('elephant', 'Тропай като слон'),
             ('turtle', 'Свий се като костенурка'), ('monkey', 'Катери се като маймуна'), ('duck', 'Ходи като патица'),
             ('horse', 'Галопирай'), ('flamingo', 'Стой на един крак'), ('butterfly', 'Махай с крила'),
             ('sit', 'Седни и стани 5 пъти'), ('hug', 'Прегърни се силно')]
    for p in range(2):
        doc.new_page('Карти за движение', 'Изрежи. Изтегли карта и направи движението.', name_line=False)
        grid_cards(doc, 3, 4, items[p * 12:(p + 1) * 12],
                   lambda c, it, x, y, w, h: picto_card(c, it[0], it[1], x + 5, y + 5, w - 10, h - 10,
                                                        color='#0d9488', fill=tint('#0d9488', 0.93)))


@material('hopscotch-path', 'Пътека за скачане',
          'Цветни стъпки за пода — разпечатай, ламинирай и подреди като пътека: стъпи на крачето, скочи на двата крака, стой на един.',
          'game', ['gross_motor'], name_line=False)
def hopscotch(doc):
    c = doc.c
    kinds = [('foot', 'Стъпи', '#3b82f6'), ('foot', 'Скочи', '#ef4444'), ('flamingo', 'На един крак', '#ec4899'),
             ('stop', 'Спри', '#f59e0b')]
    for k, t, col in kinds:
        doc.new_page('Пътека: ' + t, 'Отпечатай няколко и ги подреди на пода.', name_line=False)
        H = doc.top - doc.bottom
        card(c, M + 20, doc.bottom, doc.w - 2 * M - 40, H, fill=tint(col, 0.85), stroke=HexColor(col), r=40, lw=4)
        s = H * 0.55
        if t == 'Скочи':
            f = (doc.w - 2 * M - 100) / 2
            picto(c, k, doc.w / 2 - f - 5, doc.bottom + H * 0.32, f)
            picto(c, k, doc.w / 2 + 5, doc.bottom + H * 0.32, f)
        else:
            picto(c, k, doc.w / 2 - s / 2, doc.bottom + H * 0.28, s)
        label(c, t, doc.w / 2, doc.bottom + H * 0.12, 54, font='Nunito-Black', color=HexColor(col))
