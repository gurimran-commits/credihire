"""Deterministic Scam Detection Rules Engine.

This module provides deterministic, context-aware rule detection for job-offer
and task-based scam indicators. Every rule verifies contextual intent, handles
bidirectional negation (e.g., "no registration fee required", "task deposit is strictly
prohibited", "we never ask for OTP"), and extracts explainable evidence snippets.
"""

from __future__ import annotations

import re
from typing import List, Optional, Pattern, Tuple

from backend.intelligence.indicators import (
    INDICATOR_METADATA,
    IndicatorCategory,
    IndicatorResult,
)

# ---------------------------------------------------------------------------
# Common Patterns & Negation Handling
# ---------------------------------------------------------------------------

CURRENCY_REGEX = (
    r"(?:[₹$€£]|"
    r"(?:Rs\.?|INR\.?|USD\.?|EUR\.?|USDT|"
    r"rupees?|rupaye?|rupya|रुपये|रुपए|रु\.?)(?:\b|\s|$))"
)
# Supports standard integers, comma-separated thousands, decimals, 'k' multiplier, and Indian '/-' suffix
AMOUNT_REGEX = r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?:\s*[kK])?(?:\s*/-)?"
# Matches money with currency symbol, bare amounts, or currency alone
MONEY_REGEX = rf"(?:(?:{CURRENCY_REGEX}\s*)?{AMOUNT_REGEX}(?:\s*{CURRENCY_REGEX})?|{CURRENCY_REGEX})"

# Common negation terms appearing BEFORE the suspicious phrase
NEGATION_PREFIXES: Tuple[str, ...] = (
    "no",
    "never",
    "not",
    "neither",
    "without",
    "zero",
    "nil",
    "don't",
    "dont",
    "do not",
    "free from",
    "free of",
    "free of cost",
    "free of charge",
    "we do not",
    "we never",
    "will never",
    "does not",
    "shall not",
    "against company policy",
    "strictly prohibited",
    "policy forbids",
)

# Common negation terms appearing AFTER the suspicious phrase
# e.g., "Task deposit is never required", "Registration fee is strictly prohibited"
NEGATION_SUFFIXES: Tuple[str, ...] = (
    "not required",
    "never required",
    "never needed",
    "not needed",
    "not applicable",
    "strictly prohibited",
    "is prohibited",
    "is forbidden",
    "is illegal",
    "is fake",
    "is a scam",
    "is optional",
    "is not charged",
    "is zero",
    "is nil",
    "should never be shared",
    "never share",
    "do not share",
    "policy forbids",
)

# Known abbreviations with trailing periods that should not trigger sentence boundaries
KNOWN_ABBREVIATIONS = frozenset({
    "rs", "inr", "mr", "mrs", "ms", "dr", "prof", "sr", "jr",
    "vs", "etc", "approx", "dept", "corp", "inc", "ltd", "pvt",
    "co", "no", "eg", "ie", "e.g", "i.e", "vol", "sec",
})

CONTRAST_CLAUSE_REGEX = re.compile(
    r"(?:;\s*|"
    r",\s*(?:but|however|although|yet|except|whereas|nevertheless|instead|lekin|magar|parantu|kintu|par|लेकिन|मगर|परंतु|किंतु|पर)\s+|"
    r",\s*(?:so\s+)?(?:please|kindly|now|kripya|kripaya|कृपया)\s+|"
    r",\s*(?:you\s+(?:must|should|need\s+to|have\s+to)|it\s+is\s+mandatory|mandatory|dena\s+hoga|अनिवार्य|जरूरी)\b)",
    re.IGNORECASE,
)

# Negation patterns targeting prefix text within the active clause/sentence
PREFIX_NEGATION_PATTERNS = [
    re.compile(
        r"\b(?:do\s+not|don'?t|does\s+not|doesn'?t|did\s+not|didn'?t|shall\s+not|will\s+not|won'?t|should\s+not|shouldn'?t|would\s+not|wouldn'?t|cannot|can'?t|must\s+not)\b(?!\s+hesitate)",
        re.IGNORECASE,
    ),
    re.compile(r"\b(?:we\s+|will\s+|shall\s+)?never\b(?!\s+(?:give\s+up|miss))", re.IGNORECASE),
    re.compile(r"\bneither\b", re.IGNORECASE),
    re.compile(r"\bwithout\s+(?:any\s+)?(?:fees?|charges?|deposits?|recharge|payments?|costs?|paying|depositing|investment)", re.IGNORECASE),
    re.compile(r"\bfree\s+(?:of\s+(?:cost|charge|all\s+fees?)|from\s+(?:all\s+)?(?:fees?|charges?)|of\s+fees?)\b", re.IGNORECASE),
    re.compile(r"\b(?:zero|nil)\s+(?:fees?|charges?|deposits?|cost|registration|investment)\b", re.IGNORECASE),
    re.compile(r"\bagainst\s+(?:our\s+|company\s+)?policy\b", re.IGNORECASE),
    re.compile(r"\b(?:strictly\s+)?(?:prohibited|forbidden|illegal)\b", re.IGNORECASE),
    re.compile(r"\b(?:there\s+is\s+no|charge\s+no|require\s+no|take\s+no|ask\s+(?:for\s+)?no|demands?\s+no|accept\s+no)\b", re.IGNORECASE),
    re.compile(r"\bwarning:\s*(?:we\s+do\s+not|we\s+never|do\s+not|never)\b", re.IGNORECASE),
    re.compile(r"\bcaution:\s*(?:we\s+do\s+not|we\s+never|do\s+not|never)\b", re.IGNORECASE),
    re.compile(r"\bbeware\s+of\s+(?:[\w-]+\s+){0,4}(?:asking|demanding|requesting|charging|requiring)\b", re.IGNORECASE),
    # Hindi / Hinglish prefix negations
    re.compile(r"\b(?:hum\s+kabhi\s+(?:bhi\s+)?nahi|kabhi\s+(?:bhi\s+)?nahi|kabhi\s+mat)\b", re.IGNORECASE),
    re.compile(r"\b(?:koi\s+(?:bhi\s+)?(?:fees?|charges?|paise|deposit|rakam)\s+(?:nahi|nhi))\b", re.IGNORECASE),
    re.compile(r"\bbina\s+(?:kisi\s+)?(?:fees?|charges?|paise|deposit|shulk|kharch)\b", re.IGNORECASE),
    re.compile(r"\b(?:savdhan|warning|caution):\s*(?:hum\s+kabhi|kisi\s+ko|kabhi|koi)\b", re.IGNORECASE),
    re.compile(r"(?:हम\s+कभी\s+(?:भी\s+)?नहीं|कभी\s+(?:भी\s+)?नहीं|कभी\s+मत)", re.IGNORECASE),
    re.compile(r"(?:बिना\s+(?:किसी\s+)?(?:शुल्क|फीस|पैसे|डिपॉजिट|रकम|खर्च))", re.IGNORECASE),
    re.compile(r"(?:कोई\s+(?:भी\s+)?(?:शुल्क|फीस|पैसे|डिपॉजिट|रकम)\s+नहीं)", re.IGNORECASE),
    re.compile(r"(?:सावधान|चेतावनी):\s*(?:हम\s+कभी|किसी\s+को|कभी|कोई)", re.IGNORECASE),
]

# Patterns for 'no' directly qualifying a fee/deposit/credential noun
PREFIX_NO_QUALIFIER_PATTERN = re.compile(
    r"\b(?:no|koi\s+(?:bhi\s+)?|कोई\s+(?:भी\s+)?)\s*"
    r"(?:[A-Za-z\u0900-\u097F-]+\s+){0,2}"
    r"(?:fees?|charges?|deposits?|recharge|investments?|payments?|money|costs?|otp|pins?|credentials?|amounts?|"
    r"paise|shulk|rakam|शुल्क|फीस|पैसे|रकम|डिपॉजिट|रिचार्ज|ओटीपी|पिन)\b",
    re.IGNORECASE,
)

SUFFIX_NEGATION_PATTERNS = [
    re.compile(r"\b(?:is\s+|are\s+)?(?:not|never)\s+(?:required|needed|applicable|charged|demanded|asked|collected)\b", re.IGNORECASE),
    re.compile(r"\b(?:is\s+|are\s+)?(?:strictly\s+)?(?:prohibited|forbidden|illegal)\b", re.IGNORECASE),
    re.compile(r"\b(?:is\s+|are\s+)?(?:a\s+)?(?:common\s+)?(?:scam|fake|fraudulent)(?:\s+tactics?|\s+schemes?)?\b", re.IGNORECASE),
    re.compile(r"\bscams?\s+(?:target|targets|targeting|aimed\s+at)\b", re.IGNORECASE),
    re.compile(r"\b(?:is\s+|are\s+)?(?:optional|free|zero|nil)\b", re.IGNORECASE),
    re.compile(r"\b(?:is\s+|are\s+)?not\s+charged\b", re.IGNORECASE),
    re.compile(r"\bshould\s+never\s+be\s+shared\b", re.IGNORECASE),
    re.compile(r"\bnever\s+share\b", re.IGNORECASE),
    re.compile(r"\bdo\s+not\s+share\b", re.IGNORECASE),
    re.compile(r"\bpolicy\s+forbids\b", re.IGNORECASE),
    # Hindi / Hinglish suffix negations
    re.compile(r"\b(?:koi\s+paise\s+)?(?:nahi|nhi)\s+(?:lagenge|lagega|dena|dena\s+hoga|dena\s+padega|chahiye|maangte|mangte|lete|hoga)\b", re.IGNORECASE),
    re.compile(r"\b(?:kisi\s+ko\s+)?(?:mat\s+(?:do|bhejo|batao|share\s+karo|dalo)|share\s+mat\s+karo|batao\s+mat)\b", re.IGNORECASE),
    re.compile(r"\bkisi\s+ke\s+saath\s+(?:share\s+mat\s+karo|kabhi\s+share\s+na\s+kare)\b", re.IGNORECASE),
    re.compile(r"\b(?:ki\s+)?(?:koi\s+)?(?:zaroorat|jarurat|avashyakta)\s+nahi\s+(?:hai)?\b", re.IGNORECASE),
    re.compile(r"(?:नहीं\s+(?:लगेगा|लगेंगे|देना|देना\s+होगा|देना\s+पड़ेगा|चाहिए|मांगते|लेते|होगा))", re.IGNORECASE),
    re.compile(r"(?:मत\s+(?:करें|करो|बताएं|बताओ|दीजिए|दें|डालें|भेजें)|साझा\s+मत\s+करें|शेयर\s+मत\s+करें)", re.IGNORECASE),
    re.compile(r"(?:किसी\s+के\s+साथ\s+शेयर\s+मत\s+करें|किसी\s+को\s+मत\s+बताएं)", re.IGNORECASE),
    re.compile(r"(?:की\s+(?:कोई\s+)?(?:जरूरत|आवश्यकता)\s+नहीं\s+है)", re.IGNORECASE),
    re.compile(r"(?:पूरी\s+तरह\s+)?(?:फ्री|मुफ्त|निःशुल्क|निशुल्क)\s+है", re.IGNORECASE),
]


def _is_sentence_boundary_dot(text: str, dot_pos: int) -> bool:
    """Check if a dot at dot_pos represents a true sentence boundary or abbreviation/decimal."""
    prefix = text[:dot_pos + 1]
    # Check multi-part abbreviations like e.g. or i.e.
    if re.search(r"\b[A-Za-z]\.[A-Za-z]\.$", prefix):
        return False
    # Check known word abbreviations (e.g., Rs., Dr., Ltd.)
    m = re.search(r"\b([A-Za-z]+)\.$", prefix)
    if m and m.group(1).lower() in KNOWN_ABBREVIATIONS:
        return False
    # Check single uppercase initial e.g., ' A. '
    if re.search(r"\b[A-Z]\.$", prefix):
        return False
    # Check decimal digits e.g., 2.5
    if dot_pos > 0 and prefix[-2].isdigit() and dot_pos + 1 < len(text) and text[dot_pos + 1].isdigit():
        return False
    return True


def _get_sentence_bounds(text: str, start_idx: int, end_idx: int) -> Tuple[int, int]:
    """Find start and end boundaries for the sentence containing the target span."""
    left_bound = 0
    # Sentence delimiters: newline, exclamation, question mark, Hindi purna viram, or period followed by whitespace
    for m in re.finditer(r"([\n\r!?\u0964\u0965]|\.\s+)", text[:start_idx]):
        term = m.group(1)
        if term.startswith("."):
            if not _is_sentence_boundary_dot(text, m.start()):
                continue
        left_bound = m.end()

    right_bound = len(text)
    for m in re.finditer(r"([\n\r!?\u0964\u0965]|\.\s+|\.$)", text[end_idx:]):
        term = m.group(1)
        if term.startswith("."):
            dot_pos = end_idx + m.start()
            if not _is_sentence_boundary_dot(text, dot_pos):
                continue
        right_bound = end_idx + m.start()
        break

    return left_bound, right_bound


def _is_negated(text: str, match_start: int, match_end: int, window: int = 70) -> bool:
    """Check if the matched phrase is negated within its own sentence or clause.

    Negation detection is strictly sentence-aware and clause-aware. A warning
    or negative qualifier in one sentence (or across a contrasting conjunction)
    cannot suppress a suspicious payment or credential request in another sentence.
    """
    sent_start, sent_end = _get_sentence_bounds(text, match_start, match_end)

    # Clause segmentation inside sentence (e.g., contrasting conjunctions like ', but ')
    clause_start = sent_start
    sent_prefix = text[sent_start:match_start]
    for cm in CONTRAST_CLAUSE_REGEX.finditer(sent_prefix):
        clause_start = sent_start + cm.end()

    # Comma-aware clause boundary:
    # Differentiates an affirmative demand following a disclaimer from a negative continuation/list
    # - Negative continuation/list: "We do not charge registration fees, onboarding fees, or training fees."
    # - Affirmative demand: "We never charge candidates, kindly transfer ₹500 to activate your account."
    if "," in sent_prefix[clause_start - sent_start:]:
        rel_prefix = sent_prefix[clause_start - sent_start:]
        last_comma = clause_start + rel_prefix.rfind(",")
        between = text[last_comma + 1:match_start]
        full_segment = text[last_comma + 1:match_end]

        is_independent_demand = (
            re.search(r"^\s*(?:but|however|although|yet|except|whereas|nevertheless|instead|so|while|lekin|magar|parantu|kintu|par|लेकिन|मगर|परंतु|किंतु|पर)\b", between, re.I)
            or re.search(r"^\s*(?:please|kindly|now|just|kripya|kripaya|कृपया)\b", between, re.I)
            or re.search(r"^\s*(?:you\s+(?:must|should|need|have)|candidates?\s+must|it\s+is\s+mandatory|aapko|aap\s+ko|dena\s+hoga|अनिवार्य|जरूरी)\b", between, re.I)
            or re.search(rf"\b(?:pay|transfer|deposit|send|recharge|jama|bhejo|bharo|bheje|पे|जमा|भेजें|भरें)\s+(?:a\s+)?{MONEY_REGEX}", full_segment, re.I)
            or re.search(r"\b(?:share|provide|send|give|enter|forward|batao|bhejo|dalo|साझा|बताएं|भेजें|दर्ज)\s+(?:(?:the|your|this|any|apna|अपना)\s+)?(?:otp|pin|password|credentials?|cvv|ओटीपी|पिन|पासवर्ड)\b", full_segment, re.I)
        )
        if is_independent_demand:
            clause_start = max(clause_start, last_comma + 1)

    clause_end = sent_end
    sent_suffix = text[match_end:sent_end]
    cm_post = CONTRAST_CLAUSE_REGEX.search(sent_suffix)
    if cm_post:
        clause_end = match_end + cm_post.start()

    # Respect the window distance while strictly bounding within the current clause
    effective_start = max(clause_start, match_start - window)
    effective_end = min(clause_end, match_end + window)

    prefix_text = text[effective_start:match_start]
    suffix_text = text[match_end:effective_end]
    matched_text = text[match_start:match_end]

    # 1. Check direct prefix negation patterns within active clause
    for pat in PREFIX_NEGATION_PATTERNS:
        if pat.search(prefix_text):
            return True

    # 2. Check 'no' qualifying the matched term (e.g. 'No registration fee')
    combined_prefix_match = prefix_text + " " + matched_text
    if PREFIX_NO_QUALIFIER_PATTERN.search(combined_prefix_match):
        return True

    # 3. Check suffix negation patterns within active clause
    for pat in SUFFIX_NEGATION_PATTERNS:
        if pat.search(suffix_text):
            return True

    return False


def _extract_evidence_sentence(text: str, start_idx: int, end_idx: int) -> str:
    """Extract the surrounding sentence as clean, human-readable evidence without splitting on abbreviations."""
    left_bound, right_bound = _get_sentence_bounds(text, start_idx, end_idx)
    snippet = text[left_bound:right_bound].strip()
    # Strip trailing sentence-terminating punctuation
    snippet = re.sub(r"[\n\r.!?\u0964\u0965]+$", "", snippet).strip()
    snippet = re.sub(r"\s+", " ", snippet)
    if not snippet:
        snippet = text[start_idx:end_idx].strip()
    return snippet


# ---------------------------------------------------------------------------
# Rule 1: Upfront Registration / Onboarding Fees
# ---------------------------------------------------------------------------

REGISTRATION_FEE_PATTERNS: List[Pattern[str]] = [
    # "Pay ₹2,000 registration fee", "Deposit 500 joining fee"
    re.compile(
        rf"(?:pay|deposit|transfer|send|charge|submit|fee\s+of)\s+(?:a\s+)?"
        rf"(?:{MONEY_REGEX}\s+)?(?:refundable\s+)?"
        rf"(?:registration|onboarding|joining|application|interview|screening|enrollment|documentation|training|verification)\s+"
        rf"(?:fee|charge|deposit|amount|cost)",
        re.IGNORECASE,
    ),
    # "registration fee: ₹500", "onboarding fee of Rs 1000"
    re.compile(
        rf"\b(?:registration|onboarding|joining|application|interview|training|verification)\s+"
        rf"(?:fee|charge|deposit|cost)\s*(?:of|:|-|\bis\b)\s*{MONEY_REGEX}",
        re.IGNORECASE,
    ),
    # "Pay to register", "pay 1500 for registration", "send payment for starter kit", "Pay ₹500 for a job interview slot"
    re.compile(
        rf"(?:pay|transfer|deposit|send)\s+(?:(?:{MONEY_REGEX}|payment|money|fees?)\s+)?"
        rf"(?:to\s+(?:register|enroll|start|onboard|attend\s+interview|get\s+hired|activate\s+(?:your\s+)?(?:account|profile|id|membership))|"
        rf"for\s+(?:(?:the\s+)?(?:starter\s+kit|id\s+card|uniform|badge)|registration|onboarding|training|(?:a\s+|an\s+|the\s+)?(?:job\s+)?interview\s+(?:slot|booking|appointment|seat)))",
        re.IGNORECASE,
    ),
    # "a ₹500 joining fee is mandatory", "₹1,000 registration fee is required"
    re.compile(
        rf"(?:a\s+)?{MONEY_REGEX}\s+(?:refundable\s+)?"
        rf"(?:registration|onboarding|joining|application|interview|screening|enrollment|documentation|training|verification)\s+"
        rf"(?:fee|charge|deposit|amount|cost)",
        re.IGNORECASE,
    ),
    # Hindi / Hinglish: "काम/जॉब शुरू करने के लिए ₹500 रजिस्ट्रेशन फीस भरें" / "Registration ke liye Rs 500 fees pay karo"
    re.compile(
        rf"(?:registration|joining|onboarding|interview|training|bharti|panjikaran|रजिस्ट्रेशन|पंजीकरण|जॉइनिंग|भर्ती|इंटरव्यू|ट्रेनिंग|आवेदन)\s+"
        rf"(?:fee|fees|shulk|charge|charges|paise|शुल्क|फीस|चार्ज|पैसे)\s*"
        rf"(?:of|:|-|\bis\b|dena|deni|bhare|bharo|jama|pay\s+karo|भरें|दें|जमा|पे\s+करें)?\s*{MONEY_REGEX}?",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:{MONEY_REGEX}\s+)?(?:registration|joining|onboarding|interview|training|panjikaran|रजिस्ट्रेशन|पंजीकरण|जॉइनिंग|भर्ती|इंटरव्यू|ट्रेनिंग|आवेदन)\s+"
        rf"(?:fee|fees|shulk|charge|charges|शुल्क|फीस|चार्ज)\s+(?:bhare|bharo|jama\s+kare|bhejo|deni\s+hogi|pay\s+karo|भरें|दें|जमा\s+करें|भेजें)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:registration|joining|onboarding|रजिस्ट्रेशन|पंजीकरण|जॉइनिंग)\s+ke\s+liye\s+"
        rf"(?:{MONEY_REGEX}\s+)?(?:fees?|charges?|paise|shulk|pay|jama|bhejo|bharo|dena|deposit)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:काम|नौकरी|जॉब|job|naukri|kaam)\s+(?:शुरू\s+करने|पाने|ke\s+liye|paane\s+ke\s+liye)\s+"
        rf"(?:{MONEY_REGEX}\s+)?(?:रजिस्ट्रेशन|पंजीकरण|जॉइनिंग|registration|joining)\s+(?:फीस|शुल्क|चार्ज|fees?|charges?|paise)",
        re.IGNORECASE,
    ),
]


def detect_registration_fee(text: str) -> Optional[IndicatorResult]:
    """Detect demands for upfront registration, application, or onboarding fees."""
    evidence_list: List[str] = []

    for pattern in REGISTRATION_FEE_PATTERNS:
        for match in pattern.finditer(text):
            if _is_negated(text, match.start(), match.end()):
                continue

            snippet = _extract_evidence_sentence(text, match.start(), match.end())
            if snippet and snippet not in evidence_list:
                evidence_list.append(snippet)

    if evidence_list:
        meta = INDICATOR_METADATA[IndicatorCategory.UPFRONT_REGISTRATION_FEE.value]
        return IndicatorResult(
            indicator=IndicatorCategory.UPFRONT_REGISTRATION_FEE.value,
            explanation=(
                "Payment is requested for registration, onboarding, application processing, "
                "or training before employment commences. Legitimate employers never charge candidates."
            ),
            evidence=evidence_list,
            severity=meta["severity"],
            rule_id="RULE_REGISTRATION_FEE_01",
        )
    return None


# ---------------------------------------------------------------------------
# Rule 2: Task Deposits / Task-Unlocking Payments
# ---------------------------------------------------------------------------

TASK_DEPOSIT_PATTERNS: List[Pattern[str]] = [
    # "Pay ₹2,000 to unlock your task earnings", "pay 2k to unlock task earnings", "Pay ₹500 to unlock your account"
    re.compile(
        rf"(?:pay|deposit|recharge|transfer|send)\s+(?:{MONEY_REGEX}\s+)?"
        rf"(?:(?:to|for)\s+(?:unlock|unlocking|access|receive|release|claim|start|continue)\s+(?:your\s+)?"
        rf"(?:tasks?|task\s+earnings?|vip\s+tasks?|next\s+tasks?|commissions?|account))",
        re.IGNORECASE,
    ),
    # "Recharge ₹1,000 for next VIP task", "Prepay 500 to receive daily tasks", "Pay ₹1,000 for VIP task"
    re.compile(
        rf"(?:recharge|deposit|prepay|pay|transfer)\s+(?:{MONEY_REGEX}\s+|an\s+amount\s+)?"
        rf"(?:for|to\s+(?:get|receive|access|start|upgrade)|in\s+order\s+to\s+receive)\s+"
        rf"(?:(?:(?:the\s+)?next\s+)?(?:vip\s+tasks?(?:\s+unlocking)?|level|tasks?|orders?|tier)|higher\s+commission|daily\s+tasks?|assigned\s+tasks?)",
        re.IGNORECASE,
    ),
    # "pay task deposit", "task deposit of ₹500", "task deposit is required"
    re.compile(
        rf"(?:pay|deposit|transfer|send|require|demands?)\s+(?:a\s+)?(?:{MONEY_REGEX}\s+)?"
        rf"(?:task|mission|order)\s+(?:deposit|recharge|investment|prepayment)\b",
        re.IGNORECASE,
    ),
    re.compile(
        rf"\b(?:task|mission|order)\s+(?:deposit|recharge|investment|prepayment)\s*(?:of|:|-|\bis\b)\s*{MONEY_REGEX}",
        re.IGNORECASE,
    ),
    re.compile(
        rf"\b(?:task|mission|order)\s+(?:deposit|recharge|investment|prepayment)\s+(?:is\s+)?(?:required|mandatory|compulsory|needed)\b",
        re.IGNORECASE,
    ),
    # "VIP tasks require a ₹500 deposit", "tasks require a recharge of ₹1,000"
    re.compile(
        rf"\b(?:vip\s+)?(?:tasks?|missions?|orders?)\s+(?:require|demands?|need|needs?)\s+(?:(?:a|an)\s+)?(?:{MONEY_REGEX}\s+)?(?:deposit|recharge|investment|prepayment)\b",
        re.IGNORECASE,
    ),
    # "unlock your earnings / tasks by paying"
    re.compile(
        rf"\bunlock\s+(?:your\s+)?(?:tasks?|task\s+earnings|commissions?)\s+by\s+(?:paying|transferring|depositing|recharging)",
        re.IGNORECASE,
    ),
    # "buy crypto / USDT to complete task", "deposit 50 USDT to start merchant evaluation task"
    re.compile(
        rf"(?:buy|deposit|recharge|transfer)\s+(?:{MONEY_REGEX}\s+)?(?:crypto|usdt|bitcoin|funds)?\s*"
        rf"to\s+(?:complete|unlock|continue|start)\s+(?:(?:the|your|a)\s+)?(?:[\w-]+\s+){{0,3}}tasks?",
        re.IGNORECASE,
    ),
    # Hindi: "काम शुरू करने के लिए ₹500 जमा करें"
    re.compile(
        rf"काम\s+शुरू\s+करने\s+के\s+लिए\s+{MONEY_REGEX}\s+जमा\s+करें",
        re.IGNORECASE,
    ),
    # Hindi / Hinglish: "Task unlock karne ke liye deposit bhejo"
    re.compile(
        rf"(?:task|tasks|vip\s+task|mission|order|टास्क|काम|मिशन|ऑर्डर)\s+"
        rf"(?:unlock|start|chalu|paane|pane|receive|अनलॉक|शुरू)\s+(?:karne\s+ke\s+liye|के\s+लिए)\s+"
        rf"(?:{MONEY_REGEX}\s+)?(?:deposit|recharge|pay|jama|bhejo|bheje|transfer|डिपॉजिट|जमा|रिचार्ज|भेजें)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:टास्क|काम|mission|task)\s+(?:डिपॉजिट|रिचार्ज|प्रीपेमेंट|deposit|recharge|prepayment)\s*(?:(?:of|:|-)\s*{MONEY_REGEX}|(?:dena|karo|bhejo|दें|करें|भेजें))",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:agla|next|vip)\s+(?:tasks?|टास्क)\s+(?:ke\s+liye|paane\s+ke\s+liye|के\s+लिए)\s+"
        rf"(?:{MONEY_REGEX}\s+)?(?:recharge|deposit|pay|jama|रिचार्ज|डिपॉजिट|जमा)",
        re.IGNORECASE,
    ),
]


def detect_task_deposit(text: str) -> Optional[IndicatorResult]:
    """Detect demands for task deposits, recharge, or fees to unlock work/earnings."""
    evidence_list: List[str] = []

    for pattern in TASK_DEPOSIT_PATTERNS:
        for match in pattern.finditer(text):
            if _is_negated(text, match.start(), match.end()):
                continue

            # Ensure this is not a legitimate HR "direct deposit of salary"
            matched_str = match.group(0).lower()
            if "direct deposit" in matched_str and "salary" in text.lower():
                continue

            snippet = _extract_evidence_sentence(text, match.start(), match.end())
            if snippet and snippet not in evidence_list:
                evidence_list.append(snippet)

    if evidence_list:
        meta = INDICATOR_METADATA[IndicatorCategory.TASK_DEPOSIT.value]
        return IndicatorResult(
            indicator=IndicatorCategory.TASK_DEPOSIT.value,
            explanation=(
                "Payment or account recharge is demanded to assign, unlock, or continue "
                "tasks, or to release accrued task earnings. Legitimate work does not require pay-to-work deposits."
            ),
            evidence=evidence_list,
            severity=meta["severity"],
            rule_id="RULE_TASK_DEPOSIT_02",
        )
    return None


# ---------------------------------------------------------------------------
# Rule 3: Withdrawal Fees or Blocked Withdrawals Requiring Payment
# ---------------------------------------------------------------------------

WITHDRAWAL_BLOCK_PATTERNS: List[Pattern[str]] = [
    # "Pay ₹1,000 to withdraw your balance", "pay clearance fee of ₹2,500 to release funds"
    re.compile(
        rf"(?:pay|deposit|transfer|send)\s+"
        rf"(?:(?:{MONEY_REGEX}|(?:(?:clearance|processing|unlock|unfreeze|handling)\s+)?fee(?:\s+of\s+{MONEY_REGEX})?|\d+%\s*(?:(?:tax|gst)\s+)?(?:fee|charges?)?)\s+)?"
        rf"(?:to\s+(?:withdraw|unfreeze|release|cash\s*out|unlock)\s+(?:your\s+)?"
        rf"(?:funds|balance|earnings|money|wallet|salary))",
        re.IGNORECASE,
    ),
    # "Pay clearance fee of ₹2,500", "pay unfreeze fee of ₹1,000"
    re.compile(
        rf"(?:pay|deposit|transfer|send)\s+(?:{MONEY_REGEX}\s+)?"
        rf"(?:(?:a|the)\s+)?(?:clearance|unfreeze|unlock|release|withdrawal|conversion)\s+fee",
        re.IGNORECASE,
    ),
    # "Withdrawal of ₹25,000 is on hold: pay...", "account is frozen: pay..."
    re.compile(
        rf"\b(?:withdrawal|account|wallet|balance)\s+(?:(?:of\s+{MONEY_REGEX}\s+)?(?:is\s+)?)?"
        rf"(?:frozen|blocked|on\s+hold|suspended|locked)\b[^.!?\n\u0964\u0965]*?"
        rf"(?::|,|\s+and|\s+so|\s+please)?\s*"
        rf"(?:pay|deposit|transfer|send)\s+(?:{MONEY_REGEX}|(?:clearance\s+)?fee)",
        re.IGNORECASE,
    ),
    # "To withdraw your balance, a clearance fee is required"
    re.compile(
        rf"\bto\s+(?:withdraw|unfreeze|release|cash\s*out|unlock)\s+(?:your\s+)?"
        rf"(?:funds|balance|earnings|money|wallet|salary)[,\s]+"
        rf"(?:a\s+)?(?:[\w-]+\s+){{0,3}}?"
        rf"(?:clearance|processing|handling|unfreeze|tax|gst|release)?\s*fees?\s+"
        rf"(?:is\s+)?(?:required|mandatory|needed|must\s+be\s+paid)",
        re.IGNORECASE,
    ),
    # "clearance fee of ₹... to process withdrawal", "tax payment required before withdrawal"
    re.compile(
        rf"\b(?:clearance|unfreeze|unlock|processing|handling|tax|gst|conversion)\s+fee\s+"
        rf"(?:of\s+{MONEY_REGEX}\s+)?"
        rf"(?:is\s+required\s+)?(?:for|to\s+process|before)\s+(?:withdrawal|payout|cashing\s*out)",
        re.IGNORECASE,
    ),
    # "pay 18% GST to release your money"
    re.compile(
        rf"(?:pay|transfer)\s+\d+%\s*(?:tax|gst|fee|commission)\s+to\s+(?:release|withdraw|receive)\s+(?:your\s+)?(?:funds|earnings|balance)",
        re.IGNORECASE,
    ),
    # Hindi: "पैसे निकालने के लिए पहले फीस भरें"
    re.compile(
        rf"पैसे\s+निकालने\s+के\s+लिए\s+पहले\s+फीस\s+भरें",
        re.IGNORECASE,
    ),
    # Hindi / Hinglish: "पैसे/earnings nikalne ke liye clearance fee/tax pay karo"
    re.compile(
        rf"(?:paise|kamai|earnings?|balance|wallet|funds?|withdrawal|पैसे|रकम|कमाई|बैलेंस|विड्रॉल)\s+"
        rf"(?:nikalne|withdraw|release|unfreeze|unlock|निकालने|रिलीज़|अनफ्रीज)\s+(?:(?:karne\s+)?ke\s+liye|के\s+लिए)\s+"
        rf"(?:(?:pehle|पहले)\s+)?(?:{MONEY_REGEX}\s+)?(?:(?:clearance|processing)\s+)?(?:fees?|charges?|tax|gst|clearance|deposit|pay|bharo|bhejo|फीस|चार्ज|टैक्स|जीएसटी|डिपॉजिट|भुगतान|भरें)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:withdrawal|withdraw|nikalne|पैसे\s+निकालने)\s+(?:ke\s+liye|karne\s+ke\s+liye)\s+[^.!?\n\u0964\u0965]*?(?:tax|gst|fee|charges?|clearance|pay)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:account|wallet|balance|withdrawal|अकाउंट|वॉलेट|विड्रॉल|बैलेंस)\s+"
        rf"(?:freeze|blocked|hold|ruka|होल्ड|फ्रीज|ब्लॉक)\s+(?:hai|hua\s+hai|है)[^.!?\n\u0964\u0965]*?"
        rf"(?:fees?|charges?|tax|gst|clearance|paise|फीस|चार्ज|टैक्स|जीएसटी|पैसे|भुगतान)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:निकासी|विड्रॉल|clearance)\s+(?:शुल्क|फीस|tax|charges?)\s+(?:deni\s+hogi|lagegi|bharo|भरें|देनी\s+होगी)",
        re.IGNORECASE,
    ),
]


def detect_withdrawal_block(text: str) -> Optional[IndicatorResult]:
    """Detect withdrawal blocks demanding fees, taxes, or payments to release money."""
    evidence_list: List[str] = []

    for pattern in WITHDRAWAL_BLOCK_PATTERNS:
        for match in pattern.finditer(text):
            if _is_negated(text, match.start(), match.end()):
                continue

            snippet = _extract_evidence_sentence(text, match.start(), match.end())
            if snippet and snippet not in evidence_list:
                evidence_list.append(snippet)

    if evidence_list:
        meta = INDICATOR_METADATA[IndicatorCategory.WITHDRAWAL_FEE.value]
        return IndicatorResult(
            indicator=IndicatorCategory.WITHDRAWAL_FEE.value,
            explanation=(
                "Withdrawal of accumulated balance is withheld behind mandatory fee, tax, "
                "or clearance payment demands. This is a classic scam trap to extract further funds."
            ),
            evidence=evidence_list,
            severity=meta["severity"],
            rule_id="RULE_WITHDRAWAL_FEE_03",
        )
    return None


# ---------------------------------------------------------------------------
# Rule 4: Unrealistic Earnings Claims
# ---------------------------------------------------------------------------

LOW_EFFORT_TASKS = (
    r"(?:liking|subscribing|watching|rating|reviewing|typing|copy\s*pasting|"
    r"captcha|youtube\s*videos?|google\s*maps?|hotel\s*reviews?|trailers?|"
    r"clicking|micro\s*tasks?|part\s*time\s*online)"
)

UNREALISTIC_EARNINGS_PATTERNS: List[Pattern[str]] = [
    # "Earn ₹2,000 - ₹5,000 daily from home by liking YouTube videos", "Earn 3000 to 8000 daily by liking YouTube videos from home"
    re.compile(
        rf"(?:earn|make|get|receive|daily\s+income\s+of)\s+"
        rf"(?:{MONEY_REGEX}(?:\s*(?:-|to)\s*{MONEY_REGEX})?)\s*"
        rf"(?:per\s+day|daily|every\s+day|per\s+hour|hourly)\s*"
        rf"(?:\s*(?:working\s+)?(?:from|at)\s+home)?\s*"
        rf"(?:by|for|just\s+by)?\s*{LOW_EFFORT_TASKS}"
        rf"(?:[\w\s-]{{0,30}}?(?:(?:from|at)\s+home))?",
        re.IGNORECASE,
    ),
    # "10k daily income from home by liking youtube videos"
    re.compile(
        rf"(?:(?:earn|make|get|receive|daily\s+income\s+of)\s+{MONEY_REGEX}|{MONEY_REGEX}\s+(?:daily\s+income|daily\s+payout|income\s+daily))\s*"
        rf"(?:\s*(?:-|to)\s*{MONEY_REGEX})?\s*"
        rf"(?:per\s+day|daily|every\s+day|per\s+hour|hourly)?\s*"
        rf"(?:\s*(?:working\s+)?(?:from|at)\s+home)?\s*"
        rf"(?:by|for|just\s+by)?\s*{LOW_EFFORT_TASKS}",
        re.IGNORECASE,
    ),
    # "Work 10-15 minutes daily and earn ₹30,000 - ₹50,000 per month without experience"
    re.compile(
        rf"(?:work|spend)\s+\d+[\s-]*(?:to|-)?\s*\d*\s*(?:mins?|minutes?|hours?)\s*(?:a\s+day|daily|per\s+day)?\s*"
        rf"(?:and|to)?\s*(?:earn|make)\s+{MONEY_REGEX}",
        re.IGNORECASE,
    ),
    # "Guaranteed daily payout of ₹3000 to your UPI / instant payout"
    re.compile(
        rf"(?:guaranteed|instant)\s+(?:daily|hourly)\s+(?:payout|returns?|income|profit)\s+"
        rf"(?:of\s+)?{MONEY_REGEX}",
        re.IGNORECASE,
    ),
    # "100% guaranteed returns on small investment task"
    re.compile(
        rf"(?:100%|guaranteed)\s+(?:daily\s+returns?|profit\s+every\s+day|risk[\s-]free\s+income)",
        re.IGNORECASE,
    ),
    # Hindi / Hinglish: "घर बैठे यूट्यूब वीडियो लाइक करके रोजाना ₹2,000 से ₹5,000 कमाएं" / "Daily 3000 se 8000 kamao by liking videos from home"
    re.compile(
        rf"(?:ghar\s+baithe|घर\s+बैठे)?\s*"
        rf"(?:roj|daily|har\s+din|per\s+day|rozana|रोजाना|प्रतिदिन|हर\s+दिन)\s+"
        rf"{MONEY_REGEX}(?:\s*(?:se|to|-|से|तक)\s*{MONEY_REGEX})?\s*"
        rf"(?:kamao|kamaye|kama\s+sakte\s+ho|earn|कमाएं|कमाओ|कमाए|कमा\s+सकते\s+हैं)\b.*?"
        rf"(?:like|subscribe|video|youtube|review|rating|यूट्यूब|वीडियो|लाइक|रिव्यू|घर\s+बैठे)?",
        re.IGNORECASE,
    ),
    re.compile(
        rf"{MONEY_REGEX}(?:\s*(?:se|to|-|से|तक)\s*{MONEY_REGEX})?\s*"
        rf"(?:roj|daily|har\s+din|per\s+day|rozana|रोजाना|प्रतिदिन|हर\s+दिन)\s*"
        rf"(?:kamao|kamaye|earn|कमाएं|कमाओ)\s*"
        rf"(?:by|karke|करके)?\s*(?:like|video|youtube|review|यूट्यूब|वीडियो|लाइक)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:sirf|just|केवल|सिर्फ)\s+\d+[\s-]*(?:se|-)?\s*\d*\s*(?:mins?|minutes?|मिनट)\s+"
        rf"(?:kaam|work|काम)\s+karke\s+{MONEY_REGEX}\s+(?:kamao|kamaye|कमाएं)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:100%|गारंटीड|गारंटी)\s+(?:daily\s+kamai|daily\s+income|roj\s+ka\s+profit|कमाई|मुनाफा|इनकम)",
        re.IGNORECASE,
    ),
]


def detect_unrealistic_earnings(text: str) -> Optional[IndicatorResult]:
    """Detect unrealistic high-return earnings promises for trivial unskilled tasks."""
    evidence_list: List[str] = []

    for pattern in UNREALISTIC_EARNINGS_PATTERNS:
        for match in pattern.finditer(text):
            if _is_negated(text, match.start(), match.end()):
                continue

            snippet = _extract_evidence_sentence(text, match.start(), match.end())
            if snippet and snippet not in evidence_list:
                evidence_list.append(snippet)

    if evidence_list:
        meta = INDICATOR_METADATA[IndicatorCategory.UNREALISTIC_EARNINGS.value]
        return IndicatorResult(
            indicator=IndicatorCategory.UNREALISTIC_EARNINGS.value,
            explanation=(
                "Claims exorbitant daily or hourly earnings for low-skill, trivial online tasks "
                "(such as liking videos, reviews, or captcha typing) without requiring verified qualifications."
            ),
            evidence=evidence_list,
            severity=meta["severity"],
            rule_id="RULE_UNREALISTIC_EARNINGS_04",
        )
    return None


# ---------------------------------------------------------------------------
# Rule 5: Urgency and High-Pressure Tactics
# ---------------------------------------------------------------------------

URGENCY_PATTERNS: List[Pattern[str]] = [
    # "Transfer within 10 minutes or offer expires"
    re.compile(
        rf"(?:transfer|pay|recharge|act|respond|confirm)(?:\s+[\w₹,.-]+){{0,6}}\s+within\s+\d+\s*(?:mins?|minutes?|hours?)\s+"
        rf"(?:or|otherwise)\s+(?:offer\s+expires|lose|cancelled|forfeited)",
        re.IGNORECASE,
    ),
    # "Only 2 slots left, pay now to confirm"
    re.compile(
        rf"(?:only|just)\s+\d+\s*(?:slots?|seats?|vacancies|openings?)\s+(?:left|remaining)\b.*?"
        rf"(?:pay|transfer|recharge|book|lock|grab)\s+now",
        re.IGNORECASE,
    ),
    # "Offer valid for next 15 minutes only"
    re.compile(
        rf"(?:offer|link|joining)\s+(?:is\s+)?valid\s+(?:for\s+)?(?:the\s+)?next\s+\d+\s*(?:mins?|minutes?)\s*only",
        re.IGNORECASE,
    ),
    # "Immediate payment required to secure position"
    re.compile(
        rf"\b(?:immediate|urgent)\s+(?:payment|transfer|recharge|deposit)\s+(?:is\s+)?required\b",
        re.IGNORECASE,
    ),
    # Hindi / Hinglish: "केवल 2 सीटें बाकी हैं, अभी ₹500 फीस जमा करें" / "Sirf 2 slots left, abhi transfer karo"
    re.compile(
        rf"(?:sirf|only|केवल|सिर्फ)\s+\d+\s*(?:seats?|slots?|jagah|सीटें?|स्लॉट|स्थान)\s+"
        rf"(?:bachi|baaki|remaining|left|बचे|बाकी)\s+(?:hai|hain|हैं?)?\b.*?"
        rf"(?:abhi|now|turant|अभी|तुरंत)\s+(?:{MONEY_REGEX}\s+)?(?:(?:fees?|शुल्क|चार्ज|फीस)\s+)?(?:pay|transfer|recharge|book|jama|पे|भुगतान|ट्रांसफर|बुक|जमा)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"\d+\s*(?:mins?|minutes?|minute|मिनट)\s+(?:me|ke\s+andar|के\s+अंदर)\s+"
        rf"(?:paise\s+bhejo|transfer|pay|jama|पैसे\s+भेजें|भुगतान\s+करें|ट्रांसफर\s+करें)(?:\s+(?:karo|kare|करें))?\s+"
        rf"(?:warna|otherwise|नहीं\s+तो|वरना)\s+(?:offer\s+cancel|offer\s+khatam|lose|ऑफर\s+रद्द|ऑफर\s+खत्म|मौका\s+छूट)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:offer|लिंक|ऑफर)\s+(?:sirf\s+|केवल\s+)?(?:agle\s+|अगले\s+)?\d+\s*(?:mins?|minutes?|मिनट)\s*(?:ke\s+liye\s+valid|के\s+लिए\s+वैध)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:turant|immediate|urgent|तुरंत)\s+(?:payment|transfer|paise|jama|भुगतान|पेमेंट)\s+(?:karo|required|की\s+आवश्यकता)",
        re.IGNORECASE,
    ),
]


def detect_urgency_pressure(text: str) -> Optional[IndicatorResult]:
    """Detect artificial time pressure and coercive urgency paired with financial action."""
    evidence_list: List[str] = []

    for pattern in URGENCY_PATTERNS:
        for match in pattern.finditer(text):
            if _is_negated(text, match.start(), match.end()):
                continue

            snippet = _extract_evidence_sentence(text, match.start(), match.end())
            if snippet and snippet not in evidence_list:
                evidence_list.append(snippet)

    if evidence_list:
        meta = INDICATOR_METADATA[IndicatorCategory.URGENCY_PRESSURE.value]
        return IndicatorResult(
            indicator=IndicatorCategory.URGENCY_PRESSURE.value,
            explanation=(
                "Employs coercive artificial urgency, countdown timers, or slot scarcity "
                "to rush financial transfers without allowing due diligence."
            ),
            evidence=evidence_list,
            severity=meta["severity"],
            rule_id="RULE_URGENCY_PRESSURE_05",
        )
    return None


# ---------------------------------------------------------------------------
# Rule 6: Sensitive Credentials / OTP Solicitation
# ---------------------------------------------------------------------------

SENSITIVE_CREDENTIALS_PATTERNS: List[Pattern[str]] = [
    # "Share the OTP sent to your phone", "share your OTP"
    re.compile(
        rf"(?:share|send|provide|give|forward|enter)\s+(?:(?:the|your|this|any)\s+)?(?:otp|one[\s-]time\s*password|verification\s*code)\b",
        re.IGNORECASE,
    ),
    # "Enter your UPI PIN to receive salary"
    re.compile(
        rf"(?:enter|share|provide)\s+(?:your\s+)?(?:upi\s*pin|atm\s*pin|debit\s*card\s*pin)\s+"
        rf"(?:to\s+(?:receive|claim|credit|accept)|for\s+(?:salary|payout))?",
        re.IGNORECASE,
    ),
    # "Share CVV / net banking password"
    re.compile(
        rf"(?:share|provide|send)\s+(?:your\s+)?(?:cvv|cvc|banking\s+password|net\s*banking\s+password|atm\s+card\s+number)",
        re.IGNORECASE,
    ),
    # "Install AnyDesk / TeamViewer / QuickSupport for verification"
    re.compile(
        rf"(?:install|download)\s+(?:anydesk|teamviewer|quicksupport|rustdesk)\s+"
        rf"(?:for|to\s+(?:complete|verify|setup))\s+(?:kyc|verification|salary|account)",
        re.IGNORECASE,
    ),
    # Hindi / Hinglish: "अपना ओटीपी साझा करें" / "Apna OTP share karo / bhejo"
    re.compile(
        rf"(?:share|send|batao|bhejo|dalo|enter|provide|साझा\s+करें|बताएं|भेजें|शेयर\s+करें|दर्ज\s+करें)\s+"
        rf"(?:(?:the|your|this|any|apna|अपना)\s+)?(?:otp|one[\s-]time\s*password|verification\s*code|ओटीपी|पासवर्ड)\b",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:apna|अपना)\s+(?:otp|password|upi\s*pin|pin|cvv|ओटीपी|पासवर्ड|पिन|यूपीआई\s+पिन|सीवीवी)(?:\s+(?:aur|and|या|और)\s+[\w\u0900-\u097f]+)?\s+"
        rf"(?:share\s+karo|bhejo|batao|send|enter|dalo|provide|साझा\s+करें|बताएं|भेजें|शेयर\s+करें|दर्ज\s+करें|दें)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:salary|payment|payout|payroll|वेतन|सैलरी|पेमेंट)\s+(?:pane|receive|activate|credit|सक्रिय|पाने)(?:\s+(?:karne|करने))?\s+(?:ke\s+liye|के\s+लिए)\s+"
        rf"(?:apna\s+|अपना\s+)?(?:upi\s*pin|pin|otp|password|यूपीआई\s+पिन|पिन|ओटीपी)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:kyc|verification|केवाईसी|सत्यापन)\s+(?:ke\s+liye|के\s+लिए)\s+"
        rf"(?:anydesk|teamviewer|quicksupport|एनीडेस्क|टीमव्यूअर)\s+(?:install|download|डाउनलोड|इन्स्टॉल)",
        re.IGNORECASE,
    ),
]


def detect_sensitive_credentials(text: str) -> Optional[IndicatorResult]:
    """Detect requests for authentication credentials, OTPs, PINs, or remote screen control."""
    evidence_list: List[str] = []

    for pattern in SENSITIVE_CREDENTIALS_PATTERNS:
        for match in pattern.finditer(text):
            if _is_negated(text, match.start(), match.end()):
                continue

            snippet = _extract_evidence_sentence(text, match.start(), match.end())
            if snippet and snippet not in evidence_list:
                evidence_list.append(snippet)

    if evidence_list:
        meta = INDICATOR_METADATA[IndicatorCategory.SENSITIVE_CREDENTIALS.value]
        return IndicatorResult(
            indicator=IndicatorCategory.SENSITIVE_CREDENTIALS.value,
            explanation=(
                "Demands OTPs, UPI PINs, CVVs, banking passwords, or remote access installation. "
                "Legitimate payroll setups require account numbers and routing/IFSC codes, never secret credentials."
            ),
            evidence=evidence_list,
            severity=meta["severity"],
            rule_id="RULE_SENSITIVE_CREDENTIALS_06",
        )
    return None


# ---------------------------------------------------------------------------
# Helper Rule: Advance Fee / Collateral Demand
# ---------------------------------------------------------------------------

ADVANCE_FEE_PATTERNS: List[Pattern[str]] = [
    # "Pay ₹3,000 refundable security deposit for laptop / equipment", "Send ₹500 as a refundable security deposit before joining"
    re.compile(
        rf"(?:pay|deposit|transfer|send)\s+(?:{MONEY_REGEX}\s+)?"
        rf"(?:as\s+(?:a\s+)?)?(?:refundable\s+)?(?:security\s+deposit|courier\s+charges?|shipping\s+fee|dispatch\s+fee)\s+"
        rf"(?:for|to\s+receive|before|prior\s+to)\s+(?:laptop|equipment|welcome\s+kit|offer\s+letter|materials|joining|starting|commencing)",
        re.IGNORECASE,
    ),
    # "Pay courier charges in advance"
    re.compile(
        rf"(?:pay|transfer|send|deposit)\s+(?:{MONEY_REGEX}\s+)?"
        rf"(?:(?:the\s+)?(?:courier|dispatch|shipping)\s+(?:charges?|fees?|costs?)|(?:as\s+(?:a\s+)?)?(?:refundable\s+)?security\s+deposit)\s*"
        rf"(?:in\s+advance|before\s+joining|prior\s+to\s+joining)?",
        re.IGNORECASE,
    ),
    # "Courier fee of Rs 500 must be paid in advance"
    re.compile(
        rf"\b(?:courier|dispatch|shipping|equipment\s+security)\s+(?:fee|fees|charges?|deposit)\s+"
        rf"(?:of\s+)?(?:{MONEY_REGEX}\s+)?(?:must\s+be\s+paid|in\s+advance)",
        re.IGNORECASE,
    ),
    # "Pay visa processing deposit before job offer"
    re.compile(
        rf"(?:pay|transfer)\s+(?:visa\s+processing|work\s+permit)\s+(?:fee|deposit)\s+in\s+advance",
        re.IGNORECASE,
    ),
    # Hindi / Hinglish: "लैपटॉप के लिए ₹3,000 सुरक्षा जमा का भुगतान करें" / "Laptop ke liye ₹3,000 security deposit dena hoga"
    re.compile(
        rf"(?:laptop|equipment|welcome\s+kit|लैपटॉप|उपकरण|सामग्री|किट)(?:\s+(?:aur|और)\s+[\w\u0900-\u097f]+)?\s+"
        rf"(?:prapt\s+karne\s+|प्राप्त\s+करने\s+)?(?:ke\s+liye|to\s+receive|के\s+लिए)\s+(?:{MONEY_REGEX}\s+)?"
        rf"(?:security\s+deposit|courier\s+charges?|deposit|सुरक्षा\s+जमा|सिक्योरिटी\s+डिपॉजिट|कूरियर\s+शुल्क)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:courier|shipping|dispatch|कूरियर|डिस्पैच|शिपिंग)\s+"
        rf"(?:charges?|fees?|fee|शुल्क|फीस|चार्ज)\s+"
        rf"(?:{MONEY_REGEX}\s+)?(?:pehle|advance\s+me|अग्रिम|पहले)\s+"
        rf"(?:pay\s+karo|bhejo|dena\s+padega|दें|भरें|जमा\s+करें)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:visa|work\s+permit|वीजा|वर्क\s+परमिट)\s+(?:processing|प्रोसेसिंग)\s+"
        rf"(?:ke\s+liye|के\s+लिए)\s+(?:{MONEY_REGEX}\s+)?(?:advance|deposit|pehle|जमा|अग्रिम)",
        re.IGNORECASE,
    ),
]


def detect_advance_fee(text: str) -> Optional[IndicatorResult]:
    """Detect miscellaneous advance fees such as equipment or courier deposits."""
    evidence_list: List[str] = []

    for pattern in ADVANCE_FEE_PATTERNS:
        for match in pattern.finditer(text):
            if _is_negated(text, match.start(), match.end()):
                continue

            snippet = _extract_evidence_sentence(text, match.start(), match.end())
            if snippet and snippet not in evidence_list:
                evidence_list.append(snippet)

    if evidence_list:
        meta = INDICATOR_METADATA[IndicatorCategory.ADVANCE_FEE.value]
        return IndicatorResult(
            indicator=IndicatorCategory.ADVANCE_FEE.value,
            explanation=(
                "Demands advance financial transfers for courier fees, equipment collateral, "
                "or visa processing before starting employment."
            ),
            evidence=evidence_list,
            severity=meta["severity"],
            rule_id="RULE_ADVANCE_FEE_07",
        )
    return None


# ---------------------------------------------------------------------------
# Composite Rule Evaluator
# ---------------------------------------------------------------------------

ALL_DETECTORS = (
    detect_withdrawal_block,
    detect_task_deposit,
    detect_registration_fee,
    detect_advance_fee,
    detect_unrealistic_earnings,
    detect_urgency_pressure,
    detect_sensitive_credentials,
)


def evaluate_rules(text: str) -> List[IndicatorResult]:
    """Run all deterministic rules against the given input text.

    Args:
        text: Raw text of the job description, message, or task invitation.

    Returns:
        A list of IndicatorResult instances containing detected indicators,
        supporting text evidence, and explanations.
    """
    if not text or not text.strip():
        return []

    results: List[IndicatorResult] = []
    for detector in ALL_DETECTORS:
        result = detector(text)
        if result is not None:
            results.append(result)

    return results
