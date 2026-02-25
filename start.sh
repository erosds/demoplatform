#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Avvio VideDemo ==="

# Qdrant (Docker)
echo "[1/3] Avvio Qdrant (Docker)..."
cd "$PROJECT_DIR"
docker compose up -d
echo "    Qdrant: http://localhost:6333"

# Backend (FastAPI)
echo "[2/3] Avvio backend FastAPI..."
cd "$PROJECT_DIR/backend"
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo "    Backend PID: $BACKEND_PID"

# Frontend (React)
echo "[3/3] Avvio frontend React..."
cd "$PROJECT_DIR"
npm start &
FRONTEND_PID=$!
echo "    Frontend PID: $FRONTEND_PID"

echo ""
echo "App in esecuzione:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  Qdrant:   http://localhost:6333"
echo ""
echo "Premi Ctrl+C per fermare tutto."

# Ferma backend e frontend all'uscita (Qdrant rimane attivo — usa 'docker compose down' per fermarlo)
trap "echo ''; echo 'Arresto...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
