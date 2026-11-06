// Toza hisob-kitob: DOM’ga tegmaydi. KP, forma paneli va PDF faqat shu natijadan foydalanadi.
import { PRICING, TERMS } from './pricing.js';

/**
 * @typedef {{ agents: number|null, months: 6|12, telephony: 'none'|'myzvanki'|'uztel',
 *   lines: number|null, chatbot: 'none'|'c500'|'c1000', usdRate: number|null }} QuoteInput
 *
 * @typedef {{ agents: number|null, months: 6|12, lines: number,
 *   telephonyType: string, chatbotType: string,
 *   crmMonthly: number|null, telephonyMonthly: number|null, chatbotMonthly: number,
 *   crm: number|null, telephony: number|null, chatbot: number,
 *   subscriptionTotal: number|null, avgMonthly: number|null,
 *   setupUsd: number|null, setupUzs: number|null, grandTotal: number|null,
 *   bonusMonths: number, usageMonths: number, crmMonthlyWithBonus: number|null }} Quote
 */

/** Kiritilgan qiymat → son yoki null (bo’sh, NaN, cheksiz bo’lsa). Hech qachon 0 ga aylantirmaydi. */
export function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim().replace(/\s+/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const posInt = (v) => {
  const n = toNumber(v);
  return n !== null && n >= 1 ? Math.floor(n) : null;
};
const nonNegInt = (v) => {
  const n = toNumber(v);
  return n !== null && n >= 0 ? Math.floor(n) : null;
};
const sum = (...xs) => (xs.some((x) => x === null) ? null : xs.reduce((a, b) => a + b, 0));

/**
 * @param {Partial<QuoteInput>} input
 * @returns {Quote}
 */
export function calculateQuote(input = {}) {
  const months = TERMS.includes(Number(input.months)) ? Number(input.months) : 6;
  const agents = posInt(input.agents);
  const telephonyType = Object.hasOwn(PRICING.telephony, input.telephony) ? input.telephony : 'none';
  const chatbotType = Object.hasOwn(PRICING.chatbot, input.chatbot) ? input.chatbot : 'none';
  const usdRate = toNumber(input.usdRate);
  const rate = usdRate !== null && usdRate > 0 ? usdRate : null;

  const bonusMonths = PRICING.bonusMonths[months];
  const usageMonths = months + bonusMonths;

  const crmMonthly = agents === null ? null : PRICING.crmPerAgentMonth * agents;
  const crm = crmMonthly === null ? null : crmMonthly * months;

  let lines = 0;
  let telephonyMonthly = 0;
  if (telephonyType !== 'none') {
    const l = nonNegInt(input.lines);
    lines = l ?? 0;
    telephonyMonthly = l === null ? null : PRICING.telephony[telephonyType] * l;
  }
  const telephony = telephonyMonthly === null ? null : telephonyMonthly * months;

  const chatbotMonthly = PRICING.chatbot[chatbotType];
  const chatbot = chatbotMonthly * months;

  const subscriptionTotal = sum(crm, telephony, chatbot);
  const avgMonthly = subscriptionTotal === null ? null : Math.round(subscriptionTotal / months);

  const setupUsd = agents === null ? null : PRICING.setupUsd(agents);
  const setupUzs = setupUsd === null || rate === null ? null : Math.round(setupUsd * rate);
  const grandTotal = sum(subscriptionTotal, setupUzs);
  const crmMonthlyWithBonus = crm === null ? null : Math.round(crm / usageMonths);

  return {
    agents, months, lines, telephonyType, chatbotType, usdRate: rate,
    crmMonthly, telephonyMonthly, chatbotMonthly,
    crm, telephony, chatbot,
    subscriptionTotal, avgMonthly,
    setupUsd, setupUzs, grandTotal,
    bonusMonths, usageMonths, crmMonthlyWithBonus,
  };
}

/** Formadagi holatdan calculateQuote kirishini yig’adi. */
export function quoteInputFromState(state) {
  return {
    agents: state.agents,
    months: Number(state.months),
    telephony: state.telephony,
    lines: state.lines,
    chatbot: state.chatbot,
    usdRate: state.fx,
  };
}

const pct = (v) => {
  const n = toNumber(v);
  return n === null ? null : Math.min(100, Math.max(0, n)) / 100;
};
const nn = (v) => {
  const n = toNumber(v);
  return n === null ? null : Math.max(0, n);
};
const mul = (...xs) => (xs.some((x) => x === null) ? null : xs.reduce((a, b) => a * b, 1));

/**
 * Qo’shimcha sotuv prognozi (hozirgi saytdagi formulalar). Kafolat emas.
 * Har bir natija faqat kerakli maydonlar to’ldirilganda hisoblanadi, aks holda null.
 */
export function leadForecast(state) {
  const workDays = nn(state.workDays);
  const leads = nn(state.leads);
  const missed = nn(state.missed);
  const invalid = leads !== null && missed !== null && missed > leads;

  const lostPerMonth = invalid ? null : mul(missed, workDays);
  const recoverable = mul(lostPerMonth, pct(state.recovery));
  const extraBookings = mul(recoverable, pct(state.conversion));
  const extraProfit = mul(extraBookings, nn(state.profit));

  const searchNow = nn(state.searchNow);
  const searchAfter = nn(state.searchAfter);
  const searches = nn(state.searches);
  const diff = searchNow === null || searchAfter === null ? null : Math.max(0, searchNow - searchAfter);
  const minutesSaved = mul(diff, searches, workDays);
  const hoursSaved = minutesSaved === null ? null : minutesSaved / 60;

  return {
    invalid,
    workDays,
    lostPerMonth,
    recoverable,
    extraBookings,
    extraProfit,
    hoursSaved,
    responseNow: nn(state.responseNow),
    responseAfter: nn(state.responseAfter),
    searchNow,
    searchAfter,
  };
}
