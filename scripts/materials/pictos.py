"""Каталог с пиктограми за материалите и генератора на ЕИС.

Изображенията са Twemoji (© Twitter/X и сътрудниците, лиценз CC-BY 4.0 — https://github.com/jdecked/twemoji).
Изпълнение:  python3 scripts/materials/pictos.py   → сваля SVG-тата в public/pictos/ и пише public/pictos/catalog.json
"""
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'pictos')
BASE = 'https://raw.githubusercontent.com/jdecked/twemoji/main/assets/svg/'

# (ключ, емоджи, етикет на български, категория)
CATALOG = [
    # Емоции
    ('happy', '😀', 'радост', 'emotions'), ('sad', '😢', 'тъга', 'emotions'), ('angry', '😠', 'гняв', 'emotions'),
    ('scared', '😨', 'страх', 'emotions'), ('surprised', '😲', 'изненада', 'emotions'), ('calm', '😌', 'спокойствие', 'emotions'),
    ('sleepy', '😴', 'сънливост', 'emotions'), ('hurt', '🤕', 'боли ме', 'emotions'), ('love', '🥰', 'обич', 'emotions'),
    ('confused', '😕', 'объркване', 'emotions'), ('sick', '🤒', 'болен съм', 'emotions'), ('proud', '😎', 'гордост', 'emotions'),
    ('silly', '😜', 'весело', 'emotions'), ('worried', '😟', 'тревога', 'emotions'), ('bored', '😐', 'скука', 'emotions'),
    # Нужди и общуване
    ('toilet', '🚽', 'тоалетна', 'needs'), ('water', '💧', 'вода', 'needs'), ('eat', '🍽️', 'ям', 'needs'),
    ('help', '🙋', 'помощ', 'needs'), ('stop', '✋', 'стоп', 'needs'), ('yes', '👍', 'да', 'needs'), ('no', '👎', 'не', 'needs'),
    ('more', '➕', 'още', 'needs'), ('done', '✅', 'готово', 'needs'), ('quiet', '🤫', 'тихо', 'needs'),
    ('headphones', '🎧', 'слушалки', 'needs'), ('hug', '🤗', 'прегръдка', 'needs'), ('hello', '👋', 'здравей', 'needs'),
    ('wait', '⏳', 'чакам', 'needs'), ('break', '🛋️', 'почивка', 'needs'), ('look', '👀', 'гледай', 'needs'),
    ('listen', '👂', 'слушай', 'needs'), ('talk', '🗣️', 'говоря', 'needs'), ('think', '🤔', 'мисля', 'needs'),
    ('clap', '👏', 'браво', 'needs'), ('hand_up', '✋', 'вдигам ръка', 'needs'), ('me', '🙂', 'аз', 'needs'),
    ('you', '👉', 'ти', 'needs'), ('like', '❤️', 'харесвам', 'needs'), ('want', '🤲', 'искам', 'needs'),
    ('go', '🟢', 'тръгвам', 'needs'), ('come', '🫴', 'ела', 'needs'), ('drink', '🥤', 'пия', 'needs'),
    # Дейности
    ('wash_hands', '🧼', 'мия ръцете', 'actions'), ('shower', '🚿', 'къпя се', 'actions'), ('toothbrush', '🪥', 'мия зъбите', 'actions'),
    ('tshirt', '👕', 'блуза', 'actions'), ('trousers', '👖', 'панталон', 'actions'), ('shoes', '👟', 'обувки', 'actions'),
    ('socks', '🧦', 'чорапи', 'actions'), ('coat', '🧥', 'яке', 'actions'), ('cap', '🧢', 'шапка', 'actions'),
    ('scissors', '✂️', 'режа', 'actions'), ('pencil', '✏️', 'пиша', 'actions'), ('crayon', '🖍️', 'оцветявам', 'actions'),
    ('book', '📖', 'чета', 'actions'), ('paint', '🎨', 'рисувам', 'actions'), ('puzzle', '🧩', 'пъзел', 'actions'),
    ('blocks', '🧱', 'кубчета', 'actions'), ('music', '🎵', 'музика', 'actions'), ('dance', '💃', 'танцувам', 'actions'),
    ('ball', '⚽', 'игра с топка', 'actions'), ('run', '🏃', 'тичам', 'actions'), ('walk', '🚶', 'вървя', 'actions'),
    ('yoga', '🧘', 'дишам спокойно', 'actions'), ('slide', '🛝', 'пързалка', 'actions'), ('swim', '🏊', 'плувам', 'actions'),
    ('bike', '🚲', 'колело', 'actions'), ('bed', '🛏️', 'лягам', 'actions'), ('broom', '🧹', 'подреждам', 'actions'),
    ('cook', '🍳', 'готвя', 'actions'), ('shop', '🛒', 'пазарувам', 'actions'), ('computer', '💻', 'компютър', 'actions'),
    ('tablet', '📱', 'таблет', 'actions'), ('tv', '📺', 'телевизор', 'actions'), ('videogame', '🎮', 'игра', 'actions'),
    ('sing', '🎤', 'пея', 'actions'), ('drum', '🥁', 'барабан', 'actions'), ('jump', '🤸', 'скачам', 'actions'),
    ('sleep', '💤', 'спя', 'actions'), ('sit', '🪑', 'сядам', 'actions'), ('play', '🧸', 'играя', 'actions'),
    ('garden', '🌱', 'градинка', 'actions'), ('bubbles', '🫧', 'балончета', 'actions'), ('swing', '🎠', 'люлка', 'actions'),
    # Училище и терапии
    ('school', '🏫', 'училище', 'school'), ('teacher', '🧑‍🏫', 'учител', 'school'), ('math', '🔢', 'математика', 'school'),
    ('letters', '🔤', 'буквите', 'school'), ('books', '📚', 'книги', 'school'), ('backpack', '🎒', 'раница', 'school'),
    ('abacus', '🧮', 'сметало', 'school'), ('speech', '💬', 'логопед', 'school'), ('psychologist', '🧠', 'психолог', 'school'),
    ('therapy_move', '🤾', 'рехабилитация', 'school'), ('doctor', '🩺', 'лекар', 'school'), ('clock', '⏰', 'час', 'school'),
    ('calendar', '📅', 'календар', 'school'), ('bell', '🔔', 'звънец', 'school'), ('sport', '🏅', 'физкултура', 'school'),
    ('art', '🖼️', 'изкуство', 'school'), ('science', '🔬', 'околен свят', 'school'), ('globe', '🌍', 'светът', 'school'),
    ('ruler', '📏', 'линийка', 'school'), ('glue', '🧴', 'лепило', 'school'), ('notebook', '📓', 'тетрадка', 'school'),
    ('circle_time', '⭕', 'кръг', 'school'), ('class', '👫', 'приятели', 'school'), ('bus_school', '🚌', 'автобус', 'school'),
    # Храна
    ('breakfast', '🥪', 'закуска', 'food'), ('lunch', '🍲', 'обяд', 'food'), ('milk', '🥛', 'мляко', 'food'),
    ('juice', '🧃', 'сок', 'food'), ('cookie', '🍪', 'бисквитка', 'food'), ('apple', '🍎', 'ябълка', 'food'),
    ('banana', '🍌', 'банан', 'food'), ('bread', '🍞', 'хляб', 'food'), ('cheese', '🧀', 'сирене', 'food'),
    ('carrot', '🥕', 'морков', 'food'), ('pizza', '🍕', 'пица', 'food'), ('pasta', '🍝', 'макарони', 'food'),
    ('pear', '🍐', 'круша', 'food'), ('grapes', '🍇', 'грозде', 'food'), ('strawberry', '🍓', 'ягода', 'food'),
    ('watermelon', '🍉', 'диня', 'food'), ('orange', '🍊', 'портокал', 'food'), ('pineapple', '🍍', 'ананас', 'food'),
    ('egg', '🥚', 'яйце', 'food'), ('tomato', '🍅', 'домат', 'food'), ('cucumber', '🥒', 'краставица', 'food'),
    ('icecream', '🍦', 'сладолед', 'food'), ('cake', '🎂', 'торта', 'food'), ('candy', '🍭', 'близалка', 'food'),
    ('mushroom', '🍄', 'гъба', 'food'), ('chocolate', '🍫', 'шоколад', 'food'), ('soup', '🥣', 'супа', 'food'),
    # Места и превозни средства
    ('home', '🏠', 'вкъщи', 'places'), ('bus', '🚌', 'автобус', 'places'), ('car', '🚗', 'кола', 'places'),
    ('hospital', '🏥', 'болница', 'places'), ('park', '🏞️', 'парк', 'places'), ('tree', '🌳', 'дърво', 'places'),
    ('train', '🚂', 'влак', 'places'), ('plane', '✈️', 'самолет', 'places'), ('ship', '🚢', 'кораб', 'places'),
    ('bicycle', '🚲', 'колело', 'places'), ('truck', '🚚', 'камион', 'places'), ('tractor', '🚜', 'трактор', 'places'),
    ('rocket', '🚀', 'ракета', 'places'), ('helicopter', '🚁', 'хеликоптер', 'places'), ('ambulance', '🚑', 'линейка', 'places'),
    ('firetruck', '🚒', 'пожарна', 'places'), ('police', '🚓', 'полиция', 'places'), ('playground', '🛝', 'площадка', 'places'),
    ('shop_place', '🏪', 'магазин', 'places'), ('lighthouse', '🗼', 'кула', 'places'),
    # Природа и времето
    ('sun', '☀️', 'слънце', 'nature'), ('rain', '🌧️', 'дъжд', 'nature'), ('snow', '❄️', 'сняг', 'nature'),
    ('autumn', '🍂', 'есен', 'nature'), ('spring', '🌸', 'пролет', 'nature'), ('moon', '🌙', 'нощ', 'nature'),
    ('rainbow', '🌈', 'дъга', 'nature'), ('cloud', '☁️', 'облак', 'nature'), ('wind', '🌬️', 'вятър', 'nature'),
    ('flower', '🌷', 'цвете', 'nature'), ('summer', '🏖️', 'лято', 'nature'), ('winter', '⛄', 'зима', 'nature'),
    ('leaf', '🍁', 'лист', 'nature'), ('fire', '🔥', 'огън', 'nature'), ('star_night', '🌟', 'звезда', 'nature'),
    ('candle', '🕯️', 'свещ', 'nature'), ('wave', '🌊', 'море', 'nature'), ('mountain', '⛰️', 'планина', 'nature'),
    # Животни
    ('dog', '🐶', 'куче', 'animals'), ('cat', '🐱', 'котка', 'animals'), ('fish', '🐟', 'риба', 'animals'),
    ('bird', '🐦', 'птица', 'animals'), ('horse', '🐴', 'кон', 'animals'), ('cow', '🐮', 'крава', 'animals'),
    ('pig', '🐷', 'прасе', 'animals'), ('chicken', '🐔', 'кокошка', 'animals'), ('sheep', '🐑', 'овца', 'animals'),
    ('rabbit', '🐰', 'заек', 'animals'), ('bear', '🐻', 'мечка', 'animals'), ('lion', '🦁', 'лъв', 'animals'),
    ('elephant', '🐘', 'слон', 'animals'), ('butterfly', '🦋', 'пеперуда', 'animals'), ('ladybug', '🐞', 'калинка', 'animals'),
    ('frog', '🐸', 'жаба', 'animals'), ('monkey', '🐵', 'маймуна', 'animals'), ('giraffe', '🦒', 'жираф', 'animals'),
    ('deer', '🦌', 'елен', 'animals'), ('flamingo', '🦩', 'фламинго', 'animals'), ('hedgehog', '🦔', 'таралеж', 'animals'),
    ('bee', '🐝', 'пчела', 'animals'), ('snail', '🐌', 'охлюв', 'animals'), ('turtle', '🐢', 'костенурка', 'animals'),
    ('duck', '🦆', 'патица', 'animals'), ('owl', '🦉', 'бухал', 'animals'), ('mouse', '🐭', 'мишка', 'animals'),
    ('fox', '🦊', 'лисица', 'animals'), ('panda', '🐼', 'панда', 'animals'), ('whale', '🐳', 'кит', 'animals'),
    ('bone', '🦴', 'кокал', 'animals'), ('carrot2', '🥕', 'морков', 'animals'),
    # Предмети, награди, форми
    ('star', '⭐', 'звезда', 'objects'), ('trophy', '🏆', 'купа', 'objects'), ('gift', '🎁', 'подарък', 'objects'),
    ('balloon', '🎈', 'балон', 'objects'), ('teddy', '🧸', 'мече', 'objects'), ('party', '🎉', 'празник', 'objects'),
    ('heart', '❤️', 'сърце', 'objects'), ('key', '🔑', 'ключ', 'objects'), ('umbrella', '☂️', 'чадър', 'objects'),
    ('glasses', '👓', 'очила', 'objects'), ('phone', '☎️', 'телефон', 'objects'), ('lamp', '💡', 'лампа', 'objects'),
    ('clock2', '🕐', 'часовник', 'objects'), ('needle', '🪡', 'игла', 'objects'), ('yoyo', '🪀', 'йо-йо', 'objects'),
    ('kite', '🪁', 'хвърчило', 'objects'), ('guitar', '🎸', 'китара', 'objects'), ('crown', '👑', 'корона', 'objects'),
    ('hat', '🎩', 'шапка', 'objects'), ('lantern', '🏮', 'фенер', 'objects'), ('fist', '✊', 'юмрук', 'objects'),
    ('nose', '👃', 'нос', 'objects'), ('ear', '👂', 'ухо', 'objects'), ('eye', '👁️', 'око', 'objects'),
    ('hand', '✋', 'ръка', 'objects'), ('foot', '🦶', 'крак', 'objects'), ('tooth', '🦷', 'зъб', 'objects'),
    ('triangle_ruler', '📐', 'ъгъл', 'objects'), ('flag', '🚩', 'знаме', 'objects'), ('home2', '🏡', 'къща', 'objects'),
    ('house', '🏘️', 'къщи', 'objects'), ('soap', '🧼', 'сапун', 'objects'), ('towel', '🧻', 'хартия', 'objects'),
    ('chair', '🪑', 'стол', 'objects'), ('door', '🚪', 'врата', 'objects'), ('window', '🪟', 'прозорец', 'objects'),
    ('scale', '⚖️', 'везна', 'objects'), ('magnet', '🧲', 'магнит', 'objects'), ('dice', '🎲', 'зарче', 'objects'),
    ('pen', '🖊️', 'химикалка', 'objects'), ('bulb', '💡', 'идея', 'objects'), ('tooth_brush2', '🪥', 'четка', 'objects'),
    ('red', '🔴', 'червено', 'shapes'), ('orange_c', '🟠', 'оранжево', 'shapes'), ('yellow', '🟡', 'жълто', 'shapes'),
    ('green', '🟢', 'зелено', 'shapes'), ('blue', '🔵', 'синьо', 'shapes'), ('purple', '🟣', 'лилаво', 'shapes'),
    ('brown', '🟤', 'кафяво', 'shapes'), ('black', '⚫', 'черно', 'shapes'), ('white', '⚪', 'бяло', 'shapes'),
    ('red_sq', '🟥', 'червен квадрат', 'shapes'), ('blue_sq', '🟦', 'син квадрат', 'shapes'), ('green_sq', '🟩', 'зелен квадрат', 'shapes'),
    ('yellow_sq', '🟨', 'жълт квадрат', 'shapes'), ('diamond', '🔷', 'ромб', 'shapes'), ('triangle', '🔺', 'триъгълник', 'shapes'),
]

CATEGORIES = {
    'emotions': 'Емоции', 'needs': 'Нужди и общуване', 'actions': 'Дейности', 'school': 'Училище и терапии',
    'food': 'Храна', 'places': 'Места и превозни средства', 'nature': 'Природа и времето', 'animals': 'Животни',
    'objects': 'Предмети', 'shapes': 'Цветове и форми',
}


def codes(emoji: str, keep_fe0f: bool) -> str:
    return '-'.join(f'{ord(c):x}' for c in emoji if keep_fe0f or c != '️')


def fetch(emoji: str) -> bytes:
    last = None
    for keep in (False, True):
        url = BASE + codes(emoji, keep) + '.svg'
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
    raise RuntimeError(f'{emoji}: {last}')


def main():
    os.makedirs(OUT, exist_ok=True)
    seen, items, missing = set(), [], []
    for key, emoji, label, cat in CATALOG:
        if key in seen:
            raise SystemExit(f'дублиран ключ: {key}')
        seen.add(key)
        path = os.path.join(OUT, key + '.svg')
        if not os.path.exists(path):
            try:
                data = fetch(emoji)
            except Exception as e:  # noqa: BLE001
                missing.append(str(e)); continue
            with open(path, 'wb') as f:
                f.write(data)
        items.append({'key': key, 'label': label, 'cat': cat})
    with open(os.path.join(OUT, 'catalog.json'), 'w', encoding='utf-8') as f:
        json.dump({'license': 'Twemoji © Twitter/X и сътрудници, CC-BY 4.0 — github.com/jdecked/twemoji',
                   'categories': CATEGORIES, 'items': items}, f, ensure_ascii=False, indent=1)
    print(f'{len(items)} пиктограми', ('— липсват: ' + '; '.join(missing)) if missing else '')
    if missing:
        sys.exit(1)


if __name__ == '__main__':
    main()
