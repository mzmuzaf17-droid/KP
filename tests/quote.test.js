// TZ “Qabul qilish mezonlari → Hisob-kitob” bandlari avtomatik test sifatida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuote, leadForecast, toNumber } from '../js/quote.js';
import { PRICING } from '../js/pricing.js';
import { fmtInt, fmtUzs, fmtDecimal, fmtMinutes, pdfFileName, addDays } from '../js/format.js';

test('3 agent, 6 oy, telefoniya va chatbot yo’q, kurs 11 941,65', () => {
  const q = calculateQuote({ agents: 3, months: 6, telephony: 'none', lines: 1, chatbot: 'none', usdRate: 11941.65 });
  assert.equal(q.crm, 3_402_000);
  assert.equal(q.setupUsd, 200);
  assert.equal(q.setupUzs, 2_388_330);
  assert.equal(q.grandTotal, 5_790_330);
  assert.equal(q.usageMonths, 7);
  assert.equal(q.bonusMonths, 1);
  assert.equal(q.telephony, 0);
  assert.equal(q.chatbotMonthly, 0);
});

test('5 agent, 12 oy, MyZvanki 5 raqam, chatbot 500 — chatbot oyma-oy, jamiga kirmaydi', () => {
  const q = calculateQuote({ agents: 5, months: 12, telephony: 'myzvanki', lines: 5, chatbot: 'c500', usdRate: 12000 });
  assert.equal(q.crm, 11_340_000);
  assert.equal(q.telephony, 2_940_000);
  assert.equal(q.chatbotMonthly, 399_000);
  assert.ok(!('chatbot' in q), 'chatbot uchun muddatga ko’paytirilgan summa yo’q');
  assert.equal(q.subscriptionTotal, 14_280_000);
  assert.equal(q.avgMonthly, 1_190_000);
  assert.equal(q.setupUsd, 300);
  assert.equal(q.usageMonths, 15);
  assert.equal(q.crmMonthlyWithBonus, 756_000);
  assert.equal(q.chatbotFirstMonth, 399_000);
  assert.equal(q.grandTotal, 14_280_000 + 300 * 12000 + 399_000, 'umumiy summaga chatbotning 1-oyi kiradi');
});

test('o’rnatish narxi agentlar soniga qarab', () => {
  const setup = (agents) => calculateQuote({ agents, months: 6 }).setupUsd;
  assert.equal(setup(1), 200);
  assert.equal(setup(3), 200);
  assert.equal(setup(4), 300);
  assert.equal(setup(5), 300);
  assert.equal(setup(6), 400);
  assert.equal(setup(40), 400);
  assert.equal(PRICING.setupUsd(6), 400);
});

test('chatbot 1 000 mijoz → 499 000 / oy, muddatga ko’paytirilmaydi', () => {
  const q = calculateQuote({ agents: 1, months: 6, chatbot: 'c1000' });
  assert.equal(q.chatbotMonthly, 499_000);
  assert.equal(q.subscriptionTotal, 189_000 * 6);
});

test('UTEL paketlari: 12 oyda yillik narx, xodim soni paketga kiradi', () => {
  const opt = calculateQuote({ agents: 5, months: 12, telephony: 'utel_optima', lines: 99 });
  assert.equal(opt.telephonyMonthly, 560_000);
  assert.equal(opt.telephony, 6_720_000, 'utel.uz: Optima AI 6 720 000 so’m/yil');
  assert.equal(opt.lines, 0, 'UTEL raqam soniga bog’liq emas');
  assert.equal(opt.telephonyFits, true);
  assert.equal(calculateQuote({ agents: 3, months: 12, telephony: 'utel_start' }).telephony, 3_420_000);
  assert.equal(calculateQuote({ agents: 10, months: 12, telephony: 'utel_profi' }).telephony, 11_700_000);
});

test('UTEL 6 oy: 1 oylik narx olinadi; paket agentlarga yetmasa belgilanadi', () => {
  const q = calculateQuote({ agents: 5, months: 6, telephony: 'utel_start' });
  assert.equal(q.telephony, 330_000 * 6);
  assert.equal(q.telephonyFits, false, '5 agent uchun Start AI (3 xodim) yetmaydi');
  assert.equal(q.subscriptionTotal, 189_000 * 5 * 6 + 330_000 * 6);
});

test('tavsiya qilinadigan UTEL paketi agentlar soniga qarab', async () => {
  const { recommendUtel } = await import('../js/pricing.js');
  assert.equal(recommendUtel(1), 'utel_start');
  assert.equal(recommendUtel(3), 'utel_start');
  assert.equal(recommendUtel(4), 'utel_optima');
  assert.equal(recommendUtel(7), 'utel_optima');
  assert.equal(recommendUtel(8), 'utel_profi');
  assert.equal(recommendUtel(40), 'utel_profi');
});

test('bonus faqat CRM’ga: telefoniya va chatbot to’lov oylari bo’yicha', () => {
  const q = calculateQuote({ agents: 2, months: 12, telephony: 'myzvanki', lines: 1, chatbot: 'c500' });
  assert.equal(q.telephony, 49_000 * 12);
  assert.equal(q.subscriptionTotal, 189_000 * 2 * 12 + 49_000 * 12);
  assert.equal(q.crmMonthlyWithBonus, Math.round((189_000 * 2 * 12) / 15));
});

test('bo’sh maydonlar 0 emas, null bo’ladi', () => {
  const q = calculateQuote({ agents: '', months: 6, telephony: 'none', chatbot: 'none', usdRate: '' });
  for (const key of ['crm', 'subscriptionTotal', 'avgMonthly', 'setupUsd', 'setupUzs', 'grandTotal', 'crmMonthlyWithBonus']) {
    assert.equal(q[key], null, key);
  }
  const noRate = calculateQuote({ agents: 3, months: 6, usdRate: '' });
  assert.equal(noRate.subscriptionTotal, 3_402_000);
  assert.equal(noRate.setupUzs, null);
  assert.equal(noRate.grandTotal, null);
  const noLines = calculateQuote({ agents: 3, months: 6, telephony: 'myzvanki', lines: '' });
  assert.equal(noLines.telephony, null);
  assert.equal(noLines.subscriptionTotal, null);
});

test('noto’g’ri qiymatlar NaN chiqarmaydi', () => {
  const q = calculateQuote({ agents: 'abc', months: 7, telephony: 'x', lines: -2, chatbot: 'zzz', usdRate: 'NaN' });
  assert.equal(q.months, 6);
  assert.equal(q.telephonyType, 'none');
  assert.equal(q.chatbotType, 'none');
  for (const v of Object.values(q)) assert.ok(!(typeof v === 'number' && Number.isNaN(v)));
  assert.equal(toNumber('1 589 000'), 1_589_000);
  assert.equal(toNumber('11941,65'), 11941.65);
  assert.equal(toNumber(''), null);
});

test('formatlash: minglar bo’sh joy bilan, bo’sh qiymat “—”', () => {
  assert.equal(fmtInt(19_068_000), '19 068 000');
  assert.equal(fmtUzs(1_589_000), '1 589 000 so’m');
  assert.equal(fmtUzs(null), '—');
  assert.equal(fmtUzs(NaN), '—');
  assert.equal(fmtUzs(undefined), '—');
  assert.equal(fmtDecimal(11941.65), '11 941,65');
  assert.equal(fmtMinutes(0.5), '30 soniya');
  assert.equal(fmtMinutes(15), '15 daqiqa');
  assert.equal(addDays('2026-11-06', 7), '2026-11-13');
});

test('PDF fayl nomi agentlik va sana bilan', () => {
  assert.equal(pdfFileName('Samo Travel', '2026-11-06'), 'OmonCRM_KP_Samo-Travel_2026-11-06');
  assert.equal(pdfFileName('Sayohat O’zbekiston', '2026-11-06'), 'OmonCRM_KP_Sayohat-Ozbekiston_2026-11-06');
  assert.equal(pdfFileName('', '2026-11-06'), 'OmonCRM_KP_turagentlik_2026-11-06');
});

test('lid prognozi: hozirgi formulalar', () => {
  const f = leadForecast({ workDays: 26, leads: 30, missed: 5, recovery: 50, conversion: 20, profit: 800000, searchNow: 20, searchAfter: 0.5, searches: 18 });
  assert.equal(f.lostPerMonth, 130);
  assert.equal(f.recoverable, 65);
  assert.equal(f.extraBookings, 13);
  assert.equal(f.extraProfit, 10_400_000);
  assert.equal(f.hoursSaved, (19.5 * 18 * 26) / 60);
  const bad = leadForecast({ workDays: 26, leads: 3, missed: 5 });
  assert.equal(bad.invalid, true);
  assert.equal(bad.lostPerMonth, null);
  const empty = leadForecast({});
  assert.equal(empty.extraProfit, null);
  assert.equal(empty.hoursSaved, null);
});

test('chatbot yo’q bo’lsa umumiy summa o’zgarmaydi', () => {
  const q = calculateQuote({ agents: 3, months: 6, chatbot: 'none', usdRate: 11941.65 });
  assert.equal(q.chatbotFirstMonth, 0);
  assert.equal(q.grandTotal, 5_790_330);
});
