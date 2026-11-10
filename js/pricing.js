// Barcha narxlar shu yerda. Narx o’zgarsa, faqat shu fayl tahrirlanadi.
// Summalar so’mda, o’rnatish dollarda (USD kursi bo’yicha so’mga o’giriladi).

export const PRICING = Object.freeze({
  crmPerAgentMonth: 189_000, // so’m / agent / oy
  bonusMonths: Object.freeze({ 6: 1, 12: 3 }), // faqat CRM obunasiga
  setupUsd: (agents) => (agents <= 3 ? 200 : agents <= 5 ? 300 : 400),
  chatbot: Object.freeze({ none: 0, c500: 399_000, c1000: 499_000 }), // so’m / oy, oyma-oy to’lanadi (obuna jamiga kirmaydi)
  telephony: Object.freeze({ none: 0, myzvanki: 49_000 }), // MyZvanki: so’m / raqam / oy (UTEL paketlari pastda)
});

export const TERMS = Object.freeze([6, 12]);

/**
 * UTEL IP-telefoniya paketlari (utel.uz, 2026-11). Narx paket uchun, xodim soni paketga kiradi.
 * monthly[12] — “1 yil” to’lovidagi oylik narx; monthly[6] — 6 oylik narx ma’lum bo’lguncha
 * “1 oy” narxi olingan (eng yuqori, ya’ni mijoz uchun xavfsiz). Yangi narx kelsa, shu yerda o’zgartiring.
 */
export const UTEL_PACKAGES = Object.freeze({
  utel_start: Object.freeze({ name: 'Start AI', staff: 3, monthly: Object.freeze({ 6: 330_000, 12: 285_000 }), channels: 10, aiCalls: 300, aiMessages: 100 }),
  utel_optima: Object.freeze({ name: 'Optima AI', staff: 7, monthly: Object.freeze({ 6: 665_000, 12: 560_000 }), channels: 20, aiCalls: 500, aiMessages: 300 }),
  utel_profi: Object.freeze({ name: 'Profi AI', staff: 15, monthly: Object.freeze({ 6: 1_200_000, 12: 975_000 }), channels: 30, aiCalls: 1_000, aiMessages: 500 }),
});

export const isUtel = (type) => Object.hasOwn(UTEL_PACKAGES, type);

/** Agentlar soniga yetadigan eng kichik UTEL paketi (15 dan ko’p bo’lsa — Profi AI). */
export function recommendUtel(agents) {
  const keys = Object.keys(UTEL_PACKAGES);
  return keys.find((k) => agents <= UTEL_PACKAGES[k].staff) ?? keys[keys.length - 1];
}

export const TELEPHONY_LABELS = Object.freeze({
  none: 'Kerak emas',
  myzvanki: 'MyZvanki',
  utel_start: 'UTEL Start AI',
  utel_optima: 'UTEL Optima AI',
  utel_profi: 'UTEL Profi AI',
});

export const CHATBOT_LABELS = Object.freeze({
  none: 'Kerak emas',
  c500: '500 ta mijoz',
  c1000: '1 000 ta mijoz',
});

/** O’rnatish narxi qaysi agentlar oralig’iga tushishini matn bilan. */
export function setupTierLabel(agents) {
  if (agents <= 3) return '1–3 agent';
  if (agents <= 5) return '4–5 agent';
  return '6 va undan ko’p agent';
}

/** Standart ijrochi (formada o’zgartirish mumkin) va kompaniya sayti. */
export const SELLER = Object.freeze({
  name: 'Muzaffar Mirkhamidov',
  shortName: 'Muzaffar',
  phone: '+998 77 177 13 19',
  phoneHref: 'tel:+998771771319',
  site: 'omoncrm.uz',
});

/** CBU kursi olinmasa ishlatiladigan namunaviy kurs (sahifada aniq ko’rsatiladi). */
export const FALLBACK_USD_RATE = Object.freeze({ rate: 11_941.65, date: '03.11.2026' });

/** CRM bilan tur qidirish vaqti (daqiqa): 30 soniya. */
export const CRM_SEARCH_MINUTES = 0.5;
