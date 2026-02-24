import io
from typing import List, Dict, Any, Optional

import pandas as pd
import numpy as np


# ──────────────────────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _safe_scalar(v: Any) -> Any:
    """Convert numpy/pandas scalar types to plain Python for JSON serialisation."""
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return None if np.isnan(v) else float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v


# ──────────────────────────────────────────────────────────────────────────────
#  Core functions
# ──────────────────────────────────────────────────────────────────────────────

def parse_files(files: List[Dict]) -> Dict[str, pd.DataFrame]:
    """Parse a list of {name, content} dicts into DataFrames keyed by filename."""
    result: Dict[str, pd.DataFrame] = {}
    for f in files:
        content = f.get("content", "")
        name = f.get("name", "unknown.csv")
        try:
            df = pd.read_csv(io.StringIO(content))
            result[name] = df
        except Exception as exc:
            raise ValueError(f"Failed to parse '{name}': {exc}") from exc
    return result


def get_file_info(name: str, df: pd.DataFrame) -> Dict:
    """Return metadata (rows, columns, 3-row preview) for a single DataFrame."""
    preview = df.head(3).fillna("").astype(str).to_dict(orient="records")
    return {
        "name": name,
        "rows": len(df),
        "columns": list(df.columns),
        "preview": preview,
    }


def apply_mapping(
    dfs: Dict[str, pd.DataFrame],
    column_mapping: Dict,
    key_column: str,
) -> Dict[str, pd.DataFrame]:
    """
    Rename / exclude columns according to per-file mappings.

    column_mapping shape: { filename: { original_col: new_col | null } }
    null  → exclude the column
    ""    → keep original name
    str   → rename to that string
    """
    result: Dict[str, pd.DataFrame] = {}
    for fname, df in dfs.items():
        mapping = column_mapping.get(fname)
        if not mapping:
            result[fname] = df
            continue

        keep: Dict[str, str] = {}
        for col in df.columns:
            mapped = mapping.get(col)
            if mapped is None:          # null → exclude
                continue
            keep[col] = mapped if mapped != "" else col

        result[fname] = df[list(keep.keys())].rename(columns=keep)
    return result


def normalize_case(df: pd.DataFrame, label_col: str, strategy: str) -> pd.DataFrame:
    """Normalise string case for the label column in-place (copy)."""
    df = df.copy()
    if label_col and label_col in df.columns and strategy != "keep":
        if strategy == "lowercase":
            df[label_col] = df[label_col].astype(str).str.lower()
        elif strategy == "uppercase":
            df[label_col] = df[label_col].astype(str).str.upper()
    return df


def detect_conflicts(
    dfs: Dict[str, pd.DataFrame],
    key_column: str,
    label_col: str,
) -> Dict:
    """
    Detect three categories of issues across the supplied DataFrames:
      - case_issues      : same label value with different capitalisation
      - exact_duplicates : fully identical rows
      - key_conflicts    : same key value mapped to different labels
    """
    # ── Case issues ───────────────────────────────────────────────────────────
    case_issues: List[Dict] = []
    all_labels: List[str] = []
    for df in dfs.values():
        if label_col and label_col in df.columns:
            all_labels.extend(df[label_col].dropna().astype(str).tolist())

    lower_map: Dict[str, set] = {}
    for v in all_labels:
        lower_map.setdefault(v.lower(), set()).add(v)

    for k, variants in lower_map.items():
        if len(variants) > 1:
            case_issues.append({"lower": k, "variants": sorted(variants)})

    # ── Concatenate all frames ────────────────────────────────────────────────
    combined = pd.concat(list(dfs.values()), ignore_index=True)

    # ── Exact duplicates ──────────────────────────────────────────────────────
    exact_dupes = int(combined.duplicated().sum())

    # ── Key conflicts ─────────────────────────────────────────────────────────
    key_conflicts: List[Dict] = []
    if (
        key_column and key_column in combined.columns
        and label_col and label_col in combined.columns
    ):
        grouped = (
            combined.groupby(key_column)[label_col]
            .apply(lambda x: sorted(set(x.dropna().astype(str).tolist())))
        )
        for key, labels in grouped.items():
            if len(labels) > 1:
                key_conflicts.append({"key": str(key), "labels": labels})

    return {
        "case_issues": case_issues[:20],
        "exact_duplicates": exact_dupes,
        "key_conflicts": key_conflicts[:50],
    }


def merge_datasets(
    dfs: Dict[str, pd.DataFrame],
    key_column: str,
    label_col: str,
    rules: Dict,
    dry_run: bool = False,
) -> Dict:
    """
    Merge all DataFrames applying the requested rules; return data + stats.

    rules:
      caseStrategy      : "lowercase" | "uppercase" | "keep"
      duplicateStrategy : "first" | "last"
      conflictStrategy  : "flag"  (always — adds _conflict column)
    """
    case_strategy = rules.get("caseStrategy", "lowercase")
    dup_strategy = rules.get("duplicateStrategy", "first")

    # ── Normalise case ────────────────────────────────────────────────────────
    normalized = {
        name: normalize_case(df, label_col, case_strategy)
        for name, df in dfs.items()
    }

    # ── Concatenate ───────────────────────────────────────────────────────────
    combined = pd.concat(list(normalized.values()), ignore_index=True)
    total_input = len(combined)

    # ── Remove exact duplicates ───────────────────────────────────────────────
    before_dedup = len(combined)
    if dup_strategy in ("first", "last"):
        combined = combined.drop_duplicates(keep=dup_strategy)
    duplicates_removed = before_dedup - len(combined)

    # ── Flag key conflicts ────────────────────────────────────────────────────
    conflicts_found = 0
    combined["_conflict"] = False
    if (
        key_column and key_column in combined.columns
        and label_col and label_col in combined.columns
    ):
        nunique = combined.groupby(key_column)[label_col].transform("nunique")
        combined["_conflict"] = (nunique > 1).astype(bool)
        conflicts_found = int(combined["_conflict"].sum())

    stats = {
        "total_input": total_input,
        "total_output": len(combined),
        "duplicates_removed": duplicates_removed,
        "conflicts_found": conflicts_found,
    }

    if dry_run:
        return {"stats": stats, "data": None}

    # ── Serialise to records ──────────────────────────────────────────────────
    records = []
    for row in combined.to_dict(orient="records"):
        records.append({k: _safe_scalar(v) for k, v in row.items()})

    return {"data": records, "stats": stats}
