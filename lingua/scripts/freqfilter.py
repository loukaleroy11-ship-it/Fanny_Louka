"""Shared token filter for the OpenSubtitles frequency list (see build-common500.py)."""
EXCLUDE = set("""
uh um hmm ah oh huh yeah ooh whoa wow eh ha hey ok ya em ma l o s t am ain gonna wanna gotta
didn don won doesn isn wasn couldn wouldn haven shouldn aren hasn weren
sighs laughs chuckles
fuck fucking shit ass bitch damn hell kill killed murder sex
john jack sam michael george jesus god lord mr mrs dr sir
""".split())

def ok(w):
    if "'" in w or "." in w or not w.isalpha(): return False
    return w not in EXCLUDE

