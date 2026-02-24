// Definizione di tutti i flussi disponibili
export const workflows = {
  home: {
    id: 'home',
    sections: [
      {
        id: 0,
        title: "personal demo space",
        subtitle: "Select a workflow to explore",
        gradient: "from-slate-200 via-gray-300 to-gray-400",
      }
    ]
  },
  materialsInformatics: {
    id: 'materialsInformatics',
    sections: [
      {
        id: 0,
        title: "overview",
        subtitle: "Imagine you want to discover <strong>new materials</strong>. You would start from existing ones and change their structure one at a time, testing each variation to see if it has the desired properties. This is <strong>slow and expensive</strong>. Now, imagine if you had a tool that could optimize the entire process, accelerating the discovery of new materials with desired properties. This is where <strong>AI comes in</strong>.",
        gradient: "from-purple-600 via-pink-600 to-red-600",
      },
      {
        id: 1,
        title: "generate",
        subtitle: "Leverage <strong>combinatorial and data-driven techniques</strong> to explore vast chemical spaces and identify promising candidates based on desired structures. Use <strong>GenAI models</strong> to create novel material structures with desired properties.",
        gradient: "from-blue-600 via-cyan-600 to-teal-600",
      },
      {
        id: 2,
        title: "predict",
        subtitle: "Trained on <strong>extensive and modern datasets</strong>, advanced Machine Learning and Deep Learning models can <strong>accurately predict material properties</strong>, enabling rapid screening of candidates.",
        gradient: "from-orange-600 via-red-600 to-pink-600",
      },
      {
        id: 3,
        title: "select",
        subtitle: "Select top candidates based on <strong>target criteria</strong> such as conductivity, stability, toxicity, or binding affinity. Focus resources on <strong>high-potential molecules</strong> that meet specific requirements.",
        gradient: "from-yellow-600 via-amber-600 to-orange-600",
      },
      {
        id: 4,
        title: "validate",
        subtitle: "Scientists validate candidates through <strong>computational chemistry and laboratory experiments</strong>. The advantage: testing only a <strong>reduced number of high-potential candidates</strong> instead of thousands of compounds.",
        gradient: "from-green-600 via-emerald-600 to-teal-600",
      },
      {
        id: 5,
        title: "industries",
        subtitle: "Materials informatics is transforming <strong>multiple sectors</strong>, from automotive to pharmaceuticals, enabling <strong>targeted innovation</strong> and competitive advantages.",
        gradient: "from-blue-600 via-cyan-600 to-teal-600",
      },
      {
        id: 6,
        title: "impact",
        subtitle: "<strong>Accelerate the innovation</strong> and reduce time and cost of material discovery; enable the development of <strong>targeted materials</strong> for various applications such as <strong>energy storage, pharmaceutics, catalysis, and electronics</strong>.",
        gradient: "from-indigo-600 via-purple-600 to-pink-600",
      },
    ]
  },
  deepSpectrum: {
    id: 'deepSpectrum',
    sections: [
      {
        id: 0,
        title: "overview",
        subtitle: "When analyzing a compound, one common technique is to separate the molecules present in the sample and then analyze them individually. This technique is called liquid chromatography–tandem mass spectrometry (LC–MS/MS).<br>However, the instrument does not directly provide the names of the molecules. Instead, it generates mass spectra, which must be interpreted to identify and characterize the compounds. This is not a simple process; it requires a combination of chemical expertise and advanced analytical tools. But what if AI could join this process?",        
        gradient: "from-emerald-600 via-green-600 to-teal-600",
      },
      {
        id: 1,
        title: "global screening",
        subtitle: "Each peak in your chromatogram is compared against <strong>MassBank Europe</strong> (20,000+ public MS2 spectra) using <strong>CosineGreedy</strong> fragment similarity. This fast, established approach gives you a first-pass identification against the broadest publicly available reference.",
        gradient: "from-amber-600 via-orange-600 to-red-600",
      },
      {
        id: 2,
        title: "knowledge base",
        subtitle: "Load a curated, domain-specific reference collection. For example, the <strong>ECRFS/Wageningen library</strong> of 102 PMT (persistent, mobile, toxic) compounds is a regulatory-grade baseline — each entry annotated with MS/MS spectra, exact masses, and EFSA toxicological scores.",
        gradient: "from-amber-600 via-orange-600 to-red-600",
      },
      {
        id: 3,
        title: "spectral matching",
        subtitle: "The same fragment-matching logic is now applied to your local dataset using <strong>ModifiedCosine</strong> — a more rigorous cosine variant that accounts for neutral losses. Searching a focused set can reduce false positives relative to a broad public search.",
        gradient: "from-amber-600 via-orange-600 to-red-600",
      },
      {
        id: 4,
        title: "vectorization",
        subtitle: "<strong>Spec2Vec</strong> encodes each MS2 spectrum as a 300-dimensional vector, the same idea as Word2Vec, but for chemical language. Two spectra that share chemical structure will be close in this embedding space, even when they share few exact fragment peaks.",
        gradient: "from-purple-600 via-violet-600 to-indigo-600",
      },
      {
        id: 5,
        title: "AI similarity search",
        subtitle: "The same search over <strong>both</strong> a local curated dataset and the full MassBank catalogue now runs in vector space. Previously unmatched compounds now can become reachable because the comparison is no longer limited to shared fragment lists.",
        gradient: "from-purple-600 via-violet-600 to-indigo-600",
      },
      {
        id: 6,
        title: "comparative results",
        subtitle: "Side-by-side comparison of all methods: <strong>Global Screening</strong> (classical, public DB), <strong>Spectral Matching</strong> (classical, specific library), and <strong>AI Similarity Search</strong> (Spec2Vec, both databases). Consensus between independent approaches strengthens confidence.",
        gradient: "from-teal-600 via-cyan-600 to-sky-600",
      },
      {
        id: 7,
        title: "summary",
        subtitle: "Platform pipeline recap, scientific foundation, and coverage metrics. Key performance indicators sourced from peer-reviewed literature and authoritative databases.",
        gradient: "from-fuchsia-600 via-purple-600 to-indigo-600",
      },
      {
        id: 8,
        title: "impact & future perspective",
        subtitle: "AI-based identification extends coverage beyond fixed reference libraries. The architecture is designed to scale — from a fast local instance to production-grade systems powered by engines like <strong>SIRIUS</strong>, without changing the workflow logic.",
        gradient: "from-indigo-600 via-blue-600 to-cyan-600",
      },
    ]
  },
  dataFusion: {
    id: 'dataFusion',
    sections: [
      {
        id: 0,
        title: "import datasets",
        subtitle: "Upload one or more <strong>CSV files</strong> to begin. Each file is parsed and inspected: column names, row count, and a preview are shown so you can confirm the data loaded correctly.",
        gradient: "from-green-600 via-emerald-600 to-teal-600",
      },
      {
        id: 1,
        title: "align columns",
        subtitle: "Map columns from each source file to a <strong>unified schema</strong>. Rename columns to a canonical name, exclude irrelevant ones, and choose which column is the <strong>join key</strong> (e.g. SMILES).",
        gradient: "from-teal-600 via-cyan-600 to-sky-600",
      },
      {
        id: 2,
        title: "resolve conflicts",
        subtitle: "Detect and handle data quality issues: <strong>case inconsistencies</strong> (\"Sweet\" vs \"sweet\"), <strong>exact duplicates</strong>, and <strong>key conflicts</strong> (same molecule, different label). Choose a resolution strategy for each category.",
        gradient: "from-sky-600 via-blue-600 to-indigo-600",
      },
      {
        id: 3,
        title: "export result",
        subtitle: "Merge all sources into a <strong>single unified dataset</strong>. Preview the result, inspect the merge statistics, and download the final CSV — ready for model training.",
        gradient: "from-indigo-600 via-violet-600 to-purple-600",
      },
    ]
  },
  digitalTwin: {
    id: 'digitalTwin',
    sections: [
      {
        id: 0,
        title: "select dataset",
        subtitle: "Choose a <strong>dataset</strong> to begin your machine learning workflow",
        gradient: "from-cyan-600 via-blue-600 to-indigo-600",
      },
      {
        id: 1,
        title: "choose models",
        subtitle: "Select one or more <strong>classification models</strong> to train on your dataset",
        gradient: "from-blue-600 via-indigo-600 to-purple-600",
      },
      {
        id: 2,
        title: "train models",
        subtitle: "Watch your models <strong>train</strong>, evaluate their performance, and visualize predictions",
        gradient: "from-purple-600 via-pink-600 to-red-600",
      },
      {
        id: 3,
        title: "feature importance",
        subtitle: "Discover which <strong>sensors and variables</strong> influence model predictions the most",
        gradient: "from-green-600 via-emerald-600 to-teal-600",
      }
    ]
  }
};