# Personal Demo Space — Materials Informatics

A personal playground to collect and showcase interactive demos around materials informatics and related ML workflows. Built with React + Tailwind CSS, Python backend, horizontal scroll navigation, animated transitions.

## Demos

### MaterialsFlow — *materials informatics workflow*
Showing a demonstration of an end-to-end pipeline for accelerating material discovery: generate molecular candidates from chemical space, predict properties with ML/DL models, select top candidates by target criteria (conductivity, stability, toxicity, binding affinity), and validate through computational chemistry. Interactive SMILES rendering throughout.

### PredictLab — *testing station for predictive models*
Select a dataset, pick one or more classification models (AdaBoost, Gradient Boosting, Random Forest, Decision Tree), watch them train in real-time via WebSocket, then inspect predictions and feature importance.

### DeepSpectrum — *spectra matching with AI*
LC-MS/MS chromatogram analysis app in two phases: classical spectral matching (CosineGreedy against MassBank 20k+ spectra, ModifiedCosine against a curated local library), then AI-powered Spec2Vec embedding search that reaches structural analogues beyond fixed fragment lists. Side-by-side comparative results across all methods.

## Stack

| Frontend | Backend |
|---|---|
| React 19, Tailwind CSS | FastAPI, scikit-learn |
| smiles-drawer | WebSocket (live training) |
| | matchms, Spec2Vec |

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

## Controls

| Key | Action |
|---|---|
| ← → | Navigate sections |
| Esc | Back to home |
| Click dots/arrows | Jump to section |
