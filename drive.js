export function parseLink(value) {
 const u = new URL(value.trim());
 if(u.protocol !== 'https:' || !['drive.google.com','docs.google.com'].includes(u.hostname)) throw Error('Not a Google Drive link');
 const id = u.pathname.match(/\/d\/([\w-]+)/)?.[1] || u.searchParams.get('id');
 if(!id || !/^[\w-]+$/.test(id)) throw Error('Unsupported link (folders are not supported).');
 const key = u.searchParams.get('resourcekey');
 if(key && !/^[\w-]+$/.test(key)) throw Error('Invalid resource key');
 return {id,key};
}
export async function copyFile(link, token, request=fetch) {
 const {id,key}=parseLink(link);
 const headers={Authorization:`Bearer ${token}`};
 if(key) headers['X-Goog-Drive-Resource-Keys']=`${id}/${key}`;
 const base=`https://www.googleapis.com/drive/v3/files/${id}`;
 async function call(url,init){ const r=await request(url,init); const data=await r.json(); if(!r.ok) throw Error(data.error?.message || `HTTP ${r.status}`); return data; }
 const meta=await call(base+'?fields=name,mimeType,capabilities(canCopy)&supportsAllDrives=true',{headers});
 if(['application/vnd.google-apps.folder','application/vnd.google-apps.shortcut'].includes(meta.mimeType)) throw Error('Folders and shortcuts are not supported.');
 if(!meta.capabilities?.canCopy) throw Error('Copying is not permitted by the owner.');
 return call(base+'/copy?fields=id,name,webViewLink&supportsAllDrives=true',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:meta.name,parents:['root']})});
}