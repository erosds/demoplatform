import re
from typing import Any, Dict, List, Optional


def extract_parameters(text: str) -> Dict[str, float]:
    """
    Extract numeric parameters from CoA text.
    Handles patterns like:
      - "pH: 7.2"
      - "Assay: 99.5 %"
      - "Heavy Metals: 10 ppm"
      - Table-like: "Melting Point  | 120.3"
    Returns dict of {normalized_param_name: float_value}.
    """
    params: Dict[str, float] = {}

    # Pattern 1: "Name: value unit?" on a line
    pattern1 = re.compile(
        r'^([A-Za-z][A-Za-z0-9 \-/()]{1,50}?)\s*[:\|]\s*([+-]?\d+\.?\d*)',
        re.MULTILINE,
    )
    for m in pattern1.finditer(text):
        name = _normalize_param(m.group(1))
        val = float(m.group(2))
        if name not in params:
            params[name] = val

    # Pattern 2: "Name = value"
    pattern2 = re.compile(
        r'([A-Za-z][A-Za-z0-9 \-/()]{1,50}?)\s*=\s*([+-]?\d+\.?\d*)',
    )
    for m in pattern2.finditer(text):
        name = _normalize_param(m.group(1))
        val = float(m.group(2))
        if name not in params:
            params[name] = val

    return params


def _normalize_param(name: str) -> str:
    return re.sub(r'\s+', ' ', name.strip().lower())


def compare_coas(
    text1: str,
    text2: str,
    threshold: float = 5.0,
) -> Dict[str, Any]:
    """
    Compare two CoA documents. Returns per-parameter deviations and a summary.
    pct_deviation = abs(v1 - v2) / ((v1 + v2) / 2) * 100
    Flags if pct_deviation > threshold.
    Note: Never makes GMP decisions — technical commentary only.
    """
    params1 = extract_parameters(text1)
    params2 = extract_parameters(text2)

    shared = set(params1.keys()) & set(params2.keys())
    only1 = set(params1.keys()) - shared
    only2 = set(params2.keys()) - shared

    results = []

    for name in sorted(shared):
        v1 = params1[name]
        v2 = params2[name]
        mid = (v1 + v2) / 2
        if mid == 0:
            deviation = 0.0
        else:
            deviation = abs(v1 - v2) / mid * 100
        flagged = deviation > threshold
        results.append({
            "name": name,
            "val1": round(v1, 6),
            "val2": round(v2, 6),
            "deviation": round(deviation, 2),
            "flagged": flagged,
        })

    # Parameters only in file 1
    for name in sorted(only1):
        results.append({
            "name": name,
            "val1": round(params1[name], 6),
            "val2": None,
            "deviation": None,
            "flagged": True,
        })

    # Parameters only in file 2
    for name in sorted(only2):
        results.append({
            "name": name,
            "val1": None,
            "val2": round(params2[name], 6),
            "deviation": None,
            "flagged": True,
        })

    flagged_count = sum(1 for r in results if r["flagged"])
    total = len(results)

    summary_parts = [
        f"Compared {len(shared)} shared parameters between two CoA documents.",
        f"{flagged_count} of {total} parameters exceed the {threshold:.1f}% deviation threshold.",
    ]

    if only1:
        summary_parts.append(
            f"{len(only1)} parameter(s) present only in File A: {', '.join(sorted(only1)[:5])}."
        )
    if only2:
        summary_parts.append(
            f"{len(only2)} parameter(s) present only in File B: {', '.join(sorted(only2)[:5])}."
        )

    if flagged_count == 0:
        summary_parts.append("No significant deviations detected — technical values are consistent.")
    else:
        summary_parts.append(
            "Technical note: flagged deviations warrant review against specification limits. "
            "This report does not constitute a GMP release decision."
        )

    return {"parameters": results, "summary": " ".join(summary_parts)}
