import React, { useState, useEffect, useCallback } from "react";
import { getRandomMolecules } from "../../data/moleculesData";
import MoleculeRenderer from "./MoleculeRenderer";
import ImpactMetrics from "./ImpactMetrics";
import IndustriesContent from "./IndustriesContent";

// --- Sezioni ---
const SECTION_GENERATE = 1;
const SECTION_PREDICT = 2;
const SECTION_SELECT = 3;
const SECTION_VALIDATE = 4;

// --- Geometria griglia ---
const CELL_SPACING = 129;
const CELL_VISUAL = 112;

const GRID_W_8 = 7 * CELL_SPACING + CELL_VISUAL; // 1015
const GRID_H_8 = 2 * CELL_SPACING + CELL_VISUAL; // 370
const GRID_W_5 = 4 * CELL_SPACING + CELL_VISUAL; // 628
const GRID_H_5 = 1 * CELL_SPACING + CELL_VISUAL; // 241

// --- Layout ---
const BUTTON_AREA = 180;
const BUTTON_GAP = 48;
const ARROW_RESERVED = 96;
const SLIDE_IN_DIST = 80;

// --- Helpers ---
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const isInteractive = (i) => i >= SECTION_GENERATE && i <= SECTION_VALIDATE;

const useContainerWidth = () => {
  const [w, setW] = useState(0);
  useEffect(() => {
    const update = () => setW(window.innerWidth - ARROW_RESERVED * 2);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return w;
};

const computeGridLeft = (cw, gw, btnSide) => {
  const group = BUTTON_AREA + BUTTON_GAP + gw;
  const off = Math.max(0, (cw - group) / 2);
  return btnSide === "left" ? off + BUTTON_AREA + BUTTON_GAP : off;
};

const computeButtonX = (cw, gw, btnSide) => {
  const group = BUTTON_AREA + BUTTON_GAP + gw;
  const off = Math.max(0, (cw - group) / 2);
  return btnSide === "left"
    ? off + BUTTON_AREA / 2
    : off + gw + BUTTON_GAP + BUTTON_AREA / 2;
};

const sectionLayout = (sec) => {
  switch (sec) {
    case SECTION_GENERATE:
      return { gw: GRID_W_8, gh: GRID_H_8, side: "left" };
    case SECTION_PREDICT:
      return { gw: GRID_W_8, gh: GRID_H_8, side: "right" };
    case SECTION_SELECT:
      return { gw: GRID_W_8, gh: GRID_H_8, side: "left" };
    case SECTION_VALIDATE:
      return { gw: GRID_W_5, gh: GRID_H_5, side: "right" };
    default:
      return { gw: GRID_W_8, gh: GRID_H_8, side: "left" };
  }
};

// --- Componente pulsante ---
const InteractiveButton = ({
  children,
  onClick,
  disabled,
  x,
  opacity,
  slideX = 0,
  className,
}) => {
  if (opacity <= 0.01) return null;
  return (
    <div
      className="absolute top-1/2"
      style={{
        left: x,
        transform: `translate(calc(-50% + ${slideX}px), -50%)`,
        opacity,
        willChange: "transform, opacity",
      }}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className={`px-8 py-4 rounded-xl text-white text-xl font-semibold
          hover:shadow-2xl transition-shadow
          disabled:opacity-50 disabled:cursor-not-allowed
          pointer-events-auto ${className}`}
      >
        {children}
      </button>
    </div>
  );
};

// ==============================
// COMPONENTE PRINCIPALE
// ==============================
const InteractiveContent = ({
  activeIndex,
  scrollIndex = 0,
  totalSections = 7,
}) => {
  const [molecules, setMolecules] = useState(Array(24).fill(null));
  const [showPredictions, setShowPredictions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [showTop10, setShowTop10] = useState(false);
  const [validationResults, setValidationResults] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [lastVisited, setLastVisited] = useState(SECTION_GENERATE);

  const containerWidth = useContainerWidth();

  // --- Reset (usa activeIndex per la logica di stato, non per animazione) ---
  useEffect(() => {
    if (!isInteractive(activeIndex)) {
      setMolecules(Array(24).fill(null));
      setShowPredictions(false);
      setIsGenerating(false);
      setIsPredicting(false);
      setShowTop10(false);
      setValidationResults([]);
      setIsValidating(false);
      setLastVisited(SECTION_GENERATE);
      return;
    }
    if (activeIndex < lastVisited) {
      switch (lastVisited) {
        case SECTION_PREDICT:
          setShowPredictions(false);
          setIsPredicting(false);
          break;
        case SECTION_SELECT:
          setShowTop10(false);
          break;
        case SECTION_VALIDATE:
          setValidationResults([]);
          setIsValidating(false);
          break;
        default:
          break;
      }
    }
    setLastVisited(activeIndex);
  }, [activeIndex, lastVisited]);

  // --- Handlers ---
  const handleGenerate = useCallback(() => {
    setIsGenerating(true);
    setShowPredictions(false);
    setShowTop10(false);
    for (let i = 0; i < 24; i++) {
      localStorage.removeItem(`mol-${i}`);
      localStorage.removeItem(`mol-${i}-orange`);
    }
    setTimeout(() => {
      setMolecules(getRandomMolecules(24));
      setIsGenerating(false);
    }, 1500);
  }, []);

  const handlePredict = useCallback(() => {
    setIsPredicting(true);
    setTimeout(() => {
      setShowPredictions(true);
      setIsPredicting(false);
    }, 1500);
  }, []);

  const handleTop10 = useCallback(() => setShowTop10(true), []);

  const top10Indices = [...molecules.map((mol, idx) => ({
    idx,
    score: mol ? parseFloat(localStorage.getItem(`mol-${idx}`) || 0) : -1,
  }))]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((m) => m.idx);

  const handleValidate = useCallback(() => {
    setIsValidating(true);
    setTimeout(() => {
      const shuffled = [...top10Indices].sort(() => Math.random() - 0.5);
      setValidationResults(shuffled.slice(0, 8));
      setIsValidating(false);
    }, 1500);
  }, [top10Indices]);

  // =========================================
  // ANIMAZIONE BASATA SU scrollIndex (continuo)
  // =========================================
  // scrollIndex è il valore continuo della posizione di scroll (es. 1.0, 1.3, 2.7).
  // Tutte le animazioni derivano direttamente da esso, senza snap.

  // Clamp all'intervallo interattivo per il posizionamento della griglia
  const clamped = Math.max(SECTION_GENERATE, Math.min(SECTION_VALIDATE, scrollIndex));
  const fromSec = Math.min(SECTION_VALIDATE - 1, Math.floor(clamped));
  const toSec = fromSec + 1;
  const frac = clamped - fromSec;

  // Griglia: posizione e dimensioni (interpolazione continua tra sezioni adiacenti)
  const fromLayout = sectionLayout(fromSec);
  const toLayout = sectionLayout(toSec);

  const gridLeft = lerp(
    computeGridLeft(containerWidth, fromLayout.gw, fromLayout.side),
    computeGridLeft(containerWidth, toLayout.gw, toLayout.side),
    frac
  );
  const gridW = lerp(fromLayout.gw, toLayout.gw, frac);
  const gridH = lerp(fromLayout.gh, toLayout.gh, frac);

  // Opacità griglia: fade in/out ai bordi dell'intervallo interattivo
  let gridOpacity = 1;
  if (scrollIndex < SECTION_GENERATE) {
    gridOpacity = clamp01(scrollIndex - SECTION_GENERATE + 1);
  } else if (scrollIndex > SECTION_VALIDATE) {
    gridOpacity = clamp01(1 - (scrollIndex - SECTION_VALIDATE));
  }

  // Pulsanti: opacità = triangolo centrato sulla sezione, slide proporzionale
  const computeBtn = (section, side) => {
    const dist = Math.abs(scrollIndex - section);
    const opacity = clamp01(1 - dist);
    if (opacity <= 0.01) return { x: 0, opacity: 0, slideX: 0 };
    const layout = sectionLayout(section);
    const x = computeButtonX(containerWidth, layout.gw, side);
    const dir = side === "left" ? -1 : 1;
    const slideX = dir * SLIDE_IN_DIST * (1 - opacity);
    return { x, opacity, slideX };
  };

  const btnGenerate = computeBtn(SECTION_GENERATE, "left");
  const btnPredict = computeBtn(SECTION_PREDICT, "right");
  const btnSelect = computeBtn(SECTION_SELECT, "left");
  const btnValidate = computeBtn(SECTION_VALIDATE, "right");

  // Validate progress: 0 = griglia 8col, 1 = griglia 5col
  let validateProgress = 0;
  if (clamped >= SECTION_VALIDATE) {
    validateProgress = 1;
  } else if (clamped > SECTION_SELECT) {
    validateProgress = clamped - SECTION_SELECT;
  }
  const fullyAtValidate = validateProgress >= 0.99;

  if (containerWidth <= 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: containerWidth || "100%",
          height: "80vh",
          maxWidth: "1536px",
        }}
      >
        {/* PULSANTI */}
        <InteractiveButton
          x={btnGenerate.x}
          opacity={btnGenerate.opacity}
          slideX={btnGenerate.slideX}
          onClick={handleGenerate}
          disabled={isGenerating}
          className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:shadow-cyan-500/50"
        >
          generate
        </InteractiveButton>

        <InteractiveButton
          x={btnPredict.x}
          opacity={btnPredict.opacity}
          slideX={btnPredict.slideX}
          onClick={handlePredict}
          disabled={molecules[0] === null || showPredictions || isPredicting}
          className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:shadow-purple-500/50"
        >
          predict
        </InteractiveButton>

        <InteractiveButton
          x={btnSelect.x}
          opacity={btnSelect.opacity}
          slideX={btnSelect.slideX}
          onClick={handleTop10}
          disabled={!showPredictions || showTop10}
          className="bg-gradient-to-r from-yellow-600 via-amber-600 to-orange-600 hover:shadow-yellow-500/50"
        >
          select
        </InteractiveButton>

        <InteractiveButton
          x={btnValidate.x}
          opacity={btnValidate.opacity}
          slideX={btnValidate.slideX}
          onClick={handleValidate}
          disabled={!showTop10}
          className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:shadow-green-500/50"
        >
          validate
        </InteractiveButton>

        {/* GRIGLIA */}
        <div
          className="absolute top-1/2"
          style={{
            left: gridLeft,
            width: gridW,
            height: gridH,
            transform: "translateY(-50%)",
            opacity: gridOpacity,
            willChange: "left, width, height, opacity",
          }}
        >
          {molecules.map((mol, idx) => {
            const isTop10 = top10Indices.includes(idx);
            if (fullyAtValidate && !isTop10) return null;

            const x8 = (idx % 8) * CELL_SPACING;
            const y8 = Math.floor(idx / 8) * CELL_SPACING;

            const top10Pos = top10Indices.indexOf(idx);
            const x5 = top10Pos >= 0 ? (top10Pos % 5) * CELL_SPACING : x8;
            const y5 = top10Pos >= 0 ? Math.floor(top10Pos / 5) * CELL_SPACING : y8;

            const finalX = isTop10 ? lerp(x8, x5, validateProgress) : x8;
            const finalY = isTop10 ? lerp(y8, y5, validateProgress) : y8;
            const cellOpacity = isTop10 ? 1 : 1 - validateProgress;

            return (
              <div
                key={idx}
                className={`absolute rounded-lg bg-[#1a1a1a] overflow-hidden flex items-center justify-center
                  ${showTop10 && isTop10 && validateProgress < 0.5 ? "ring-2 ring-orange-500" : ""}
                  ${validateProgress >= 0.5 && isTop10 && validationResults.length === 0 ? "ring-2 ring-orange-500" : ""}
                  ${validationResults.includes(idx) ? "ring-2 ring-green-500" : ""}`}
                style={{
                  width: CELL_VISUAL,
                  height: CELL_VISUAL,
                  left: finalX,
                  top: finalY,
                  opacity: cellOpacity,
                  willChange: "left, top, opacity",
                }}
              >
                {isGenerating && (
                  <div className="absolute inset-0 bg-black/80">
                    <div className="absolute inset-0 shimmer-effect" />
                  </div>
                )}

                {mol && !isGenerating && (
                  <MoleculeRenderer smiles={mol} size={120} />
                )}

                {mol && isPredicting && !isGenerating && (
                  <div className="absolute inset-0 bg-black/80">
                    <div className="absolute inset-0 shimmer-effect" />
                  </div>
                )}

                {mol && isValidating && validateProgress > 0.5 && isTop10 && (
                  <div className="absolute inset-0 bg-black/80">
                    <div className="absolute inset-0 shimmer-effect" />
                  </div>
                )}

                {mol && showPredictions && !isGenerating && !isPredicting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 text-xs">
                    <div className="flex items-center justify-between w-full px-2">
                      <div className="text-cyan-400 font-mono">
                        {(() => {
                          const key = `mol-${idx}`;
                          let v = localStorage.getItem(key);
                          if (!v) {
                            v = (Math.random() * 10).toFixed(2);
                            localStorage.setItem(key, v);
                          }
                          return v;
                        })()}
                      </div>
                      <div className="text-orange-400 font-mono">
                        {(() => {
                          const key = `mol-${idx}-orange`;
                          let v = localStorage.getItem(key);
                          if (!v) {
                            v = (Math.random() * 100).toFixed(1);
                            localStorage.setItem(key, v);
                          }
                          return v;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <IndustriesContent
        activeIndex={activeIndex}
        scrollIndex={scrollIndex}
        totalSections={totalSections}
      />
      <ImpactMetrics
        activeIndex={activeIndex}
        scrollIndex={scrollIndex}
        totalSections={totalSections}
      />

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .shimmer-effect {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%);
          animation: shimmer 1.0s infinite;
        }
      `}</style>
    </div>
  );
};

export default InteractiveContent;
