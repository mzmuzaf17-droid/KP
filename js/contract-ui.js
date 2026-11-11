import { esc, fmtDecimal } from './format.js';
import { DEFAULT_SELLER_STAMP, normalizeContract, contractModel, contractErrors, paymentRows, rowAmounts, contractTotals, dueText } from './contract.js';
import { compressLogo } from './logo.js';
import { importContractTemplate } from './contract-media.js';
import { downloadContractDocx } from './contract-word.js';

const field=(key,label,type='text',hint='')=>`<div class="field"><label for="contract-${key}">${label}</label><input id="contract-${key}" data-contract="${key}" type="${type}" ${type==='text'?'maxlength="1000"':''}>${hint?`<small>${hint}</small>`:''}</div>`;
const opts=(items,value)=>items.map(([v,t])=>`<option value="${v}"${v===value?' selected':''}>${t}</option>`).join('');
const modes=[['full','To‘liq to‘lash'],['two','2 ga bo‘lib to‘lash'],['three','3 ga bo‘lib to‘lash'],['separate','O‘rnatish hozir, obuna keyin'],['custom','Erkin jadval']];
const dueTypes=[['date','Aniq sana'],['setup','O‘rnatish va o‘qitish kuni'],['activation','Obuna boshlanish kuni']];
export function mountContractUI({getState,getQuote,onChange,onRender,onMode,notify}) {
  let mode='kp',rowsSignature='';
  const nav=document.createElement('div');nav.className='document-switch';nav.innerHTML=`<span>Hujjat</span><div role="group" aria-label="Hujjat turi"><button class="btn" id="documentKp" type="button" aria-pressed="true">Tijorat taklifi</button><button class="btn" id="documentContract" type="button" aria-pressed="false">Shartnoma</button></div><button class="btn ghost" id="contractWord" type="button" hidden>Word yuklash</button>`;
  document.querySelector('.topbar').after(nav);
  const section=document.createElement('div');section.id='contractEditor';section.hidden=true;
  section.innerHTML=`<div id="contractErrors" class="contract-errors" tabindex="-1" hidden></div>
    <details class="card" open><summary>Shartnoma ma’lumotlari</summary><div class="fields"><div class="field full"><label for="contract-stampDocx">Asl Word faylidan rekvizit va muhrni olish</label><input id="contract-stampDocx" type="file" accept=".docx"><small>Bajaruvchi rekvizitlari va muhr shu brauzerda olinadi. Fayl serverga yuborilmaydi.</small></div>${field('number','Shartnoma raqami')}${field('city','Tuzilgan shahar')}${field('date','Shartnoma sanasi','date','Bo‘sh bo‘lsa KP sanasi olinadi.')}${field('startDate','Obuna boshlanish sanasi','date','To‘lov sanasidan alohida. Bo‘sh bo‘lsa shartnoma sanasi olinadi.')}<p class="field full" id="contractTerm"></p></div></details>
    <details class="card" open><summary>Buyurtmachi rekvizitlari</summary><div class="fields">${field('buyerCompany','To‘liq yuridik nomi','text','Bo‘sh bo‘lsa KPdagi agentlik nomi olinadi.')}${field('buyerDirector','Rahbarning to‘liq F.I.Sh.','text','Bo‘sh bo‘lsa KPdagi rahbar olinadi.')}${field('buyerAddress','Yuridik manzil')}${field('buyerBank','Bank nomi')}${field('buyerAccount','Hisob raqami · 20 raqam')}${field('buyerMfo','MFO · 5 raqam')}${field('buyerStir','STIR · 9 raqam')}</div></details>
    <details class="card" open><summary>To‘lov tartibi</summary><div class="fields"><div class="field full"><label for="contract-paymentMode">To‘lov usuli</label><select id="contract-paymentMode" data-contract="paymentMode">${opts(modes,'full')}</select><small>Standart jadvallarda summalar KP bilan birga yangilanadi. Summani tahrirlash erkin jadvalga o‘tkazadi.</small></div><p class="field full" id="contractPaymentTotals" aria-live="polite"></p><div class="field full" id="contractPayments"></div><button class="btn ghost field full" id="addContractPayment" type="button">+ To‘lov qo‘shish</button>${field('setupRecipient','O‘rnatish pulini oluvchi integrator','text','Faqat pul bajaruvchidan boshqa oluvchiga to‘lansa to‘ldiring.')}${field('setupRecipientDetails','Integratorning to‘lov rekvizitlari','text','Oluchi nomi bilan birga shartnoma matniga kiritiladi.')}</div></details>
    <details class="card"><summary>Bajaruvchi kompaniya</summary><div class="fields">${[['sellerCompany','Yuridik nomi'],['sellerDirector','Direktorning to‘liq F.I.Sh.'],['sellerShort','Imzo yonidagi F.I.Sh.'],['sellerAddress','Manzil'],['sellerBank','Bank'],['sellerAccount','Hisob raqami'],['sellerMfo','MFO'],['sellerStir','STIR']].map(([k,t])=>field(k,t)).join('')}</div></details>
    <details class="card"><summary>Shablon, muhr va imzolar</summary><div class="fields"><div class="field full"><label for="contract-showSellerStamp">Bajaruvchi muhri</label><select id="contract-showSellerStamp" data-contract="showSellerStamp"><option value="yes">Hujjat va ilovada ko‘rsatish</option><option value="no">Ko‘rsatmaslik</option></select><small>Muhr avtomatik qo‘yiladi. Boshqa muhr tanlasangiz, shu brauzerdagi hujjatlar uchun ishlatiladi.</small></div>${[['sellerStamp','Bajaruvchi muhri'],['buyerStamp','Buyurtmachi muhri'],['sellerSignature','Bajaruvchi imzosi'],['buyerSignature','Buyurtmachi imzosi']].map(([k,t])=>`<div class="field full"><label for="contract-${k}">${t}</label><input id="contract-${k}" data-contract-image="${k}" type="file" accept="image/png,image/jpeg,image/webp"><div class="contract-image-row"><img data-contract-thumb="${k}" alt="${t} ko‘rinishi" hidden><button type="button" class="btn ghost" data-remove-image="${k}" hidden>Olib tashlash</button></div></div>`).join('')}<p class="field full">Imzo yuklanmasa, qo‘lda imzolash uchun chiziq qoladi.</p></div></details>`;
  document.querySelector('.editor-head').after(section);
  const errorBox=section.querySelector('#contractErrors');
  function setMode(next) {
    mode=next;document.body.dataset.document=mode;section.hidden=mode!=='contract';
    document.getElementById('documentKp').setAttribute('aria-pressed',String(mode==='kp'));
    document.getElementById('documentContract').setAttribute('aria-pressed',String(mode==='contract'));
    document.getElementById('contractWord').hidden=mode!=='contract';
    document.querySelector('.editor-head h1').textContent=mode==='contract'?'Shartnomani tayyorlash':'Taklifni tayyorlash';
    document.querySelector('.editor-head > p').textContent=mode==='contract'?'KPdagi narxlar avtomatik olinadi. Rekvizitlar va to‘lov muddatlarini kiriting.':'Maydonlarni to‘ldiring — KP darhol yangilanadi. Bo‘sh qoldirilgan ko‘rsatkichlar KP’ga chiqmaydi.';
    document.getElementById('tabKp').textContent=mode==='contract'?'Shartnoma ko‘rinishi':'KP ko‘rinishi';
    document.querySelector('.preview-head > :first-child').textContent=mode==='contract'?'Mijozga beriladigan shartnoma':'Mijozga beriladigan KP';
    errorBox.hidden=true;onMode(mode);onRender();
  }
  document.getElementById('documentKp').onclick=()=>setMode('kp');document.getElementById('documentContract').onclick=()=>setMode('contract');
  const commit=c=>{errorBox.hidden=true;for(const el of section.querySelectorAll('[aria-invalid]')){el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');}onChange(normalizeContract(c));};
  section.addEventListener('input',e=>{
    const key=e.target.dataset.contract;if(!key)return;
    const c=normalizeContract(getState().contract);
    if(key==='paymentMode') { c.payments=[]; rowsSignature=''; }
    c[key]=e.target.value;commit(c);
  });
  section.addEventListener('change',async e=>{
    const key=e.target.dataset.contractImage;if(!key)return;
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    try { const data=await compressLogo(file);const c=normalizeContract(getState().contract);c[key]=data;commit(c);notify('Rasm qo‘shildi.'); } catch(err){notify(err.message||'Rasmni yuklab bo‘lmadi.');}
  });
  section.querySelector('#contract-stampDocx').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{const imported=await importContractTemplate(file);const data=imported.stamp?await compressLogo(imported.stamp):'';const c=normalizeContract(getState().contract);Object.assign(c,imported.seller);if(data)c.sellerStamp=data;commit(c);notify('Bajaruvchi rekvizitlari va mavjud muhr olindi.');}catch(err){notify(err.message||'Word faylidan muhr olinmadi. PNG yuklang.');}});
  section.addEventListener('click',e=>{const btn=e.target.closest('[data-remove-image]');if(btn){const c=normalizeContract(getState().contract);c[btn.dataset.removeImage]='';commit(c);}});
  const payments=document.getElementById('contractPayments');
  payments.addEventListener('input',e=>{
    const key=e.target.dataset.payment, index=Number(e.target.dataset.index);if(!key)return;
    const c=normalizeContract(getState().contract);c.payments=paymentRows(c,getQuote()).map(r=>({...r}));
    c.payments[index][key]=e.target.value;
    if(['uzs','usd','purpose','kind','percent'].includes(key))c.paymentMode='custom';
    // DOM qatorini har bir tugmada qayta qurmaymiz: fokus va kursor saqlanadi.
    if(key==='kind'||key==='dueType')rowsSignature='';
    commit(c);
  });
  payments.addEventListener('click',e=>{const btn=e.target.closest('[data-remove-payment]');if(!btn)return;const c=normalizeContract(getState().contract);c.payments=paymentRows(c,getQuote()).map(r=>({...r}));c.payments.splice(Number(btn.dataset.removePayment),1);c.paymentMode='custom';rowsSignature='';commit(c);});
  document.getElementById('addContractPayment').onclick=()=>{const c=normalizeContract(getState().contract);c.payments=paymentRows(c,getQuote()).map(r=>({...r}));if(c.payments.length>=24){notify('Ko‘pi bilan 24 ta to‘lov.');return;}c.payments.push({purpose:'',uzs:'',usd:'',kind:'amount',percent:'',dueType:'date',date:'',days:'0'});c.paymentMode='custom';rowsSignature='';commit(c);payments.lastElementChild?.querySelector('input')?.focus();};
  function validate() {
    const errors=contractErrors(getState(),getQuote());
    for(const input of section.querySelectorAll('[aria-invalid]')) {input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');}
    if(!errors.length){errorBox.hidden=true;return true;}
    errorBox.innerHTML=`<h2>Shartnomani yakunlash uchun</h2><ul>${errors.map((e,i)=>`<li id="contract-error-${i}"><a href="#${e.key==='payments'?'contractPayments':e.key==='agents'?'agents':'contract-'+e.key}" data-error-key="${e.key}">${esc(e.message)}</a></li>`).join('')}</ul>`;
    errors.forEach((e,i)=>{const el=document.getElementById('contract-'+e.key);if(el){el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby','contract-error-'+i);}});
    errorBox.hidden=false;onMode('contract');document.getElementById('tabForm').click();errorBox.focus();return false;
  }
  errorBox.addEventListener('click',e=>{const link=e.target.closest('[data-error-key]');if(!link)return;e.preventDefault();const key=link.dataset.errorKey;if(key==='agents'){setMode('kp');document.getElementById('agents').focus();return;}const el=document.getElementById(key==='payments'?'contractPayments':'contract-'+key);el?.closest('details')?.setAttribute('open','');(key==='payments'?el?.querySelector('input'):el)?.focus();});
  document.getElementById('contractWord').onclick=async()=>{if(!validate())return;const btn=document.getElementById('contractWord');btn.disabled=true;try{await downloadContractDocx(document.getElementById('contractDocument'),getState());notify('Word fayli yuklandi.');}catch{notify('Word faylini yaratib bo‘lmadi. PDF orqali chiqarishingiz mumkin.');}finally{btn.disabled=false;}};
  function render(state,q) {
    const c=normalizeContract(state.contract),m=contractModel(state,q);
    for(const el of section.querySelectorAll('[data-contract]'))if(document.activeElement!==el)el.value=c[el.dataset.contract];
    document.getElementById('contract-buyerCompany').placeholder=m.buyerCompany||'Masalan: "AVIA TRAVEL" MCHJ';
    document.getElementById('contract-buyerDirector').placeholder=m.buyerDirector||'Rahbarning to‘liq F.I.Sh.';
    document.getElementById('contract-date').title=`Amaldagi sana: ${m.date}`;document.getElementById('contract-startDate').title=`Amaldagi sana: ${m.startDate}`;
    document.getElementById('contractTerm').textContent=`${q.agents??'—'} akkaunt · ${q.months} oy to‘lov + ${q.bonusMonths} oy bonus. Boshlanish: ${m.startDate}.`;
    const totals=contractTotals(q),sum=m.rows.reduce((a,r)=>{const n=rowAmounts(r,totals);return {uzs:a.uzs+(n.uzs||0),usd:a.usd+(n.usd||0)};},{uzs:0,usd:0});
    const match=Math.abs(sum.uzs-(totals.uzs??0))<.005&&Math.abs(sum.usd-(totals.usd??0))<.005;
    const totalEl=document.getElementById('contractPaymentTotals');totalEl.textContent=`Jadval: ${fmtDecimal(sum.uzs,2)} so‘m + ${fmtDecimal(sum.usd,2)} USD. Shartnoma: ${fmtDecimal(totals.uzs,2)} so‘m + ${fmtDecimal(totals.usd,2)} USD. ${match?'Summalar mos.':'Summalar mos emas.'}`;totalEl.dataset.valid=String(match);
    const sig=JSON.stringify(m.rows.map(r=>[r.kind,r.dueType]));
    if(sig!==rowsSignature){rowsSignature=sig;payments.innerHTML=m.rows.map((r,i)=>{
      const input=(key,label,type='text')=>`<div class="field"><label for="payment-${i}-${key}">${label}</label><input id="payment-${i}-${key}" data-payment="${key}" data-index="${i}" type="${type}" ${type==='number'?'min="0" step="0.01"':''} ${type==='text'?'maxlength="240"':''}></div>`;
      return `<fieldset class="contract-payment"><legend>${i+1}-to‘lov</legend><div class="fields">${input('purpose','To‘lov maqsadi')}<div class="field"><label for="payment-${i}-kind">Hisoblash</label><select id="payment-${i}-kind" data-payment="kind" data-index="${i}">${opts([['amount','Aniq summalar'],['percent','Umumiy summadan foiz']],r.kind)}</select></div>${r.kind==='percent'?input('percent','Ulush (%)','number'):input('uzs','Summa · so‘m','number')+input('usd','Summa · USD','number')}<div class="field"><label for="payment-${i}-dueType">To‘lov muddati</label><select id="payment-${i}-dueType" data-payment="dueType" data-index="${i}">${opts(dueTypes,r.dueType)}</select></div>${r.dueType==='date'?input('date','To‘lov sanasi','date'):input('days','Shu kundan keyin · kun (0 = o‘sha kuni)','number')}<p class="field full payment-explanation" data-payment-explanation="${i}"></p><button class="btn ghost" type="button" data-remove-payment="${i}">To‘lovni olib tashlash</button></div></fieldset>`;
    }).join('');}
    for(const el of payments.querySelectorAll('[data-payment]'))if(document.activeElement!==el)el.value=m.rows[Number(el.dataset.index)]?.[el.dataset.payment]??'';
    for(const el of payments.querySelectorAll('[data-payment-explanation]')){const r=m.rows[Number(el.dataset.paymentExplanation)],a=rowAmounts(r,totals);el.textContent=`${fmtDecimal(a.uzs,2)} so‘m + ${fmtDecimal(a.usd,2)} USD · ${dueText(r)}`;}
    for(const key of ['sellerStamp','buyerStamp','sellerSignature','buyerSignature']){const thumb=section.querySelector(`[data-contract-thumb="${key}"]`);const src=c[key]||(key==='sellerStamp'?DEFAULT_SELLER_STAMP:'');thumb.hidden=!src;if(src)thumb.src=src;section.querySelector(`[data-remove-image="${key}"]`).hidden=!c[key];}
  }
  return {render,validate,setMode,get mode(){return mode;}};
}
