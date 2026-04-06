import { APP_CONFIG } from './app-config.js';

function openMailFallback(payload) {
  const lines = [
    'Bonjour,',
    '',
    'Voici une demande issue du pré-diagnostic Décret BACS EcoVerta.',
    '',
    `Nom : ${payload.name || '—'}`,
    `Email : ${payload.email || '—'}`,
    `Téléphone : ${payload.phone || '—'}`,
    `Organisation : ${payload.company || '—'}`,
    `Portefeuille : ${payload.portfolio_name || '—'}`,
    `Nombre de sites : ${payload.portfolio_sites || 0}`,
    `Surface : ${payload.portfolio_surface_m2 || 0} m²`,
    `CAPEX net : ${payload.portfolio_capex_net_eur || 0} €`,
    `Économies annuelles : ${payload.portfolio_savings_eur_an || 0} €`,
    `ROI portefeuille : ${payload.portfolio_roi_years ?? 'n/d'} ans`,
    `Top site : ${payload.top_site_name || '—'} (${payload.top_site_score || 0}/100)`,
    `Prochaine étape : ${payload.top_site_next_step || '—'}`,
    '',
    'Message :',
    payload.message || '—'
  ];

  const subject = encodeURIComponent(payload._subject || 'Demande EcoVerta');
  const body = encodeURIComponent(lines.join('\n'));
  window.location.href = `mailto:${APP_CONFIG.contactEmail || 'contact@ecovertaconsult.com'}?subject=${subject}&body=${body}`;
  return { mode: 'mailto' };
}

export async function sendLead(payload) {
  if (!APP_CONFIG.formspreeEndpoint) {
    return openMailFallback(payload);
  }

  const res = await fetch(APP_CONFIG.formspreeEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error('Erreur Formspree');
  return res.json();
}

export function buildPayload({ contact, portfolio, topSite }) {
  return {
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    company: contact.company || '',
    message: contact.message || '',
    portfolio_name: portfolio?.name || '',
    portfolio_sites: portfolio?.siteCount || 0,
    portfolio_surface_m2: Math.round(portfolio?.totalSurface || 0),
    portfolio_capex_net_eur: Math.round(portfolio?.totalCapex || 0),
    portfolio_savings_eur_an: Math.round(portfolio?.totalSavings || 0),
    portfolio_roi_years: portfolio?.roi != null ? Number(portfolio.roi.toFixed(1)) : null,
    portfolio_avg_lead: Math.round(portfolio?.avgLead || 0),
    portfolio_avg_reliability: Math.round(portfolio?.avgReliability || 0),
    top_site_name: topSite?.name || '',
    top_site_score: topSite?.leadScore || 0,
    top_site_roi: topSite?.roi != null ? Number(topSite.roi.toFixed(1)) : null,
    top_site_next_step: topSite?.nextStep || '',
    _subject: `Pré-diagnostic Décret BACS — ${portfolio?.name || 'Nouveau portefeuille'}`
  };
}
