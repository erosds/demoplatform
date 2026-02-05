import React, { useState, useEffect } from "react";

const API_URL = "http://localhost:8000";

const DatasetSelector = ({ onSelect, selectedDataset }) => {
  const [datasets, setDatasets] = useState([]);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingInfo, setLoadingInfo] = useState(false);

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await fetch(`${API_URL}/datasets`);
      const data = await response.json();
      setDatasets(data);
    } catch (error) {
      console.error("Error fetching datasets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDataset = async (filename) => {
    setLoadingInfo(true);
    setDatasetInfo(null);
    
    try {
      const response = await fetch(`${API_URL}/datasets/${filename}`);
      const info = await response.json();
      setDatasetInfo(info);
      onSelect(filename);
    } catch (error) {
      console.error("Error fetching dataset info:", error);
    } finally {
      setLoadingInfo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading datasets...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      {/* Dropdown per selezione dataset */}
      <div className="w-full max-w-md">
        <select
          value={selectedDataset || ""}
          onChange={(e) => handleSelectDataset(e.target.value)}
          className="w-full px-6 py-4 bg-[#1a1a1a] border border-gray-800 rounded-xl text-white text-lg focus:outline-none focus:border-cyan-500 transition-colors"
          disabled={datasets.length === 0}
        >
          <option value="" disabled>
            {datasets.length === 0 ? "No datasets available" : "Select a dataset"}
          </option>
          {datasets.map((dataset) => (
            <option key={dataset} value={dataset}>
              {dataset}
            </option>
          ))}
        </select>
      </div>

      {/* Info dataset */}
      {loadingInfo && (
        <div className="w-full max-w-4xl bg-[#1a1a1a] rounded-2xl p-8 border border-gray-900">
          <div className="shimmer-effect h-40"></div>
        </div>
      )}

      {datasetInfo && !loadingInfo && (
        <div className="w-full max-w-4xl bg-[#1a1a1a] rounded-2xl p-8 border border-gray-900">
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                {datasetInfo.rows.toLocaleString()}
              </div>
              <div className="text-gray-400 text-sm mt-2">Samples</div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {datasetInfo.features.length}
              </div>
              <div className="text-gray-400 text-sm mt-2">Features</div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {Object.keys(datasetInfo.class_distribution).length}
              </div>
              <div className="text-gray-400 text-sm mt-2">Classes</div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6">
            <h4 className="text-white font-semibold mb-3">Class Distribution</h4>
            <div className="flex flex-wrap gap-3">
              {Object.entries(datasetInfo.class_distribution).map(([label, count]) => (
                <div
                  key={label}
                  className="px-4 py-2 bg-[#0a0a0a] rounded-lg border border-gray-800"
                >
                  <span className="text-cyan-400 font-mono">{label}</span>
                  <span className="text-gray-500 mx-2">:</span>
                  <span className="text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatasetSelector;