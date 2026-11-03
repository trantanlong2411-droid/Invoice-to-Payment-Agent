import {getAddress,parseUnits,keccak256,toUtf8Bytes} from 'ethers';
export const USDC='0xC879C018dB60520F4355C26eD1a6D572cdAC1815';
export const CHAIN_ID=1672;
export const SAMPLE_SENDER='0x08cd62babd8Dac7404504792Df30C12fC5384Df5';
export const DEMO_RECIPIENT='0x2222222222222222222222222222222222222222';
export const SAMPLES={
 text:[
  'INVOICE',
  'Invoice Number: INV-PHAROS-2026-014',
  'Payee: Nova Hosting Ltd',
  'Recipient Wallet: '+DEMO_RECIPIENT,
  'Amount: 1.00 USDC',
  'Payment Reference: HOST-2026-11',
  'Description: Monthly cloud hosting'
 ].join('\n'),
 json:JSON.stringify({
  invoiceNumber:'INV-PHAROS-2026-015',
  payee:'Nova Hosting Ltd',recipientWallet:DEMO_RECIPIENT,
  amount:'1.00',currency:'USDC',paymentReference:'HOST-2026-12',
  description:'Subscription invoice'
 },null,2),
 incomplete:[
  'INVOICE',
  'Invoice Number: INV-PHAROS-2026-016',
  'Payee: Nova Hosting Ltd',
  'Amount: 1.00 USDC',
  'Description: Missing payment address and reference'
 ].join('\n')
};
const zero='0x0000000000000000000000000000000000000000';
export function evmAddress(value){
 try{const a=getAddress(String(value??''));return a===zero?null:a}catch{return null;}
}
const fieldMap={
 payee:['payee','vendor','supplier','merchant','bill to','beneficiary name'],
 recipient:['recipient wallet','recipient address','wallet address','payment address','payee wallet','recipient'],
 amount:['amount','total due','amount due','total','payment amount'],
 currency:['currency','token','asset'],
 reference:['payment reference','invoice reference','reference','invoice number','invoice id','invoice #','invoice no'],
 invoiceNumber:['invoice number','invoice no','invoice #','invoice id'],
 description:['description','memo','service']
};
const validRef=s=>/^[a-zA-Z0-9][a-zA-Z0-9._/#-]{2,63}$/.test(s);
function normalize(raw,format){
 const errors=[],missing=[],mismatch=[];
 const candidates=(raw&&typeof raw==='object')?raw:{};
 const entries=Object.entries(candidates);
 const values={};
 for(const [name,keys] of Object.entries(fieldMap)){
  const matched=entries.filter(([k])=>keys.includes(k.toLowerCase().trim()));
  if(!matched.length)continue;
  const distinct=[...new Set(matched.map(([,v])=>String(v??'').trim()).filter(Boolean))];
  if(distinct.length>1)mismatch.push('Conflicting '+name+' values within the invoice');
  values[name]=distinct[0]||'';
 }
 // Amount may be combined with its token (e.g. "Amount: 1.00 USDC").
 const rawAmount=String(values.amount||'').trim();
 const combined=rawAmount.match(/^(\d+(?:\.\d+)?)\s*(USDC|PROS|USD|USDT|EUR)?$/i);
 if(combined){values.amount=combined[1];if(combined[2]){
  if(values.currency&&values.currency.toUpperCase()!==combined[2].toUpperCase())
   mismatch.push('Invoice amount token does not match currency field');
  values.currency=values.currency||combined[2];
 }}
 else if(rawAmount)errors.push('Amount is not a single positive decimal with a recognized token');
 values.currency=String(values.currency||'').toUpperCase().trim();
 const required=['payee','recipient','amount','currency','reference'];
 for(const k of required)if(!values[k])missing.push(k);
 if(!values.invoiceNumber&&values.reference)values.invoiceNumber=values.reference;
 if(values.payee&&(values.payee.length<2||values.payee.length>100))errors.push('Payee name must be 2–100 characters');
 if(values.recipient&&!evmAddress(values.recipient))errors.push('Recipient must be a verified, nonzero 0x EVM wallet address; names are not resolved');
 if(values.recipient&&evmAddress(values.recipient))values.recipient=evmAddress(values.recipient);
 if(values.reference&&!validRef(values.reference))errors.push('Payment reference must be a 3–64-character identifier (letters/numbers and . _ / # -)');
 if(values.currency&&!['USDC','PROS'].includes(values.currency))
  errors.push('Unsupported invoice currency. Use explicit Pharos USDC or PROS; fiat USD is not silently assumed to be USDC');
 if(values.amount){
  if(!/^\d+(?:\.\d+)?$/.test(values.amount)||!/[^0.]/.test(values.amount))errors.push('Amount must be positive');
  else if(['USDC','PROS'].includes(values.currency)){
   if((values.amount.split('.')[1]||'').length>(values.currency==='USDC'?6:18))errors.push('Excess token precision');
   else try{if(parseUnits(values.amount,values.currency==='USDC'?6:18)===0n)errors.push('Zero payment amount')}catch{errors.push('Invalid amount');}
  }
  if(values.amount.length>50)errors.push('Amount exceeds supported length');
 }
 const invoice={
  format,payee:values.payee||null,recipient:values.recipient||null,
  amount:values.amount||null,currency:values.currency||null,
  reference:values.reference||null,invoiceNumber:values.invoiceNumber||null,
  description:values.description||null
 };
 return {ok:!missing.length&&!errors.length&&!mismatch.length,
  format,invoice,missing,errors,mismatches:mismatch,
  notes:['No payment is executed. Invoice reference is preserved as off-chain payment metadata; plain ERC-20 transfer(address,uint256) has no on-chain memo.']};
}
export function parseInvoice(input){
 const format=String(input?.format||'').toLowerCase();
 const content=input?.content;
 if(!['text','json'].includes(format))
  return {ok:false,format,invoice:null,missing:[],errors:['Choose Text or JSON invoice format'],mismatches:[]};
 if(typeof content!=='string'||!content.trim()||content.length>18000)
  return {ok:false,format,invoice:null,missing:[],errors:['Invoice content must be 1–18,000 characters'],mismatches:[]};
 if(format==='json'){
  let object;
  try{object=JSON.parse(content)}catch{return {ok:false,format,invoice:null,missing:[],errors:['Invalid JSON invoice structure'],mismatches:[]};}
  if(!object||typeof object!=='object'||Array.isArray(object))
   return {ok:false,format,invoice:null,missing:[],errors:['JSON invoice must be one object'],mismatches:[]};
  const raw={};
  for(const [k,v] of Object.entries(object)){
   if(v&&typeof v==='object')return {ok:false,format,invoice:null,missing:[],errors:['Nested invoice values are unsupported. Provide flat key-value fields'],mismatches:[]};
   raw[k]=v;
  }
  return normalize(raw,'json');
 }
 const raw={};
 const duplicates=[];
 for(const line of content.split(/\r?\n/)){
  if(line.length>500){duplicates.push('Invoice text contains an excessively long line');continue}
  const m=line.match(/^\s*([^:]{2,45}):\s*(.*?)\s*$/);
  if(!m)continue;
  const key=m[1].trim().toLowerCase(),value=m[2].trim();
  if(Object.hasOwn(raw,key)){if(raw[key]!==value)duplicates.push('Conflicting repeated field: '+key);}
  else raw[key]=value;
 }
 const result=normalize(raw,'text');
 result.mismatches.push(...duplicates);
 result.ok=result.ok&&!duplicates.length;
 return result;
}
export function compareInvoice(invoice,confirmation={}){
 const mismatches=[];
 const overrides={
  payee:confirmation.expectedPayee,
  recipient:confirmation.expectedRecipient,
  amount:confirmation.expectedAmount,
  currency:confirmation.expectedCurrency,
  reference:confirmation.expectedReference
 };
 for(const [field,expected] of Object.entries(overrides)){
  if(expected===undefined||expected===null||String(expected).trim()==='')continue;
  const found=String(invoice?.[field]??'').trim(),wanted=String(expected).trim();
  if(field==='recipient'&&evmAddress(wanted)!==evmAddress(found))
   mismatches.push('Recipient does not match the expected verified address');
  else if(field==='currency'&&found.toUpperCase()!==wanted.toUpperCase())
   mismatches.push('Currency/token mismatch with expected payment');
  else if(field==='amount'&&(!/^\d+(?:\.\d+)?$/.test(wanted)||
     Number(found)!==Number(wanted)))mismatches.push('Amount mismatch with expected payment');
  else if(!['recipient','currency','amount'].includes(field)&&
    found.toLowerCase()!==wanted.toLowerCase())mismatches.push(field+' mismatch with expected payment');
 }
 return mismatches;
}
export function invoiceFingerprint(invoice,sender){
 return keccak256(toUtf8Bytes(JSON.stringify([
  1672,String(sender).toLowerCase(),
  invoice.recipient.toLowerCase(),invoice.currency,invoice.amount,
  invoice.reference,invoice.payee,invoice.invoiceNumber
 ])));
}
