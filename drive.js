export function parseLink(value) {
 const u = new URL(value.trim());
 if(u.protocol !== 'https:' || !['drive.google.com','docs.google.com'].includes(u.hostname)) throw Error('Not a Google Drive link');
 const id = u.pathname.match(/\/d\/([\w-]+)/)?.[1] || u.searchParams.get('id');
 if(!id || !/^[\w-]+$/.test(id)) throw Error('Unsupported link (folders are not supported).');
 return {id,key:u.searchParams.get('resourcekey')};
}
const base='https://tunistslilxckcjxnlrm.supabase.co/functions/v1/';
export async function invoke(action,payload,token,options={}) {
 const {signal,request=fetch,onProgress}=typeof options==='function'?{request:options}:options;
 const response=await request(base+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
 if(action==='drive-download'){
   if(!response.ok){let error;try{error=(await response.json()).error;}catch{}throw Error(error||'HTTP '+response.status);}
   const fileName=decodeURIComponent(response.headers.get('X-Download-Name')||'download');
   const max=25*1024*1024;
   const total=Number(response.headers.get('Content-Length'))||0;
   if(total>max){await response.body?.cancel();throw Error('tooLarge');}
   const reader=response.body.getReader(),chunks=[];let loaded=0;
   try{
     while(true){const {done,value}=await reader.read();if(done)break;loaded+=value.byteLength;if(loaded>max)throw Error('tooLarge');chunks.push(value);onProgress?.(loaded,total);}
     return {blob:new Blob(chunks),name:fileName};
   }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}

 }
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'HTTP '+response.status);
 return data;
}
export const copyFile=(link,token,options)=>invoke('drive-copy',{link},token,options);
export const downloadFile=(fileId,token,options)=>invoke('drive-download',{fileId},token,options);
export const operation=(action,operationId,token,payload={},options)=>invoke('drive-operation',{...payload,action,operationId},token,options);
