import React from "react";

const ComplianceOverview = () => {
  const features = [
    {
      icon: "📄",
      title: "SOP & Regulatory Search",
      desc: "Semantic search across Standard Operating Procedures, regulatory texts, and method documents. Retrieve relevant clauses with source citations.",
    },
    {
      icon: "⚠️",
      title: "SDS Hazard Extraction",
      desc: "Automatically extract CAS numbers, H/P hazard codes, GHS classification, signal words, and occupational exposure limits from Safety Data Sheets.",
    },
    {
      icon: "⚖️",
      title: "Batch CoA Comparison",
      desc: "Upload two Certificates of Analysis for the same product. The system aligns parameters, computes percent deviation, and flags values exceeding your threshold.",
    },
    {
      icon: "🔍",
      title: "Regulatory Intelligence",
      desc: "Query REACH, CLP, ICH Q3C and other frameworks. Answers are grounded strictly in retrieved documents — no invented regulatory limits.",
    },
  ];

  const stack = [
    { label: "LLM", value: "LLaMA 3 8B via Ollama" },
    { label: "Embeddings", value: "nomic-embed-text (768-dim)" },
    { label: "Vector DB", value: "Qdrant (Docker, local)" },
    { label: "Framework", value: "LlamaIndex + FastAPI" },
    { label: "Chemistry", value: "RDKit (CAS validation, MW)" },
    { label: "Parsing", value: "pdfminer.six + python-docx" },
  ];

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto no-scrollbar px-12"
      style={{ paddingTop: "220px", paddingBottom: "100px" }}
    >
      <div className="w-full max-w-3xl">
        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-[#0e0e0e] border border-gray-800 rounded p-4"
            >
              <div className="text-xl mb-2">{f.icon}</div>
              <div className="text-sm font-medium text-gray-200 mb-1">{f.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Tech stack */}
        <div className="bg-[#0e0e0e] border border-gray-800 rounded p-5">
          <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-3">
            Technology Stack
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {stack.map((s) => (
              <div key={s.label}>
                <div className="text-[10px] text-gray-600 uppercase tracking-widest">{s.label}</div>
                <div className="text-xs text-gray-300 font-mono mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy note */}
        <div className="mt-6 text-[11px] text-gray-600 text-center">
          All processing is fully local. No document data leaves your machine.
        </div>
      </div>
    </div>
  );
};

export default ComplianceOverview;
