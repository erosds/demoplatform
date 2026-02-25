import re
from typing import Any, Dict

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors, rdMolDescriptors
    _RDKIT_OK = True
except ImportError:
    _RDKIT_OK = False

_CAS_RE = re.compile(r'^\d{2,7}-\d{2}-\d$')
_FORMULA_RE = re.compile(r'^([A-Z][a-z]?\d*)+$')


def _result(valid: bool, value: Any = None, error: str = None) -> Dict[str, Any]:
    return {"valid": valid, "value": value, "error": error}


def validate_cas(cas: str) -> Dict[str, Any]:
    """Validate a CAS number using regex and checksum algorithm."""
    cas = cas.strip()
    if not _CAS_RE.match(cas):
        return _result(False, cas, "Invalid CAS format (expected XX-YY-Z)")

    digits = cas.replace("-", "")
    check = int(digits[-1])
    body = digits[:-1]
    total = sum((i + 1) * int(d) for i, d in enumerate(reversed(body)))
    expected = total % 10

    if check != expected:
        return _result(False, cas, f"CAS checksum mismatch (expected {expected}, got {check})")
    return _result(True, cas)


def parse_chemical_input(text: str) -> Dict[str, Any]:
    """Detect whether the input is a CAS number, molecular formula, or SMILES."""
    text = text.strip()
    if _CAS_RE.match(text):
        return _result(True, {"type": "cas", "value": text})
    if _FORMULA_RE.match(text):
        return _result(True, {"type": "formula", "value": text})
    # Assume SMILES otherwise
    return _result(True, {"type": "smiles", "value": text})


def validate_smiles(smiles: str) -> Dict[str, Any]:
    """Validate a SMILES string via RDKit."""
    if not _RDKIT_OK:
        return _result(False, smiles, "RDKit not installed — SMILES validation unavailable")
    mol = Chem.MolFromSmiles(smiles.strip())
    if mol is None:
        return _result(False, smiles, "Invalid SMILES string")
    return _result(True, smiles)


def validate_formula(formula: str) -> Dict[str, Any]:
    """Validate a molecular formula by attempting RDKit parse."""
    if not _RDKIT_OK:
        return _result(False, formula, "RDKit not installed — formula validation unavailable")
    if not _FORMULA_RE.match(formula.strip()):
        return _result(False, formula, "Formula does not match expected pattern")
    return _result(True, formula)


def compute_mw(smiles: str) -> Dict[str, Any]:
    """Compute molecular weight from a SMILES string."""
    if not _RDKIT_OK:
        return _result(False, None, "RDKit not installed")
    mol = Chem.MolFromSmiles(smiles.strip())
    if mol is None:
        return _result(False, None, "Invalid SMILES string")
    mw = round(Descriptors.MolWt(mol), 4)
    return _result(True, mw)


def normalize_name(name: str) -> Dict[str, Any]:
    """Lowercase and strip special characters from a chemical name."""
    normalized = re.sub(r'[^a-z0-9\s\-]', '', name.lower()).strip()
    return _result(True, normalized)
