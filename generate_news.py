#!/usr/bin/env python3
"""Build news.json and feed.xml, SCL's own publication feed.

Why this exists. From September 2026 the news page carries only two kinds of
item: an instrument from a body whose output can change what an assessment has
to demonstrate, and something SCL published itself. The instrument half arrives
live from the Federal Register, EUR-Lex and NIST. This script builds the other
half, so that SCL is a source on its own page rather than only a mirror of other
people's. It is also what fills the featured slot: HERO_SOURCES in news.html is
{ scl: 1 }, so the face of /news can only ever be SCL's own newest release, and
no third party item can capture it.

The source of truth is updates.html, which Kevin writes by hand. Nothing here
invents content. Every field is lifted from an existing update row, which is the
point: /updates and /news.json cannot drift, because one is generated from the
other.

ANCHORS. Rows in updates.html had no ids, so nine of the nineteen had an
external link and the other ten had nowhere to point. This script gives every
row a stable id derived from its title and writes it back into updates.html, so
each feed item resolves to /updates#<slug>. It is idempotent: a row that already
carries an id is left exactly as it is, and the slug scheme matches the one
/requirements and /glossary already use.

DATES are month precision in updates.html ("August 2026"), so each becomes the
first of that month. That is honest about what the page actually records and it
sorts correctly, which the page itself currently does not: the March 2026 Zenodo
row sits between October 2025 and February 2025 in the file. The feed is sorted
by date here, so the ordering defect does not propagate. The page should be
reordered separately.

Run: python3 generate_news.py
"""

import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
UPDATES = HERE / "updates.html"
NEWS_JSON = HERE / "news.json"
FEED_XML = HERE / "feed.xml"

SITE = "https://safetycriticallabs.com"

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11,
    "december": 12,
}

ROW_RE = re.compile(r'<div class="update-row"(?P<attrs>[^>]*)>(?P<body>.*?)\n      </div>', re.S)


def text_of(fragment: str) -> str:
    """Strip tags and decode entities, collapsing whitespace."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", fragment))).strip()


def slugify(title: str) -> str:
    s = text_of(title).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return re.sub(r"-{2,}", "-", s)


def parse_month(raw: str):
    parts = text_of(raw).split()
    if len(parts) != 2 or parts[0].lower() not in MONTHS:
        raise ValueError(f"unparseable update date: {raw!r}")
    return datetime(int(parts[1]), MONTHS[parts[0].lower()], 1, tzinfo=timezone.utc)


def field(body: str, cls: str, tag: str = "div"):
    m = re.search(rf'<{tag} class="{cls}">(.*?)</{tag}>', body, re.S)
    return m.group(1) if m else None


def main() -> int:
    source = UPDATES.read_text(encoding="utf-8")
    rows = list(ROW_RE.finditer(source))
    if not rows:
        print("no update rows found in updates.html", file=sys.stderr)
        return 1

    items = []
    seen_slugs = {}
    rewrites = []

    for match in rows:
        body = match.group("body")
        attrs = match.group("attrs")

        raw_title = field(body, "update-title", "h2")
        raw_date = field(body, "update-date")
        raw_type = field(body, "update-type", "span")
        raw_body = field(body, "update-body", "p")
        if raw_title is None or raw_date is None:
            raise ValueError("update row is missing a title or a date")

        title = text_of(raw_title)
        slug = slugify(raw_title)
        if slug in seen_slugs:
            raise ValueError(f"two update rows slugify to {slug!r}; give one a distinct title")
        seen_slugs[slug] = True

        existing = re.search(r'\bid="([^"]+)"', attrs)
        if existing:
            slug = existing.group(1)
        else:
            rewrites.append((match.start("attrs"), match.end("attrs"), attrs + f' id="{slug}"'))

        link = re.search(r'class="update-link"[^>]*href="([^"]+)"', body) or \
            re.search(r'href="([^"]+)"[^>]*class="update-link"', body)

        items.append({
            "title": title,
            "url": link.group(1) if link else f"{SITE}/updates#{slug}",
            "date": parse_month(raw_date).strftime("%Y-%m-%d"),
            "type": text_of(raw_type) if raw_type else "Update",
            "summary": text_of(raw_body)[:400] if raw_body else "",
        })

    if rewrites:
        out = source
        for start, end, replacement in reversed(rewrites):
            out = out[:start] + replacement + out[end:]
        UPDATES.write_text(out, encoding="utf-8")
        print(f"updates.html: added {len(rewrites)} anchor id(s)")

    items.sort(key=lambda i: i["date"], reverse=True)
    NEWS_JSON.write_text(json.dumps(items, indent=2) + "\n", encoding="utf-8")

    def esc(s):
        return html.escape(s, quote=True)

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0">',
        "  <channel>",
        "    <title>Safety Critical Labs</title>",
        f"    <link>{SITE}/updates</link>",
        "    <description>Framework releases, publications and operational updates "
        "from Safety Critical Labs.</description>",
        "    <language>en</language>",
    ]
    for item in items:
        pub = datetime.strptime(item["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        parts += [
            "    <item>",
            f"      <title>{esc(item['title'])}</title>",
            f"      <link>{esc(item['url'])}</link>",
            f"      <guid isPermaLink=\"false\">scl-{slugify(item['title'])}</guid>",
            f"      <pubDate>{pub.strftime('%a, %d %b %Y 00:00:00 +0000')}</pubDate>",
            f"      <category>{esc(item['type'])}</category>",
            f"      <description>{esc(item['summary'])}</description>",
            "    </item>",
        ]
    parts += ["  </channel>", "</rss>", ""]
    FEED_XML.write_text("\n".join(parts), encoding="utf-8")

    print(f"news.json: {len(items)} items, newest {items[0]['date']} ({items[0]['title']})")
    print(f"feed.xml:  {len(items)} items")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
