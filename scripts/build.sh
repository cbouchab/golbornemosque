#!/bin/sh
# Collects the website's own files into _site/, the folder Cloudflare Pages
# publishes. Nothing else in the repository (this script, the README, the
# workflows) goes online.
set -e
cd "$(dirname "$0")/.."
rm -rf _site
mkdir _site
cp -R index.html about.html timetable.html news.html news-post.html volunteer.html admin.html 404.html favicon.ico site.webmanifest css js data assets _site/

# Every stylesheet and script is linked with ?v=<checksum of the file>, so
# browsers fetch it again as soon as it changes. golbornemosque.org's Cloudflare
# zone tells browsers to keep CSS and JS for 4 hours, which would otherwise pair
# a freshly published page with an older script or stylesheet.
cd _site
stamp=""
for f in $(find css js data -type f \( -name '*.css' -o -name '*.js' \)); do
  v=$(cksum < "$f" | cut -d' ' -f1)
  re=$(printf '%s' "$f" | sed 's/[.]/[.]/g')
  stamp="$stamp
s#=\"\(/\{0,1\}\)$re\"#=\"\1$f?v=$v\"#g"
done
for page in *.html; do
  sed -e "$stamp" "$page" > "$page.tmp"
  mv "$page.tmp" "$page"
done
