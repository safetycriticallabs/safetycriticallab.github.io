#!/usr/bin/env python3
"""Build faq_vectors.json, the embedding side of the matched FAQ (Ask SCL step 3 stage F).

Embeds every faq.json entry with nomic-embed-text via local Ollama, exactly as
embed_corpus.py embeds the framework entries (question as the title, keywords,
answer as the text; unit-normalized; int8-quantized; plain JSON). The Worker
fetches the file beside faq.json and uses a row only when its id AND its hash
of the embedded text (question, keywords, answer) match the entry it is about
to score, so a faq.json edit made after this ran costs that entry its
meaning-based match and nothing else, and a missing file leaves the keyword
side of the match working alone. Only a Worker with the matched FAQ on reads
the file: the TEST_MODE copy now, every Worker after the stage I release.

RERUN THIS on every faq.json change, with generate_faq.py, and commit the two
outputs in the same commit as faq.json.

Requires: Ollama serving on localhost:11434 with nomic-embed-text pulled.
Usage: python3 embed_faq.py
"""
import datetime
import json
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
MODEL = "nomic-embed-text"
DOC_PREFIX = "search_document: "
QUERY_PREFIX = "search_query: "
BATCH = 16


def embedded_text(e: dict) -> str:
    """The text embedded for an entry, without the model prefix: question,
    keywords joined by comma and space, answer, one per line. The hash covers
    exactly this, so an edit to any of the three drops the row."""
    return e["q"] + "\n" + ", ".join(e["keywords"]) + "\n" + e["a"]


def entry_hash(e: dict) -> str:
    """FNV-1a, 32 bits, over the code points of embedded_text(e). Mirrors
    faqEntryHash in ask-worker-local.js; the Worker recomputes it per request
    and refuses a row whose hash differs."""
    h = 0x811C9DC5
    for ch in embedded_text(e):
        h = ((h ^ ord(ch)) * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def entries_of(faq: dict) -> list:
    """The entries the Worker's faqEntriesOf keeps, numbered as it numbers them."""
    out = []
    for i, e in enumerate(faq.get("entries") or []):
        e = e or {}
        q = e.get("q").strip() if isinstance(e.get("q"), str) else ""
        a = e.get("a").strip() if isinstance(e.get("a"), str) else ""
        if not q or not a:
            continue
        kws = [k for k in (e.get("keywords") or []) if isinstance(k, str)] if isinstance(e.get("keywords"), list) else []
        out.append({"id": e["id"] if isinstance(e.get("id"), str) and e["id"] else f"faq-{i + 1}", "q": q, "a": a, "keywords": kws})
    return out


def main():
    faq = json.loads((HERE / "faq.json").read_text())
    entries = entries_of(faq)
    texts = [DOC_PREFIX + embedded_text(e) for e in entries]
    vecs = []
    for i in range(0, len(texts), BATCH):
        body = json.dumps({"model": MODEL, "input": texts[i:i + BATCH]}).encode()
        req = urllib.request.Request("http://localhost:11434/api/embed", data=body,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=300) as r:
            vecs.extend(json.load(r)["embeddings"])
        print(f"embedded {min(i + BATCH, len(texts))}/{len(texts)}", flush=True)
    dim = len(vecs[0])
    assert all(len(v) == dim for v in vecs)
    quant, scales = [], []
    for v in vecs:
        norm = sum(x * x for x in v) ** 0.5 or 1.0
        unit = [x / norm for x in v]
        m = max(abs(x) for x in unit) or 1.0
        scale = m / 127.0
        quant.append([max(-127, min(127, round(x / scale))) for x in unit])
        scales.append(round(scale, 8))
    out = {
        "model": MODEL,
        "query_prefix": QUERY_PREFIX,
        "faq_updated": faq.get("updated", ""),
        "built": datetime.date.today().isoformat(),
        "dim": dim,
        "count": len(entries),
        "ids": [e["id"] for e in entries],
        "hashes": [entry_hash(e) for e in entries],
        "vecs": quant,
        "scales": scales,
    }
    (HERE / "faq_vectors.json").write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(f"wrote faq_vectors.json: {len(entries)} entries, dim {dim}, "
          f"{(HERE / 'faq_vectors.json').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
