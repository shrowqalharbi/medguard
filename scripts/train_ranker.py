#!/usr/bin/env python3
"""
Trains the alert-noise ranker's per-kind weights from a nurse survey.

Input:  docs/nurse-alert-survey.csv
        columns: kind, label_ar, real_example, override_frequency, typical_reason
        override_frequency is one of: نادراً | أحياناً | غالباً
Output: src/engine/model/weights.json

This is a single-feature logistic regression: each finding kind gets one
learned coefficient, the logit of how often nurses dismissed that kind of
alert as noise. `elderly` and `overrideRate` are demo priors, not derived
from the survey (they need per-event and per-nurse data the survey doesn't
collect). `allergy`, `allergy-from-note`, `renal-contraindicated` and
`expired` are always critical severity, so the ranker never actually scores
them — kept here at a fixed, clearly-noise-proof value for documentation.

Re-run after every nursing-team survey update:
    npm run train-ranker
"""
import csv
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SURVEY = ROOT / "docs/nurse-alert-survey.csv"
WEIGHTS = ROOT / "src/engine/model/weights.json"

# Frequency label -> point estimate of the override probability.
# Coarse on purpose: the survey asks nurses for a rough sense, not a percentage.
FREQUENCY_TO_RATE = {
    "نادراً": 0.12,
    "أحياناً": 0.40,
    "غالباً": 0.88,
}

# Never derived from the survey: these are demo priors, kept stable across runs.
ELDERLY_BIAS = -0.5  # 65+ patients: nurses give the same alert slightly more attention
OVERRIDE_RATE_COEFFICIENT = 1.5  # weight on this hospital's own live override history

# Always critical severity in the engine (checks.ts / noteAnalyzer.ts), so the ranker
# never scores them at runtime. Fixed here rather than learned.
FIXED_CRITICAL_KINDS = {
    "allergy-from-note": -3.0,
    "allergy": -4.0,
    "renal-contraindicated": -4.0,
    "expired": -4.0,
}


def logit(p: float) -> float:
    p = min(max(p, 0.01), 0.99)
    return round(math.log(p / (1 - p)), 3)


def read_survey(path: Path) -> dict[str, float]:
    rows = {}
    with open(path, newline="", encoding="utf-8") as f:
        lines = [ln for ln in f if not ln.lstrip().startswith("#")]
        for row in csv.DictReader(lines):
            freq = row["override_frequency"].strip()
            if freq not in FREQUENCY_TO_RATE:
                sys.exit(f"unknown override_frequency {freq!r} for kind {row['kind']!r} in {path}")
            rows[row["kind"].strip()] = FREQUENCY_TO_RATE[freq]
    return rows


def main() -> None:
    if not SURVEY.exists():
        sys.exit(f"missing {SURVEY} — see docs/nurse-alert-survey.csv for the expected shape")

    rates = read_survey(SURVEY)
    learned = {kind: logit(rate) for kind, rate in rates.items()}

    before = json.loads(WEIGHTS.read_text()) if WEIGHTS.exists() else {}
    kind_before = before.get("kind", {})

    weights = {
        "_note": (
            "Trained by scripts/train_ranker.py from docs/nurse-alert-survey.csv "
            "(placeholder nurse data until the nursing team's real survey is in — "
            "re-run the script once it lands)."
        ),
        "bias": 0.0,
        "kind": {**FIXED_CRITICAL_KINDS, **learned},
        "elderly": ELDERLY_BIAS,
        "overrideRate": OVERRIDE_RATE_COEFFICIENT,
    }
    WEIGHTS.write_text(json.dumps(weights, indent=2, ensure_ascii=False) + "\n")

    print(f"wrote {WEIGHTS.relative_to(ROOT)}\n")
    print(f"{'kind':<24}{'before':>8}{'after':>8}")
    for kind in sorted(set(kind_before) | set(learned)):
        b = kind_before.get(kind)
        a = weights["kind"].get(kind)
        print(f"{kind:<24}{b if b is not None else '—':>8}{a if a is not None else '—':>8}")


if __name__ == "__main__":
    main()
