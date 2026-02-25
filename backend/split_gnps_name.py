"""
Splits the NAME field in GNPS_collection_pesticides.mgf into three separate fields:
  NAME        = common name (es. "3-Hydroxycarbofuran")
  FORMULA     = molecular formula (es. "C12H15NO4")
  SYSTEMATIC  = systematic name without adduct (es. "3,7-Benzofurandiol, 2,3-dihydro-2,2-dimethyl-, 7-(methylcarbamate)")

Produces a new file: GNPS_collection_pesticides_split.mgf
"""

import re
from pathlib import Path

INPUT  = Path(__file__).parent / "datasets/deep_spectrum/GNPS_collection_pesticides.mgf"
OUTPUT = Path(__file__).parent / "datasets/deep_spectrum/GNPS_collection_pesticides_split.mgf"

# Adduct patterns at the end of the systematic name field
# e.g. " M+H", " M-H", " M-H2O+H", " M+Na", " M+2H", etc.
ADDUCT_RE = re.compile(r"\s+(M(?:[+-][A-Za-z0-9]+)+)\s*$")

total = 0
parsed = 0
failed = []

with INPUT.open("r", encoding="utf-8") as fin, OUTPUT.open("w", encoding="utf-8") as fout:
    for line in fin:
        if not line.startswith("NAME="):
            fout.write(line)
            continue

        total += 1
        raw = line[len("NAME="):].strip()

        # Split on underscore, max 2 splits → [common, formula, rest]
        parts = raw.split("_", 2)

        if len(parts) == 3:
            common, formula, rest = parts

            # Strip trailing adduct from systematic name
            systematic = ADDUCT_RE.sub("", rest).strip()

            fout.write(f"NAME={common}\n")
            fout.write(f"FORMULA={formula}\n")
            fout.write(f"SYSTEMATIC={systematic}\n")
            parsed += 1
        else:
            # Can't parse → keep original and report
            fout.write(line)
            failed.append(raw)

print(f"Spettri processati : {total}")
print(f"  Parsati OK       : {parsed}")
print(f"  Non parsati      : {len(failed)}")
if failed:
    print("\nRighe non parsate:")
    for r in failed:
        print(f"  {r}")

print(f"\nFile scritto: {OUTPUT}")
