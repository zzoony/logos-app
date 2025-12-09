"""English word forms and morphology utilities.

This module centralizes irregular verb forms and lemmatization exceptions
used across the vocabulary pipeline.
"""

from __future__ import annotations

# Irregular verbs: base form -> list of inflected forms
# Used for both lemmatization (reverse lookup) and sentence matching (forward lookup)
IRREGULAR_VERBS: dict[str, list[str]] = {
    "be": ["was", "were", "been", "being", "am", "is", "are"],
    "have": ["has", "had", "having"],
    "do": ["does", "did", "done", "doing"],
    "go": ["goes", "went", "gone", "going"],
    "say": ["says", "said", "saying"],
    "make": ["makes", "made", "making"],
    "take": ["takes", "took", "taken", "taking"],
    "come": ["comes", "came", "coming"],
    "see": ["sees", "saw", "seen", "seeing"],
    "know": ["knows", "knew", "known", "knowing"],
    "give": ["gives", "gave", "given", "giving"],
    "think": ["thinks", "thought", "thinking"],
    "tell": ["tells", "told", "telling"],
    "become": ["becomes", "became", "becoming"],
    "leave": ["leaves", "left", "leaving"],
    "put": ["puts", "putting"],
    "bring": ["brings", "brought", "bringing"],
    "keep": ["keeps", "kept", "keeping"],
    "hold": ["holds", "held", "holding"],
    "stand": ["stands", "stood", "standing"],
    "hear": ["hears", "heard", "hearing"],
    "let": ["lets", "letting"],
    "mean": ["means", "meant", "meaning"],
    "set": ["sets", "setting"],
    "meet": ["meets", "met", "meeting"],
    "run": ["runs", "ran", "running"],
    "pay": ["pays", "paid", "paying"],
    "sit": ["sits", "sat", "sitting"],
    "send": ["sends", "sent", "sending"],
    "fall": ["falls", "fell", "fallen", "falling"],
    "read": ["reads", "reading"],  # past tense spelled same
    "grow": ["grows", "grew", "grown", "growing"],
    "lose": ["loses", "lost", "losing"],
    "spend": ["spends", "spent", "spending"],
    "cut": ["cuts", "cutting"],
    "build": ["builds", "built", "building"],
    "ride": ["rides", "rode", "ridden", "riding"],
    "hide": ["hides", "hid", "hidden", "hiding"],
    "bite": ["bites", "bit", "bitten", "biting"],
    "write": ["writes", "wrote", "written", "writing"],
    "drive": ["drives", "drove", "driven", "driving"],
    "rise": ["rises", "rose", "risen", "rising"],
    "choose": ["chooses", "chose", "chosen", "choosing"],
    "freeze": ["freezes", "froze", "frozen", "freezing"],
    "speak": ["speaks", "spoke", "spoken", "speaking"],
    "steal": ["steals", "stole", "stolen", "stealing"],
    "break": ["breaks", "broke", "broken", "breaking"],
    "wake": ["wakes", "woke", "woken", "waking"],
    "forget": ["forgets", "forgot", "forgotten", "forgetting"],
    "get": ["gets", "got", "gotten", "getting"],
    "begin": ["begins", "began", "begun", "beginning"],
    "sing": ["sings", "sang", "sung", "singing"],
    "ring": ["rings", "rang", "rung", "ringing"],
    "drink": ["drinks", "drank", "drunk", "drinking"],
    "swim": ["swims", "swam", "swum", "swimming"],
    "sink": ["sinks", "sank", "sunk", "sinking"],
    "shrink": ["shrinks", "shrank", "shrunk", "shrinking"],
    "stink": ["stinks", "stank", "stunk", "stinking"],
    "spring": ["springs", "sprang", "sprung", "springing"],
    "string": ["strings", "strung", "stringing"],
    "wring": ["wrings", "wrung", "wringing"],
    "cling": ["clings", "clung", "clinging"],
    "fling": ["flings", "flung", "flinging"],
    "sling": ["slings", "slung", "slinging"],
    "swing": ["swings", "swung", "swinging"],
    "hang": ["hangs", "hung", "hanging"],
    "bind": ["binds", "bound", "binding"],
    "find": ["finds", "found", "finding"],
    "wind": ["winds", "wound", "winding"],
    "ground": ["grounds", "grounded", "grounding"],
}

# Build reverse lookup: inflected form -> base form
_INFLECTED_TO_BASE: dict[str, str] = {}
for base, forms in IRREGULAR_VERBS.items():
    for form in forms:
        if form not in _INFLECTED_TO_BASE:
            _INFLECTED_TO_BASE[form] = base


def get_base_form(word: str) -> str | None:
    """Get base form of an irregular verb.

    Returns None if word is not a known irregular form.
    """
    return _INFLECTED_TO_BASE.get(word)


def get_word_variants(word: str) -> set[str]:
    """Generate word variants including irregular forms and regular inflections.

    Used for matching words in sentences.
    """
    variants = {word}

    if len(word) < 2:
        return variants

    # Add irregular verb forms if applicable
    if word in IRREGULAR_VERBS:
        variants.update(IRREGULAR_VERBS[word])

    # Regular plural forms
    if word.endswith(("s", "x", "z", "ch", "sh")):
        variants.add(word + "es")
    elif word.endswith("y") and len(word) > 1 and word[-2] not in "aeiou":
        variants.add(word[:-1] + "ies")
    else:
        variants.add(word + "s")

    # Regular past tense (-ed)
    if not word.endswith("ed"):
        if word.endswith("e"):
            variants.add(word + "d")
        elif word.endswith("y") and len(word) > 1 and word[-2] not in "aeiou":
            variants.add(word[:-1] + "ied")
        else:
            variants.add(word + "ed")

    # Progressive (-ing)
    if word.endswith("e") and not word.endswith("ee"):
        variants.add(word[:-1] + "ing")
    elif word.endswith("ie"):
        variants.add(word[:-2] + "ying")
    elif not word.endswith("ing"):
        variants.add(word + "ing")

    return variants
