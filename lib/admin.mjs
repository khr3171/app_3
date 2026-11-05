import {firebaseApp} from './auth.mjs';
export const fail=(status,message)=>Object.assign(new Error(message),{status});
export async function database(){const {getFirestore}=await import('firebase-admin/firestore');return getFirestore(await firebaseApp());}
export function isAdminIdentity(user,record){return user.email_verified===true && user.firebase?.sign_in_provider==='google.com' && record?.enabled===true;}
export async function authorizeAdmin(req){
 const token=/^Bearer (.+)$/.exec(req.headers.authorization||'')?.[1];
 if(!token)throw fail(401,'관리자 계정으로 로그인해주세요.');
 const {getAuth}=await import('firebase-admin/auth');let user;
 try{user=await getAuth(await firebaseApp()).verifyIdToken(token,true);}catch{throw fail(401,'로그인이 만료되었습니다. 다시 로그인해주세요.');}
 const email=String(user.email||'').toLowerCase();
 if(!email||email.includes('/'))throw fail(403,'관리자 권한이 없습니다.');
 const record=await(await database()).collection('admins').doc(email).get();
 if(!isAdminIdentity(user,record.data()))throw fail(403,'승인된 관리자만 이용할 수 있습니다.');
 return user;
}
export async function readJSON(req,max=600000){
 let input=req.body;
 if(input===undefined){let size=0;const chunks=[];for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>max)throw fail(413,'요청 용량이 너무 큽니다.');chunks.push(Buffer.from(chunk));}input=Buffer.concat(chunks).toString();}
 if(typeof input==='string'){if(Buffer.byteLength(input)>max)throw fail(413,'요청 용량이 너무 큽니다.');try{input=JSON.parse(input);}catch{throw fail(400,'올바른 JSON이 아닙니다.');}}
 if(!input||Buffer.byteLength(JSON.stringify(input))>max)throw fail(400,'요청 내용을 확인해주세요.');return input;
}
export async function adminSuggestions(url){
 const db=await database();let query=db.collection('suggestions').orderBy('__name__').limit(31);
 const cursor=url.searchParams.get('cursor');if(cursor){if(!/^[a-f0-9]{64}$/.test(cursor))throw fail(400,'잘못된 목록 위치입니다.');query=query.startAfter(cursor);}
 const snap=await query.get();const docs=snap.docs.slice(0,30);
 return {items:docs.map(d=>({id:d.id,...d.data(),createdAt:d.data().createdAt?.toDate().toISOString(),expiresAt:d.data().expiresAt?.toDate().toISOString()})),nextCursor:snap.size>30?docs.at(-1).id:null};
}
