let app;
export function localOnly(req){return process.env.LOCAL_PREVIEW==='1'&&!process.env.VERCEL&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress);}
export async function authorize(req){
 if(localOnly(req))return {uid:'local-preview'};
 if(!process.env.FIREBASE_PROJECT_ID)throw Object.assign(new Error('직원 인증 연결 전입니다. 배포 환경에서는 자료를 공개하지 않습니다.'),{status:503});
 const app=await firebaseApp();
 const {getAuth}=await import('firebase-admin/auth');
 const {getFirestore}=await import('firebase-admin/firestore');
 const token=(req.headers.authorization||'').replace(/^Bearer /,'');
 if(!token)throw Object.assign(new Error('직원 계정으로 로그인해주세요.'),{status:401});
 let user;try{user=await getAuth(app).verifyIdToken(token,true);}catch{throw Object.assign(new Error('로그인이 만료되었습니다. 다시 로그인해주세요.'),{status:401});}
 const employee=await getFirestore(app).collection('employees').doc(user.uid).get();
 if(!user.email_verified||employee.data()?.enabled!==true)throw Object.assign(new Error('승인된 직원 계정만 이용할 수 있습니다.'),{status:403});
 return user;
}
export async function firebaseApp(){
 if(app)return app;
 const {initializeApp,cert,getApps}=await import('firebase-admin/app');
 app=getApps()[0]??initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n')})});
 return app;
}
