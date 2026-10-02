#!/bin/sh
# Collects the website's own files into _site/, the folder Cloudflare Pages
# publishes. Nothing else in the repository (this script, the README, the
# workflows) goes online.
set -e
cd "$(dirname "$0")/.."
rm -rf _site
mkdir _site
cp -R index.html about.html timetable.html 404.html favicon.ico css js data assets _site/
rm -f _site/assets/trustees/README.txt
