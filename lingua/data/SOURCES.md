# Data sources

## 500 Most Common English Words

* **Frequency source:** *OpenSubtitles 2018* English word-frequency list, as published by Hermit Dave in
  [`FrequencyWords`](https://github.com/hermitdave/FrequencyWords) (`content/2018/en/en_50k.txt`, ~50 000 words with raw counts),
  licensed **CC-BY-SA 4.0**. Counts come from the English subtitles of films and series, so the list reflects **spoken, conversational
  English** — which is what a learner needs to talk. (Web-text lists such as Google N-grams over-represent words like *click*, *page*, *privacy*.)
* **How the 500 are chosen** (`scripts/build-common500.py`, filter in `scripts/freqfilter.py`): walk the source list in order and keep a
  token only if it is learner vocabulary. Removed tokens: contraction fragments (`'s`, `'t`, `n't` stems such as `didn`, `don`),
  subtitle noise (`sighs`, `laughs`), interjections (`uh`, `um`, `hmm`, `yeah`, `wow`…), first names, titles/abbreviations (`mr`, `dr`, `sir`),
  profanity and informal contractions (`gonna`, `wanna`, `gotta`). **`rank` = position in the filtered list** (1 = `you`, 500 = `hot`).
  The raw `count` is stored with every entry so the ranking is auditable.
* **Word forms, not lemmas:** the source counts surface forms, so `years`, `things`, `went` have their own rank. Every inflected form is
  linked to its base word through `lemmaId` (`years → year`, `went → go`) without being merged into it.
* **Enrichment** (`common500.enrich.txt`: part of speech, CEFR level, IPA, French translation, example + translation) was written by hand for this
  project. CEFR levels are editorial estimates guided by common learner word lists, **not** an official Cambridge/Oxford assignment. IPA is
  British-leaning (RP) and may differ from your accent.

## Most Common Verbs (`verbs.json`)

`scripts/build-verbs.py` ranks ~100 verbs by the **summed corpus count of all their inflected forms** in the same list
(base, -s, -ing, past, participle). Homographs (*like*, *left*, *set*) inflate a few counts slightly — the ranking is a good approximation, not a
linguistic lemma count. `listRank` is the verb's position in the filtered word list.

## Other datasets

* `extra.txt` — phrasal verbs, expressions, travel, work and B1 vocabulary (hand-written, no frequency rank).
* `cognates.txt` — cognates ("Words You Already Know") and false friends (hand-written).
