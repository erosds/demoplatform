import React, { useState } from "react";
import { LuDownload, LuGitMerge } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

// ── CSV download helper ───────────────────────────────────────────────────────
function downloadCSV(data, filename = "merged_dataset.csv") {
  if (!data?.length) return;
  const cols = Object.keys(data[0]);
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = cols.join(",");
  const rows = data.map((row) => cols.map((c) => escape(row[c])).join(","));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main ─────────────────────────────────────────────────────────────────────
const ExportView = ({
  files,
  columnMapping,
  keyColumn,
  labelColumn,
  rules,
  mergedResult,
  setMergedResult,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [visibleRows, setVisibleRows] = useState(50);

  const handleMerge = async () => {
    setLoading(true);
    setError(null);
    setMergedResult(null);
    try {
      const payload = {
        files: files.map((f) => ({ name: f.name, content: f.content })),
        column_mapping: columnMapping,
        key_column: keyColumn ?? "",
        label_col: labelColumn ?? "",
        rules,
        dry_run: false,
      };
      const resp = await fetch(`${BACKEND}/datafusion/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const detail = await resp.text();
        throw new Error(`Server error ${resp.status}: ${detail}`);
      }
      setMergedResult(await resp.json());
      setVisibleRows(50);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (files.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-xs text-gray-600">No files loaded. Go back to Import.</div>
      </div>
    );
  }

  const data = mergedResult?.data ?? [];
  const stats = mergedResult?.stats;
  const cols = data.length > 0 ? Object.keys(data[0]) : [];
  const visible = data.slice(0, visibleRows);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-start px-12 overflow-y-auto no-scrollbar"
      style={{ paddingTop: "140px", paddingBottom: "100px" }}
    >
      <div className="w-full max-w-5xl flex flex-col gap-6">
        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleMerge}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-800/40 hover:bg-emerald-700/50 border border-emerald-700/40 rounded-lg text-xs text-emerald-300 transition-colors disabled:opacity-50"
          >
            <LuGitMerge className="w-4 h-4" />
            {loading ? "Merging…" : "Merge"}
          </button>

          {data.length > 0 && (
            <button
              onClick={() => downloadCSV(data)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
            >
              <LuDownload className="w-4 h-4" />
              Download CSV
            </button>
          )}
        </div>

        {error && <div className="text-xs text-red-500">{error}</div>}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Input rows",      value: stats.total_input },
              { label: "Output rows",     value: stats.total_output },
              { label: "Dupes removed",   value: stats.duplicates_removed },
              { label: "Conflicts flagged", value: stats.conflicts_found },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-[#0e0e0e] border border-gray-800 rounded-lg px-3 py-2 text-center"
              >
                <div className="text-base font-mono text-emerald-400">{value}</div>
                <div className="text-[9px] text-gray-600 uppercase tracking-widest mt-0.5">
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview table */}
        {data.length > 0 && (
          <div className="bg-[#0e0e0e] border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="text-[10px] text-gray-600 uppercase tracking-widest">
                Preview · {data.length} rows · {cols.length} columns
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-gray-700 uppercase tracking-widest text-[9px] border-b border-gray-800">
                    {cols.map((col) => (
                      <th
                        key={col}
                        className="text-left px-3 py-2 font-normal font-mono whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-t border-gray-800/40 ${
                        row._conflict ? "bg-red-900/10" : ""
                      }`}
                    >
                      {cols.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-1.5 text-gray-500 font-mono max-w-[200px] truncate"
                        >
                          {col === "_conflict" ? (
                            <span className={row[col] ? "text-red-400" : "text-gray-700"}>
                              {String(row[col])}
                            </span>
                          ) : (
                            String(row[col] ?? "")
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.length > visibleRows && (
              <div className="flex justify-center px-4 py-3 border-t border-gray-800">
                <button
                  onClick={() => setVisibleRows((n) => n + 50)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-400 transition-colors"
                >
                  Load more ({data.length - visibleRows} remaining)
                </button>
              </div>
            )}
          </div>
        )}

        {data.length === 0 && !loading && (
          <div className="text-[11px] text-gray-700 text-center mt-8">
            Click "Merge" to generate the unified dataset.
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportView;
