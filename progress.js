const t=k=>chrome.i18n.getMessage(k),el=id=>document.getElementById(id);
document.documentElement.lang=chrome.i18n.getUILanguage();document.documentElement.dir=t('@@bidi_dir');
el('title').textContent=t('appName');el('result').textContent=t('open');
el('close').textContent=t('close');el('cancel').textContent=t('cancel');
el('close').onclick=()=>window.close();
el('cancel').onclick=async()=>{el('cancel').disabled=true;await chrome.runtime.sendMessage({type:'cancel'});};
function render(s){
 const phase=s?.phase||'busy';
 el('symbol').textContent=phase==='success'?'✓':phase==='error'?'!':phase==='cancelled'?'–':'…';
 el('status').textContent=phase==='busy'?t(s?.step||'working'):phase==='success'?t('success'):phase==='cancelled'?t('cancelWarning'):t(s?.reason||'generic');
 el('result').hidden=!(s?.id&&(phase==='success'||phase==='error'));
 if(!el('result').hidden)el('result').href='https://drive.google.com/open?id='+encodeURIComponent(s.id);
 el('cancel').hidden=phase!=='busy';el('close').hidden=phase==='busy';
}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes.copyState)render(changes.copyState.newValue);});
render((await chrome.storage.session.get('copyState')).copyState);
