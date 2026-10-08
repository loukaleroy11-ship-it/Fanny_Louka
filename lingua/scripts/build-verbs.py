#!/usr/bin/env python3
"""Builds data/verbs.json from data/verbs.txt and the OpenSubtitles 2018 frequency list.
Usage: python3 scripts/build-verbs.py en_50k.txt
Verb rank = rank of the verb lemma among the listed verbs, by the summed corpus count of all its
inflected forms (base, -s, -ing, past, participle). Homographs (like, left, set...) inflate some
counts slightly: the rank is a good approximation, not a linguistic lemma count."""
import json, sys
from freqfilter import ok

counts, listrank, n = {}, {}, 0
for line in open(sys.argv[1], encoding="utf8"):
    w, c = line.split(); counts[w] = int(c)
    if ok(w):
        n += 1; listrank[w] = n

DOUBLE = set("stop sit run put cut hit set let shut get win swim begin forget".split())
SPECIAL = {"be": ["am","is","are","was","were","been","being"], "have": ["has","having"],
           "do": ["does","doing"], "go": ["goes","going"]}

def forms(base, past, pp):
    f = {base, *past.split("/"), *pp.split("/")}
    if base in SPECIAL: f.update(SPECIAL[base]); return f
    if base.endswith(("s","x","z","ch","sh","o")): f.add(base+"es")
    elif base.endswith("y") and base[-2] not in "aeiou": f.add(base[:-1]+"ies")
    else: f.add(base+"s")
    if base.endswith("ie"): f.add(base[:-2]+"ying")
    elif base.endswith("e") and base not in ("be",): f.add(base[:-1]+"ing")
    elif base in DOUBLE: f.add(base+base[-1]+"ing")
    else: f.add(base+"ing")
    return f

rows = []
for line in open("data/verbs.txt", encoding="utf8"):
    p = line.rstrip("\n").split("|")
    base, past, pp, fr, ipa, lvl, ex, exfr = p
    fs = forms(base, past, pp)
    total = sum(counts.get(x, 0) for x in fs)
    rows.append(dict(base=base, past=past, participle=pp, fr=fr, ipa=ipa, level=lvl, example=ex,
                     exampleFr=exfr, count=total, listRank=listrank.get(base),
                     irregular=not (past == base+"ed" or past == base+"d" or (base.endswith("y") and past == base[:-1]+"ied") or (past==base+base[-1]+"ed"))))
rows.sort(key=lambda r: -r["count"])
for i, r in enumerate(rows, 1): r["rank"] = i
json.dump(rows, open("data/verbs.json", "w"), ensure_ascii=False, indent=0)
print(len(rows), [r["base"] for r in rows[:25]])
