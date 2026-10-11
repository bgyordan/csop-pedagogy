"""Фина моторика: проследяване на линии и форми, рязане, лабиринти, свържи точките, мандали, оцвети по номер."""
import math
import random

from kit import *

PAIRS = [('bee', 'flower'), ('dog', 'bone'), ('rabbit', 'carrot2'), ('mouse', 'cheese'), ('monkey', 'banana'),
         ('ship', 'flag'), ('car', 'home2'), ('butterfly', 'flower'), ('rocket', 'moon'), ('snail', 'leaf'),
         ('bird', 'tree'), ('bear', 'teddy'), ('fish', 'wave'), ('plane', 'cloud'), ('bus_school', 'school'),
         ('frog', 'water'), ('hedgehog', 'apple'), ('duck', 'egg'), ('panda', 'leaf'), ('ladybug', 'flower')]


# ── форми на линиите ────────────────────────────────────────────────────────
def line_pts(kind, x1, x2, y, amp, periods=3, n=160):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = x1 + (x2 - x1) * t
        ph = t * periods * 2 * math.pi
        if kind == 'straight':
            yy = y
        elif kind == 'wave':
            yy = y + amp * math.sin(ph)
        elif kind == 'arcs':
            yy = y - amp / 2 + amp * abs(math.sin(ph / 2))
        elif kind == 'zigzag':
            f = (t * periods * 2) % 2
            yy = y - amp + 2 * amp * (f if f < 1 else 2 - f)
        elif kind == 'steps':
            f = (t * periods * 2) % 2
            yy = y + (amp if f < 1 else -amp)
        pts.append((x, yy))
    if kind == 'zigzag':      # точни върхове
        pts = []
        k = periods * 2
        for i in range(k + 1):
            pts.append((x1 + (x2 - x1) * i / k, y + (-amp if i % 2 == 0 else amp)))
    if kind == 'steps':
        pts = []
        k = periods * 2
        for i in range(k):
            xa, xb = x1 + (x2 - x1) * i / k, x1 + (x2 - x1) * (i + 1) / k
            yy = y + (amp if i % 2 == 0 else -amp)
            pts += [(xa, yy), (xb, yy)]
    return pts


def loops_pts(x1, x2, y, r, loops=5, n=400):
    """Трохоида — примки."""
    loops = 4
    a = (x2 - x1) / (2 * math.pi * loops)
    b = max(r, a * 2.1)
    tmax = loops * 2 * math.pi
    raw = [(a * t - b * math.sin(t), -b * math.cos(t)) for t in [tmax * i / n for i in range(n + 1)]]
    xs = [p[0] for p in raw]
    k = (x2 - x1) / (max(xs) - min(xs))
    return [(x1 + (px - min(xs)) * k, y + py) for px, py in raw]


def trace_rows(doc, kinds, pairs, amp=18, periods=3):
    c = doc.c
    n = len(kinds)
    H = doc.top - doc.bottom
    rh = H / n
    for i, kind in enumerate(kinds):
        yc = doc.top - rh * (i + 0.5)
        a, b = pairs[i % len(pairs)]
        ps = min(46, rh * 0.55)
        picto(c, a, M + 4, yc - ps / 2, ps)
        picto(c, b, doc.w - M - 4 - ps, yc - ps / 2, ps)
        x1, x2 = M + ps + 22, doc.w - M - ps - 22
        if kind == 'loops':
            pts = loops_pts(x1, x2, yc, min(amp, rh * 0.3), loops=periods + 2)
        else:
            pts = line_pts(kind, x1, x2, yc, min(amp, rh * 0.32), periods)
        dashed_path(c, pts, lw=5)
        dot(c, *pts[0], r=5.5, color=HexColor('#10b981'))
        dot(c, *pts[-1], r=5.5, color=HexColor('#ef4444'))


@material('trace-straight', 'Проследи: прави и наклонени линии',
          'Проследяване с молив от пиктограмата до целта — хоризонтални, вертикални и наклонени линии. Зелена точка — начало, червена — край.',
          'worksheet', ['fine_motor'])
def trace_straight(doc):
    doc.new_page('Прави линии', 'Помогни им да стигнат до целта. Тръгни от зелената точка.')
    trace_rows(doc, ['straight'] * 6, PAIRS[:6])
    # вертикални
    doc.new_page('Отгоре надолу', 'Тръгни отгоре и стигни долу.')
    c = doc.c
    cols = 5
    cw = (doc.w - 2 * M) / cols
    pairs = [('rain', 'flower'), ('star_night', 'home2'), ('leaf', 'hedgehog'), ('snow', 'tree'), ('apple', 'backpack')]
    for i, (a, b) in enumerate(pairs):
        x = M + cw * (i + 0.5)
        ps = 46
        picto(c, a, x - ps / 2, doc.top - ps - 4, ps)
        picto(c, b, x - ps / 2, doc.bottom + 4, ps)
        y1, y2 = doc.top - ps - 20, doc.bottom + ps + 20
        dashed_path(c, [(x, y1), (x, y2)])
        dot(c, x, y1, 5.5, HexColor('#10b981'))
        dot(c, x, y2, 5.5, HexColor('#ef4444'))
    # наклонени
    doc.new_page('Наклонени линии', 'Проследи всяка линия отгоре надолу.')
    rows = 5
    rh = (doc.top - doc.bottom) / rows
    for r in range(rows):
        yt = doc.top - r * rh - 16
        yb = yt - rh + 30
        picto(c, PAIRS[r + 6][0], M, yt - 38, 36)
        n = 6
        x0 = M + 54
        seg = (doc.w - M - x0) / n
        for k in range(n):
            xa = x0 + k * seg + 6
            xb = xa + seg - 18
            if r % 2:
                xa, xb = xb, xa
            dashed_path(c, [(xa, yt), (xb, yb)], lw=4.5)
            dot(c, xa, yt, 4.5, HexColor('#10b981'))


@material('trace-curves', 'Проследи: вълни, дъги и примки',
          'Пет вида криви линии с нарастваща трудност — вълни, дъги, зигзаг, стъпала и примки. Подготовка за писане.',
          'worksheet', ['fine_motor', 'academic'])
def trace_curves(doc):
    doc.new_page('Вълни', 'Плувай по вълните до целта.')
    trace_rows(doc, ['wave'] * 3 + ['wave'] * 3, PAIRS[8:14], amp=22, periods=3)
    doc.new_page('Дъги', 'Скачай по дъгичките.')
    trace_rows(doc, ['arcs'] * 6, PAIRS[2:8], amp=24, periods=4)
    doc.new_page('Зигзаг', 'Изкачи всички планини.')
    trace_rows(doc, ['zigzag'] * 6, PAIRS[10:16], amp=18, periods=4)
    doc.new_page('Стъпала', 'Качи се и слез по стъпалата.')
    trace_rows(doc, ['steps'] * 6, PAIRS[4:10], amp=14, periods=4)
    doc.new_page('Примки', 'Завъртай моливчето като пружина.')
    trace_rows(doc, ['loops'] * 6, PAIRS[12:18], amp=20, periods=3)
    # спирали
    doc.new_page('Спирали', 'Започни от средата и върти навън.')
    c = doc.c
    centers = [(doc.w * 0.3, doc.top - 170), (doc.w * 0.7, doc.top - 170),
               (doc.w * 0.3, doc.bottom + 190), (doc.w * 0.7, doc.bottom + 190)]
    for i, (cx, cy) in enumerate(centers):
        R = 92
        pts = [(cx + (R * t / (6 * math.pi)) * math.cos(t), cy + (R * t / (6 * math.pi)) * math.sin(t)) for t in
               [6 * math.pi * k / 400 for k in range(401)]]
        dashed_path(c, pts, lw=4.5)
        dot(c, *pts[0], 5.5, HexColor('#10b981'))
        ex, ey = pts[-1]
        picto(c, ['snail', 'star', 'butterfly', 'bee'][i], ex + 8, ey - 34, 34)


SHAPES = ['circle', 'square', 'triangle', 'rect', 'star', 'heart', 'rhombus', 'oval']
SHAPE_BG = {'circle': 'кръг', 'square': 'квадрат', 'triangle': 'триъгълник', 'rect': 'правоъгълник',
            'star': 'звезда', 'heart': 'сърце', 'rhombus': 'ромб', 'oval': 'овал'}


def shape_pts(kind, cx, cy, r):
    if kind == 'circle':
        return [(cx + r * math.cos(2 * math.pi * i / 90), cy + r * math.sin(2 * math.pi * i / 90)) for i in range(91)]
    if kind == 'oval':
        return [(cx + r * 1.25 * math.cos(2 * math.pi * i / 90), cy + r * 0.75 * math.sin(2 * math.pi * i / 90)) for i in range(91)]
    if kind == 'square':
        return [(cx - r, cy - r), (cx + r, cy - r), (cx + r, cy + r), (cx - r, cy + r), (cx - r, cy - r)]
    if kind == 'rect':
        return [(cx - r * 1.35, cy - r * 0.8), (cx + r * 1.35, cy - r * 0.8), (cx + r * 1.35, cy + r * 0.8),
                (cx - r * 1.35, cy + r * 0.8), (cx - r * 1.35, cy - r * 0.8)]
    if kind == 'triangle':
        return polygon(3, cx, cy - r * 0.2, r * 1.15)
    if kind == 'rhombus':
        return [(cx, cy + r * 1.1), (cx + r * 0.8, cy), (cx, cy - r * 1.1), (cx - r * 0.8, cy), (cx, cy + r * 1.1)]
    if kind == 'star':
        return star_pts(cx, cy - r * 0.08, r * 1.15, r * 0.5)
    if kind == 'heart':
        return heart_pts(cx, cy + r * 0.12, r / 15.5)


@material('trace-shapes', 'Проследи формите',
          'Осем геометрични форми в три размера — първо образец, после проследяване по пунктира. Кръг, квадрат, триъгълник, правоъгълник, звезда, сърце, ромб, овал.',
          'worksheet', ['fine_motor', 'cognitive'])
def trace_shapes(doc):
    c = doc.c
    for page in range(2):
        doc.new_page('Проследи формите', 'Оцвети образеца. После проследи формите по пунктира.')
        rows = SHAPES[page * 4:(page + 1) * 4]
        rh = (doc.top - doc.bottom) / 4
        for i, kind in enumerate(rows):
            col = PALETTE[(page * 4 + i) % len(PALETTE)]
            y = doc.top - rh * (i + 0.5)
            label(c, SHAPE_BG[kind], M + 52, y - 52, 11, color=HexColor(col))
            path(c, shape_pts(kind, M + 52, y + 6, 32), color=HexColor(col), lw=2.5, fill=tint(col, 0.75))
            xs = [M + 175, M + 300, M + 410]
            for k, (x, r) in enumerate(zip(xs, [44, 34, 24])):
                dashed_path(c, shape_pts(kind, x, y + 4, r), lw=3.5, dash=(1, 7))
            # малки за самостоятелно рисуване
            x = M + 470
            dashed_path(c, shape_pts(kind, x, y + 4, 16), lw=3, dash=(1, 6))
            c.setStrokeColor(LINE)
            c.setLineWidth(0.6)
            if i < 3:
                c.line(M, y - rh / 2, doc.w - M, y - rh / 2)


@material('cutting', 'Режи по линията',
          'Ленти за рязане с ножица — права, вълнообразна, зигзаг, стъпала и дъги, после форми за изрязване. Тренира координация око–ръка.',
          'worksheet', ['fine_motor'])
def cutting(doc):
    c = doc.c
    for page, kinds in enumerate([['straight', 'straight', 'wave', 'zigzag', 'steps'], ['wave', 'arcs', 'zigzag', 'steps', 'loops']]):
        doc.new_page('Режи по линията' if page == 0 else 'Режи по линията — по-трудно',
                     'Режи с ножицата по цветната линия, от ножицата до картинката.')
        n = len(kinds)
        rh = (doc.top - doc.bottom) / n
        for i, kind in enumerate(kinds):
            y = doc.top - rh * (i + 0.5)
            col = HexColor(PALETTE[i + page * 2])
            picto(c, 'scissors', M, y - 14, 28)
            a, b = PAIRS[i + page * 5]
            picto(c, b, doc.w - M - 40, y - 20, 40)
            x1, x2 = M + 38, doc.w - M - 50
            amp = min(16 + page * 4, rh * 0.3)
            if kind == 'loops':
                pts = loops_pts(x1, x2, y, amp * 0.8, loops=4)
            else:
                pts = line_pts(kind, x1, x2, y, amp, 3 + page)
            path(c, pts, color=col, lw=3.2)
            cut_line(c, M, y - rh / 2, doc.w - M, y - rh / 2) if i < n - 1 else None
    doc.new_page('Изрежи формите', 'Изрежи всяка форма по линията.')
    rh = (doc.top - doc.bottom) / 3
    cells = [(doc.w * (0.28 if i % 2 == 0 else 0.72), doc.top - rh * (i // 2 + 0.5)) for i in range(6)]
    for i, (kind, (x, y)) in enumerate(zip(['circle', 'square', 'triangle', 'star', 'heart', 'rhombus'], cells)):
        col = PALETTE[i]
        path(c, shape_pts(kind, x, y, 82), color=HexColor(col), lw=3.2, fill=tint(col, 0.85))
        label(c, SHAPE_BG[kind], x, y - 6, 15, color=HexColor(col))


# ── лабиринти ───────────────────────────────────────────────────────────────
def maze(cols, rows, seed):
    rnd = random.Random(seed)
    walls = {(x, y): {'N', 'S', 'E', 'W'} for x in range(cols) for y in range(rows)}
    seen = {(0, 0)}
    stack = [(0, 0)]
    D = {'N': (0, 1, 'S'), 'S': (0, -1, 'N'), 'E': (1, 0, 'W'), 'W': (-1, 0, 'E')}
    while stack:
        x, y = stack[-1]
        opts = [(d, x + dx, y + dy, o) for d, (dx, dy, o) in D.items() if (x + dx, y + dy) in walls and (x + dx, y + dy) not in seen]
        if not opts:
            stack.pop()
            continue
        d, nx, ny, o = rnd.choice(opts)
        walls[(x, y)].discard(d)
        walls[(nx, ny)].discard(o)
        seen.add((nx, ny))
        stack.append((nx, ny))
    return walls


def draw_maze(doc, cols, rows, seed, start, end, color):
    c = doc.c
    W = doc.w - 2 * M - 20
    H = doc.top - doc.bottom - 130
    s = min(W / cols, H / rows)
    x0 = (doc.w - s * cols) / 2
    y0 = doc.bottom + 62 + (H - s * rows) / 2
    walls = maze(cols, rows, seed)
    # вход горе вляво (клетка 0,rows-1), изход долу вдясно (cols-1,0)
    walls[(0, rows - 1)].discard('N')
    walls[(cols - 1, 0)].discard('S')
    c.saveState()
    c.setStrokeColor(HexColor(color))
    c.setLineWidth(max(2.5, s * 0.09))
    c.setLineCap(1)
    for (x, y), ws in walls.items():
        X, Y = x0 + x * s, y0 + y * s
        if 'S' in ws:
            c.line(X, Y, X + s, Y)
        if 'W' in ws:
            c.line(X, Y, X, Y + s)
        if 'N' in ws and y == rows - 1:
            c.line(X, Y + s, X + s, Y + s)
        if 'E' in ws and x == cols - 1:
            c.line(X + s, Y, X + s, Y + s)
    c.restoreState()
    ps = 48
    picto(c, start, x0 + s / 2 - ps / 2, y0 + rows * s + 6, ps)
    picto(c, end, x0 + (cols - 0.5) * s - ps / 2, y0 - ps - 6, ps)


@material('mazes', 'Лабиринти',
          'Шест лабиринта с нарастваща трудност — от широки коридори за начинаещи до по-сложни. Всеки има история: помогни на пчеличката да стигне до цветето.',
          'worksheet', ['fine_motor', 'cognitive'])
def mazes(doc):
    levels = [(4, 5), (5, 6), (6, 8), (8, 10), (10, 12), (12, 15)]
    stories = [('bee', 'flower', 'Помогни на пчеличката да стигне до цветето.'),
               ('dog', 'bone', 'Заведи кучето до кокала.'),
               ('mouse', 'cheese', 'Мишката е гладна. Къде е сиренето?'),
               ('car', 'home2', 'Колата се прибира вкъщи.'),
               ('rocket', 'moon', 'Полети с ракетата до Луната.'),
               ('ship', 'flag', 'Корабът плава към пристанището.')]
    for i, ((cl, rw), (a, b, txt)) in enumerate(zip(levels, stories)):
        doc.new_page(f'Лабиринт {i + 1}', txt)
        draw_maze(doc, cl, rw, 100 + i, a, b, PALETTE[i % len(PALETTE)])
        label(doc.c, '★' * 0 + ['Лесно', 'Лесно', 'Средно', 'Средно', 'Трудно', 'Трудно'][i], doc.w - M - 4, doc.top + 2, 9,
              color=MUTED, align='right')


# ── свържи точките ──────────────────────────────────────────────────────────
DOTS = {
    'star': ('звезда', 'star', [(0.5, 1.0), (0.62, 0.66), (0.98, 0.65), (0.69, 0.43), (0.8, 0.08), (0.5, 0.28),
                                (0.2, 0.08), (0.31, 0.43), (0.02, 0.65), (0.38, 0.66)]),
    'house': ('къща', 'home2', [(0.15, 0.0), (0.85, 0.0), (0.85, 0.55), (0.75, 0.66), (0.75, 0.9), (0.62, 0.9),
                                (0.62, 0.78), (0.5, 0.95), (0.15, 0.55)]),
    'heart': ('сърце', 'heart', [(0.5, 0.0), (0.78, 0.25), (0.97, 0.52), (0.95, 0.8), (0.78, 0.95), (0.6, 0.92),
                                 (0.5, 0.78), (0.4, 0.92), (0.22, 0.95), (0.05, 0.8), (0.03, 0.52), (0.22, 0.25)]),
    'fish': ('риба', 'fish', [(0.0, 0.5), (0.12, 0.72), (0.35, 0.85), (0.58, 0.8), (0.75, 0.6), (1.0, 0.85),
                              (0.92, 0.5), (1.0, 0.15), (0.75, 0.4), (0.58, 0.2), (0.35, 0.15), (0.12, 0.28)]),
    'boat': ('лодка', 'ship', [(0.0, 0.28), (0.18, 0.0), (0.82, 0.0), (1.0, 0.28), (0.52, 0.28), (0.52, 1.0),
                               (0.95, 0.38), (0.52, 0.38)]),
    'tree': ('елха', 'tree', [(0.42, 0.0), (0.58, 0.0), (0.58, 0.12), (0.95, 0.12), (0.7, 0.4), (0.85, 0.4),
                              (0.62, 0.68), (0.75, 0.68), (0.5, 1.0), (0.25, 0.68), (0.38, 0.68), (0.15, 0.4),
                              (0.3, 0.4), (0.05, 0.12), (0.42, 0.12)]),
    'rocket': ('ракета', 'rocket', [(0.5, 1.0), (0.66, 0.75), (0.66, 0.3), (0.85, 0.12), (0.85, 0.0), (0.62, 0.12),
                                    (0.38, 0.12), (0.15, 0.0), (0.15, 0.12), (0.34, 0.3), (0.34, 0.75)]),
    'kite': ('хвърчило', 'kite', [(0.5, 1.0), (0.85, 0.6), (0.5, 0.15), (0.15, 0.6)]),
}


@material('dot-to-dot', 'Свържи точките',
          'Свържи точките по ред на числата и открий картинката. От 4 до 15 точки — броене и графомоторика едновременно.',
          'worksheet', ['fine_motor', 'academic'])
def dot_to_dot(doc):
    c = doc.c
    order = ['kite', 'house', 'star', 'boat', 'rocket', 'fish', 'heart', 'tree']
    for key in order:
        name, pk, pts = DOTS[key]
        n = len(pts)
        doc.new_page(f'Свържи точките 1–{n}', f'Започни от 1, свържи точките по ред и от {n} се върни на 1.')
        S = min(doc.w - 2 * M - 120, doc.top - doc.bottom - 150)
        x0 = (doc.w - S) / 2
        y0 = doc.bottom + 110
        P = [(x0 + px * S, y0 + py * S) for px, py in pts]
        cx = sum(p[0] for p in P) / n
        cy = sum(p[1] for p in P) / n
        for i, (x, y) in enumerate(P):
            dot(c, x, y, 5, INK if i else HexColor('#10b981'))
            dx, dy = x - cx, y - cy
            L = math.hypot(dx, dy) or 1
            label(c, str(i + 1), x + dx / L * 18, y + dy / L * 18 - 5, 15, color=HexColor(doc.color))
        # намек: първата отсечка пунктирно
        dashed_path(c, [P[0], P[1]], lw=2.5, dash=(2, 5), color=TRACE)
        card(c, M, doc.bottom, doc.w - 2 * M, 70, fill=SOFT, stroke=None)
        label(c, 'Това е:', M + 20, doc.bottom + 28, 14, align='left', color=MUTED)
        c.setStrokeColor(LINE)
        c.line(M + 80, doc.bottom + 26, M + 300, doc.bottom + 26)
        label(c, 'Оцвети картинката.', doc.w - M - 20, doc.bottom + 28, 12, align='right', color=MUTED)


# ── мандали ─────────────────────────────────────────────────────────────────
def petal(c, cx, cy, r1, r2, ang, width):
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    px, py = -uy, ux
    p0 = (cx + ux * r1, cy + uy * r1)
    p1 = (cx + ux * r2, cy + uy * r2)
    mid = (r1 + r2) / 2
    c1 = (cx + ux * mid + px * width, cy + uy * mid + py * width)
    c2 = (cx + ux * mid - px * width, cy + uy * mid - py * width)
    p = c.beginPath()
    p.moveTo(*p0)
    p.curveTo(c1[0], c1[1], c1[0], c1[1], *p1)
    p.curveTo(c2[0], c2[1], c2[0], c2[1], *p0)
    c.drawPath(p, stroke=1, fill=0)


def mandala(c, cx, cy, R, seed):
    rnd = random.Random(seed)
    c.saveState()
    c.setStrokeColor(INK)
    c.setLineWidth(1.5)
    c.setLineJoin(1)
    r = R * 0.12
    c.circle(cx, cy, r, stroke=1, fill=0)
    while r < R * 0.95:
        n = rnd.choice([6, 8, 10, 12, 16])
        step = R * rnd.uniform(0.13, 0.2)
        kind = rnd.choice(['petal', 'petal', 'circles', 'arcs', 'drops'])
        r2 = min(R, r + step)
        if kind == 'petal':
            for i in range(n):
                petal(c, cx, cy, r, r2, 360 * i / n, (r2 - r) * rnd.uniform(0.25, 0.45) * 12 / n * 1.4)
        elif kind == 'circles':
            rr = min((r2 - r) / 2, math.pi * (r + r2) / 2 / n * 0.45)
            for i in range(n):
                a = 2 * math.pi * i / n
                c.circle(cx + math.cos(a) * (r + r2) / 2, cy + math.sin(a) * (r + r2) / 2, rr, stroke=1, fill=0)
        elif kind == 'arcs':
            for i in range(n):
                a1 = 360 * i / n
                p = c.beginPath()
                p.arc(cx - r2, cy - r2, cx + r2, cy + r2, a1, 360 / n)
                c.drawPath(p, stroke=1, fill=0)
                a = math.radians(a1)
                c.line(cx + math.cos(a) * r, cy + math.sin(a) * r, cx + math.cos(a) * r2, cy + math.sin(a) * r2)
        else:
            for i in range(n):
                petal(c, cx, cy, r, r2, 360 * (i + 0.5) / n, (r2 - r) * 0.3)
                a = math.radians(360 * i / n)
                c.circle(cx + math.cos(a) * (r2 - (r2 - r) * 0.25), cy + math.sin(a) * (r2 - (r2 - r) * 0.25), (r2 - r) * 0.12, stroke=1, fill=0)
        c.circle(cx, cy, r2, stroke=1, fill=0)
        r = r2
    c.restoreState()


@material('mandalas', 'Мандали за оцветяване',
          'Шест симетрични мандали — от едри и прости до по-детайлни. Успокояваща дейност за концентрация и фина моторика.',
          'worksheet', ['fine_motor', 'sensory'])
def mandalas(doc):
    for i, seed in enumerate([3, 11, 21, 35, 48, 77]):
        doc.new_page(f'Мандала {i + 1}', 'Оцвети спокойно, отвътре навън.')
        R = min(doc.w - 2 * M, doc.top - doc.bottom) / 2 - 10
        mandala(doc.c, doc.w / 2, (doc.top + doc.bottom) / 2, R, seed)


# ── оцвети по номер ─────────────────────────────────────────────────────────
PIXEL = {
    'heart': ('сърце', {'1': '#ef4444', '2': '#fecaca'}, [
        '.111...111.',
        '12211.11111',
        '12211111111',
        '11111111111',
        '11111111111',
        '.111111111.',
        '..1111111..',
        '...11111...',
        '....111....',
        '.....1.....']),
    'house': ('къща', {'1': '#ef4444', '2': '#f59e0b', '3': '#3b82f6', '4': '#92400e', '5': '#10b981'}, [
        '.....1.....',
        '....111....',
        '...11111...',
        '..1111111..',
        '.111111111.',
        '..2222222..',
        '..2332332..',
        '..2332332..',
        '..2224222..',
        '..2224222..',
        '55555555555']),
    'fish': ('рибка', {'1': '#f97316', '2': '#fde047', '3': '#1f2a3d', '4': '#38bdf8'}, [
        '44444444444',
        '44411114444',
        '44111111144',
        '41311111122',
        '11111111222',
        '41111111122',
        '44111111144',
        '44411114444',
        '44444444444']),
    'flower': ('цвете', {'1': '#ec4899', '2': '#fde047', '3': '#10b981', '4': '#38bdf8'}, [
        '44441114444',
        '44111211144',
        '44112221144',
        '44111211144',
        '44441114444',
        '44444344444',
        '44433344444',
        '44444333444',
        '44444344444',
        '33333333333']),
}


@material('color-by-number', 'Оцвети по номер',
          'Картинки в квадратчета — всяко число е цвят. Тренира разпознаване на цифри, цветове и внимателно оцветяване.',
          'worksheet', ['fine_motor', 'academic', 'cognitive'])
def color_by_number(doc):
    c = doc.c
    names = {'#ef4444': 'червено', '#fecaca': 'розово', '#f59e0b': 'оранжево', '#3b82f6': 'синьо', '#92400e': 'кафяво',
             '#10b981': 'зелено', '#f97316': 'оранжево', '#fde047': 'жълто', '#1f2a3d': 'черно', '#38bdf8': 'светлосиньо',
             '#ec4899': 'розово'}
    for key, (title, cols, rows) in PIXEL.items():
        doc.new_page(f'Оцвети по номер: {title}', 'Оцвети всяко квадратче с цвета на числото.')
        rows = [r.replace(' ', '1') for r in rows]
        nr, nc = len(rows), max(len(r) for r in rows)
        S = min((doc.w - 2 * M - 20) / nc, (doc.top - doc.bottom - 110) / nr)
        x0 = (doc.w - S * nc) / 2
        y0 = doc.top - 10 - S * nr
        for i, row in enumerate(rows):
            for j, ch in enumerate(row.ljust(nc, '.')):
                X, Y = x0 + j * S, y0 + (nr - 1 - i) * S
                c.setStrokeColor(HexColor('#94a3b8'))
                c.setLineWidth(0.8)
                c.setFillColor(white)
                c.rect(X, Y, S, S, stroke=1, fill=1)
                if ch != '.':
                    label(c, ch, X + S / 2, Y + S / 2 - S * 0.14, S * 0.4, font='Nunito-Bold', color=MUTED)
        # легенда
        x = M + 10
        y = doc.bottom + 30
        for k, col in cols.items():
            card(c, x, y, 34, 34, fill=HexColor(col), stroke=None, r=8)
            label(c, k, x + 17, y + 11, 16, color=white if col not in ('#fde047', '#fecaca') else INK)
            label(c, names.get(col, ''), x + 42, y + 12, 11, align='left', color=INK)
            x += 112
