import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import AdaBoostClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import joblib
import os
from pathlib import Path
import json

class MLService:
    def __init__(self):
        self.datasets_dir = Path("datasets")
        self.models_dir = Path("trained_models")
        self.models_dir.mkdir(exist_ok=True)
        
        self.model_classes = {
            "AdaBoost": AdaBoostClassifier,
            "Gradient Boosting": GradientBoostingClassifier,
            "Random Forest": RandomForestClassifier,
            "Decision Tree": DecisionTreeClassifier
        }
        
        self.trained_models = {}
        self.datasets_cache = {}
        
    def list_datasets(self):
        """Lista tutti i dataset CSV nella cartella datasets"""
        datasets = []
        for file in self.datasets_dir.glob("*.csv"):
            datasets.append(file.name)
        return datasets
    
    def load_dataset(self, filename: str):
        """Carica e analizza un dataset"""
        if filename in self.datasets_cache:
            return self.datasets_cache[filename]["info"]
            
        filepath = self.datasets_dir / filename
        df = pd.read_csv(filepath)
        
        # Assume che l'ultima colonna sia il target
        target_col = df.columns[-1]
        feature_cols = df.columns[:-1].tolist()
        
        # Calcola distribuzione delle classi
        class_dist = df[target_col].value_counts().to_dict()
        
        info = {
            "filename": filename,
            "rows": len(df),
            "columns": len(df.columns),
            "features": feature_cols,
            "target": target_col,
            "class_distribution": {str(k): int(v) for k, v in class_dist.items()}
        }
        
        self.datasets_cache[filename] = {
            "info": info,
            "data": df
        }
        
        return info
    
    def prepare_data(self, filename: str, test_size: float, random_state: int):
        """Prepara i dati per training e test - RESTITUISCE 4 VALORI"""
        if filename not in self.datasets_cache:
            self.load_dataset(filename)
        
        df = self.datasets_cache[filename]["data"]
        target_col = df.columns[-1]
        
        X = df.iloc[:, :-1].values
        y = df[target_col].values
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )
        
        # IMPORTANTE: Restituisce ESATTAMENTE 4 valori
        return X_train, X_test, y_train, y_test
    
    def train_model(self, dataset: str, model_name: str, X_train, y_train, X_test, y_test):
        """Allena un singolo modello"""
        ModelClass = self.model_classes[model_name]
        
        # Parametri ottimizzati per ciascun modello
        params = {
            "AdaBoost": {"n_estimators": 50, "random_state": 42},
            "Gradient Boosting": {"n_estimators": 100, "random_state": 42},
            "Random Forest": {"n_estimators": 100, "random_state": 42, "n_jobs": -1},
            "Decision Tree": {"random_state": 42}
        }
        
        model = ModelClass(**params[model_name])
        model.fit(X_train, y_train)
        
        # Valutazione
        y_pred = model.predict(X_test)
        
        metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
            "f1_score": float(f1_score(y_test, y_pred, average='weighted', zero_division=0))
        }
        
        # Salva il modello
        model_key = f"{dataset}_{model_name.replace(' ', '_')}"
        model_path = self.models_dir / f"{model_key}.joblib"
        joblib.dump(model, model_path)
        
        # Salva anche i metadati
        metadata = {
            "dataset": dataset,
            "model_name": model_name,
            "metrics": metrics,
            "feature_count": X_train.shape[1]
        }
        
        metadata_path = self.models_dir / f"{model_key}_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f)
        
        self.trained_models[model_key] = {
            "model": model,
            "metadata": metadata
        }
        
        return metrics
    
    def predict(self, dataset: str, model_name: str):
        """Usa un modello trainato per fare predizioni sul test set"""
        model_key = f"{dataset}_{model_name.replace(' ', '_')}"
        
        # Carica il modello se non in cache
        if model_key not in self.trained_models:
            model_path = self.models_dir / f"{model_key}.joblib"
            if not model_path.exists():
                raise ValueError(f"Model {model_key} not found. Train it first.")
            
            model = joblib.load(model_path)
            
            metadata_path = self.models_dir / f"{model_key}_metadata.json"
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            
            self.trained_models[model_key] = {
                "model": model,
                "metadata": metadata
            }
        
        # Prepara i dati (usa stesso random_state per consistenza)
        X_train, X_test, y_train, y_test = self.prepare_data(dataset, 0.2, 42)
        
        model = self.trained_models[model_key]["model"]
        y_pred = model.predict(X_test)
        
        # Crea risultati dettagliati
        results = []
        for i in range(len(y_test)):
            results.append({
                "sample_id": i,
                "true_value": str(y_test[i]),
                "predicted_value": str(y_pred[i]),
                "correct": bool(y_test[i] == y_pred[i])
            })
        
        # Calcola metriche
        metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
            "recall": float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
            "f1_score": float(f1_score(y_test, y_pred, average='weighted', zero_division=0)),
            "confusion_matrix": confusion_matrix(y_test, y_pred).tolist()
        }
        
        return results, metrics
    
    def get_trained_models(self, dataset: str):
        """Ottieni lista di modelli trainati per un dataset"""
        trained = []
        for file in self.models_dir.glob(f"{dataset}_*_metadata.json"):
            with open(file, 'r') as f:
                metadata = json.load(f)
                trained.append(metadata)
        return trained