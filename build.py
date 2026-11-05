#!/usr/bin/env python3
"""Builds docs/index.html (installable iPhone web app) from src/app.html."""
import pathlib
root = pathlib.Path(__file__).parent
app = (root / "src/app.html").read_text(encoding="utf-8")
head = """<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
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
(root / "docs/index.html").write_text(head + app + "\n</body>\n</html>\n", encoding="utf-8")
print("built docs/index.html")
