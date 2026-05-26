"""
Pure-Python heuristics for fake-review scoring and crowd-density prediction.

These are NOT ML models — they're $0, no-key, deterministic algorithms
that produce real-enough signals for staging + most production cases.
Real models (DistilBERT for fake-review, Prophet for crowd) swap in
later as drop-in adapters with the same wire contracts; the heuristics
remain as the fallback when those services are absent.

Honest framing: both heuristics are simple enough that an adversarial
reviewer can game them. They're a first line of defence; admin moderation
(`apps/web/src/app/admin/scam-reports/`) is the second.

Installed by [S-A4] + [S-A5] of the S-series real-functionality closeout.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime
from math import sqrt

# ───────────────────────────────────────────────────────────────────
# Fake-review scoring — heuristic
# ───────────────────────────────────────────────────────────────────


_GENERIC_PHRASES = (
    "best ever",
    "highly recommend",
    "great experience",
    "amazing place",
    "absolutely loved",
    "must visit",
    "five stars",
    "10/10",
    "perfect in every way",
    "highly recommended",
)


def score_review(body: str) -> tuple[float, list[str]]:
    """
    Score a review body for fakeness. Returns `(score, reasons[])` where
    score is in [0, 1] (0 = looks real, 1 = looks fake) and reasons are
    short human-readable strings the moderator can sanity-check.

    Heuristic features:
      - Body too short (<20 chars) → can't be a real review.
      - ALL-CAPS ratio too high → emotional spam.
      - Excess exclamation density → emotional spam.
      - Generic-phrase hits → likely templated.
      - Unicode-emoji density too high → review-farm pattern.

    Each feature contributes a fractional weight; the score is the sum
    capped at 1.0. At most 4 reasons are surfaced (matches the schema
    `reasons: max_length=4` constraint).
    """
    reasons: list[str] = []
    score = 0.0
    body = body.strip()
    length = len(body)

    # Empty / very short.
    if length == 0:
        return 1.0, ["empty body"]
    if length < 20:
        score += 0.40
        reasons.append("body too short")

    # ALL CAPS ratio.
    letters = sum(1 for c in body if c.isalpha())
    uppers = sum(1 for c in body if c.isupper())
    if letters >= 10 and uppers / letters > 0.5:
        score += 0.25
        reasons.append("excessive uppercase")

    # Exclamation density.
    excl = body.count("!")
    if length > 20 and excl / length > 0.10:
        score += 0.20
        reasons.append("excessive exclamation marks")

    # Generic phrases.
    lower = body.lower()
    generics = sum(1 for phrase in _GENERIC_PHRASES if phrase in lower)
    if generics >= 2:
        score += 0.30
        reasons.append(f"contains {generics} generic phrases")
    elif generics == 1 and length < 100:
        score += 0.15
        reasons.append("short body w/ generic phrase")

    # Emoji density (rough — count BMP-symbol + supplementary chars).
    emoji_re = re.compile(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]")
    emojis = len(emoji_re.findall(body))
    if length > 20 and emojis / max(length, 1) > 0.10:
        score += 0.20
        reasons.append("high emoji density")

    score = min(1.0, score)
    return score, reasons[:4]


def label_for_score(score: float) -> str:
    """Map a [0,1] score to the FakeReviewLabel enum string."""
    if score < 0.30:
        return "real"
    if score < 0.70:
        return "suspicious"
    return "fake"


# ───────────────────────────────────────────────────────────────────
# Crowd-density prediction — heuristic
# ───────────────────────────────────────────────────────────────────


def predict_crowd_density(
    place_id: str, timestamp: datetime, is_holiday: bool = False
) -> tuple[str, float, float]:
    """
    Predict crowd density at `place_id` for `timestamp`. Returns
    `(density, density_score, confidence)` where:

      - density is one of "empty" / "light" / "busy" / "packed"
      - density_score is the [0,1] value the density was bucketed from
      - confidence is the per-prediction confidence in [0,1]

    Heuristic:

      - Time-of-day curve (peak at lunch + dinner).
      - Weekend bump (Friday-Sunday).
      - Holiday bump.
      - Per-place variance (hash of placeId) so two identical-time slots
        at different places don't return identical scores.

    Confidence is a function of how far the score is from the bucket
    midpoint (more decisive answers = higher confidence). This is a
    smoke-test signal, not a calibrated probability.
    """
    dow = float(timestamp.weekday())  # Monday=0, Sunday=6
    hod = float(timestamp.hour + timestamp.minute / 60.0)

    # Time-of-day component — bell curves around lunch (13:00) + dinner (19:30).
    lunch = _bell(hod, peak=13.0, sigma=2.0, height=0.45)
    dinner = _bell(hod, peak=19.5, sigma=2.5, height=0.55)
    time_score = max(lunch, dinner)

    # Weekend bump.
    weekend_bump = 0.15 if dow >= 4 else 0.0  # Fri/Sat/Sun

    # Holiday bump.
    holiday_bump = 0.15 if is_holiday else 0.0

    # Per-place jitter (hash → [-0.05, 0.05]).
    h = hashlib.md5(place_id.encode("utf-8"), usedforsecurity=False).digest()[0]
    jitter = (h / 255.0 - 0.5) * 0.10

    raw = max(0.0, min(1.0, time_score + weekend_bump + holiday_bump + jitter))
    density = _density_for_score(raw)

    # Confidence: distance from nearest bucket boundary (0.25/0.50/0.75)
    # scaled into [0.3, 0.9]. Decisive midpoints score higher than fence-sitters.
    boundaries = (0.25, 0.50, 0.75)
    nearest = min(abs(raw - b) for b in boundaries)
    confidence = 0.30 + 0.60 * min(1.0, nearest * 4.0)

    return density, raw, confidence


def _bell(x: float, peak: float, sigma: float, height: float) -> float:
    """Gaussian bell — used to model time-of-day demand peaks."""
    from math import exp

    return height * exp(-((x - peak) ** 2) / (2.0 * sigma * sigma))


def _density_for_score(score: float) -> str:
    if score < 0.25:
        return "empty"
    if score < 0.50:
        return "light"
    if score < 0.75:
        return "busy"
    return "packed"


# expose sqrt so future calibration callers can find it without a circular import
__all__ = [
    "score_review",
    "label_for_score",
    "predict_crowd_density",
    "sqrt",
]
