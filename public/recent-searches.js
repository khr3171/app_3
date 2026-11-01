// Storage adapter: replace these methods with an authenticated Firebase adapter
// if cross-device history is requested later. Search history stays on this device.
const KEY='pass-search-history-v1';
export const historyStore={
 read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x.filter(v=>typeof v.query==='string'&&v.query.length<=200&&[2026,2027].includes(v.year)).slice(0,8):[];}catch{return [];}},
 save(query,year){const items=[{query,year,at:Date.now()},...this.read().filter(x=>x.query!==query||x.year!==year)].slice(0,8);try{localStorage.setItem(KEY,JSON.stringify(items));}catch{}return items;},
 clear(){try{localStorage.removeItem(KEY);}catch{}}
};
