"""Дизайн система за материалите на ЦСОП (A4, PDF): шрифтове, цветове, хедър/футър, пиктограми, кутии, линии.

Шрифтове: Nunito (заглавия, текст) и Andika (букви за писане — ясни форми за начинаещи читатели), SIL OFL.
Пиктограми: Twemoji, CC-BY 4.0 (виж pictos.py).
"""
import copy
import math
import os

from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.graphics import renderPDF
from reportlab.graphics.shapes import Group
from svglib.svglib import svg2rlg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PICTOS = os.path.join(ROOT, 'public', 'pictos')

for name, file in [('Nunito', 'Nunito-Regular'), ('Nunito-Bold', 'Nunito-Bold'), ('Nunito-Black', 'Nunito-Black'),
                   ('Andika', 'Andika-Regular'), ('Andika-Bold', 'Andika-Bold')]:
    pdfmetrics.registerFont(TTFont(name, os.path.join(HERE, 'fonts', file + '.ttf')))

PW, PH = A4
M = 36  # поле

INK = HexColor('#1f2a3d')
MUTED = HexColor('#6b7a90')
LINE = HexColor('#cfd8e3')
SOFT = HexColor('#f4f7fb')
TRACE = HexColor('#c9d3df')   # сиво за проследяване

AREA = {
    'gross_motor': ('Груба моторика', '#0d9488'), 'fine_motor': ('Фина моторика', '#0891b2'),
    'receptive': ('Разбиране на речта', '#7c3aed'), 'expressive': ('Изразяване и комуникация', '#c026d3'),
    'cognitive': ('Познавателни умения', '#2563eb'), 'social': ('Социално-емоционално', '#e11d48'),
    'sensory': ('Сензорика и поведение', '#475569'), 'self_care': ('Самообслужване', '#d97706'),
    'academic': ('Учебни умения', '#65a30d'),
}

PALETTE = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']


def tint(hex_color: str, k: float) -> Color:
    """Смесва цвета с бяло (k=0 → цветът, k=1 → бяло)."""
    c = HexColor(hex_color)
    return Color(c.red + (1 - c.red) * k, c.green + (1 - c.green) * k, c.blue + (1 - c.blue) * k)


# ── Пиктограми ──────────────────────────────────────────────────────────────
_cache: dict = {}


def _drawing(key: str):
    if key not in _cache:
        path = os.path.join(PICTOS, key + '.svg')
        if not os.path.exists(path):
            raise KeyError(f'няма пиктограма „{key}“')
        _cache[key] = svg2rlg(path)
    return _cache[key]


def _recolor(node, color):
    if hasattr(node, 'fillColor') and getattr(node, 'fillColor', None) is not None:
        node.fillColor = color
    if hasattr(node, 'strokeColor') and getattr(node, 'strokeColor', None) is not None:
        node.strokeColor = color
    for ch in getattr(node, 'contents', []) or []:
        _recolor(ch, color)


def picto(c, key: str, x: float, y: float, size: float, silhouette=None):
    """Рисува пиктограма с долен ляв ъгъл (x, y) и размер size. silhouette=цвят → само силует (за „сенки“)."""
    d = _drawing(key)
    if silhouette is not None:
        d = copy.deepcopy(d)
        _recolor(d, silhouette)
    s = size / max(d.width, d.height)
    c.saveState()
    c.translate(x, y)
    c.scale(s, s)
    renderPDF.draw(d, c, 0, 0)
    c.restoreState()


# ── Страница ────────────────────────────────────────────────────────────────
class Doc:
    """Един материал = един PDF. new_page() рисува хедъра и футъра в стила на ЦСОП."""

    def __init__(self, path: str, title: str, area: str, land=False, name_line=True):
        self.size = landscape(A4) if land else A4
        self.w, self.h = self.size
        self.c = canvas.Canvas(path, pagesize=self.size)
        self.c.setTitle(title)
        self.c.setAuthor('ЦСОП Варна — ЕИС')
        self.title, self.area, self.name_line = title, area, name_line
        self.pages = 0
        self.color = AREA[area][1]

    def new_page(self, subtitle: str = '', instruction: str = '', name_line=None):
        if self.pages:
            self.c.showPage()
        self.pages += 1
        c, w, h = self.c, self.w, self.h
        # цветна лента горе
        c.setFillColor(tint(self.color, 0.88))
        c.roundRect(M, h - M - 46, w - 2 * M, 46, 14, stroke=0, fill=1)
        c.setFillColor(HexColor(self.color))
        c.roundRect(M, h - M - 46, 8, 46, 4, stroke=0, fill=1)
        c.setFont('Nunito-Bold', 8.5)
        c.setFillColor(HexColor(self.color))
        c.drawString(M + 20, h - M - 17, AREA[self.area][0].upper())
        c.setFont('Nunito-Black', 17)
        c.setFillColor(INK)
        c.drawString(M + 20, h - M - 37, subtitle or self.title)
        if (self.name_line if name_line is None else name_line):
            c.setFont('Nunito', 9.5)
            c.setFillColor(MUTED)
            c.drawRightString(w - M - 16, h - M - 20, 'Име: ______________________')
            c.drawRightString(w - M - 16, h - M - 36, 'Дата: ____________')
        top = h - M - 46 - 10
        if instruction:
            c.setFont('Nunito-Bold', 12)
            c.setFillColor(MUTED)
            c.drawString(M + 4, top - 14, instruction)
            top -= 26
        # футър
        c.setFont('Nunito', 7)
        c.setFillColor(HexColor('#9aa7b8'))
        c.drawString(M, M - 16, 'ЦСОП Варна · Материали в ЕИС')
        c.drawRightString(w - M, M - 16, 'Пиктограми: Twemoji, CC-BY 4.0')
        self.top = top          # горната граница на съдържанието
        self.bottom = M + 4
        return top

    def save(self):
        self.c.showPage()
        self.c.save()


# ── Помощни елементи ────────────────────────────────────────────────────────
def card(c, x, y, w, h, fill=white, stroke=LINE, r=14, lw=1.2, dash=None):
    c.saveState()
    if fill:
        c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
    c.setLineWidth(lw)
    if dash:
        c.setDash(*dash)
    c.roundRect(x, y, w, h, r, stroke=1 if stroke else 0, fill=1 if fill else 0)
    c.restoreState()


def label(c, text, x, y, size=13, font='Nunito-Bold', color=INK, align='center'):
    c.setFont(font, size)
    c.setFillColor(color)
    if align == 'center':
        c.drawCentredString(x, y, text)
    elif align == 'right':
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def fit_text(c, text, x, y, max_w, size=13, font='Nunito-Bold', color=INK, min_size=7):
    """Центриран текст, който се смалява да се побере в max_w."""
    while size > min_size and pdfmetrics.stringWidth(text, font, size) > max_w:
        size -= 0.5
    label(c, text, x, y, size, font, color)


def dashed_path(c, pts, color=TRACE, lw=5, dash=(1, 9), cap=1):
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.setLineCap(cap)
    c.setLineJoin(1)
    c.setDash(*dash)
    p = c.beginPath()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    c.drawPath(p, stroke=1, fill=0)
    c.restoreState()


def dot(c, x, y, r=5, color=INK):
    c.saveState()
    c.setFillColor(color)
    c.circle(x, y, r, stroke=0, fill=1)
    c.restoreState()


def cut_line(c, x1, y1, x2, y2):
    """Пунктир за изрязване (сив)."""
    c.saveState()
    c.setStrokeColor(HexColor('#9aa7b8'))
    c.setLineWidth(0.8)
    c.setDash(4, 4)
    c.line(x1, y1, x2, y2)
    c.restoreState()


def scissors_mark(c, x, y, size=12):
    picto(c, 'scissors', x, y, size)


def grid_cards(doc, cols, rows, items, draw_item, top=None, bottom=None, gap=10, cut=True):
    """Разполага карти в мрежа; draw_item(c, item, x, y, w, h)."""
    c = doc.c
    top = top if top is not None else doc.top
    bottom = bottom if bottom is not None else doc.bottom
    W = doc.w - 2 * M
    H = top - bottom
    cw = (W - gap * (cols - 1)) / cols
    ch = (H - gap * (rows - 1)) / rows
    for i, it in enumerate(items[:cols * rows]):
        r, k = divmod(i, cols)
        x = M + k * (cw + gap)
        y = top - (r + 1) * ch - r * gap
        if cut:
            card(c, x, y, cw, ch, fill=white, stroke=HexColor('#b8c4d3'), r=10, lw=0.9, dash=(4, 3))
        draw_item(c, it, x, y, cw, ch)
    return cw, ch


def polygon(n, cx, cy, r, rot=90):
    return [(cx + r * math.cos(math.radians(rot + 360 * i / n)), cy + r * math.sin(math.radians(rot + 360 * i / n))) for i in range(n + 1)]


def star_pts(cx, cy, r1, r2, n=5):
    pts = []
    for i in range(2 * n + 1):
        r = r1 if i % 2 == 0 else r2
        a = math.radians(90 + 180 * i / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def heart_pts(cx, cy, s, n=80):
    pts = []
    for i in range(n + 1):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s, cy + y * s))
    return pts


# ── Регистър на материалите ─────────────────────────────────────────────────
REG: list = []


def material(key, title, description, kind, areas, land=False, name_line=True):
    """Декоратор: регистрира функция f(doc), която рисува страниците на един материал."""
    def wrap(f):
        REG.append(dict(key=key, title=title, description=description, kind=kind, areas=areas,
                        land=land, name_line=name_line, fn=f))
        return f
    return wrap


def picto_card(c, key, text, x, y, w, h, color=None, pad=None, font_size=None, frame=True, fill=white):
    """Карта: пиктограма + надпис отдолу. color — цветна рамка/лента (Fitzgerald и т.н.)."""
    if frame:
        card(c, x, y, w, h, fill=fill, stroke=HexColor(color) if color else LINE, r=min(w, h) * 0.09,
             lw=2.2 if color else 1.1)
    fs = font_size or max(8, min(16, w * 0.14))
    lab_h = fs * 1.6 if text else 0
    pad = pad if pad is not None else min(w, h) * 0.12
    s = min(w - 2 * pad, h - 2 * pad - lab_h)
    picto(c, key, x + (w - s) / 2, y + lab_h + pad * 0.8 + (h - 2 * pad - lab_h - s) / 2, s)
    if text:
        fit_text(c, text, x + w / 2, y + pad * 0.55 + fs * 0.3, w - 8, size=fs)


def trace_text(c, text, x, y, size, font='Andika', color=TRACE, dashed=False, align='left', lw=1.6):
    """Текст за проследяване: светло сив пълнеж или пунктирен контур."""
    c.saveState()
    t = c.beginText()
    t.setFont(font, size)
    width = pdfmetrics.stringWidth(text, font, size)
    if align == 'center':
        x -= width / 2
    t.setTextOrigin(x, y)
    if dashed:
        t.setTextRenderMode(1)
        c.setStrokeColor(color)
        c.setLineWidth(lw)
        c.setDash(3, 3)
        c.setLineCap(1)
    else:
        t.setFillColor(color)
    t.textOut(text)
    c.drawText(t)
    c.restoreState()
    return width


def arrow(c, x1, y1, x2, y2, color=MUTED, lw=2, head=8):
    c.saveState()
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(lw)
    c.setLineCap(1)
    a = math.atan2(y2 - y1, x2 - x1)
    c.line(x1, y1, x2 - head * 0.8 * math.cos(a), y2 - head * 0.8 * math.sin(a))
    p = c.beginPath()
    p.moveTo(x2, y2)
    p.lineTo(x2 - head * math.cos(a - 0.45), y2 - head * math.sin(a - 0.45))
    p.lineTo(x2 - head * math.cos(a + 0.45), y2 - head * math.sin(a + 0.45))
    p.close()
    c.drawPath(p, stroke=0, fill=1)
    c.restoreState()


def path(c, pts, color=INK, lw=2, fill=None, close=False, dash=None):
    c.saveState()
    if color is not None:
        c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.setLineJoin(1)
    c.setLineCap(1)
    if dash:
        c.setDash(*dash)
    if fill is not None:
        c.setFillColor(fill)
    p = c.beginPath()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    if close:
        p.close()
    c.drawPath(p, stroke=1 if color is not None else 0, fill=1 if fill is not None else 0)
    c.restoreState()


def pill(c, text, x, y, color, size=10, pad=7, text_color=white):
    w = pdfmetrics.stringWidth(text, 'Nunito-Bold', size) + 2 * pad
    c.saveState()
    c.setFillColor(HexColor(color) if isinstance(color, str) else color)
    c.roundRect(x, y, w, size + 8, (size + 8) / 2, stroke=0, fill=1)
    c.restoreState()
    label(c, text, x + w / 2, y + 5, size, color=text_color)
    return w


def velcro(c, x, y, s, color=LINE):
    """Празно квадратче за велкро/залепване."""
    card(c, x, y, s, s, fill=SOFT, stroke=color, r=s * 0.12, lw=1.2, dash=(3, 3))


import json as _json
LBL = {i['key']: i['label'] for i in _json.load(open(os.path.join(PICTOS, 'catalog.json'), encoding='utf-8'))['items']}
