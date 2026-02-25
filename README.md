# Demo Platform

Interactive demo platform showcasing four AI/ML workflows for scientific data analysis. Built with React + Tailwind CSS, Python backend, horizontal scroll navigation, animated transitions.

## Workflows

### 1. Materials Informatics — *AI-accelerated material discovery*

End-to-end pipeline: generate molecular candidates → predict properties with ML/DL models → select top candidates by target criteria (conductivity, stability, toxicity) → validate through computational chemistry.

The interactive grid renders real pharmaceutical SMILES (aspirin, ibuprofen, antibiotics, steroids, alkaloids) via `smiles-drawer`. Property scores are assigned and persisted in localStorage across the session.

> The generation, prediction and validation steps are UX-simulated (client-side with deliberate delays) — this tab is a conceptual walkthrough, not a live ML pipeline.

---

### 2. DeepSpectrum — *LC-MS/MS compound identification*

AI-powered compound identification from mass spectrometry data. Three algorithms are compared side by side.

#### Data sources

| File | Content |
|------|---------|
| `ECRFS_library_final.mgf` | 102 PMT compounds — MS/MS peaks + chemical metadata |
| `ECRFS_metadata_final.csv` | Toxicology enrichment (EFSA Tox Score, CAS, endpoint), joined by compound name |
| `GNPS_collection_pesticides.mgf` | 653 pesticide spectra from the GNPS public collection |
| MassBank Europe (remote) | ~20 000+ reference spectra, queried via REST |

The MGF file provides spectral data (m/z, intensity pairs) and analytical metadata (formula, SMILES, ion mode, retention time, instrument). The CSV enriches each compound with regulatory fields. The join is performed by compound name — case-insensitive, adduct notation stripped (e.g. `[M+H]+`).

#### Algorithms

**CosineGreedy** — used for global screening against MassBank Europe.

Compares spectra fragment-by-fragment within a fixed m/z tolerance window. Fast and reliable when spectra are clean and instruments are consistent. Degrades when fragmentation patterns vary across instruments or collision energies.

```
query:   [107.05, 145.06, 181.09]
library: [107.05, 145.06, 200.10]
          ✓ match  ✓ match  ✗ no match  →  score ∝ 2/3
```

**ModifiedCosine** — used for local library matching (via `matchms`).

Extends CosineGreedy by accounting for the precursor mass difference between query and reference. Useful when the same compound appears with different adducts or charge states. Still relies on direct peak overlap.

**Spec2Vec** — used for AI similarity search.

Word2Vec-style model trained on hundreds of thousands of GNPS spectra (Huber et al. 2021, Zenodo 4173596). Each peak becomes a token (`"peak@107.05"`). The spectrum embedding is computed as an intensity-weighted average of token vectors, then L2-normalised to a 300-dimensional unit vector:

```python
embedding = Σ (intensity^0.5 × word_vector["peak@mz"]) / Σ weights
embedding /= ||embedding||   # unit vector → dot product == cosine similarity
```

Similarity at query time:
```python
similarity = np.dot(query_vec, lib_vec)       # local library
similarities = broad_matrix @ query_vec       # MassBank broad index (matrix multiply)
```

**Why Spec2Vec over cosine methods?**

Cosine methods ask *"do you share the same fragments?"*. Spec2Vec asks *"does your spectrum look like spectra of structurally similar molecules?"* — the same distinction as lexical vs semantic search.

| Scenario | ModifiedCosine | Spec2Vec |
|----------|---------------|---------|
| Few peaks in common, similar structure | low score | high score |
| Same compound, different instrument | fragile | robust |
| Structural analogues / isomers | not detected | clustered in embedding space |
| Noisy or incomplete spectrum | penalised | more tolerant |

ModifiedCosine remains preferable for exact identity confirmation on high-quality, instrument-matched spectra. Spec2Vec is stronger for unknown or analogue discovery.

**Anomaly detection** — Local Outlier Factor (`sklearn`, `metric="cosine"`) fitted on the 102 ECRFS Spec2Vec embeddings. A query spectrum is scored by distance from the inlier distribution; novelty is normalised to [0, 1].

**3D visualisation** — PCA reduces the 300-D embeddings to 3 components (fitted once per library). Query spectra are projected into the same space, making structural proximity visually interpretable.

---

### 3. Digital Twin — *real-time ML training*

Real ML training pipeline on tabular datasets, with live progress streamed over WebSocket.

**Models:** Random Forest, Gradient Boosting, AdaBoost, Decision Tree, SVM, KNN, Naive Bayes, SGD.

**Flow:**
1. Select dataset → backend returns metadata (rows, features, class distribution, NaN counts)
2. Select models → `ws://localhost:8000/ws/train` opened; backend streams per-model progress events
3. Train/test split: 80/20. Metrics: Accuracy, Precision, Recall, F1, AUC-ROC, R², overfit gap (train − test accuracy), training time.

Feature importance is computed post-training and displayed as a ranked bar chart for column-level sensitivity analysis.

---

### 4. Data Fusion — *multi-source CSV harmonisation*

Data engineering pipeline to merge heterogeneous CSV files into a unified dataset ready for ML ingestion.

**Steps:**
1. **Import** — upload multiple CSVs, preview headers and row counts
2. **Align** — map heterogeneous column names to a canonical schema (e.g. `"SMILES_str"`, `"smiles"`, `"Smiles"` → `"SMILES"`)
3. **Resolve** — configure conflict strategies: case normalisation, duplicate handling (keep first / last / merge), key conflict policy
4. **Export** — download merged CSV

---

## Stack

| Frontend | Backend |
|---|---|
| React 19, Tailwind CSS | FastAPI, uvicorn |
| smiles-drawer | scikit-learn (classifiers, PCA, LOF) |
| SVG charts | matchms (CosineGreedy, ModifiedCosine) |
| | gensim (Spec2Vec KeyedVectors) |
| | WebSocket (live training stream) |

---

## Quick Start

```bash
# Frontend
npm install && npm start

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend: `http://localhost:3000` · Backend: `http://localhost:8000`

---

## Navigation

| Key | Action |
|---|---|
| ← → | Navigate sections |
| Esc | Back to home |
| Click dots / arrows | Jump to section |
