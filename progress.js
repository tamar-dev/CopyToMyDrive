const t=k=>chrome.i18n.getMessage(k),el=id=>document.getElementById(id);
document.documentElement.lang=chrome.i18n.getUILanguage();document.documentElement.dir=t('@@bidi_dir');
el('title').textContent=t('appName');el('result').textContent=t('open');
el('close').textContent=t('close');el('cancel').textContent=t('cancel');el('resume').textContent=t('resume');
el('close').onclick=()=>window.close();
el('cancel').onclick=async()=>{el('cancel').disabled=true;await chrome.runtime.sendMessage({type:'cancel'});};
el('resume').onclick=async()=>{el('resume').disabled=true;await chrome.runtime.sendMessage({type:'resume'});};
let closeTimer;
function render(s){
 clearTimeout(closeTimer);
 const phase=s?.phase||'busy',active=['busy','waiting'].includes(phase);
 el('symbol').textContent=phase==='success'?'✓':phase==='error'?'!':phase==='cancelled'?'–':'…';
 el('status').textContent=active?t(s?.step||'working'):phase==='success'?t(s?.mode==='download'?'downloadSuccess':s?.mode==='both'?'bothSuccess':'success'):phase==='cancelled'?t('cancelSuccess'):t(s?.reason||'generic');
 el('name').textContent=s?.name||'';el('name').hidden=!s?.name;
 const progress=el('progress');progress.hidden=!active;
 progress.setAttribute('aria-label',t('progressLabel'));
 if(s?.total>0&&Number.isFinite(s.loaded)){progress.max=s.total;progress.value=Math.min(s.loaded,s.total);}else progress.removeAttribute('value');
 el('result').hidden=!(s?.id&&phase==='success');
 if(!el('result').hidden)el('result').href='https://drive.google.com/open?id='+encodeURIComponent(s.id);
 el('cancel').hidden=!active;el('cancel').disabled=s?.step==='cancelling';
 el('resume').hidden=phase!=='waiting';el('resume').disabled=false;
 el('close').hidden=phase==='busy';
 if(phase==='success'||phase==='cancelled')closeTimer=setTimeout(()=>window.close(),2500);
}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes.copyState)render(changes.copyState.newValue);});
render((await chrome.storage.session.get('copyState')).copyState);
