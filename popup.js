import {parseLink} from './drive.js';
const t=k=>chrome.i18n.getMessage(k);
document.documentElement.lang=chrome.i18n.getUILanguage();document.documentElement.dir=t('@@bidi_dir');
for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
const el=id=>document.getElementById(id);
let current='';const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
try{parseLink(tab.url);current=tab.url;el('source').textContent=t('current');}catch{el('manual').open=true;el('source').textContent=t('paste');}
const buttons=[...document.querySelectorAll('[data-mode]')];
function render(s){for(const b of buttons)b.disabled=s?.phase==='busy';el('status').textContent=!s?'':s.phase==='busy'?t(s.step||'working'):s.phase==='success'?t('success'):s.phase==='cancelled'?t('cancelWarning'):t(s.reason||'generic');el('cancel').hidden=s?.phase!=='busy';el('result').hidden=!(s?.id&&s.phase==='success');if(!el('result').hidden)el('result').href='https://drive.google.com/open?id='+encodeURIComponent(s.id);}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes.copyState)render(changes.copyState.newValue);});
render((await chrome.storage.session.get('copyState')).copyState);
for(const b of buttons)b.onclick=async()=>{const link=el('link').value.trim()||current;try{parseLink(link);}catch{el('status').textContent=t('invalid');return;}const r=await chrome.runtime.sendMessage({type:'start',link,mode:b.dataset.mode});if(!r?.accepted)el('status').textContent=t('busyError');};
el('cancel').onclick=async()=>{await chrome.runtime.sendMessage({type:'cancel'});};
