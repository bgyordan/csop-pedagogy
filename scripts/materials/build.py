"""Генерира началния комплект материали в public/materials-seed/: PDF + превю (JPG) + manifest.json.

  python3 scripts/materials/pictos.py      # веднъж — сваля пиктограмите
  python3 scripts/materials/build.py       # всички материали
  python3 scripts/materials/build.py mazes # само избрани (по ключ)

Нужни пакети: reportlab, svglib, pymupdf.
"""
import json
import os
import sys

import pymupdf

import kit
import m_motor, m_academic, m_cognitive, m_comm, m_social, m_selfcare  # noqa: F401 — регистрират материалите

OUT = os.path.join(kit.ROOT, 'public', 'materials-seed')


def main():
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    keys = [m['key'] for m in kit.REG]
    assert len(keys) == len(set(keys)), 'повтарящ се ключ'
    manifest = []
    for m in kit.REG:
        pdf = os.path.join(OUT, m['key'] + '.pdf')
        jpg = os.path.join(OUT, m['key'] + '.jpg')
        if not only or m['key'] in only:
            doc = kit.Doc(pdf, m['title'], m['areas'][0], land=m['land'], name_line=m['name_line'])
            m['fn'](doc)
            doc.save()
            d = pymupdf.open(pdf)
            page = d[0]
            zoom = 520 / page.rect.width
            page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).save(jpg, jpg_quality=80)
            print(f"{m['key']:<28} {d.page_count:>3} стр.  {os.path.getsize(pdf) // 1024:>5} KB")
        d = pymupdf.open(pdf)
        manifest.append(dict(seed_key=m['key'], title=m['title'], description=m['description'], kind=m['kind'],
                             areas=m['areas'], pages=d.page_count, file=m['key'] + '.pdf', preview=m['key'] + '.jpg'))
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump({'version': 1, 'source': 'ЕИС — начален комплект',
                   'license': 'Пиктограми: Twemoji (CC-BY 4.0, © Twitter/X и сътрудници). Шрифтове: Nunito, Andika (SIL OFL).',
                   'items': manifest}, f, ensure_ascii=False, indent=1)
    print(f'{len(manifest)} материала → {OUT}')


if __name__ == '__main__':
    main()
