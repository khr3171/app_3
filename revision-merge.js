export function mergeRevisions(base,revisions){
 const next={...base,documents:[...base.documents],chunks:[...base.chunks]};
 for(const {document,chunks} of revisions){next.documents=next.documents.filter(d=>d.id!==document.id);next.documents.push(document);next.chunks=next.chunks.filter(c=>c.docId!==document.id).concat(chunks);}
 if(revisions.length){next.answers={};next.curatedPages={};next.revised=true;}
 return next;
}
