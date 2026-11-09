// KP hujjati. Faqat calculateQuote() va leadForecast() natijasini ko’rsatadi.
// To’ldirilmagan ko’rsatkichlar KP’ga chiqmaydi; bo’lim bo’sh qolsa, u butunlay tushib qoladi
// va qolgan bo’limlar 01 dan qayta raqamlanadi.
import { PRICING, SELLER, setupTierLabel } from './pricing.js';
import { esc, fmtInt, fmtUzs, fmtUsd, fmtDecimal, fmtMinutes, fmtDate, addDays, telHref, DASH } from './format.js';
import { toNumber } from './quote.js';
import { icon } from './icons.js';
import { logoMark, logoLockup } from './brand.js';

const has = (v) => String(v ?? '').trim() !== '';
const n = (v) => toNumber(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** Matn ichidagi summa qator oxirida bo’linmasin: raqamlar orasidagi bo’sh joy → NBSP. */
const keep = (s) => String(s).replace(/(\d) (?=\d{3}\b)/g, '$1 ').replace(/ (so’m|soat|ta)\b/g, ' $1');
const SAFE_LOGO = /^data:image\/(png|jpeg|webp);base64,/;

/** Katta raqam: “14 280 000 so’m” → raqam + kichik birlik. Bo’sh bo’lsa “—”. */
function big(value, unit = 'so’m') {
  return isNum(value) ? `${fmtInt(value)}<small>${unit}</small>` : DASH;
}

/** Formadagi ijrochi (bo’sh bo’lsa Omon CRM nomi bilan). */
function seller(state) {
  const name = String(state.sellerName ?? '').trim();
  const phone = String(state.sellerPhone ?? '').trim();
  return { name, phone, href: telHref(phone) };
}

function sectionHead(num, label, title) {
  return `<header class="kp-section-head">
    <p class="kp-eyebrow"><span>${num}</span>${label}</p>
    ${title ? `<h2>${title}</h2>` : ''}
  </header>`;
}

function pageFooter(page, total, s) {
  return `<footer class="kp-footer">
    ${logoLockup({ size: 16, cls: 'kp-footer-logo' })}
    <span>${SELLER.site}${s.phone ? ` · ${esc(s.phone)}` : ''}</span>
    <span class="kp-footer-page">${page} / ${total}</span>
  </footer>`;
}

/* ---------------- sarlavha va asosiy raqamlar ---------------- */

function hero({ state, q, logoSrc }) {
  const agency = state.agency.trim();
  const owner = state.owner.trim();
  const city = state.city.trim();
  const contact = state.contact.trim();
  const s = seller(state);
  const date = has(state.date) ? fmtDate(state.date) : null;
  const days = n(state.validDays);
  const until = days !== null && days > 0 ? addDays(state.date, Math.floor(days)) : null;

  const kimga = owner
    ? `${esc(owner)}${agency ? `<small>${esc(agency)}</small>` : ''}`
    : agency ? `${esc(agency)} rahbariga` : 'Turizm agentligi rahbariga';
  const meta = [
    owner || agency || contact ? ['Kimga', `${owner || agency ? kimga : ''}${contact ? `<small>${esc(contact)}</small>` : ''}`] : null,
    ['Kimdan', s.name ? `${esc(s.name)}<small>Omon CRM</small>` : 'Omon CRM'],
    city ? ['Hudud', esc(city)] : null,
    until ? ['Amal qiladi', `${fmtDate(until)} gacha<small>${Math.floor(days)} kun</small>`] : null,
  ].filter(Boolean);

  const lead = `Murojaatlar, mijozlar, qo’ng’iroqlar va hisobotlar bitta tizimda. Quyida ${q.agents ? `${q.agents} agentli jamoangiz uchun narx hisobini` : 'narx hisobini'} keltirdik.`;
  const logo = SAFE_LOGO.test(logoSrc || '') ? logoSrc : '';
  const partner = logo
    ? `<span class="kp-hero-x" aria-hidden="true"></span><span class="kp-hero-partner"><img src="${logo}" alt="${esc(agency || 'Turagentlik')} logotipi"></span>`
    : '';

  return `<section class="kp-hero">
    <div class="kp-hero-art" aria-hidden="true">${logoMark({ size: 520 })}</div>
    <div class="kp-hero-top">
      <div class="kp-hero-brand">${logoLockup({ size: 34, cls: 'kp-hero-logo' })}${partner}</div>
      <span class="kp-hero-pill">Tijorat taklifi${date ? ` · ${date}` : ''}</span>
    </div>
    <div class="kp-hero-main">
      <h1>${agency ? `${esc(agency)} uchun` : 'Agentligingiz uchun'}<span>Omon CRM</span></h1>
      <p class="kp-hero-lead">${lead}</p>
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

/* ---------------- agentlik holati va qo’shimcha sotuv (faqat to’ldirilganlari) ---------------- */

function statusCards(state) {
  const num = (key) => `${fmtDecimal(n(state[key]), 1)}`;
  const min = (key) => fmtMinutes(n(state[key]));
  return [
    n(state.employees) !== null && ['users', num('employees'), 'xodim'],
    n(state.leads) !== null && ['inbox', num('leads'), 'lid kuniga'],
    n(state.missed) !== null && ['user-x', num('missed'), 'lid kuniga ishlanmay qoladi'],
    n(state.responseNow) !== null && ['clock', min('responseNow'), 'mijozga javob berish'],
    n(state.searchNow) !== null && ['search', min('searchNow'), 'bitta tur qidirish'],
  ].filter(Boolean);
}

function statusSection(num, cards) {
  return `<section class="kp-section">
    ${sectionHead(num, 'Agentlik holati', 'Bugungi ish jarayoni raqamlarda')}
    <div class="kp-metrics" style="--cols:${Math.max(3, cards.length)}">${cards.map(([ic, val, label]) => `<div class="kp-metric">${icon(ic, { size: 16 })}<strong>${val}</strong><span>${label}</span></div>`).join('')}</div>
  </section>`;
}

function opportunityCards(state, f) {
  return [
    f.lostPerMonth !== null && {
      ic: 'user-x', value: `${fmtInt(f.lostPerMonth)}<small>ta</small>`,
      label: 'lid oyiga ishlanmay qolmoqda', note: `${fmtDecimal(n(state.missed), 1)} ta × ${fmtInt(f.workDays)} ish kuni`,
    },
    f.extraBookings !== null && {
      ic: 'calendar', value: `${fmtDecimal(f.extraBookings, 1)}<small>ta</small>`,
      label: 'qo’shimcha bron oyiga', note: `qayta ishlash ${fmtDecimal(n(state.recovery), 1)}% · bron ${fmtDecimal(n(state.conversion), 1)}%`,
    },
    f.extraProfit !== null && {
      ic: 'wallet', value: big(f.extraProfit),
      label: 'qo’shimcha sof foyda oyiga', note: `1 bron foydasi: ${fmtUzs(n(state.profit))}`,
    },
    f.hoursSaved !== null && {
      ic: 'timer', value: `${fmtDecimal(f.hoursSaved, 1)}<small>soat</small>`,
      label: 'tur qidirishda tejalgan vaqt oyiga', note: `${fmtMinutes(f.searchNow)} o’rniga ${fmtMinutes(f.searchAfter)}`,
    },
  ].filter(Boolean);
}

function replyNote(f) {
  return f.responseNow !== null && f.responseAfter !== null
    ? `<p class="kp-inline-note">${icon('clock', { size: 14 })}Mijozga javob berish vaqti: ${fmtMinutes(f.responseNow)} o’rniga ${fmtMinutes(f.responseAfter)} — barcha murojaatlar bitta oynada, javobsizlari alohida belgilanadi.</p>`
    : '';
}

function opportunitySection(num, cards, reply) {
  return `<section class="kp-section">
    ${sectionHead(num, 'Qo’shimcha sotuv imkoniyati', 'Ishlanmay qolayotgan lidlar — yo’qotilayotgan bronlar')}
    ${cards.length ? `<div class="kp-opps" style="--cols:${Math.max(3, cards.length)}">${cards.map((c) => `<div class="kp-opp">
      <div class="kp-opp-top">${icon(c.ic, { size: 16 })}<span>${c.label}</span></div>
      <strong>${c.value}</strong><small>${c.note}</small></div>`).join('')}</div>` : ''}
    ${reply}
    ${cards.length ? `<p class="kp-disclaimer">${icon('info', { size: 14 })}Bu prognoz, kafolat emas: hisob siz kiritgan ko’rsatkichlarga asoslangan.</p>` : ''}
  </section>`;
}

/* ---------------- Omon CRM nima beradi ---------------- */

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

/* ---------------- narx va keyingi qadam ---------------- */

const TELEPHONY_ROW = {
  myzvanki: { title: 'Qo’ng’iroqlarni yozib olish', sub: 'MyZvanki (Moizvonki), faqat Android', chip: 'MyZvanki' },
  uztel: { title: 'Qo’ng’iroqlarni yozib olish', sub: 'UzTel IP-telefoniya', chip: 'UzTel' },
};
const CHATBOT_TIER = { c500: '500', c1000: '1 000' };

function priceSection(num, q) {
  const M = q.months;
  const agentsText = q.agents ?? DASH;
  const title = q.agents ? `${q.agents} agentli agentlik, ${M} oylik reja` : `${M} oylik reja`;
  const hasBot = q.chatbotType !== 'none';
  const chips = [
    q.agents ? ['users', `${q.agents} ta agent`] : null,
    ['calendar', `${M} oylik obuna, +${q.bonusMonths} oy bepul`],
    q.telephonyType !== 'none' && isNum(q.telephony) ? ['mic', `Qo’ng’iroq yozuvi · ${TELEPHONY_ROW[q.telephonyType].chip}`] : null,
    hasBot ? ['sparkles', 'AI chatbot · oyma-oy'] : null,
  ].filter(Boolean);

  const rows = [
    isNum(q.crm) && {
      title: `Omon CRM obunasi<em class="kp-free">+${q.bonusMonths} oy bepul</em>`, sub: 'Har bir agent uchun',
      calc: `${fmtInt(PRICING.crmPerAgentMonth)} × ${agentsText} agent × ${M} oy`, value: fmtInt(q.crm),
    },
    q.telephonyType !== 'none' && isNum(q.telephony) && {
      title: TELEPHONY_ROW[q.telephonyType].title, sub: TELEPHONY_ROW[q.telephonyType].sub,
      calc: `${fmtInt(PRICING.telephony[q.telephonyType])} × ${q.lines} raqam × ${M} oy`, value: fmtInt(q.telephony),
    },
  ].filter(Boolean);

  if (!rows.length && !hasBot) return '';

  const rateText = q.usdRate === null ? null : `1 USD = ${fmtDecimal(q.usdRate)} so’m`;
  const setupCalc = q.agents ? `${setupTierLabel(q.agents)}${rateText ? `<small>${rateText}</small>` : ''}` : DASH;
  const grand = q.grandTotal !== null
    ? fmtInt(q.grandTotal)
    : q.subscriptionTotal !== null && q.setupUsd !== null ? `${fmtInt(q.subscriptionTotal)} + ${fmtUsd(q.setupUsd)}` : DASH;
  const botRow = hasBot
    ? `<tr class="kp-monthly"><th scope="row"><b>AI chatbot</b><small>${CHATBOT_TIER[q.chatbotType]} ta mijoz uchun tarif</small></th><td>Har oy alohida to’lanadi</td><td class="num">${fmtInt(q.chatbotMonthly)}<small>so’m / oy</small></td></tr>`
    : '';

  const bonusBlocks = Array.from({ length: q.usageMonths }, (_, i) => `<i class="${i < M ? 'paid' : 'free'}"></i>`).join('');
  const perMonth = q.crmMonthlyWithBonus !== null
    ? ` Shunda ${q.agents} agentli jamoa uchun CRM oyiga ${keep(fmtUzs(q.crmMonthlyWithBonus))}ga tushadi.`
    : '';

  return `<section class="kp-section">
    ${sectionHead(num, 'Narx hisobi', title)}
    <ul class="kp-chips">${chips.map(([ic, t]) => `<li>${icon(ic, { size: 15 })}${t}</li>`).join('')}</ul>
    <div class="kp-table-wrap"><table class="kp-price">
      <thead><tr><th scope="col">Xizmat</th><th scope="col">Hisob</th><th scope="col" class="num">${M} oyga, so’m</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr><th scope="row"><b>${r.title}</b><small>${r.sub}</small></th><td>${r.calc}</td><td class="num">${r.value}</td></tr>`).join('')}
        ${isNum(q.subscriptionTotal) ? `<tr class="kp-total"><th scope="row"><b>Jami obuna${q.telephonyType !== 'none' ? ' va telefoniya' : ''}</b></th><td>${M} oy uchun</td><td class="num">${fmtInt(q.subscriptionTotal)}</td></tr>` : ''}
        ${botRow}
        ${isNum(q.setupUsd) ? `<tr class="kp-setup"><th scope="row"><b>O’rnatish va integratsiya</b><small>Bir martalik to’lov, 2 kunda bajariladi</small></th><td>${setupCalc}</td><td class="num">${fmtUsd(q.setupUsd)}${q.setupUzs !== null ? `<small>${fmtInt(q.setupUzs)} so’m</small>` : ''}</td></tr>` : ''}
        ${grand !== DASH ? `<tr class="kp-grand"><th scope="row"><b>Umumiy to’lov</b></th><td>Obuna va o’rnatish birga</td><td class="num">${grand}</td></tr>` : ''}
      </tbody>
    </table></div>
    ${isNum(q.subscriptionTotal) || isNum(q.setupUsd) ? `<div class="kp-bigs">
      ${isNum(q.subscriptionTotal) ? `<div class="kp-big primary"><span>${M} oyga jami</span><strong>${big(q.subscriptionTotal)}</strong></div>` : ''}
      ${isNum(q.avgMonthly) ? `<div class="kp-big"><span>O’rtacha oyiga</span><strong>${big(q.avgMonthly)}</strong></div>` : ''}
      ${isNum(q.setupUsd) ? `<div class="kp-big"><span>Bir martalik o’rnatish</span><strong>${fmtUsd(q.setupUsd)}</strong></div>` : ''}
    </div>` : ''}
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

function termsSection(num, state, q, rateMeta, hasForecast) {
  const days = n(state.validDays);
  const until = days !== null && days > 0 ? addDays(state.date, Math.floor(days)) : null;
  const rateSource = rateMeta.kind === 'official'
    ? `Markaziy bank kursi${rateMeta.date ? `, ${esc(rateMeta.date)}` : ''}`
    : rateMeta.kind === 'fallback' ? `namunaviy kurs, ${esc(rateMeta.date)}` : 'kelishilgan kurs';
  const items = [
    `Obuna: ${q.months} oy to’lov + ${q.bonusMonths} oy bepul = ${q.usageMonths} oy CRM’dan foydalanish. Bepul oylar CRM obunasiga beriladi.`,
    q.chatbotType !== 'none' ? `AI chatbot obunaga kirmaydi: har oy alohida ${fmtUzs(q.chatbotMonthly)} to’lanadi, oldindan to’lov olinmaydi.` : null,
    isNum(q.setupUsd) ? `O’rnatish va integratsiya bir martalik to’lov: ${fmtUsd(q.setupUsd)}${q.agents ? ` (${setupTierLabel(q.agents)})` : ''}. Keyingi oylarda takrorlanmaydi.` : null,
    q.usdRate !== null
      ? `Narxlar so’mda. O’rnatish narxi 1 USD = ${fmtDecimal(q.usdRate)} so’m (${rateSource}) bo’yicha hisoblangan; to’lov kunidagi kurs bilan aniqlashtiriladi.`
      : 'Narxlar so’mda. O’rnatish narxi dollarda; so’mdagi summasi to’lov kunidagi Markaziy bank kursi bo’yicha hisoblanadi.',
    until ? `Taklif ${fmtDate(state.date)} dan ${fmtDate(until)} gacha amal qiladi.` : null,
    `${hasForecast ? 'Qo’shimcha sotuv hisobi prognoz, kafolat emas. ' : ''}Agentlar soni yoki xizmatlar tarkibi o’zgarsa, summa ham o’zgaradi.`,
  ].filter(Boolean);
  return `<section class="kp-section">
    ${sectionHead(num, 'Shartlar', '')}
    <ul class="kp-terms">${items.map((t) => `<li>${keep(t)}</li>`).join('')}</ul>
  </section>`;
}

function nextStep(state) {
  const s = seller(state);
  const main = s.phone ? `${icon('phone-call', { size: 22 })}${esc(s.phone)}` : `${icon('phone-call', { size: 22 })}${SELLER.site}`;
  const tag = s.href ? 'a' : 'div';
  return `<section class="kp-cta">
    <div class="kp-cta-art" aria-hidden="true">${logoMark({ size: 260 })}</div>
    <div class="kp-cta-text">
      <p class="kp-eyebrow on-dark">Keyingi qadam</p>
      <h2>Taklif ma’qul bo’lsa</h2>
      <p>TZni birga tayyorlaymiz va 2 kunlik o’rnatishni boshlaymiz.</p>
    </div>
    <${tag} class="kp-cta-card"${s.href ? ` href="${s.href}"` : ''}>
      <strong>${main}</strong>
      <span><b>${s.name ? esc(s.name) : 'Omon CRM'}</b><b>${SELLER.site}</b></span>
    </${tag}>
  </section>`;
}

/* ---------------- yig’ish ---------------- */

/**
 * Bo’limlar bitta oqimda chiqadi (css/kp.css: yashirilgan ma’lumot o’rnida bo’sh joy qolmaydi,
 * PDF’da betlarni brauzer taqsimlaydi). Raqam faqat chiqqan bo’limlarga beriladi: 01/02 bo’sh bo’lsa,
 * KP “01 Nima olasiz” dan boshlanadi.
 */
export function renderKp({ state, quote: q, forecast: f, rateMeta, logoSrc = '' }) {
  const status = statusCards(state);
  // Lidlar soni noto’g’ri bo’lsa leadForecast() lid prognozini null qiladi; tejalgan vaqt baribir chiqadi.
  const opps = opportunityCards(state, f);
  const reply = replyNote(f);

  let sectionNumber = 0;
  const section = (render, ...args) => {
    const html = render(String(sectionNumber + 1).padStart(2, '0'), ...args);
    if (html) sectionNumber += 1;
    return html;
  };

  const p1 = [
    hero({ state, q, logoSrc }), keyNumbers(),
    status.length ? section(statusSection, status) : '',
    opps.length || reply ? section(opportunitySection, opps, reply) : '',
  ];
  const p2 = [section(featuresSection, q)];
  const p3 = [section(priceSection, q), section(rolloutSection), section(termsSection, state, q, rateMeta, opps.length > 0), nextStep(state)];

  const s = seller(state);
  const pages = [[p1, 'first'], [p2, 'airy'], [p3, 'dense']];
  return `<div class="kp-pages">${pages.map(([parts, cls], i) => `<div class="kp-page ${cls}" data-page="${i + 1}"><div class="kp-body">${parts.join('')}</div>${pageFooter(i + 1, pages.length, s)}</div>`).join('')}</div>`;
}
