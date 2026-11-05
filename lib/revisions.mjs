import {randomUUID} from 'node:crypto';
import {database,fail,readJSON} from './admin.mjs';
const MAX_FILE=20*1024*1024, PART=240*1024;
export function validateRevision(v){
 if(typeof v.name!=='string'||!v.name.trim()||v.name.length>180||!['pdf','txt'].includes(v.format)||!['internal','guideline','manual'].includes(v.kind)||!/^\d{4}-\d{2}-\d{2}$/.test(v.effectiveDate)||!Number.isInteger(v.bytes)||v.bytes<1||v.bytes>MAX_FILE||!Number.isInteger(v.textBytes)||v.textBytes<20||v.textBytes>2*1024*1024)throw fail(400,'제목·시행일·파일 형식·용량을 확인해주세요.');
 if(v.year!==null&&(!Number.isInteger(v.year)||v.year<2000||v.year>2100))throw fail(400,'기준연도를 확인해주세요.');
 if(typeof v.target!=='string'||!/^doc-[1-5]$|^new$|^rev-[a-f0-9-]{36}$/.test(v.target))throw fail(400,'교체할 자료를 확인해주세요.');
 return {name:v.name.trim(),format:v.format,kind:v.kind,effectiveDate:v.effectiveDate,year:v.year,target:v.target,bytes:v.bytes,textBytes:v.textBytes,fileParts:Math.ceil(v.bytes/PART),textParts:Math.ceil(v.textBytes/PART)};
}
export function buildRevision(meta,pages){
 if(!Array.isArray(pages)||!pages.length||pages.length>1500||pages.some(p=>typeof p!=='string'||p.length>100000)||pages.join('').trim().length<20)throw fail(400,'추출된 본문을 확인해주세요. 이미지 PDF는 텍스트 인식 후 등록해주세요.');
 const id=meta.slot;const document={id,name:meta.name,kind:meta.kind,year:meta.year,file:`${id}.${meta.format}`,revisionId:meta.id,effectiveDate:meta.effectiveDate,units:pages.length,characters:pages.join('').length,extraction:'관리자 확인 후 공개한 개정 자료',emptyUnits:pages.flatMap((p,i)=>p.trim()?[]:[i+1])};
 const chunks=[];pages.forEach((text,i)=>{for(let offset=0;offset<text.length;offset+=2200){chunks.push({id:`${id}-${i+1}-${offset}`,docId:id,kind:meta.kind,ruleTitle:meta.name,location:`${meta.format==='pdf'?'PDF':'본문'} ${i+1}쪽`,page:i+1,offset,text:text.slice(offset,offset+2400)});}});
 return {document,chunks};
}
async function readParts(db,ref,type,count){const buffers=[];for(let start=0;start<count;start+=8){const rows=await db.getAll(...Array.from({length:Math.min(8,count-start)},(_,i)=>ref.collection('parts').doc(`${type}-${start+i}`)));if(rows.some(d=>!d.exists))throw fail(409,'업로드가 완료되지 않았습니다. 다시 업로드해주세요.');buffers.push(...rows.map(d=>d.data().payload));}return Buffer.concat(buffers);}
export async function revisionAdmin(req,user){
 const db=await database();
 if(req.method==='GET'){const snap=await db.collection('ruleRevisions').orderBy('createdAt','desc').limit(40).get();return {items:snap.docs.map(d=>({id:d.id,...d.data()}))};}
 if(req.method!=='POST')throw fail(405,'허용되지 않는 요청입니다.');
 const body=await readJSON(req);
 if(body.action==='start'){
  const value=validateRevision(body);const id=randomUUID();const slot=value.target==='new'?'rev-'+id:value.target;
  const ref=db.collection('ruleRevisions').doc(id);await ref.set({...value,id,slot,status:'draft',createdAt:new Date().toISOString(),createdBy:user.email});return {id,partSize:PART};
 }
 if(!/^[a-f0-9-]{36}$/.test(body.id||''))throw fail(400,'자료 식별자가 올바르지 않습니다.');
 const ref=db.collection('ruleRevisions').doc(body.id);
 if(body.action==='part'){
  if(!['file','text'].includes(body.type)||!Number.isInteger(body.index)||body.index<0||typeof body.payload!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.payload))throw fail(400,'파일 조각이 올바르지 않습니다.');
  const payload=Buffer.from(body.payload,'base64');if(payload.length>PART)throw fail(413,'파일 조각이 너무 큽니다.');
  await db.runTransaction(async tx=>{const snap=await tx.get(ref);const m=snap.data();if(!m||m.status!=='draft')throw fail(409,'수정 가능한 초안이 아닙니다.');const count=m[body.type+'Parts'];const size=m[body.type==='file'?'bytes':'textBytes'];if(body.index>=count||payload.length!==Math.min(PART,size-body.index*PART))throw fail(400,'파일 조각 길이가 다릅니다.');tx.set(ref.collection('parts').doc(`${body.type}-${body.index}`),{payload});});return {ok:true};
 }
 if(body.action!=='publish'||body.confirm!==true)throw fail(400,'공개 반영 확인이 필요합니다.');
 // Freeze first so part uploads cannot race with validation; keep large blobs outside the transaction.
 const meta=await db.runTransaction(async tx=>{const snap=await tx.get(ref);const m=snap.data();if(!m||!['draft','validating'].includes(m.status))throw fail(409,'이미 반영했거나 존재하지 않는 초안입니다.');tx.update(ref,{status:'validating'});return m;});
 const file=await readParts(db,ref,'file',meta.fileParts);const raw=await readParts(db,ref,'text',meta.textParts);
 if(file.length!==meta.bytes||raw.length!==meta.textBytes||(meta.format==='pdf'&&file.subarray(0,5).toString()!=='%PDF-'))throw fail(400,'파일 검증에 실패했습니다. 다시 업로드해주세요.');
 let pages;try{pages=JSON.parse(raw.toString());}catch{throw fail(400,'추출 본문 형식이 올바르지 않습니다.');}buildRevision(meta,pages);
 return db.runTransaction(async tx=>{
  const current=await tx.get(ref);if(current.data()?.status!=='validating')throw fail(409,'이미 반영한 자료입니다.');
  const catRef=db.doc('ruleCatalog/current');const catSnap=await tx.get(catRef);const catalog=catSnap.data()?.active||{};
  if(!catalog[meta.slot]&&!/^doc-[1-5]$/.test(meta.slot)&&Object.keys(catalog).length>=20)throw fail(400,'등록 자료는 최대 20개입니다. 기존 자료를 교체해주세요.');
  const publishedAt=new Date().toISOString();tx.update(ref,{status:'published',publishedAt,publishedBy:user.email});tx.set(catRef,{active:{...catalog,[meta.slot]:meta.id},updatedAt:publishedAt});return {ok:true};
 });
}
export async function publicRevisions(requestedId=null){
 const db=await database();const snap=await db.doc('ruleCatalog/current').get();const active=snap.data()?.active||{};const result=[];
 for(const id of Object.values(active)){if(requestedId&&id!==requestedId)continue;const ref=db.collection('ruleRevisions').doc(id);const meta=(await ref.get()).data();if(meta?.status!=='published')continue;if(!requestedId){result.push({document:{id:meta.slot,name:meta.name,revisionId:meta.id}});continue;}const pages=JSON.parse((await readParts(db,ref,'text',meta.textParts)).toString());result.push(buildRevision(meta,pages));}
 return {revisions:result,updatedAt:snap.data()?.updatedAt||null};
}
export async function revisionSource(id,part){
 if(!/^[a-f0-9-]{36}$/.test(id||''))throw fail(404,'자료를 찾지 못했습니다.');const db=await database();const ref=db.collection('ruleRevisions').doc(id);const meta=(await ref.get()).data();if(meta?.status!=='published')throw fail(404,'공개된 자료가 아닙니다.');const type=meta.format==='pdf'?'application/pdf':'text/plain; charset=utf-8';
 if(part===null)return {count:meta.fileParts,type};const index=Number(part);if(!/^\d+$/.test(part)||index>=meta.fileParts)throw fail(404,'자료 조각을 찾지 못했습니다.');const snap=await ref.collection('parts').doc('file-'+index).get();if(!snap.exists)throw fail(404,'자료 조각을 찾지 못했습니다.');return {bytes:snap.data().payload,type:'application/octet-stream'};
}
