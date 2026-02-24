from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import json
import math
import time
from typing import List
import traceback

from app.ml_service import MLService
from app.models import (
    DatasetInfo, TrainingRequest, PredictionRequest,
    TrainingProgress, PredictionResult, FeatureImportanceRequest
)

app = FastAPI(title="ML Training API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
        selected_features = request.get("selected_features", None)

        # Prepara i dati una volta sola
        await websocket.send_text(json.dumps({
            "status": "preparing",
            "message": "Preparing dataset..."
        }))

        X_train, X_test, y_train, y_test = ml_service.prepare_data(
            dataset, test_size, random_state, selected_features
        )
        
        # Allena ogni modello con progresso reale
        loop = asyncio.get_event_loop()
        for idx, model_name in enumerate(models):
            try:
                # Segnala inizio training
                await websocket.send_text(json.dumps({
                    "status": "training",
                    "model": model_name,
                    "progress": 0,
                    "metrics": None,
                    "message": f"Training {model_name}..."
                }))

                # Esegui train_model in un thread separato
                train_future = loop.run_in_executor(
                    None,
                    ml_service.train_model,
                    dataset, model_name, X_train, y_train, X_test, y_test, selected_features
                )

                # Manda aggiornamenti di progresso reali mentre il training gira
                # Curva asintotica: avanza veloce all'inizio, rallenta verso il 90%
                t_start = time.time()
                tau = 1.5  # costante di tempo — controlla la velocità della curva
                while not train_future.done():
                    elapsed = time.time() - t_start
                    progress = 90.0 * (1.0 - math.exp(-elapsed / tau))
                    await websocket.send_text(json.dumps({
                        "status": "training",
                        "model": model_name,
                        "progress": round(progress, 1),
                        "metrics": None,
                        "message": f"Training {model_name}... {progress:.0f}%"
                    }))
                    await asyncio.sleep(0.15)

                metrics = train_future.result()

                # Completato — salta a 100%
                await websocket.send_text(json.dumps({
                    "status": "completed",
                    "model": model_name,
                    "progress": 100,
                    "metrics": metrics,
                    "message": f"{model_name} completed"
                }))

                await asyncio.sleep(0.3)
            except Exception as e:
                print(f"Error training {model_name}: {str(e)}")
                traceback.print_exc()
                await websocket.send_text(json.dumps({
                    "status": "model_error",
                    "model": model_name,
                    "progress": 0,
                    "metrics": None,
                    "message": f"{model_name} failed: {str(e)}"
                }))
        
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

@app.post("/feature-importance")
async def feature_importance(request: FeatureImportanceRequest):
    """Restituisce feature importances per un modello trainato"""
    try:
        loop = asyncio.get_running_loop()
        importances = await loop.run_in_executor(
            None,
            ml_service.get_feature_importance,
            request.dataset,
            request.model_name
        )
        return {"feature_importances": importances}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────
#  Deep Spectrum MS endpoints  (flusso separato)
# ──────────────────────────────────────────────────────────────

from app.deep_spectrum_service import (
    get_library as ns_get_library,
    get_spectrum as ns_get_spectrum,
    get_embedding as ns_get_embedding,
    get_embeddings_3d as ns_get_embeddings_3d,
    get_all_embeddings as ns_get_all_embeddings,
    project_query_to_3d as ns_project_query_to_3d,
    list_libraries as ns_list_libraries,
    list_chromatograms as ns_list_chromatograms,
    get_chromatogram as ns_get_chromatogram,
    spectral_match as ns_spectral_match,
    spec2vec_match as ns_spec2vec_match,
    spec2vec_broad_match as ns_spec2vec_broad_match,
    start_build_broad_index as ns_start_build_broad_index,
    get_broad_index_status as ns_get_broad_index_status,
    anomaly_score as ns_anomaly_score,
    massbank_search as ns_massbank_search,
)

@app.get("/deep-spectrum/libraries")
def deep_spectrum_libraries():
    """Lista le librerie spettrali disponibili nella cartella datasets."""
    try:
        return ns_list_libraries()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/deep-spectrum/library")
def deep_spectrum_library():
    """Restituisce la libreria EFSA/Wageningen: 102 molecole PMT con metadata unificati."""
    try:
        return ns_get_library()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/deep-spectrum/embedding/{spectrum_id}")
def deep_spectrum_embedding(spectrum_id: int):
    """Restituisce il vettore 300-D (pseudo Spec2Vec) per una molecola."""
    try:
        return ns_get_embedding(spectrum_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/deep-spectrum/embeddings-3d")
def deep_spectrum_embeddings_3d():
    """Restituisce le coordinate PCA 3-D per tutte le 102 molecole."""
    try:
        return ns_get_embeddings_3d()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/deep-spectrum/spectrum/{spectrum_id}")
def deep_spectrum_spectrum(spectrum_id: int):
    """Restituisce il set di picchi MS2 completo per una molecola (per indice)."""
    try:
        return ns_get_spectrum(spectrum_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deep-spectrum/project-query-3d")
async def deep_spectrum_project_query_3d(request: Request):
    """
    Project one or more query MS2 spectra into the ECRFS PCA 3-D space.
    Body: { peaks: [{mz, intensity}], label?: str }
    Returns: { label, x, y, z }
    """
    try:
        body        = await request.json()
        query_peaks = body.get("peaks", [])
        label       = str(body.get("label", "Query"))
        loop        = asyncio.get_running_loop()
        result      = await loop.run_in_executor(
            None, lambda: ns_project_query_to_3d(query_peaks, label)
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/deep-spectrum/all-embeddings")
def deep_spectrum_all_embeddings():
    """Restituisce i vettori 300-D per tutte le 102 molecole (per similarity search lato client)."""
    try:
        return ns_get_all_embeddings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/deep-spectrum/chromatograms")
def deep_spectrum_list_chromatograms():
    """Lista i file cromatogramma JSON disponibili."""
    try:
        return ns_list_chromatograms()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/deep-spectrum/chromatogram/{filename}")
def deep_spectrum_get_chromatogram(filename: str):
    """Restituisce un cromatogramma JSON per filename."""
    try:
        return ns_get_chromatogram(filename)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deep-spectrum/spectral-match")
async def deep_spectrum_spectral_match(request: Request):
    """
    Real spectral matching via matchms ModifiedCosine.
    Body: { peaks: [{mz, intensity}], precursor_mz, tolerance?, top_n? }
    """
    try:
        body        = await request.json()
        query_peaks = body.get("peaks", [])
        precursor   = float(body.get("precursor_mz", 0.0))
        tolerance   = float(body.get("tolerance", 0.01))
        top_n       = int(body.get("top_n", 10))

        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None,
            lambda: ns_spectral_match(query_peaks, precursor, tolerance, top_n)
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deep-spectrum/anomaly-score")
async def deep_spectrum_anomaly_score(request: Request):
    """
    LOF-based anomaly detection in Spec2Vec embedding space.
    Body: { peaks: [{mz, intensity}] }
    """
    try:
        body        = await request.json()
        query_peaks = body.get("peaks", [])
        loop        = asyncio.get_running_loop()
        result      = await loop.run_in_executor(
            None, lambda: ns_anomaly_score(query_peaks)
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deep-spectrum/spec2vec-match")
async def deep_spectrum_spec2vec_match(request: Request):
    """
    Spec2Vec embedding similarity: cosine k-NN in 300-D embedding space.
    Body: { peaks: [{mz, intensity}], top_n? }
    """
    try:
        body        = await request.json()
        query_peaks = body.get("peaks", [])
        top_n       = int(body.get("top_n", 10))

        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None,
            lambda: ns_spec2vec_match(query_peaks, top_n)
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/deep-spectrum/broad-index-status")
def deep_spectrum_broad_index_status():
    """Returns the build state of the broad Spec2Vec index."""
    try:
        return ns_get_broad_index_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deep-spectrum/build-broad-index")
async def deep_spectrum_build_broad_index():
    """
    Start building the broad Spec2Vec index in the background (idempotent).
    Returns current status immediately; poll /broad-index-status for progress.
    """
    try:
        loop = asyncio.get_running_loop()
        status = await loop.run_in_executor(None, ns_start_build_broad_index)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deep-spectrum/spec2vec-broad-match")
async def deep_spectrum_spec2vec_broad_match(request: Request):
    """
    Spec2Vec similarity search against the broad MassBank index (~8-12k spectra).
    Body: { peaks: [{mz, intensity}], top_n? }
    Requires broad index to be built first.
    """
    try:
        body        = await request.json()
        query_peaks = body.get("peaks", [])
        top_n       = int(body.get("top_n", 10))

        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None,
            lambda: ns_spec2vec_broad_match(query_peaks, top_n)
        )
        return {"results": results}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deep-spectrum/massbank-search")
async def deep_spectrum_massbank_search(request: Request):
    """
    Global spectral identification via MassBank Europe (CosineGreedy similarity).
    Body: { peaks: [{mz, intensity}], precursor_mz, ion_mode?, threshold?, top_n? }
    """
    try:
        body        = await request.json()
        query_peaks = body.get("peaks", [])
        precursor   = float(body.get("precursor_mz", 0.0))
        ion_mode    = str(body.get("ion_mode", "POSITIVE"))
        threshold   = float(body.get("threshold", 0.5))
        top_n       = int(body.get("top_n", 5))

        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None,
            lambda: ns_massbank_search(query_peaks, precursor, ion_mode, threshold, top_n),
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────
#  DataFusion endpoints
# ──────────────────────────────────────────────────────────────

from app.datafusion_service import (
    parse_files as df_parse_files,
    get_file_info as df_get_file_info,
    apply_mapping as df_apply_mapping,
    detect_conflicts as df_detect_conflicts,
    merge_datasets as df_merge_datasets,
)


@app.post("/datafusion/info")
async def datafusion_info(request: Request):
    """
    Receive {files: [{name, content}]}, return metadata per file.
    """
    try:
        body = await request.json()
        files = body.get("files", [])
        loop = asyncio.get_running_loop()
        dfs = await loop.run_in_executor(None, lambda: df_parse_files(files))
        infos = [df_get_file_info(name, df) for name, df in dfs.items()]
        return {"files": infos}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/datafusion/merge")
async def datafusion_merge(request: Request):
    """
    Receive files + column_mapping + rules; return merged data + stats.
    If dry_run=true, returns conflict analysis without full merge.
    """
    try:
        body = await request.json()
        files = body.get("files", [])
        column_mapping = body.get("column_mapping", {})
        key_column = body.get("key_column", "")
        label_col = body.get("label_col", "")
        rules = body.get("rules", {})
        dry_run = bool(body.get("dry_run", False))

        loop = asyncio.get_running_loop()
        dfs = await loop.run_in_executor(None, lambda: df_parse_files(files))

        if column_mapping:
            dfs = await loop.run_in_executor(
                None, lambda: df_apply_mapping(dfs, column_mapping, key_column)
            )

        if dry_run:
            conflicts = await loop.run_in_executor(
                None, lambda: df_detect_conflicts(dfs, key_column, label_col)
            )
            result = await loop.run_in_executor(
                None,
                lambda: df_merge_datasets(dfs, key_column, label_col, rules, dry_run=True),
            )
            return {"conflicts": conflicts, "stats": result["stats"]}

        result = await loop.run_in_executor(
            None,
            lambda: df_merge_datasets(dfs, key_column, label_col, rules, dry_run=False),
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)