export async function submitLeadToFormspree(url, payload){
  if(!url || url.includes('REPLACE_WITH_YOUR_FORM_ID')) throw new Error('Configure Formspree dans assets/app.js');
  const res = await fetch(url, {
    method:'POST',
    headers:{ 'Accept':'application/json', 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  if(!res.ok) throw new Error('Échec de l’envoi du lead');
  return res.json().catch(() => ({}));
}
