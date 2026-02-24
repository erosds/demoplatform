import React, { useState, useRef, useCallback } from "react";
import { LuCloudUpload, LuX, LuTable2 } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

// ── File card ─────────────────────────────────────────────────────────────────
const FileCard = ({ file, onRemove }) => {
  const { info } = file;
  return (
    <div className="bg-[#0e0e0e] border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LuTable2 className="w-4 h-4 text-emerald-600" />
          <span className="text-sm text-gray-200 font-mono">{info.name}</span>
        </div>
        <button
          onClick={() => onRemove(info.name)}
          className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-900/40 transition-colors"
          title="Remove file"
        >
          <LuX className="w-3 h-3 text-gray-500" />
        </button>
      </div>

      <div className="flex gap-4 text-[10px] text-gray-600 uppercase tracking-widest mb-3">
        <span>{info.rows} rows</span>
        <span>·</span>
        <span>{info.columns.length} columns</span>
      </div>

      {/* Column tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {info.columns.map((col) => (
          <span
            key={col}
            className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-gray-500 font-mono"
          >
            {col}
          </span>
        ))}
      </div>

      {/* Preview */}
      {info.preview?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] text-gray-600">
            <thead>
              <tr>
                {info.columns.map((col) => (
                  <th
                    key={col}
                    className="text-left pr-4 pb-1 text-gray-700 font-mono font-normal border-b border-gray-800"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {info.preview.map((row, i) => (
                <tr key={i}>
                  {info.columns.map((col) => (
                    <td key={col} className="pr-4 py-1 font-mono truncate max-w-xs">
                      {String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Main ─────────────────────────────────────────────────────────────────────
const ImportView = ({ files, setFiles }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const processFiles = useCallback(
    async (rawFiles) => {
      setLoading(true);
      setError(null);
      try {
        // Read file contents
        const fileContents = await Promise.all(
          Array.from(rawFiles).map(
            (f) =>
              new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) =>
                  resolve({ name: f.name, content: e.target.result });
                reader.onerror = reject;
                reader.readAsText(f);
              })
          )
        );

        // Skip duplicates already loaded
        const existingNames = new Set(files.map((f) => f.name));
        const newContents = fileContents.filter((f) => !existingNames.has(f.name));
        if (newContents.length === 0) {
          setLoading(false);
          return;
        }

        const resp = await fetch(`${BACKEND}/datafusion/info`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: newContents }),
        });
        if (!resp.ok) {
          const detail = await resp.text();
          throw new Error(`Server error ${resp.status}: ${detail}`);
        }
        const { files: infos } = await resp.json();

        const merged = infos.map((info) => ({
          name: info.name,
          content: newContents.find((f) => f.name === info.name)?.content ?? "",
          info,
        }));

        setFiles((prev) => [...prev, ...merged]);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [files, setFiles]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleDragOver = (e) => e.preventDefault();

  const removeFile = (name) => setFiles((prev) => prev.filter((f) => f.name !== name));

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-start px-12 overflow-y-auto no-scrollbar"
      style={{ paddingTop: "140px", paddingBottom: "100px" }}
    >
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="w-full max-w-2xl border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center gap-3 py-10 px-6 cursor-pointer hover:border-emerald-700/70 transition-colors mb-8"
      >
        <LuCloudUpload className="w-8 h-8 text-gray-600" />
        <div className="text-sm text-gray-400">
          Drag & drop CSV files here, or{" "}
          <span className="text-emerald-500 underline underline-offset-2">browse</span>
        </div>
        <div className="text-[10px] text-gray-600 uppercase tracking-widest">
          Multiple files allowed · .csv only
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => e.target.files?.length > 0 && processFiles(e.target.files)}
        />
      </div>

      {loading && (
        <div className="text-xs text-emerald-500/70 animate-pulse mb-4">
          Parsing files…
        </div>
      )}
      {error && <div className="text-xs text-red-500 mb-4">{error}</div>}

      {files.length > 0 && (
        <div className="w-full max-w-2xl flex flex-col gap-4">
          {files.map((f) => (
            <FileCard key={f.name} file={f} onRemove={removeFile} />
          ))}
        </div>
      )}

      {files.length === 0 && !loading && (
        <div className="text-[11px] text-gray-700 mt-4">No files loaded yet.</div>
      )}
    </div>
  );
};

export default ImportView;
