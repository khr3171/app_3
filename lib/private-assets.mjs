import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
export const PART_BYTES=480*1024;
export const MAX_BYTES=32*1024*1024;
export function packAsset(input){
 const raw=Buffer.from(input);if(raw.length>MAX_BYTES)throw new Error('자료 1개는 32 MiB 이하여야 합니다.');
 const packed=gzipSync(raw);const parts=[];
 for(let i=0;i<packed.length;i+=PART_BYTES)parts.push(packed.subarray(i,i+PART_BYTES));
 return {hash:createHash('sha256').update(raw).digest('hex'),bytes:raw.length,parts};
}
export function unpackAsset(meta,parts){
 if(!Number.isInteger(meta.count)||meta.count<1||meta.count>70||parts.length!==meta.count||!Number.isInteger(meta.bytes)||meta.bytes<0||meta.bytes>MAX_BYTES)throw new Error('자료 메타데이터 오류');
 if(parts.some(p=>!Buffer.isBuffer(p)||p.length>PART_BYTES))throw new Error('자료 조각 오류');
 const raw=gunzipSync(Buffer.concat(parts),{maxOutputLength:MAX_BYTES});
 if(raw.length!==meta.bytes||createHash('sha256').update(raw).digest('hex')!==meta.hash)throw new Error('자료 무결성 검증 실패');
 return raw;
}
