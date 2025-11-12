// Configurazione centralizzata per timing e easing
export const ANIMATION_CONFIG = {
  // Timing
  exitTrigger: 0.9,
  colorSwitchStart: 0.1,
  colorSwitchEnd: 0.95,
  
  // Easing function condivisa
  easeInOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  
  // Utility
  clamp: (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
};

// Funzione che calcola SOLO i valori base di progressione
export function getAnimationProgress(scrollIndex, activeIndex, sectionsLength) {
  const { easeInOutCubic, clamp, exitTrigger } = ANIMATION_CONFIG;
  
  const currentIndex = Math.max(0, Math.min(sectionsLength - 1, activeIndex));
  const signedProgress = scrollIndex - currentIndex;
  const direction = signedProgress === 0 ? 0 : Math.sign(signedProgress);
  const absP = clamp(Math.abs(signedProgress), 0, 1);
  const eased = easeInOutCubic(absP);
  
  const exitProgress = clamp((absP - exitTrigger) / (1 - exitTrigger), 0, 1);
  const exitProgressEased = easeInOutCubic(exitProgress);
  
  return {
    currentIndex,
    nextIndex: direction >= 0 ? currentIndex + 1 : currentIndex - 1,
    direction,
    absP,           // progress assoluto 0-1
    eased,          // progress con easing applicato
    exitProgress,   // progress della fase di exit
    exitProgressEased,
    // Opacità pre-calcolate (utili per tutti)
    currentOpacity: clamp(1 - exitProgressEased, 0, 1),
    nextOpacity: eased
  };
}