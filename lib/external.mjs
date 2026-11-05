export async function externalSearch(query){
 if(!process.env.TAVILY_API_KEY)return {status:'unconfigured',items:[],message:'실시간 외부 법령 검색이 연결되지 않았습니다. 아래 업로드 지침만 검색했으며 최신 법령 검토는 완료되지 않았습니다.'};
 try{
 const response=await fetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:process.env.TAVILY_API_KEY,query:query+' 사회서비스원',include_domains:['law.go.kr','busan.go.kr','mois.go.kr','mohw.go.kr'],max_results:5,include_answer:false}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('provider');
 const data=await response.json();
 const allowed=['law.go.kr','busan.go.kr','mois.go.kr','mohw.go.kr'];
 const items=(data.results||[]).filter(r=>{try{const u=new URL(r.url);return u.protocol==='https:'&&allowed.some(d=>u.hostname===d||u.hostname.endsWith('.'+d));}catch{return false;}}).map(r=>({title:r.title,url:r.url,content:r.content,type:'참고자료',effective:'공식 원문에서 확인 필요',relationship:'검색 관련성이 있는 공식 자료 · 직접 적용 및 준용 근거 미검증'}));
 return {status:'ok',items,message:'공식 출처 검색 결과입니다. 직접 적용·준용 여부와 시행일은 검증 전입니다.'};
 }catch{return {status:'error',items:[],message:'외부 법령 검색에 실패했습니다. 법령이 없다는 의미가 아니며, 최신 법령 검토는 완료되지 않았습니다.'};}
}
