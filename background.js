import {parseLink,copyFile,downloadFile,trashFile} from './drive.js';
const t=k=>chrome.i18n.getMessage(k);
const patterns=['https://drive.google.com/*','https://docs.google.com/*'];
let current=null;
async function blobToDataUrl(blob){const bytes=new Uint8Array(await blob.arrayBuffer());let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return 'data:application/octet-stream;base64,'+btoa(out);}

chrome.runtime.onInstalled.addListener(()=>chrome.contextMenus.removeAll(()=>{
 chrome.contextMenus.create({id:'actions',title:t('actions'),contexts:['link','page']});
 for(const [id,key] of [['copy','copy'],['download','download'],['both','both']]){
  chrome.contextMenus.create({id,parentId:'actions',title:t(key),contexts:['link','page']});
 }
}));
async function publish(state){
 await chrome.storage.session.set({copyState:state});
 await chrome.action.setBadgeBackgroundColor({color:state.phase==='error'?'#b42318':state.phase==='success'?'#16803c':'#2563eb'});
 await chrome.action.setBadgeText({text:state.phase==='busy'?'…':state.phase==='success'?'✓':state.phase==='error'?'!':''});
}
function makeReason(e){
 const message=String(e?.message||e);
 if(/not permitted|cannot copy/i.test(message))return 'blocked';
 if(/abort/i.test(message))return 'cancelled';
 if(/auth|token|consent/i.test(message))return 'authError';
 console.error('Drive action failed:',message);
 return 'generic';
}
async function run(link,mode='copy'){
 if(current)return {accepted:false};
 parseLink(link);
 const task={cancelled:false,controller:new AbortController()};
 current=task;
 const set=async s=>{if(current===task)await publish({...s,mode});};
 const check=()=>{if(task.cancelled)throw Error('Operation cancelled');};
 let copy=null;
 let downloaded=false;
 try{
  await set({phase:'busy',step:'auth'});
  const {token}=await chrome.identity.getAuthToken({interactive:true});
  if(!token)throw Error('Missing token');
  check();await set({phase:'busy',step:'copy'});
  // Each supported mode creates a private copy first; the source is never deleted.
  copy=await copyFile(link,token,{signal:task.controller.signal});
  if(!copy?.id)throw Error('Copy result missing file ID');
  check();
  if(mode!=='copy'){
    await set({phase:'busy',step:'downloadStep'});
    const downloadedFile=await downloadFile(copy.id,token,{signal:task.controller.signal});
    check();
    // Use a blob URL in the extension service worker; retain it until Chrome confirms download.
    if(downloadedFile.blob.size>25*1024*1024)throw Error('File too large for POC download');
    const url=await blobToDataUrl(downloadedFile.blob);
    try{
      const downloadId=await chrome.downloads.download({url,filename:downloadedFile.name,saveAs:false,conflictAction:'uniquify'});
      await new Promise((resolve,reject)=>{
        const listener=delta=>{
          if(delta.id!==downloadId)return;
          if(delta.state?.current==='complete'){chrome.downloads.onChanged.removeListener(listener);resolve();}
          if(delta.state?.current==='interrupted'){chrome.downloads.onChanged.removeListener(listener);reject(Error('Download interrupted'));}
        };
        chrome.downloads.onChanged.addListener(listener);
      });
      downloaded=true;
    }finally{}
  }
  check();
  if(mode==='download'){
    await set({phase:'busy',step:'cleanup'});
    try{await trashFile(copy.id,token);copy=null;}catch(e){console.error('Temporary copy cleanup failed:',e);throw Error('cleanupFailed');}
  }
  await set({phase:'success',id:copy?.id,name:copy?.name,downloaded});
 }catch(e){
  if(task.cancelled){
    // Aborting the network request does not roll back an ongoing server-side copy.
    await set({phase:'cancelled',note:'mayContinue',id:copy?.id});
  }else{
    await set({phase:'error',reason:e.message==='cleanupFailed'?'cleanupFailed':makeReason(e),id:copy?.id});
  }
 }finally{if(current===task)current=null;}
 return {accepted:true};
}
chrome.contextMenus.onClicked.addListener(async info=>{
 if(!['copy','download','both'].includes(info.menuItemId))return;
 const link=info.linkUrl||info.pageUrl;
 try{parseLink(link);}catch{return;}
 const job=run(link,info.menuItemId);
 try{await chrome.windows.create({url:chrome.runtime.getURL('progress.html'),type:'popup',width:420,height:350});}catch(e){console.error(e);}
 await job;
});
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(msg?.type==='cancel'){
  if(current){current.cancelled=true;current.controller.abort();respond({accepted:true});}
  else respond({accepted:false});
  return;
 }
 if(msg?.type==='start'){
  if(current){respond({accepted:false});return;}
  void run(msg.link,msg.mode).catch(console.error);respond({accepted:true});
 }
});
