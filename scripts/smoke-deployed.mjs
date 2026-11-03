import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {parseUnits} from 'ethers';
import {BUILD_VERSION} from '../src/version.mjs';
import {SAMPLES,SAMPLE_SENDER,DEMO_RECIPIENT,USDC} from '../src/invoices.mjs';
import {ERC20} from '../src/payment.mjs';

const base=(process.env.INVOICE_AGENT_URL||
 'https://invoice-to-payment-agent.trantanlong2411.workers.dev').replace(/\/$/,'');
const delay=t=>new Promise(r=>setTimeout(r,t));
async function endpoint(path,body){
 const response=await fetch(base+path,{method:body?'POST':'GET',
  headers:body?{'content-type':'application/json'}:{},
  body:body?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(85000)});
 let value;
 const raw=await response.text();
 try{value=JSON.parse(raw)}catch{throw Error('Worker returned non-JSON HTTP '+response.status+': '+raw.slice(0,120))}
 return {status:response.status,value};
}
const result={
 schema:'pharos-invoice-payment-deployed-live-v1',website:base,
 observedAtUtc:new Date().toISOString(),referenceStorage:'OFF_CHAIN_METADATA_ONLY',
 signatureGenerated:false,transactionBroadcast:false,steps:{}
};
let health;
for(let attempt=0;attempt<34;attempt++){
 try{
  const data=await endpoint('/api/health');
  health=data.value;
  if(health.ok===true&&health.version===BUILD_VERSION)break;
  console.log('WAIT_FOR_DEPLOY',attempt+1,'got:',health.version,'expected:',BUILD_VERSION);
 }catch(e){console.log('WAIT_FOR_DEPLOY',attempt+1,String(e.message||e).slice(0,120));}
 await delay(4500);
}
assert.equal(health?.version,BUILD_VERSION,'Expected Worker code is not deployed');
assert.deepEqual(health.formats,['text','json']);
assert.equal(health.signatures,false);
assert.equal(health.automaticBroadcast,false);
result.health=health;
console.log('LIVE_INVOICE_WORKER_VERSION_VERIFIED',health.version);
for(const format of ['text','json']){
 const output=await endpoint('/api/parse',{format,content:SAMPLES[format]});
 assert.equal(output.status,200);
 assert.equal(output.value.ok,true,JSON.stringify(output.value));
 assert.equal(output.value.invoice.amount,'1.00');
 assert.equal(output.value.invoice.recipient.toLowerCase(),DEMO_RECIPIENT.toLowerCase());
 assert.ok(output.value.invoice.reference);
 result.steps[format]={passed:true,invoice:output.value.invoice};
}
console.log('TWO_REAL_WORKER_INVOICE_FORMATS_VERIFIED');
const missing=await endpoint('/api/parse',{format:'text',content:SAMPLES.incomplete});
assert.equal(missing.value.ok,false);
assert.ok(missing.value.missing.includes('recipient'));
result.steps.missing={passed:true,flags:missing.value.missing};
const mismatch=await endpoint('/api/parse',{format:'text',content:SAMPLES.text,expectedAmount:'2.00'});
assert.equal(mismatch.value.ok,false);
assert.match(mismatch.value.mismatches.join(' '),/Amount mismatch/);
result.steps.mismatch={passed:true,flags:mismatch.value.mismatches};
console.log('MISSING_AND_MISMATCH_REJECTION_VERIFIED');
const unfunded=await endpoint('/api/review',{format:'text',content:SAMPLES.text,
 sender:'0x1111111111111111111111111111111111111111'});
assert.equal(unfunded.status,200);
assert.equal(unfunded.value.ok,true);
assert.equal(unfunded.value.ready,false);
assert.ok(unfunded.value.review.checks.some(c=>!c.ok));
result.steps.insufficientBalance={
 passed:true,block:unfunded.value.review.block,
 checks:unfunded.value.review.checks,ready:false
};
const consent=await endpoint('/api/prepare',{format:'text',content:SAMPLES.text,sender:SAMPLE_SENDER});
assert.equal(consent.status,400);assert.equal(consent.value.ok,false);
result.steps.unconfirmed={passed:true,reason:consent.value.reason};
console.log('NO_BALANCE_AND_NO_CONSENT_GATES_VERIFIED');
const candidates=[SAMPLE_SENDER,'0x086eb9C2B14dD657ae77D07dF9115A2F946CE327'];
let good=null;
for(const sender of candidates){
 try{
  const reviewed=await endpoint('/api/review',{format:'text',content:SAMPLES.text,sender});
  if(reviewed.status!==200||!reviewed.value.ok||!reviewed.value.ready){
   console.log('SAMPLE_SENDER_NO_LONGER_FUNDED',sender,reviewed.value.review?.observedTokenBalance||reviewed.value.reason||'blocked');continue;
  }
  const request={format:'text',content:SAMPLES.text,sender,confirmed:true,reviewId:reviewed.value.reviewId};
  const prepared=await endpoint('/api/prepare',request);
  if(prepared.status!==200||!prepared.value.ok){
   console.log('SAMPLE_PREPARE_FAIL',sender,prepared.value.reason);continue;
  }
  good={sender,reviewed:reviewed.value,prepared:prepared.value};break;
 }catch(e){console.log('SAMPLE_RECHECK_ERROR',sender,String(e.message||e).slice(0,140))}
}
assert.ok(good,'No verified positive real funded public sender; cannot claim positive live unsigned test');
const tx=good.prepared.unsignedTransaction;
const [payee,amount]=ERC20.decodeFunctionData('transfer',tx.data);
assert.equal(tx.chainId,'0x688');
assert.equal(tx.to.toLowerCase(),USDC.toLowerCase());
assert.equal(payee.toLowerCase(),DEMO_RECIPIENT.toLowerCase());
assert.equal(amount,parseUnits('1',6));
assert.equal(good.prepared.invoiceMetadata.invoiceReference,'HOST-2026-11');
assert.equal(good.prepared.invoiceMetadata.referenceStorage,'OFF_CHAIN_METADATA_ONLY');
assert.equal(good.prepared.signed,false);assert.equal(good.prepared.broadcast,false);
assert.ok(tx.gas&&tx.gasPrice&&tx.nonce);
assert.ok(!('signature' in tx||'hash' in tx));
result.steps.positiveUnsigned={
 passed:true,sender:good.sender,chainId:1672,
 block:good.prepared.review.block,amount:'1 USDC',
 sourceTokenBalance:good.prepared.review.observedTokenBalance,
 gasReserve:good.prepared.review.estimatedGasReserve,
 recipient:payee,selector:tx.data.slice(0,10),
 invoiceReference:good.prepared.invoiceMetadata.invoiceReference,
 metadataStorage:'OFF_CHAIN_METADATA_ONLY',signed:false,broadcast:false,
 source:'Pharos Mainnet RPC via deployed Cloudflare Worker; public third-party account'
};
console.log('LIVE_INVOICE_UNSIGNED_MAINNET_SUCCESS',JSON.stringify(result.steps.positiveUnsigned));
result.finishedAtUtc=new Date().toISOString();
await mkdir('proof',{recursive:true});
await writeFile('proof/live-invoice-worker.json',JSON.stringify(result,null,2)+'\n');
console.log('INVOICE_AGENT_LIVE_PROOF_SUCCESS',JSON.stringify({
 formats:['text','json'],mismatchDetection:true,insufficientBlocked:true,
 unsignedDraftVerified:true,referenceIncludedOffchain:true,signed:false,broadcast:false,
 artifact:'proof/live-invoice-worker.json'
}));
