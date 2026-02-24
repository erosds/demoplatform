import React, { useState } from "react";
import { LuTriangleAlert, LuCopy, LuShieldAlert, LuChevronDown } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

// ── Inline strategy selector ──────────────────────────────────────────────────
const StrategySelect = ({ label, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="flex items-center gap-3">
      <div className="text-[10px] text-gray-600 uppercase tracking-widest">{label}</div>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-1.5 bg-black border border-gray-800 rounded text-xs text-gray-300 hover:border-gray-600 transition-colors"
        >
          {current?.label ?? value}
          <LuChevronDown
            className={`w-3 h-3 text-gray-600 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div
            className="absolute z-50 mt-1 bg-[#0e0e0e] border border-gray-800 rounded shadow-2xl min-w-full"
            style={{ scrollbarWidth: "none" }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`block w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors whitespace-nowrap ${
                  opt.value === value ? "text-gray-100" : "text-gray-500"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Panel shell ───────────────────────────────────────────────────────────────
const ConflictPanel = ({ icon, title, badge, badgeColor, children }) => (
  <div className="bg-[#0e0e0e] border border-gray-800 rounded-xl p-5">
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <span className="text-xs font-semibold text-gray-300">{title}</span>
      {badge !== null && badge !== undefined && (
        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-mono ${badgeColor}`}>
          {badge}
        </span>
      )}
    </div>
    {children}
  </div>
);

// ── Main ─────────────────────────────────────────────────────────────────────
const ConflictResolver = ({
  files,
  columnMapping,
  keyColumn,
  labelColumn,
  rules,
  setRules,
  analysis,
  setAnalysis,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setRule = (key, val) => setRules((r) => ({ ...r, [key]: val }));

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        files: files.map((f) => ({ name: f.name, content: f.content })),
        column_mapping: columnMapping,
        key_column: keyColumn ?? "",
        label_col: labelColumn ?? "",
        rules,
        dry_run: true,
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
      setAnalysis(await resp.json());
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

  const conflicts = analysis?.conflicts;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-start px-12 overflow-y-auto no-scrollbar"
      style={{ paddingTop: "140px", paddingBottom: "100px" }}
    >
      <div className="w-full max-w-3xl flex flex-col gap-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-gray-600 uppercase tracking-widest">
            {files.length} file{files.length !== 1 ? "s" : ""} loaded
            {keyColumn && <> · key: <span className="text-gray-500 font-mono">{keyColumn}</span></>}
            {labelColumn && <> · label: <span className="text-gray-500 font-mono">{labelColumn}</span></>}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-4 py-2 bg-emerald-800/40 hover:bg-emerald-700/50 border border-emerald-700/40 rounded-lg text-xs text-emerald-300 transition-colors disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        {error && <div className="text-xs text-red-500">{error}</div>}

        {/* Stats row */}
        {analysis?.stats && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Input rows",    value: analysis.stats.total_input },
              { label: "Output rows",   value: analysis.stats.total_output },
              { label: "Duplicates",    value: analysis.stats.duplicates_removed },
              { label: "Conflicts",     value: analysis.stats.conflicts_found },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-[#0e0e0e] border border-gray-800 rounded-lg px-3 py-2 text-center"
              >
                <div className="text-base font-mono text-gray-200">{value}</div>
                <div className="text-[9px] text-gray-600 uppercase tracking-widest mt-0.5">
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Case Issues ── */}
        <ConflictPanel
          icon={<LuTriangleAlert className="w-4 h-4 text-amber-500" />}
          title="Case Issues"
          badge={conflicts?.case_issues?.length ?? null}
          badgeColor="bg-amber-900/40 text-amber-400"
        >
          {conflicts ? (
            conflicts.case_issues.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {conflicts.case_issues.slice(0, 8).map((issue) => (
                    <div
                      key={issue.lower}
                      className="flex items-center gap-1 bg-black border border-gray-800 rounded px-2 py-1 text-[10px] font-mono"
                    >
                      {issue.variants.map((v, i) => (
                        <span
                          key={i}
                          className={i === 0 ? "text-gray-400" : "text-amber-600"}
                        >
                          {i > 0 ? ` vs "${v}"` : `"${v}"`}
                        </span>
                      ))}
                    </div>
                  ))}
                  {conflicts.case_issues.length > 8 && (
                    <div className="text-[10px] text-gray-600 self-center">
                      +{conflicts.case_issues.length - 8} more
                    </div>
                  )}
                </div>
                <StrategySelect
                  label="Strategy"
                  value={rules.caseStrategy}
                  options={[
                    { value: "lowercase", label: "Lowercase all" },
                    { value: "uppercase", label: "Uppercase all" },
                    { value: "keep",      label: "Keep as-is" },
                  ]}
                  onChange={(v) => setRule("caseStrategy", v)}
                />
              </>
            ) : (
              <div className="text-[10px] text-gray-600 italic">No case issues found.</div>
            )
          ) : (
            <div className="text-[10px] text-gray-700 italic">Run Analyze to detect.</div>
          )}
        </ConflictPanel>

        {/* ── Exact Duplicates ── */}
        <ConflictPanel
          icon={<LuCopy className="w-4 h-4 text-blue-400" />}
          title="Exact Duplicates"
          badge={conflicts?.exact_duplicates ?? null}
          badgeColor="bg-blue-900/40 text-blue-400"
        >
          {conflicts ? (
            conflicts.exact_duplicates > 0 ? (
              <>
                <div className="text-[10px] text-gray-500 mb-4">
                  {conflicts.exact_duplicates} identical row
                  {conflicts.exact_duplicates !== 1 ? "s" : ""} detected.
                </div>
                <StrategySelect
                  label="Keep"
                  value={rules.duplicateStrategy}
                  options={[
                    { value: "first", label: "First occurrence" },
                    { value: "last",  label: "Last occurrence" },
                  ]}
                  onChange={(v) => setRule("duplicateStrategy", v)}
                />
              </>
            ) : (
              <div className="text-[10px] text-gray-600 italic">No exact duplicates found.</div>
            )
          ) : (
            <div className="text-[10px] text-gray-700 italic">Run Analyze to detect.</div>
          )}
        </ConflictPanel>

        {/* ── Key Conflicts ── */}
        <ConflictPanel
          icon={<LuShieldAlert className="w-4 h-4 text-red-400" />}
          title="Key Conflicts"
          badge={conflicts?.key_conflicts?.length ?? null}
          badgeColor="bg-red-900/40 text-red-400"
        >
          {conflicts ? (
            conflicts.key_conflicts.length > 0 ? (
              <>
                <div className="text-[10px] text-gray-600 mb-3">
                  Same key → different labels. Strategy:{" "}
                  <span className="text-red-400 font-mono">flag</span>
                  <span className="text-gray-700">
                    {" "}(adds <code className="text-gray-500">_conflict=True</code> for manual review)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] text-gray-600">
                    <thead>
                      <tr className="text-gray-700 uppercase tracking-widest text-[9px]">
                        <th className="text-left pb-1 pr-4 font-normal">Key</th>
                        <th className="text-left pb-1 font-normal">Conflicting labels</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conflicts.key_conflicts.slice(0, 10).map((kc) => (
                        <tr key={kc.key} className="border-t border-gray-800/40">
                          <td className="pr-4 py-1 font-mono text-gray-500 max-w-xs truncate">
                            {kc.key.substring(0, 30)}
                          </td>
                          <td className="py-1">
                            {kc.labels.map((l, i) => (
                              <span
                                key={i}
                                className="inline-block mr-1.5 px-1.5 py-0.5 bg-red-900/20 rounded text-red-400 font-mono text-[9px]"
                              >
                                {l}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {conflicts.key_conflicts.length > 10 && (
                    <div className="text-[9px] text-gray-700 mt-2">
                      +{conflicts.key_conflicts.length - 10} more conflicts
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-[10px] text-gray-600 italic">No key conflicts found.</div>
            )
          ) : (
            <div className="text-[10px] text-gray-700 italic">Run Analyze to detect.</div>
          )}
        </ConflictPanel>
      </div>
    </div>
  );
};

export default ConflictResolver;
