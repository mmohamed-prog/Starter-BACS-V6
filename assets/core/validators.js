import { num } from './helpers.js';

const FREE_DOMAINS = new Set(['gmail.com','googlemail.com','hotmail.com','outlook.com','live.com','msn.com','yahoo.com','yahoo.fr','icloud.com','orange.fr','laposte.net','free.fr','sfr.fr','bbox.fr','wanadoo.fr','proton.me','protonmail.com']);

export function sanitizeText(v, max = 120){
  return String(v ?? '').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0, max);
}
export function isEmail(v){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? '').trim().toLowerCase());
}
export function isBusinessEmail(v){
  const email = String(v ?? '').trim().toLowerCase();
  if(!isEmail(email)) return false;
  const domain = email.split('@')[1] || '';
  return !FREE_DOMAINS.has(domain);
}
export function validateSite(site){
  const errors = {};
  if(!sanitizeText(site.name, 90)) errors.name = 'Nom de site requis.';
  if(!(Number.isFinite(site.surface) && site.surface > 0)) errors.surface = 'Surface invalide.';
  if(!(Number.isFinite(site.baseKwh) && site.baseKwh > 0)) errors.baseKwh = 'Consommation invalide.';
  if(!(Number.isFinite(site.priceKwh) && site.priceKwh > 0)) errors.priceKwh = 'Prix énergie invalide.';
  if(!(Number.isFinite(site.powerKw) && site.powerKw > 0)) errors.powerKw = 'Puissance invalide.';
  return errors;
}
export function validateLead(contact){
  const errors = {};
  if(!sanitizeText(contact.firstName,60)) errors.firstName = 'Prénom requis.';
  if(!sanitizeText(contact.lastName,60)) errors.lastName = 'Nom requis.';
  if(!sanitizeText(contact.company,100)) errors.company = 'Société requise.';
  if(!isBusinessEmail(contact.email)) errors.email = 'E-mail professionnel valide requis.';
  if(!contact.consent) errors.consent = 'Consentement requis.';
  return errors;
}
