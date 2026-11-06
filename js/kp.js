// KP hujjati: 3 betlik A4. Faqat calculateQuote() va leadForecast() natijasini ko’rsatadi.
// 1-bet: agentlik va uning imkoniyati · 2-bet: Omon CRM nima beradi · 3-bet: narx va keyingi qadam.
import { PRICING, SELLER, setupTierLabel } from './pricing.js';
import { esc, fmtInt, fmtUzs, fmtUsd, fmtDecimal, fmtMinutes, fmtDate, addDays, DASH } from './format.js';
import { toNumber } from './quote.js';
import { icon } from './icons.js';
import { logoMark, logoLockup } from './brand.js';

const PAGES = 3;
const has = (v) => String(v ?? '').trim() !== '';
const n = (v) => toNumber(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Katta raqam: “19 068 000 so’m” → raqam + kichik birlik. Bo’sh bo’lsa “—”. */
function big(value, unit = 'so’m') {
  return isNum(value) ? `${fmtInt(value)}<small>${unit}</small>` : DASH;
}

function sectionHead(num, label, title) {
  return `<header class="kp-section-head">
    <p class="kp-eyebrow"><span>${num}</span>${label}</p>
    ${title ? `<h2>${title}</h2>` : ''}
  </header>`;
}

function pageFooter(page) {
  return `<footer class="kp-footer">
    ${logoLockup({ size: 16, cls: 'kp-footer-logo' })}
    <span>${SELLER.site} · ${SELLER.phone}</span>
    <span class="kp-footer-page">${page} / ${PAGES}</span>
  </footer>`;
}

/* ---------------- 1-bet ---------------- */

function hero({ state, q, logoSrc }) {
  const agency = state.agency.trim();
  const owner = state.owner.trim();
  const city = state.city.trim();
  const contact = state.contact.trim();
  const date = has(state.date) ? fmtDate(state.date) : null;
  const days = n(state.validDays);
  const until = days !== null && days > 0 ? addDays(state.date, Math.floor(days)) : null;

  const kimga = owner
    ? `${esc(owner)}${agency ? `<small>${esc(agency)}</small>` : ''}`
    : agency ? `${esc(agency)} rahbariga` : 'Turizm agentligi rahbariga';
  const meta = [
    ['Kimga', `${kimga}${contact ? `<small>${esc(contact)}</small>` : ''}`],
    ['Kimdan', `${SELLER.name}<small>Omon CRM</small>`],
    city ? ['Hudud', esc(city)] : null,
    until ? ['Amal qiladi', `${fmtDate(until)} gacha<small>${Math.floor(days)} kun</small>`] : null,
  ].filter(Boolean);

  const lead = q.agents
    ? `Murojaatlar, mijozlar, qo’ng’iroqlar va hisobotlar bitta tizimda. 3-sahifada ${q.agents} agentli jamoangiz uchun hisobni keltirdik.`
    : 'Murojaatlar, mijozlar, qo’ng’iroqlar va hisobotlar bitta tizimda. 3-sahifada narx hisobini keltirdik.';
  const safeLogo = /^data:image\/(png|jpeg|webp);base64,/.test(logoSrc || '') ? logoSrc : '';

  return `<section class="kp-hero">
    <div class="kp-hero-art" aria-hidden="true">${logoMark({ size: 520 })}</div>
    <div class="kp-hero-top">
      ${logoLockup({ size: 34, cls: 'kp-hero-logo' })}
      <span class="kp-hero-pill">Tijorat taklifi${date ? ` · ${date}` : ''}</span>
    </div>
    <div class="kp-hero-main${safeLogo ? ' with-logo' : ''}">
      <div>
        <h1>${agency ? `${esc(agency)} uchun` : 'Agentligingiz uchun'}<span>Omon CRM</span></h1>
        <p class="kp-hero-lead">${lead}</p>
      </div>
      ${safeLogo ? `<div class="kp-client-logo"><img src="${safeLogo}" alt="${esc(agency || 'Turagentlik')} logotipi"></div>` : ''}
    </div>
    <dl class="kp-hero-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
  </section>`;
}

function keyNumbers() {
  const items = [
    ['20+', 'turagent hozir Omon CRM’dan faol foydalanmoqda'],
    ['2 kun', 'ichida tizim o’rnatiladi va jamoa o’qitiladi'],
    ['30 soniya', 'ichida 14 ta operatordan tur topiladi va bron qilinadi'],
  ];
  return `<div class="kp-stats">${items.map(([v, t]) => `<div class="kp-stat"><strong>${v}</strong><span>${t}</span></div>`).join('')}</div>`;
}

function statusSection(num, state) {
  const v = (key, unit = '') => (n(state[key]) === null ? DASH : `${fmtDecimal(n(state[key]), 1)}${unit}`);
  const t = (key) => (n(state[key]) === null ? DASH : fmtMinutes(n(state[key])));
  const cards = [
    ['users', v('employees'), 'xodim'],
    ['inbox', v('leads'), 'lid kuniga'],
    ['user-x', v('missed'), 'lid kuniga ishlanmay qoladi'],
    ['clock', t('responseNow'), 'mijozga javob berish'],
    ['search', t('searchNow'), 'bitta tur qidirish'],
  ];
  return `<section class="kp-section">
    ${sectionHead(num, 'Agentlik holati', 'Bugungi ish jarayoni raqamlarda')}
    <div class="kp-metrics">${cards.map(([ic, val, label]) => `<div class="kp-metric">${icon(ic, { size: 16 })}<strong>${val}</strong><span>${label}</span></div>`).join('')}</div>
  </section>`;
}

function opportunitySection(num, state, f) {
  const days = f.workDays === null ? DASH : fmtInt(f.workDays);
  const cards = [
    {
      ic: 'user-x', value: f.lostPerMonth === null ? DASH : `${fmtInt(f.lostPerMonth)}<small>ta</small>`,
      label: 'lid oyiga ishlanmay qolmoqda', note: `${has(state.missed) ? fmtDecimal(n(state.missed), 1) : DASH} ta × ${days} ish kuni`,
    },
    {
      ic: 'calendar', value: f.extraBookings === null ? DASH : `${fmtDecimal(f.extraBookings, 1)}<small>ta</small>`,
      label: 'qo’shimcha bron oyiga', note: `qayta ishlash ${has(state.recovery) ? `${fmtDecimal(n(state.recovery), 1)}%` : DASH} · bron ${has(state.conversion) ? `${fmtDecimal(n(state.conversion), 1)}%` : DASH}`,
    },
    {
      ic: 'wallet', value: big(f.extraProfit),
      label: 'qo’shimcha sof foyda oyiga', note: `1 bron foydasi: ${fmtUzs(n(state.profit))}`,
    },
    {
      ic: 'timer', value: f.hoursSaved === null ? DASH : `${fmtDecimal(f.hoursSaved, 1)}<small>soat</small>`,
      label: 'tur qidirishda tejalgan vaqt oyiga',
      note: f.searchNow !== null && f.searchAfter !== null ? `${fmtMinutes(f.searchNow)} o’rniga ${fmtMinutes(f.searchAfter)}` : 'kunlik qidirishlar × ish kunlari',
    },
  ];
  const reply = f.responseNow !== null && f.responseAfter !== null
    ? `<p class="kp-inline-note">${icon('clock', { size: 14 })}Mijozga javob berish vaqti: ${fmtMinutes(f.responseNow)} o’rniga ${fmtMinutes(f.responseAfter)} — barcha murojaatlar bitta oynada, javobsizlari alohida belgilanadi.</p>`
    : '';
  return `<section class="kp-section">
    ${sectionHead(num, 'Qo’shimcha sotuv imkoniyati', 'Ishlanmay qolayotgan lidlar — yo’qotilayotgan bronlar')}
    <div class="kp-opps">${cards.map((c) => `<div class="kp-opp">
      <div class="kp-opp-top">${icon(c.ic, { size: 16 })}<span>${c.label}</span></div>
      <strong>${c.value}</strong><small>${c.note}</small></div>`).join('')}</div>
    ${reply}
    <p class="kp-disclaimer">${icon('info', { size: 14 })}Bu prognoz, kafolat emas: hisob siz kiritgan ko’rsatkichlarga asoslangan.</p>
  </section>`;
}

/* ---------------- 2-bet ---------------- */

function featuresSection(num, q) {
  const chatbot = q.chatbotType === 'c1000' ? '1 000' : q.chatbotType === 'c500' ? '500' : null;
  const features = [
    ['inbox', 'Bitta inbox', 'Telegram, Instagram va Facebook murojaatlari bitta oynaga tushadi va mijoz kartochkasiga bog’lanadi.'],
    ['square-kanban', 'Lidlar va pipeline', 'Har bir lid qaysi bosqichda va unga kim mas’ul ekani ko’rinib turadi. Javobsiz lidlar alohida belgilanadi.'],
    ['search', 'Tur qidirish va bron', 'Bitta qidiruv 14 ta operatordan turlarni 30 soniyada olib keladi. Bronni ham shu yerning o’zida qilasiz.', '14 operator'],
    ['mic', 'Qo’ng’iroqlar yozuvi', 'IP-telefoniya barcha qo’ng’iroqlarni yozib oladi va mijoz kartochkasiga biriktiradi.'],
    ['chart-column', 'Moliya va KPI', 'Sotilgan turlar, tushum va sof foyda real vaqtda ko’rinadi. KPI va komissiya avtomatik hisoblanadi.'],
    ['sparkles', 'AI marketing va chatbot', chatbot
      ? `Tur paket uchun banner va reklama matni soniyalarda tayyor bo’ladi. AI chatbot (${chatbot} ta mijoz) murojaatlarga kechayu kunduz javob beradi.`
      : 'Tur paket uchun banner va reklama matni soniyalarda tayyor bo’ladi. AI chatbot alohida tarif bilan ulanadi.'],
  ];
  return `<section class="kp-section">
    ${sectionHead(num, 'Nima olasiz', 'Agentlik ishi uchun kerakli hamma narsa bitta joyda')}
    <div class="kp-features">${features.map(([ic, title, body, badge]) => `<article class="kp-feature">
      <span class="kp-feature-icon">${icon(ic, { size: 20 })}</span>
      <div><h3>${title}${badge ? `<em>${badge}</em>` : ''}</h3><p>${body}</p></div>
    </article>`).join('')}</div>
  </section>`;
}

function compareSection(num) {
  const ok = (t) => `<span class="kp-yes">${icon('circle-check', { size: 15 })}${t}</span>`;
  const rows = [
    ['Turizm uchun moslashganmi', ok('Ha, maxsus qurilgan'), 'Yo’q, universal', 'Yo’q, universal'],
    ['Tur qidirish va bron', ok('Ha, 14 ta operator'), 'Yo’q', 'Yo’q'],
    ['Interfeys tili', 'Xohlagan til', 'Rus, ingliz', 'Rus, ingliz'],
    ['Joriy etish muddati', '2 kun', '1–4 hafta', '1–8 hafta'],
    ['O’zbek tilida yordam', 'To’g’ridan-to’g’ri', 'Hamkor orqali', 'Hamkor orqali'],
  ];
  return `<section class="kp-section">
    ${sectionHead(num, 'Taqqoslash', 'Nega aynan Omon CRM')}
    <div class="kp-table-wrap"><table class="kp-compare">
      <thead><tr><th scope="col">Mezon</th><th scope="col" class="omon">Omon CRM</th><th scope="col">Bitrix24</th><th scope="col">amoCRM</th></tr></thead>
      <tbody>${rows.map(([a, b, c, d]) => `<tr><th scope="row">${a}</th><td class="omon">${b}</td><td>${c}</td><td>${d}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="kp-disclaimer">${icon('shield-check', { size: 14 })}Har bir firmaning ma’lumotlari boshqalaridan ajratilgan (multi-tenant). Rollar: admin, menejer va agent.</p>
  </section>`;
}

/* ---------------- 3-bet ---------------- */

const TELEPHONY_ROW = {
  myzvanki: { title: 'Qo’ng’iroqlarni yozib olish', sub: 'MyZvanki (Moizvonki), Android uchun', chip: 'MyZvanki' },
  uztel: { title: 'Qo’ng’iroqlarni yozib olish', sub: 'UzTel IP-telefoniya', chip: 'UzTel' },
};

function priceSection(num, q) {
  const M = q.months;
  const agentsText = q.agents ?? DASH;
  const title = q.agents ? `${q.agents} agentli agentlik, ${M} oylik reja` : `${M} oylik reja`;
  const chips = [
    q.agents ? ['users', `${q.agents} ta agent`] : null,
    ['calendar', `${M} oylik obuna, +${q.bonusMonths} oy bepul`],
    q.telephonyType !== 'none' ? ['mic', `Qo’ng’iroq yozuvi · ${TELEPHONY_ROW[q.telephonyType].chip}`] : null,
    q.chatbotType !== 'none' ? ['sparkles', 'AI chatbot'] : null,
  ].filter(Boolean);

  const rows = [
    {
      title: `Omon CRM obunasi<em class="kp-free">+${q.bonusMonths} oy bepul</em>`, sub: 'Har bir agent uchun',
      calc: `${fmtInt(PRICING.crmPerAgentMonth)} × ${agentsText} agent × ${M} oy`, value: fmtInt(q.crm),
    },
    q.telephonyType !== 'none' && {
      title: TELEPHONY_ROW[q.telephonyType].title, sub: TELEPHONY_ROW[q.telephonyType].sub,
      calc: `${fmtInt(PRICING.telephony[q.telephonyType])} × ${q.lines} raqam × ${M} oy`, value: fmtInt(q.telephony),
    },
    q.chatbotType !== 'none' && {
      title: 'AI chatbot', sub: `${q.chatbotType === 'c1000' ? '1 000' : '500'} ta mijoz uchun tarif`,
      calc: `${fmtInt(PRICING.chatbot[q.chatbotType])} × ${M} oy`, value: fmtInt(q.chatbot),
    },
  ].filter(Boolean);

  const rateText = q.usdRate === null ? null : `1 USD = ${fmtDecimal(q.usdRate)} so’m`;
  const setupCalc = q.agents ? `${setupTierLabel(q.agents)}${rateText ? `<small>${rateText}</small>` : ''}` : DASH;
  const grand = q.grandTotal !== null
    ? fmtInt(q.grandTotal)
    : q.subscriptionTotal !== null && q.setupUsd !== null ? `${fmtInt(q.subscriptionTotal)} + ${fmtUsd(q.setupUsd)}` : DASH;

  const bonusBlocks = Array.from({ length: q.usageMonths }, (_, i) => `<i class="${i < M ? 'paid' : 'free'}"></i>`).join('');
  const perMonth = q.crmMonthlyWithBonus !== null
    ? ` Shunda ${q.agents} agentli jamoa uchun CRM oyiga ${fmtUzs(q.crmMonthlyWithBonus)}ga tushadi.`
    : '';

  return `<section class="kp-section">
    ${sectionHead(num, 'Narx hisobi', title)}
    <ul class="kp-chips">${chips.map(([ic, t]) => `<li>${icon(ic, { size: 15 })}${t}</li>`).join('')}</ul>
    <div class="kp-table-wrap"><table class="kp-price">
      <thead><tr><th scope="col">Xizmat</th><th scope="col">Hisob</th><th scope="col" class="num">${M} oyga, so’m</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr><th scope="row"><b>${r.title}</b><small>${r.sub}</small></th><td>${r.calc}</td><td class="num">${r.value}</td></tr>`).join('')}
        <tr class="kp-total"><th scope="row"><b>Jami obuna va xizmatlar</b></th><td>${M} oy uchun</td><td class="num">${fmtInt(q.subscriptionTotal)}</td></tr>
        <tr class="kp-setup"><th scope="row"><b>O’rnatish va integratsiya</b><small>Bir martalik to’lov, 2 kunda bajariladi</small></th><td>${setupCalc}</td><td class="num">${fmtUsd(q.setupUsd)}${q.setupUzs !== null ? `<small>${fmtInt(q.setupUzs)} so’m</small>` : ''}</td></tr>
        <tr class="kp-grand"><th scope="row"><b>Umumiy to’lov</b></th><td>Obuna va o’rnatish birga</td><td class="num">${grand}</td></tr>
      </tbody>
    </table></div>
    <div class="kp-bigs">
      <div class="kp-big primary"><span>${M} oyga jami</span><strong>${big(q.subscriptionTotal)}</strong></div>
      <div class="kp-big"><span>O’rtacha oyiga</span><strong>${big(q.avgMonthly)}</strong></div>
      <div class="kp-big"><span>Bir martalik o’rnatish</span><strong>${fmtUsd(q.setupUsd)}</strong></div>
    </div>
    <div class="kp-bonus">
      <p><b>CRM obunasiga ${q.bonusMonths} oy bepul qo’shiladi.</b> ${M} oy uchun to’laysiz, CRM’dan ${q.usageMonths} oy foydalanasiz.${perMonth}</p>
      <div class="kp-bonus-chart" role="img" aria-label="${M} oy to’lanadi, ${q.bonusMonths} oy bepul">
        <div class="kp-bonus-blocks">${bonusBlocks}</div>
        <div class="kp-bonus-legend"><span><i class="paid"></i>To’lanadigan oy</span><span><i class="free"></i>Bepul oy</span></div>
      </div>
    </div>
  </section>`;
}

function rolloutSection(num) {
  const steps = [
    ['1-kun', 'TZ va sozlash', 'Texnik topshiriqni olamiz va CRM’ni ishingizga moslab sozlaymiz.'],
    ['2-kun', 'Ulash va o’qitish', 'Messenjerlar va telefoniyani ulaymiz, jamoani o’qitamiz.'],
    ['Keyin', 'Texnik yordam', 'Savol chiqsa, jamoamiz o’zbek tilida darhol yordam beradi.'],
  ];
  return `<section class="kp-section">
    ${sectionHead(num, 'Joriy etish', '')}
    <ol class="kp-steps">${steps.map(([tag, title, body], i) => `<li><span class="kp-step-tag${i === 2 ? ' dark' : ''}">${tag}</span><h3>${title}</h3><p>${body}</p></li>`).join('')}</ol>
  </section>`;
}

function termsSection(num, state, q, rateMeta) {
  const days = n(state.validDays);
  const until = days !== null && days > 0 ? addDays(state.date, Math.floor(days)) : null;
  const rateSource = rateMeta.kind === 'official'
    ? `Markaziy bank kursi${rateMeta.date ? `, ${esc(rateMeta.date)}` : ''}`
    : rateMeta.kind === 'fallback' ? `namunaviy kurs, ${esc(rateMeta.date)}` : 'kelishilgan kurs';
  const items = [
    `Obuna: ${q.months} oy to’lov + ${q.bonusMonths} oy bepul = ${q.usageMonths} oy CRM’dan foydalanish. Bepul oylar CRM obunasiga beriladi.`,
    `O’rnatish va integratsiya bir martalik to’lov: ${fmtUsd(q.setupUsd)}${q.agents ? ` (${setupTierLabel(q.agents)})` : ''}. Keyingi oylarda takrorlanmaydi.`,
    q.usdRate !== null
      ? `Narxlar so’mda. O’rnatish narxi 1 USD = ${fmtDecimal(q.usdRate)} so’m (${rateSource}) bo’yicha hisoblangan; to’lov kunidagi kurs bilan aniqlashtiriladi.`
      : 'Narxlar so’mda. O’rnatish narxi dollarda; so’mdagi summasi to’lov kunidagi Markaziy bank kursi bo’yicha hisoblanadi.',
    q.telephonyType === 'myzvanki' ? 'MyZvanki faqat Android telefonlarda ishlaydi.' : null,
    until ? `Taklif ${fmtDate(state.date)} dan ${fmtDate(until)} gacha amal qiladi.` : null,
    'Qo’shimcha sotuv hisobi prognoz, kafolat emas. Agentlar soni yoki xizmatlar tarkibi o’zgarsa, summa ham o’zgaradi.',
  ].filter(Boolean);
  return `<section class="kp-section">
    ${sectionHead(num, 'Shartlar', '')}
    <ul class="kp-terms">${items.map((t) => `<li>${t}</li>`).join('')}</ul>
  </section>`;
}

function nextStep() {
  return `<section class="kp-cta">
    <div class="kp-cta-art" aria-hidden="true">${logoMark({ size: 260 })}</div>
    <div class="kp-cta-text">
      <p class="kp-eyebrow on-dark">Keyingi qadam</p>
      <h2>Taklif ma’qul bo’lsa</h2>
      <p>TZni birga tayyorlaymiz va 2 kunlik o’rnatishni boshlaymiz.</p>
    </div>
    <a class="kp-cta-card" href="${SELLER.phoneHref}">
      <strong>${icon('phone-call', { size: 22 })}${SELLER.phone}</strong>
      <span><b>${SELLER.shortName}</b><b>${SELLER.site}</b></span>
    </a>
  </section>`;
}

/* ---------------- yig’ish ---------------- */

export function renderKp({ state, quote: q, forecast: f, rateMeta, logoSrc = '' }) {
  // Bo’limlar doim chiqadi (TZ: bo’sh maydon KP’da “—”), raqamlash 01–07 o’zgarmaydi.
  const p1 = [hero({ state, q, logoSrc }), keyNumbers(), statusSection('01', state), opportunitySection('02', state, f)];
  const p2 = [featuresSection('03', q), compareSection('04')];
  const p3 = [priceSection('05', q), rolloutSection('06'), termsSection('07', state, q, rateMeta), nextStep()];

  const page = (i, parts, cls = '') => `<div class="kp-page ${cls}" data-page="${i}"><div class="kp-body">${parts.join('')}</div>${pageFooter(i)}</div>`;
  return `<div class="kp-pages">${page(1, p1, 'first')}${page(2, p2)}${page(3, p3)}</div>`;
}
