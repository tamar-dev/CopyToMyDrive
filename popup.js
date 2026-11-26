import {parseLink} from './drive.js';
const t=k=>chrome.i18n.getMessage(k);
document.documentElement.lang=chrome.i18n.getUILanguage();document.documentElement.dir=t('@@bidi_dir');
for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
const el=id=>document.getElementById(id);
let current='';const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
try{parseLink(tab.url);current=tab.url;el('source').textContent=t('current');}catch{el('source').textContent=t('rightClickHint');}
const buttons=[...document.querySelectorAll('[data-mode]')];
function render(s){
 const active=['busy','waiting'].includes(s?.phase);
 for(const b of buttons){b.disabled=active||!current;b.hidden=!current;}
 el('status').textContent=!s?'':active?t(s.step||'working'):s.phase==='success'?t(s.mode==='download'?'downloadSuccess':s.mode==='both'?'bothSuccess':'success'):s.phase==='cancelled'?t('cancelSuccess'):t(s.reason||'generic');
 el('cancel').hidden=!active;el('cancel').disabled=s?.step==='cancelling';el('resume').hidden=s?.phase!=='waiting';
 el('result').hidden=!(s?.id&&s.phase==='success');if(!el('result').hidden)el('result').href='https://drive.google.com/open?id='+encodeURIComponent(s.id);
}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes.copyState)render(changes.copyState.newValue);});
render((await chrome.storage.session.get('copyState')).copyState);
for(const b of buttons)b.onclick=async()=>{if(!current)return;const r=await chrome.runtime.sendMessage({type:'start',link:current,mode:b.dataset.mode});if(r?.accepted)window.close();else el('status').textContent=t('busyError');};
el('cancel').onclick=()=>chrome.runtime.sendMessage({type:'cancel'});
el('resume').onclick=()=>chrome.runtime.sendMessage({type:'resume'});
