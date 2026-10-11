# Начален комплект материали

Генератор на готовите PDF материали за библиотеката „Материали“ в ЕИС.

```
pip install reportlab svglib pymupdf
python3 scripts/materials/pictos.py   # пиктограмите → public/pictos (веднъж)
python3 scripts/materials/build.py    # всички материали → public/materials-seed
python3 scripts/materials/build.py mazes digits   # само избрани
```

- `kit.py` — дизайн система (A4, хедър по област, шрифтове, пиктограми, карти, линии).
- `m_motor.py` фина моторика · `m_academic.py` цифри и букви · `m_cognitive.py` познавателни ·
  `m_comm.py` общуване и табла · `m_social.py` емоции, дишане, социални истории · `m_selfcare.py` самообслужване и движение.
- Нов материал: функция с декоратора `@material(key, заглавие, описание, вид, [области])`.

След ново генериране ръководството натиска „Обнови началния комплект“ на страница „Материали“.

Лицензи: пиктограми Twemoji (CC-BY 4.0, атрибуция във футъра на всяка страница); шрифтове Nunito и Andika (SIL OFL, текстовете са в `fonts/`).
