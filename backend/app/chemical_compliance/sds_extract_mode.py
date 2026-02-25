import re
from typing import Any, Dict, List, Optional


def extract_sds_data(text: str) -> Dict[str, Any]:
    """
    Extract structured SDS data from plain text using regex patterns.
    Returns a dict with CAS, hazard/precautionary statements, CLP classification,
    signal word, and exposure limits.
    """
    # CAS number
    cas_matches = re.findall(r'\b\d{2,7}-\d{2}-\d\b', text)
    cas = cas_matches[0] if cas_matches else None

    # Substance name: try to find "Substance:" or "Product name:" prefix
    name = None
    name_match = re.search(
        r'(?:substance\s*name|product\s*name|chemical\s*name)\s*[:\-]?\s*([^\n]+)',
        text, re.IGNORECASE
    )
    if name_match:
        name = name_match.group(1).strip()

    # Hazard statements: H codes
    hazard = list(dict.fromkeys(re.findall(r'\bH\d{3}[A-Z0-9]*\b', text)))

    # Precautionary statements: P codes
    precautionary = list(dict.fromkeys(re.findall(r'\bP\d{3}[A-Z0-9]*\b', text)))

    # Signal word
    signal_word = None
    sw_match = re.search(r'\b(Danger|Warning)\b', text, re.IGNORECASE)
    if sw_match:
        signal_word = sw_match.group(1).capitalize()

    # CLP / GHS classification categories
    clp_keywords = [
        "Flam. Liq.", "Acute Tox.", "Skin Irrit.", "Eye Dam.", "Eye Irrit.",
        "Skin Sens.", "Resp. Sens.", "Muta.", "Carc.", "Repr.", "STOT SE",
        "STOT RE", "Asp. Tox.", "Aquatic Chronic", "Aquatic Acute",
        "Ox. Liq.", "Ox. Sol.", "Expl.", "Self-react.", "Org. Perox.",
        "Press. Gas", "Self-heat.", "Pyr. Liq.", "Pyr. Sol.", "Water-react.",
        "Flam. Gas", "Flam. Sol.", "Flam. Aer.",
    ]
    clp = [kw for kw in clp_keywords if kw.lower() in text.lower()]

    # Exposure limits: OEL, TWA, STEL patterns
    oel_pattern = re.compile(
        r'(?:OEL|TWA|STEL|WEL|OSHA PEL|ACGIH TLV)[^\n]*?(\d+\.?\d*\s*(?:mg/m3|ppm|ppb|mg/L|µg/m3))',
        re.IGNORECASE,
    )
    exposure_limits = list(dict.fromkeys(
        m.group(0).strip() for m in oel_pattern.finditer(text)
    ))

    return {
        "cas": cas,
        "substance_name": name,
        "hazard_statements": hazard,
        "precautionary_statements": precautionary,
        "clp_classification": clp,
        "signal_word": signal_word,
        "exposure_limits": exposure_limits,
    }
