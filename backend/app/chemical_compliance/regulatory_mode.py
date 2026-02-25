import re
from typing import Any, Dict, List, Tuple


def build_regulatory_filter():
    """Return a Qdrant Filter that restricts search to REGULATION documents."""
    try:
        from qdrant_client.http.models import Filter, FieldCondition, MatchValue
        return Filter(
            must=[FieldCondition(key="document_type", match=MatchValue(value="REGULATION"))]
        )
    except ImportError:
        return None


def apply_regulatory_constraints(
    chunks: List[Dict[str, Any]],
    answer: str,
    query: str,
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Enforce regulatory grounding rules:
    - Require ≥2 chunks from ≥2 distinct source files.
    - If not met: prepend a warning to the answer.
    - Check answer for numeric limits not found in chunks; flag if found.
    """
    unique_sources = list(set(c["source_file"] for c in chunks))
    n_unique = len(unique_sources)

    warnings = []

    if n_unique < 2:
        warnings.append(
            "⚠ WARNING: Regulatory answer based on fewer than 2 independent sources. "
            "Confidence is reduced. Verify with official regulatory databases."
        )

    # Check for numeric limits in answer that are absent in retrieved chunks
    limit_pattern = re.compile(r'\b(\d+\.?\d*)\s*(mg/[lLkK]g?|ppm|ppb|µg/[lLmM]|%)\b', re.IGNORECASE)
    answer_limits = set(m.group(0) for m in limit_pattern.finditer(answer))
    chunk_text = " ".join(c["text"] for c in chunks)
    chunk_limits = set(m.group(0) for m in limit_pattern.finditer(chunk_text))

    hallucinated = answer_limits - chunk_limits
    if hallucinated:
        warnings.append(
            f"⚠ NOTE: The following numeric limits appear in the answer but were not found "
            f"in retrieved documents and may not be grounded: {', '.join(sorted(hallucinated))}"
        )

    if warnings:
        answer = "\n".join(warnings) + "\n\n" + answer

    return answer, chunks
