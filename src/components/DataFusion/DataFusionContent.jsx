import React, { useState } from "react";
import ImportView from "./ImportView";
import ColumnMapper from "./ColumnMapper";
import ConflictResolver from "./ConflictResolver";
import ExportView from "./ExportView";
import { getAnimationProgress } from "../../utils/animationConfig";

const DataFusionContent = ({ activeIndex, scrollIndex, totalSections }) => {
  const { currentOpacity } = getAnimationProgress(scrollIndex, activeIndex, totalSections);

  // ── Global flow state ─────────────────────────────────────────────────────
  const [files, setFiles] = useState([]);           // [{name, content, info}]
  const [columnMapping, setColumnMapping] = useState({}); // {filename: {oldCol: newCol|null}}
  const [keyColumn, setKeyColumn] = useState(null);
  const [labelColumn, setLabelColumn] = useState(null);
  const [analysis, setAnalysis] = useState(null);   // dry_run result
  const [rules, setRules] = useState({
    caseStrategy: "lowercase",
    duplicateStrategy: "first",
    conflictStrategy: "flag",
  });
  const [mergedResult, setMergedResult] = useState(null); // {data, stats}

  let content = null;

  if (activeIndex === 0) {
    content = (
      <ImportView
        files={files}
        setFiles={setFiles}
      />
    );
  } else if (activeIndex === 1) {
    content = (
      <ColumnMapper
        files={files}
        columnMapping={columnMapping}
        setColumnMapping={setColumnMapping}
        keyColumn={keyColumn}
        setKeyColumn={setKeyColumn}
        labelColumn={labelColumn}
        setLabelColumn={setLabelColumn}
      />
    );
  } else if (activeIndex === 2) {
    content = (
      <ConflictResolver
        files={files}
        columnMapping={columnMapping}
        keyColumn={keyColumn}
        labelColumn={labelColumn}
        rules={rules}
        setRules={setRules}
        analysis={analysis}
        setAnalysis={setAnalysis}
      />
    );
  } else if (activeIndex === 3) {
    content = (
      <ExportView
        files={files}
        columnMapping={columnMapping}
        keyColumn={keyColumn}
        labelColumn={labelColumn}
        rules={rules}
        mergedResult={mergedResult}
        setMergedResult={setMergedResult}
      />
    );
  }

  if (currentOpacity <= 0.01) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: currentOpacity, willChange: "opacity" }}
    >
      <div className="absolute inset-0 pointer-events-auto">
        {content}
      </div>
    </div>
  );
};

export default DataFusionContent;
