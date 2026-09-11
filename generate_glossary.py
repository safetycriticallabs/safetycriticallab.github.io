#!/usr/bin/env python3
"""Build glossary.html, Appendix A of the AI Requirements Framework.

Why this page exists. The glossary is already public: its full text ships inside
framework.json, which GitHub Pages serves and the Ask SCL worker retrieves from.
But it renders on no page, so a reader who wants to know what SCL means by
"Operational Design Domain" has to download a PDF or ask the assistant. This
page renders it, which also makes the terms crawlable and lets a citation reach
an exact definition.

The glossary text lives in four corpus entries, app-a through app-a-cont3. They
are hard wrapped at about 80 columns and THEY CUT MID-SENTENCE: app-a-cont ends
with "through processes such as". So the four texts are concatenated before
parsing and an entry boundary is never treated as a term boundary.

Anchor ids are the term name slugified (Operational Design Domain (ODD) becomes
operational-design-domain-odd), matching the scheme /requirements uses, so a
cross reference and an external link both resolve to the exact term.

RENDER-TIME REPAIRS. The corpus was extracted from the framework PDF and lost
five hyphens at line breaks. Each one below was checked against
docs/AI_Requirements_Framework_v3_6.pdf and appears there as "X-\nY", so
repairing it restores the published text rather than altering it. Two of them
break cross references, because they name a target term that exists only under
its hyphenated spelling.

Deliberately NOT repaired: "has been deidentified or anonymized". That one reads
unbroken and mid-line in the PDF, so it is the document's own spelling, not an
extraction artifact. The document is internally inconsistent about it, writing
"De-identification" as a term name and "deidentified" in prose, but that is an
editorial matter for a future framework version, not something a render script
may quietly correct. This page quotes the standard as the standard reads.

Repairs happen here, NOT in framework.json, so this script keeps framework.json
as the single source of truth and writes nothing but its own output. If the
corpus is corrected upstream, REPAIRS becomes a no-op and can be deleted.

RERUN THIS on every framework.json change and commit glossary.html in the same
commit, the rule generate_faq.py and generate_requirements.py both follow.

Deterministic by construction: terms render in file order, the only date printed
is framework.json's own "updated" field, and two runs on an unchanged
framework.json produce byte-identical output.

Usage: python3 generate_glossary.py
"""
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
SHELL_SRC = HERE / "position.html"   # nav and footer copied verbatim, as the other generators do
SRC = HERE / "framework.json"
OUT = HERE / "glossary.html"

TITLE = "Glossary of the AI Requirements Framework | Safety Critical Labs"
H1 = "Every term, defined"
DESC = ("The complete glossary of the SCL AI Requirements Framework: every term SCL uses when "
        "assessing AI in safety-critical systems, with its definition and its source standard.")
CANONICAL = "https://safetycriticallabs.com/glossary"
CONCEPT_DOI = "10.5281/zenodo.19024420"

GLOSSARY_IDS = ["app-a", "app-a-cont", "app-a-cont2", "app-a-cont3"]

CATEGORIES = [
    "CORE AI/ML TERMS", "SYSTEM CLASSIFICATION TERMS", "OPERATIONAL DESIGN DOMAIN TERMS",
    "DATA TERMS", "RISK AND FAILURE MODE TERMS", "VERIFICATION AND VALIDATION TERMS",
    "OPERATIONAL TERMS", "SECURITY TERMS", "EXPLAINABILITY AND TRUST TERMS",
    "PRIVACY AND DATA PROTECTION TERMS",
]

# Hyphens lost at PDF line breaks. Ordered longest first so a shorter key cannot
# match inside a longer one. Applied to definition text only, never to term names.
REPAIRS = [
    ("Reidentification Risk", "Re-identification Risk"),  # PDF: "Re-\nidentification Risk"
    ("Deidentification", "De-identification"),            # PDF: "See also De-\nidentification."
    ("Frameworkdefined", "Framework-defined"),            # PDF: "Framework-defined" (19 occurrences)
    ("nonevolvable", "non-evolvable"),                    # PDF: "non-\nevolvable"
    ("AI1.0", "AI-1.0"),                                  # PDF: "(Framework-defined, AI-1.0)"
]

TERM_RE = re.compile(r"^([A-Z][A-Za-z0-9 /()\-’',.]{1,70}?):\s(.*)$")


def esc(s):
    """Every value out of framework.json passes through here, text and attributes alike."""
    return html.escape(str(s), quote=True)


def slug(term):
    """Operational Design Domain (ODD) -> operational-design-domain-odd"""
    s = term.lower().replace("/", " ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def repair(text):
    for bad, good in REPAIRS:
        text = text.replace(bad, good)
    return text


data = json.loads(SRC.read_text())
by_id = {e["id"]: e for e in data["entries"]}
missing = [i for i in GLOSSARY_IDS if i not in by_id]
if missing:
    sys.exit(f"generate_glossary.py: framework.json is missing glossary entries {missing}")

raw = "\n".join(by_id[i]["text"] for i in GLOSSARY_IDS)

# Which corpus chunk each line came from. Ask SCL cites the glossary by chunk id
# (app-a, app-a-cont, ...), not by term, so the first term to begin inside each
# chunk carries that id as a second anchor and a citation lands nearby.
lines_with_chunk = []
for cid in GLOSSARY_IDS:
    for line in by_id[cid]["text"].split("\n"):
        lines_with_chunk.append((line, cid))

terms, cat, cur, intro, started = [], None, None, [], False
chunk_claimed = set()
for line, chunk_id in lines_with_chunk:
    s = line.strip()
    if not s:
        continue
    if s in CATEGORIES:
        if cur:
            terms.append(cur)
            cur = None
        cat, started = s, True
        continue
    if not started:
        intro.append(s)
        continue
    m = TERM_RE.match(s)
    if m and not s.startswith("("):
        if cur:
            terms.append(cur)
        cur = {"term": m.group(1).strip(), "cat": cat, "def": m.group(2).strip(),
               "chunk": None if chunk_id in chunk_claimed else chunk_id}
        chunk_claimed.add(chunk_id)
    elif cur:
        cur["def"] += " " + s
if cur:
    terms.append(cur)

if not terms:
    sys.exit("generate_glossary.py: parsed no terms; the corpus format has changed")

# Completeness proof. Every character of the source must land in the intro, a
# category heading, or a term. A silent parse failure here would drop a
# definition from a published page, so it is a hard stop, not a warning.
norm = lambda t: re.sub(r"\s+", " ", t).strip()
rest = norm(raw)
for t in terms:
    chunk = norm(t["term"] + ": " + t["def"])
    if chunk not in rest:
        sys.exit(f"generate_glossary.py: parsed term not found verbatim in source: {t['term']!r}")
    rest = rest.replace(chunk, "", 1)
for c in CATEGORIES:
    rest = rest.replace(c, "", 1)
rest = norm(rest.replace(norm(" ".join(intro)), "", 1))
if rest:
    sys.exit(f"generate_glossary.py: {len(rest)} characters unaccounted for after parsing: {rest[:200]!r}")

slugs = {}
for t in terms:
    t["def"] = repair(t["def"])
    a = slug(t["term"])
    if a in slugs:
        sys.exit(f"generate_glossary.py: duplicate anchor {a!r} from {t['term']!r} and {slugs[a]!r}")
    slugs[a] = t["term"]
    t["slug"] = a

# Cross references become in-page links. Longest name first so "Continuous
# Validation" is not matched as "Validation". Only exact term names are linked,
# and only inside a "See also" clause, so ordinary prose is left alone.
by_name = sorted(((t["term"], t["slug"]) for t in terms), key=lambda p: -len(p[0]))
n_links = 0
n_reqlinks = 0


def link_see_also(defn_html, self_slug):
    """Link term names inside a See also clause.

    Substitution happens through placeholders rather than directly, because a
    direct pass lets a short name match inside an anchor already inserted for a
    longer one: once "Continuous Validation" becomes a link, a later pass for
    "Validation" would match the anchor's own text and nest a second link
    pointing at the wrong term. Longest name first, placeholder, then restore.
    """
    global n_links

    def repl(m):
        global n_links
        body = m.group(2)
        stash = []
        for name, sl in by_name:
            if sl == self_slug:
                continue
            pat = re.compile(r"(?<![\w-])" + re.escape(esc(name)) + r"(?![\w-])")
            if pat.search(body):
                token = f"\x00{len(stash)}\x00"
                body = pat.sub(token, body, count=1)
                stash.append(f'<a href="#{sl}">{esc(name)}</a>')
                n_links += 1
        for i, html_frag in enumerate(stash):
            body = body.replace(f"\x00{i}\x00", html_frag)
        return m.group(1) + body + m.group(3)

    return re.sub(r"(See also\s)([^.]+)(\.)", repl, defn_html)


REQ_RE = re.compile(r"(?<![\w-])AI-(\d{1,2})(?:\.(\d{1,2}))?(?![\w.\d-])")


def link_requirements(defn_html):
    """Requirement ids inside a definition link to the requirement itself.

    Same anchor scheme frameworkHref() in search.html uses, so AI-4.1 in a
    definition and AI-4.1 in an assistant answer reach the same target.
    """
    global n_reqlinks
    def repl(m):
        global n_reqlinks
        n_reqlinks += 1
        anchor_id = "ai-" + m.group(1) + ("-" + m.group(2) if m.group(2) else "")
        return f'<a href="/requirements#{anchor_id}">{m.group(0)}</a>'
    return REQ_RE.sub(repl, defn_html)


SOURCE_RE = re.compile(r"\s(\((?:Framework-defined|Adapted from|Aligned with|Tailored|Human factors|ISO|IEC|NIST|GDPR|SAE)[^)]*\))")


def split_source(defn):
    """Separate a trailing source citation from the definition body.

    Anchoring this to end of string was too strict: four definitions close with
    a "See also" clause after the citation, and those lost their source line.
    Lifting any matching parenthetical was too loose: eleven definitions use one
    mid-sentence, for example "...by machine learning (ISO/IEC 22989:2022
    3.1.5), whether before deployment...", and removing that leaves a dangling
    space-comma in published text.

    So a citation is lifted only when nothing but a See also clause follows it.
    Returns (body, citation_or_empty).
    """
    last = None
    for m in SOURCE_RE.finditer(defn):
        rest = defn[m.end():].strip()
        if rest == "" or rest.startswith("See also"):
            last = m
    if not last:
        return defn, ""
    body = (defn[: last.start()].rstrip() + " " + defn[last.end():].lstrip()).strip()
    return body, last.group(1)

sections, toc = [], []
for c in CATEGORIES:
    rows = [t for t in terms if t["cat"] == c]
    if not rows:
        continue
    label = c[:-6].strip() if c.endswith(" TERMS") else c
    label = label.title().replace("Ai/Ml", "AI/ML").replace("Odd", "ODD")
    cslug = slug(label)
    toc.append(f'      <li><a href="#{esc(cslug)}">{esc(label)}</a> <span class="gl-toc-n">{len(rows)}</span></li>')
    items = []
    for t in rows:
        body, citation = split_source(esc(t["def"]))
        src_html = f'\n        <p class="gl-src">{link_requirements(citation)}</p>' if citation else ""
        d = link_requirements(link_see_also(body, t["slug"]))
        items.append(
            (f'      <span class="gl-chunk" id="{esc(t["chunk"])}" aria-hidden="true"></span>\n' if t.get("chunk") else '')
            + f'      <div class="gl-term" id="{esc(t["slug"])}" data-term="{esc(t["term"].lower())}">\n'
            f'        <h3 class="gl-name">{esc(t["term"])}<a class="gl-anchor" href="#{esc(t["slug"])}" aria-label="Link to {esc(t["term"])}">#</a></h3>\n'
            f'        <p class="gl-def">{d}</p>{src_html}\n'
            f'      </div>')
    sections.append(
        f'    <section class="gl-cat" id="{esc(cslug)}" data-cat="{esc(cslug)}">\n'
        f'      <h2 class="gl-cat-title">{esc(label)} <span class="gl-cat-n">{len(rows)}</span></h2>\n'
        + "\n".join(items) + "\n    </section>")

shell = SHELL_SRC.read_text()


def grab(pattern, text, what):
    m = re.search(pattern, text, re.S)
    if not m:
        sys.exit(f"generate_glossary.py: could not find {what} in {SHELL_SRC.name}")
    return m.group(0)


nav = grab(r'<nav class="global-nav".*?</nav>', shell, "the global nav")
footer = grab(r'<footer class="site-footer".*?</footer>', shell, "the site footer")
updated = data.get("updated", "")
n_cats = len([c for c in CATEGORIES if any(t["cat"] == c for t in terms)])
n_terms = len(terms)

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
<link rel="icon" type="image/x-icon" href="favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="192x192" href="img/favicon-192x192.png">
<link rel="apple-touch-icon" sizes="180x180" href="img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
<style>
/* The site stylesheet sets scroll-behavior: smooth, which is right for a short
   page and wrong for a long index: a jump from the category list to a term near
   the bottom becomes a multi-second scroll past 80 other terms. Same override
   requirements.html carries, for the same reason. */
html {{ scroll-behavior: auto; }}
.gl-wrap {{ max-width: 820px; margin: 0 auto; padding: 0 40px 120px; }}
.gl-lede {{ font-size: 17px; color: var(--ink-2); font-weight: 300; line-height: 1.8; margin-bottom: 32px; }}
.gl-lede a {{ color: var(--blue); text-decoration: none; border-bottom: 1px solid rgba(46,109,180,0.3); }}

.gl-tools {{ display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 28px; }}
.gl-search {{
  flex: 1 1 260px; font-family: var(--sans); font-size: 15px; font-weight: 300;
  padding: 11px 14px; border: 1px solid var(--rule); border-radius: 10px;
  background: #FFF; color: var(--ink);
}}
.gl-search:focus {{ outline: none; border-color: var(--blue); }}
.gl-count {{ font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-2); }}

.gl-toc {{ list-style: none; padding: 0; margin: 0 0 56px 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 6px 18px; }}
.gl-toc li {{ font-size: 14px; }}
.gl-toc a {{ color: var(--ink); text-decoration: none; border-bottom: 1px solid transparent; font-weight: 400; }}
.gl-toc a:hover {{ color: var(--blue); border-bottom-color: rgba(46,109,180,0.3); }}
.gl-toc-n {{ font-family: var(--mono); font-size: 10px; color: var(--ink-2); }}

.gl-cat + .gl-cat {{ border-top: 1px solid var(--rule); padding-top: 48px; }}
.gl-cat {{ margin-bottom: 48px; }}
.gl-cat-title {{
  font-family: var(--mono); font-size: 11px; font-weight: 500; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--blue); margin: 0 0 24px 0;
}}
.gl-cat-n {{ color: var(--ink-2); margin-left: 6px; }}

.gl-chunk {{ display: block; height: 0; scroll-margin-top: 96px; }}
.gl-term {{ margin-bottom: 26px; scroll-margin-top: 96px; }}
.gl-term:target .gl-name {{ color: var(--blue); }}
.gl-name {{ font-size: 17px; font-weight: 600; color: var(--ink); margin: 0 0 6px 0; letter-spacing: -0.01em; }}
.gl-anchor {{
  margin-left: 8px; font-family: var(--mono); font-size: 12px; font-weight: 400;
  color: var(--rule); text-decoration: none; opacity: 0; transition: opacity .15s;
}}
.gl-term:hover .gl-anchor, .gl-anchor:focus {{ opacity: 1; color: var(--blue); }}
.gl-def {{ font-size: 15px; color: var(--ink-2); line-height: 1.75; font-weight: 300; margin: 0; }}
.gl-def a {{ color: var(--blue); text-decoration: none; border-bottom: 1px solid rgba(46,109,180,0.3); }}
.gl-src {{ font-family: var(--mono); font-size: 11px; color: var(--ink-2); margin: 6px 0 0 0; font-weight: 400; }}
.gl-empty {{ font-size: 15px; color: var(--ink-2); font-weight: 300; padding: 24px 0; }}

@media (max-width: 880px) {{
  .gl-wrap {{ padding: 0 24px 80px; }}
  .gl-toc {{ grid-template-columns: 1fr 1fr; }}
}}
</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

{nav}

<main id="main" tabindex="-1">

<div class="page-shell">

<div class="inner-hero">
  <div class="fw-hero-glow"></div>
  <div class="inner-hero-inner">
    <div>
      <div class="inner-hero-breadcrumb"><a href="/">Safety Critical Labs</a><span>/</span> Glossary</div>
      <h1>{esc(H1)}</h1>
    </div>
    <p class="inner-hero-lead">
      Appendix A of the AI Requirements Framework. {n_terms} terms in {n_cats} categories, each one
      either defined by the framework or mapped to the international standard it comes from.
    </p>
  </div>
</div>

<div class="gl-wrap">
  <p class="gl-lede">These are the definitions an SCL assessment runs on. Where a term is taken from an
    existing standard, the source is named under the definition rather than paraphrased, so a reader can
    check it. Where the framework defines a term itself, it says so. Framework text last updated
    {esc(updated)}. Cite the framework at the concept DOI
    <a href="https://doi.org/{CONCEPT_DOI}" rel="noopener">{CONCEPT_DOI}</a>, not at this URL.
    <a href="/requirements">Every requirement in full</a> and
    <a href="/search">Ask SCL</a> answers questions grounded in this text.</p>

  <div class="gl-tools">
    <input class="gl-search" id="gl-search" type="search" placeholder="Filter {n_terms} terms" aria-label="Filter glossary terms" autocomplete="off">
    <span class="gl-count" id="gl-count">{n_terms} terms</span>
  </div>

  <ul class="gl-toc">
{chr(10).join(toc)}
  </ul>

  <p class="gl-empty" id="gl-empty" hidden>No term matches that.</p>

{chr(10).join(sections)}

</div>

</div>

</main>

{footer}

<script>
(function () {{
  var box = document.getElementById('gl-search');
  var count = document.getElementById('gl-count');
  var empty = document.getElementById('gl-empty');
  var toc = document.querySelector('.gl-toc');
  var terms = [].slice.call(document.querySelectorAll('.gl-term'));
  var cats = [].slice.call(document.querySelectorAll('.gl-cat'));
  var total = terms.length;
  if (!box) return;
  function apply() {{
    var q = box.value.trim().toLowerCase();
    var shown = 0;
    terms.forEach(function (t) {{
      var hit = !q || t.getAttribute('data-term').indexOf(q) !== -1 ||
                t.textContent.toLowerCase().indexOf(q) !== -1;
      t.hidden = !hit;
      if (hit) shown++;
    }});
    cats.forEach(function (c) {{
      c.hidden = !c.querySelector('.gl-term:not([hidden])');
    }});
    if (toc) toc.hidden = !!q;
    empty.hidden = shown !== 0;
    count.textContent = q ? shown + ' of ' + total + ' terms' : total + ' terms';
  }}
  box.addEventListener('input', apply);
}})();
</script>
<script src="/footer.js" defer></script>
<script src="/nav.js" defer></script>
</body>
</html>
"""

OUT.write_text(page)
words = len(re.sub(r"<[^>]+>", " ", page).split())
print(f"wrote {OUT.name}: {len(terms)} terms, {n_cats} categories, {n_links} cross-reference links, "
      f"{n_reqlinks} requirement links, {len(page)} chars, {words} visible words, {OUT.stat().st_size // 1024}KB")
