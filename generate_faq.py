#!/usr/bin/env python3
"""Build questions.html, the crawlable copy of the Ask SCL question library.

faq.json holds 40 written answers. search.html only ever renders them after a
visitor types into the composer, so a crawler that fetches /search sees the
shell and nothing else. Googlebot renders JavaScript but does not type into
search boxes, and the ChatGPT, Claude and Perplexity fetchers mostly do not
execute JavaScript at all. Either way the answers are invisible. This script
publishes the same text at a plain URL so it can be chunked, embedded and
quoted.

The anchor ids are the entry ids, deliberately. The Worker's renderFaq emits
"[faq-3]" and SYSTEM_INSTRUCTIONS tells the model to cite "(faq-3)", so
/questions#faq-3 becomes a resolvable public target for citations the live
assistant already produces.

RERUN THIS on every faq.json change and commit questions.html in the same
commit. faq.json is the single source of truth and is opened read-only here;
this script never writes it and never touches framework.json,
framework_vectors.json or ask-worker-local.js.

Deterministic by construction: entries render in file order, the only date
printed is faq.json's own "updated" field, and two runs on an unchanged
faq.json produce byte-identical output.

Usage: python3 generate_faq.py
"""
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
SHELL_SRC = HERE / "position.html"   # nav and footer are copied verbatim from here
OUT = HERE / "questions.html"

TITLE = "Questions About AI Certification, Answered | Safety Critical Labs"
H1 = "Questions about certifying AI systems"
DESC = ("Answers about AI certification, the SCL AI Requirements Framework, the "
        "certification process, and accreditation status. The full Ask SCL question "
        "library as plain text.")
CANONICAL = "https://safetycriticallabs.com/questions"
RESERVED = {"main"}
ID_RE = re.compile(r"^faq-\d+$")


def esc(s):
    """Every value out of faq.json passes through here, text and attributes alike."""
    return html.escape(str(s), quote=True)


def grab(pattern, source, what):
    m = re.search(pattern, source, re.S)
    if not m:
        sys.exit(f"generate_faq.py: could not find {what} in {SHELL_SRC.name}")
    return m.group(0)


data = json.loads((HERE / "faq.json").read_text())
entries = data["entries"]
updated = data.get("updated", "")

# Fail loudly rather than emit a duplicate or colliding anchor.
seen = set()
for e in entries:
    eid = e["id"]
    if not ID_RE.match(eid):
        sys.exit(f"generate_faq.py: id {eid!r} does not match ^faq-\\d+$")
    if eid in seen:
        sys.exit(f"generate_faq.py: duplicate id {eid!r}")
    if eid in RESERVED:
        sys.exit(f"generate_faq.py: id {eid!r} collides with a reserved page anchor")
    seen.add(eid)

shell = SHELL_SRC.read_text()
nav = grab(r'<nav class="global-nav".*?</nav>', shell, "the global nav")
footer = grab(r'<footer class="site-footer".*?</footer>', shell, "the site footer")

blocks = []
for e in entries:
    q, a, eid = esc(e["q"]), esc(e["a"]), esc(e["id"])
    link = e.get("link", "")
    more = (f'\n      <p class="faq-more"><a href="{esc(link)}">Read more</a></p>'
            if link else "")
    blocks.append(
        f'    <article class="faq-entry">\n'
        f'      <h2 id="{eid}">{q}</h2>\n'
        f'      <p>{a}</p>{more}\n'
        f'    </article>'
    )
body = "\n".join(blocks)

page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{TITLE}</title>
<meta name="description" content="{esc(DESC)}">
<link rel="canonical" href="{CANONICAL}">
<meta property="og:title" content="{esc(H1)}">
<meta property="og:description" content="{esc(DESC)}">
<meta property="og:url" content="{CANONICAL}">
<meta property="og:type" content="website">
<meta property="og:image" content="https://safetycriticallabs.com/img/og-tile.png">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#EBF1F8">
<link rel="icon" type="image/x-icon" href="favicon.ico">
<link rel="icon" type="image/png" sizes="16x16" href="img/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="img/favicon-48x48.png">
<link rel="icon" type="image/png" sizes="192x192" href="img/favicon-192x192.png">
<link rel="apple-touch-icon" sizes="180x180" href="img/apple-touch-icon.png">
<link rel="shortcut icon" href="favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
<style>
/* Generated page. Edit generate_faq.py, not this file. */
.faq-wrap {{ max-width: 760px; margin: 0 auto; padding: 72px 24px 96px; }}
.faq-wrap > p.faq-intro {{ margin-bottom: 40px; }}
.faq-entry {{ margin-bottom: 36px; }}
.faq-entry h2 {{ font-size: 1.15rem; line-height: 1.35; margin: 0 0 10px; scroll-margin-top: 90px; }}
.faq-entry p {{ margin: 0 0 8px; }}
.faq-more {{ font-size: 0.92rem; }}
</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

{nav}

<main id="main">
  <div class="faq-wrap">
    <h1>{esc(H1)}</h1>
    <p class="faq-intro">The full Ask SCL question library, in plain text. These are the
    same answers the assistant on <a href="/search">Ask SCL</a> draws from. Last updated
    {esc(updated)}.</p>

{body}

  </div>
</main>

{footer}

<script src="/footer.js" defer></script>
<script src="/nav.js" defer></script>
</body>
</html>
"""

OUT.write_text(page)
words = len(re.sub(r"<[^>]+>", " ", page).split())
print(f"wrote {OUT.name}: {len(entries)} entries, {len(page)} chars, "
      f"{words} visible words, {OUT.stat().st_size // 1024}KB")
