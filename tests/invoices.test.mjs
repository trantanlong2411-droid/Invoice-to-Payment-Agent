import test from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLES,DEMO_RECIPIENT,parseInvoice,compareInvoice,invoiceFingerprint} from '../src/invoices.mjs';
const sender='0x1111111111111111111111111111111111111111';
test('text invoice extracts payee amount token recipient and invoice reference',()=>{
 const p=parseInvoice({format:'text',content:SAMPLES.text});
 assert.equal(p.ok,true,JSON.stringify(p));
 assert.equal(p.invoice.payee,'Nova Hosting Ltd');
 assert.equal(p.invoice.amount,'1.00');
 assert.equal(p.invoice.currency,'USDC');
 assert.equal(p.invoice.recipient,DEMO_RECIPIENT);
 assert.equal(p.invoice.reference,'HOST-2026-11');
 assert.equal(p.invoice.invoiceNumber,'INV-PHAROS-2026-014');
});
test('structured JSON invoice extracts equivalent fields with camelCase keys',()=>{
 const p=parseInvoice({format:'json',content:SAMPLES.json});
 assert.equal(p.ok,true,JSON.stringify(p));
 assert.equal(p.invoice.payee,'Nova Hosting Ltd');
 assert.equal(p.invoice.reference,'HOST-2026-12');
 assert.equal(p.invoice.invoiceNumber,'INV-PHAROS-2026-015');
 assert.equal(p.invoice.recipient,DEMO_RECIPIENT);
 assert.equal(p.invoice.amount,'1.00');
});
test('missing recipient is an explicit missing field and never guessed',()=>{
 const p=parseInvoice({format:'text',content:SAMPLES.incomplete});
 assert.equal(p.ok,false);
 assert.ok(p.missing.includes('recipient'));
});
test('non-JSON or nested JSON invoice formats are safely rejected',()=>{
 assert.equal(parseInvoice({format:'json',content:'{ bad'}).ok,false);
 assert.equal(parseInvoice({format:'json',content:'["array"]'}).ok,false);
 assert.equal(parseInvoice({format:'json',content:'{"payee":{"name":"x"}}'}).ok,false);
 assert.equal(parseInvoice({format:'pdf',content:'a'}).ok,false);
});
test('conflicting repeated fields flag mismatch',()=>{
 const p=parseInvoice({format:'text',content:SAMPLES.text+'\nAmount: 2.00 USDC'});
 assert.equal(p.ok,false);
 assert.match(p.mismatches.join(' '),/Conflicting repeated field/);
});
test('JSON and text currency conflicts are not silently resolved',()=>{
 const p=parseInvoice({format:'text',content:SAMPLES.text+'\nCurrency: PROS'});
 assert.equal(p.ok,false);
 assert.match(p.mismatches.join(' '),/does not match currency/);
});
test('unexpected fiat currencies do not silently become stablecoin',()=>{
 const p=parseInvoice({format:'json',content:JSON.stringify({
  payee:'Business Inc',recipientWallet:DEMO_RECIPIENT,
  amount:'1.00',currency:'USD',paymentReference:'INV-001'})});
 assert.equal(p.ok,false);
 assert.match(p.errors.join(' '),/Unsupported invoice currency/);
});
test('expected recipient and amount mismatches are flagged exactly',()=>{
 const p=parseInvoice({format:'text',content:SAMPLES.text});
 assert.deepEqual(compareInvoice(p.invoice,{expectedAmount:'1',expectedRecipient:DEMO_RECIPIENT}),[]);
 assert.match(compareInvoice(p.invoice,{expectedAmount:'1.01'}).join(' '),/Amount mismatch/);
 assert.match(compareInvoice(p.invoice,{expectedRecipient:sender}).join(' '),/Recipient/);
});
test('invalid recipient EVM address and too many decimals are blocked',()=>{
 const invalid=SAMPLES.text.replace(DEMO_RECIPIENT,'alice.eth');
 assert.match(parseInvoice({format:'text',content:invalid}).errors.join(' '),/verified.*0x/i);
 const decimal=SAMPLES.text.replace('1.00 USDC','1.0000001 USDC');
 assert.match(parseInvoice({format:'text',content:decimal}).errors.join(' '),/precision/i);
});
test('invoice fingerprint binds reference and amount',()=>{
 const invoice=parseInvoice({format:'text',content:SAMPLES.text}).invoice;
 const a=invoiceFingerprint(invoice,sender);
 assert.match(a,/^0x[0-9a-f]{64}$/);
 assert.notEqual(a,invoiceFingerprint({...invoice,reference:'HOST-2026-99'},sender));
 assert.notEqual(a,invoiceFingerprint({...invoice,amount:'2.00'},sender));
});
