import React from "react";

const models = [
  {
    name: "AdaBoost",
    description: "Adaptive boosting that combines weak learners sequentially",
    gradient: "from-cyan-600 to-blue-600"
  },
  {
    name: "Gradient Boosting",
    description: "Builds trees sequentially to minimize loss function",
    gradient: "from-blue-600 to-indigo-600"
  },
  {
    name: "Random Forest",
    description: "Ensemble of decision trees with random feature selection",
    gradient: "from-indigo-600 to-purple-600"
  },
  {
    name: "Decision Tree",
    description: "Tree-based model with interpretable decision rules",
    gradient: "from-purple-600 to-pink-600"
  }
];

const ModelSelector = ({ selectedModels, onToggle, canProceed }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="grid grid-cols-2 gap-6 max-w-5xl">
        {models.map((model) => {
          const isSelected = selectedModels.includes(model.name);
          
          return (
            <button
              key={model.name}
              onClick={() => onToggle(model.name)}
              disabled={!canProceed}
              className={`
                relative p-8 rounded transition-all duration-300
                ${isSelected 
                  ? `bg-gradient-to-r ${model.gradient}` 
                  : 'bg-[#1a1a1a] hover:scale-105'
                }
                ${!canProceed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Checkmark quando selezionato */}
              {isSelected && (
                <div className="absolute top-4 right-4">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              
              <h3 className={`text-2xl font-bold mb-3 ${isSelected ? 'text-white' : 'text-white'}`}>
                {model.name}
              </h3>
              
              <p className={`text-sm ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                {model.description}
              </p>
            </button>
          );
        })}
      </div>
      
      {!canProceed && (
        <div className="mt-8 text-gray-500 text-center">
          Please select a dataset first
        </div>
      )}
      
      {canProceed && selectedModels.length === 0 && (
        <div className="mt-8 text-gray-400 text-center">
          Select at least one model to continue
        </div>
      )}
    </div>
  );
};

export default ModelSelector;