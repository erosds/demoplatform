import React, { useState, useEffect } from "react";
import { LuKey, LuTag, LuChevronDown } from "react-icons/lu";

// ── Inline dropdown ───────────────────────────────────────────────────────────
const ColDropdown = ({ value, options, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" style={{ minWidth: 180 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-black border border-gray-800 rounded-lg text-xs hover:border-gray-600 transition-colors"
      >
        <span className={value ? "text-gray-200 font-mono" : "text-gray-600"}>
          {value ?? placeholder}
        </span>
        <LuChevronDown
          className={`w-3 h-3 text-gray-600 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 w-full bg-[#0e0e0e] border border-gray-800 rounded-lg shadow-2xl max-h-44 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}
        >
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-white/5 border-b border-gray-800/40"
          >
            —
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs font-mono border-b border-gray-800/40 last:border-0 hover:bg-white/5 transition-colors ${
                opt === value ? "text-gray-100 bg-white/5" : "text-gray-500"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = ({ on, onToggle }) => (
  <button
    onClick={onToggle}
    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
      on ? "bg-emerald-700" : "bg-gray-800"
    }`}
  >
    <span
      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
        on ? "left-4" : "left-0.5"
      }`}
    />
  </button>
);

// ── Per-file mapping card ─────────────────────────────────────────────────────
const FileMappingCard = ({ file, mapping, onChange }) => {
  const handleRename = (col, newName) =>
    onChange({ ...mapping, [col]: newName });

  const handleToggle = (col) =>
    onChange({ ...mapping, [col]: mapping[col] === null ? col : null });

  return (
    <div className="bg-[#0e0e0e] border border-gray-800 rounded-xl p-5">
      <div className="text-xs font-mono text-emerald-600/80 mb-4">{file.name}</div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-gray-700 uppercase tracking-widest text-[9px]">
            <th className="text-left pb-2 font-normal w-5/12">Source column</th>
            <th className="text-left pb-2 font-normal w-5/12">Output name</th>
            <th className="text-left pb-2 font-normal w-2/12">Include</th>
          </tr>
        </thead>
        <tbody>
          {file.info.columns.map((col) => {
            const mapped = mapping[col];
            const included = mapped !== null && mapped !== undefined;
            return (
              <tr key={col} className={included ? "" : "opacity-40"}>
                <td className="pr-4 py-1.5 text-gray-500 font-mono">{col}</td>
                <td className="pr-4 py-1.5">
                  <input
                    type="text"
                    value={included ? (mapped ?? "") : ""}
                    disabled={!included}
                    onChange={(e) => handleRename(col, e.target.value)}
                    className="w-full bg-black border border-gray-800 rounded px-2 py-1 text-gray-300 font-mono text-[11px] focus:outline-none focus:border-gray-600 disabled:opacity-30 transition-colors"
                  />
                </td>
                <td className="py-1.5">
                  <Toggle on={included} onToggle={() => handleToggle(col)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── Main ─────────────────────────────────────────────────────────────────────
const ColumnMapper = ({
  files,
  columnMapping,
  setColumnMapping,
  keyColumn,
  setKeyColumn,
  labelColumn,
  setLabelColumn,
}) => {
  // Initialise identity mapping for any file that has no mapping yet
  useEffect(() => {
    if (files.length === 0) return;
    const additions = {};
    for (const f of files) {
      if (!columnMapping[f.name]) {
        const m = {};
        for (const col of f.info.columns) m[col] = col;
        additions[f.name] = m;
      }
    }
    if (Object.keys(additions).length > 0) {
      setColumnMapping((prev) => ({ ...prev, ...additions }));
    }
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps

  if (files.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-xs text-gray-600">No files loaded. Go back to Import.</div>
      </div>
    );
  }

  // Collect unique output column names for the key/label dropdowns
  const outputCols = Array.from(
    new Set(
      files.flatMap((f) =>
        Object.values(columnMapping[f.name] ?? {}).filter(
          (v) => v !== null && v !== ""
        )
      )
    )
  );

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-start px-12 overflow-y-auto no-scrollbar"
      style={{ paddingTop: "140px", paddingBottom: "100px" }}
    >
      <div className="w-full max-w-3xl flex flex-col gap-8">
        {/* Key + Label selectors */}
        <div className="bg-[#0e0e0e] border border-gray-800 rounded-xl p-5">
          <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-4">
            Schema configuration
          </div>
          <div className="flex items-start gap-8 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <LuKey className="w-3.5 h-3.5 text-emerald-600" />
                Key column (join field)
              </div>
              <ColDropdown
                value={keyColumn}
                options={outputCols}
                onChange={setKeyColumn}
                placeholder="Select key column…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <LuTag className="w-3.5 h-3.5 text-sky-500" />
                Label column
              </div>
              <ColDropdown
                value={labelColumn}
                options={outputCols}
                onChange={setLabelColumn}
                placeholder="Select label column…"
              />
            </div>
          </div>
        </div>

        {/* Per-file mappings */}
        {files.map((f) => (
          <FileMappingCard
            key={f.name}
            file={f}
            mapping={columnMapping[f.name] ?? {}}
            onChange={(m) =>
              setColumnMapping((prev) => ({ ...prev, [f.name]: m }))
            }
          />
        ))}
      </div>
    </div>
  );
};

export default ColumnMapper;
