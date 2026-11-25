import {parseLink,copyFile} from './drive.js';
const t=(key,...args)=>chrome.i18n.getMessage(key,args);
let busy=false;
const patterns=['https://drive.google.com/*','https://docs.google.com/*'];
chrome.runtime.onInstalled.addListener(()=>chrome.contextMenus.removeAll(()=>{
 chrome.contextMenus.create({id:'copy-link',title:t('copy'),contexts:['link'],targetUrlPatterns:patterns});
 chrome.contextMenus.create({id:'copy-page',title:t('copy'),contexts:['page'],documentUrlPatterns:patterns});
}));
async function publish(state){
 await chrome.storage.session.set({copyState:state});
 await chrome.action.setBadgeBackgroundColor({color:state.phase==='error'?'#b42318':state.phase==='success'?'#16803c':'#2563eb'});
 await chrome.action.setBadgeText({text:state.phase==='busy'?'…':state.phase==='success'?'✓':'!'});
 await chrome.action.setTitle({title:t(state.phase==='busy'?'working':state.phase==='success'?'success':'failed')});
}
async function notify(state){
 try {await chrome.notifications.create('copy-result',{type:'basic',iconUrl:'icon.svg',title:t(state.phase==='success'?'success':'failed'),message:state.phase==='success'?state.name+' — '+t('open'):t(state.reason||'generic')});} catch {}
}
async function run(link){
 if(busy)return;
 busy=true;
 try{
 await publish({phase:'busy'});
 parseLink(link);
 const {token}=await chrome.identity.getAuthToken({interactive:true});
 if(!token)throw Error('No access token');
 const file=await copyFile(link,token);
 if(!file?.id)throw Error('Missing copy ID');
 const state={phase:'success',id:file.id,name:file.name||t('file')};
 await publish(state);await notify(state);
 }catch(e){
 const detail=String(e.message||e);
 const reason=/not permitted|cannot copy|copying.*disabled/i.test(detail)?'blocked':/auth|token|sign.in|consent/i.test(detail)?'authError':/unsupported|not a google|invalid url/i.test(detail)?'invalid':'generic';
 console.error('Copy failed:', detail);
 const state={phase:'error',reason};
 await publish(state);await notify(state);
 }finally{busy=false;}
}
chrome.contextMenus.onClicked.addListener(async info=>{
 if(!['copy-link','copy-page'].includes(info.menuItemId))return;
 if(busy){await chrome.windows.create({url:chrome.runtime.getURL('progress.html'),type:'popup',width:390,height:300});return;}
 const operation=run(info.linkUrl||info.pageUrl);
 try{await chrome.windows.create({url:chrome.runtime.getURL('progress.html'),type:'popup',width:390,height:300});}catch(e){console.error('Progress window:',e);}
 await operation;
});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{if(sender.id!==chrome.runtime.id||msg?.type!=='copy')return; if(busy){reply({accepted:false});return;}void run(msg.link);reply({accepted:true});});
chrome.notifications.onClicked.addListener(async id=>{if(id!=='copy-result')return;const {copyState:s}=await chrome.storage.session.get('copyState');if(s?.phase==='success')await chrome.tabs.create({url:'https://drive.google.com/open?id='+encodeURIComponent(s.id)});await chrome.notifications.clear(id);});
