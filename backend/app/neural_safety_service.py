"""
Neural Safety MS — Backend Service
Parses EFSA/Wageningen ECRFS library:
  - ECRFS_library_final.mgf  → 102 MS2 spectra
  - ECRFS_metadata_final.csv → toxicological & chemical metadata
"""
import re
import csv
from pathlib import Path
from typing import List, Dict, Optional

DATASETS_DIR = Path(__file__).parent.parent / "datasets" / "neural_safety"
MGF_FILE = DATASETS_DIR / "ECRFS_library_final.mgf"
CSV_FILE  = DATASETS_DIR / "ECRFS_metadata_final.csv"

# In-memory caches (loaded once per process)
_spectra_cache: Optional[List[Dict]] = None
_csv_cache:     Optional[Dict[str, Dict]] = None
_library_cache: Optional[List[Dict]] = None


# ──────────────────────────────────────────────────────────────
#  Parsers
# ──────────────────────────────────────────────────────────────

def _parse_mgf() -> List[Dict]:
    """Read ECRFS_library_final.mgf and return a list of spectrum dicts."""
    spectra: List[Dict] = []

    with open(MGF_FILE, "r", encoding="utf-8", errors="replace") as fh:
        content = fh.read()

    blocks = re.split(r"BEGIN IONS", content)
    for block in blocks[1:]:
        end_idx = block.find("END IONS")
        if end_idx == -1:
            continue
        block = block[:end_idx].strip()

        spectrum: Dict = {"peaks": [], "metadata": {}}
        for line in block.splitlines():
            line = line.strip()
            if not line:
                continue

            # Peak line: two floating-point numbers separated by whitespace
            parts = line.split()
            if len(parts) == 2:
                try:
                    mz = float(parts[0])
                    intensity = float(parts[1])
                    spectrum["peaks"].append({"mz": mz, "intensity": intensity})
                    continue
                except ValueError:
                    pass

            # Metadata line: KEY=VALUE
            if "=" in line:
                key, _, value = line.partition("=")
                spectrum["metadata"][key.strip()] = value.strip()

        if spectrum["metadata"].get("NAME"):
            spectra.append(spectrum)

    return spectra


def _parse_csv() -> Dict[str, Dict]:
    """Read ECRFS_metadata_final.csv (semicolon-separated) keyed by lowercase name."""
    metadata: Dict[str, Dict] = {}
    with open(CSV_FILE, "r", encoding="utf-8-sig", errors="replace") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            name = (row.get("Name") or "").strip()
            if name:
                metadata[name.lower()] = {k.strip(): (v or "").strip() for k, v in row.items()}
    return metadata


def _strip_adduct(name: str) -> str:
    """Remove ion notation like '[M+H]+', '[M-H]-' from MGF compound names."""
    return re.sub(r"\s*\[M[+\-][^\]]+\][+\-]?\s*$", "", name).strip()


# ──────────────────────────────────────────────────────────────
#  Public API
# ──────────────────────────────────────────────────────────────

def get_library() -> List[Dict]:
    """
    Return merged library: MGF spectra + CSV metadata.
    Each item contains key fields for the Knowledge Base Explorer sidebar and info panel.
    """
    global _spectra_cache, _csv_cache, _library_cache

    if _library_cache is not None:
        return _library_cache

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()
    if _csv_cache is None:
        _csv_cache = _parse_csv()

    library: List[Dict] = []
    for i, spectrum in enumerate(_spectra_cache):
        meta = spectrum["metadata"]
        mgf_name   = meta.get("NAME", f"Unknown_{i}")
        clean_name = _strip_adduct(mgf_name)
        csv_row    = _csv_cache.get(clean_name.lower(), {})

        # CAS: prefer CSV, fall back to MGF NOTES field (3rd colon-separated token)
        cas = csv_row.get("CAS_RN", "N/A")
        if not cas or cas == "N/A":
            notes = meta.get("NOTES", "")
            tokens = notes.split(":")
            if len(tokens) >= 3:
                candidate = tokens[2].strip()
                if re.match(r"\d+-\d+-\d+", candidate):
                    cas = candidate

        tox_score    = csv_row.get("EFSA Tox Score", "N/A")
        tox_rel      = csv_row.get("Reliability of Tox Score", "N/A")
        tox_endpoint = csv_row.get("Endpoint for basis of scoring ", "N/A")  # trailing space in header
        if not tox_endpoint or tox_endpoint == "N/A":
            tox_endpoint = csv_row.get("Endpoint for basis of scoring", "N/A")

        rt_raw = csv_row.get("Retention_time", "N/A")

        # Retention time: MGF RTINSECONDS is reliable (in seconds)
        rt = meta.get("RTINSECONDS", "N/A")

        library.append({
            "id":              i,
            "name":            clean_name,
            "mgf_name":        mgf_name,
            "formula":         csv_row.get("Molecular Formula", meta.get("FORMULA", "N/A")),
            "exact_mass":      meta.get("EXACTMASS", "N/A"),
            "smiles":          meta.get("SMILES", csv_row.get("SMILES", "N/A")),
            "inchikey":        meta.get("INCHI", csv_row.get("StdInChIKey", "N/A")),
            "cas":             cas,
            "pubchem":         csv_row.get("PubChem", "N/A"),
            "tox_score":       tox_score,
            "tox_reliability": tox_rel,
            "tox_endpoint":    tox_endpoint,
            "retention_time":  rt,
            "ionmode":         meta.get("IONMODE", "N/A"),
            "instrument":      meta.get("SOURCE_INSTRUMENT", meta.get("INSTRUMENT", "N/A")),
            "activation":      meta.get("ACTIVATION", "N/A"),
            "spectrum_quality": meta.get("LIBRARYQUALITY", "N/A"),
            "peak_count":      len(spectrum["peaks"]),
        })

    _library_cache = library
    return library


# ──────────────────────────────────────────────────────────────
#  Embedding helpers (simulated Spec2Vec — PoC)
# ──────────────────────────────────────────────────────────────

_embeddings_3d_cache: Optional[List[Dict]] = None


def _gaussian_smooth(arr: "np.ndarray", sigma: float = 1.2) -> "np.ndarray":
    """1-D Gaussian smoothing using numpy only (no scipy required)."""
    import numpy as np
    radius = max(1, int(3 * sigma))
    x = np.arange(-radius, radius + 1, dtype=float)
    kernel = np.exp(-0.5 * (x / sigma) ** 2)
    kernel /= kernel.sum()
    return np.convolve(arr, kernel, mode="same")


def _spectrum_to_embedding(spectrum: Dict, dim: int = 300) -> "np.ndarray":
    """
    Convert a spectrum to a 300-D pseudo-embedding.
    Method: bin normalised intensities into `dim` m/z windows (30–1100 Da),
    apply light Gaussian smoothing, then L2-normalise.
    This mimics what real Spec2Vec produces — visually identical for a PoC.
    """
    import numpy as np

    peaks = spectrum["peaks"]
    if not peaks:
        return np.zeros(dim)

    mz_lo, mz_hi = 30.0, 1100.0
    bins = np.zeros(dim)
    max_i = max(p["intensity"] for p in peaks) or 1.0

    for p in peaks:
        if not (mz_lo <= p["mz"] <= mz_hi):
            continue
        idx = int((p["mz"] - mz_lo) / (mz_hi - mz_lo) * (dim - 1))
        idx = max(0, min(dim - 1, idx))
        val = p["intensity"] / max_i
        if val > bins[idx]:
            bins[idx] = val

    vec = _gaussian_smooth(bins, sigma=1.2)
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec = vec / norm
    return vec


def get_embedding(spectrum_id: int) -> Dict:
    """Return the 300-D pseudo-embedding for one spectrum."""
    import numpy as np
    global _spectra_cache

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()
    if spectrum_id < 0 or spectrum_id >= len(_spectra_cache):
        raise ValueError(f"Spectrum ID {spectrum_id} out of range")

    vec = _spectrum_to_embedding(_spectra_cache[spectrum_id])
    return {"embedding": vec.tolist(), "dimensions": int(vec.shape[0])}


def get_embeddings_3d() -> List[Dict]:
    """
    Return PCA-reduced 3-D coordinates for all 102 molecules.
    Cached after the first call.
    """
    import numpy as np
    global _spectra_cache, _embeddings_3d_cache

    if _embeddings_3d_cache is not None:
        return _embeddings_3d_cache

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()

    from sklearn.decomposition import PCA

    matrix = np.array([_spectrum_to_embedding(sp) for sp in _spectra_cache])
    pca = PCA(n_components=3, random_state=42)
    coords = pca.fit_transform(matrix)

    library = get_library()
    result: List[Dict] = []
    for i, (c, mol) in enumerate(zip(coords, library)):
        result.append({
            "id":        i,
            "name":      mol["name"],
            "formula":   mol["formula"],
            "tox_score": mol["tox_score"],
            "x":         float(c[0]),
            "y":         float(c[1]),
            "z":         float(c[2]),
        })

    _embeddings_3d_cache = result
    return result


def get_all_embeddings() -> List[Dict]:
    """Return {id, name, formula, tox_score, embedding} for all 102 molecules."""
    global _spectra_cache
    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()

    library = get_library()
    result = []
    for i, (sp, mol) in enumerate(zip(_spectra_cache, library)):
        import numpy as np
        vec = _spectrum_to_embedding(sp)
        result.append({
            "id":        i,
            "name":      mol["name"],
            "formula":   mol["formula"],
            "tox_score": mol["tox_score"],
            "embedding": vec.tolist(),
        })
    return result


def list_chromatograms() -> List[str]:
    """List all .json chromatogram files in the neural_safety dataset folder."""
    return [f.name for f in sorted(DATASETS_DIR.glob("*.json"))]


def get_chromatogram(filename: str) -> Dict:
    """Return the parsed chromatogram JSON for a given filename."""
    path = DATASETS_DIR / filename
    if not path.exists() or path.suffix != ".json":
        raise ValueError(f"Chromatogram '{filename}' not found")
    import json as _json
    with open(path, "r", encoding="utf-8") as fh:
        return _json.load(fh)


def get_spectrum(spectrum_id: int) -> Dict:
    """Return full peak list and raw metadata for a single spectrum by index."""
    global _spectra_cache

    if _spectra_cache is None:
        _spectra_cache = _parse_mgf()

    if spectrum_id < 0 or spectrum_id >= len(_spectra_cache):
        raise ValueError(f"Spectrum ID {spectrum_id} is out of range (0–{len(_spectra_cache)-1})")

    spectrum = _spectra_cache[spectrum_id]
    return {
        "peaks":    spectrum["peaks"],
        "metadata": spectrum["metadata"],
    }
