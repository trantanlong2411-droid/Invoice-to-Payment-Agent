import {SAMPLES,SAMPLE_SENDER} from './invoices.mjs';
const HTML=String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice-to-Payment Agent | Pharos</title>
<meta name="description" content="Parse text and structured JSON invoices, flag mismatches, verify actual Pharos balances and prepare an invoice-linked unsigned transfer.">
<style>
:root{color-scheme:dark;--bg:#070e20;--panel:#14223d;--line:#344e73;--text:#edf4ff;--muted:#a3b9db;--accent:#bbc9ff;--cyan:#80ead7;--error:#ff9daa;--warn:#ffe0a7}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 10% -15%,#234478,#0c1c37 46%,var(--bg) 90%);color:var(--text);font:14px/1.6 system-ui,Segoe UI,sans-serif}
main{max-width:1160px;margin:auto;padding:28px 22px 75px}header,.row{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}header{font-size:12px;letter-spacing:.07em}
a{color:var(--accent)}.chip{border:1px solid #5877a1;border-radius:99px;padding:4px 10px;font-size:11px;letter-spacing:0}
h1{font-size:clamp(44px,7.3vw,77px);line-height:1.04;letter-spacing:-.065em;margin:56px 0 18px}
h1 em{color:var(--accent);font-style:normal}.lead{font-size:18px;color:var(--muted);max-width:850px}
.banner{border:1px solid #80683e;background:#332c26;color:var(--warn);padding:15px;border-radius:12px;margin:22px 0}
.steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:25px 0}
.step{border:1px solid #38547b;border-radius:12px;padding:14px;background:#0c1e38}
.step b{display:block;color:var(--cyan)}.step small{color:var(--muted)}
.layout{display:grid;grid-template-columns:1.18fr .82fr;gap:16px}.panel{border:1px solid var(--line);border-radius:17px;background:rgba(18,33,59,.96);padding:23px;margin-bottom:16px}
h2{font-size:22px;margin:0 0 13px}h3{font-size:17px;margin:8px 0}.small,small{font-size:12px;color:var(--muted)}p{margin:9px 0}
label{display:block;font-size:12px;color:#bbcae6;margin:13px 0 5px}
input,select,textarea{width:100%;font:inherit;color:var(--text);background:#08172e;border:1px solid #476184;border-radius:10px;padding:12px}
textarea{min-height:230px;resize:vertical;font:13px/1.55 ui-monospace,Consolas,monospace}
button{border:0;border-radius:10px;padding:11px 16px;background:#b8caff;color:#0b1930;font-weight:760;font-size:13px;cursor:pointer}
button.secondary{background:#344f74;color:#f4f7ff}button:disabled{opacity:.42;cursor:not-allowed}
.actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:15px}.twocol{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.status{padding:11px 12px;border-radius:9px;background:#0b1c38;border:1px solid #3a587d;margin:12px 0;overflow-wrap:anywhere}
.alert{color:var(--error)}.success{color:var(--cyan)}.flag{border:1px solid #6c5261;background:#301f32;border-radius:10px;padding:11px;color:#ffc0c7;margin:8px 0}
.kpi{border:1px solid #354c6f;background:#0a1a34;border-radius:10px;padding:12px;overflow-wrap:anywhere}
.kpi small{display:block}.kpi b{font-size:17px;overflow-wrap:anywhere}
.result{display:none}.result.visible{display:block}
pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto;padding:14px;background:#07152b;border:1px solid #364d6c;border-radius:10px;font:12px/1.5 ui-monospace,Consolas,monospace}
.check{border-bottom:1px solid #354966;padding:9px 3px}.agree{display:flex;align-items:flex-start;gap:9px;border:1px solid #3c5c80;border-radius:9px;padding:12px;margin-top:15px;background:#0a1b35}
.agree input{width:19px;height:19px;margin-top:3px;accent-color:#99b7ff}.agree label{margin:0}
hr{border:0;border-top:1px solid #354c6d;margin:19px 0}
footer{font-size:12px;color:var(--muted);margin-top:30px}
@media(max-width:800px){.layout,.steps{grid-template-columns:1fr 1fr}}
@media(max-width:630px){.layout,.steps,.twocol{grid-template-columns:1fr}h1{margin-top:30px}.panel{padding:17px}}
</style></head><body><main>
<header><span>PHAROS / AGENT ARENA <span class="chip">MEDIUM · PAYMENTS</span></span><a href="https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent" target="_blank" rel="noopener">Source & CI evidence ↗</a></header>
<h1>INVOICE-TO-<br><em>PAYMENT AGENT</em></h1>
<p class="lead">Read an invoice, detect missing or conflicting fields, validate an exact on-chain payment and prepare unsigned transaction data linked to the invoice reference. No private keys or automatic transfers.</p>
<div class="banner"><b>Safe by design:</b> Never guess a recipient wallet or fiat-to-token conversion. An invoice reference is preserved as <b>off-chain metadata</b> with the unsigned transaction because standard ERC-20 transfers cannot carry a memo. A public demo sender is not your wallet. Nothing on this site signs or broadcasts funds.</div>
<div class="steps">
<div class="step"><b>01 · PARSE</b><small>Text and structured JSON invoices</small></div>
<div class="step"><b>02 · FLAG</b><small>Missing and mismatched fields</small></div>
<div class="step"><b>03 · REVIEW</b><small>Check Pharos balance & summary</small></div>
<div class="step"><b>04 · UNSIGNED</b><small>Export invoice-linked payment</small></div>
</div>
<div class="layout"><div>
<section class="panel">
<h2>01 / Read an invoice</h2>
<label for="format">Invoice format</label>
<select id="format"><option value="text">Text invoice</option><option value="json">Structured JSON</option></select>
<div class="actions"><button id="textSample" class="secondary">Load text sample</button><button id="jsonSample" class="secondary">Load JSON sample</button><button id="badSample" class="secondary">Load incomplete example</button></div>
<label for="content">Invoice contents</label><textarea id="content" spellcheck="false" placeholder="Paste a text invoice or JSON object"></textarea>
<p class="small">Supported formats: plain-text key/value invoice and flat structured JSON. PDF files are not parsed directly in this version; paste extracted PDF text instead. Two real input formats are supported for this task.</p>
<div class="twocol">
<div><label for="sender">Public sender address</label><input id="sender" spellcheck="false" placeholder="0x..."></div>
<div><label for="expected">Expected amount (optional)</label><input id="expected" placeholder="e.g. 1.00"></div>
</div>
<label for="expectedRecipient">Expected recipient wallet (optional, for mismatch detection)</label>
<input id="expectedRecipient" placeholder="0x...">
<div class="actions"><button id="parse">Parse and flag invoice</button><button id="review" class="secondary">Validate payment on Pharos</button></div>
<p id="status" class="status" role="status">Choose a sample invoice or paste your own. We will not generate a transaction if fields are missing.</p>
<div id="flags" aria-live="polite"></div>
</section>
<section id="reviewPanel" class="panel result">
<h2>02 / Review exact payment</h2>
<p id="summary"></p>
<div class="twocol">
<div class="kpi"><small>INVOICE REFERENCE</small><b id="reference">—</b></div>
<div class="kpi"><small>PAYEE</small><b id="payee">—</b></div>
<div class="kpi"><small>AMOUNT</small><b id="amount">—</b></div>
<div class="kpi"><small>OBSERVED TOKEN BALANCE</small><b id="balance">—</b></div>
<div class="kpi"><small>PHAROS BLOCK</small><b id="block">—</b></div>
<div class="kpi"><small>GAS RESERVE</small><b id="gas">—</b></div>
</div>
<h3>Validation checklist</h3><div id="checks"></div>
<div class="agree"><input id="confirmed" type="checkbox"><label for="confirmed">I reviewed the invoice, payee, recipient, amount, token and reference. I only want unsigned transaction data and understand no transfer will be sent.</label></div>
<div class="actions"><button id="prepare" disabled>Generate unsigned invoice payment</button></div>
<details><summary>Full live review response</summary><pre id="reviewJson">—</pre></details>
</section>
<section id="unsignedPanel" class="panel result">
<h2>03 / Unsigned payment ready</h2>
<p class="status success">No wallet signature, no transfer, and no transaction hash.</p>
<h3>Wallet transaction fields</h3><pre id="txData"></pre>
<h3>Invoice-linked payment metadata</h3><pre id="metaData"></pre>
<p class="small">Keep the invoice reference with this JSON export for reconciliation. The standard ERC-20 transfer calldata only encodes recipient and amount.</p>
<div class="actions"><button id="download">Export full JSON evidence</button><button class="secondary" id="copy">Copy complete JSON</button></div>
</section>
</div><aside>
<section class="panel"><h2>04 / Task coverage</h2>
<p><b>Text and JSON</b> are independently parsed into payee, amount, token, recipient and invoice reference.</p>
<hr><p><b>No guessing:</b> conflicting field values, missing wallet addresses, invalid token names or expected-amount mismatches are shown as explicit errors.</p>
<hr><p><b>Human review first:</b> a signed-off confirmation is required to produce an unsigned JSON envelope; the Worker checks mainnet data again.</p>
<hr><p><b>Live samples:</b> click a sample to try a valid or incomplete invoice. For a successful unsigned example, the public sender must still have sufficient token and PROS gas.</p>
<hr>
<h3>Pharos Mainnet</h3><p class="small">Chain 1672 · Official Circle USDC contract · Native PROS</p>
<p><a href="https://www.circle.com/blog/now-available-usdc-cctp-on-pharos" target="_blank" rel="noopener">Circle USDC on Pharos ↗</a></p>
<p><a href="https://github.com/trantanlong2411-droid/Invoice-to-Payment-Agent/actions" target="_blank" rel="noopener">GitHub tests & evidence ↗</a></p>
</section>
</aside></div>
<footer>Invoice-to-Payment Agent · Pharos Pacific Mainnet · Two invoice formats · Explicit mismatches · Off-chain invoice reference metadata · No signatures or broadcasting.</footer>
</main>
<script>
(function(){
 const $=id=>document.getElementById(id);
 const samples=/*INVOICE_SAMPLES*/;
 const sampleSender='/*INVOICE_SENDER*/';
 let reviewed=null,prepared=null;
 const payload=()=>({
  format:$('format').value,content:$('content').value,
  sender:$('sender').value.trim(),expectedAmount:$('expected').value.trim(),
  expectedRecipient:$('expectedRecipient').value.trim()
 });
 function reset(){
  reviewed=null;prepared=null;$('confirmed').checked=false;$('prepare').disabled=true;
  $('reviewPanel').classList.remove('visible');$('unsignedPanel').classList.remove('visible');
 }
 async function api(path,data){
  const response=await fetch('/api/'+path,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(data)});
  const value=await response.json();
  if(!response.ok)throw Error(value.error||value.reason||'API '+response.status);
  return value;
 }
 function showFlags(data){
  const root=$('flags');root.replaceChildren();
  const p=data.parse||data;
  const issues=[...(p.missing||[]).map(x=>'Missing required field: '+x),
   ...(p.errors||[]),...(p.mismatches||[])];
  for(const value of issues){
   const div=document.createElement('div');div.className='flag';div.textContent=value;root.appendChild(div);
  }
  if(!issues.length){const div=document.createElement('p');div.className='status success';
   div.textContent='Invoice fields are complete and have no detected mismatches.';root.appendChild(div);}
 }
 function load(format,sample){
  reset();$('format').value=format;$('content').value=sample;
  $('sender').value=sampleSender;$('expected').value='';$('expectedRecipient').value='';
  $('flags').replaceChildren();$('status').textContent='Example loaded. Parse and review on-chain before preparing unsigned transaction.';
 }
 $('textSample').onclick=()=>load('text',samples.text);
 $('jsonSample').onclick=()=>load('json',samples.json);
 $('badSample').onclick=()=>load('text',samples.incomplete);
 $('parse').onclick=async()=>{
  reset();$('parse').disabled=true;$('status').textContent='Parsing invoice…';
  try{const result=await api('parse',payload());showFlags(result);
   $('status').textContent=result.ok?'Invoice parsed. Next: Validate payment on Pharos.':
    'Invoice needs correction. No transaction can be prepared.';}
  catch(e){$('status').textContent='Parse failed: '+e.message;}
  finally{$('parse').disabled=false;}
 };
 $('review').onclick=async()=>{
  reset();$('review').disabled=true;$('status').textContent='Checking fields and reading real Pharos balances…';
  try{
   const result=await api('review',payload());showFlags(result);
   if(!result.ok){$('status').textContent='Review blocked: '+result.reason;return}
   reviewed=result;
   $('reviewPanel').classList.add('visible');const r=result.review;
   $('summary').textContent=r.summary;
   $('reference').textContent=r.invoiceReference;$('payee').textContent=r.payee;
   $('amount').textContent=r.amount+' '+r.token;$('balance').textContent=r.observedTokenBalance;
   $('block').textContent=r.block;$('gas').textContent=r.estimatedGasReserve;
   $('reviewJson').textContent=JSON.stringify(result,null,2);
   const root=$('checks');root.replaceChildren();
   for(const c of r.checks){
    const line=document.createElement('div');line.className='check';
    const b=document.createElement('b');b.className=c.ok?'success':'alert';b.textContent=c.ok?'PASS · ':'BLOCK · ';
    line.appendChild(b);line.append(document.createTextNode(c.name+(c.detail?' — '+c.detail:'')));root.appendChild(line);
   }
   $('status').textContent=result.ready?'Ready for explicit user review. Check the box to prepare unsigned data.':
    'On-chain validation blocked. No unsigned transaction will be generated; check the token and gas balance.';
  }catch(e){$('status').textContent='Live check failed: '+e.message}
  finally{$('review').disabled=false}
 };
 $('confirmed').onchange=()=>{
  $('prepare').disabled=!(reviewed&&reviewed.ready&&$('confirmed').checked);
 };
 $('prepare').onclick=async()=>{
  if(!reviewed?.ready||!$('confirmed').checked)return;
  $('prepare').disabled=true;$('status').textContent='Rechecking Pharos and generating unsigned invoice-linked data…';
  try{
   const data=await api('prepare',{...payload(),confirmed:true,reviewId:reviewed.reviewId});
   if(!data.ok||data.signed!==false||data.broadcast!==false)throw Error('Unsafe transaction response');
   prepared=data;$('unsignedPanel').classList.add('visible');
   $('txData').textContent=JSON.stringify(data.unsignedTransaction,null,2);
   $('metaData').textContent=JSON.stringify(data.invoiceMetadata,null,2);
   $('status').textContent='Unsigned transaction envelope ready. No funds were moved.';
  }catch(e){$('status').textContent='Draft blocked: '+e.message}
  finally{$('prepare').disabled=!(reviewed?.ready&&$('confirmed').checked)}
 };
 $('download').onclick=()=>{
  if(!prepared)return;
  const blob=new Blob([JSON.stringify({schema:'pharos-invoice-payment-user-export-v1',
    exportedAtUtc:new Date().toISOString(),parse:reviewed.parse,prepared},null,2)+'\n'],
    {type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='pharos-invoice-payment-unsigned-'+Date.now()+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 };
 $('copy').onclick=()=>{
  if(prepared)navigator.clipboard.writeText(JSON.stringify(prepared,null,2)).catch(()=>{});
 };
 ['format','content','sender','expected','expectedRecipient'].forEach(id=>
  $(id).addEventListener('input',()=>{
   if(reviewed||prepared){reset();$('status').textContent='Invoice or sender changed. Run validation again before preparing a draft.';}
  }));
 load('text',samples.text);
})();
</script></body></html>`;
export const PAGE=HTML.replace('/*INVOICE_SAMPLES*/',JSON.stringify(SAMPLES))
 .replace('/*INVOICE_SENDER*/',SAMPLE_SENDER);
