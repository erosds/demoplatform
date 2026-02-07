import React, { useEffect, useRef, useState } from "react";

const MoleculeRenderer = ({ smiles, size = 128 }) => {
  const canvasRef = useRef(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !smiles) return;

    if (typeof window.SmilesDrawer === "undefined") {
      console.error("SmilesDrawer non caricato");
      setRenderError(true);
      return;
    }

    try {
      setRenderError(false); // Reset errore
      const drawer = new window.SmilesDrawer.Drawer({
        width: size,
        height: size,
        bondThickness: 2,
        bondColor: "#FFFFFF",
        atomColor: "#61DAFB",
        padding: 30,
      });

      window.SmilesDrawer.parse(
        smiles,
        (tree) => {
          try {
            drawer.draw(tree, canvasRef.current, "dark", false);
          } catch (drawError) {
            console.error("Errore nel disegno della molecola:", smiles);
            console.error("Dettaglio errore:", drawError);
            setRenderError(true);
          }
        },
        (parseError) => {
          // Callback di errore per il parsing
          console.error("Errore nel parsing SMILES:", smiles);
          console.error("Dettaglio errore:", parseError);
          setRenderError(true);
        }
      );
    } catch (error) {
      console.error("Errore generale rendering SMILES:", smiles);
      console.error("Dettaglio errore:", error);
      setRenderError(true);
    }
  }, [smiles, size]);

  if (renderError) {
    return (
      <div className="w-full h-full flex items-center justify-center p-2">
        <p className="text-xs text-gray-400 break-all text-center font-mono">
          {smiles}
        </p>
      </div>
    );
  }

  return <canvas ref={canvasRef} width={size} height={size} />;
};

export default MoleculeRenderer;
