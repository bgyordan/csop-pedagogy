#!/usr/bin/env bash
# Връща снимките на старите новини, които сочат към стария WordPress сайт (csop-varna.bg/wp-content/...).
# Домейнът вече е новият сайт, затова тези адреси не работят. Скриптът тегли всяка снимка от стария сайт
# (old.csop-varna.bg), а ако там я няма — от web.archive.org, качва я в Supabase (public-media/news/)
# и сменя адреса в новината. Така снимките вече не зависят от стария сайт.
# Пуска се на сървъра:  bash ~/csop-pedagogy/scripts/restore-wp-news-images.sh
set -u
KEY=$(grep -E '^SERVICE_ROLE_KEY=' ~/supabase/docker/.env | cut -d= -f2-)
API=http://localhost:8000
PUB=https://api.csop-varna.bg
TMP=$(mktemp -d)
q() { docker exec supabase-db psql -U postgres -d postgres -At -F $'\t' -c "$1"; }
[ -n "$KEY" ] || { echo "Няма SERVICE_ROLE_KEY в ~/supabase/docker/.env"; exit 1; }

while IFS=$'\t' read -r id url; do
  [ -n "$id" ] || continue
  name=$(basename "${url%%\?*}" | tr -c 'A-Za-z0-9._-' '_')
  full=$(echo "$url" | sed -E 's/-[0-9]+x[0-9]+(\.[A-Za-z]+)$/\1/')   # без „-1024x768“ = оригиналът
  old=${url/:\/\/csop-varna.bg/://old.csop-varna.bg}; oldfull=${full/:\/\/csop-varna.bg/://old.csop-varna.bg}
  f="$TMP/$name"; ct=
  for src in "$oldfull" "$old" "https://web.archive.org/web/2026id_/$url" "https://web.archive.org/web/2026id_/$full"; do
    # -k: сертификатът на old. поддомейна не е валиден — за сваляне на снимки е без значение
    ct=$(curl -skfL --max-time 90 -o "$f" -w '%{content_type}' "$src") && [ -s "$f" ] || { ct=; continue; }
    case "${name,,}" in *.png) ext=image/png;; *.webp) ext=image/webp;; *.gif) ext=image/gif;; *) ext=image/jpeg;; esac
    [[ "$ct" == image/* ]] || ct=$ext
    head -c 16 "$f" | grep -qiE 'html|<!doc' && { ct=; continue; }   # страница за грешка, не снимка
    break
  done
  if [ -z "$ct" ]; then echo "НЕ Е НАМЕРЕНА: $url"; continue; fi
  path="news/wp-$(date +%s%3N)-$name"
  if curl -sf -X POST "$API/storage/v1/object/public-media/$path" \
       -H "Authorization: Bearer $KEY" -H "apikey: $KEY" -H "Content-Type: ${ct%%;*}" -H "x-upsert: true" \
       --data-binary @"$f" >/dev/null; then
    q "update site_news set cover_url = '$PUB/storage/v1/object/public/public-media/$path' where id = '$id'" >/dev/null
    echo "ОК: $name"
  else
    echo "ГРЕШКА ПРИ КАЧВАНЕ: $name"
  fi
done < <(q "select id, cover_url from site_news where cover_url like '%/wp-content/uploads/%'")
rm -rf "$TMP"
echo "Готово."
