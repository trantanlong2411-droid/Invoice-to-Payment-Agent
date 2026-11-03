import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUnits} from 'ethers';
import {SAMPLES,SAMPLE_SENDER,DEMO_RECIPIENT,USDC} from '../src/invoices.mjs';
import {ERC20,reviewInvoicePayment,prepareUnsigned} from '../src/payment.mjs';
const input={format:'text',content:SAMPLES.text,sender:SAMPLE_SENDER};
function fake({chain='0x688',tokens=10_000_000n,pros=10n**18n,failEstimate=false}={}){
 const methods=[];
 const rpc=async(method,params=[])=>{
  methods.push(method);
  if(method==='eth_chainId')return chain;
  if(method==='eth_blockNumber')return '0x1234';
  if(method==='eth_gasPrice')return '0x3b9aca00';
  if(method==='eth_getBalance')return '0x'+pros.toString(16);
  if(method==='eth_getCode')return '0x608060';
  if(method==='eth_getTransactionCount')return '0x2';
  if(method==='eth_estimateGas'){
   if(failEstimate)throw Error('execution reverted');
   return '0xe000';
  }
  if(method==='eth_call'){
   const parsed=ERC20.parseTransaction({data:params[0].data});
   if(parsed.name==='decimals')return ERC20.encodeFunctionResult('decimals',[6]);
   if(parsed.name==='symbol')return ERC20.encodeFunctionResult('symbol',['USDC']);
   if(parsed.name==='balanceOf')return ERC20.encodeFunctionResult('balanceOf',[tokens]);
  }
  throw Error('RPC mock method missing '+method);
 };
 return {rpc,methods};
}
test('human-readable reviewed invoice includes payee, onchain balance and reference but no transaction',async()=>{
 const {rpc,methods}=fake();
 const r=await reviewInvoicePayment(rpc,input);
 assert.equal(r.ok,true);assert.equal(r.ready,true);
 assert.equal(r.review.chainId,1672);assert.equal(r.review.token,'USDC');
 assert.equal(r.review.invoiceReference,'HOST-2026-11');
 assert.equal(r.review.payee,'Nova Hosting Ltd');
 assert.equal(r.review.recipient,DEMO_RECIPIENT);
 assert.match(r.review.summary,/HOST-2026-11/);
 assert.equal('unsignedTransaction' in r,false);
 assert.ok(r.review.checks.every(c=>c.ok));
 assert.ok(methods.includes('eth_getCode'));
 assert.ok(!methods.some(x=>x.startsWith('eth_send')||x.startsWith('personal_sign')));
});
test('confirmed invoice creates unsigned envelope with offchain reference and exact transfer calldata',async()=>{
 const r=await reviewInvoicePayment(fake().rpc,input);
 const out=await prepareUnsigned(fake().rpc,{...input,reviewId:r.reviewId,confirmed:true});
 assert.equal(out.ok,true);
 assert.equal(out.signed,false);assert.equal(out.broadcast,false);
 assert.equal(out.invoiceMetadata.invoiceReference,'HOST-2026-11');
 assert.equal(out.invoiceMetadata.referenceStorage,'OFF_CHAIN_METADATA_ONLY');
 assert.equal(out.unsignedTransaction.chainId,'0x688');
 assert.equal(out.unsignedTransaction.to.toLowerCase(),USDC.toLowerCase());
 assert.equal(out.unsignedTransaction.value,'0x0');
 assert.ok(out.unsignedTransaction.data.startsWith('0xa9059cbb'));
 const [to,amount]=ERC20.decodeFunctionData('transfer',out.unsignedTransaction.data);
 assert.equal(to,DEMO_RECIPIENT);assert.equal(amount,parseUnits('1',6));
 assert.equal('reference' in out.unsignedTransaction,false);
 assert.equal('signature' in out.unsignedTransaction,false);
 assert.equal('hash' in out.unsignedTransaction,false);
});
test('explicit confirmation required and revised invoice invalidates review',async()=>{
 const r=await reviewInvoicePayment(fake().rpc,input);
 const denied=await prepareUnsigned(fake().rpc,{...input,reviewId:r.reviewId});
 assert.equal(denied.ok,false);assert.match(denied.reason,/confirm/);
 const changed=await prepareUnsigned(fake().rpc,{
  ...input,content:SAMPLES.text.replace('1.00 USDC','2.00 USDC'),
  reviewId:r.reviewId,confirmed:true
 });
 assert.equal(changed.ok,false);assert.match(changed.reason,/changed/);
});
test('missing invoice fields and mismatch block before making any RPC calls',async()=>{
 const rpc=async()=>{throw Error('Should not read chain')};
 const p=await reviewInvoicePayment(rpc,{...input,content:SAMPLES.incomplete});
 assert.equal(p.ok,false);assert.ok(p.parse.missing.includes('recipient'));
 const m=await reviewInvoicePayment(rpc,{...input,expectedAmount:'2.00'});
 assert.equal(m.ok,false);assert.ok(m.parse.mismatches.length);
});
test('insufficient USDC or PROS blocks unsigned preparation',async()=>{
 const empty=await reviewInvoicePayment(fake({tokens:0n}).rpc,input);
 assert.equal(empty.ready,false);
 assert.equal(empty.review.checks.find(x=>x.name==='Sufficient invoice token balance').ok,false);
 const gas=await reviewInvoicePayment(fake({pros:0n}).rpc,input);
 assert.equal(gas.ready,false);
 const result=await prepareUnsigned(fake({pros:0n}).rpc,{...input,reviewId:gas.reviewId,confirmed:true});
 assert.equal(result.ok,false);assert.equal('unsignedTransaction' in result,false);
});
test('gas estimation failures block invoice payment and wrong chain is refused',async()=>{
 const denied=await reviewInvoicePayment(fake({failEstimate:true}).rpc,input);
 assert.equal(denied.ready,false);
 await assert.rejects(()=>reviewInvoicePayment(fake({chain:'0x1'}).rpc,input),/Wrong network/);
});
test('PROS structured JSON invoice can produce native unsigned payment with invoice reference',async()=>{
 const json=JSON.stringify({payee:'Hosting Company',recipientWallet:DEMO_RECIPIENT,
  amount:'0.01',currency:'PROS',paymentReference:'SUB-1234',invoiceNumber:'INV-1234'});
 const body={format:'json',content:json,sender:SAMPLE_SENDER};
 const out=await reviewInvoicePayment(fake().rpc,body);
 assert.equal(out.ok,true);assert.equal(out.ready,true);
 const draft=await prepareUnsigned(fake().rpc,{...body,reviewId:out.reviewId,confirmed:true});
 assert.equal(draft.ok,true);
 assert.equal(draft.unsignedTransaction.to,DEMO_RECIPIENT);
 assert.equal(draft.unsignedTransaction.value,'0x'+parseUnits('0.01',18).toString(16));
 assert.equal(draft.unsignedTransaction.data,'0x');
 assert.equal(draft.invoiceMetadata.invoiceReference,'SUB-1234');
});
