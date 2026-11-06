#!/usr/bin/env python3
"""Builds the installable iPhone web app in docs/ from src/app.html.

The app script is written to docs/app.js so the page can ship a strict
Content-Security-Policy without 'unsafe-inline' for scripts.
"""
import pathlib, re
root = pathlib.Path(__file__).parent
app = (root / "src/app.html").read_text(encoding="utf-8")

i = app.rindex("<script>")
j = app.index("</script>", i)
script = app[i + len("<script>"):j]
body = app[:i] + '<script src="app.js"></script>' + app[j + len("</script>"):]
assert "<script>" not in body, "unexpected extra inline script"
assert not re.search(r'\son[a-z]+="', body), "inline event handler found"

SB = "https://albvjenyvyanzzlmvmqa.supabase.co"
csp = "; ".join([
    "default-src 'self'",
    "script-src 'self' https://s3.tradingview.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    f"connect-src 'self' {SB} wss://albvjenyvyanzzlmvmqa.supabase.co https://*.tradingview.com",
    "frame-src https://*.tradingview.com https://*.tradingview-widget.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
])
head = f"""<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{csp}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="טיק">
<meta name="theme-color" content="#0D131E">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" href="icon-192.png">
</head>
<body>
"""
(root / "docs/index.html").write_text(head + body + "\n</body>\n</html>\n", encoding="utf-8")
(root / "docs/app.js").write_text(script, encoding="utf-8")
print("built docs/index.html + docs/app.js")
