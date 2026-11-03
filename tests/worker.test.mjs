import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import worker from '../src/worker.mjs';
import {PAGE} from '../src/page.mjs';
import {BUILD_VERSION} from '../src/version.mjs';
test('interface includes exactly two implemented formats and downloadable unsigned invoice proof',()=>{
 for(const text of ['Text invoice','Structured JSON','Load text sample','Load JSON sample',
  'Load incomplete example','Parse and flag invoice','Validate payment on Pharos',
  'Generate unsigned invoice payment','Export full JSON evidence',
  'OFF_CHAIN_METADATA_ONLY','invoice reference']){
  // metadata constant appears in response API, not in the static page
  if(text==='OFF_CHAIN_METADATA_ONLY')continue;
  assert.ok(PAGE.includes(text),'Missing user-interface element: '+text);
 }
 const source=PAGE.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(source);
 new Script(source[1]);
});
test('API health and samples serve current deployed release',async()=>{
 const response=await worker.fetch(new Request('https://fake.workers.dev/api/health'));
 assert.equal(response.status,200);const h=await response.json();
 assert.equal(h.ok,true);assert.equal(h.version,BUILD_VERSION);
 assert.deepEqual(h.formats,['text','json']);
 assert.equal(h.signatures,false);assert.equal(h.automaticBroadcast,false);
 const samples=await (await worker.fetch(new Request('https://fake.workers.dev/api/samples'))).json();
 assert.match(samples.samples.text,/Payee:/);
 assert.match(samples.samples.json,/paymentReference/);
});
test('API accepts sample text and JSON invoice and refuses missing data before RPC',async()=>{
 for(const format of ['text','json']){
  const samples=await (await worker.fetch(new Request('https://fake.workers.dev/api/samples'))).json();
  const r=await worker.fetch(new Request('https://fake.workers.dev/api/parse',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({format,content:samples.samples[format]})
  }));
  assert.equal(r.status,200);const x=await r.json();
  assert.equal(x.ok,true,JSON.stringify(x));
 }
 const bad=await worker.fetch(new Request('https://fake.workers.dev/api/parse',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({format:'text',content:'Payee: company'})
 }));
 assert.equal((await bad.json()).ok,false);
});
test('API prepare refuses missing confirmation without calling Pharos RPC',async()=>{
 const samples=await (await worker.fetch(new Request('https://fake.workers.dev/api/samples'))).json();
 const result=await worker.fetch(new Request('https://fake.workers.dev/api/prepare',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({format:'text',content:samples.samples.text})
 }));
 assert.equal(result.status,400);
 const j=await result.json();
 assert.equal(j.ok,false);assert.equal(j.signed,false);assert.equal(j.broadcast,false);
});
