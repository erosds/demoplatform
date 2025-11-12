import React from "react";

/*
  Versione ottimizzata per eliminare lo sdoppiamento:
  - Rimosso il doppio layer per il titolo next
  - Eliminate le transition CSS che causavano lag
  - Interpolazione diretta del colore tramite opacità
*/

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export default function TitleDisplay({ sections = [], scrollIndex = 0 }) {
  const currentIndex = Math.floor(
    clamp(scrollIndex, 0, Math.max(0, sections.length - 1))
  );
  const rawProgress = clamp(scrollIndex - currentIndex, 0, 1);
  const p = rawProgress;
  const eased = easeInOutCubic(p);

  // Parametri
  const enterOffsetVW = 60;
  const exitDistanceVW = 60;
  const exitTrigger = 0.6; // cambia da 0.5 a 0.6
  const colorSwitchStart = 0.1; // cambia da 0.2 a 0.1
  const colorSwitchEnd = 0.95; // cambia da 0.9 a 0.95

  const current = sections[currentIndex] || null;
  const next = sections[currentIndex + 1] || null;

  // Posizioni
  const nextTranslateVW = enterOffsetVW * (1 - eased);
  const exitProgress = clamp((p - exitTrigger) / (1 - exitTrigger), 0, 1);
  const currentTranslateVW = -exitDistanceVW * easeInOutCubic(exitProgress);

  // Opacità
  const currentOpacity = clamp(1 - easeInOutCubic(exitProgress), 0, 1);

  // Interpolazione colore per next (da grigio a colorato)
  const colorSwitchProgress = clamp(
    (p - colorSwitchStart) / (colorSwitchEnd - colorSwitchStart),
    0,
    1
  );
  const colorEased = easeInOutCubic(colorSwitchProgress);

  return (
    <div className="fixed top-24 left-0 right-0 z-50 px-12 pointer-events-none">
      <div className="max-w-screen-2xl mx-auto relative h-28 overflow-hidden">
        {/* CURRENT title */}
        {current && (
          <div
            className="absolute left-0 top-0 w-full"
            style={{
              transform: `translateX(${currentTranslateVW}vw)`,
              filter: `opacity(${currentOpacity})`,
            }}
          >
            <h1
              className={`text-6xl font-bold mb-2 bg-gradient-to-r ${current.gradient} bg-clip-text text-transparent`}
              style={{ margin: 0 }}
            >
              {current.title}
            </h1>
            <p
              className="text-2xl text-gray-300 font-light"
              style={{ margin: 0 }}
            >
              {current.subtitle}
            </p>
          </div>
        )}

        {/* NEXT title - con interpolazione colore */}
        {next && p > 0 && (
          <div
            className="absolute left-0 top-0 w-full"
            style={{
              transform: `translateX(${nextTranslateVW}vw)`,
            }}
          >
            {/* Titolo con crossfade da grigio a gradient */}
            <div className="relative h-16">
              {/* Layer grigio (fade out) */}
              <h1
                className="text-6xl font-bold text-gray-400 absolute top-0 left-0"
                style={{
                  margin: 0,
                  filter: `opacity(${1 - colorEased})`,
                }}
              >
                {next.title}
              </h1>
              {/* Layer colorato (fade in) */}
              <h1
                className={`text-6xl font-bold bg-gradient-to-r ${next.gradient} bg-clip-text text-transparent absolute top-0 left-0`}
                style={{
                  margin: 0,
                  filter: `opacity(${colorEased})`,
                }}
              >
                {next.title}
              </h1>
            </div>

            {/* Sottotitolo con crossfade da grigio a bianco */}
            <div className="relative h-8 mt-2">
              {/* Layer grigio (fade out) */}
              <p
                className="text-2xl text-gray-400 font-light absolute top-0 left-0"
                style={{
                  margin: 0,
                  opacity: 1 - colorEased,
                }}
              >
                {next.subtitle}
              </p>
              {/* Layer bianco (fade in) */}
              <p
                className="text-2xl text-gray-300 font-light absolute top-0 left-0"
                style={{
                  margin: 0,
                  opacity: colorEased,
                }}
              >
                {next.subtitle}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
