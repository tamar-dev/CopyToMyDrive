export function parseLink(value) {
 const u = new URL(value.trim());
 if(u.protocol !== 'https:' || !['drive.google.com','docs.google.com'].includes(u.hostname)) throw Error('Not a Google Drive link');
 const id = u.pathname.match(/\/d\/([\w-]+)/)?.[1] || u.searchParams.get('id');
 if(!id || !/^[\w-]+$/.test(id)) throw Error('Unsupported link (folders are not supported).');
 return {id,key:u.searchParams.get('resourcekey')};
}
const base='https://tunistslilxckcjxnlrm.supabase.co/functions/v1/';
export async function invoke(action,payload,token,{signal,request=fetch}={}) {
 const response=await request(base+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
 if(action==='drive-download'){
   if(!response.ok){let error;try{error=(await response.json()).error;}catch{}throw Error(error||'HTTP '+response.status);}
   const fileName=decodeURIComponent(response.headers.get('X-Download-Name')||'download');
   return {blob:await response.blob(),name:fileName};
 }
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'HTTP '+response.status);
 return data;
}
export const copyFile=(link,token,options)=>invoke('drive-copy',{link},token,options);
export const downloadFile=(fileId,token,options)=>invoke('drive-download',{fileId},token,options);
export const trashFile=(fileId,token,options)=>invoke('drive-trash',{fileId},token,options);
