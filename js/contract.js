import { esc, fmtDate, fmtUzs, fmtDecimal } from './format.js';
import { PRICING, TELEPHONY_LABELS, CHATBOT_LABELS } from './pricing.js';
import { CONTRACT_TERMS } from './contract-terms.js';

const SAFE_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const SELLER_COMPANY = Object.freeze({
  sellerCompany: '', sellerDirector: '', sellerShort: '', sellerAddress: '',
  sellerBank: '', sellerAccount: '', sellerMfo: '', sellerStir: '',
});
export function defaultContract() {
  return { ...SELLER_COMPANY, number: '', date: '', startDate: '', city: 'Toshkent sh.', buyerCompany: '', buyerDirector: '',
    buyerAddress: '', buyerBank: '', buyerAccount: '', buyerMfo: '', buyerStir: '',
    paymentMode: 'full', payments: [], setupRecipient: '', setupRecipientDetails: '',
    showSellerStamp: 'yes', sellerStamp: '', buyerStamp: '', sellerSignature: '', buyerSignature: '' };
}
const MODES = ['full', 'two', 'three', 'separate', 'custom'];
export function normalizeContract(raw) {
  const out = defaultContract();
  if (!raw || typeof raw !== 'object') return out;
  for (const key of Object.keys(out)) if (typeof out[key] === 'string' && !['sellerStamp', 'buyerStamp', 'sellerSignature', 'buyerSignature'].includes(key)) out[key] = String(raw[key] ?? out[key]).slice(0, 1000);
  out.paymentMode = MODES.includes(raw.paymentMode) ? raw.paymentMode : 'full';
  out.showSellerStamp = raw.showSellerStamp === 'no' ? 'no' : 'yes';
  for (const key of ['sellerStamp', 'buyerStamp', 'sellerSignature', 'buyerSignature']) out[key] = typeof raw[key] === 'string' && raw[key].length <= 350000 && SAFE_IMAGE.test(raw[key]) ? raw[key] : '';
  out.payments = Array.isArray(raw.payments) ? raw.payments.slice(0, 24).map(r => ({
    purpose: String(r?.purpose ?? '').slice(0, 240), uzs: String(r?.uzs ?? '').slice(0, 24), usd: String(r?.usd ?? '').slice(0, 24),
    kind: r?.kind === 'percent' ? 'percent' : 'amount', percent: String(r?.percent ?? '').slice(0, 12),
    dueType: ['date', 'setup', 'activation'].includes(r?.dueType) ? r.dueType : 'date',
    date: String(r?.date ?? '').slice(0, 10), days: String(r?.days ?? '0').slice(0, 4),
  })) : [];
  return out;
}
export function isDate(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso)) && new Date(iso + 'T00:00:00Z').toISOString().slice(0,10) === iso;
}
export function endDate(start, months) {
  if (!isDate(start)) return '';
  const d = new Date(start+'T00:00:00Z');
  const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day,last));
  // Oxirgi xizmat kuni: keyingi davr boshlanishidan bir kun oldin.
  d.setUTCDate(d.getUTCDate()-1);
  return d.toISOString().slice(0,10);
}
export function numberWords(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 1e12) return '—';
  if (!value) return 'nol';
  const ones=['','bir','ikki','uch','to‘rt','besh','olti','yetti','sakkiz','to‘qqiz'];
  const tens=['','o‘n','yigirma','o‘ttiz','qirq','ellik','oltmish','yetmish','sakson','to‘qson'];
  const small = n => [n>=100 ? ones[Math.floor(n/100)]+' yuz' : '', tens[Math.floor(n%100/10)],ones[n%10]].filter(Boolean).join(' ');
  return [[1e9,'milliard'],[1e6,'million'],[1e3,'ming'],[1,'']].map(([n,label])=>{const part=Math.floor(value/n);value%=n;return part ? small(part)+(label?' '+label:'') : '';}).filter(Boolean).join(' ');
}
export function contractTotals(q) {
  return { uzs: q.subscriptionTotal === null ? null : q.subscriptionTotal + q.chatbotFirstMonth + q.utelFirstMonth, usd: q.setupUsd };
}
const split = (n, count, i) => { if (n===null) return ''; const cents=Math.round(n*100), base=Math.floor(cents/count);return String((i===count-1?cents-base*(count-1):base)/100); };
export function paymentRows(c, q) {
  if (c.paymentMode === 'custom') return c.payments;
  const t=contractTotals(q), count=c.paymentMode==='two'?2:c.paymentMode==='three'?3:c.paymentMode==='separate'?2:1;
  return Array.from({length:count},(_,i)=>{
    const saved=c.payments[i] || {};
    const separate=c.paymentMode==='separate';
    return { purpose: separate ? (i===0?'O‘rnatish, integratsiya va o‘qitish':'CRM obunasi va tanlangan qo‘shimcha xizmatlar') : count===1?'Shartnoma bo‘yicha to‘liq to‘lov':`${i+1}-qism to‘lovi`,
      uzs: separate ? (i===0?'0':String(t.uzs??'')) : split(t.uzs,count,i),
      usd: separate ? (i===0?String(t.usd??''):'0') : split(t.usd,count,i),
      kind:'amount',percent:'',dueType:saved.dueType || (i===0?'setup':'date'),date:saved.date||'',days:saved.days||'0' };
  });
}
const cents = n => Math.round(n*100);
export function rowAmounts(row, totals) {
  const percent=Number(row.percent);
  return row.kind==='percent' ? {uzs: cents((totals.uzs??0)*percent/100)/100,usd:cents((totals.usd??0)*percent/100)/100} : {uzs:Number(row.uzs),usd:Number(row.usd)};
}
export function dueText(row) {
  if(row.dueType==='date') return isDate(row.date)?fmtDate(row.date):'Sana kiritilmagan';
  const event=row.dueType==='setup'?'O‘rnatish va o‘qitish':'CRM obunasi boshlanish';
  return Number(row.days)>0?`${event} kunidan ${Number(row.days)} kalendar kun o‘tgach`:`${event} kuni`;
}
export function contractModel(state,q) {
  const c=normalizeContract(state.contract);
  return {...c, date:c.date||state.date,startDate:c.startDate||c.date||state.date,
    buyerCompany:c.buyerCompany || (state.agency ? (/\b(MCHJ|OOO|LLC|YTT)\b/i.test(state.agency)?state.agency:`"${state.agency}" MCHJ`) : ''),
    buyerDirector:c.buyerDirector||state.owner, rows:paymentRows(c,q), totals:contractTotals(q)};
}
export function contractErrors(state,q) {
  const c=contractModel(state,q), errors=[];
  for(const [key,label] of Object.entries({number:'Shartnoma raqami',buyerCompany:'Buyurtmachining yuridik nomi',buyerDirector:'Buyurtmachi rahbarining to‘liq F.I.Sh.',buyerAddress:'Buyurtmachi manzili',buyerBank:'Buyurtmachi banki',buyerAccount:'Buyurtmachi hisob raqami',buyerMfo:'Buyurtmachi MFOsi',buyerStir:'Buyurtmachi STIRi',sellerCompany:'Bajaruvchining yuridik nomi',sellerDirector:'Bajaruvchi rahbari',sellerAddress:'Bajaruvchi manzili',sellerBank:'Bajaruvchi banki',sellerAccount:'Bajaruvchi hisob raqami',sellerMfo:'Bajaruvchi MFOsi',sellerStir:'Bajaruvchi STIRi',city:'Shartnoma tuzilgan shahar'})) if(!c[key]?.trim())errors.push({key,message:`${label}ni kiriting.`});
  for(const side of ['buyer','seller']) for(const [key,len,label] of [['Account',20,'Hisob raqami'],['Mfo',5,'MFO'],['Stir',9,'STIR']]) if(c[side+key] && !new RegExp(`^\\d{${len}}$`).test(c[side+key]))errors.push({key:side+key,message:`${label} ${len} ta raqamdan iborat bo‘lishi kerak.`});
  if(!isDate(c.date))errors.push({key:'date',message:'Shartnoma sanasini kiriting.'});
  if(!isDate(c.startDate))errors.push({key:'startDate',message:'Obuna boshlanish sanasini kiriting.'});
  if(isDate(c.date)&&isDate(c.startDate)&&c.startDate<c.date)errors.push({key:'startDate',message:'Obuna sanasi shartnoma sanasidan oldin bo‘lmasin.'});
  if(!q.agents || q.subscriptionTotal===null || q.setupUsd===null || !q.telephonyFits || (q.telephonyType==='myzvanki'&&q.lines<1))errors.push({key:'agents',message:'KPdagi agentlar soni va tanlangan xizmatlarni tekshiring.'});
  if(c.setupRecipient.trim()&&!c.setupRecipientDetails.trim())errors.push({key:'setupRecipientDetails',message:'Integratorning rekvizitlarini kiriting.'});
  if(!c.rows.length)errors.push({key:'payments',message:'Kamida bitta to‘lov qatori kerak.'});
  let uzs=0,usd=0;
  for(const [i,r] of c.rows.entries()) {
    const a=rowAmounts(r,c.totals); uzs+=cents(a.uzs);usd+=cents(a.usd);
    if(!r.purpose.trim() || !Number.isFinite(a.uzs)||!Number.isFinite(a.usd)||a.uzs<0||a.usd<0||!(a.uzs+a.usd>0)|| (r.kind==='percent'&&(!r.percent.trim()||Number(r.percent)>100))) errors.push({key:'payments',message:`${i+1}-to‘lovning maqsadi va musbat summasini kiriting.`});
    if(r.dueType==='date'&&(!isDate(r.date)||(isDate(c.date)&&r.date<c.date)))errors.push({key:'payments',message:`${i+1}-to‘lov sanasini tekshiring (shartnoma sanasidan oldin bo‘lmasin).`});
    if(r.dueType!=='date'&&(!/^\d+$/.test(r.days)||Number(r.days)>999))errors.push({key:'payments',message:`${i+1}-to‘lov uchun kunlar soni 0–999 bo‘lsin.`});
  }
  if(c.totals.uzs!==null && (uzs!==cents(c.totals.uzs)||usd!==cents(c.totals.usd??0))) errors.push({key:'payments',message:`Jadval yig‘indisi ${fmtUzs(c.totals.uzs)} va ${fmtDecimal(c.totals.usd,2)} AQSH dollariga teng bo‘lishi kerak.`});
  return errors;
}
const amountText=(a)=>[a.uzs?`${fmtDecimal(a.uzs,2)} so‘m`:'',a.usd?`${fmtDecimal(a.usd,2)} AQSH dollari ekvivalenti so‘mda`:''].filter(Boolean).join(' + ')||'—';
export function paymentTable(c) {
  return `<table class="contract-table"><thead><tr><th>№</th><th>To‘lov maqsadi</th><th>Summa</th><th>To‘lov muddati</th></tr></thead><tbody>${c.rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.purpose)}${r.kind==='percent'?` (${esc(r.percent)}%)`:''}</td><td>${esc(amountText(rowAmounts(r,c.totals)))}</td><td>${esc(dueText(r))}</td></tr>`).join('')}</tbody></table>`;
}
function party(c,side) {
  const buyer=side==='buyer',stamp=buyer?c.buyerStamp:c.showSellerStamp==='yes'?c.sellerStamp:'',signature=buyer?c.buyerSignature:c.sellerSignature;
  return `<div class="contract-party"><h3>${buyer?'Buyurtmachi':'Bajaruvchi'}</h3><p>${esc(c[side+'Company']||'________________')}</p>${[['Address','Manzil'],['Bank','Bank'],['Account','H/r'],['Mfo','MFO'],['Stir','STIR']].map(([key,label])=>`<p>${label}: ${esc(c[side+key]||'________________')}</p>`).join('')}<div class="contract-sign"><p>Rahbar: __________ ${esc(buyer?c.buyerDirector:c.sellerShort||c.sellerDirector)}</p>${signature?`<img class="contract-signature" src="${esc(signature)}" alt="${buyer?'Buyurtmachi':'Bajaruvchi'} imzosi">`:''}<p>M.O‘.</p>${stamp?`<img class="contract-stamp" src="${esc(stamp)}" alt="${buyer?'Buyurtmachi':'Bajaruvchi'} muhri">`:''}</div></div>`;
}
function serviceTable(q) {
  const rows=[['CRM obunasi',`${q.agents??'—'} ta akkaunt × ${fmtUzs(PRICING.crmPerAgentMonth)} × ${q.months} oy; +${q.bonusMonths} oy bonus`,`${q.usageMonths} oy`,fmtUzs(q.crm)],['O‘rnatish, Telegram, Instagram, Facebook integratsiyasi va xodimlarni o‘qitish','Texnik qo‘llab-quvvatlash bepul','Bir martalik',`${q.setupUsd??'—'} AQSH dollari`]];
  if(q.telephonyType!=='none') rows.push([TELEPHONY_LABELS[q.telephonyType],q.telephonyPackage?'Birinchi oy to‘lovi umumiy summaga kiradi; keyin oyma-oy':`${q.lines} ta raqam uchun ${q.months} oy`,q.telephonyPackage?'1 oy':`${q.months} oy`,fmtUzs(q.telephonyPackage?q.utelFirstMonth:q.telephony)]);
  if(q.chatbotType!=='none') rows.push(['AI chatbot',`${CHATBOT_LABELS[q.chatbotType]}; birinchi oy umumiy summaga kiradi; keyin oyma-oy`,'1 oy',fmtUzs(q.chatbotFirstMonth)]);
  return `<table class="contract-table"><thead><tr><th>№</th><th>Xizmat nomi</th><th>Muddat</th><th>Summa</th><th>QQS</th></tr></thead><tbody>${rows.map(([name,detail,term,amount],i)=>`<tr><td>${i+1}</td><td>${esc(name)}. ${esc(detail)}</td><td>${esc(term)}</td><td>${esc(amount)}</td><td>QQS siz</td></tr>`).join('')}</tbody></table>`;
}
export function renderContract({state,quote:q}) {
  const c=contractModel(state,q),total=c.totals.uzs;
  const replacements={
    '1.3.':`1.3. Bajaruvchi №1-ilovada nazarda tutilgan xizmatlarni ${fmtDate(c.startDate)} sanasidan ${fmtDate(endDate(c.startDate,q.usageMonths))} sanasigacha ${q.usageMonths} (${numberWords(q.usageMonths)}) oy davomida ko‘rsatadi. O‘rnatish va integratsiya bir martalik xizmat hisoblanadi. Qo‘shimcha xizmatlarning muddati №1-ilovada belgilanadi.`,
    '3.1.':`3.1. Ushbu Shartnoma bo‘yicha dastlabki to‘lovlarning umumiy miqdori QQS siz ${fmtUzs(total)} (${numberWords(total??-1)}) hamda CRM o‘rnatish, integratsiya va o‘qitish uchun ${q.setupUsd??'—'} (${numberWords(q.setupUsd??-1)}) AQSH dollarini tashkil etadi. Texnik qo‘llab-quvvatlash bepul. Xizmatlar tarkibi №1-ilovada ko‘rsatilgan.`,
    '3.2.':`3.2. Buyurtmachi to‘lovlarni quyidagi jadvalga muvofiq amalga oshiradi. AQSH dollarida belgilangan har bir to‘lov to‘lov kunidagi O‘zbekiston Respublikasi Markaziy banki kursi bo‘yicha so‘mda to‘lanadi. To‘lovni kechiktirish har bir qator uchun o‘sha qatorda belgilangan muddatga nisbatan aniqlanadi.`,
    '3.3.':`3.3. CRM obunasi ${q.agents??'—'} ta foydalanuvchi akkaunti uchun ${q.months} (${numberWords(q.months)}) oylik to‘lovdan iborat: ${q.agents??'—'} × ${fmtUzs(PRICING.crmPerAgentMonth)} × ${q.months} = ${fmtUzs(q.crm)}. Qo‘shimcha ${q.bonusMonths} (${numberWords(q.bonusMonths)}) oy bonus sifatida bepul beriladi. CRM obunasi ${fmtDate(c.startDate)} sanasidan boshlanadi; bo‘lib to‘lash ushbu sanani o‘z-o‘zidan o‘zgartirmaydi.`,
    '3.4.':`3.4. ${q.usageMonths} oylik muddat tugagandan keyin CRM obunasini davom ettirish narxi har bir akkaunt uchun oyiga ${fmtUzs(PRICING.crmPerAgentMonth)}.`,
    '3.5.':`3.5. ${q.telephonyType==='none'?'Telefoniya ushbu shartnoma narxiga kirmaydi.':`Tanlangan ${TELEPHONY_LABELS[q.telephonyType]} xizmati №1-ilovaga kiritilgan.`} ${q.chatbotType==='none'?'AI chatbot narxga kiritilmagan.':'AI chatbotning birinchi oy to‘lovi dastlabki summaga kiritilgan.'} ${q.monthlyExtras>0?`UTEL va/yoki AI chatbot uchun keyingi oylar to‘lovi jami ${fmtUzs(q.monthlyExtras)} / oy bo‘lib, har bir keyingi xizmat oyi boshlanishidan oldin alohida to‘lanadi. Bu to‘lovlar yuqoridagi dastlabki to‘lov jadvaliga qayta qo‘shilmaydi.`:''} Reklama byudjeti shartnoma narxiga kirmaydi.`,
    '8.3.':`8.3. Shartnoma bo‘yicha CRM xizmatining tugash sanasi: ${fmtDate(endDate(c.startDate,q.usageMonths))}.`,
  };
  let body=CONTRACT_TERMS.map(t=>{
    const num=t.match(/^\d+\.\d+\./)?.[0];
    if(/^\d+\. /.test(t))return `<h2>${esc(t)}</h2>`;
    return `<p>${esc(replacements[num]??t)}</p>`+(num==='3.2.'?paymentTable(c)+(c.setupRecipient.trim()?`<p>O‘rnatish to‘lovini qabul qiluvchi: ${esc(c.setupRecipient)}. Rekvizitlar: ${esc(c.setupRecipientDetails)}. Mazkur oluvchiga to‘langan summa Bajaruvchi tomonidan ushbu shartnomadagi o‘rnatish, integratsiya va o‘qitish to‘lovi sifatida hisobga olinadi.</p>`:''):'');
  }).join('');
  return `<article class="contract-document" id="contractDocument"><h1>XIZMAT KO‘RSATISH SHARTNOMASI № ${esc(c.number||'____')}</h1><div class="contract-date"><span>${esc(c.city)}</span><span>${esc(fmtDate(c.date))}</span></div><p>Keyingi o‘rinlarda “Bajaruvchi” deb ataluvchi ${esc(c.sellerCompany)} nomidan Ustav asosida faoliyat yurituvchi direktor ${esc(c.sellerDirector)} bir tomondan, va keyingi o‘rinlarda “Buyurtmachi” deb ataluvchi ${esc(c.buyerCompany||'________________')} nomidan Ustav asosida faoliyat yurituvchi ${esc(c.buyerDirector||'________________')} ikkinchi tomondan, birgalikda “Tomonlar” deb atalib, ushbu shartnomani quyidagilar haqida tuzdilar:</p>${body}<section class="contract-parties-section"><h2>9. Tomonlarning manzillari va bank rekvizitlari</h2><div class="contract-parties">${party(c,'seller')}${party(c,'buyer')}</div></section><section class="contract-annex"><p class="contract-annex-heading">${esc(fmtDate(c.date))} sanasidagi<br>№ ${esc(c.number||'____')}-shartnomaga 1-ilova</p><h2>Xizmatlar va to‘lovlar</h2>${serviceTable(q)}<h2>To‘lov jadvali</h2>${paymentTable(c)}<p>AQSH dollarida belgilangan summalar to‘lov kunidagi Markaziy bank kursi bo‘yicha so‘mda to‘lanadi.${q.monthlyExtras>0?` Keyingi oylar uchun qo‘shimcha xizmatlar: ${fmtUzs(q.monthlyExtras)} / oy.`:''}</p><div class="contract-parties">${party(c,'seller')}${party(c,'buyer')}</div></section></article>`;
}
