# ProPresent

Interactive demo platform built with React + Tailwind CSS, featuring horizontal scroll navigation and animated transitions.

## Workflows

- **Materials Informatics** — Generate, predict, select and validate molecular candidates with interactive SMILES rendering
- **Digital Twin & ML** — Select datasets, train classification models (AdaBoost, Gradient Boosting, Random Forest, Decision Tree) via WebSocket, and evaluate predictions in real-time
- **Food & Beverage** — Coming soon

## Stack

| Frontend | Backend |
|---|---|
| React 19, Tailwind CSS 3 | FastAPI, scikit-learn |
| smiles-drawer | WebSocket (live training) |

## Quick Start

```bash
# Frontend
npm install && npm start

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# oppure 
python -m app.main
```

Frontend: `http://localhost:3000` · Backend: `http://localhost:8000`

## Project Structure

```
src/
├── components/
│   ├── HomePage.jsx              # Workflow selector
│   ├── TitleDisplay.js           # Animated title transitions
│   ├── NavigationDots.js         # Dot indicators
│   ├── NavigationArrows.js       # Arrow navigation
│   ├── MaterialsInformatics/
│   │   ├── InteractiveContent.js # Materials informatics orchestrator
│   │   ├── MoleculeRenderer.js   # SMILES → canvas rendering
│   │   ├── IndustriesContent.jsx # Industry cards
│   │   └── ImpactMetrics.jsx     # Animated KPI counters
│   └── DigitalTwin/
│       ├── DigitalTwinContent.jsx
│       ├── DatasetSelector.jsx
│       ├── ModelSelector.jsx
│       ├── TrainingView.jsx      # WebSocket training with live progress
│       └── FeatureImportanceView.jsx
├── data/
│   ├── workflowsData.js          # Workflow/section definitions
│   ├── sectionsData.js
│   └── moleculesData.js          # SMILES library
├── utils/
│   └── animationConfig.js        # Shared easing & animation helpers
└── App.js                        # Router + scroll engine

backend/
├── app/
│   ├── main.py                   # FastAPI + WebSocket endpoints
│   ├── ml_service.py             # Train/predict logic
│   └── models.py                 # Pydantic schemas
├── datasets/                     # CSV files
└── trained_models/               # Saved .joblib + metadata
```

## Controls

| Key | Action |
|---|---|
| ← → | Navigate sections |
| Esc | Back to home |
| Click dots/arrows | Jump to section |