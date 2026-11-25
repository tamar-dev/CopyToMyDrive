import {test} from 'node:test';import assert from 'node:assert/strict';import{parseLink,copyFile}from './drive.js';
test('links',()=>{assert.deepEqual(parseLink('https://drive.google.com/file/d/abc/view?resourcekey=xyz'),{id:'abc',key:'xyz'});assert.equal(parseLink('https://docs.google.com/document/d/abc/edit').id,'abc');assert.throws(()=>parseLink('https://evil.test/file/d/abc'));assert.throws(()=>parseLink('https://drive.google.com/drive/folders/abc'));});
test('copy via cloud endpoint', async () => {
  const link = 'https://drive.google.com/open?id=abc&resourcekey=xyz';
  const output = await copyFile(link, 'token', async (url, init) => {
    assert.equal(url, 'https://tunistslilxckcjxnlrm.supabase.co/functions/v1/drive-copy');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer token');
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(init.body), {link});
    return {ok:true, json:async()=>({id:'new',name:'file'})};
  });
  assert.deepEqual(output, {id:'new',name:'file'});
});
test('cloud error', async () => {
  await assert.rejects(copyFile('https://drive.google.com/open?id=abc','token',async()=>({ok:false,status:403,json:async()=>({error:'Copy not permitted'})})), /Copy not permitted/);
});
test('HTTP fallback', async () => {
  await assert.rejects(copyFile('https://drive.google.com/open?id=abc','token',async()=>({ok:false,status:500,json:async()=>({})})), /HTTP 500/);
});
