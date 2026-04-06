export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function computePriorityScore(poste) {
  let score = 0;

  if (Number.isFinite(poste.payback)) {
    if (poste.payback <= 3) score += 30;
    else if (poste.payback <= 5) score += 24;
    else if (poste.payback <= 8) score += 17;
    else if (poste.payback <= 12) score += 10;
    else score += 4;
  }

  if (poste.gainPct >= 18) score += 24;
  else if (poste.gainPct >= 12) score += 18;
  else if (poste.gainPct >= 7) score += 10;
  else score += 4;

  if (poste.capexM2 <= 15) score += 18;
  else if (poste.capexM2 <= 50) score += 12;
  else if (poste.capexM2 <= 100) score += 7;

  if (poste.complexity === 'low') score += 14;
  else if (poste.complexity === 'medium') score += 8;
  else score += 3;

  if (poste.regulatory) score += 12;
  if (poste.priority === 'quick-win') score += 10;
  if (poste.dependsSatisfied) score += 4;
  if (poste.maturityFit) score += 5;

  return clamp(Math.round(score));
}

export function classifyPoste(score) {
  if (score >= 78) return 'quick_win';
  if (score >= 55) return 'prioritaire';
  return 'structurant';
}

export function computeLeadScore(site) {
  let score = 0;
  const gapPct = Number(site.gapPct) || 0;

  if (gapPct >= 30) score += 24;
  else if (gapPct >= 18) score += 16;
  else if (gapPct >= 8) score += 9;
  else score += 4;

  if (site.surface >= 10000) score += 18;
  else if (site.surface >= 5000) score += 14;
  else if (site.surface >= 1500) score += 9;
  else score += 5;

  if (site.gtb === 'non') score += 14;
  else if (site.gtb === 'partielle') score += 7;

  if (site.projectIntent === 'travaux_12m') score += 12;
  else if (site.projectIntent === 'travaux_24m') score += 8;
  else if (site.projectIntent === 'audit') score += 5;

  if (site.segment === 'public') score += 8;
  if (site.dataQuality === 'bonne') score += 5;
  if (site.dataQuality === 'faible') score -= 2;

  return clamp(Math.round(score));
}
