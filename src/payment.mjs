import {Interface,formatUnits,parseUnits} from 'ethers';
import {parseInvoice,compareInvoice,evmAddress,invoiceFingerprint,USDC,CHAIN_ID} from './invoices.mjs';
export const RPC_URL='https://rpc.pharos.xyz';
export const ERC20=new Interface([
 'function balanceOf(address) view returns(uint256)',
 'function decimals() view returns(uint8)',
 'function symbol() view returns(string)',
 'function transfer(address,uint256) returns(bool)'
]);
const hex=n=>'0x'+BigInt(n).toString(16);
const asBig=(x,name)=>{if(typeof x!=='string'||!/^0x[0-9a-f]+$/i.test(x))throw Error('Invalid '+name+' from Pharos');return BigInt(x);};
function summary(invoice,sender,tokenBalance,gasReserve){
 return 'I read invoice '+invoice.invoiceNumber+' for '+invoice.payee+'. '+
  'It requests '+invoice.amount+' '+invoice.currency+' to '+invoice.recipient+
  ' with reference '+invoice.reference+' on Pharos Mainnet (chain 1672). '+
  'The public sender '+sender+' has an observed token balance of '+tokenBalance+
  '. Estimated gas reserve: '+gasReserve+
  '. Review all fields before generating unsigned data; nothing has been signed or sent.';
}
async function readERC20(rpc,method,args,block){
 const data=ERC20.encodeFunctionData(method,args);
 const output=await rpc('eth_call',[{to:USDC,data},block]);
 if(typeof output!=='string'||output==='0x')throw Error('Missing USDC '+method+' response');
 return ERC20.decodeFunctionResult(method,output)[0];
}
export function parseAndCompare(input){
 const parsed=parseInvoice(input);
 const mismatches=parsed.invoice?compareInvoice(parsed.invoice,input):[];
 return {...parsed,mismatches:[...(parsed.mismatches||[]),...mismatches],
  ok:parsed.ok&&mismatches.length===0};
}
export async function reviewInvoicePayment(rpc,input){
 const parsed=parseAndCompare(input);
 if(!parsed.ok)return {ok:false,ready:false,parse:parsed,
  reason:'Invoice has missing, invalid, conflicting or mismatched fields; correct them before preparing any payment.'};
 const sender=evmAddress(input?.sender);
 if(!sender)return {ok:false,ready:false,parse:parsed,reason:'Enter a valid public sender 0x address for balance validation.'};
 const invoice=parsed.invoice;
 if(invoice.recipient===sender)return {ok:false,ready:false,parse:parsed,reason:'The invoice payee recipient equals the sender; confirm a different recipient.'};
 const chain=asBig(await rpc('eth_chainId',[]),'network');
 if(chain!==BigInt(CHAIN_ID))throw Error('Wrong network. Only Pharos Mainnet (1672) is supported');
 const block=await rpc('eth_blockNumber',[]);
 const blockInt=asBig(block,'block');
 if(blockInt===0n)throw Error('Missing Pharos block');
 const gasPrice=asBig(await rpc('eth_gasPrice',[]),'gas price');
 if(gasPrice<=0n)throw Error('Gas price unavailable');
 const native=asBig(await rpc('eth_getBalance',[sender,block]),'native balance');
 const decimals=invoice.currency==='USDC'?6:18;
 let balance=native;
 if(invoice.currency==='USDC'){
  const code=await rpc('eth_getCode',[USDC,block]);
  if(typeof code!=='string'||code==='0x')throw Error('Official USDC contract has no code');
  const [onchainDecimals,onchainSymbol,onchainBalance]=await Promise.all([
   readERC20(rpc,'decimals',[],block),readERC20(rpc,'symbol',[],block),
   readERC20(rpc,'balanceOf',[sender],block)
  ]);
  if(Number(onchainDecimals)!==6||String(onchainSymbol).toUpperCase()!=='USDC')
   throw Error('USDC contract metadata is inconsistent; refusing payment');
  balance=BigInt(onchainBalance);
 }
 const units=parseUnits(invoice.amount,decimals);
 const recipient=invoice.recipient;
 const data=invoice.currency==='USDC'?
  ERC20.encodeFunctionData('transfer',[recipient,units]):'0x';
 const to=invoice.currency==='USDC'?USDC:recipient;
 const value=invoice.currency==='PROS'?hex(units):'0x0';
 const sufficient=balance>=units;
 let gasEstimate=null,gasError=null;
 if(sufficient){
  try{gasEstimate=asBig(await rpc('eth_estimateGas',[{from:sender,to,value,data}]),'estimated gas');
   if(!gasEstimate)throw Error('Invalid gas estimation');
  }catch(e){gasError=String(e?.message||e).slice(0,160);}
 }
 const gasLimit=gasEstimate===null?null:(gasEstimate*120n+99n)/100n;
 const gasReserve=gasLimit===null?null:gasLimit*gasPrice;
 const nativeEnough=gasReserve!==null&&native>=gasReserve+(invoice.currency==='PROS'?units:0n);
 const checks=[
  {name:'Invoice fields complete and consistent',ok:true},
  {name:'Pharos Mainnet 1672',ok:true},
  {name:'Token contract checked',ok:true},
  {name:'Sufficient invoice token balance',ok:sufficient,
   detail:formatUnits(balance,decimals)+' '+invoice.currency+' available; '+invoice.amount+' required'},
  {name:'Live gas estimation',ok:gasLimit!==null,detail:gasError||null},
  {name:'Sufficient PROS for gas',ok:nativeEnough,
   detail:gasReserve===null?'No reliable gas estimate':formatUnits(native,18)+' PROS native balance'}
 ];
 const ready=checks.every(c=>c.ok);
 const nonce=ready?asBig(await rpc('eth_getTransactionCount',[sender,'pending']),'pending nonce'):null;
 const reviewId=invoiceFingerprint(invoice,sender);
 const balanceDisplay=formatUnits(balance,decimals)+' '+invoice.currency;
 const gasDisplay=gasReserve===null?'not available':formatUnits(gasReserve,18)+' PROS';
 const review={
  chainId:CHAIN_ID,network:'Pharos Pacific Mainnet',block:blockInt.toString(),
  verifiedAtUtc:new Date().toISOString(),
  from:sender,payee:invoice.payee,recipient,amount:invoice.amount,
  token:invoice.currency,tokenAddress:invoice.currency==='USDC'?USDC:null,
  invoiceNumber:invoice.invoiceNumber,invoiceReference:invoice.reference,
  description:invoice.description,format:invoice.format,
  amountBaseUnits:units.toString(),observedTokenBalance:balanceDisplay,
  observedNativeBalance:formatUnits(native,18)+' PROS',
  estimatedGasReserve:gasDisplay,checks,nonce:nonce?.toString()??null,
  gasLimit:gasLimit?.toString()??null,gasPriceWei:gasPrice.toString(),
  summary:summary(invoice,sender,balanceDisplay,gasDisplay),
  caveats:[
   'Payment reference is included as off-chain invoice metadata in the export. A standard ERC-20 transfer cannot put an invoice memo on-chain.',
   'Balance, gas and nonce may change before a later wallet signature.',
   'A public sender address does not prove that the user controls the account.',
   'No signing or transaction broadcast is provided.'
  ]
 };
 return {ok:true,ready,reviewId,parse:parsed,review,
  status:ready?'READY_FOR_HUMAN_CONFIRMATION':'BLOCKED_BY_VALIDATION'};
}
export async function prepareUnsigned(rpc,input){
 if(input?.confirmed!==true)return {ok:false,reason:'Review and explicitly confirm the invoice payment first.',signed:false,broadcast:false};
 if(typeof input?.reviewId!=='string'||!/^0x[0-9a-f]{64}$/i.test(input.reviewId))
  return {ok:false,reason:'Missing or invalid review fingerprint',signed:false,broadcast:false};
 const fresh=await reviewInvoicePayment(rpc,input);
 if(!fresh.ok)return {ok:false,reason:fresh.reason,parse:fresh.parse,signed:false,broadcast:false};
 if(fresh.reviewId!==input.reviewId)return {ok:false,reason:'Invoice, sender or recipient changed after review; start over.',signed:false,broadcast:false};
 if(!fresh.ready)return {ok:false,reason:'Current token balance or gas is insufficient. Cannot generate a transaction.',review:fresh.review,signed:false,broadcast:false};
 const r=fresh.review;
 const amount=parseUnits(r.amount,r.token==='USDC'?6:18);
 const tx={
  chainId:hex(CHAIN_ID),from:r.from,
  to:r.token==='USDC'?USDC:r.recipient,
  value:r.token==='PROS'?hex(amount):'0x0',
  data:r.token==='USDC'?ERC20.encodeFunctionData('transfer',[r.recipient,amount]):'0x',
  gas:hex(r.gasLimit),gasPrice:hex(r.gasPriceWei),nonce:hex(r.nonce)
 };
 const invoiceMetadata={
  invoiceNumber:r.invoiceNumber,invoiceReference:r.invoiceReference,
  payee:r.payee,recipient:r.recipient,
  amount:r.amount,token:r.token,
  referenceStorage:'OFF_CHAIN_METADATA_ONLY'
 };
 return {ok:true,status:'UNSIGNED_READY_FOR_EXTERNAL_WALLET',
  generatedAtUtc:new Date().toISOString(),reviewId:fresh.reviewId,
  review:r,unsignedTransaction:tx,invoiceMetadata,
  signed:false,broadcast:false,privateKeyUsed:false,
  reminder:'This is an unsigned invoice-linked envelope. ERC-20 transfer calldata does not contain the reference; keep metadata alongside the transfer for reconciliation.'};
}
