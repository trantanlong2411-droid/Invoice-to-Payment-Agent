import {RPC_URL,reviewInvoicePayment,prepareUnsigned,parseAndCompare} from './payment.mjs';
import {SAMPLES,CHAIN_ID} from './invoices.mjs';
import {BUILD_VERSION} from './version.mjs';
import {PAGE} from './page.mjs';
let sequence=0;
const allowed=new Set(['eth_chainId','eth_blockNumber','eth_gasPrice','eth_getBalance',
 'eth_getCode','eth_call','eth_estimateGas','eth_getTransactionCount']);
async function rpc(method,params=[]){
 if(!allowed.has(method))throw Error('Unsafe RPC method requested');
 let last=null;
 for(let attempt=0;attempt<4;attempt++){
  try{
   const id=++sequence;
   const response=await fetch(RPC_URL,{method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id,method,params}),
    signal:AbortSignal.timeout(13000)});
   if(!response.ok)throw Error('Pharos RPC HTTP '+response.status);
   const json=await response.json();
   if(json.error)throw Error(method+': '+String(json.error.message||'RPC error').slice(0,150));
   if(json.jsonrpc!=='2.0'||json.id!==id||json.result===undefined||json.result===null)
    throw Error('Invalid Pharos RPC reply for '+method);
   return json.result;
  }catch(error){last=error;if(attempt<3)await new Promise(r=>setTimeout(r,(attempt+1)*400));}
 }
 throw Error(String(last?.message||last||'RPC unavailable').slice(0,220));
}
function json(value,status=200){
 return Response.json(value,{status,headers:{
  'cache-control':'no-store','x-content-type-options':'nosniff'
 }});
}
function html(value){
 return new Response(value,{headers:{
  'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',
  'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
 }});
}
export default {
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(request.method==='GET'){
   if(path==='/'||path==='/index.html')return html(PAGE);
   if(path==='/api/health')return json({
    ok:true,project:'Invoice-to-Payment Agent',version:BUILD_VERSION,chainId:CHAIN_ID,
    formats:['text','json'],supportedTokens:['USDC','PROS'],
    signatures:false,automaticBroadcast:false,claim:'Invoice-linked unsigned transaction envelopes only'
   });
   if(path==='/api/samples')return json({ok:true,samples:SAMPLES});
   return json({ok:false,error:'Not found'},404);
  }
  if(request.method!=='POST'||!['/api/parse','/api/review','/api/prepare'].includes(path))
   return json({ok:false,error:'Not found'},404);
  let input;
  try{
   const content=await request.text();
   if(content.length>22000)throw Error('Request exceeds 22,000 characters');
   input=JSON.parse(content);
   if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected JSON object');
  }catch(e){return json({ok:false,error:String(e?.message||e)},400)}
  try{
   if(path==='/api/parse'){
    const parsed=parseAndCompare(input);
    return json({version:BUILD_VERSION,...parsed});
   }
   if(path==='/api/review'){
    const result=await reviewInvoicePayment(rpc,input);
    return json({version:BUILD_VERSION,...result},200);
   }
   const prepared=await prepareUnsigned(rpc,input);
   return json({version:BUILD_VERSION,...prepared},prepared.ok?200:400);
  }catch(e){return json({
   ok:false,error:'Live verification failed: '+String(e?.message||e).slice(0,250),
   signed:false,broadcast:false,unsignedTransaction:null
  },502)}
 }
};
