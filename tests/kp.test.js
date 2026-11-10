// TZ “Qabul qilish mezonlari → KP va PDF” bandlarining matnga oid qismi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderKp } from '../js/kp.js';
import { calculateQuote, quoteInputFromState, leadForecast } from '../js/quote.js';
import { defaultState } from '../js/storage.js';

const RATE = { kind: 'official', date: '06.11.2026', manual: false };

function kp(overrides = {}) {
  const state = { ...defaultState('2026-11-06'), ...overrides };
  const html = renderKp({ state, quote: calculateQuote(quoteInputFromState(state)), forecast: leadForecast(state), rateMeta: RATE });
  const text = html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  return { html, text };
}

const FULL = {
  agency: 'Samo Travel', owner: 'Alisher Karimov', agents: '5', months: '12', telephony: 'myzvanki', lines: '5', chatbot: 'c500',
  leads: '30', missed: '5', recovery: '50', conversion: '25', profit: '800000', responseNow: '15', responseAfter: '5', searchNow: '20', searches: '18',
};

const pages = (html) => (html.match(/class="kp-page /g) || []).length;
const section = (html, num) => (html.match(new RegExp(`<span>${num}</span>([^<]+)</p>`)) || [])[1];

test('to’liq ma’lumotda bo’limlar 01–06, taqqoslash yo’q', () => {
  const { html } = kp(FULL);
  assert.equal(pages(html), 3);
  assert.equal(section(html, '01'), 'Agentlik holati');
  assert.equal(section(html, '02'), 'Qo’shimcha sotuv imkoniyati');
  assert.equal(section(html, '03'), 'Nima olasiz');
  assert.equal(section(html, '04'), 'Narx hisobi');
  assert.equal(section(html, '06'), 'Shartlar');
  assert.equal(section(html, '07'), undefined);
});

test('agentlik holati va qo’shimcha sotuv kiritilmasa, KP 01 “Nima olasiz” dan boshlanadi', () => {
  const { html, text } = kp({ agency: 'Samo Travel', agents: '3' });
  assert.equal(pages(html), 3);
  assert.equal(section(html, '01'), 'Nima olasiz');
  assert.equal(section(html, '02'), 'Narx hisobi');
  assert.equal(section(html, '04'), 'Shartlar');
  assert.ok(!text.includes('Agentlik holati'));
  assert.ok(!text.includes('Qo’shimcha sotuv'));
  assert.ok(!text.includes('prognoz'));
  assert.ok(text.includes('Quyida 3 agentli jamoangiz uchun narx hisobini'), 'sarlavha bet raqamiga bog’lanmagan');
  assert.doesNotMatch(text, /\d-sahifada/);
});

test('faqat to’ldirilgan ko’rsatkichlar chiqadi, bo’sh kartochka yo’q', () => {
  const { html, text } = kp({ employees: '4', leads: '30' });
  assert.equal(section(html, '01'), 'Agentlik holati');
  assert.equal(section(html, '02'), 'Nima olasiz');
  assert.equal((html.match(/class="kp-metric"/g) || []).length, 2);
  assert.ok(text.includes('xodim') && text.includes('lid kuniga'));
  assert.ok(!text.includes('mijozga javob berish'));
  assert.ok(!text.includes('bitta tur qidirish'));
  assert.ok(!text.includes('—'), 'bo’sh qiymat “—” bo’lib ham chiqmaydi');
});

test('qo’shimcha sotuvda faqat hisoblanganlari chiqadi', () => {
  const { html, text } = kp({ leads: '30', missed: '5' });
  assert.equal(section(html, '02'), 'Qo’shimcha sotuv imkoniyati');
  assert.equal((html.match(/class="kp-opp"/g) || []).length, 1);
  assert.ok(text.includes('130 ta'));
  assert.ok(!text.includes('qo’shimcha bron oyiga'));
  assert.ok(!text.includes('tejalgan vaqt'));
});

test('12 oy tanlanganda “6 oy” yoki “+1 oy” qolmaydi', () => {
  const { text } = kp(FULL);
  assert.doesNotMatch(text, /(^|[^\d])6 oy/);
  assert.ok(!text.includes('+1 oy'));
  assert.ok(text.includes('+3 oy bepul'));
  assert.ok(text.includes('15 oy'));
});

test('nazorat misoli KP’da to’g’ri chiqadi, chatbot oyma-oy', () => {
  const { html, text } = kp(FULL);
  for (const s of ['11 340 000', '2 940 000', '14 280 000', '1 190 000', '$300', '756 000', '399 000 so’m / oy']) assert.ok(text.includes(s), s);
  assert.ok(!text.includes('4 788 000'), 'chatbot 12 oyga ko’paytirilmaydi');
  assert.ok(!text.includes('19 068 000'));
  assert.ok(text.includes('1-oy umumiy summada, keyin har oy'));
  const grand = html.slice(html.indexOf('class="kp-grand"'), html.indexOf('</tr>', html.indexOf('class="kp-grand"')));
  assert.ok(grand.includes('18 261 495') && grand.includes('chatbotning 1-oyi'), 'umumiy to’lovga chatbotning 1-oyi kiradi');
  const total = html.slice(html.indexOf('class="kp-total"'), html.indexOf('</tr>', html.indexOf('class="kp-total"')));
  assert.ok(total.includes('14 280 000'));
});

test('ijrochi formadan olinadi', () => {
  const { text: def } = kp(FULL);
  assert.ok(def.includes('Muzaffar Mirkhamidov') && def.includes('+998 77 177 13 19'));
  const { html, text } = kp({ ...FULL, sellerName: 'Dilnoza Karimova', sellerPhone: '+998 90 111 22 33' });
  assert.ok(text.includes('Dilnoza Karimova'));
  assert.ok(text.includes('+998 90 111 22 33'));
  assert.ok(html.includes('href="tel:+998901112233"'));
  assert.ok(!text.includes('Muzaffar'));
  assert.ok(!text.includes('+998 77 177 13 19'));
});

test('agentlik logotipi tepada, Omon CRM yonida', () => {
  const logo = 'data:image/png;base64,iVBORw0KGgo=';
  const state = { ...defaultState('2026-11-06'), agency: 'Samo Travel' };
  const html = renderKp({ state, quote: calculateQuote(quoteInputFromState(state)), forecast: leadForecast(state), rateMeta: RATE, logoSrc: logo });
  const top = html.slice(html.indexOf('class="kp-hero-top"'), html.indexOf('class="kp-hero-main"'));
  assert.ok(top.includes('kp-hero-brand') && top.includes('Omon CRM') && top.includes(logo));
  assert.equal(html.split(logo).length - 1, 1, 'logo bir marta chiqadi');
});

test('tanlanmagan telefoniya va chatbot narx jadvalida yo’q', () => {
  const { html } = kp({ ...FULL, telephony: 'none', chatbot: 'none' });
  const table = html.slice(html.indexOf('class="kp-price"'), html.indexOf('</table>', html.indexOf('class="kp-price"')));
  assert.ok(!table.includes('Qo’ng’iroqlarni yozib olish'));
  assert.ok(!table.includes('AI chatbot'));
  assert.ok(!html.includes('Qo’ng’iroq yozuvi ·'));
});

test('tur qidirish: 14 ta operator, 30 soniya, bron; Turvisor yo’q', () => {
  const { text } = kp(FULL);
  assert.ok(text.includes('14 ta operator'));
  assert.ok(text.includes('30 soniya'));
  assert.ok(/[Bb]ron/.test(text));
  assert.ok(!/turvisor/i.test(text));
  assert.ok(text.includes('20+'));
  assert.ok(!/Taqqoslash|Bitrix24|amoCRM/.test(text), 'taqqoslash bo’limi olib tashlangan');
  assert.ok(text.includes('Keyingi qadam') && text.includes('+998 77 177 13 19') && text.includes('omoncrm.uz'));
});

test('bo’sh maydonlar va hisoblanmagan qiymatlar KP’da chiqmaydi', () => {
  const empty = Object.fromEntries(Object.keys(defaultState()).map((k) => [k, '']));
  for (const state of [empty, { agents: '' }, { fx: '' }, { telephony: 'uztel', lines: '' }]) {
    const { html, text } = kp(state);
    assert.ok(!text.includes('NaN'), 'NaN');
    assert.ok(!text.includes('undefined'), 'undefined');
    assert.ok(!text.includes('null'), 'null');
    assert.doesNotMatch(text, /(^|[^\d ])0 so’m/);
    assert.doesNotMatch(html, />—<|× —|: —/);
  }
});

test('foydalanuvchi matni HTML sifatida bajarilmaydi', () => {
  const { html } = kp({ agency: '<img src=x onerror=alert(1)>', owner: '"><script>x</script>' });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>'));
});

test('bo’sh bo’limlar sarlavhasi bilan yashiriladi', () => {
  const { html, text } = kp({ employees: '  ', agents: '', date: '', validDays: '' });
  for (const label of ['Agentlik holati', 'Qo’shimcha sotuv imkoniyati', 'Narx hisobi', 'Kimga', 'Amal qiladi']) {
    assert.ok(!text.includes(label), label);
  }
  assert.ok(!html.includes('class="kp-metrics"'));
  assert.ok(!html.includes('class="kp-opps"'));
  assert.ok(!html.includes('class="kp-price"'));
});

test('qisman to’ldirilgan va nol ko’rsatkichlar saqlanadi', () => {
  const { html, text } = kp({ employees: '', missed: '0' });
  assert.equal((html.match(/class="kp-metric"/g) || []).length, 1);
  assert.equal((html.match(/class="kp-opp"/g) || []).length, 1);
  assert.ok(text.includes('lid oyiga ishlanmay qolmoqda'));
  assert.ok(!text.includes('qo’shimcha bron oyiga'));
  assert.ok(!text.includes('qo’shimcha sof foyda oyiga'));
  assert.ok(!text.includes('tur qidirishda tejalgan vaqt oyiga'));
});

test('javob vaqti prognozsiz ham ko’rinadi; qiymat o’chirilsa yana yashiriladi', () => {
  const filled = kp({ responseNow: '15', responseAfter: '5' }).html;
  assert.ok(filled.includes('class="kp-inline-note"'));
  assert.ok(!filled.includes('class="kp-opps"'));
  assert.ok(!kp({ responseNow: '15', responseAfter: '' }).html.includes('class="kp-inline-note"'));
});

test('raqamlar soni bo’sh telefoniya qatori va hisoblanmagan jamilar yashiriladi', () => {
  const { html } = kp({ ...FULL, lines: '  ' });
  assert.ok(!html.includes('class="kp-total"'));
  assert.ok(!html.includes('class="kp-grand"'));
  assert.ok(!html.includes('Qo’ng’iroq yozuvi ·'));
  assert.ok(!html.includes('MyZvanki (Moizvonki), Android uchun'));
  assert.ok(html.includes('Omon CRM obunasi'));
  assert.ok(html.includes('class="kp-setup"'));
});

test('noto’g’ri lidlar prognozi yashiriladi, mustaqil vaqt hisobi saqlanadi', () => {
  const { text } = kp({ ...FULL, missed: '40' });
  assert.ok(!text.includes('lid oyiga ishlanmay qolmoqda'));
  assert.ok(!text.includes('qo’shimcha bron oyiga'));
  assert.ok(!text.includes('qo’shimcha sof foyda oyiga'));
  assert.ok(text.includes('tur qidirishda tejalgan vaqt oyiga'));
});
