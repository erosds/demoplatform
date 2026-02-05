import React, { useState, useEffect, useRef } from "react";

const API_URL = "http://localhost:8000";

const TrainingView = ({ dataset, selectedModels, onTrainingComplete }) => {
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState({});
  const [completedModels, setCompletedModels] = useState([]);
  const wsRef = useRef(null);

  const canTrain = dataset && selectedModels.length > 0 && !isTraining;

  const startTraining = () => {
    if (!canTrain) return;

    setIsTraining(true);
    setTrainingProgress({});
    setCompletedModels([]);

    // Inizializza il progresso a 0 per tutti i modelli
    const initialProgress = {};
    selectedModels.forEach(model => {
      initialProgress[model] = {
        progress: 0,
        metrics: null,
        status: "pending"
      };
    });
    setTrainingProgress(initialProgress);

    // WebSocket connection
    const ws = new WebSocket(`ws://localhost:8000/ws/train`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Invia richiesta di training
      ws.send(JSON.stringify({
        dataset,
        models: selectedModels,
        test_size: 0.2,
        random_state: 42
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.status === "training" || data.status === "completed") {
        setTrainingProgress(prev => ({
          ...prev,
          [data.model]: {
            progress: data.progress,
            metrics: data.metrics || prev[data.model]?.metrics,
            status: data.status
          }
        }));

        if (data.status === "completed") {
          setCompletedModels(prev => [...prev, data.model]);
        }
      }

      if (data.status === "all_completed") {
        setIsTraining(false);
        onTrainingComplete(true);
      }

      if (data.status === "error") {
        console.error("Training error:", data.message);
        setIsTraining(false);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsTraining(false);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      {/* Pulsante Start Training */}
      <button
        onClick={startTraining}
        disabled={!canTrain}
        className={`
          px-12 py-6 rounded-xl text-white text-2xl font-semibold
          bg-gradient-to-r from-purple-600 via-pink-600 to-red-600
          hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300
          ${!canTrain ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
        `}
      >
        {isTraining ? "Training..." : "Start Training"}
      </button>

      {/* Progress per ogni modello */}
      {selectedModels.length > 0 && (
        <div className="w-full max-w-4xl space-y-4">
          {selectedModels.map((modelName) => {
            const progress = trainingProgress[modelName];
            const isCompleted = completedModels.includes(modelName);
            const currentProgress = progress?.progress || 0;

            return (
              <div
                key={modelName}
                className="bg-[#1a1a1a] rounded-xl p-6 border border-gray-900"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-white">{modelName}</h3>
                    <span className="text-sm text-gray-400 font-mono">
                      {currentProgress.toFixed(0)}%
                    </span>
                  </div>
                  
                  {isCompleted && (
                    <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Progress bar */}
                <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden mb-4">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300 ease-out"
                    style={{ width: `${currentProgress}%` }}
                  />
                </div>

                {/* Metrics */}
                {progress?.metrics && (
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {(progress.metrics.accuracy * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Accuracy</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-pink-400">
                        {(progress.metrics.precision * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Precision</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {(progress.metrics.recall * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Recall</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-cyan-400">
                        {(progress.metrics.f1_score * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">F1-Score</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!dataset && (
        <div className="text-gray-500 text-center">
          Please select a dataset and models first
        </div>
      )}
    </div>
  );
};

export default TrainingView;