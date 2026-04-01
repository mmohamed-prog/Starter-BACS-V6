export function createStorageService(key){
  return {
    save(data){ localStorage.setItem(key, JSON.stringify(data)); },
    load(){
      try{ return JSON.parse(localStorage.getItem(key) || 'null'); }
      catch{ return null; }
    },
    clear(){ localStorage.removeItem(key); }
  };
}
