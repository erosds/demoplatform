import { useState, useEffect, useRef } from "react";
import { LuActivity, LuSearch, LuDatabase, LuFlaskConical } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

// ─── Cosine similarity (JS, mirrors backend embedding logic incl. smoothing) ─
const MZ_LO = 30, MZ_HI = 1100, DIM = 300;

function gaussianSmooth(arr, sigma = 1.2) {
  const radius = Math.max(1, Math.floor(3 * sigma));
  const kernel = [];
  let ksum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-0.5 * (i / sigma) ** 2);
    kernel.push(v);
    ksum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= ksum;
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let val = 0;
    for (let k = 0; k < kernel.length; k++) {
      const j = i + k - radius;
      if (j >= 0 && j < arr.length) val += arr[j] * kernel[k];
    }
    out[i] = val;
  }
  return out;
}

function peaksToVector(peaks) {
  const bins = new Float64Array(DIM);
  const maxI = Math.max(...peaks.map((p) => p.intensity));
  if (!maxI) return bins;
  peaks.forEach((p) => {
    if (p.mz < MZ_LO || p.mz > MZ_HI) return;
    const idx = Math.min(DIM - 1, Math.floor((p.mz - MZ_LO) / (MZ_HI - MZ_LO) * (DIM - 1)));
    const val = p.intensity / maxI;
    if (val > bins[idx]) bins[idx] = val;
  });
  const smoothed = gaussianSmooth(bins);
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += smoothed[i] * smoothed[i];
  norm = Math.sqrt(norm);
  return norm > 0 ? smoothed.map((v) => v / norm) : smoothed;
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  for (let i = 0; i < DIM; i++) dot += vecA[i] * vecB[i];
  return Math.max(0, Math.min(1, dot));
}

// ─── Color helpers ──────────────────────────────────────────────────────────
function toxHex(score) {
  if (!score || score === "N/A") return "#6b7280";
  const n = parseFloat(score);
  if (isNaN(n)) return "#6b7280";
  if (n >= 8) return "#ef4444";
  if (n >= 5) return "#f97316";
  return "#10b981";
}

function simColor(s) {
  if (s >= 0.75) return "#ef4444";
  if (s >= 0.40) return "#f97316";
  return "#6b7280";
}

// ─── TIC Chromatogram ────────────────────────────────────────────────────────
const Chromatogram = ({ tic, peaks, selectedPeakId, onSelectPeak }) => {
  const svgRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  if (!tic?.rt?.length) return <div className="w-full bg-[#0a0a0a] rounded" style={{ height: 130 }} />;

  const W = 700, H = 130, PL = 32, PR = 12, PT = 10, PB = 24;
  const iW = W - PL - PR, iH = H - PT - PB;

  const rtMin = tic.rt[0], rtMax = tic.rt[tic.rt.length - 1];
  const intMax = Math.max(...tic.intensity);

  const tx = (rt) => PL + ((rt - rtMin) / (rtMax - rtMin)) * iW;
  const ty = (v)  => PT + iH - (v / intMax) * iH;

  // Build polyline path
  const pts = tic.rt.map((rt, i) => `${tx(rt).toFixed(1)},${ty(tic.intensity[i]).toFixed(1)}`).join(" ");

  // Axis ticks
  const xTicks = Array.from({ length: 7 }, (_, i) => Math.round(rtMax / 6 * i * 10) / 10);
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: H, display: "block", cursor: "crosshair" }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#0a0a0a" rx={4} />

      {/* Grid lines */}
      {yTicks.map((t) => (
        <line key={t} x1={PL} y1={ty(t * intMax)} x2={W - PR} y2={ty(t * intMax)}
          stroke="#1f1f1f" strokeWidth={1} />
      ))}

      {/* TIC fill */}
      <polygon
        points={`${PL},${ty(0)} ${pts} ${W - PR},${ty(0)}`}
        fill="url(#ticGrad)" opacity={0.25}
      />
      <defs>
        <linearGradient id="ticGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* TIC line */}
      <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.7} />

      {/* Peak markers */}
      {peaks.map((pk) => {
        const x = tx(pk.rt);
        const y = ty(pk.intensity);
        const isSelected = pk.id === selectedPeakId;
        const isHovered  = pk.id === hovered;
        return (
          <g key={pk.id}
            onClick={() => onSelectPeak(pk.id)}
            onMouseEnter={() => setHovered(pk.id)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            {/* drop line */}
            <line x1={x} y1={y} x2={x} y2={ty(0)}
              stroke={isSelected ? "#ef4444" : "#f59e0b"}
              strokeWidth={isSelected ? 1.5 : 1}
              strokeDasharray={isSelected ? "none" : "3 3"}
              opacity={isSelected || isHovered ? 0.8 : 0.4}
            />
            {/* dot */}
            <circle cx={x} cy={y} r={isSelected ? 6 : isHovered ? 5 : 4}
              fill={isSelected ? "#ef4444" : "#f59e0b"}
              stroke="#0a0a0a" strokeWidth={1.5}
              opacity={isSelected || isHovered ? 1 : 0.75}
            />
            {/* label */}
            {(isSelected || isHovered) && (
              <text x={x} y={y - 10} textAnchor="middle"
                fontSize={9} fill={isSelected ? "#ef4444" : "#f59e0b"} fontFamily="monospace">
                {pk.label}
              </text>
            )}
          </g>
        );
      })}

      {/* X axis labels */}
      {xTicks.map((t) => (
        <text key={t} x={tx(t)} y={H - 6} textAnchor="middle"
          fontSize={8} fill="#4b5563" fontFamily="monospace">
          {t.toFixed(1)}
        </text>
      ))}
      <text x={PL + iW / 2} y={H - 1} textAnchor="middle" fontSize={12} fill="#374151">RT (min)</text>

      {/* Y axis label */}
      <text x={8} y={PT + iH / 2} textAnchor="middle" fontSize={12} fill="#374151"
        transform={`rotate(-90, 8, ${PT + iH / 2})`}>Intensity</text>
    </svg>
  );
};

// ─── MS2 Spectrum ────────────────────────────────────────────────────────────
const MS2Chart = ({ peaks, height = 110 }) => {
  if (!peaks?.length) return <div className="w-full bg-[#0a0a0a] rounded" style={{ height }} />;

  const W = 600, H = height, PAD = 4, PB = 16;
  const iW = W - PAD * 2, iH = H - PAD - PB;

  const maxI  = Math.max(...peaks.map((p) => p.intensity));
  const mzMin = Math.min(...peaks.map((p) => p.mz));
  const mzMax = Math.max(...peaks.map((p) => p.mz));
  const mzRng = (mzMax - mzMin) || 1;

  // x-axis ticks
  const xTicks = Array.from({ length: 5 }, (_, i) =>
    Math.round(mzMin + (mzRng / 4) * i)
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      className="w-full" style={{ height, display: "block" }}>
      <rect x={0} y={0} width={W} height={H} fill="#0a0a0a" rx={4} />
      <g transform={`translate(${PAD},${PAD})`}>
        {peaks.map((p, i) => {
          const rel = p.intensity / maxI;
          const x   = ((p.mz - mzMin) / mzRng) * iW;
          const h   = rel * iH;
          const c   = rel > 0.75 ? "#ef4444" : rel > 0.4 ? "#f97316" : "#f59e0b";
          return <line key={i} x1={x} y1={iH} x2={x} y2={iH - h}
            stroke={c} strokeWidth={2} strokeOpacity={0.85} />;
        })}
        {/* x-axis ticks */}
        {xTicks.map((t) => {
          const x = ((t - mzMin) / mzRng) * iW;
          return (
            <g key={t}>
              <line x1={x} y1={iH} x2={x} y2={iH + 4} stroke="#374151" strokeWidth={1} />
              <text x={x} y={iH + 12} textAnchor="middle" fontSize={8} fill="#4b5563" fontFamily="monospace">
                {t}
              </text>
            </g>
          );
        })}
      </g>
      <text x={W / 2} y={H - 1} textAnchor="middle" fontSize={7} fill="#374151">m/z</text>
    </svg>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────
const SpectralMatching = () => {
  const [files,        setFiles]        = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [chrom,        setChrom]        = useState(null);
  const [selectedPeak, setSelectedPeak] = useState(null);
  const [allEmbeddings,setAllEmbeddings]= useState(null);
  const [matchResult,  setMatchResult]  = useState(null);
  const [searching,    setSearching]    = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Load file list
  useEffect(() => {
    fetch(`${BACKEND}/neural-safety/chromatograms`)
      .then((r) => r.json())
      .then((data) => {
        setFiles(data);
        if (data.length) setSelectedFile(data[0]);
      });
  }, []);

  // Load chromatogram
  useEffect(() => {
    if (!selectedFile) return;
    setChrom(null);
    setSelectedPeak(null);
    setMatchResult(null);
    fetch(`${BACKEND}/neural-safety/chromatogram/${selectedFile}`)
      .then((r) => r.json())
      .then((data) => {
        setChrom(data);
        if (data.peaks?.length) setSelectedPeak(data.peaks[0]);
      });
  }, [selectedFile]);

  // Select peak by id
  const handleSelectPeak = (id) => {
    const pk = chrom?.peaks?.find((p) => p.id === id);
    if (pk) { setSelectedPeak(pk); setMatchResult(null); }
  };

  // Similarity search
  const handleSearch = async () => {
    if (!selectedPeak) return;
    setSearching(true);
    setMatchResult(null);

    try {
      // Load all ECRFS embeddings (cached after first call)
      let embs = allEmbeddings;
      if (!embs) {
        const res = await fetch(`${BACKEND}/neural-safety/all-embeddings`);
        embs = await res.json();
        setAllEmbeddings(embs);
      }

      // Compute query vector from selected peak's MS2
      const queryVec = peaksToVector(selectedPeak.ms2.peaks);

      // Score against all 102 ECRFS molecules
      const scored = embs.map((mol) => ({
        ...mol,
        similarity: cosineSimilarity(queryVec, mol.embedding),
      })).sort((a, b) => b.similarity - a.similarity);

      setMatchResult({ best: scored[0], top5: scored.slice(0, 5) });
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const selectedMs2 = selectedPeak?.ms2?.peaks ?? [];

  return (
    <div
      className="absolute inset-0 flex items-stretch justify-center px-12"
      style={{ paddingTop: "200px", paddingBottom: "120px" }}
    >
      <div className="flex flex-col w-full max-w-6xl rounded overflow-hidden border border-gray-800/60">

        {/* ── TOP BAR ── */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e0e0e] border-b border-gray-800 flex-shrink-0">

          {/* File dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-gray-700 rounded text-xs text-gray-300 hover:border-amber-500/50 transition-colors"
            >
              <LuDatabase className="w-3 h-3 text-amber-400" />
              <span className="max-w-[220px] truncate">{selectedFile ?? "Select file…"}</span>
              <svg className={`w-3 h-3 text-gray-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="absolute z-50 mt-1 w-72 bg-[#1a1a1a] border border-gray-700 rounded shadow-2xl max-h-60 overflow-y-auto"
                style={{ scrollbarWidth: "none" }}>
                {files.map((f) => (
                  <button key={f}
                    onClick={() => { setSelectedFile(f); setDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs border-b border-gray-800/50 transition-colors font-mono ${
                      f === selectedFile ? "text-amber-300 bg-amber-600/10" : "text-gray-300 hover:bg-white/5"
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Centre label */}
          <div className="flex items-center gap-2">
            <LuFlaskConical className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              HPLC Ingestion · Spectral Matching
            </span>
          </div>

          {/* Metadata */}
          {chrom && (
            <div className="text-[10px] text-gray-600 font-mono text-right">
              <div>{chrom.meta?.instrument}</div>
              <div>{chrom.peaks?.length} peaks detected</div>
            </div>
          )}
        </div>

        {/* ── CONTENT ── */}
        <div className="flex-1 overflow-hidden bg-[#111111] flex flex-col flex-col min-h-0">
          <div className="flex-1 flex min-h-0">

            {/* ── LEFT ── */}
            <div className="flex-1 flex flex-col px-5 py-4 border-r border-gray-800 min-w-0">

              {/* Chromatogram */}
              <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <LuActivity className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Total Ion Chromatogram
                </span>
              </div>
              <div className="flex-shrink-0">
                <Chromatogram
                  tic={chrom?.tic}
                  peaks={chrom?.peaks ?? []}
                  selectedPeakId={selectedPeak?.id}
                  onSelectPeak={handleSelectPeak}
                />
              </div>

              {/* Peaks table */}
              <div className="flex items-center gap-2 mt-4 mb-2 flex-shrink-0">
                <span className="text-[10px] uppercase tracking-widest text-gray-600">Detected Peaks</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {["#", "RT (min)", "Intensity", "Precursor m/z", "Label"].map((h) => (
                        <th key={h} className="text-left text-[10px] text-gray-600 uppercase tracking-wide py-1.5 px-2 font-normal">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(chrom?.peaks ?? []).map((pk) => {
                      const isSelected = pk.id === selectedPeak?.id;
                      return (
                        <tr key={pk.id}
                          onClick={() => handleSelectPeak(pk.id)}
                          className={`border-b border-gray-800/40 cursor-pointer transition-colors ${
                            isSelected ? "bg-amber-600/10" : "hover:bg-white/[0.03]"
                          }`}
                        >
                          <td className="py-1.5 px-2">
                            <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold ${
                              isSelected ? "bg-amber-500/20 text-amber-400" : "bg-gray-800 text-gray-500"
                            }`}>{pk.id}</span>
                          </td>
                          <td className="py-1.5 px-2 font-mono text-gray-300">{pk.rt.toFixed(2)}</td>
                          <td className="py-1.5 px-2 font-mono text-gray-300">{pk.intensity.toLocaleString()}</td>
                          <td className="py-1.5 px-2 font-mono text-gray-400">{pk.precursor_mz.toFixed(4)}</td>
                          <td className={`py-1.5 px-2 ${isSelected ? "text-amber-400" : "text-gray-500"}`}>
                            {pk.label}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── RIGHT ── */}
            <div className="flex-1 flex flex-col px-5 py-4 min-w-0">

              {/* MS2 Spectrum of selected peak */}
              <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <LuActivity className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  MS/MS Spectrum
                </span>
                {selectedPeak && (
                  <span className="text-[10px] text-gray-600 font-mono ml-1">
                    Peak {selectedPeak.id} · RT {selectedPeak.rt.toFixed(2)} min · {selectedPeak.precursor_mz.toFixed(4)} Da
                  </span>
                )}
              </div>
              <div className="flex-shrink-0">
                <MS2Chart peaks={selectedMs2} height={110} />
              </div>

              {/* MS2 quick stats */}
              {selectedPeak && (
                <div className="grid grid-cols-3 gap-2 mt-3 flex-shrink-0">
                  <div className="bg-[#1a1a1a] rounded p-2.5">
                    <div className="text-[10px] text-gray-600 uppercase tracking-wide">Precursor</div>
                    <div className="text-xs text-gray-200 mt-0.5 font-mono">{selectedPeak.precursor_mz.toFixed(4)}</div>
                  </div>
                  <div className="bg-[#1a1a1a] rounded p-2.5">
                    <div className="text-[10px] text-gray-600 uppercase tracking-wide">Fragments</div>
                    <div className="text-xs text-gray-200 mt-0.5">{selectedMs2.length}</div>
                  </div>
                  <div className="bg-[#1a1a1a] rounded p-2.5">
                    <div className="text-[10px] text-gray-600 uppercase tracking-wide">RT</div>
                    <div className="text-xs text-gray-200 mt-0.5 font-mono">{selectedPeak.rt.toFixed(2)} min</div>
                  </div>
                </div>
              )}

              {/* Separator */}
              <div className="border-t border-gray-800 mt-4 pt-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <span className="text-[10px] uppercase tracking-widest text-gray-600">Similarity Search · ECRFS Library</span>
                  <button
                    onClick={handleSearch}
                    disabled={!selectedPeak || searching}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-semibold transition-all ${
                      searching
                        ? "bg-[#1a1a1a] border border-gray-700 text-gray-500 cursor-wait"
                        : "bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white hover:shadow-lg hover:scale-105"
                    }`}
                  >
                    <LuSearch className="w-3.5 h-3.5" />
                    {searching ? "Searching…" : "Similarity Search"}
                  </button>
                </div>

                {/* Results */}
                {!matchResult && !searching && (
                  <div className="flex-1 flex items-center justify-center text-gray-700 text-xs">
                    Select a peak and run Similarity Search
                  </div>
                )}

                {searching && (
                  <div className="flex-1 flex items-center justify-center gap-3 text-gray-600 text-xs">
                    <div className="w-3 h-3 rounded-full bg-amber-500/40 animate-ping" />
                    Computing cosine similarity against 102 ECRFS embeddings…
                  </div>
                )}

                {matchResult && (
                  <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

                    {/* Best match card */}
                    <div className="rounded border flex-shrink-0"
                      style={{ borderColor: simColor(matchResult.best.similarity) + "44",
                               background: simColor(matchResult.best.similarity) + "0a" }}>
                      <div className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-gray-200 truncate">
                              {matchResult.best.name}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                              {matchResult.best.formula}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-2xl font-bold font-mono"
                              style={{ color: simColor(matchResult.best.similarity) }}>
                              {(matchResult.best.similarity * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-gray-600">cosine sim.</div>
                          </div>
                        </div>
                        {matchResult.best.tox_score !== "N/A" && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: toxHex(matchResult.best.tox_score) }} />
                            <span className="text-[10px] text-gray-500">
                              EFSA Tox Score:&nbsp;
                              <span className="font-semibold" style={{ color: toxHex(matchResult.best.tox_score) }}>
                                {matchResult.best.tox_score}/10
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Top 5 ranking */}
                    <div className="flex-shrink-0">
                      <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Top 5 matches</div>
                      <div className="flex flex-col gap-1">
                        {matchResult.top5.map((mol, rank) => (
                          <div key={mol.id} className="flex items-center gap-3 px-3 py-1.5 bg-[#0e0e0e] rounded border border-gray-800/60">
                            <span className="text-[10px] text-gray-600 w-4">{rank + 1}</span>
                            <span className="flex-1 text-[10px] text-gray-300 truncate">{mol.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono">{mol.formula}</span>
                            {/* Similarity bar */}
                            <div className="w-24 flex items-center gap-2 flex-shrink-0">
                              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${mol.similarity * 100}%`,
                                    backgroundColor: simColor(mol.similarity),
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-mono w-10 text-right"
                                style={{ color: simColor(mol.similarity) }}>
                                {(mol.similarity * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpectralMatching;
