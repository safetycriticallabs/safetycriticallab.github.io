# VERSION-BUMP.md

Run this in order on every AI Requirements Framework version change. Counts were measured
on disk 2026-09-08 and are recorded so a later run can tell drift from a real change.

Surface as of 2026-09-08:

- **15 literal `v3.6` strings** across five files: `certificate-template` 2, `assess` 5,
  `framework` 1, `updates` 3, `presentation` 3.
- **34 occurrences of "thirteen"** across six files: `assess` 4, `certificate-template` 1,
  `framework` 4, `index` 7, `presentation` 13, `updates` 5.
- **AI-13** in 7 HTML files, 5 `faq.json` entries, and once in `ask-worker-local.js` inside
  `ASSISTANT_IDENTITY` (line 252).
- **Version DOI `10.5281/zenodo.21924937`** in 7 files including `registry.json`.
- **Concept DOI `10.5281/zenodo.19024420`** in `evidence`, `framework`, `index` JSON-LD
  `sameAs`, `framework.html` TechArticle, and `faq.json` twice.
  `index.html` line 2620 is `mulberry32(19024420)`, a PRNG seed, NOT a DOI. Do not "fix" it.
- The forbidden DOI `10.5281/zenodo.19501092` appears **zero times**. Keep it that way.

## Steps

```
(a) Regenerate framework.json. Run: python3 embed_corpus.py
    Confirm the Worker accepts the vectors with one retrieval-only bench pass.
    vectorsValid refuses a stale file and retrieval silently degrades to keyword-only.

(b) grep -rn "v3\.6" *.html          and update each of the 15.

(c) grep -rn -i "thirteen" *.html    and re-verify each of the 34 against the new count.

(d) grep -rn "zenodo\.21924937" *.html *.json
    Update the standing identifier everywhere EXCEPT certificate-template.html and
    registry.json, which must keep the version DOI of the version each certificate was
    issued against. House rule, and Notes.md's own versioning item.

(e) Update ASSISTANT_IDENTITY in ask-worker-local.js if the area count changed.
    Bump WORKER_BUILD. Paste to the dashboard. Verify from outside via POST /bench/retrieve.

(f) Regenerate questions.html if faq.json changed in the same bump:
        python3 generate_faq.py
    questions.html MUST be committed in the same commit as any faq.json change.
    The deployed Worker fetches faq.json from the live site, so a push changes what the
    public assistant says with no Worker deploy. Check: git diff --stat -- faq.json is
    empty after running the generator, and grep -c 'id="faq-' questions.html matches the
    entry count.

(g) Add one row to updates.html and one LOG line to STATUS.md.
    Label development dates and deposit dates as such. Never merge them into one claim.

(h) grep -c 'Until accreditation is granted, SCL determinations are not accredited under ISO/IEC 17065.' *.html
    That string is the canonical status sentence. Master copy is disclaimer.html.
    Every Tier 2 page must carry it byte-identically. This grep is the drift check.

(i) Re-fetch every competitor source URL cited on any /compare page and update the
    rendered access dates. If a source has moved or changed, the page comes down until the
    claim is re-sourced. Those pages go stale on the competitor's schedule, not SCL's.
```

## Sitemap

`sitemap.xml` is hand-edited, deliberately. At 22 URLs a build step costs more than it
saves. Add a line when you ship a page. Set `lastmod` from the git commit date, not the
filesystem mtime, which resets on a fresh clone.

Excluded on purpose: `/presentation`, `/certificate-template` and `/404`, all three of
which carry `noindex`.
