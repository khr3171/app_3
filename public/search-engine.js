const compact=s=>s.normalize('NFKC').toLowerCase().replace(/\s/g,'');
const synonyms={심사수당:['심사','심의','위원수당','위원회','수당'],회의수당:['회의','참석수당','위원회','수당'],강사료:['강사수당','강의','강사'],원고료:['원고','집필'],출장비:['여비','출장'],식비:['급량비','식사','식비'],연차:['연가','휴가','연차']};
export function search(query,{year=2026,limit=12}={},corpus){
 const documents=corpus.documents;
 const indexed=corpus.chunks.map(c=>({...c,norm:compact(c.text)}));
 const q=query.trim();if(!q||q.length>200)throw new Error('검색어는 1~200자로 입력해주세요.');
 const words=q.split(/\s+/).map(w=>w.replace(/(에대해|알려줘|얼마인가요|인가요|해주세요|에대한)$/g,'')).filter(w=>w.length>1);
 const normalized=compact(q);const expanded=Object.entries(synonyms).filter(([key])=>normalized.includes(key)).flatMap(([,v])=>v);
 const hits=indexed.map(c=>{
  const doc=documents.find(d=>d.id===c.docId);if(doc.year&&doc.year!==Number(year))return null;
  if(c.ruleTitle==='규정집 표지·목차')return null;
  if(normalized.includes('심사수당')&&!(corpus.curatedPages?.['심사수당']?.docId===c.docId&&corpus.curatedPages['심사수당'].pages.includes(c.page))&&!(c.norm.includes('심사')&&c.norm.includes('수당')))return null;
  let score=c.norm.includes(normalized)?100:0;
  if(normalized.includes('심사수당')&&corpus.curatedPages?.['심사수당']?.docId===c.docId&&corpus.curatedPages['심사수당'].pages.includes(c.page))score+=150;
  for(const w of words){const t=compact(w);if(c.norm.includes(t))score+=25;}
  for(const w of expanded)if(c.norm.includes(w))score+=7;
  if(!score||(!c.norm.includes(normalized)&&score<14))return null;
  const terms=[normalized,...words.map(compact),...expanded];
  const direct=c.norm.includes(normalized)||words.some(w=>c.norm.includes(compact(w)));
  const {norm,...rest}=c;
  return {...rest,document:doc,score,direct,terms};
 }).filter(Boolean).sort((a,b)=>b.score-a.score);
 function unique(list){const seen=new Set();return list.filter(h=>{const k=h.docId+'-'+h.location+'-'+Math.floor(h.offset/2000);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,limit);}
 const internal=unique(hits.filter(h=>h.kind==='internal').sort((a,b)=>Number(b.direct)-Number(a.direct)||b.score-a.score));
 const external=unique(hits.filter(h=>h.kind!=='internal'));
 const answerKey=Object.keys(corpus.answers||{}).find(k=>normalized.includes(compact(k)));
 const answer=answerKey?corpus.answers[answerKey]:null;
 return {query:q,year:Number(year),internal,external,answer,total:hits.length,mode:'원문 근거 검색',missing:!internal.length,notice:'검색 우선순위는 법적 효력의 우선순위를 의미하지 않습니다. 강행법규와 직접 적용되는 상위 법령에 위반되는 내부규정은 우선 적용할 수 없습니다.'};
}
