from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import json
from typing import List
import traceback

from app.ml_service import MLService
from app.models import (
    DatasetInfo, TrainingRequest, PredictionRequest,
    TrainingProgress, PredictionResult
)

app = FastAPI(title="ML Training API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service instance
ml_service = MLService()

@app.get("/")
def read_root():
    return {"message": "ML Training API is running"}

@app.get("/datasets", response_model=List[str])
def list_datasets():
    """Lista tutti i dataset disponibili"""
    try:
        datasets = ml_service.list_datasets()
        return datasets
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/datasets/{filename}", response_model=DatasetInfo)
def get_dataset_info(filename: str):
    """Ottieni informazioni su un dataset specifico"""
    try:
        info = ml_service.load_dataset(filename)
        return info
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Dataset not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models/{dataset}")
def get_trained_models(dataset: str):
    """Ottieni lista modelli trainati per un dataset"""
    try:
        models = ml_service.get_trained_models(dataset)
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/train")
async def train_models(websocket: WebSocket):
    """WebSocket per training in tempo reale"""
    await websocket.accept()
    
    try:
        # Ricevi richiesta di training
        data = await websocket.receive_text()
        request = json.loads(data)
        
        dataset = request["dataset"]
        models = request["models"]
        test_size = request.get("test_size", 0.2)
        random_state = request.get("random_state", 42)
        
        # Prepara i dati una volta sola
        await websocket.send_text(json.dumps({
            "status": "preparing",
            "message": "Preparing dataset..."
        }))
        
        X_train, X_test, y_train, y_test = ml_service.prepare_data(
            dataset, test_size, random_state
        )
        
        # Allena ogni modello con progresso individuale
        total_models = len(models)
        for idx, model_name in enumerate(models):
            # Simula progress progressivo per ogni modello (0-100%)
            steps = 20  # Numero di step di progresso
            metrics = None
            
            for step in range(steps + 1):
                progress_value = (step / steps) * 100
                
                # Esegui il training all'80% del progresso
                if step == int(steps * 0.8) and metrics is None:
                    metrics = ml_service.train_model(
                        dataset, model_name, X_train, y_train, X_test, y_test
                    )
                
                await websocket.send_text(json.dumps({
                    "status": "training" if step < steps else "completed",
                    "model": model_name,
                    "progress": progress_value,
                    "metrics": metrics if step == steps else None,
                    "message": f"Training {model_name}... {progress_value:.0f}%"
                }))
                
                # Pausa per animazione smooth
                await asyncio.sleep(0.08 if step < steps * 0.8 else 0.05)
            
            # Pausa tra modelli
            await asyncio.sleep(0.2)
        
        # Training completato
        await websocket.send_text(json.dumps({
            "status": "all_completed",
            "progress": 100,
            "message": "All models trained successfully"
        }))
        
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error during training: {str(e)}")
        traceback.print_exc()
        await websocket.send_text(json.dumps({
            "status": "error",
            "message": str(e)
        }))
    finally:
        await websocket.close()

@app.post("/predict")
async def predict(request: PredictionRequest):
    """Fa predizioni con un modello trainato"""
    try:
        results, metrics = ml_service.predict(request.dataset, request.model_name)
        
        return {
            "predictions": results,
            "metrics": metrics
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)