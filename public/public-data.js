import {search} from './search-engine.js';
let loading;
async function corpus(){
 loading??=fetch(new URL('./corpus.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('자료를 불러오지 못했습니다. 새로고침 후 다시 검색해주세요.');return r.json();}).catch(e=>{loading=null;throw e;});
 return loading;
}
export async function publicRequest(path){
 const url=new URL(path,'https://local.invalid/');const route=url.pathname.slice(1);const c=await corpus();
 if(route==='documents')return Response.json({documents:c.documents,quality:c.quality});
 if(route==='search')return Response.json({...search(url.searchParams.get('q')||'',{year:Number(url.searchParams.get('year')||2026)},c),web:{status:'public',items:[],message:'등록된 법령·지침 원문을 검색합니다. 실시간 외부 검색은 연결되지 않았습니다.'}});
 if(route==='source'){
  const d=c.documents.find(d=>d.id===url.searchParams.get('id'));if(!d||!/^doc-\d+\.(pdf|hwp)$/.test(d.file))throw Error('원본을 찾을 수 없습니다.');
  const response=await fetch(new URL('./'+d.file+'.bin',import.meta.url));if(!response.ok)throw Error('원본을 불러오지 못했습니다.');return new Response(await response.arrayBuffer(),{headers:{'Content-Type':d.file.endsWith('.pdf')?'application/pdf':'application/octet-stream'}});
 }
 throw Error('지원하지 않는 요청입니다.');
}
