import React, { useState, useEffect } from "react";

const API_URL = "http://localhost:8000";

const TestingView = ({ dataset, trainedModels }) => {
  const [selectedModel, setSelectedModel] = useState("");
  const [predictions, setPredictions] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [displayedRows, setDisplayedRows] = useState(5);

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

  const hasR2 = metrics?.r2_score !== null && metrics?.r2_score !== undefined;

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
          ${isActive
                  ? 'bg-cyan-600/20 text-cyan-400'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }
        `}
            >
              {model}
            </button>
          );
        })}
      </div>

      {/* Card principale — stessa estetica del DatasetSelector */}
      <div className="w-full max-w-4xl bg-[#1a1a1a] rounded p-8 flex flex-col overflow-hidden max-h-[calc(100vh-340px)]">

        {loading && (
          <div className="p-8">
            <div className="shimmer-effect h-40"></div>
          </div>
        )}

        {!loading && metrics && predictions && (
          <>
            {/* Metriche — dentro la card, sopra la tabella */}
            <div className={`grid ${hasR2 ? 'grid-cols-5' : 'grid-cols-4'} gap-6 mb-3`}>
              <div className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                  {(metrics.accuracy * 100).toFixed(1)}%
                </div>
                <div className="text-gray-400 text-sm mt-2">Accuracy</div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                  {(metrics.precision * 100).toFixed(1)}%
                </div>
                <div className="text-gray-400 text-sm mt-2">Precision</div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">
                  {(metrics.recall * 100).toFixed(1)}%
                </div>
                <div className="text-gray-400 text-sm mt-2">Recall</div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
                  {(metrics.f1_score * 100).toFixed(1)}%
                </div>
                <div className="text-gray-400 text-sm mt-2">F1-Score</div>
              </div>

              {hasR2 && (
                <div className="text-center">
                  <div className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
                    {(metrics.r2_score * 100).toFixed(1)}%
                  </div>
                  <div className="text-gray-400 text-sm mt-2">R² Score</div>
                </div>
              )}
            </div>

            {/* Tabella risultati */}
            <div className="pt-6 mt-3 flex-1 overflow-hidden rounded">
              <h4 className="text-white font-semibold mb-3">Results</h4>
              <div className="h-full overflow-auto rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#0a0a0a]">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-gray-400">
                        Sample ID
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-gray-400">
                        True Value
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-cyan-400 bg-cyan-600/10">
                        Predicted
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold uppercase whitespace-nowrap text-gray-400">
                        Result
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {predictions.slice(0, displayedRows).map((pred, rowIdx) => (
                      <tr
                        key={pred.sample_id}
                        className={`${rowIdx % 2 === 0 ? "bg-[#1a1a1a]" : "bg-[#141414]"} transition-colors`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-300">
                          {pred.sample_id}
                        </td>

                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-white font-semibold">
                          {pred.true_value}
                        </td>

                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-cyan-300 font-semibold bg-cyan-600/5">
                          {pred.predicted_value}
                        </td>

                        <td className="px-3 py-2 whitespace-nowrap text-center">
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
            </div>

            {/* Load more */}
            {displayedRows < predictions.length && (
              <div className="p-4 text-center">
                <button
                  onClick={loadMore}
                  className="px-6 py-2 bg-gradient-to-r from-green-600 to-teal-600 rounded-lg text-white text-sm font-semibold hover:shadow-lg transition-all"
                >
                  Load More ({predictions.length - displayedRows} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div >
  );
};

export default TestingView;