import fs from 'node:fs/promises';
import {localOnly,firebaseApp} from './auth.mjs';
import {unpackAsset} from './private-assets.mjs';
let corpusCache,manifestCache;
async function db(){const {getFirestore}=await import('firebase-admin/firestore');return getFirestore(await firebaseApp());}
async function manifest(){
 if(manifestCache&&Date.now()-manifestCache.at<300000)return manifestCache.value;
 const snap=await(await db()).doc('privateData/current').get();
 if(!snap.exists)throw Object.assign(new Error('무료 Firestore 자료 등록이 아직 완료되지 않았습니다.'),{status:503});
 manifestCache={at:Date.now(),value:snap.data()};return manifestCache.value;
}
async function readAsset(meta){
 if(!meta||!/^[a-f0-9]{64}$/.test(meta.hash)||!Number.isInteger(meta.count)||meta.count<1||meta.count>70)throw new Error('Invalid asset reference');
 const database=await db();const refs=Array.from({length:meta.count},(_,i)=>database.doc(`privateAssets/${meta.hash}/parts/${String(i).padStart(4,'0')}`));
 const snapshots=await database.getAll(...refs);
 return unpackAsset(meta,snapshots.map(s=>s.data()?.payload));
}
export async function getCorpus(req){
 if(localOnly(req))return JSON.parse(await fs.readFile(new URL('../data/corpus.json',import.meta.url),'utf8'));
 const current=await manifest();
 if(corpusCache?.hash===current.corpus?.hash)return corpusCache.value;
 const value=JSON.parse((await readAsset(current.corpus)).toString('utf8'));
 if(!Array.isArray(value.documents)||!Array.isArray(value.chunks))throw new Error('Invalid corpus');
 corpusCache={hash:current.corpus.hash,value};return value;
}
export async function getOriginal(req,file){
 if(!/^doc-\d+\.(pdf|hwp)$/.test(file))throw new Error('Invalid source file');
 if(localOnly(req))return fs.readFile(new URL('../data/originals/'+file,import.meta.url));
 const current=await manifest();return readAsset(current.originals?.[file]);
}
