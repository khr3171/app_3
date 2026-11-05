import {search} from './search-engine.js';
import {mergeRevisions} from './revision-merge.js';
let loading;
async function corpus(){
 loading??=fetch(new URL('./corpus.json',import.meta.url)).then(async r=>{if(!r.ok)throw Error('자료를 불러오지 못했습니다. 새로고침 후 다시 검색해주세요.');const base=await r.json();if(!location.hostname||location.hostname.endsWith('github.io')||location.protocol==='file:')return base;const response=await fetch('/api/public-revisions',{cache:'no-store'});if(!response.ok)throw Error('최신 개정 자료를 확인하지 못했습니다. 잠시 후 새로고침해주세요.');const data=await response.json();const revisions=[];for(const item of data.revisions){const rr=await fetch('/api/public-revisions?id='+encodeURIComponent(item.document.revisionId),{cache:'no-store'});if(!rr.ok)throw Error('개정 본문을 불러오지 못했습니다.');const detail=await rr.json();if(!detail.revisions.length)throw Error('자료가 갱신되었습니다. 새로고침해주세요.');revisions.push(...detail.revisions);}return mergeRevisions(base,revisions);}).catch(e=>{loading=null;throw e;});
 return loading;
}
export async function publicRequest(path){
 const url=new URL(path,'https://local.invalid/');const route=url.pathname.slice(1);const c=await corpus();
 if(route==='documents')return Response.json({documents:c.documents,quality:c.quality});
 if(route==='search')return Response.json({...search(url.searchParams.get('q')||'',{year:Number(url.searchParams.get('year')||2026)},c),revised:!!c.revised,web:{status:'public',items:[],message:'등록된 법령·지침 원문을 검색합니다. 실시간 외부 검색은 연결되지 않았습니다.'}});
 if(route==='source'){
  const d=c.documents.find(d=>d.id===url.searchParams.get('id'));if(d?.revisionId){const r=await fetch('/api/revision-source?id='+encodeURIComponent(d.revisionId));if(!r.ok)throw Error('개정 원문을 불러오지 못했습니다.');const meta=await r.json();const parts=[];for(let i=0;i<meta.count;i++){const part=await fetch('/api/revision-source?id='+encodeURIComponent(d.revisionId)+'&part='+i);if(!part.ok)throw Error('원문 다운로드에 실패했습니다.');parts.push(await part.arrayBuffer());}return new Response(new Blob(parts,{type:meta.type}));}if(!d||!/^doc-\d+\.(pdf|hwp)$/.test(d.file))throw Error('원본을 찾을 수 없습니다.');
  const response=await fetch(new URL('./'+d.file+'.bin',import.meta.url));if(!response.ok)throw Error('원본을 불러오지 못했습니다.');return new Response(await response.arrayBuffer(),{headers:{'Content-Type':d.file.endsWith('.pdf')?'application/pdf':'application/octet-stream'}});
 }
 throw Error('지원하지 않는 요청입니다.');
}
