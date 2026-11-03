import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {parseUnits} from 'ethers';
import {reviewInvoicePayment,prepareUnsigned,ERC20,RPC_URL} from '../src/payment.mjs';
import {SAMPLES,SAMPLE_SENDER,DEMO_RECIPIENT,USDC} from '../src/invoices.mjs';
let id=0;
const sleep=t=>new Promise(r=>setTimeout(r,t));
async function rpc(method,params=[]){
 let error=null;
 for(let attempt=0;attempt<6;attempt++){
  try{
   const seq=++id;
   const res=await fetch(RPC_URL,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:seq,method,params}),signal:AbortSignal.timeout(13000)});
   if(!res.ok)throw Error('Pharos RPC HTTP '+res.status);
   const j=await res.json();
   if(j.error)throw Error(method+': '+j.error.message);
   if(j.id!==seq||j.result===undefined||j.result===null)throw Error('Invalid RPC response');
   return j.result;
  }catch(e){error=e;if(attempt<5)await sleep((attempt+1)*650);}
 }
 throw Error(String(error?.message||error||'RPC unavailable'));
}
const proof={
 schema:'pharos-invoice-payment-direct-mainnet-proof-v1',
 observedAtUtc:new Date().toISOString(),source:'Independent direct Pharos Mainnet JSON-RPC from GitHub Actions',
 chainId:1672,formatsTested:['text','json'],sent:false,signed:false,
 note:'The public sample sender is not owned or controlled by the project; no transfer occurred.'
};
for(const format of ['text','json']){
 const input={format,content:SAMPLES[format],sender:SAMPLE_SENDER};
 const r=await reviewInvoicePayment(rpc,input);
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.equal(r.review.chainId,1672);
 assert.equal(r.review.invoiceReference,format==='text'?'HOST-2026-11':'HOST-2026-12');
 proof[format]={status:r.status,block:r.review.block,ready:r.ready,
  balance:r.review.observedTokenBalance,gas:r.review.estimatedGasReserve,
  reference:r.review.invoiceReference,checks:r.review.checks};
 console.log('DIRECT_PHAROS_INVOICE_REVIEW',JSON.stringify({format,ready:r.ready,block:r.review.block}));
 if(format==='text'){
  assert.equal(r.ready,true,'Previously verified public sample sender no longer has enough USDC and PROS');
  const draft=await prepareUnsigned(rpc,{...input,reviewId:r.reviewId,confirmed:true});
  assert.equal(draft.ok,true,JSON.stringify(draft));
  assert.equal(draft.signed,false);assert.equal(draft.broadcast,false);
  assert.equal(draft.invoiceMetadata.invoiceReference,'HOST-2026-11');
  assert.equal(draft.invoiceMetadata.referenceStorage,'OFF_CHAIN_METADATA_ONLY');
  const tx=draft.unsignedTransaction;
  assert.equal(tx.chainId,'0x688');
  assert.equal(tx.to.toLowerCase(),USDC.toLowerCase());
  assert.equal(tx.value,'0x0');
  const [to,amount]=ERC20.decodeFunctionData('transfer',tx.data);
  assert.equal(to.toLowerCase(),DEMO_RECIPIENT.toLowerCase());
  assert.equal(amount,parseUnits('1',6));
  proof.unsignedDraft={createdAtUtc:draft.generatedAtUtc,block:draft.review.block,
   sender:tx.from,recipient:to,amount:'1 USDC',symbol:'USDC',
   selector:tx.data.slice(0,10),invoiceReference:draft.invoiceMetadata.invoiceReference,
   referenceStorage:'OFF_CHAIN_METADATA_ONLY',signed:false,broadcast:false,
   transaction:tx};
  console.log('PHAROS_DIRECT_MAINNET_UNSIGNED_INVOICE_VERIFIED',JSON.stringify({
   block:draft.review.block,from:tx.from,amount:'1 USDC',
   reference:draft.invoiceMetadata.invoiceReference,signature:false,broadcast:false
  }));
 }
}
const missing=await reviewInvoicePayment(async()=>{throw Error('no network expected')},{
 format:'text',content:SAMPLES.incomplete,sender:SAMPLE_SENDER});
assert.equal(missing.ok,false);
proof.incompleteBlocked=true;
const mismatch=await reviewInvoicePayment(async()=>{throw Error('no network expected')},{
 format:'text',content:SAMPLES.text,sender:SAMPLE_SENDER,expectedAmount:'5.00'});
assert.equal(mismatch.ok,false);
proof.mismatchBlocked=true;
await mkdir('proof',{recursive:true});
await writeFile('proof/direct-mainnet-invoice.json',JSON.stringify(proof,null,2)+'\n');
console.log('INVOICE_TO_PAYMENT_DIRECT_MAINNET_PASS',JSON.stringify({
 chainId:1672,text:true,json:true,missingBlocked:true,mismatchBlocked:true,
 unsignedDraft:true,signed:false,broadcast:false,artifact:'proof/direct-mainnet-invoice.json'
}));
