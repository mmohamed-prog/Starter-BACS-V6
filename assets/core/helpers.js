export function clone(value){ return structuredClone(value); }
export function setByPath(obj, path, value){
  const parts = path.split('.');
  let ref = obj;
  for(let i=0;i<parts.length-1;i++){
    if(!ref[parts[i]]) ref[parts[i]] = {};
    ref = ref[parts[i]];
  }
  ref[parts[parts.length-1]] = value;
}
export function getByPath(obj, path){
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}
export function eur(x){
  return Number.isFinite(x) ? new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Math.round(x)) : '—';
}
export function int0(x){
  return Number.isFinite(x) ? new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Math.round(x)) : '—';
}
export function dec1(x){
  return Number.isFinite(x) ? new Intl.NumberFormat('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1}).format(x) : '—';
}
export function num(v){
  const n = Number(String(v ?? '').replace(/\s/g,'').replace(',','.'));
  return Number.isFinite(n) ? n : NaN;
}
