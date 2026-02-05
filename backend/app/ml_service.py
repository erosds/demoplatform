import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold, KFold
from sklearn.ensemble import (
    AdaBoostClassifier, AdaBoostRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
    RandomForestClassifier, RandomForestRegressor
)
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    confusion_matrix, mean_squared_error, mean_absolute_error, r2_score
)
from sklearn.preprocessing import LabelEncoder
import joblib
import os
from pathlib import Path
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
from typing import Dict, List, Tuple, Any

class MLService:
    def __init__(self):
        self.datasets_dir = Path("datasets")
        self.models_dir = Path("trained_models")
        self.models_dir.mkdir(exist_ok=True)
        
        # Modelli per classificazione
        self.classifier_classes = {
            "AdaBoost": AdaBoostClassifier,
            "Gradient Boosting": GradientBoostingClassifier,
            "Random Forest": RandomForestClassifier,
            "Decision Tree": DecisionTreeClassifier
        }
        
        # Modelli per regressione
        self.regressor_classes = {
            "AdaBoost": AdaBoostRegressor,
            "Gradient Boosting": GradientBoostingRegressor,
            "Random Forest": RandomForestRegressor,
            "Decision Tree": DecisionTreeRegressor
        }
        
        # Parametri ottimizzati per ogni modello
        self.classifier_params = {
            "AdaBoost": {
                "n_estimators": 100,  # numero di weak learners
                "learning_rate": 1.0,
                "random_state": 42
            },
            "Gradient Boosting": {
                "n_estimators": 100,
                "learning_rate": 0.1,
                "max_depth": 3,
                "random_state": 42
            },
            "Random Forest": {
                "n_estimators": 100,
                "max_depth": None,
                "min_samples_split": 2,
                "min_samples_leaf": 1,
                "random_state": 42,
                "n_jobs": -1  # usa tutti i core disponibili
            },
            "Decision Tree": {
                "max_depth": None,
                "min_samples_split": 2,
                "min_samples_leaf": 1,
                "random_state": 42
            }
        }
        
        self.regressor_params = {
            "AdaBoost": {
                "n_estimators": 100,
                "learning_rate": 1.0,
                "random_state": 42
            },
            "Gradient Boosting": {
                "n_estimators": 100,
                "learning_rate": 0.1,
                "max_depth": 3,
                "random_state": 42
            },
            "Random Forest": {
                "n_estimators": 100,
                "max_depth": None,
                "random_state": 42,
                "n_jobs": -1
            },
            "Decision Tree": {
                "max_depth": None,
                "random_state": 42
            }
        }
        
        self.trained_models = {}
        self.datasets_cache = {}
        
    def list_datasets(self) -> List[str]:
        """Lista tutti i dataset CSV nella cartella datasets"""
        datasets = []
        for file in self.datasets_dir.glob("*.csv"):
            datasets.append(file.name)
        return datasets
    
    def detect_task_type(self, y: np.ndarray) -> Tuple[str, int]:
        """
        Rileva automaticamente il tipo di task (classificazione o regressione)
        
        Returns:
            task_type: "classification" o "regression"
            n_classes: numero di classi (per classificazione) o None
        """
        # Controlla se il target è numerico continuo o categorico
        unique_values = np.unique(y)
        n_unique = len(unique_values)
        
        # Se ci sono pochi valori unici rispetto alla dimensione del dataset
        # E i valori sono interi o stringhe, allora è classificazione
        if n_unique < 20 or (n_unique / len(y) < 0.05):
            return "classification", n_unique
        
        # Altrimenti è regressione
        return "regression", None
    
    def load_dataset(self, filename: str) -> Dict[str, Any]:
        """Carica e analizza un dataset"""
        if filename in self.datasets_cache:
            return self.datasets_cache[filename]["info"]
            
        filepath = self.datasets_dir / filename
        df = pd.read_csv(filepath)
        
        # Assume che l'ultima colonna sia il target
        target_col = df.columns[-1]
        feature_cols = df.columns[:-1].tolist()
        
        # Rileva il tipo di task
        y = df[target_col].values
        task_type, n_classes = self.detect_task_type(y)
        
        # Calcola distribuzione delle classi (solo per classificazione)
        class_dist = {}
        if task_type == "classification":
            class_dist = df[target_col].value_counts().to_dict()
            class_dist = {str(k): int(v) for k, v in class_dist.items()}
        
        info = {
            "filename": filename,
            "rows": len(df),
            "columns": len(df.columns),
            "features": feature_cols,
            "target": target_col,
            "task_type": task_type,
            "n_classes": n_classes,
            "class_distribution": class_dist
        }
        
        self.datasets_cache[filename] = {
            "info": info,
            "data": df,
            "task_type": task_type
        }
        
        return info
    
    def prepare_data(self, filename: str, test_size: float, random_state: int) -> Tuple:
        """Prepara i dati per training e test"""
        if filename not in self.datasets_cache:
            self.load_dataset(filename)
        
        df = self.datasets_cache[filename]["data"]
        task_type = self.datasets_cache[filename]["task_type"]
        target_col = df.columns[-1]
        
        X = df.iloc[:, :-1].values
        y = df[target_col].values
        
        # Per classificazione, usa stratify
        stratify_param = y if task_type == "classification" else None
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, 
            test_size=test_size, 
            random_state=random_state, 
            stratify=stratify_param
        )
        
        return X_train, X_test, y_train, y_test, task_type
    
    def train_single_model(
        self, 
        dataset: str, 
        model_name: str, 
        X_train: np.ndarray, 
        y_train: np.ndarray, 
        X_test: np.ndarray, 
        y_test: np.ndarray,
        task_type: str,
        use_cross_validation: bool = True
    ) -> Dict[str, Any]:
        """
        Allena un singolo modello con parametri ottimizzati
        
        Args:
            use_cross_validation: se True, calcola anche CV score (5-fold)
        """
        # Seleziona la classe del modello in base al task type
        if task_type == "classification":
            ModelClass = self.classifier_classes[model_name]
            params = self.classifier_params[model_name].copy()
        else:
            ModelClass = self.regressor_classes[model_name]
            params = self.regressor_params[model_name].copy()
        
        # Crea e allena il modello
        model = ModelClass(**params)
        
        # Misura il tempo di training
        start_time = time.time()
        model.fit(X_train, y_train)
        training_time = time.time() - start_time
        
        # Predizioni
        y_pred_train = model.predict(X_train)
        y_pred_test = model.predict(X_test)
        
        # Calcola metriche in base al task type
        if task_type == "classification":
            metrics = self._compute_classification_metrics(
                y_train, y_pred_train, y_test, y_pred_test
            )
        else:
            metrics = self._compute_regression_metrics(
                y_train, y_pred_train, y_test, y_pred_test
            )
        
        # Cross-validation score (opzionale, più lento)
        cv_score = None
        if use_cross_validation:
            try:
                if task_type == "classification":
                    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
                    cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring='accuracy')
                else:
                    cv = KFold(n_splits=5, shuffle=True, random_state=42)
                    cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring='r2')
                
                cv_score = {
                    "mean": float(cv_scores.mean()),
                    "std": float(cv_scores.std()),
                    "scores": cv_scores.tolist()
                }
            except:
                pass  # Se CV fallisce, continua senza
        
        # Aggiungi informazioni sul training
        metrics.update({
            "training_time_seconds": round(training_time, 3),
            "n_train_samples": len(X_train),
            "n_test_samples": len(X_test),
            "cv_score": cv_score,
            "parameters": params
        })
        
        # Salva il modello
        model_key = f"{dataset}_{model_name.replace(' ', '_')}"
        model_path = self.models_dir / f"{model_key}.joblib"
        joblib.dump(model, model_path)
        
        # Salva anche i metadati
        metadata = {
            "dataset": dataset,
            "model_name": model_name,
            "task_type": task_type,
            "metrics": metrics,
            "feature_count": X_train.shape[1],
            "trained_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        metadata_path = self.models_dir / f"{model_key}_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        self.trained_models[model_key] = {
            "model": model,
            "metadata": metadata
        }
        
        return metrics
    
    def _compute_classification_metrics(
        self, 
        y_train: np.ndarray, 
        y_pred_train: np.ndarray,
        y_test: np.ndarray, 
        y_pred_test: np.ndarray
    ) -> Dict[str, float]:
        """Calcola metriche per classificazione"""
        # Converti labels in numerico per calcolare R²
        from sklearn.preprocessing import LabelEncoder
        le = LabelEncoder()
        y_test_numeric = le.fit_transform(y_test)
        y_pred_test_numeric = le.transform(y_pred_test)
        y_train_numeric = le.transform(y_train)
        y_pred_train_numeric = le.transform(y_pred_train)
        
        return {
            # Metriche su test set
            "accuracy": float(accuracy_score(y_test, y_pred_test)),
            "precision": float(precision_score(y_test, y_pred_test, average='weighted', zero_division=0)),
            "recall": float(recall_score(y_test, y_pred_test, average='weighted', zero_division=0)),
            "f1_score": float(f1_score(y_test, y_pred_test, average='weighted', zero_division=0)),
            
            # R² score (metrica supplementare per classificazione)
            # Nota: R² è più significativo per regressione, ma fornisce comunque
            # una misura della varianza spiegata anche per classificazione
            "r2_score": float(r2_score(y_test_numeric, y_pred_test_numeric)),
            
            # Metriche su training set (per rilevare overfitting)
            "train_accuracy": float(accuracy_score(y_train, y_pred_train)),
            "train_r2": float(r2_score(y_train_numeric, y_pred_train_numeric)),
            
            # Differenza train-test (indicatore di overfitting)
            "overfit_gap": float(accuracy_score(y_train, y_pred_train) - accuracy_score(y_test, y_pred_test))
        }
    
    def _compute_regression_metrics(
        self, 
        y_train: np.ndarray, 
        y_pred_train: np.ndarray,
        y_test: np.ndarray, 
        y_pred_test: np.ndarray
    ) -> Dict[str, float]:
        """Calcola metriche per regressione"""
        return {
            # Metriche su test set
            "r2_score": float(r2_score(y_test, y_pred_test)),
            "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred_test))),
            "mae": float(mean_absolute_error(y_test, y_pred_test)),
            "mse": float(mean_squared_error(y_test, y_pred_test)),
            
            # Metriche su training set
            "train_r2": float(r2_score(y_train, y_pred_train)),
            
            # Differenza train-test
            "overfit_gap": float(r2_score(y_train, y_pred_train) - r2_score(y_test, y_pred_test))
        }
    
    def train_models_parallel(
        self,
        dataset: str,
        model_names: List[str],
        test_size: float = 0.2,
        random_state: int = 42,
        max_workers: int = 4
    ) -> Dict[str, Dict[str, Any]]:
        """
        Allena più modelli in parallelo usando ThreadPoolExecutor
        
        Args:
            max_workers: numero massimo di thread paralleli
        
        Returns:
            dizionario {model_name: metrics}
        """
        # Prepara i dati una volta sola
        X_train, X_test, y_train, y_test, task_type = self.prepare_data(
            dataset, test_size, random_state
        )
        
        results = {}
        
        # Allena i modelli in parallelo
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Sottometti tutti i task
            future_to_model = {
                executor.submit(
                    self.train_single_model,
                    dataset, model_name, X_train, y_train, X_test, y_test, task_type
                ): model_name
                for model_name in model_names
            }
            
            # Raccogli i risultati man mano che completano
            for future in as_completed(future_to_model):
                model_name = future_to_model[future]
                try:
                    metrics = future.result()
                    results[model_name] = metrics
                except Exception as e:
                    print(f"Error training {model_name}: {str(e)}")
                    results[model_name] = {"error": str(e)}
        
        return results
    
    def train_model(
        self, 
        dataset: str, 
        model_name: str, 
        X_train: np.ndarray, 
        y_train: np.ndarray, 
        X_test: np.ndarray, 
        y_test: np.ndarray
    ) -> Dict[str, Any]:
        """
        Versione legacy per compatibilità con il WebSocket esistente
        """
        # Rileva task type
        task_type, _ = self.detect_task_type(y_train)
        
        return self.train_single_model(
            dataset, model_name, X_train, y_train, X_test, y_test, task_type,
            use_cross_validation=False  # Disabilita CV per velocità nel WebSocket
        )
    
    def predict(self, dataset: str, model_name: str) -> Tuple[List[Dict], Dict]:
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
        X_train, X_test, y_train, y_test, task_type = self.prepare_data(dataset, 0.2, 42)
        
        model = self.trained_models[model_key]["model"]
        y_pred = model.predict(X_test)
        
        # Crea risultati dettagliati
        results = []
        for i in range(len(y_test)):
            results.append({
                "sample_id": i,
                "true_value": str(y_test[i]),
                "predicted_value": str(y_pred[i]),
                "correct": bool(y_test[i] == y_pred[i]) if task_type == "classification" else None,
                "error": float(abs(y_test[i] - y_pred[i])) if task_type == "regression" else None
            })
        
        # Calcola metriche
        if task_type == "classification":
            metrics = {
                "accuracy": float(accuracy_score(y_test, y_pred)),
                "precision": float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
                "recall": float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
                "f1_score": float(f1_score(y_test, y_pred, average='weighted', zero_division=0)),
                "confusion_matrix": confusion_matrix(y_test, y_pred).tolist()
            }
        else:
            metrics = {
                "r2_score": float(r2_score(y_test, y_pred)),
                "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
                "mae": float(mean_absolute_error(y_test, y_pred)),
                "mse": float(mean_squared_error(y_test, y_pred))
            }
        
        return results, metrics
    
    def get_trained_models(self, dataset: str) -> List[Dict]:
        """Ottieni lista di modelli trainati per un dataset"""
        trained = []
        for file in self.models_dir.glob(f"{dataset}_*_metadata.json"):
            with open(file, 'r') as f:
                metadata = json.load(f)
                trained.append(metadata)
        return trained
    
    def compare_models(self, dataset: str) -> Dict[str, Any]:
        """
        Confronta tutti i modelli trainati per un dataset
        
        Returns:
            Dizionario con statistiche comparative e ranking
        """
        models_metadata = self.get_trained_models(dataset)
        
        if not models_metadata:
            return {"error": "No trained models found"}
        
        # Estrai le metriche chiave per il confronto
        task_type = models_metadata[0].get("task_type", "classification")
        
        if task_type == "classification":
            metric_key = "accuracy"
        else:
            metric_key = "r2_score"
        
        # Ordina per performance
        sorted_models = sorted(
            models_metadata,
            key=lambda x: x["metrics"].get(metric_key, 0),
            reverse=True
        )
        
        return {
            "task_type": task_type,
            "best_model": sorted_models[0]["model_name"],
            "models_ranking": [
                {
                    "model": m["model_name"],
                    "score": m["metrics"].get(metric_key),
                    "training_time": m["metrics"].get("training_time_seconds")
                }
                for m in sorted_models
            ]
        }