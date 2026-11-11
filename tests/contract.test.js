import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, migrateState, buildBackup, parseBackup } from '../js/storage.js';
import { calculateQuote, quoteInputFromState } from '../js/quote.js';
import { contractTotals, contractModel, paymentRows, rowAmounts, contractErrors, numberWords, endDate, normalizeContract, renderContract } from '../js/contract.js';
import { zipStore } from '../js/contract-word.js';
function sample(extra={}) {
  const s={...defaultState('2026-11-11'),agency:'Demo Travel',owner:'Test Rahbar',agents:'2',...extra};
  s.contract={...s.contract,sellerCompany:'DEMO SERVICE MCHJ',sellerDirector:'Test Rahbar',sellerShort:'Test R.',sellerAddress:'Test manzil',sellerBank:'Test bank',sellerAccount:'20208000600000000002',sellerMfo:'00001',sellerStir:'123456789',number:'17/26',buyerAddress:'Toshkent',buyerBank:'Test bank',buyerAccount:'20208000600000000001',buyerMfo:'00001',buyerStir:'123456789',sellerStamp:'data:image/png;base64,YQ==',...extra.contract};
  return [s,calculateQuote(quoteInputFromState(s))];
}
test('sample contract matches KP and validates without a forced 100% clause',()=>{
  const [s,q]=sample();assert.deepEqual(contractErrors(s,q),[]);
  const c=contractModel(s,q);assert.deepEqual(c.totals,{uzs:2268000,usd:200});assert.equal(c.buyerDirector,'Test Rahbar');
  const html=renderContract({state:s,quote:q});assert.ok(html.includes('ikki million ikki yuz oltmish sakkiz ming'));assert.ok(!html.includes('100 % miqdorida'));assert.equal((html.match(/alt="Bajaruvchi muhri"/g)||[]).length,2);
});
test('2 and 3 installment rounding preserves every cent of both currencies',()=>{
  for(const mode of ['two','three']) {const [s,q]=sample({agents:'5',months:'12',chatbot:'c500',telephony:'utel_optima',contract:{paymentMode:mode}});const c=contractModel(s,q);const totals=c.rows.reduce((a,r)=>{const n=rowAmounts(r,c.totals);a.uzs+=Math.round(n.uzs*100);a.usd+=Math.round(n.usd*100);return a;},{uzs:0,usd:0});assert.equal(totals.uzs,c.totals.uzs*100);assert.equal(totals.usd,c.totals.usd*100);assert.ok(contractErrors(s,q).some(e=>e.message.includes('to‘lov sanasi')));}
});
test('setup first then subscription uses separate currencies and deadlines',()=>{
  const [s,q]=sample({contract:{paymentMode:'separate',payments:[{dueType:'setup',days:'0'},{dueType:'date',date:'2026-12-20'}]}});const rows=paymentRows(s.contract,q);assert.equal(rows[0].uzs,'0');assert.equal(rows[0].usd,'200');assert.equal(rows[1].uzs,'2268000');assert.equal(rows[1].usd,'0');assert.deepEqual(contractErrors(s,q),[]);
});
test('custom installments never silently change after a KP price change',()=>{
  const [s,q]=sample();s.contract.paymentMode='custom';s.contract.payments=paymentRows(normalizeContract({paymentMode:'full'}),q);s.agents='4';const changed=calculateQuote(quoteInputFromState(s));assert.equal(contractModel(s,changed).rows[0].uzs,'2268000');assert.ok(contractErrors(s,changed).some(e=>e.message.includes('Jadval yig‘indisi')));
});
test('percentage plan supports relative deadlines and catches mismatched totals',()=>{
  const [s,q]=sample({contract:{paymentMode:'custom',payments:[{purpose:'Birinchi to‘lov',kind:'percent',percent:'40',dueType:'setup',days:'0'},{purpose:'Qolgan qism',kind:'percent',percent:'60',dueType:'activation',days:'10'}]}});assert.deepEqual(contractErrors(s,q),[]);s.contract.payments[1].percent='50';assert.ok(contractErrors(s,q).some(e=>e.message.includes('Jadval yig‘indisi')));
});
test('UTEL chatbot and MyZvanki are included once with correct billing periods',()=>{
  for(const telephony of ['utel_start','myzvanki']) {const [s,q]=sample({telephony,lines:'2',chatbot:'c500'});const t=contractTotals(q);assert.equal(t.uzs+q.setupUzs,q.grandTotal);const html=renderContract({state:s,quote:q});assert.ok(!html.includes('Telefoniya ushbu shartnoma narxiga kirmaydi.'));assert.ok(html.includes('AI chatbotning birinchi oy'));assert.deepEqual(contractErrors(s,q),[]);}
});
test('12 month contracts use 15 months and 3 bonus months throughout',()=>{
  const [s,q]=sample({months:'12'});const html=renderContract({state:s,quote:q});assert.ok(html.includes('15 (o‘n besh) oy'));assert.ok(html.includes('3 (uch) oy bonus'));assert.ok(html.includes('10.02.2028'));assert.ok(!html.includes('7 (yetti)'));
});
test('service end dates handle leap years and month boundaries',()=>{
  assert.equal(endDate('2026-11-11',7),'2027-06-10');assert.equal(endDate('2024-01-31',1),'2024-02-28');assert.equal(endDate('2026-02-30',7),'');assert.equal(numberWords(123456789),'bir yuz yigirma uch million to‘rt yuz ellik olti ming yetti yuz sakson to‘qqiz');
});
test('missing details, impossible dates and unassigned integrator payments block export',()=>{
  const [s,q]=sample({contract:{buyerStir:'123',startDate:'2026-02-30',setupRecipient:'Integrator'}});const errors=contractErrors(s,q);assert.ok(errors.some(e=>e.key==='buyerStir'));assert.ok(errors.some(e=>e.key==='startDate'));assert.ok(errors.some(e=>e.key==='setupRecipientDetails'));
});
test('contract fields, manual schedule and images survive migration and JSON backups',()=>{
  const [s]=sample({contract:{paymentMode:'custom',payments:[{purpose:'Sinov',uzs:'2268000',usd:'200',dueType:'activation',days:'3'}],buyerStamp:'data:image/png;base64,YQ=='}});
  assert.deepEqual(migrateState(s).contract,normalizeContract(s.contract));const parsed=parseBackup(JSON.stringify(buildBackup({saved:[],state:s,rateMeta:{}})));assert.deepEqual(parsed.current.state.contract,normalizeContract(s.contract));
  const old=migrateState({agency:'Old'});assert.equal(old.contract.paymentMode,'full');assert.equal(old.contract.sellerMfo,'');
});
test('customer text is escaped, arbitrary image URLs are rejected, stamp can be omitted',()=>{
  const [s,q]=sample({agency:'<script>alert(1)</script>',contract:{showSellerStamp:'no',buyerStamp:'javascript:alert(1)'}});const html=renderContract({state:s,quote:q});assert.ok(!html.includes('<script>'));assert.ok(!html.includes('alt="Bajaruvchi muhri"'));assert.ok(!html.includes('javascript:'));
});
test('DOCX ZIP starts with local header and contains central directory',async()=>{
  const b=new Uint8Array(await zipStore({'a.xml':'<test>O‘zbekiston</test>'}).arrayBuffer());assert.equal(new DataView(b.buffer).getUint32(0,true),0x04034b50);assert.equal(new DataView(b.buffer).getUint32(b.length-22,true),0x06054b50);
});

test('local template import reads seller fields without embedding company details in source',async()=>{
  const {sellerFromParagraphs}=await import('../js/contract-media.js');
  const c=sellerFromParagraphs(['Bajaruvchi','DEMO SERVICE MCHJ','Manzil: Test manzil','Bank: Test bank','H/r: 20208000600000000002','MFO: 00001','STIR: 123456789','Rahbar: ______ TEST R.'], 'direktor TEST RAHBAR bir tomondan,');
  assert.equal(c.sellerDirector,'TEST RAHBAR');assert.equal(c.sellerMfo,'00001');assert.equal(c.sellerShort,'TEST R.');
});
test('DOCX local image import works and rejects ambiguous or broken archives',async()=>{
  const {extractDocxStamp,docxMediaEntry}=await import('../js/contract-media.js');
  const blob=zipStore({'word/media/stamp.png':new Uint8Array([1,2,3])});
  const file=await extractDocxStamp(new File([blob],'template.docx'));assert.equal(file.type,'image/png');assert.equal(file.size,3);
  const many=new Uint8Array(await zipStore({'word/media/a.png':'a','word/media/b.png':'b'}).arrayBuffer());assert.throws(()=>docxMediaEntry(many),/bir nechta/);assert.throws(()=>docxMediaEntry(new Uint8Array([1,2,3])),/DOCX/);
});
