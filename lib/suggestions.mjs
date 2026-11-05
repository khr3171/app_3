import {randomUUID,createHash} from 'node:crypto';
import {firebaseApp} from './auth.mjs';
const limits={affiliation:100,name:50,rule:180,article:120,problem:3000,improvement:3000};
export function validateSuggestion(input){
 if(!input||typeof input!=='object'||input.consent!==true)throw Object.assign(Error('개인정보 수집·이용 안내를 확인하고 동의해주세요.'),{status:400});
 const value={};for(const [key,max] of Object.entries(limits)){const s=typeof input[key]==='string'?input[key].trim():'';if(!s||s.length>max)throw Object.assign(Error('필수 입력 항목과 글자 수를 확인해주세요.'),{status:400});value[key]=s;}
 if(!/^[a-f0-9-]{36}$/.test(input.requestId||''))throw Object.assign(Error('접수 식별자가 올바르지 않습니다. 창을 다시 열어주세요.'),{status:400});
 return {...value,consent:true};
}
export async function submitSuggestion(req){
 if(req.method!=='POST')throw Object.assign(Error('허용되지 않는 요청입니다.'),{status:405});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Object.assign(Error('JSON 형식으로 제출해주세요.'),{status:415});
 let input=req.body;if(input===undefined){let bytes=0;const chunks=[];for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>24000)throw Object.assign(Error('입력 내용이 너무 깁니다.'),{status:413});chunks.push(Buffer.from(chunk));}try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(Error('입력 형식을 확인해주세요.'),{status:400});}}
 if(typeof input==='string'){try{input=JSON.parse(input);}catch{throw Object.assign(Error('입력 형식을 확인해주세요.'),{status:400});}}
 if(Buffer.byteLength(JSON.stringify(input||{}))>24000)throw Object.assign(Error('입력 내용이 너무 깁니다.'),{status:413});
 const value=validateSuggestion(input);if(!process.env.FIREBASE_PROJECT_ID)throw Object.assign(Error('건의 접수 저장소가 아직 연결되지 않았습니다. 관리자에게 문의해주세요.'),{status:503});
 const {getFirestore,Timestamp}=await import('firebase-admin/firestore');const db=getFirestore(await firebaseApp());
 const id=createHash('sha256').update(input.requestId).digest('hex');const ref=db.collection('suggestions').doc(id);
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const rate=db.collection('suggestionLimits').doc(createHash('sha256').update(ip+'|'+new Date().toISOString().slice(0,10)).digest('hex'));
 return db.runTransaction(async tx=>{const prior=await tx.get(ref);if(prior.exists)return {receipt:prior.data().receipt};const limit=await tx.get(rate);const n=limit.data()?.count||0;if(n>=10)throw Object.assign(Error('오늘 접수 한도에 도달했습니다. 나중에 다시 시도해주세요.'),{status:429});
 const receipt='SUG-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+randomUUID().slice(0,8).toUpperCase();
 tx.set(ref,{...value,receipt,status:'received',committeeCandidate:false,createdAt:Timestamp.now(),expiresAt:Timestamp.fromMillis(Date.now()+365*24*60*60*1000),privacyNoticeVersion:'2026-11-05'});tx.set(rate,{count:n+1,updatedAt:Timestamp.now()});return {receipt};});
}
