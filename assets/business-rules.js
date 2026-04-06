export const USAGE_RULES = {
  bureaux: { benchmark: 185, capexFactor: 1.0, complexity: 1.0 },
  enseignement: { benchmark: 150, capexFactor: 0.96, complexity: 0.95 },
  sante: { benchmark: 310, capexFactor: 1.18, complexity: 1.16 },
  commerce: { benchmark: 260, capexFactor: 1.08, complexity: 1.05 },
  hotel: { benchmark: 280, capexFactor: 1.10, complexity: 1.08 },
  mixte: { benchmark: 230, capexFactor: 1.04, complexity: 1.05 },
  autre: { benchmark: 210, capexFactor: 1.0, complexity: 1.0 }
};

export const SEGMENT_FACTORS = {
  tertiaire: { urgencyBonus: 8 },
  public: { urgencyBonus: 10 },
  industrie: { urgencyBonus: 5 }
};

export const GTB_FACTORS = {
  non: { savings: 1.12, maturityPenalty: 16, capex: 1.08 },
  partielle: { savings: 1.0, maturityPenalty: 7, capex: 1.0 },
  complete: { savings: 0.92, maturityPenalty: 0, capex: 0.93 }
};

export const DATA_QUALITY = {
  faible: { reliability: 52, savings: 0.94, capex: 1.05 },
  moyenne: { reliability: 72, savings: 1.0, capex: 1.0 },
  bonne: { reliability: 88, savings: 1.03, capex: 0.98 }
};

export const PROJECT_INTENT = {
  aucune: { urgency: 0, capex: 1.0 },
  audit: { urgency: 7, capex: 0.98 },
  travaux_24m: { urgency: 11, capex: 1.0 },
  travaux_12m: { urgency: 16, capex: 1.03 }
};

export const SIZE_BUCKETS = [
  { max: 1500, capex: 1.08, reliability: 0 },
  { max: 5000, capex: 1.0, reliability: 3 },
  { max: 12000, capex: 0.95, reliability: 5 },
  { max: Infinity, capex: 0.91, reliability: 7 }
];

export const AIDE_LIMITS = { min: 0, max: 60 };

export const CATALOG_CATEGORY_FACTORS = {
  pilotage: { synergy: 1.0, repeatPenalty: 0.88 },
  instrumentation: { synergy: 0.98, repeatPenalty: 0.9 },
  supervision: { synergy: 1.02, repeatPenalty: 0.9 },
  cvc: { synergy: 1.05, repeatPenalty: 0.9 },
  commissionnement: { synergy: 1.03, repeatPenalty: 0.92 }
};

export const BACS_FRAME = {
  decreeLabel: 'Décret BACS',
  thresholdKwPrimary: 70,
  thresholdKwLegacy: 290,
  targetDate70Kw: '2027-01-01',
  targetDate290Kw: '2025-01-01'
};
