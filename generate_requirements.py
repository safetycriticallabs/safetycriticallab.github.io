#!/usr/bin/env python3
"""Build requirements.html, the full normative text of the AI Requirements Framework.

Why this page exists. Ask SCL cites requirements by id, and search.html turns
every "AI-4.1" in an answer into a link. Until now that link went to
/framework#ai-4, a two sentence summary card for the whole area, which does not
contain the sub-requirement it claims to cite. Measured on the run that gated
scl-sft-v2: 225 citation chips shown, 83 percent of them pointing at a page
that did not hold the cited text. A citation that silently substitutes a
summary is worse than no citation, because a reader who clicks through and
cannot find AI-4.1 concludes the assistant invented it.

It also makes good on what /framework already promises in its own words: "Read
every requirement before you engage." The framework is published CC BY-SA 4.0
and the same text is in the public PDF, so nothing here is newly disclosed.

The anchor ids are the requirement ids with dots as hyphens (AI-4.1 becomes
ai-4-1), matching frameworkHref() in search.html, so every citation the live
assistant produces resolves to the exact requirement it used.

RERUN THIS on every framework.json change and commit requirements.html in the
same commit, the same rule generate_faq.py follows. framework.json is the single
source of truth and is opened read-only here; this script writes nothing else.

Deterministic by construction: areas and requirements render in file order, the
only date printed is framework.json's own "updated" field, and two runs on an
unchanged framework.json produce byte-identical output.

Usage: python3 generate_requirements.py
"""
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
SHELL_SRC = HERE / "position.html"   # nav and footer copied verbatim, as generate_faq.py does
OUT = HERE / "requirements.html"

TITLE = "Every Requirement in the AI Requirements Framework | Safety Critical Labs"
H1 = "Every requirement, in full"
DESC = ("The complete text of the SCL AI Requirements Framework: every requirement, its "
        "rationale, its verification method and its success criteria, across thirteen "
        "requirement areas for AI in safety-critical systems.")
CANONICAL = "https://safetycriticallabs.com/requirements"
CONCEPT_DOI = "10.5281/zenodo.19024420"
AREA_RE = re.compile(r"^AI-(\d{1,2})$")
SUB_RE = re.compile(r"^AI-(\d{1,2})\.(\d{1,2})$")


def esc(s):
    """Every value out of framework.json passes through here, text and attributes alike."""
    return html.escape(str(s), quote=True)


def unwrap(s):
    """The corpus text is hard wrapped at about 80 columns with no blank lines,
    so a paragraph is reassembled by collapsing whitespace, not by splitting."""
    return re.sub(r"\s+", " ", s or "").strip()


def anchor(rid):
    return "ai-" + rid[3:].replace(".", "-").lower()


def grab(pattern, source, what):
    m = re.search(pattern, source, re.S)
    if not m:
        sys.exit(f"generate_requirements.py: could not find {what} in {SHELL_SRC.name}")
    return m.group(0)


def parse_requirement(text):
    """Split one requirement into its four published parts. The shape is
    [R.id] TITLE / statement / Rationale: / [V.id] TITLE / method / Success Criteria:
    and it held on 92 of 92 entries once AI-1.0's continuation chunk was joined."""
    t = (text or "").strip()
    mv = re.search(r"\[V\.[A-Z0-9.\-]+\][^\n]*\n", t)
    r_part, v_part = (t[:mv.start()], t[mv.end():]) if mv else (t, "")
    r_head = re.match(r"\[R\.[A-Z0-9.\-]+\][^\n]*\n", r_part)
    r_body = r_part[r_head.end():] if r_head else r_part
    stmt, _, rationale = r_body.partition("Rationale:")
    verif, _, criteria = v_part.partition("Success Criteria:")
    return {"statement": unwrap(stmt), "rationale": unwrap(rationale),
            "verification": unwrap(verif), "criteria": unwrap(criteria)}


def area_intro(text):
    """The area's own normative statement, the paragraph after its [R.AI-n] line."""
    m = re.search(r"\[R\.AI-\d{1,2}\][^\n]*\n(.*?)(?=\n[A-Z][a-z]+ [a-z]|\n\[|\Z)", text or "", re.S)
    return unwrap(m.group(1)) if m else ""


data = json.loads((HERE / "framework.json").read_text())
entries = data["entries"]
version = data.get("version", "")
updated = data.get("updated", "")

# Continuation chunks exist for retrieval, not for reading: rejoin them onto the
# entry they were split from so a requirement is rendered whole.
by_id = {}
for e in entries:
    by_id.setdefault(e["id"], e)
joined = {}
for e in entries:
    rid = e["id"]
    if rid.endswith("-cont"):
        base = rid[: -len("-cont")]
        if base in joined:
            joined[base] = joined[base] + "\n" + e.get("text", "")
        continue
    joined[rid] = e.get("text", "")

areas, subs_by_area, seen = [], {}, set()
for e in entries:
    rid = e["id"]
    if AREA_RE.match(rid):
        areas.append(e)
    elif SUB_RE.match(rid):
        subs_by_area.setdefault("AI-" + SUB_RE.match(rid).group(1), []).append(e)
    else:
        continue
    a = anchor(rid)
    if a in seen:
        sys.exit(f"generate_requirements.py: duplicate anchor {a!r} from {rid!r}")
    seen.add(a)

if not areas:
    sys.exit("generate_requirements.py: no area entries found in framework.json")

shell = SHELL_SRC.read_text()
nav = grab(r'<nav class="global-nav".*?</nav>', shell, "the global nav")
footer = grab(r'<footer class="site-footer".*?</footer>', shell, "the site footer")

sections, n_subs = [], 0
for a in areas:
    aid = a["id"]
    atitle = re.sub(r"^AI-\d{1,2}:\s*", "", a.get("title", aid))
    atitle = re.sub(r"\s*\([^)]*\)\s*$", "", atitle).strip()
    intro = area_intro(joined.get(aid, ""))
    rows = []
    for s in subs_by_area.get(aid, []):
        p = parse_requirement(joined.get(s["id"], s.get("text", "")))
        n_subs += 1
        parts = [f'      <h3 id="{esc(anchor(s["id"]))}">'
                 f'<span class="req-id">{esc(s["id"])}</span> {esc(s.get("title", ""))}</h3>']
        if p["statement"]:
            parts.append(f'      <p class="req-statement">{esc(p["statement"])}</p>')
        if p["rationale"]:
            parts.append(f'      <p class="req-part"><span class="req-label">Rationale.</span> {esc(p["rationale"])}</p>')
        if p["verification"]:
            parts.append(f'      <p class="req-part"><span class="req-label">Verification.</span> {esc(p["verification"])}</p>')
        if p["criteria"]:
            parts.append(f'      <p class="req-part"><span class="req-label">Success criteria.</span> {esc(p["criteria"])}</p>')
        rows.append('    <article class="req-entry">\n' + "\n".join(parts) + '\n    </article>')
    sections.append(
        f'  <section class="req-area" id="{esc(anchor(aid))}">\n'
        f'    <h2><span class="req-id">{esc(aid)}</span> {esc(atitle)}</h2>\n'
        + (f'    <p class="req-area-intro">{esc(intro)}</p>\n' if intro else "")
        + "\n".join(rows) + "\n  </section>")

body = "\n".join(sections)

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
<meta name="theme-color" content="#FAF6EC">
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
/* Generated page. Edit generate_requirements.py, not this file. */
/* The site stylesheet sets scroll-behavior: smooth, which is right for a short
   page and wrong here: this page is about 59000 pixels tall, and a citation
   chip from Ask SCL can target a requirement 53000 pixels down, so the smooth
   path animates the reader through most of the framework to get there. A cited
   requirement should be on screen at once. */
html {{ scroll-behavior: auto; }}
.req-wrap {{ max-width: 780px; margin: 0 auto; padding: 72px 24px 96px; }}
.req-intro {{ margin-bottom: 12px; }}
.req-toc {{ margin: 0 0 48px; padding: 0; list-style: none; font-size: 0.95rem; line-height: 2; }}
.req-toc li {{ display: inline; }}
.req-toc li:not(:last-child)::after {{ content: " \\00B7 "; color: rgba(12,34,66,0.35); }}
.req-area {{ margin-bottom: 56px; }}
.req-area > h2 {{ font-size: 1.35rem; line-height: 1.3; margin: 0 0 8px; scroll-margin-top: 90px; }}
.req-area-intro {{ margin: 0 0 28px; color: var(--ink-2); }}
.req-entry {{ margin: 0 0 30px; padding-left: 16px; border-left: 2px solid rgba(46,109,180,0.18); }}
.req-entry h3 {{ font-size: 1.02rem; line-height: 1.35; margin: 0 0 8px; scroll-margin-top: 90px; }}
.req-entry:target {{ border-left-color: #2E6DB4; }}
.req-id {{ font-family: var(--mono); font-size: 0.86em; font-weight: 500; color: #1E5A9A; margin-right: 6px; }}
.req-statement {{ margin: 0 0 8px; }}
.req-part {{ margin: 0 0 8px; font-size: 0.94rem; color: var(--ink-2); }}
.req-label {{ font-weight: 600; color: var(--ink); }}
</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

{nav}

<main id="main">
  <div class="req-wrap">
    <h1>{esc(H1)}</h1>
    <p class="req-intro">The complete text of the AI Requirements Framework, version {esc(version)},
    last updated {esc(updated)}. Every requirement is published with its rationale, the method by
    which it is verified, and the criteria that decide whether the verification succeeded. This is
    the same text as the deposited record; cite the framework at the concept DOI
    <a href="https://doi.org/{CONCEPT_DOI}" rel="noopener">{CONCEPT_DOI}</a>, not at this URL.
    The <a href="/framework">framework overview</a> summarizes the thirteen areas, and
    <a href="/search">Ask SCL</a> answers questions grounded in this text.</p>
    <ul class="req-toc">
{chr(10).join(f'      <li><a href="#{esc(anchor(a["id"]))}">{esc(a["id"])}</a></li>' for a in areas)}
    </ul>

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
print(f"wrote {OUT.name}: {len(areas)} areas, {n_subs} requirements, {len(page)} chars, "
      f"{words} visible words, {OUT.stat().st_size // 1024}KB")
