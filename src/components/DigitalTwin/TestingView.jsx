import React, { useState, useEffect } from "react";

const API_URL = "http://localhost:8000";

const TestingView = ({ dataset, trainedModels }) => {
  const [selectedModel, setSelectedModel] = useState("");
  const [predictions, setPredictions] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [displayedRows, setDisplayedRows] = useState(20);

  useEffect(() => {
    if (trainedModels.length > 0 && !selectedModel) {
      setSelectedModel(trainedModels[0]);
    }
  }, [trainedModels, selectedModel]);

  useEffect(() => {
    if (selectedModel && dataset) {
      fetchPredictions();
    }
  }, [selectedModel, dataset]);

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          model_name: selectedModel
        })
      });

      const data = await response.json();
      setPredictions(data.predictions);
      setMetrics(data.metrics);
    } catch (error) {
      console.error("Error fetching predictions:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    setDisplayedRows(prev => Math.min(prev + 20, predictions?.length || 0));
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

  return (
    <div className="flex flex-col h-full p-8">
      {/* Model selector tabs */}
      <div className="flex gap-2 mb-6">
        {trainedModels.map((model) => (
          <button
            key={model}
            onClick={() => setSelectedModel(model)}
            className={`
              px-6 py-3 rounded-lg text-sm font-semibold transition-all
              ${selectedModel === model
                ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white'
                : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-gray-800'
              }
            `}
          >
            {model}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="shimmer-effect w-full h-96"></div>
        </div>
      )}

      {!loading && metrics && predictions && (
        <>
          {/* Metrics - AGGIORNATO: 5 colonne con R² */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-900 text-center">
              <div className="text-3xl font-bold text-green-400">
                {(metrics.accuracy * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-2">Accuracy</div>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-900 text-center">
              <div className="text-3xl font-bold text-emerald-400">
                {(metrics.precision * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-2">Precision</div>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-900 text-center">
              <div className="text-3xl font-bold text-teal-400">
                {(metrics.recall * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-2">Recall</div>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-900 text-center">
              <div className="text-3xl font-bold text-cyan-400">
                {(metrics.f1_score * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-2">F1-Score</div>
            </div>

            {/* NUOVA COLONNA: R² Score */}
            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-gray-900 text-center">
              <div className="text-3xl font-bold text-blue-400">
                {(metrics.r2_score * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-2">R² Score</div>
            </div>
          </div>

          {/* Results table */}
          <div className="flex-1 bg-[#1a1a1a] rounded-xl border border-gray-900 overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="bg-[#0a0a0a] sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                      Sample ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                      True Value
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                      Predicted Value
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.slice(0, displayedRows).map((pred) => (
                    <tr
                      key={pred.sample_id}
                      className="border-b border-gray-800 hover:bg-[#0a0a0a] transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-300 font-mono">
                        {pred.sample_id}
                      </td>
                      <td className="px-4 py-3 text-sm text-white font-semibold">
                        {pred.true_value}
                      </td>
                      <td className="px-4 py-3 text-sm text-cyan-400 font-semibold">
                        {pred.predicted_value}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pred.correct !== null ? (
                          pred.correct ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                              ✓ Correct
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
                              ✗ Wrong
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-gray-500">
                            Error: {pred.error?.toFixed(3)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load more button */}
            {displayedRows < predictions.length && (
              <div className="p-4 border-t border-gray-800 text-center">
                <button
                  onClick={loadMore}
                  className="px-6 py-2 bg-gradient-to-r from-green-600 to-teal-600 rounded-lg text-white text-sm font-semibold hover:shadow-lg transition-all"
                >
                  Load More ({predictions.length - displayedRows} remaining)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TestingView;