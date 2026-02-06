import React, { useState, useEffect, useRef } from "react";

const API_URL = "http://localhost:8000";

/* ------------------------------------------------------------------ */
/* Custom Dropdown                                                    */
/* ------------------------------------------------------------------ */
const CustomDropdown = ({ options, value, onChange, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={`
          w-full px-6 py-4 bg-[#1a1a1a] rounded text-lg text-left
          flex items-center justify-between
          transition-colors duration-200 outline-none
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <span className={value ? "text-white" : "text-gray-500"}>
          {value || placeholder || "Select an option"}
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && options.length > 0 && (
        <div
          className="absolute z-50 mt-2 w-full bg-[#1a1a1a] rounded overflow-hidden shadow-2xl shadow-black/60"
          style={{ maxHeight: "240px", overflowY: "auto" }}
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className={`
                w-full px-6 py-3 text-left text-base transition-colors duration-150
                ${option === value
                  ? "bg-cyan-600/20 text-cyan-400"
                  : "text-gray-300 hover:bg-white/5 hover:text-white"
                }
              `}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* DatasetSelector                                                    */
/* ------------------------------------------------------------------ */
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

  const allColumns = datasetInfo ? [...datasetInfo.features, datasetInfo.target] : [];

  // Determina se mostrare il contenuto (info o loading)
  const hasContent = datasetInfo || loadingInfo;

  return (
    <div className="relative h-full w-full flex flex-col items-center justify-center overflow-y-auto no-scrollbar px-8">

      {/* Wrapper centrale: dropdown + info */}
      <div
        className="w-full max-w-4xl flex flex-col items-center transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1)"
        style={{
          // Sempre centrato verticalmente
          transform: `translateY(0)`,
        }}
      >
        <div className="w-full">
          <CustomDropdown
            options={datasets}
            value={selectedDataset}
            onChange={handleSelectDataset}
            placeholder={datasets.length === 0 ? "No datasets available" : "Select a dataset"}
            disabled={datasets.length === 0}
          />
        </div>

        {/* Contenitore info: mantiene le animazioni originali */}
        <div
          className={`w-full transition-all duration-700 delay-300 ${hasContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
            }`}
        >
          {loadingInfo && (
            <div className="w-full bg-[#1a1a1a] rounded p-8 mt-2">
              <div className="shimmer-effect h-40"></div>
            </div>
          )}

          {datasetInfo && !loadingInfo && (
            <div className="w-full bg-[#1a1a1a] rounded p-6 mt-2 shadow-2xl">
              {/* Metriche */}
              <div className="grid grid-cols-4 gap-6 mb-2">
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
                <div className="text-center">
                  <div className={`text-4xl font-bold ${datasetInfo.rows_with_nan > 0
                    ? "bg-gradient-to-r from-orange-500 to-red-500"
                    : "bg-gradient-to-r from-green-500 to-emerald-500"
                    } bg-clip-text text-transparent`}>
                    {datasetInfo.rows_with_nan.toLocaleString()}
                  </div>
                  <div className="text-gray-400 text-sm mt-2">Rows with NaN</div>
                </div>
              </div>

              {/* Preview */}
              {datasetInfo.preview && datasetInfo.preview.length > 0 && (
                <div className="pt-6 mt-2 overflow-x-auto rounded max-h-[400px]">
                  <h4 className="text-white font-semibold mb-2">Preview</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#0a0a0a]">
                        {allColumns.map((col) => (
                          <th
                            key={col}
                            className={`px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap ${col === datasetInfo.target ? "text-cyan-400 bg-cyan-600/10" : "text-gray-400"}`}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {datasetInfo.preview.map((row, rowIdx) => (
                        <tr key={rowIdx} className={`${rowIdx % 2 === 0 ? "bg-[#1a1a1a]" : "bg-[#141414]"} transition-colors`}>
                          {allColumns.map((col) => {
                            const val = row[col];
                            return (
                              <td key={col} className={`px-3 py-2 whitespace-nowrap font-mono text-xs ${col === datasetInfo.target ? "text-cyan-300 bg-cyan-600/5 font-semibold" : "text-gray-300"}`}>
                                {val === null || val === undefined ? "NaN" : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Class Distribution */}
              <div className="pt-6">
                <h4 className="text-white font-semibold mb-2">Class Distribution</h4>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(datasetInfo.class_distribution).map(([label, count]) => (
                    <div key={label} className="px-4 py-2 bg-[#0c0c0c] rounded">
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
      </div>
    </div>
  );
};

export default DatasetSelector;