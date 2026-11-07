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

test('KP 3 betdan iborat', () => {
  const { html } = kp(FULL);
  assert.equal((html.match(/class="kp-page /g) || []).length, 3);
  for (const n of ['01', '02', '03', '04', '05', '06', '07']) assert.ok(html.includes(`<span>${n}</span>`), n);
});

test('12 oy tanlanganda “6 oy” yoki “+1 oy” qolmaydi', () => {
  const { text } = kp(FULL);
  assert.doesNotMatch(text, /(^|[^\d])6 oy/);
  assert.ok(!text.includes('+1 oy'));
  assert.ok(text.includes('+3 oy bepul'));
  assert.ok(text.includes('15 oy'));
});

test('nazorat misoli KP’da to’g’ri chiqadi', () => {
  const { text } = kp(FULL);
  for (const s of ['11 340 000', '2 940 000', '4 788 000', '19 068 000', '1 589 000', '$300', '756 000']) assert.ok(text.includes(s), s);
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
  assert.ok(text.includes('Bitrix24') && text.includes('amoCRM'));
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
