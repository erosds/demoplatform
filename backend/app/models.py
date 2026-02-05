from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class DatasetInfo(BaseModel):
    filename: str
    rows: int
    columns: int
    features: List[str]
    target: str
    class_distribution: Dict[str, int]

class TrainingRequest(BaseModel):
    dataset: str
    models: List[str]
    test_size: float = 0.2
    random_state: int = 42

class PredictionRequest(BaseModel):
    dataset: str
    model_name: str

class TrainingProgress(BaseModel):
    model: str
    status: str
    progress: float
    metrics: Optional[Dict[str, Any]] = None
    
class PredictionResult(BaseModel):
    predictions: List[Dict[str, Any]]
    metrics: Dict[str, float]