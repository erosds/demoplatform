import React, { useState, useEffect } from "react";

const API_URL = "http://localhost:8000";

const FeatureImportanceView = ({ dataset, trainedModels }) => {
  const [selectedModel, setSelectedModel] = useState("");
  const [featureImportances, setFeatureImportances] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (trainedModels.length > 0 && !selectedModel) {
      setSelectedModel(trainedModels[0]);
    }
  }, [trainedModels, selectedModel]);

  useEffect(() => {
    if (selectedModel && dataset) {
      fetchFeatureImportance();
    }
  }, [selectedModel, dataset]);

  const fetchFeatureImportance = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/feature-importance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          model_name: selectedModel,
        }),
      });

      const data = await response.json();
      setFeatureImportances(data.feature_importances);
    } catch (error) {
      console.error("Error fetching feature importances:", error);
    } finally {
      setLoading(false);
    }
  };

  if (trainedModels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-center">
          Please train at least one model first
        </div>
      </div>
    );
  }

  // Massimo valore per scalare le barre
  const maxImportance =
    featureImportances && featureImportances.length > 0
      ? featureImportances[0].importance
      : 1;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8 pt-32">
      {/* Model selector bar */}
      <div className="w-full max-w-4xl bg-[#1a1a1a] rounded p-2 flex flex-wrap gap-2 justify-center">
        {trainedModels.map((model) => {
          const isActive = selectedModel === model;
          return (
            <button
              key={model}
              onClick={() => setSelectedModel(model)}
              className={`
                px-6 py-3 rounded text-sm font-semibold transition-colors duration-150
                ${
                  isActive
                    ? "bg-cyan-600/20 text-cyan-400"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }
              `}
            >
              {model}
            </button>
          );
        })}
      </div>

      {/* Feature Importance card */}
      <div className="w-full max-w-4xl bg-[#1a1a1a] rounded p-8 flex flex-col overflow-hidden max-h-[calc(100vh-340px)]">
        {loading && (
          <div className="p-8">
            <div className="shimmer-effect h-40"></div>
          </div>
        )}

        {!loading && featureImportances && (
          <div className="flex-1 overflow-auto">
            <div className="flex flex-col gap-3">
              {featureImportances.map((item, idx) => {
                const pct = maxImportance > 0 ? (item.importance / maxImportance) * 100 : 0;
                const importancePct = (item.importance * 100).toFixed(1);

                return (
                  <div key={item.feature} className="flex items-center gap-4">
                    {/* Feature name */}
                    <div className="w-40 shrink-0 text-right">
                      <span className="text-sm text-gray-300 font-mono truncate block">
                        {item.feature}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 h-7 bg-[#0a0a0a] rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, #06b6d4 0%, #8b5cf6 ${Math.max(pct, 30)}%, #ec4899 100%)`,
                          opacity: 1 - idx * 0.03,
                        }}
                      />
                    </div>

                    {/* Percentage value */}
                    <div className="w-16 shrink-0 text-right">
                      <span className="text-sm font-semibold text-white font-mono">
                        {importancePct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeatureImportanceView;
