export const MEASURES_CATALOG = [
  { id: 'gtb_socle', label: 'GTB / BACS socle', gain: 0.11, capexM2: 16, complexity: 'medium', regulatory: true, priority: 'quick-win', category: 'pilotage', active: true },
  { id: 'sous_comptage', label: 'Sous-comptage et remontées horaires', gain: 0.04, capexM2: 7, complexity: 'low', regulatory: true, priority: 'quick-win', category: 'instrumentation', active: true },
  { id: 'programmation', label: 'Calendriers, consignes et arrêt / relance', gain: 0.05, capexM2: 3, complexity: 'low', regulatory: true, priority: 'quick-win', category: 'pilotage', dependencies: ['gtb_socle'], active: true },
  { id: 'supervision', label: 'Supervision centralisée', gain: 0.06, capexM2: 9, complexity: 'medium', regulatory: true, priority: 'quick-win', category: 'supervision', dependencies: ['gtb_socle'], active: true },
  { id: 'interoperabilite', label: 'Interopérabilité et nomenclature des points', gain: 0.03, capexM2: 5, complexity: 'medium', regulatory: true, priority: 'quick-win', category: 'pilotage', active: true },
  { id: 'alarmes', label: 'Alarmes, dérives et suivi des défauts', gain: 0.04, capexM2: 4, complexity: 'low', regulatory: true, priority: 'quick-win', category: 'supervision', dependencies: ['supervision'], active: true },
  { id: 'zonage_sondes', label: 'Zonage, sondes et remontées d’ambiance', gain: 0.05, capexM2: 11, complexity: 'medium', regulatory: false, priority: 'structurant', category: 'cvc', active: true },
  { id: 'optim_cvc', label: 'Optimisation des séquences CVC', gain: 0.08, capexM2: 14, complexity: 'medium', regulatory: true, priority: 'quick-win', category: 'cvc', dependencies: ['gtb_socle'], active: true },
  { id: 'commissionnement', label: 'Commissionnement et re-réglages', gain: 0.06, capexM2: 6, complexity: 'medium', regulatory: false, priority: 'structurant', category: 'commissionnement', dependencies: ['gtb_socle'], active: true }
];

export function cloneCatalog() {
  return MEASURES_CATALOG.map(item => ({ ...item, selected: false }));
}
