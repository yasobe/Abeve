#!/usr/bin/env python3
"""Bundle bayit/ into one self-contained HTML file (CSS and JS inlined).

Used to publish the app as a single page, e.g. to open it on a phone.
The output has no <html>/<head>/<body> wrapper: the host adds its own.

    python3 bayit/bundle.py OUT.html
"""
import pathlib
import re
import sys

root = pathlib.Path(__file__).parent
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else root / 'dist' / 'bayit.html')

html = (root / 'index.html').read_text(encoding='utf-8')
head = html.split('<head>')[1].split('</head>')[0]
body = html.split('<body>')[1].split('</body>')[0]

# The host supplies charset + viewport; keep everything else from <head>.
head = re.sub(r'<meta charset="utf-8">\n', '', head)
head = re.sub(r'<meta name="viewport"[^>]*>\n', '', head)
head = re.sub(r'<title>.*?</title>\n', '', head)
css = (root / 'css' / 'styles.css').read_text(encoding='utf-8')
head = head.replace('<link rel="stylesheet" href="css/styles.css">', f'<style>\n{css}\n</style>')

body = re.sub(r'<script src="([^"]+)"></script>',
              lambda m: '<script>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '\n</script>', body)

page = ('<title>בית בידיים</title>\n'
        '<script>document.documentElement.lang="he";document.documentElement.dir="rtl";</script>\n'
        + head + body)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page, encoding='utf-8')
print(f'wrote {out} ({len(page) // 1024} KB)')
