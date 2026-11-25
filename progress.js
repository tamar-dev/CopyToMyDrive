const t=k=>chrome.i18n.getMessage(k);
document.documentElement.lang=chrome.i18n.getUILanguage();
document.documentElement.dir=t('@@bidi_dir');
const el=id=>document.getElementById(id);
el('title').textContent=t('appName');
el('result').textContent=t('open');
el('close').textContent=chrome.i18n.getUILanguage().startsWith('he')?'סגירה':'Close';
el('close').onclick=()=>window.close();
function render(s){
 const phase=s?.phase||'busy';
 el('symbol').textContent=phase==='success'?'✓':phase==='error'?'!':'…';
 el('symbol').style.color=phase==='success'?'#16803c':phase==='error'?'#b42318':'#2563eb';
 el('status').textContent=phase==='success'?t('success')+' — '+s.name:phase==='error'?t(s.reason||'generic'):t('working');
 el('result').hidden=phase!=='success';
 el('close').hidden=phase==='busy';
 if(phase==='success')el('result').href='https://drive.google.com/open?id='+encodeURIComponent(s.id);
}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes.copyState)render(changes.copyState.newValue);});
render((await chrome.storage.session.get('copyState')).copyState);
