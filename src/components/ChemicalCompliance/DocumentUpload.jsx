import React, { useState, useRef, useCallback, useEffect } from "react";
import { LuCloudUpload, LuX, LuFileText, LuTrash2 } from "react-icons/lu";

const BACKEND = "http://localhost:8000";

const DOC_TYPES = ["SOP", "SDS", "REGULATION", "METHOD", "COA"];
const MATRIX_TYPES = ["cosmetic", "food", "solvent", "polymer", "pharma", "general"];

const DocumentUpload = ({ onDocsChange }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [docType, setDocType] = useState("SOP");
  const [matrixType, setMatrixType] = useState("general");
  const [revision, setRevision] = useState("1.0");
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  const fetchDocs = useCallback(async () => {
    try {
      const resp = await fetch(`${BACKEND}/compliance/documents`);
      if (resp.ok) {
        const { documents } = await resp.json();
        setDocs(documents || []);
        onDocsChange?.(documents || []);
      }
    } catch {
      // Qdrant may not be running
    }
  }, [onDocsChange]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const processFiles = useCallback(
    async (rawFiles) => {
      setError(null);
      const fileArr = Array.from(rawFiles);

      for (const file of fileArr) {
        setUploadProgress((p) => ({ ...p, [file.name]: "reading" }));

        try {
          const content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            // For PDFs/DOCX, read as base64; plain text as text
            if (file.name.match(/\.(pdf|docx)$/i)) {
              reader.readAsDataURL(file);
            } else {
              reader.readAsText(file);
            }
          });

          // Strip data URL prefix for base64
          const rawContent = content.startsWith("data:")
            ? content.split(",")[1]
            : content;

          setUploadProgress((p) => ({ ...p, [file.name]: "uploading" }));

          const resp = await fetch(`${BACKEND}/compliance/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: file.name,
              content: rawContent,
              document_type: docType,
              matrix_type: matrixType,
              revision,
            }),
          });

          if (!resp.ok) {
            const detail = await resp.text();
            throw new Error(`Upload failed: ${detail}`);
          }

          const result = await resp.json();
          setUploadProgress((p) => ({
            ...p,
            [file.name]: `done (${result.chunks_created} chunks)`,
          }));

          await fetchDocs();
        } catch (e) {
          setError(e.message);
          setUploadProgress((p) => ({ ...p, [file.name]: "error" }));
        }
      }

      setLoading(false);
    },
    [docType, matrixType, revision, fetchDocs]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        setLoading(true);
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = (e) => e.preventDefault();

  const handleDelete = async (docId) => {
    try {
      await fetch(`${BACKEND}/compliance/documents/${docId}`, { method: "DELETE" });
      await fetchDocs();
    } catch (e) {
      setError(e.message);
    }
  };

  const docTypeColor = (dt) => {
    const map = {
      SOP: "text-teal-400",
      SDS: "text-amber-400",
      REGULATION: "text-purple-400",
      METHOD: "text-blue-400",
      COA: "text-green-400",
    };
    return map[dt] || "text-gray-400";
  };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto no-scrollbar px-12"
      style={{ paddingTop: "220px", paddingBottom: "100px" }}
    >
      <div className="w-full max-w-2xl">
        {/* Selectors */}
        <div className="flex flex-wrap gap-4 mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-gray-600">
              Document type
            </label>
            <div className="flex gap-1">
              {DOC_TYPES.map((dt) => (
                <button
                  key={dt}
                  onClick={() => setDocType(dt)}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-colors border ${
                    docType === dt
                      ? "bg-teal-900/40 border-teal-700 text-teal-300"
                      : "bg-white/5 border-gray-700 text-gray-500 hover:border-gray-600"
                  }`}
                >
                  {dt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-gray-600">
              Matrix
            </label>
            <select
              value={matrixType}
              onChange={(e) => setMatrixType(e.target.value)}
              className="bg-[#0e0e0e] border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-teal-700"
            >
              {MATRIX_TYPES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-gray-600">
              Revision
            </label>
            <input
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              className="bg-[#0e0e0e] border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 w-16 focus:outline-none focus:border-teal-700 font-mono"
            />
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-700 rounded flex flex-col items-center gap-3 py-10 px-6 cursor-pointer hover:border-teal-700/70 transition-colors mb-6"
        >
          <LuCloudUpload className="w-8 h-8 text-gray-600" />
          <div className="text-sm text-gray-400">
            Drag & drop files here, or{" "}
            <span className="text-teal-500 underline underline-offset-2">browse</span>
          </div>
          <div className="text-[10px] text-gray-600 uppercase tracking-widest">
            Accepted: .pdf, .docx, .txt
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length > 0) {
                setLoading(true);
                processFiles(e.target.files);
              }
            }}
          />
        </div>

        {/* Upload progress */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="mb-4 flex flex-col gap-1">
            {Object.entries(uploadProgress).map(([name, status]) => (
              <div key={name} className="flex items-center justify-between text-xs text-gray-500 font-mono">
                <span className="truncate max-w-xs">{name}</span>
                <span className={status === "error" ? "text-red-500" : status.startsWith("done") ? "text-teal-500" : "text-amber-500 animate-pulse"}>
                  {status}
                </span>
              </div>
            ))}
          </div>
        )}

        {error && <div className="text-xs text-red-500 mb-4">{error}</div>}

        {/* Document list */}
        {docs.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">
              Ingested documents ({docs.length})
            </div>
            {docs.map((doc) => (
              <div
                key={doc.doc_id}
                className="bg-[#0e0e0e] border border-gray-800 rounded px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <LuFileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-gray-300 font-mono truncate">{doc.name}</div>
                    <div className="flex gap-2 mt-0.5">
                      <span className={`text-[10px] font-mono ${docTypeColor(doc.document_type)}`}>
                        {doc.document_type}
                      </span>
                      <span className="text-[10px] text-gray-600">·</span>
                      <span className="text-[10px] text-gray-600">{doc.matrix_type}</span>
                      <span className="text-[10px] text-gray-600">·</span>
                      <span className="text-[10px] text-gray-600">rev {doc.revision}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.doc_id)}
                  className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-900/40 transition-colors flex-shrink-0 ml-2"
                  title="Delete document"
                >
                  <LuTrash2 className="w-3 h-3 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {docs.length === 0 && !loading && (
          <div className="text-[11px] text-gray-700 text-center mt-4">
            No documents ingested yet. Upload files above to get started.
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentUpload;
