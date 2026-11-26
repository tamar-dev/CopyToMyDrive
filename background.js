import {parseLink,isFolderLink,operation,folderOperation,downloadFile} from './drive.js';
const t=k=>chrome.i18n.getMessage(k);
const modes=['copy','download','both'];
const patterns=['https://drive.google.com/file/d/*','https://drive.google.com/open*','https://docs.google.com/document/d/*','https://docs.google.com/spreadsheets/d/*','https://docs.google.com/presentation/d/*','https://docs.google.com/forms/d/*'];
const folderPatterns=['https://drive.google.com/drive/folders/*','https://drive.google.com/drive/u/*/folders/*'];
const alarm='drive-operation-recovery';
let current=null;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const getSaved=async()=> (await chrome.storage.local.get('activeOperation')).activeOperation;
let storageQueue=Promise.resolve();
const queueStorage=fn=>{const next=storageQueue.then(fn);storageQueue=next.catch(console.error);return next;};
const save=async job=>{if(job.terminal)return;const {id,link,mode,cancelled,stage,downloadId,name,failure}=job;await queueStorage(()=>chrome.storage.local.set({activeOperation:{id,link,mode,cancelled,stage,downloadId:downloadId??null,name:name??null,failure:failure??null}}));};
async function publish(state){
 await chrome.storage.session.set({copyState:state});
 await chrome.action.setBadgeBackgroundColor({color:state.phase==='error'?'#b42318':state.phase==='success'?'#16803c':'#2563eb'});
 await chrome.action.setBadgeText({text:['busy','waiting'].includes(state.phase)?'…':state.phase==='success'?'✓':state.phase==='error'?'!':''});
}
async function showProgress(){await chrome.windows.create({url:chrome.runtime.getURL('progress.html'),type:'popup',width:420,height:350});}
chrome.runtime.onInstalled.addListener(()=>chrome.contextMenus.removeAll(()=>{
 for(const context of ['link','page']){
  const filter=context==='link'?{targetUrlPatterns:patterns}:{documentUrlPatterns:patterns};
  const parentId='actions-'+context;
  chrome.contextMenus.create({id:parentId,title:t('actions'),contexts:[context],...filter});
  for(const mode of modes)chrome.contextMenus.create({id:context+'-'+mode,parentId,title:t(mode),contexts:[context],...filter});
  chrome.contextMenus.create({id:context+'-folder',title:t('copyFolder'),contexts:[context],...(context==='link'?{targetUrlPatterns:folderPatterns}:{documentUrlPatterns:folderPatterns})});
 }
}));
async function blobToDataUrl(blob){
 const bytes=new Uint8Array(await blob.arrayBuffer());let out='';
 for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return 'data:application/octet-stream;base64,'+btoa(out);
}
async function waitDownload(job){
 while(!job.cancelled){
  const [file]=await chrome.downloads.search({id:job.downloadId});
  if(!file||file.state==='interrupted')throw Error('downloadInterrupted');
  if(file.state==='complete')return;
  await publish({phase:'busy',step:'downloadStep',mode:job.mode,name:job.name,loaded:file.bytesReceived,total:file.totalBytes>0?file.totalBytes:0});
  await sleep(1000);
 }
 await chrome.downloads.cancel(job.downloadId).catch(()=>{});
}
async function defer(job,step='recovering'){
 if(job.terminal)return;
 await save(job);
 await publish({phase:'waiting',step:job.cancelled?'cancelling':step,mode:job.mode,name:job.name});
 await chrome.alarms.create(alarm,{delayInMinutes:1});
}
async function terminal(job,op){
 job.terminal=true;
 const phase=op.state==='succeeded'?'success':op.state==='cancelled'&&!job.failure?'cancelled':'error';
 await queueStorage(()=>chrome.storage.local.remove('activeOperation'));
 await chrome.alarms.clear(alarm);
 await publish({phase,mode:job.mode,id:phase==='success'&&job.mode!=='download'?op.file?.id:undefined,name:op.file?.name||job.name,reason:job.failure||'generic'});
}
async function run(input=null,interactive=false,cancel=false){
 if(current)return false;
 const job={controller:new AbortController(),cancelled:cancel,stage:'prepare'};
 current=job;
 try{
  const existing=await getSaved();
  if(existing)Object.assign(job,existing,{cancelled:cancel||existing.cancelled||job.cancelled});
  else if(input){if(!isFolderLink(input.link))parseLink(input.link);Object.assign(job,{id:crypto.randomUUID(),link:input.link,mode:input.mode});}
  else return false;
  await save(job);
  await publish({phase:'busy',step:job.cancelled?'cancelling':'auth',mode:job.mode,name:job.name});
  const auth=await chrome.identity.getAuthToken({interactive});
  if(!auth?.token){await defer(job,'authError');return true;}
  job.token=auth.token;
  const folder=isFolderLink(job.link);
  const call=(action,payload={})=>(folder?folderOperation:operation)(action,job.id,job.token,payload,{signal:AbortSignal.timeout(25000)});
  job.call=call;
  let op=await call('prepare',{link:job.link,mode:job.mode});
  job.prepared=true;
  if(folder){
   if(job.mode!=='copy'){job.failure='folderCopyOnly';await terminal(job,{state:'failed'});return true;}
   const started=Date.now();
   while(true){
    if(job.cancelled&&!op.cancelRequested&&!['succeeded','cancelled','failed'].includes(op.state))op=await call('cancel');
    if(op.file?.name)job.name=op.file.name;
    if(['succeeded','cancelled','failed'].includes(op.state)){
     if(op.state==='failed')job.failure=op.reason||'generic';
     await terminal(job,op);return true;
    }
    await publish({phase:'busy',step:job.cancelled?'cancelling':op.state==='scanning'?'folderScanning':op.state==='cleaning'?'cleanup':'folderCopying',mode:job.mode,name:job.name,loaded:op.state==='cleaning'?op.total-op.completed:op.completed,total:op.total});
    if(Date.now()-started>240000||op.confirmed===false){await defer(job);return true;}
    await sleep(1400);
    op=await call('advance');
   }
  }
  if(job.cancelled)op=await call('cancel');
  else if(['pending','running'].includes(op.state)){
   await publish({phase:'busy',step:'working',mode:job.mode});
   op=await call('start');
  }
  if(job.cancelled)op=await call('cancel');
  if(['dispatching','uncertain','cancel_requested','cleaning','finalizing'].includes(op.state))op=await call('recover');
  if(['succeeded','cancelled','failed'].includes(op.state)){await terminal(job,op);return true;}
  if(op.state!=='ready'){await defer(job);return true;}
  job.name=op.file?.name;
  await save(job);
  if(job.cancelled){op=await call('cancel');if(['cancelled','succeeded'].includes(op.state))await terminal(job,op);else await defer(job);return true;}
  if(job.stage!=='downloaded'){
   try{
    if(job.stage==='launching'&&!job.downloadId)throw Error('downloadInterrupted');
    if(!job.downloadId){
     job.stage='fetching';await save(job);
     await publish({phase:'busy',step:'downloadStep',mode:job.mode,name:job.name});
     const downloaded=await downloadFile(op.file.id,job.token,{operationId:job.id,signal:job.controller.signal,onProgress:(loaded,total)=>{if(!job.cancelled)void publish({phase:'busy',step:'downloadStep',mode:job.mode,name:job.name,loaded,total}).catch(console.error);}});
     if(job.cancelled)throw Error('cancelled');
     const url=await blobToDataUrl(downloaded.blob);
     if(job.cancelled)throw Error('cancelled');
     job.stage='launching';await save(job);
     if(job.cancelled)throw Error('cancelled');
     job.downloadId=await chrome.downloads.download({url,filename:downloaded.name,saveAs:false,conflictAction:'uniquify'});
     job.stage='downloading';await save(job);
    }
    await waitDownload(job);
    if(job.cancelled)throw Error('cancelled');
    job.stage='downloaded';await save(job);
   }catch(e){
    job.failure=job.cancelled?null:(e.message==='tooLarge'?'tooLarge':'downloadInterrupted');
    job.cancelled=true;await save(job);
    if(job.downloadId)await chrome.downloads.cancel(job.downloadId).catch(()=>{});
    op=await call('cancel');
    if(op.state==='cancelled'){if(job.failure)await terminal(job,{...op,state:'failed'});else await terminal(job,op);}
    else await defer(job);
    return true;
   }
  }
  if(job.cancelled)op=await call('cancel');
  else{await publish({phase:'busy',step:'cleanup',mode:job.mode,name:job.name});op=await call('finish');}
  if(['succeeded','cancelled','failed'].includes(op.state))await terminal(job,op);
  else await defer(job);
 }catch(e){
  console.error('Operation pending:',e.message);
  if(job.id)await defer(job);
  else await publish({phase:'error',reason:'invalid'});
 }finally{if(current===job)current=null;}
 return true;
}
async function cancelCurrent(){
 if(!current)return run(null,true,true);
 const job=current;
 if(job.terminal)return false;
 job.cancelled=true;job.controller.abort();
 if(job.id)await save(job);
 if(job.terminal)return false;
 await publish({phase:'busy',step:'cancelling',mode:job.mode,name:job.name});
 if(job.downloadId)await chrome.downloads.cancel(job.downloadId).catch(()=>{});
 if(job.prepared&&job.call)await job.call('cancel').catch(console.error);
 return true;
}
chrome.alarms.onAlarm.addListener(a=>{if(a.name===alarm)void run();});
chrome.runtime.onStartup.addListener(()=>{void run();});
chrome.contextMenus.onClicked.addListener(async info=>{
 const action=String(info.menuItemId).split('-').pop();
 const mode=action==='folder'?'copy':action;
 if(!modes.includes(mode))return;
 const link=info.linkUrl||info.pageUrl;
 try{if(action==='folder'){if(!isFolderLink(link))return;}else parseLink(link);}catch{return;}
 const work=run({link,mode},true);
 await showProgress();
 await work;
});
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(msg?.type==='cancel'){void cancelCurrent().then(accepted=>respond({accepted}),()=>respond({accepted:false}));return true;}
 if(msg?.type==='resume'){void run(null,true);respond({accepted:true});return;}
 if(msg?.type==='start'){
  if(current||!modes.includes(msg.mode)){respond({accepted:false});return;}
  void run({link:msg.link,mode:msg.mode},true);
  void showProgress().catch(console.error);
  respond({accepted:true});
 }
});
