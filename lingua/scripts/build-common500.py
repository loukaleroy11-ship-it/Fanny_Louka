#!/usr/bin/env python3
"""Builds data/common500.base.json from the OpenSubtitles 2018 English frequency list
(hermitdave/FrequencyWords, CC-BY-SA 4.0). Usage: python3 scripts/build-common500.py en_50k.txt
Rank = position in the *filtered* list (see EXCLUDE below). The filter only removes tokens that
are not learner vocabulary: contraction fragments, subtitle noise, interjections, first names,
abbreviations, profanity and informal contractions."""
import json, sys

from freqfilter import ok

out, rank = [], 0
for line in open(sys.argv[1], encoding="utf8"):
    w, c = line.split()
    if not ok(w): continue
    rank += 1
    out.append({"rank": rank, "word": w, "count": int(c)})
    if rank == 500: break
json.dump(out, open("data/common500.base.json", "w"), indent=0)
print(len(out), "words; last:", out[-1])
