import {test} from 'node:test';import assert from 'node:assert/strict';import{parseLink,copyFile,operation,downloadFile,parseFolderLink,isFolderLink,folderOperation}from './drive.js';
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

test('operation identity and mode are sent to the operation API',async()=>{
 const id='12345678-1234-1234-1234-123456789abc';
 const result=await operation('prepare',id,'token',{link:'https://drive.google.com/file/d/abc/view',mode:'download'},{request:async(url,init)=>{
  assert.ok(url.endsWith('/drive-operation'));assert.deepEqual(JSON.parse(init.body),{link:'https://drive.google.com/file/d/abc/view',mode:'download',action:'prepare',operationId:id});
  return new Response(JSON.stringify({state:'pending'}));
 }});
 assert.equal(result.state,'pending');
});
test('download reports bytes and preserves filename',async()=>{
 const progress=[];
 const result=await downloadFile('abc','token',{onProgress:(...args)=>progress.push(args),operationId:'op-id',request:async(_url,init)=>{assert.deepEqual(JSON.parse(init.body),{fileId:'abc',operationId:'op-id'});return new Response(new Uint8Array([1,2,3]),{headers:{'X-Download-Name':'test.bin','X-Download-Size':'3'}});}});
 assert.equal(result.name,'test.bin');assert.equal(result.blob.size,3);assert.deepEqual(progress,[[3,3]]);
});
test('reject download larger than advertised cap before buffering',async()=>{
 await assert.rejects(downloadFile('abc','token',{request:async()=>new Response(new Uint8Array([1]),{headers:{'Content-Length':String(26*1024*1024)}})}),/tooLarge/);
});

test('folder URL validation and separate folder API',async()=>{
 assert.deepEqual(parseFolderLink('https://drive.google.com/drive/u/1/folders/abc?resourcekey=xyz'),{id:'abc',key:'xyz'});
 assert.equal(isFolderLink('https://drive.google.com/drive/folders/abc'),true);
 assert.equal(isFolderLink('https://evil.example/drive/folders/abc'),false);
 assert.equal(isFolderLink('https://drive.google.com/file/d/abc/view'),false);
 const data=await folderOperation('advance','op','token',{}, {request:async(url,init)=>{assert.ok(url.endsWith('/drive-folder'));assert.deepEqual(JSON.parse(init.body),{action:'advance',operationId:'op'});return new Response(JSON.stringify({state:'copying'}));}});
 assert.equal(data.state,'copying');
});
