import {parseLink} from './drive.js';
const t=k=>chrome.i18n.getMessage(k);
document.documentElement.lang=chrome.i18n.getUILanguage();
document.documentElement.dir=chrome.i18n.getMessage('@@bidi_dir');
for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
const link=document.querySelector('#link'),button=document.querySelector('#copy'),status=document.querySelector('#status'),result=document.querySelector('#result'),manual=document.querySelector('#manual'),source=document.querySelector('#source');
let current='';
const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
try{parseLink(tab.url);current=tab.url;source.textContent=t('current');}catch{manual.open=true;source.textContent=t('paste');}
link.placeholder='https://drive.google.com/…';
function render(s){button.disabled=s?.phase==='busy';status.dataset.phase=s?.phase||'';status.textContent=!s?'':s.phase==='busy'?t('working'):s.phase==='success'?t('success')+' — '+s.name:t(s.reason||'generic');result.hidden=s?.phase!=='success';if(!result.hidden)result.href='https://drive.google.com/open?id='+encodeURIComponent(s.id);}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes.copyState)render(changes.copyState.newValue);});
render((await chrome.storage.session.get('copyState')).copyState);
button.onclick=async()=>{const value=link.value.trim()||current;try{parseLink(value);}catch{status.textContent=t('invalid');return;}button.disabled=true;status.textContent=t('working');try{await chrome.runtime.sendMessage({type:'copy',link:value});}catch{button.disabled=false;status.textContent=t('generic');}};
